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
# Prefer the service role key to bypass RLS, fallback to anon
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

# ── Initialize Supabase client ────────────────────────────────────────────────
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

# ── Helper to slugify titles when link slug is numeric ─────────────────────────
def slugify(text: str) -> str:
    slug = text.lower()
    slug = re.sub(r'&', ' and ', slug)
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    return slug.strip('-')

# ── Scrape & parse events ───────────────────────────────────────────────────────
def scrape_events():
    URL = "https://www.philamoca.org/"
    res = requests.get(URL, headers=HEADERS)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    events = []
    for a in soup.select("a.event.event--tickets-available"):
        link = a["href"].strip()

        # Build full title
        parts = []
        if (lbl := a.select_one("span.event__label")):
            parts.append(lbl.get_text(strip=True))
        if (ttl := a.select_one("span.event__title")):
            parts.append(ttl.get_text(strip=True))
        full_title = " ".join(parts)
        if (sup := a.select_one("span.event__support")):
            full_title += f" – {sup.get_text(strip=True)}"

        # Description or fallback to ticket price
        if (desc := a.select_one("p.event__description")):
            description = desc.get_text(strip=True)
        elif (price := a.select_one("li.event__detail--tickets span.event__detail-value")):
            description = price.get_text(strip=True)
        else:
            description = None

        # Start date
        if (date_tag := a.select_one("time.event__date")) and date_tag.has_attr("datetime"):
            start_date = date_tag["datetime"]
        else:
            start_date = None

        # Start and end times
        times = a.select("li.event__detail--time time.event__details-value")
        start_time = None
        end_time = None
        if len(times) > 0:
            start_time = times[0].get("datetime") or times[0].get_text(strip=True)
        if len(times) > 1:
            end_time = times[1].get("datetime") or times[1].get_text(strip=True)

        # Image URL
        image = a.select_one("div.event__art img")
        image_url = image["src"] if image else None

        events.append({
            "title":      full_title.strip(),
            "link":       link,
            "image":      image_url,
            "start_date": start_date,
            "start_time": start_time,
            "end_time":   end_time,
            "description":description,
            "venue_name": "PhilaMOCA",
        })
    return events

# ── Upsert data into Supabase ──────────────────────────────────────────────────
def upsert_data(events):
    for ev in events:
        print(f"⏳ Processing: {ev['title']}")

        # Upsert venue and get its ID
        v = supabase.table("venues") \
                    .upsert(
                        {"name": ev["venue_name"]},
                        on_conflict=["name"],
                        returning="representation"
                    ) \
                    .execute()
        venue_id = v.data[0]["id"] if v.data else None

        # Determine slug: use link segment unless it's numeric
        raw_slug = ev["link"].rstrip("/").split("/")[-1]
        final_slug = raw_slug if not raw_slug.isdigit() else slugify(ev["title"])

        # Build event record
        record = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "description": ev["description"],
            "venue_id":    venue_id,
            "source":      "philamoca",
            "slug":        final_slug,
        }
        if ev["start_time"]:
            record["start_time"] = ev["start_time"]
        if ev["end_time"]:
            record["end_time"] = ev["end_time"]

        # Upsert into all_events
        supabase.table("all_events") \
                .upsert(record, on_conflict=["link"]) \
                .execute()

        print(f"✅ Upserted: {ev['title']}")

# ── Main entrypoint ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    events = scrape_events()
    print(f"🔎 Found {len(events)} events")
    if events:
        upsert_data(events)
