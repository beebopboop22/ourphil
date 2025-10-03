#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Scrape Stateside Live! event details and upsert into all_events.

- Discovers event detail URLs from the public sitemap (no xml parser dependency).
- Parses __NEXT_DATA__ on each event page to pull title, image, ISO date/time.
- Converts UTC times to America/New_York (prevents off-by-one date drift).
- Forces description to NULL per current requirements.
- Upserts into all_events with on_conflict=["link"].
"""

import os
import re
import json
from datetime import datetime
from zoneinfo import ZoneInfo
from urllib.parse import urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# ── Config ─────────────────────────────────────────────────────────────────────
BASE = "https://statesidelive.com"
SITEMAP_URL = f"{BASE}/sitemap.xml"
SOURCE = "statesidelive"
VENUE_NAME_DEFAULT = "Stateside Live!"
TZ = ZoneInfo("America/New_York")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/114.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Connection": "close",
}

# ── Env / Supabase ─────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.")
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Utils ──────────────────────────────────────────────────────────────────────
_slug_non_alnum = re.compile(r"[^a-z0-9]+")

def slugify(text: str) -> str:
    s = (text or "").lower().replace("&", " and ")
    s = _slug_non_alnum.sub("-", s)
    return s.strip("-")

def canon_link(u: str) -> str:
    """Normalize URLs to https + no query/fragment + trailing slash trimmed (but keep path)."""
    p = urlparse(u)
    scheme = "https"
    netloc = p.netloc.lower()
    path = (p.path or "/").rstrip("/") or "/"
    return urlunparse((scheme, netloc, path, "", "", ""))

def fetch(url: str) -> str | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()
        return r.text
    except Exception as e:
        print(f"⚠️  Fetch failed {url}: {e}")
        return None

def to_local_parts(iso_utc: str) -> tuple[str | None, str | None]:
    """
    Convert an ISO8601 UTC string like '2025-10-04T00:00:00Z' to (YYYY-MM-DD, HH:MM:SS)
    in America/New_York. Returns (date, time) or (None, None) if parsing fails.
    """
    try:
        dt = datetime.fromisoformat(iso_utc.replace("Z", "+00:00")).astimezone(TZ)
        return dt.date().isoformat(), dt.time().replace(microsecond=0).isoformat()
    except Exception:
        return None, None

def pick_first(*vals) -> str | None:
    for v in vals:
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None

# ── Sitemap discovery (regex; no XML dependency) ───────────────────────────────
def discover_event_urls() -> list[str]:
    """
    Pulls the sitemap and extracts event detail URLs under /Events-and-Entertainment/Events/.
    Works with the HTML parser and a regex to avoid requiring lxml.
    """
    html = fetch(SITEMAP_URL)
    if not html:
        return []

    # Grab all <loc> URL contents quickly
    locs = re.findall(r"<loc>(.*?)</loc>", html, re.IGNORECASE)
    urls = []
    for u in locs:
        if "/Events-and-Entertainment/Events/" not in u:
            continue
        # Exclude the listing page or non-detail buckets if they show up
        # Keep anything that looks like a concrete event page
        # (heuristic: path depth > 3, i.e., /Events-and-Entertainment/Events/<something>)
        try:
            p = urlparse(u)
            if not p.scheme.startswith("http"):
                continue
            parts = [pp for pp in p.path.split("/") if pp]
            if len(parts) >= 3:  # Events-and-Entertainment / Events / <Page>
                urls.append(canon_link(u))
        except Exception:
            pass

    # Unique preserve order
    seen, out = set(), []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    print(f"🔎 Discovered {len(out)} event URLs from sitemap")
    return out

# ── __NEXT_DATA__ helpers ──────────────────────────────────────────────────────
def extract_next_data(html: str) -> dict | None:
    """
    Pull the Next.js __NEXT_DATA__ JSON object from the page.
    """
    # Fast regex first
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass

    # Fallback to BeautifulSoup if needed
    try:
        soup = BeautifulSoup(html, "html.parser")
        tag = soup.find("script", id="__NEXT_DATA__", type="application/json")
        if tag and tag.text:
            return json.loads(tag.text)
    except Exception:
        pass
    return None

def get_route_fields(nxt: dict) -> dict:
    """
    Return route fields dict if present, else {}.
    """
    try:
        return nxt["props"]["pageProps"]["layoutData"]["sitecore"]["route"]["fields"] or {}
    except Exception:
        return {}

def get_route_display_name(nxt: dict) -> str | None:
    try:
        return nxt["props"]["pageProps"]["layoutData"]["sitecore"]["route"]["displayName"]
    except Exception:
        return None

def get_field_value(fields: dict, field_name: str) -> str | None:
    """
    fields['SomeField'] may be {"value": "..."} or other shapes; try to extract string.
    """
    try:
        v = fields.get(field_name)
        if v is None:
            return None
        if isinstance(v, dict) and "value" in v:
            # Many image-like fields have nested dict under value; handle strings only here
            if isinstance(v["value"], str):
                return v["value"]
            # if not a string, ignore here
            return None
        if isinstance(v, str):
            return v
        return None
    except Exception:
        return None

def get_first_image_url(fields: dict) -> str | None:
    """
    Tries a few likely image fields in route fields for a usable image URL.
    """
    # 1) Teaser Image
    try:
        ti = fields.get("Teaser Image", {})
        if isinstance(ti, dict) and isinstance(ti.get("value"), dict):
            src = ti["value"].get("src")
            if src:
                return src
    except Exception:
        pass

    # 2) Social Share Image
    try:
        ssi = fields.get("Social Share Image", {})
        if isinstance(ssi, dict) and isinstance(ssi.get("value"), dict):
            src = ssi["value"].get("src")
            if src:
                return src
    except Exception:
        pass

    # 3) Fall back: nothing
    return None

def parse_event_page(url: str) -> dict | None:
    """
    Parse a single event page into our common event dict.
    Fields we aim for:
      - title
      - image
      - start_date (local)
      - start_time (local, optional)
      - end_time   (local, optional)
      - venue_name
      - link
      - slug
    """
    html = fetch(url)
    if not html:
        return None

    nxt = extract_next_data(html)
    if not nxt:
        print(f"⚠️  No __NEXT_DATA__ on {url}")
        return None

    fields = get_route_fields(nxt)

    # Title: prefer "Long Title" -> "Short Title" -> route displayName
    title = pick_first(
        get_field_value(fields, "Long Title"),
        get_field_value(fields, "Short Title"),
        get_route_display_name(nxt),
    ) or "Event"

    # Image: first available image field
    image = get_first_image_url(fields)

    # ISO date/time (UTC) usually in "Date" or "StartDate" or similar
    # Known event detail templates often place it in fields["Date"]["value"]
    iso_utc = pick_first(
        get_field_value(fields, "Date"),
        get_field_value(fields, "Start Date"),
        get_field_value(fields, "StartDate"),
    )

    start_date = start_time = None
    if iso_utc:
        start_date, start_time = to_local_parts(iso_utc)

    # End date/time if present (rarely needed; we mostly need start date)
    iso_end = pick_first(
        get_field_value(fields, "End Date"),
        get_field_value(fields, "EndDate"),
    )
    end_time = None
    if iso_end:
        _ed, _et = to_local_parts(iso_end)
        # We don't store end_date in all_events schema; keep end_time only if same day
        end_time = _et

    # Venue (we store a single venue for all these pages)
    venue_name = VENUE_NAME_DEFAULT

    link = canon_link(url)

    # Build a stable slug: source + title + date
    date_for_slug = start_date or "tbd"
    slug = f"{SOURCE}-{slugify(title)}-{date_for_slug}"

    return {
        "title": title,
        "image": image,
        "start_date": start_date,
        "start_time": start_time,
        "end_time": end_time,
        "venue_name": venue_name,
        "link": link,
        "slug": slug,
    }

# ── Upsert into all_events ─────────────────────────────────────────────────────
def upsert_events(rows: list[dict]) -> None:
    if not rows:
        print("No events parsed.")
        return

    # Ensure the venue exists (one-time per run)
    venue_id = None
    try:
        vr = (
            sb.table("venues")
            .upsert({"name": VENUE_NAME_DEFAULT}, on_conflict=["name"], returning="representation")
            .execute()
        )
        if vr.data:
            venue_id = vr.data[0]["id"]
    except Exception as e:
        print(f"⚠️  Venue upsert failed: {e}")

    for ev in rows:
        print(f"⏳ Processing: {ev['title']}")
        record = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "description": None,          # ← per request: always NULL
            "venue_id":    venue_id,
            "source":      SOURCE,
            "slug":        ev["slug"],
        }
        if ev.get("start_time"):
            record["start_time"] = ev["start_time"]
        if ev.get("end_time"):
            record["end_time"] = ev["end_time"]

        try:
            sb.table("all_events").upsert(record, on_conflict=["link"]).execute()
            print(f"✅ Upserted: {ev['title']}")
        except Exception as e:
            print(f"❌ Upsert failed for {ev['title']}: {e}")

# ── Main ───────────────────────────────────────────────────────────────────────
def scrape_events() -> list[dict]:
    urls = discover_event_urls()
    # Parse each event page
    events = []
    for u in urls:
        row = parse_event_page(u)
        if row and row.get("start_date"):
            events.append(row)

    # de-dup within run by link
    seen, out = set(), []
    for ev in events:
        k = ev["link"]
        if k not in seen:
            seen.add(k)
            out.append(ev)

    print(f"📋 Parsed {len(out)} events with dates")
    return out

if __name__ == "__main__":
    evs = scrape_events()
    if evs:
        upsert_events(evs)
