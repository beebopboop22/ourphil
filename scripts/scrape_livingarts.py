#!/usr/bin/env python3

import os
import re
import json
from datetime import datetime
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# ── Env / Supabase ─────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── HTTP headers ───────────────────────────────────────────────────────────────
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Cache-Control": "no-cache",
}

# ── Helpers ────────────────────────────────────────────────────────────────────
def slugify(text: str) -> str:
    s = (text or "").lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def split_date_time(iso_str: str | None) -> tuple[str | None, str | None]:
    """Return (YYYY-MM-DD, HH:MM:SS) from an ISO string like '2025-10-16T20:00:00-04:00'."""
    if not iso_str:
        return (None, None)
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return (dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M:%S"))
    except Exception:
        # Fall back to a few common formats (date-only returns no time)
        for fmt in ("%Y-%m-%d %H:%M", "%Y/%m/%d %H:%M", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(iso_str, fmt)
                d = dt.strftime("%Y-%m-%d")
                t = dt.strftime("%H:%M:%S") if "%H" in fmt else None
                return (d, t)
            except Exception:
                pass
    return (None, None)

def extract_events_from_jsonld_payload(payload) -> list[dict]:
    out = []

    def pick_image(image):
        if not image:
            return None
        if isinstance(image, dict):
            return image.get("url") or image.get("contentUrl")
        if isinstance(image, list) and image:
            first = image[0]
            return first.get("url") if isinstance(first, dict) else first
        return image if isinstance(image, str) else None

    def maybe_event(obj):
        if not isinstance(obj, dict):
            return None
        t = obj.get("@type")
        if isinstance(t, list):
            if not any(x in ("MusicEvent", "Event") for x in t):
                return None
        else:
            if t not in ("MusicEvent", "Event"):
                return None

        name = obj.get("name") or obj.get("headline")
        if not name:
            return None

        start_date, start_time = split_date_time(obj.get("startDate"))
        end_date, end_time     = split_date_time(obj.get("endDate"))
        url   = obj.get("url")
        image = pick_image(obj.get("image"))

        venue_name = "Theatre of Living Arts"
        loc = obj.get("location")
        if isinstance(loc, dict) and loc.get("name"):
            venue_name = loc["name"]

        slug = None
        if isinstance(url, str):
            try:
                tail = urlparse(url).path.rstrip("/").split("/")[-1]
                if tail and not tail.isdigit():
                    slug = slugify(tail)
            except Exception:
                pass
        if not slug:
            slug_bits = [name, start_date] if start_date else [name]
            slug = slugify("-".join([b for b in slug_bits if b]))

        return {
            "title": name,
            "link": url,
            "image": image,
            "start_date": start_date,
            "end_date": end_date,
            "start_time": start_time,
            "end_time": end_time,
            "description": None,
            "venue_name": venue_name,
            "slug": slug,
        }

    def walk(obj):
        if isinstance(obj, list):
            for item in obj:
                walk(item)
        elif isinstance(obj, dict):
            ev = maybe_event(obj)
            if ev:
                out.append(ev)
            g = obj.get("@graph")
            if isinstance(g, list):
                for sub in g:
                    ev2 = maybe_event(sub)
                    if ev2:
                        out.append(ev2)

    walk(payload)
    return out

def scrape_events() -> list[dict]:
    URL = "https://www.tlaphilly.com/shows"
    r = requests.get(URL, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    events: list[dict] = []
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = script.string or script.text
        if not raw:
            continue
        try:
            payload = json.loads(raw)
            events.extend(extract_events_from_jsonld_payload(payload))
        except Exception:
            # Best-effort recovery for concatenated JSON blocks
            chunks = re.split(r"}\s*{", raw.strip())
            if len(chunks) > 1:
                rec = []
                for i, c in enumerate(chunks):
                    if i == 0:   rec.append(c + "}")
                    elif i == len(chunks) - 1: rec.append("{" + c)
                    else:        rec.append("{" + c + "}")
                for ch in rec:
                    try:
                        payload = json.loads(ch)
                        events.extend(extract_events_from_jsonld_payload(payload))
                    except Exception:
                        pass

    # Dedup by link, else slug
    dedup = {}
    for ev in events:
        key = ev.get("link") or ev["slug"]
        if key and key not in dedup:
            dedup[key] = ev
    return list(dedup.values())

def upsert_data(events: list[dict]) -> None:
    venue_id_cache: dict[str, str] = {}

    for ev in events:
        print(f"⏳ Processing: {ev['title']}")
        vname = ev["venue_name"] or "Theatre of Living Arts"

        if vname not in venue_id_cache:
            v = (
                supabase.table("venues")
                .upsert({"name": vname}, on_conflict=["name"], returning="representation")
                .execute()
            )
            venue_id_cache[vname] = v.data[0]["id"] if v.data else None
        venue_id = venue_id_cache.get(vname)

        record = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "end_date":    ev["end_date"],
            "start_time":  ev["start_time"],  # ← now included
            "end_time":    ev["end_time"],    # ← optional if you keep the column
            "description": ev["description"],
            "venue_id":    venue_id,
            "source":      "tla",
            "slug":        ev["slug"],
        }

        supabase.table("all_events").upsert(record, on_conflict=["link"]).execute()
        print(f"✅ Upserted: {ev['title']}")

# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    events = scrape_events()
    print(f"🔎 Found {len(events)} events")
    if events:
        upsert_data(events)
