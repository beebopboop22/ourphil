import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

# ── Load environment variables ─────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
# Prefer the service_role key to bypass RLS; fallback to anon key
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

# ── Initialize Supabase client ────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Source URL & request headers ───────────────────────────────────────────────
URL = "https://worldcafelive.org/events/"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/114.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;"
        "q=0.9,image/avif,image/webp,*/*;q=0.8"
    ),
}

# ── Scrape & parse events ───────────────────────────────────────────────────────
def scrape_events():
    res = requests.get(URL, headers=HEADERS)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    events = []
    for wrapper in soup.select("div.eventWrapper.rhpSingleEvent"):
        # Title & link
        a = wrapper.select_one("a.url")
        title = a["title"].strip()
        link  = a["href"].strip()

        # Image URL
        img_tag = wrapper.select_one("div.rhp-events-event-image img")
        image   = img_tag["src"] if img_tag else None

        # Date parsing
        date_div = wrapper.find("div", id="eventDate")
        date_str = date_div.text.strip() if date_div else None
        start_date = None
        if date_str:
            try:
                start_date = datetime.strptime(date_str, "%a, %B %d, %Y") \
                                   .date().isoformat()
            except ValueError:
                pass

        # Price → brief description
        cost_span = wrapper.select_one("div.eventCost span")
        price_txt = cost_span.text.strip() if cost_span else None

        # Venue name
        venue_link = wrapper.select_one("div.eventsVenueDiv a.noVenueLink")
        venue_name = venue_link.text.strip() if venue_link else None

        events.append({
            "title":       title,
            "link":        link,
            "image":       image,
            "start_date":  start_date,
            "description": price_txt,
            "venue_name":  venue_name,
        })

    return events

# ── Upsert scraped data into Supabase ──────────────────────────────────────────
def upsert_data(events):
    for ev in events:
        print(f"⏳ Processing: {ev['title']}")

        # 1) Upsert venue, get its id
        venue_id = None
        if ev["venue_name"]:
            v = supabase.table("venues") \
                        .upsert(
                            {"name": ev["venue_name"]},
                            on_conflict=["name"],
                            returning="representation"
                        ) \
                        .execute()
            if v.data:
                venue_id = v.data[0]["id"]

        # 2) Build event record
        record = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "description": ev["description"],
            "venue_id":    venue_id,
            "source":      "worldcafelive",
            "slug":        ev["link"].rstrip("/").split("/")[-1],
        }

        # 3) Upsert into all_events on link conflict
        supabase.table("all_events") \
                .upsert(record, on_conflict=["link"]) \
                .execute()

        print(f"✅ Upserted: {ev['title']}")

# ── Main execution ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    events = scrape_events()
    print(f"🔎 Found {len(events)} events")
    if events:
        upsert_data(events)
