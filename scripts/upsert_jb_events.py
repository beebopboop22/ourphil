#!/usr/bin/env python3
import os
import re
import certifi
from datetime import datetime
import cloudscraper
from bs4 import BeautifulSoup
from dateutil import parser
from supabase import create_client, Client
from dotenv import load_dotenv

# ── Load environment variables ─────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_KEY environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Configuration ───────────────────────────────────────────────────────────────
JB_URL         = "https://johnnybrendas.com/events/"
VENUE_NAME     = "Johnny Brenda's"
VENUE_ADDRESS  = "1201 Frankford Ave, Philadelphia, PA 19125"
SOURCE         = "johnnybrendas"
HEADERS = {
    "User-Agent":      ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/114.0.0.0 Safari/537.36"),
    "Accept-Language": "en-US,en;q=0.9",
}

def slugify_fallback(text: str) -> str:
    s = text.lower()
    s = re.sub(r"&", " and ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def scrape_jb_events():
    print(f"→ Fetching events from {JB_URL} …")
    scraper = cloudscraper.create_scraper()
    resp = scraper.get(JB_URL, headers=HEADERS, verify=certifi.where())
    resp.raise_for_status()

    soup     = BeautifulSoup(resp.text, "html.parser")
    wrappers = soup.select("div.eventWrapper")
    print(f"   Found {len(wrappers)} event wrappers.")

    events = []
    for w in wrappers:
        # — Title & link
        a = w.select_one("a#eventTitle.url")
        if not a or not a.get("href"):
            continue
        link  = a["href"].strip()
        title = a.get("title") or a.get_text(strip=True)

        # — Date
        rd = w.select_one(".singleEventDate")
        raw_date = rd.get_text(strip=True) if rd else None
        if not raw_date:
            continue

        # — Time (Doors: 7pm)
        tm = w.select_one(".rhp-event__time-text--list")
        time_str = tm.get_text(strip=True).replace("Doors:", "").strip() if tm else None

        # Parse date ± time
        try:
            if time_str:
                dt_full = parser.parse(f"{raw_date} {time_str}", fuzzy=True)
                start_date = dt_full.date().isoformat()
                start_time = dt_full.time().isoformat(timespec="minutes")
            else:
                d = parser.parse(raw_date, fuzzy=True).date()
                start_date = d.isoformat()
                start_time = None
        except Exception as e:
            print(f"   ⚠️  parse error for {title}: {e}")
            continue

        # — Image
        img = w.select_one(".rhp-events-event-image img")
        image = img["src"] if img and img.has_attr("src") else None

        # — Slug: last two meaningful path segments
        parts = link.rstrip("/").split("/")
        if len(parts) >= 5:
            slug = f"{parts[-3]}-{parts[-2]}"
        else:
            slug = slugify_fallback(title)

        events.append({
            "title":      title,
            "link":       link,
            "image":      image,
            "start_date": start_date,
            "start_time": start_time,
            "slug":       slug,
        })

    return events

def upsert_jb_events():
    evts = scrape_jb_events()
    if not evts:
        print("No events found; exiting.")
        return

    # — Upsert venue with fixed address
    v = supabase.table("venues") \
                .upsert(
                  {"name": VENUE_NAME, "address": VENUE_ADDRESS},
                  on_conflict=["name"],
                  returning="representation"
                ).execute()
    venue_id = v.data[0]["id"] if v.data else None

    # — Upsert into all_events
    for ev in evts:
        print(f"⏳  Upserting: {ev['title']}")
        record = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "start_time":  ev["start_time"],   # None if not provided
            "venue_id":    venue_id,
            "source":      SOURCE,
            "slug":        ev["slug"],
            "address":     VENUE_ADDRESS      # ensure your table has an `address` column
        }
        supabase.table("all_events") \
                .upsert(record, on_conflict=["link"]) \
                .execute()
        print(f"✅  Done: {ev['title']}")

if __name__ == "__main__":
    upsert_jb_events()
