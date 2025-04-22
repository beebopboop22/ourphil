#!/usr/bin/env python3
import os
import re
import requests
import urllib.parse
from bs4 import BeautifulSoup
from dateutil import parser
from dotenv import load_dotenv
from supabase import create_client, Client

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
env_path = os.path.join(os.path.dirname(__file__), ".env.scraper")
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_URL      = "https://myphillypark.org"
CALENDAR_PATH = "/events/calendar/"
CALENDAR_URL  = urllib.parse.urljoin(BASE_URL, CALENDAR_PATH)

# -----------------------------------------------------------------------------
# HELPERS
# -----------------------------------------------------------------------------
def parse_date_time(date_raw: str, time_raw: str):
    """
    Parses strings like
      "Thursday, May 1 - Monday, June 30"
      "Friday, April 25"
    together with time strings like
      "7:00 pm - 11:00 pm"
    into two ISO‑8601 datetime strings: (start_iso, end_iso).
    """
    # split date range
    if " - " in date_raw or " through " in date_raw:
        parts = re.split(r"\s*-\s*|\sthrough\s", date_raw)
        start_dt = parser.parse(parts[0])
        end_dt   = parser.parse(parts[1])
    else:
        start_dt = parser.parse(date_raw)
        end_dt   = start_dt

    # attach times if present
    if time_raw:
        times = [t.strip() for t in time_raw.split(" - ")]
        try:
            t0 = parser.parse(times[0])
            start_dt = start_dt.replace(hour=t0.hour, minute=t0.minute)
            if len(times) > 1:
                t1 = parser.parse(times[1])
                end_dt = end_dt.replace(hour=t1.hour, minute=t1.minute)
        except Exception:
            pass

    return start_dt.isoformat(), end_dt.isoformat()

# -----------------------------------------------------------------------------
# SCRAPER
# -----------------------------------------------------------------------------
def scrape_fpc_events():
    resp = requests.get(CALENDAR_URL)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    events = []
    for art in soup.select("article.the-event"):
        # title & link
        a = art.select_one("h2 a")
        if not a:
            continue
        name = a.get_text(strip=True)
        link = a["href"]

        # image
        img = art.select_one(".event-img img")
        image = img["src"] if img else None

        # raw date & time
        date_raw = art.select_one(".date-desc").get_text(strip=True)
        time_raw = art.select_one(".time-desc").get_text(strip=True)

        # normalize to ISO‑8601
        start_iso, end_iso = parse_date_time(date_raw, time_raw)

        # description
        desc_el = art.select_one(".desc p")
        description = desc_el.get_text(strip=True) if desc_el else None

        # location
        loc_el = art.select_one(".the-location")
        venue = loc_el.get_text(strip=True) if loc_el else None

        # unique ID from eDate param
        q = urllib.parse.urlparse(link).query
        params = urllib.parse.parse_qs(q)
        eDate = params.get("eDate", [None])[0]
        event_uid = eDate or link

        events.append({
            "name":        name,
            "link":        link,
            "date":        start_iso,
            "end_date":    end_iso,
            "venue":       venue,
            "description": description,
            "image":       image,
            "event_uid":   event_uid
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
            .upsert(e, on_conflict=["event_uid"])
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
    evts = scrape_fpc_events()
    print(f"Found {len(evts)} events. Upserting…")
    upsert_to_supabase(evts)
    print("Done.")