#!/usr/bin/env python3
import os
import requests
import urllib.parse
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv

# Explicitly load your service‐role .env file
env_path = os.path.join(os.path.dirname(__file__), ".env.scraper")
load_dotenv(dotenv_path=env_path)

# Supabase setup (use service role key to bypass RLS)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_URL = "https://ansp.org/programs-and-events/events/"

def scrape_page(url):
    resp = requests.get(url)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    events = []

    for li in soup.select("ul.events-list > li"):
        img = li.select_one("img")
        image_url = urllib.parse.urljoin(BASE_URL, img["src"]) if img else None

        info = li.select_one(".event-info")
        title_el = info.select_one("h3 a")
        name = title_el.get_text(strip=True)
        link = urllib.parse.urljoin(BASE_URL, title_el["href"])

        date = info.select_one(".event-date").get_text(strip=True)
        time = info.select_one(".event-time").get_text(strip=True)
        end_date = date  # adjust if multi-day

        venue = info.select_one(".event-location").get_text(" ", strip=True)
        neighborhood = "Center City"  # populate if you have a rule to parse it

        desc_el = info.select_one(".event-description p")
        description = desc_el.get_text(strip=True) if desc_el else ""

        # extract the `eid` query param as unique ID
        q = urllib.parse.urlparse(link).query
        params = urllib.parse.parse_qs(q)
        eid = params.get("eid", [None])[0]
        event_uid = eid or link

        events.append({
            "name": name,
            "link": link,
            "date": date,
            "end_date": end_date,
            "venue": venue,
            "neighborhood": neighborhood,
            "description": description,
            "image": image_url,
            "event_uid": event_uid
        })

    return events, soup

def get_next_page_url(soup):
    pager = soup.select_one("div.event-pager")
    if not pager:
        return None
    next_link = pager.find("a", string=lambda t: t and "Next" in t)
    return urllib.parse.urljoin(BASE_URL, next_link["href"]) if next_link else None

def main():
    url = BASE_URL
    all_events = []

    # loop through all paginated pages
    while url:
        print(f"Scraping: {url}")
        events, soup = scrape_page(url)
        all_events.extend(events)
        url = get_next_page_url(soup)

    print(f"Found {len(all_events)} events. Upserting to Supabase...")

    for evt in all_events:
        supabase \
          .table("neighbor_events") \
          .upsert(evt, on_conflict=["event_uid"]) \
          .execute()
        print(f"  ↳ upserted: {evt['name']}")

if __name__ == "__main__":
    main()
