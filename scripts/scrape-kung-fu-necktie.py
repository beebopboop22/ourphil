#!/usr/bin/env python3
import os
import re
import requests
from bs4 import BeautifulSoup, Tag
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

LISTING_URL = "https://kungfunecktie.com/events/"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; event-scraper/1.0)",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
}

# Normalize month abbreviations the site may use
MONTH_FIX = {
    "Sept": "Sep",  # strptime wants "Sep"
}

def norm_month_abbrev(s: str) -> str:
    parts = s.split()
    return " ".join(MONTH_FIX.get(p, p) for p in parts)

def parse_show_time(block_text: str):
    """
    Expect formats like:
      "Doors: 7pm // Show: 8pm"
      "Show: 10pm"
    Return "HH:MM:SS" (24h) if clear, else None.
    """
    if not block_text:
        return None
    # Prefer explicit Show time
    m = re.search(r"Show:\s*([0-9]{1,2}(?::[0-9]{2})?\s*[ap]m)", block_text, re.I)
    if not m:
        return None
    t = m.group(1).strip().lower().replace(" ", "")
    # Ensure minutes present
    if re.match(r"^\d{1,2}[ap]m$", t):
        t = t[:-2] + ":00" + t[-2:]
    try:
        dt = datetime.strptime(t, "%I:%M%p")
        return dt.strftime("%H:%M:%S")
    except ValueError:
        return None

def extract_year_for_event(wrapper: Tag) -> int | None:
    """
    Find the closest previous month separator like:
      <span class='rhp-events-list-separator-month d-flex'><span>September 2025</span></span>
    """
    sep = wrapper.find_previous("span", class_="rhp-events-list-separator-month")
    if not sep:
        return None
    text = sep.get_text(" ", strip=True)
    m = re.search(r"(\b20\d{2}\b)", text)
    return int(m.group(1)) if m else None

def parse_date(event_wrapper: Tag, year_hint: int | None):
    """
    Dates appear as: "Tue, Sept 30" or "Wed, Oct 01"
    We combine with the year from the nearest month header.
    """
    label = event_wrapper.select_one("#eventDate")
    if not label:
        return None
    raw = label.get_text(strip=True)
    raw = raw.replace("Sept", "Sep")  # normalize
    # Extract "Tue, Sep 30" -> want "%a, %b %d %Y"
    if year_hint is None:
        return None
    # Some locales may include commas irregularly; normalize one comma after weekday
    raw = re.sub(r"^\s*([A-Za-z]{3,}),?\s*", r"\1, ", raw)
    try:
        dt = datetime.strptime(f"{raw} {year_hint}", "%a, %b %d %Y")
        return dt.date().isoformat()
    except ValueError:
        return None

def clean_slug_from_link(link: str) -> str | None:
    """
    From URL like:
      https://kungfunecktie.com/event/cherubs-the-art-gray-noizz-quintet-get-well/kung-fu-necktie/philadelphia-pennsylvania/
    Extract 'cherubs-the-art-gray-noizz-quintet-get-well'
    """
    m = re.search(r"/event/([^/]+)/", link)
    return m.group(1) if m else None

def scrape_events():
    print(f"🔗 Using listing: {LISTING_URL}")
    res = requests.get(LISTING_URL, headers=HEADERS, timeout=30)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    cards = soup.select(".rhpSingleEvent.rhp-event__single-event--list")
    print(f"🔎 Found {len(cards)} KFN cards (raw)")

    events = []
    seen_links = set()

    for card in cards:
        year_hint = extract_year_for_event(card)
        # Link & title
        a = card.select_one("a.url[href]")
        link = a["href"].strip() if a else None
        title = a.get("title", "").strip() if a else None

        if not link or not title:
            continue
        if link in seen_links:
            continue
        seen_links.add(link)

        # Image
        img = card.select_one(".rhp-events-event-image img")
        image = img.get("src", "").strip() if img else None

        # Venue (anchor text inside eventsVenueDiv)
        venue_anchor = card.select_one(".eventsVenueDiv .venueLink")
        venue_name = venue_anchor.get_text(strip=True) if venue_anchor else "Kung Fu Necktie"

        # Date
        start_date = parse_date(card, year_hint)

        # Time (only if "Show:" is present)
        time_block = card.select_one(".rhp-event__time-text--list")
        time_text = time_block.get_text(" ", strip=True) if time_block else ""
        start_time = parse_show_time(time_text)  # None if not confidently parsed

        # Slug
        slug = clean_slug_from_link(link)

        events.append({
            "title": title,
            "link": link,
            "image": image,
            "venue_name": venue_name,
            "start_date": start_date,
            "start_time": start_time,  # may be None; we only set when confident
            "slug": slug,
        })

    print(f"🧹 After de-dup by link: {len(events)}")
    return events

def ensure_venue(name: str) -> str | None:
    v = supabase.table("venues").upsert(
        {"name": name}, on_conflict=["name"], returning="representation"
    ).execute()
    return v.data[0]["id"] if v.data else None

def upsert_data(events):
    if not events:
        print("No valid events to upsert.")
        return

    # Upsert unique venues first
    venue_ids: dict[str, str | None] = {}
    for name in sorted({e["venue_name"] for e in events}):
        venue_ids[name] = ensure_venue(name) if not DRY_RUN else None

    for ev in events:
        print(f"⏳ Processing: {ev['title']}")
        record = {
            "name": ev["title"],
            "link": ev["link"],
            "image": ev["image"],
            "start_date": ev["start_date"],
            # Only include start_time when present; otherwise leave null
            "start_time": ev["start_time"],
            "description": None,
            "venue_id": venue_ids.get(ev["venue_name"]),
            "source": "kungfunecktie",
            "slug": ev["slug"],
        }
        if DRY_RUN:
            print(f"🧪 DRY_RUN would upsert: {record}")
        else:
            supabase.table("all_events").upsert(record, on_conflict=["link"]).execute()
            print(f"✅ Upserted: {ev['title']}")

if __name__ == "__main__":
    evs = scrape_events()
    if evs:
        upsert_data(evs)
