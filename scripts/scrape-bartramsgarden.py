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
# Prefer service role to bypass RLS; fallback to anon key
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Request headers ────────────────────────────────────────────────────────────
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/114.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# ── Helper to slugify titles if link slug is numeric ────────────────────────────
def slugify(text: str) -> str:
    slug = text.lower()
    slug = re.sub(r'&', ' and ', slug)
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    return slug.strip('-')

# ── Scrape & parse Bartram's Garden events ─────────────────────────────────────
def scrape_events():
    URL = "https://www.bartramsgarden.org/calendar/"
    res = requests.get(URL, headers=HEADERS)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    events = []
    selector = "div.tribe-events-calendar-list__event-wrapper.tribe-common-g-col"
    for wrapper in soup.select(selector):
        art = wrapper.select_one("article.tribe-events-calendar-list__event") or wrapper

        # Title & link
        link_tag = art.select_one("a.tribe-events-calendar-list__event-title-link")
        if not link_tag:
            continue
        link = link_tag["href"].strip()
        title = link_tag.get_text(strip=True)

        # Slug
        raw_slug = link.rstrip("/").split("/")[-1]
        slug = raw_slug if any(c.isalpha() for c in raw_slug) else slugify(title)

        # Image (lazyloaded)
        img_tag = art.select_one("img.lazyload")
        image = img_tag.get("data-src") or img_tag.get("src") if img_tag else None

        # Date & times
        start_date = start_time = end_time = None
        time_tag = art.select_one("time.tribe-events-calendar-list__event-datetime")
        if time_tag and time_tag.has_attr("datetime"):
            start_date = time_tag["datetime"]
            start_span = time_tag.select_one("span.tribe-event-date-start")
            end_span = time_tag.select_one("span.tribe-event-time")
            if start_span and "@" in start_span.text:
                part = start_span.text.split("@")[1].strip()
                start_time = datetime.strptime(part, "%I:%M %p").time().isoformat()
            if end_span:
                part = end_span.text.strip()
                end_time = datetime.strptime(part, "%I:%M %p").time().isoformat()

        # Description
        desc_tag = art.select_one("div.tribe-events-calendar-list__event-description p")
        description = desc_tag.get_text(strip=True) if desc_tag else None

        # Hard-code venue_id = 521 for Bartram's Garden
        events.append({
            "title":       title,
            "link":        link,
            "image":       image,
            "start_date":  start_date,
            "start_time":  start_time,
            "end_time":    end_time,
            "description": description,
            "venue_id":    521,
            "slug":        slug,
        })
    return events

# ── Upsert scraped data into Supabase ──────────────────────────────────────────
def upsert_data(events):
    for ev in events:
        print(f"⏳ Processing: {ev['title']}")

        record = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "description": ev["description"],
            "venue_id":    ev["venue_id"],
            "source":      "bartramsgarden",
            "slug":        ev["slug"],
        }
        if ev.get("start_time"):
            record["start_time"] = ev["start_time"]
        if ev.get("end_time"):
            record["end_time"] = ev["end_time"]

        supabase.table("all_events").upsert(record, on_conflict=["link"]).execute()
        print(f"✅ Upserted: {ev['title']}")

if __name__ == "__main__":
    events = scrape_events()
    print(f"🔎 Found {len(events)} events")
    if events:
        upsert_data(events)
