#!/usr/bin/env python3
import os
import requests
import urllib.parse
from dateutil import parser
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
env_path = os.path.join(os.path.dirname(__file__), ".env.scraper")
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_URL      = "https://fi.edu"
CALENDAR_PATH = "/en/events-calendar"
CALENDAR_URL  = urllib.parse.urljoin(BASE_URL, CALENDAR_PATH)

NEIGHBORHOOD  = "Center City"
VENUE         = "The Franklin Institute"

# -----------------------------------------------------------------------------
# SCRAPER
# -----------------------------------------------------------------------------
def scrape_fi_events():
    resp = requests.get(CALENDAR_URL)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    events = []
    for row in soup.select(".view-events-calendar .views-row"):
        # Hero image
        img_tag = row.select_one(".views-field-field-hero-image img")
        image = urllib.parse.urljoin(BASE_URL, img_tag["src"]) if img_tag else None

        # Raw date/time string (e.g. "Apr 25 2025 | 7:30 - 11:30pm" or
        # "August 4, 2025 through August 8, 2025" or just "Apr 22 2025")
        raw_dt = row.select_one(
            ".views-field-field-date-and-time .field-content"
        ).get_text(strip=True)

        # Determine start/end
        if "through" in raw_dt.lower():
            # multi-day range
            start_str, end_str = raw_dt.split("through", 1)
            dt_start = parser.parse(start_str.strip())
            dt_end   = parser.parse(end_str.strip())
        elif "|" in raw_dt:
            # same day, times attached
            date_part, times = raw_dt.split("|", 1)
            if "-" in times:
                start_t, end_t = times.split("-", 1)
                dt_start = parser.parse(f"{date_part.strip()} {start_t.strip()}")
                dt_end   = parser.parse(f"{date_part.strip()} {end_t.strip()}")
            else:
                dt_start = parser.parse(f"{date_part.strip()} {times.strip()}")
                dt_end   = dt_start
        else:
            # single date (no time)
            dt_start = parser.parse(raw_dt)
            dt_end   = dt_start

        iso_start = dt_start.isoformat()
        iso_end   = dt_end.isoformat()

        # Title + link
        title_a = row.select_one(".views-field-title a")
        if not title_a:
            continue
        name = title_a.get_text(strip=True)
        link = urllib.parse.urljoin(BASE_URL, title_a["href"])

        # Short description
        desc_tag = row.select_one(
            ".views-field-field-short-description .field-content"
        )
        description = desc_tag.get_text(" ", strip=True) if desc_tag else None

        # Unique ID from URL slug
        path = urllib.parse.urlparse(title_a["href"]).path.rstrip("/")
        event_uid = path.split("/")[-1]

        events.append({
            "name":         name,
            "link":         link,
            "date":         iso_start,
            "end_date":     iso_end,
            "venue":        VENUE,
            "neighborhood": NEIGHBORHOOD,
            "description":  description,
            "image":        image,
            "event_uid":    event_uid,
        })

    return events

# -----------------------------------------------------------------------------
# UPSERT
# -----------------------------------------------------------------------------
def upsert_to_supabase(events):
    for e in events:
        print(f"↳ upserting: {e['name']} ({e['date']})")
        res = (
            supabase
            .table("neighbor_events")
            .upsert(e, on_conflict=["link"])
            .execute()
        )
        if getattr(res, "error", None):
            err = res.error
            print("  ⚠️", getattr(err, "message", err))
        else:
            print("  → OK")

# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"Scraping {CALENDAR_URL} …")
    evts = scrape_fi_events()
    print(f"Found {len(evts)} events. Upserting…")
    upsert_to_supabase(evts)
    print("Done.")
