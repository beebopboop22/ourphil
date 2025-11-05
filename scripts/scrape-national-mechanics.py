#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scraper for National Mechanics – Music Events
URL: https://nationalmechanics.com/philadelphia-national-mechanics-events
"""

import os, re, hashlib
from datetime import datetime
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# ───────────────────────────────
# CONFIG
# ───────────────────────────────
BASE_URL = "https://nationalmechanics.com/philadelphia-national-mechanics-events"
SOURCE_NAME = "nationalmechanics-music"
VENUE_NAME = "National Mechanics"
VENUE_ADDR = "22 S 3rd St, Philadelphia, PA 19106"
VENUE_LAT, VENUE_LNG = 39.9494, -75.1454
TAG_NAME = "Music"

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

# ───────────────────────────────
# SUPABASE
# ───────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ───────────────────────────────
# HELPERS
# ───────────────────────────────
def slugify(text):
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

def get_tag_id(tag_name):
    res = supabase.table("tags").select("id,name").execute()
    for row in (res.data or []):
        if row["name"].lower() == tag_name.lower():
            print(f"🏷️ Found tag '{tag_name}' (id={row['id']})")
            return row["id"]
    print(f"⚠️ Tag '{tag_name}' not found.")
    return None

def reset_and_insert_taggings(event_id, tag_id):
    if not tag_id:
        return
    supabase.table("taggings").delete().eq("taggable_type", "all_events").eq("taggable_id", str(event_id)).execute()
    supabase.table("taggings").insert({
        "tag_id": tag_id,
        "taggable_type": "all_events",
        "taggable_id": str(event_id)
    }).execute()

def parse_date(text: str) -> str | None:
    if not text:
        return None
    cleaned = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", text.strip())
    parts = cleaned.split()
    if len(parts) < 2:
        return None
    try:
        month = parts[-2]
        day = parts[-1]
        current_year = datetime.now().year
        dt = datetime.strptime(f"{month} {day} {current_year}", "%B %d %Y")
        if (dt - datetime.now()).days < -30:
            dt = datetime.strptime(f"{month} {day} {current_year + 1}", "%B %d %Y")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None

def make_unique_link(base_url, event):
    if event.get("section_id"):
        return f"{base_url}#event-{event['section_id']}"
    key = f"{event.get('title','')}_{event.get('start_date','')}_{event.get('time','')}"
    h = hashlib.md5(key.encode("utf-8")).hexdigest()[:8]
    return f"{base_url}#nm-{h}"

# ───────────────────────────────
# SCRAPER
# ───────────────────────────────
def parse_events():
    html = requests.get(BASE_URL, headers=HEADERS, timeout=30).text
    soup = BeautifulSoup(html, "html.parser")
    events = []

    for section in soup.select(".events-holder section"):
        title_el = section.select_one("h2")
        date_el = section.select_one("h3:not(.event-time)")
        desc_el = section.select_one(".event-info-text")
        time_el = section.select_one(".event-time")
        img_el = section.select_one("img.event-image")

        if not title_el or not date_el:
            continue

        section_id = section.get("id")
        title = title_el.get_text(strip=True)
        date_text = date_el.get_text(strip=True)
        start_date = parse_date(date_text)
        desc = " ".join([p.get_text(" ", strip=True) for p in desc_el.select("p")]) if desc_el else ""
        time = time_el.get_text(strip=True) if time_el else ""
        image = img_el["src"] if img_el and img_el.has_attr("src") else None
        if image and image.startswith("//"):
            image = "https:" + image

        events.append({
            "title": title,
            "start_date": start_date,
            "description": desc,
            "time": time,
            "image": image,
            "section_id": section_id
        })
    return events

# ───────────────────────────────
# MAIN
# ───────────────────────────────
def run():
    print("🎶 Scraping National Mechanics (Music)...")
    venue_id = ensure_venue()
    tag_id = get_tag_id(TAG_NAME)
    events = parse_events()
    print(f"📅 Found {len(events)} events")

    for ev in events:
        link = make_unique_link(BASE_URL, ev)
        record = {
            "name": ev["title"],
            "slug": slugify(ev["title"]),
            "description": ev["description"],
            "link": link,
            "image": ev["image"],
            "start_date": ev["start_date"],
            "source": SOURCE_NAME,
            "venue_id": venue_id,
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
