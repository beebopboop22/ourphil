#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scraper for Cellar Dog PHL (https://www.cellardogphiladelphia.com/calendar-link)

Rules:
  - Ignore events with 'eagles' in the title (case-insensitive)
  - Tag all others as 'Music'
  - Use default image (no photos on site)
  - Upsert to all_events table
"""

import os
import re
from datetime import datetime
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# ──────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────
BASE_URL = "https://www.cellardogphiladelphia.com"
EVENTS_PATH = "/calendar-link"
SOURCE_NAME = "cellardogphl"

VENUE_NAME = "Cellar Dog PHL"
VENUE_ADDR = "216 South Street, Philadelphia, PA 19147"
VENUE_LAT = 39.9415
VENUE_LNG = -75.1468
DEFAULT_IMAGE = "https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/cellar-dog.webp"

TAG_NAME = "Music"  # match Supabase exactly
BLOCKLIST = ["eagles"]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/119.0",
}

# ──────────────────────────────────────────────────────────────
# SUPABASE
# ──────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ──────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────
def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")

def ensure_venue():
    payload = {
        "name": VENUE_NAME,
        "address": VENUE_ADDR,
        "latitude": VENUE_LAT,
        "longitude": VENUE_LNG,
    }
    res = supabase.table("venues").upsert(payload, on_conflict=["name"], returning="representation").execute()
    return (res.data or [{}])[0].get("id")

def get_tag_id(tag_name):
    """Find the tag by name (case-insensitive)."""
    res = supabase.table("tags").select("id,name").execute()
    tag_id = None
    for row in res.data:
        if row["name"].lower() == tag_name.lower():
            tag_id = row["id"]
            break
    if tag_id:
        print(f"🎵 Found tag '{tag_name}' (id={tag_id})")
    else:
        print(f"⚠️ Tag '{tag_name}' not found — skipping taggings.")
    return tag_id

def reset_and_insert_taggings(event_id, tag_id):
    if not tag_id:
        return
    supabase.table("taggings") \
        .delete() \
        .eq("taggable_type", "all_events") \
        .eq("taggable_id", str(event_id)) \
        .execute()
    supabase.table("taggings").insert({
        "tag_id": tag_id,
        "taggable_type": "all_events",
        "taggable_id": str(event_id),
    }).execute()

# ──────────────────────────────────────────────────────────────
# SCRAPER
# ──────────────────────────────────────────────────────────────
def parse_event_list():
    url = f"{BASE_URL}{EVENTS_PATH}"
    html = requests.get(url, headers=HEADERS, timeout=30).text
    soup = BeautifulSoup(html, "html.parser")
    events = []

    for art in soup.select("article.eventlist-event"):
        title_el = art.select_one(".eventlist-title a")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        if any(bad in title.lower() for bad in BLOCKLIST):
            continue

        link = urljoin(BASE_URL, title_el["href"])
        date_el = art.select_one("time.event-date")
        start_el = art.select_one("time.event-time-localized-start")
        end_el = art.select_one("time.event-time-localized-end")

        def clean_time(t):
            if not t:
                return None
            t = t.replace("\u202f", " ").replace("\xa0", " ").strip()
            try:
                return datetime.strptime(t, "%I:%M %p").time().isoformat()
            except Exception:
                return None

        start_date = date_el["datetime"] if date_el and date_el.has_attr("datetime") else None
        start_time = clean_time(start_el.get_text(strip=True) if start_el else None)
        end_time = clean_time(end_el.get_text(strip=True) if end_el else None)

        events.append({
            "title": title,
            "link": link,
            "start_date": start_date,
            "start_time": start_time,
            "end_time": end_time,
        })
    return events

# ──────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────
def run():
    print("🎷 Scraping Cellar Dog PHL…")
    venue_id = ensure_venue()
    tag_id = get_tag_id(TAG_NAME)

    events = parse_event_list()
    print(f"📅 Found {len(events)} events after filtering 'eagles'.")

    for ev in events:
        record = {
            "name": ev["title"],
            "slug": slugify(ev["title"]),
            "link": ev["link"],
            "image": DEFAULT_IMAGE,
            "description": None,
            "start_date": ev["start_date"],
            "start_time": ev["start_time"],
            "end_time": ev["end_time"],
            "source": SOURCE_NAME,
            "venue_id": venue_id,
        }

        res = supabase.table("all_events").upsert(
            record,
            on_conflict=["link"],
            returning="representation"
        ).execute()

        if not res.data:
            print(f"❌ Failed upsert: {ev['title']}")
            continue

        eid = res.data[0]["id"]
        reset_and_insert_taggings(eid, tag_id)
        print(f"✅ Upserted {ev['title']} (id={eid})")

    print("🎉 Done.")

if __name__ == "__main__":
    run()
