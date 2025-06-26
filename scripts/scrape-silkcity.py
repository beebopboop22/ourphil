#!/usr/bin/env python3
import os
import re
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

# ── Load environment variables ─────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Request headers ────────────────────────────────────────────────────────────
HEADERS = {
    "User-Agent":      "Mozilla/5.0 (compatible; event-scraper/1.0)",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept":          "text/html,application/xhtml+xml,*/*;q=0.8",
}

# ── Helper to slugify titles if needed ─────────────────────────────────────────
def slugify(text: str) -> str:
    s = text.lower()
    s = re.sub(r'&', ' and ', s)
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

# ── Scrape listing page for basic event info ───────────────────────────────────
def scrape_events():
    URL = "https://www.silkcityphilly.com/events"
    res = requests.get(URL, headers=HEADERS)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    events = []
    for a in soup.select("a.event"):
        link = a["href"].strip()
        # Title is in the .red div
        title_tag = a.select_one(".red")
        title = title_tag.get_text(strip=True) if title_tag else None

        # Date is in the grey div, e.g. "Thu • 07.03.25"
        date_tag = a.select_one(".grey")
        start_date = None
        if date_tag:
            m = re.search(r"(\d{2})\.(\d{2})\.(\d{2})", date_tag.get_text())
            if m:
                mm, dd, yy = m.groups()
                # assume 20xx
                year = int(yy) + 2000
                start_date = datetime(year, int(mm), int(dd)).date().isoformat()

        # No explicit time on listing; leave as None
        start_time = None

        # Image src
        img_tag = a.select_one("img")
        image = img_tag["src"] if img_tag and img_tag.has_attr("src") else None

        # build a slug from the link or title
        raw = link.rstrip("/").split("/")[-1]
        slug = raw if any(c.isalpha() for c in raw) else slugify(title or raw)

        events.append({
            "title":      title,
            "link":       link,
            "image":      image,
            "start_date": start_date,
            "start_time": start_time,
            "slug":       slug,
        })
    return events

# ── Upsert events & static venue into Supabase ────────────────────────────────
def upsert_data(events):
    # ensure the venue exists
    venue_name = "Silk City Diner"
    v = supabase.table("venues") \
                .upsert({"name": venue_name}, on_conflict=["name"], returning="representation") \
                .execute()
    venue_id = v.data[0]["id"] if v.data else None

    for ev in events:
        print(f"⏳ Processing: {ev['title']}")
        record = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "start_time":  ev["start_time"],
            "description": None,
            "venue_id":    venue_id,
            "source":      "silkcityphilly",
            "slug":        ev["slug"],
        }
        supabase.table("all_events") \
                .upsert(record, on_conflict=["link"]) \
                .execute()
        print(f"✅ Upserted: {ev['title']}")

if __name__ == "__main__":
    evs = scrape_events()
    print(f"🔎 Found {len(evs)} events")
    if evs:
        upsert_data(evs)
