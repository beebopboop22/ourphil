#!/usr/bin/env python3

import os
from datetime import datetime
from dateutil import parser
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
from supabase import create_client, Client

# --- Configuration ---
JB_URL = "https://johnnybrendas.com/events/"
# Supabase credentials (set these in your environment)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Initialize Supabase client
def init_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_KEY environment variables")
    return create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Scraping ---
def scrape_jb_events():
    """
    Launch headless Chrome to fetch the rendered events page,
    parse each .eventWrapper block, and return a list of event dicts.
    """
    opts = Options()
    opts.headless = True
    # Prevent detection
    opts.add_argument("--disable-blink-features=AutomationControlled")
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=opts)

    print(f"→ fetching {JB_URL} …")
    driver.get(JB_URL)
    html = driver.page_source
    driver.quit()

    soup = BeautifulSoup(html, "html.parser")

    events = []
    wrappers = soup.select(".eventWrapper")
    print(f"Found {len(wrappers)} wrappers.")
    for wrapper in wrappers:
        # Title & link
        a = wrapper.select_one("a#eventTitle.url")
        if not a or not a.get('href'):
            print("⚠️ missing title/link—skipping one wrapper")
            continue
        link = a['href'].strip()
        title = a.get('title') or a.get_text(strip=True)

        # Date text, e.g. "Mon, May 05"
        raw_date = wrapper.select_one(".singleEventDate")
        if raw_date:
            raw_date = raw_date.get_text(strip=True)
        else:
            raw_date = None

        # Doors time
        door = wrapper.select_one(".eventDoorStartDate .rhp-event__time-text--list")
        time_str = door.get_text(strip=True).replace('Doors:', '').strip() if door else None

        # Combine date+time into ISO
        if raw_date and time_str:
            # assume current year
            dt = parser.parse(f"{raw_date} {time_str}", fuzzy=True)
            # Format without timezone offset
            iso = dt.isoformat()
        elif raw_date:
            dt = parser.parse(raw_date, fuzzy=True)
            iso = dt.isoformat()
        else:
            iso = None

        # Venue is constant Johnny Brenda's
        venue = "Johnny Brenda's"

        events.append({
            "name": title,
            "link": link,
            "date": iso,
            "venue": venue,
            # generate a UID from link path
            "event_uid": link.rstrip('/').split('/')[-3] + '-' + link.rstrip('/').split('/')[-1]
        })
    return events

# --- Database Upsert ---
def upsert_to_supabase(events, supabase: Client):
    """
    Upsert list of event dicts into neighbor_events table,
    using `link` as the conflict target.
    """
    if not events:
        print("No events to upsert.")
        return
    data = events
    print("Upserting…")
    resp = supabase.table('neighbor_events') \
        .upsert(data, on_conflict='link') \
        .execute()
    if resp.error:
        print("Error during upsert:", resp.error)
    else:
        print("Upsert succeeded.")

# --- Main ---
def main():
    supabase = init_supabase()
    evts = scrape_jb_events()
    print(f"Found {len(evts)} events. Upserting…")
    upsert_to_supabase(evts, supabase)

if __name__ == '__main__':
    main()
