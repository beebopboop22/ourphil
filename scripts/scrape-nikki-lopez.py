#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Scraper for Nikki Lopez Philly (https://scenicnyc.com/nikkilopez/)
- Pulls title, date, link, and image
- Tags every event as 'Music'
- Python 3.11+ compatible
"""

import os
import re
from datetime import datetime
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
BASE_URL = "https://scenicnyc.com/nikkilopez/"
SOURCE_NAME = "nikkilopezphilly"

VENUE_NAME = "Nikki Lopez Philly"
VENUE_ADDR = "304 South St, Philadelphia, PA"
VENUE_LAT = 39.9417
VENUE_LNG = -75.1494

FALLBACK_IMAGE = "https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/nikki-lopez.webp"
TAG_NAME = "Music"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
}

# Regex to capture a Squarespace/section-style static image base
STATIC_BASE_RE = re.compile(r"(/__static/[a-f0-9\-]{36}/)image_(?:phone|tablet|laptop|desktop|quad)\b", re.I)

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
    text = text.lower().strip()
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"[^a-z0-9\-]", "", text)
    return re.sub(r"-{2,}", "-", text).strip("-")

def ensure_venue():
    res = supabase.table("venues").upsert(
        {"name": VENUE_NAME, "address": VENUE_ADDR, "latitude": VENUE_LAT, "longitude": VENUE_LNG},
        on_conflict=["name"],
        returning="representation"
    ).execute()
    return (res.data or [{}])[0].get("id")

def get_tag_id(tag_name: str) -> int | None:
    res = supabase.table("tags").select("id,name").execute()
    for row in (res.data or []):
        if row["name"].lower() == tag_name.lower():
            print(f"🎵 Found tag '{tag_name}' (id={row['id']})")
            return row["id"]
    print(f"⚠️ Tag '{tag_name}' not found — events will be saved without taggings.")
    return None

def reset_and_insert_taggings(event_id: int, tag_id: int | None):
    if not tag_id:
        return
    # Your taggings table uses polymorphic columns
    supabase.table("taggings").delete() \
        .eq("taggable_type", "all_events") \
        .eq("taggable_id", str(event_id)).execute()

    supabase.table("taggings").insert({
        "tag_id": tag_id,
        "taggable_type": "all_events",
        "taggable_id": str(event_id)
    }).execute()

def to_abs(url: str) -> str:
    return url if url.startswith("http") else urljoin(BASE_URL, url)

def extract_image_from_section(section: BeautifulSoup) -> str:
    """
    Strategy:
      1) Look for any <source srcset="/__static/<uuid>/image_*"> and normalize to image_desktop
      2) Else look for <picture data-iesrc="/__static/<uuid>/image_...">
      3) Else any <img src="/__static/<uuid>/image_...">
      4) Fallback to the constant
    """
    # 1) Any <source ... srcset=...>
    for source in section.select("source[srcset]"):
        m = STATIC_BASE_RE.search(source.get("srcset", ""))
        if m:
            return to_abs(m.group(1) + "image_desktop")

    # 2) Picture data-iesrc attribute
    for pic in section.select("picture"):
        iesrc = pic.get("data-iesrc") or ""
        m = STATIC_BASE_RE.search(iesrc)
        if m:
            return to_abs(m.group(1) + "image_desktop")

    # 3) Plain <img src=...>
    for img in section.select("img[src]"):
        m = STATIC_BASE_RE.search(img.get("src", ""))
        if m:
            return to_abs(m.group(1) + "image_desktop")

    # 4) Nothing matched
    return FALLBACK_IMAGE

def parse_date_from_text(text: str) -> str | None:
    """
    Finds 'Month DD' in the section and returns YYYY-MM-DD (this-year),
    with a rollover if the date has already passed (treat as current year anyway
    since the site is a rolling “what’s next” page).
    """
    m = re.search(r"\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b", text)
    if not m:
        return None
    month, day = m.group(1), int(m.group(2))
    year = datetime.now().year
    try:
        dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None

def parse_events() -> list[dict]:
    html = requests.get(BASE_URL, headers=HEADERS, timeout=30).text
    soup = BeautifulSoup(html, "html.parser")

    events: list[dict] = []
    for section in soup.select("section.s-section"):
        # Title
        title_el = section.select_one("h4 span[data-text='true']")
        if not title_el:
            # Some blocks use plain <h4> text
            title_el = section.select_one("h4")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        if not title:
            continue

        # Date
        block_text = section.get_text(" ", strip=True)
        start_date = parse_date_from_text(block_text)

        # Ticket / detail link (prefer .btn, fallback to any <a> with ticket-like text)
        link = None
        btn = section.select_one("a.btn[href]")
        if btn and btn.get("href"):
            link = btn["href"]
        if not link:
            for a in section.select("a[href]"):
                if re.search(r"(ticket|event|buy|more)", a.get_text(" ", strip=True), re.I):
                    link = a["href"]
                    break
        link = link or BASE_URL
        link = to_abs(link)

        # Image
        image_url = extract_image_from_section(section)

        events.append({
            "title": title,
            "start_date": start_date,
            "link": link,
            "image": image_url,
        })

    return events

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def run():
    print("🎸 Scraping Nikki Lopez Philly…")
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
            print(f"❌ Upsert failed: {ev['title']}")
            continue

        eid = res.data[0]["id"]
        reset_and_insert_taggings(eid, tag_id)
        print(f"✅ Upserted {ev['title']} (id={eid}) — image={ev['image']}")

    print("🎉 Done.")

if __name__ == "__main__":
    run()
