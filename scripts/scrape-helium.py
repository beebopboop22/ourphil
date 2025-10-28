#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/scrape-helium.py

Scrapes Helium Comedy Club (Philadelphia) events from JSON-LD embedded on
https://philadelphia.heliumcomedy.com/events.

Fixes:
- Converts UTC datetimes to America/New_York (so your platform times are correct).
- Cleans descriptions to remove <figure>/<img>/<hr> noise.

Writes to `all_events` (on_conflict: link). Ensures venue exists by slug.

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
from zoneinfo import ZoneInfo
from html import unescape

# ── Config ────────────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_URL    = "https://philadelphia.heliumcomedy.com"
LIST_URL    = f"{BASE_URL}/events"
VENUE_NAME  = "Helium Comedy Club"
VENUE_ADDR  = "2031 Sansom Street, Philadelphia, PA"
SOURCE_NAME = "heliumcomedy"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Connection": "close",
    "Referer": BASE_URL,
}

# ── Utils ─────────────────────────────────────────────────────────────────────
_slug_non_alnum = re.compile(r"[^a-z0-9]+")

def slugify(text: str) -> str:
    s = (text or "").lower().replace("&", " and ")
    s = _slug_non_alnum.sub("-", s)
    return s.strip("-")

def parse_utc_to_et(dt_str: str | None) -> tuple[str | None, str | None]:
    """
    Parse ISO datetime ('2025-11-01T01:15:00Z' / '+00:00') and convert to ET.
    Returns ('YYYY-MM-DD','HH:MM:SS') in America/New_York.
    """
    if not dt_str:
        return (None, None)
    try:
        s = str(dt_str).replace("Z", "+00:00")
        dt_utc = datetime.fromisoformat(s)
        if dt_utc.tzinfo is None:
            dt_utc = dt_utc.replace(tzinfo=ZoneInfo("UTC"))
        else:
            dt_utc = dt_utc.astimezone(ZoneInfo("UTC"))
        dt_et = dt_utc.astimezone(ZoneInfo("America/New_York"))
        return (dt_et.date().isoformat(), dt_et.strftime("%H:%M:%S"))
    except Exception:
        return (None, None)

# Remove figures/images/hr entirely, then strip remaining tags to produce clean text
_strip_blocks_re = re.compile(r"(?is)<(figure)\b.*?>.*?</\1>|<(img|hr)\b[^>]*>")
_tag_re = re.compile(r"(?s)<[^>]+>")

def clean_description(html: str | None) -> str | None:
    if not html:
        return None
    s = _strip_blocks_re.sub("", html)
    s = unescape(s)
    # turn structural tags into line breaks to preserve readable paragraphs
    s = re.sub(r"(?i)<\s*(br|p|div|li|h[1-6])\b[^>]*>", "\n", s)
    s = _tag_re.sub("", s)
    s = re.sub(r"\n\s*\n+", "\n\n", s).strip()
    return s or None

def get_soup(url: str) -> BeautifulSoup | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=35)
        r.raise_for_status()
        return BeautifulSoup(r.text, "html.parser")
    except Exception as e:
        print(f"⚠️  Fetch failed {url}: {e}")
        return None

def coalesce(*vals):
    for v in vals:
        if v:
            return v
    return None

# ── JSON-LD harvest ───────────────────────────────────────────────────────────
def load_json_lenient(raw: str) -> dict | list | None:
    """
    Helium sometimes ships malformed keys like '":@context"'.
    Clean common issues and parse.
    """
    cleaned = re.sub(r'"\s*:@', '"@', raw)
    try:
        return json.loads(cleaned)
    except Exception:
        cleaned2 = re.sub(r",\s*([}\]])", r"\1", cleaned)
        try:
            return json.loads(cleaned2)
        except Exception as e:
            print(f"⚠️  JSON-LD parse failed: {e}")
            return None

def find_place_with_events(objs: list[dict]) -> dict | None:
    for o in objs:
        if not isinstance(o, dict):
            continue
        t = o.get("@type") or o.get("type")
        if isinstance(t, list):
            is_place = any(str(x).lower() == "place" for x in t)
        else:
            is_place = (str(t).lower() == "place")
        if is_place and isinstance(o.get("Events"), list):
            return o
    return None

def normalize_event(ev: dict) -> dict:
    title = ev.get("name")
    link  = ev.get("url")
    img   = ev.get("image")
    desc  = clean_description(ev.get("description"))
    start_date, start_time = parse_utc_to_et(ev.get("startDate") or ev.get("start_date"))

    tail = (link or "").rstrip("/").split("/")[-1] if link else ""
    tail = tail if (tail and not tail.isdigit()) else ""
    ymd  = (start_date or "").replace("-", "")
    slug = tail or slugify(f"helium-{title}-{ymd}" if ymd else f"helium-{title}")

    address = VENUE_ADDR
    loc = ev.get("location")
    if isinstance(loc, dict):
        addr = loc.get("address")
        if isinstance(addr, dict):
            parts = [addr.get("streetAddress"), addr.get("addressLocality"), addr.get("addressRegion")]
            a = ", ".join([p for p in parts if p])
            address = a or address

    return {
        "title": title,
        "link": link,
        "image": img,
        "start_date": start_date,   # ET date
        "start_time": start_time,   # ET time
        "description": desc,
        "address": address,
        "slug": slug,
    }

def scrape_listing() -> list[dict]:
    soup = get_soup(LIST_URL)
    if not soup:
        return []

    blocks = []
    for s in soup.select('script[type="application/ld+json"]'):
        raw = s.string or s.get_text()
        data = load_json_lenient(raw)
        if data is None:
            continue
        if isinstance(data, list):
            blocks.extend(data)
        else:
            blocks.append(data)

    place = find_place_with_events(blocks)
    if not place:
        print("⚠️  No Place with Events[] found on listing page")
        return []

    events = []
    for ev in place.get("Events", []):
        try:
            norm = normalize_event(ev)
            if norm["title"] and norm["link"] and norm["start_date"]:
                events.append(norm)
        except Exception as e:
            print(f"⚠️  Normalize failed for one event: {e}")

    # Keep only today+ (ET). Comment out if you want historical.
    today_et = datetime.now(ZoneInfo("America/New_York")).date().isoformat()
    events = [e for e in events if e["start_date"] >= today_et]

    # Dedup by link
    dedup = {}
    for ev in events:
        k = ev["link"]
        if k and k not in dedup:
            dedup[k] = ev

    print(f"🔎 Found {len(dedup)} events on /events")
    return list(dedup.values())

# ── Supabase upserts ───────────────────────────────────────────────────────────
def get_or_upsert_venue(name: str) -> int:
    slug = slugify(name)
    resp = sb.table("venues").upsert(
        {"name": name, "slug": slug, "address": VENUE_ADDR},
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
            "start_time": ev.get("start_time"),
            "description": ev.get("description"),
            "address": ev.get("address") or VENUE_ADDR,
            "venue_id": venue_id,
            "source": SOURCE_NAME,
            "slug": ev.get("slug"),
        }
        if not rec["start_date"]:
            print(f"⚠️  Skipping (no date): {rec['name']}")
            continue
        try:
            sb.table("all_events").upsert(rec, on_conflict=["link"]).execute()
            print(f"✅ Upserted: {rec['name']} ({rec['start_date']} {rec['start_time'] or ''})")
        except Exception as e:
            print(f"❌ Upsert failed for {rec['name']}: {e}")
        time.sleep(0.1)

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    rows = scrape_listing()
    print(f"🧾 Keeping {len(rows)} rows after dedup")
    if rows:
        upsert_all_events(rows)
    else:
        print("No rows to write.")
