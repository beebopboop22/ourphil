#!/usr/bin/env python3
import os
import re
from datetime import datetime
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# ── Load env & init Supabase ────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL = "https://www.chrisjazzcafe.com/events"
VENUE_SLUG = "chris-jazz-cafe"
SOURCE = "chrisjazzcafe.com"

def fetch_page(url: str) -> BeautifulSoup:
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")

def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[-\s]+", "-", text).strip("-")
    return text

def parse_events(soup: BeautifulSoup):
    for item in soup.select("div.event-list-item"):
        link_el = item.select_one("h3.el-header a")
        if not link_el:
            continue

        href = link_el["href"]
        url = urljoin(BASE_URL, href)
        slug = slugify(href)
        name = link_el.get_text(strip=True)

        date_el = item.select_one("div.el-showtimes h6.event-date")
        # parse date and optional time
        start_date = None
        start_time = None
        if date_el:
            text = date_el.get_text(strip=True)
            try:
                # some formats: "Sat, Jul 19, 2025 11:00 PM" or "Sat, Jul 19, 2025"
                dt = datetime.strptime(text, "%a, %b %d, %Y %I:%M %p")
                start_date = dt.date().isoformat()
                start_time = dt.time().isoformat()
            except ValueError:
                try:
                    dt = datetime.strptime(text, "%a, %b %d, %Y")
                    start_date = dt.date().isoformat()
                except ValueError:
                    pass

        img_el = item.select_one("div.el-image-container img")
        image = img_el["src"] if img_el and img_el.get("src") else None

        # **force description blank**
        description = ""

        ev = {
            "venue_id": None,  # fill below
            "name": name,
            "link": url,
            "image": image,
            "start_date": start_date,
            "start_time": start_time,
            "description": description,
            "slug": slug,
            "source": SOURCE,
        }
        yield ev

def get_venue_id():
    # fetch or create the Chris' Jazz Cafe venue
    resp = supabase.table("venues").select("id").eq("slug", VENUE_SLUG).execute()
    data = resp.data or []
    if data:
        return data[0]["id"]
    # create
    resp = supabase.table("venues").insert({"name": "Chris' Jazz Cafe", "slug": VENUE_SLUG}).execute()
    return resp.data[0]["id"]

def upsert_all_events(events, venue_id):
    for ev in events:
        ev["venue_id"] = venue_id
        try:
            supabase.table("all_events").insert(ev).execute()
            print(f"Inserted: {ev['name']}")
        except Exception as e:
            print(f"Failed to insert {ev['name']}: {e}")

def main():
    print("Fetching page…")
    soup = fetch_page(BASE_URL)
    print("Parsing events…")
    events = list(parse_events(soup))
    print(f"Found {len(events)} events.")
    venue_id = get_venue_id()
    print(f"Using venue_id={venue_id}")
    upsert_all_events(events, venue_id)
    print("Done.")

if __name__ == "__main__":
    main()
