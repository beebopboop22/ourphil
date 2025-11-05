#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scraper for Xfinity Mobile Arena – Comedy events
URL: https://www.xfinitymobilearena.com/events/category/comedy
Tag: Comedy
"""

import os
import re
from datetime import datetime
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
BASE_URL = "https://www.xfinitymobilearena.com/events/category/comedy"
SOURCE_NAME = "xfinitymobilearena-comedy"
VENUE_NAME = "Xfinity Mobile Arena"
VENUE_ADDR = "3601 S Broad St, Philadelphia, PA 19148"
VENUE_LAT = 39.9057
VENUE_LNG = -75.1721
TAG_NAME = "Comedy"

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

# ─────────────────────────────────────────────
# SUPABASE
# ─────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")

def ensure_venue():
    res = supabase.table("venues").upsert(
        {
            "name": VENUE_NAME,
            "address": VENUE_ADDR,
            "latitude": VENUE_LAT,
            "longitude": VENUE_LNG,
        },
        on_conflict=["name"],
        returning="representation",
    ).execute()
    return (res.data or [{}])[0].get("id")

def get_tag_id(tag_name: str) -> int | None:
    res = supabase.table("tags").select("id,name").execute()
    for row in (res.data or []):
        if row["name"].lower() == tag_name.lower():
            print(f"🎭 Found tag '{tag_name}' (id={row['id']})")
            return row["id"]
    print(f"⚠️ Tag '{tag_name}' not found — events will be saved without tagging.")
    return None

def reset_and_insert_taggings(event_id: int, tag_id: int | None):
    if not tag_id:
        return
    supabase.table("taggings").delete() \
        .eq("taggable_type", "all_events") \
        .eq("taggable_id", str(event_id)).execute()

    supabase.table("taggings").insert({
        "tag_id": tag_id,
        "taggable_type": "all_events",
        "taggable_id": str(event_id)
    }).execute()

def parse_date(text: str) -> str | None:
    """Try to clean and parse various date formats like 'Nov. 14, 2025'."""
    if not text:
        return None
    try:
        cleaned = text.replace(".", "").replace("\xa0", " ").strip()
        dt = datetime.strptime(cleaned, "%b %d, %Y")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None

# ─────────────────────────────────────────────
# SCRAPER
# ─────────────────────────────────────────────
def parse_events():
    html = requests.get(BASE_URL, headers=HEADERS, timeout=30).text
    soup = BeautifulSoup(html, "html.parser")

    events = []
    for div in soup.select(".eventItem.entry"):
        title_el = div.select_one("h3 a")
        month_el = div.select_one(".m-date__month")
        day_el = div.select_one(".m-date__day")
        year_el = div.select_one(".m-date__year")
        img_el = div.select_one(".thumb img")
        link_el = div.select_one(".tickets") or div.select_one("h3 a")

        if not title_el or not month_el or not day_el or not year_el:
            continue

        title = title_el.get_text(strip=True)
        link = link_el["href"]
        month = month_el.get_text(strip=True).replace(".", "")
        day = day_el.get_text(strip=True)
        year = year_el.get_text(strip=True).replace(",", "")
        date_text = f"{month} {day}, {year}"
        start_date = parse_date(date_text)
        image = img_el["src"] if img_el else None

        events.append({
            "title": title,
            "link": link,
            "start_date": start_date,
            "image": image,
        })

    return events

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def run():
    print("🎤 Scraping Xfinity Mobile Arena (Comedy)...")
    venue_id = ensure_venue()
    tag_id = get_tag_id(TAG_NAME)
    events = parse_events()
    print(f"📅 Found {len(events)} events")

    for ev in events:
        record = {
            "name": ev["title"],
            "slug": slugify(ev["title"]),
            "link": ev["link"],
            "image": ev["image"],
            "start_date": ev["start_date"],
            "source": SOURCE_NAME,
            "venue_id": venue_id
        }

        res = supabase.table("all_events").upsert(
            record, on_conflict=["link"], returning="representation"
        ).execute()

        if not res.data:
            print(f"❌ Failed: {ev['title']}")
            continue

        eid = res.data[0]["id"]
        reset_and_insert_taggings(eid, tag_id)
        print(f"✅ Upserted {ev['title']} ({ev['start_date']})")

    print("🎉 Done.")

if __name__ == "__main__":
    run()
