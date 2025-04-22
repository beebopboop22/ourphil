#!/usr/bin/env python3
import os
import requests
import urllib.parse
from bs4 import BeautifulSoup
from dateutil import parser
from supabase import create_client, Client
from dotenv import load_dotenv

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
# Explicitly load your service‐role .env file
env_path = os.path.join(os.path.dirname(__file__), ".env.scraper")
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_URL = "https://ansp.org/programs-and-events/events/"

# -----------------------------------------------------------------------------
# SCRAPER
# -----------------------------------------------------------------------------
def scrape_page(url):
    resp = requests.get(url)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    events = []

    for li in soup.select("ul.events-list > li"):
        # image
        img = li.select_one("img")
        image_url = urllib.parse.urljoin(BASE_URL, img["src"]) if img else None

        info = li.select_one(".event-info")
        title_el = info.select_one("h3 a")
        name = title_el.get_text(strip=True)
        link = urllib.parse.urljoin(BASE_URL, title_el["href"])

        raw_date = info.select_one(".event-date").get_text(strip=True)
        raw_time = info.select_one(".event-time").get_text(strip=True)
        # split times
        try:
            start_t, end_t = [t.strip() for t in raw_time.split("-", 1)]
        except ValueError:
            start_t = raw_time.strip()
            end_t = start_t

        # parse start/end into datetime
        if "through" in raw_date:
            # multi-day event
            start_str, end_str = [d.strip() for d in raw_date.split("through", 1)]
            dt_start = parser.parse(f"{start_str} {start_t}")
            dt_end   = parser.parse(f"{end_str} {end_t}")
        else:
            # single-day event
            dt_start = parser.parse(f"{raw_date} {start_t}")
            dt_end   = parser.parse(f"{raw_date} {end_t}")

        # ISO 8601 strings
        date_iso     = dt_start.isoformat()
        end_date_iso = dt_end.isoformat()

        venue = info.select_one(".event-location").get_text(" ", strip=True)
        neighborhood = "Center City"

        desc_el = info.select_one(".event-description p")
        description = desc_el.get_text(strip=True) if desc_el else ""

        # unique ID via eid param
        q     = urllib.parse.urlparse(link).query
        params = urllib.parse.parse_qs(q)
        eid   = params.get("eid", [None])[0]
        event_uid = eid or link

        events.append({
            "name":       name,
            "link":       link,
            "date":       date_iso,
            "end_date":   end_date_iso,
            "venue":      venue,
            "neighborhood": neighborhood,
            "description": description,
            "image":      image_url,
            "event_uid":  event_uid
        })

    return events, soup

def get_next_page_url(soup):
    pager = soup.select_one("div.event-pager")
    if not pager:
        return None
    nxt = pager.find("a", string=lambda t: t and "Next" in t)
    return urllib.parse.urljoin(BASE_URL, nxt["href"]) if nxt else None

# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
def main():
    url = BASE_URL
    all_events = []

    while url:
        print(f"Scraping: {url}")
        evts, soup = scrape_page(url)
        all_events.extend(evts)
        url = get_next_page_url(soup)

    print(f"Found {len(all_events)} events. Upserting to Supabase...")
    for evt in all_events:
        res = (
            supabase
            .table("neighbor_events")
            .upsert(evt, on_conflict=["event_uid"])
            .execute()
        )
        if getattr(res, "error", None):
            err = res.error
            print("  ⚠️", getattr(err, "message", err))
        else:
            print(f"  ↳ upserted: {evt['name']}")

if __name__ == "__main__":
    main()