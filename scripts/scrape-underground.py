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
    "User-Agent":      "Mozilla/5.0 (...Chrome/... Safari/...)",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept":          "text/html,application/xhtml+xml,*/*;q=0.8",
}

# ── Helper to slugify titles if needed ─────────────────────────────────────────
def slugify(text: str) -> str:
    s = text.lower()
    s = re.sub(r'&', ' and ', s)
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

# ── Scrape listing page for Underground Arts events ─────────────────────────────
def scrape_events():
    URL = "https://undergroundarts.org/events/"
    res = requests.get(URL, headers=HEADERS)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    events = []
    current_year = datetime.now().year
    for wrapper in soup.select("div.sg-events__event"):
        art = wrapper.select_one("article") or wrapper

        # Link & title
        link_tag = art.select_one("a.sg-events__event-title-link")
        if not link_tag:
            continue
        link = link_tag["href"].strip()
        title = link_tag.get_text(strip=True)

        # Slug
        raw_slug = link.rstrip("/").split("/")[-1]
        slug = raw_slug if any(c.isalpha() for c in raw_slug) else slugify(title)

        # Image
        img_tag = art.select_one("img.sg-events__event-featured-image")
        image = img_tag["src"] if img_tag and img_tag.has_attr("src") else None

        # Date
        month_span = art.select_one("time.sg-events__event-date .sg-events__event-month")
        day_span   = art.select_one("time.sg-events__event-date .sg-events__event-day")
        start_date = None
        if month_span and day_span:
            month_text = month_span.get_text(strip=True).split(",")[-1].strip()
            day_text   = day_span.get_text(strip=True)
            try:
                dt = datetime.strptime(f"{month_text} {day_text} {current_year}", "%B %d %Y").date()
                start_date = dt.isoformat()
            except ValueError:
                pass

        # Times
        start_time = end_time = None
        time_tag = art.select_one("time.sg-events__event-time")
        if time_tag:
            txt = time_tag.get_text(" ", strip=True)
            m1 = re.search(r"Doors:\s*(\d{1,2}:\d{2}\s*[AP]M)", txt)
            m2 = re.search(r"Show:\s*(\d{1,2}:\d{2}\s*[AP]M)", txt)
            if m1:
                start_time = datetime.strptime(m1.group(1), "%I:%M %p").time().isoformat()
            if m2:
                end_time = datetime.strptime(m2.group(1), "%I:%M %p").time().isoformat()

        # Supporting artists & age
        support_tag = art.select_one("h4.sg-events__event-supporting-artists")
        age_tag     = art.select_one("div.sg-events__event-age-restriction")
        parts = []
        if support_tag:
            parts.append(support_tag.get_text(strip=True))
        if age_tag:
            parts.append(age_tag.get_text(strip=True))
        description = "; ".join(parts) if parts else None

        # Venue is always Underground Arts
        venue_name = "Underground Arts"

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

# ── Upsert into Supabase ───────────────────────────────────────────────────────
def upsert_data(events):
    for ev in events:
        print(f"⏳ Processing: {ev['title']}")
        # Upsert venue → get id
        v = supabase.table("venues") \
                    .upsert({"name": ev["venue_name"]}, on_conflict=["name"], returning="representation") \
                    .execute()
        venue_id = v.data[0]["id"] if v.data else None

        record = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "start_time":  ev["start_time"],
            "end_time":    ev["end_time"],
            "description": ev["description"],
            "venue_id":    venue_id,
            "source":      "undergroundarts",
            "slug":        ev["slug"],
        }
        supabase.table("all_events").upsert(record, on_conflict=["link"]).execute()
        print(f"✅ Upserted: {ev['title']}")

if __name__ == "__main__":
    e = scrape_events()
    print(f"🔎 Found {len(e)} events")
    if e:
        upsert_data(e)
