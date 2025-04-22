#!/usr/bin/env python3
import os
import requests
import urllib.parse
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
load_dotenv()  # loads SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY from your .env

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_URL      = "https://fi.edu"
CALENDAR_PATH = "/en/events-calendar"
CALENDAR_URL  = urllib.parse.urljoin(BASE_URL, CALENDAR_PATH)
NEIGHBORHOOD  = "Center City"

# -----------------------------------------------------------------------------
# SCRAPER
# -----------------------------------------------------------------------------
def scrape_fi_events():
    resp = requests.get(CALENDAR_URL)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    events = []
    # Each event card is a .views-row inside the event_grid view
    for row in soup.select(".view-events-calendar .views-row"):
        # Hero image
        img_tag = row.select_one(".views-field-field-hero-image img")
        image = urllib.parse.urljoin(BASE_URL, img_tag["src"]) if img_tag else None

        # Date/time (we'll store this in `date`)
        dt_tag = row.select_one(".views-field-field-date-and-time .field-content")
        date = dt_tag.get_text(strip=True) if dt_tag else None

        # Subtitle / category
        cat_tag = row.select_one(".views-field-field-sub-title .field-content")
        category = cat_tag.get_text(strip=True) if cat_tag else None

        # Title + detail link
        title_a = row.select_one(".views-field-title a")
        if not title_a:
            continue
        name = title_a.get_text(strip=True)
        link = urllib.parse.urljoin(BASE_URL, title_a["href"])

        # Short description
        desc_tag = row.select_one(".views-field-field-short-description .field-content")
        description = desc_tag.get_text(" ", strip=True) if desc_tag else None

        # Use the last slug segment as a stable unique ID
        path = urllib.parse.urlparse(title_a["href"]).path.rstrip("/")
        event_uid = path.split("/")[-1]

        events.append({
            "name":         name,
            "link":         link,
            "date":         date,
            "category":     category,
            "description":  description,
            "image":        image,
            "event_uid":    event_uid,
            "neighborhood": NEIGHBORHOOD,
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
            .table("fi_events")                      # your target table
            .upsert(e, on_conflict=["event_uid"])
            .execute()
        )
        if res.error:
            print("  ⚠️", res.error)

# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"Scraping {CALENDAR_URL} …")
    evts = scrape_fi_events()
    print(f"Found {len(evts)} events. Upserting…")
    upsert_to_supabase(evts)
    print("Done.")
