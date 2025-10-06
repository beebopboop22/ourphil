#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/scrape_met.py

Scrapes The Met Philly shows by reading server-rendered JSON-LD from /shows.
Each JSON-LD MusicEvent/Event provides startDate (date+time) and a Ticketmaster URL.
If anything is missing, we fall back to fetching the Ticketmaster page JSON-LD.

Writes into `all_events` (on_conflict: link). Ensures venue exists by slug.

ENV:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY)
"""

import os
import re
import json
import time
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime
from urllib.parse import urljoin

# ── Setup ──────────────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_URL   = "https://www.themetphilly.com"
LIST_URL   = f"{BASE_URL}/shows"
VENUE_NAME = "The Met Presented by Highmark"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Connection": "close",
}

# ── Utils ──────────────────────────────────────────────────────────────────────
_slug_non_alnum = re.compile(r"[^a-z0-9]+")

def slugify(text: str) -> str:
    s = (text or "").lower().replace("&", " and ")
    s = _slug_non_alnum.sub("-", s)
    return s.strip("-")

def get_soup(url: str) -> BeautifulSoup | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()
        return BeautifulSoup(r.text, "html.parser")
    except Exception as e:
        print(f"⚠️  Fetch failed {url}: {e}")
        return None

def parse_iso_like(dt_str: str | None) -> tuple[str | None, str | None]:
    """
    '2025-10-06T20:00:00-04:00' -> ('2025-10-06','20:00:00')
    """
    if not dt_str:
        return (None, None)
    try:
        s = dt_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        return (dt.date().isoformat(), dt.strftime("%H:%M:%S"))
    except Exception:
        m = re.search(r"(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::\d{2})?", dt_str)
        if m:
            return (m.group(1), f"{m.group(2)}:00")
        return (None, None)

def coalesce(*vals):
    for v in vals:
        if v:
            return v
    return None

def pick_jsonld_event(objs: list[dict]) -> dict | None:
    """
    Pick the most relevant Event/MusicEvent object (prefer one with startDate).
    """
    out = []
    for o in objs:
        if not isinstance(o, dict):
            continue
        t = o.get("@type")
        if isinstance(t, list):
            is_event = any(str(x).lower().endswith("event") for x in t)
        else:
            is_event = isinstance(t, str) and str(t).lower().endswith("event")
        if is_event and (o.get("startDate") or o.get("start_date")):
            out.append(o)
    if not out:
        return None
    # Prefer objects that mention the venue name explicitly
    for o in out:
        loc = o.get("location") or {}
        name = (loc.get("name") if isinstance(loc, dict) else None) or ""
        if "met" in str(name).lower():
            return o
    return out[0]

def normalize_event_from_jsonld(obj: dict) -> dict:
    """
    Map a JSON-LD Event/MusicEvent object to our normalized dict.
    """
    start_date, start_time = parse_iso_like(obj.get("startDate") or obj.get("start_date"))
    # image can be string or list
    img = obj.get("image")
    if isinstance(img, list) and img:
        img = img[0]
    if not isinstance(img, str):
        img = None
    # address
    address = None
    loc = obj.get("location")
    if isinstance(loc, dict):
        addr = loc.get("address")
        if isinstance(addr, dict):
            parts = [
                addr.get("streetAddress"),
                addr.get("addressLocality"),
                addr.get("addressRegion"),
                addr.get("postalCode"),
            ]
            address = ", ".join([p for p in parts if p])
        if not address and loc.get("name"):
            address = loc["name"]

    return {
        "title": obj.get("name"),
        "link": obj.get("url"),  # Ticketmaster (usually)
        "image": img,
        "start_date": start_date,
        "start_time": start_time,
        "description": obj.get("description"),
        "address": address,
    }

def harvest_jsonld_events(soup: BeautifulSoup) -> list[dict]:
    """
    Collect every Event/MusicEvent JSON-LD object present on the page.
    """
    events = []
    for s in soup.select('script[type="application/ld+json"]'):
        try:
            raw = s.string or s.get_text(strip=True)
            data = json.loads(raw)
        except Exception:
            continue

        objs = data if isinstance(data, list) else [data]
        for o in objs:
            try:
                t = o.get("@type")
                if isinstance(t, list):
                    is_event = any(str(x).lower().endswith("event") for x in t)
                else:
                    is_event = isinstance(t, str) and str(t).lower().endswith("event")
                if not is_event:
                    continue
                ev = normalize_event_from_jsonld(o)
                # require at least name + url
                if ev["title"] and ev["link"]:
                    events.append(ev)
            except Exception:
                continue
    return events

def fetch_jsonld_from_url(url: str) -> dict | None:
    """
    Fetch a page (e.g., Ticketmaster) and try to extract a JSON-LD Event.
    """
    soup = get_soup(url)
    if not soup:
        return None
    objs = []
    for s in soup.select('script[type="application/ld+json"]'):
        try:
            data = json.loads(s.string or s.get_text(strip=True))
            if isinstance(data, list):
                objs.extend(data)
            elif isinstance(data, dict):
                objs.append(data)
        except Exception:
            continue
    ev = pick_jsonld_event(objs)
    return normalize_event_from_jsonld(ev) if ev else None

# ── Core scrape ────────────────────────────────────────────────────────────────
def scrape_shows() -> list[dict]:
    soup = get_soup(LIST_URL)
    if not soup:
        return []

    jsonld_events = harvest_jsonld_events(soup)
    print(f"🔎 Found {len(jsonld_events)} JSON-LD events on listing page")

    # Enrich any missing date/time/image/description by hitting the event URL (Ticketmaster)
    enriched = []
    for ev in jsonld_events:
        need_detail = not ev.get("start_date") or not ev.get("start_time") or not ev.get("image")
        if need_detail and ev.get("link"):
            detail = fetch_jsonld_from_url(ev["link"])
            if detail:
                ev["start_date"] = ev.get("start_date") or detail.get("start_date")
                ev["start_time"] = ev.get("start_time") or detail.get("start_time")
                ev["image"]      = ev.get("image")      or detail.get("image")
                ev["description"]= ev.get("description")or detail.get("description")
                ev["address"]    = ev.get("address")    or detail.get("address")
            time.sleep(0.3)  # polite
        enriched.append(ev)

    # Build slugs (prefer tail of Ticketmaster URL; else title+date)
    out = []
    for ev in enriched:
        link = ev.get("link") or ""
        tail = link.rstrip("/").split("/")[-1] if link else ""
        tail = tail if (tail and not tail.isdigit()) else ""
        ymd  = (ev.get("start_date") or "").replace("-", "")
        slug = tail or slugify(f"the-met-{ev.get('title','')}-{ymd}" if ymd else f"the-met-{ev.get('title','')}")
        out.append({**ev, "slug": slug})

    # Dedup by link
    dedup = {}
    for ev in out:
        key = ev.get("link") or ev["slug"]
        if key not in dedup:
            dedup[key] = ev
    return list(dedup.values())

# ── Upsert helpers ─────────────────────────────────────────────────────────────
def get_or_upsert_venue(name: str) -> int:
    slug = slugify(name)
    resp = sb.table("venues").upsert(
        {"name": name, "slug": slug},
        on_conflict=["slug"],
        returning="representation",
    ).execute()
    return resp.data[0]["id"]

def upsert_all_events(rows: list[dict]) -> None:
    venue_id = get_or_upsert_venue(VENUE_NAME)
    for ev in rows:
        rec = {
            "name": ev.get("title"),
            "link": ev.get("link"),
            "image": ev.get("image"),
            "start_date": ev.get("start_date"),
            "start_time": ev.get("start_time"),  # critical for UI
            "description": ev.get("description"),
            "address": ev.get("address"),
            "venue_id": venue_id,
            "source": "themetphilly",
            "slug": ev.get("slug"),
        }
        if not rec["start_date"]:
            # avoid NOT NULL violations if your schema enforces it
            print(f"⚠️  Skipping (no date): {rec['name']}")
            continue
        try:
            sb.table("all_events").upsert(rec, on_conflict=["link"]).execute()
            print(f"✅ Upserted: {rec['name']} ({rec['start_date']} {rec['start_time'] or ''})")
        except Exception as e:
            print(f"❌ Upsert failed for {rec['name']}: {e}")

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    rows = scrape_shows()
    print(f"🧾 Keeping {len(rows)} rows after dedup")
    if rows:
        upsert_all_events(rows)
    else:
        print("No rows to write.")
