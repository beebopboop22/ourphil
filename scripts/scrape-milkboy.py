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

def slugify(text: str) -> str:
    slug = text.lower()
    slug = re.sub(r'&', ' and ', slug)
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    return slug.strip('-')

def scrape_events():
    URL = "https://milkboyphilly.com/"
    res = requests.get(URL, headers=HEADERS)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    events = []
    for wrapper in soup.select("div.sg-events__event"):
        art = wrapper.select_one("article") or wrapper

        # Title link
        link_tag = art.select_one("a.sg-events__event-title-link")
        if not link_tag:
            continue
        link = link_tag["href"].strip()
        text_title = link_tag.get_text(strip=True)

        # Slug
        raw_slug = link.rstrip("/").split("/")[-1]
        slug = raw_slug if any(c.isalpha() for c in raw_slug) else slugify(text_title)

        # Full title + support
        support_tag = art.select_one("h4.sg-events__event-supporting-artists")
        title = text_title + (f" – {support_tag.get_text(strip=True)}" if support_tag else "")

        # Date
        start_date = None
        date_tag = art.select_one("time.sg-events__event-date")
        if date_tag:
            month = date_tag.select_one("span.sg-events__event-month").get_text(strip=True)
            day   = date_tag.select_one("span.sg-events__event-day").get_text(strip=True)
            try:
                dt = datetime.strptime(f"{month} {day} 2025", "%A, %B %d %Y")
                start_date = dt.date().isoformat()
            except ValueError:
                pass

        # Times
        start_time = end_time = None
        time_tag = art.select_one("time.sg-events__event-time")
        if time_tag:
            text = time_tag.get_text(separator=" ").strip()
            parts = re.split(r'\|\s*', text)
            for p in parts:
                m = re.search(r'(\d{1,2}:\d{2}\s*[AP]M)', p)
                if m:
                    t_iso = datetime.strptime(m.group(1), "%I:%M %p").time().isoformat()
                    if "Doors" in p:
                        start_time = t_iso
                    elif "Show" in p:
                        end_time = t_iso

        # **Fixed image selector**
        img_tag = art.select_one("img.sg-events__event-featured-image")
        image = img_tag["src"] if img_tag and img_tag.has_attr("src") else None

        # Description: support + age
        parts = []
        if support_tag:
            parts.append(support_tag.get_text(strip=True))
        age_tag = art.select_one("div.sg-events__event-age-restriction")
        if age_tag:
            parts.append(age_tag.get_text(strip=True))
        description = " | ".join(parts) if parts else None

        # Venue
        vn = art.select_one("div.sg-events__event-venue-name")
        venue_name = vn.get_text(strip=True) if vn else None

        events.append({
            "title":       title,
            "link":        link,
            "image":       image,
            "start_date":  start_date,
            "start_time":  start_time,
            "end_time":    end_time,
            "description": description,
            "venue_name":  venue_name,
            "slug":        slug,
        })

    return events

def upsert_data(events):
    for ev in events:
        print(f"⏳ Processing: {ev['title']}")

        venue_id = None
        if ev["venue_name"]:
            v = supabase.table("venues") \
                        .upsert({"name": ev["venue_name"]}, on_conflict=["name"], returning="representation") \
                        .execute()
            venue_id = v.data[0]["id"] if v.data else None

        record = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "description": ev["description"],
            "venue_id":    venue_id,
            "source":      "milkboyphilly",
            "slug":        ev["slug"],
        }
        if ev["start_time"]:
            record["start_time"] = ev["start_time"]
        if ev["end_time"]:
            record["end_time"] = ev["end_time"]

        supabase.table("all_events").upsert(record, on_conflict=["link"]).execute()
        print(f"✅ Upserted: {ev['title']}")

if __name__ == "__main__":
    evs = scrape_events()
    print(f"🔎 Found {len(evs)} events")
    if evs:
        upsert_data(evs)
