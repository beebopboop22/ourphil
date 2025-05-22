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
# Prefer service role to bypass RLS; fallback to anon
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

# ── Scrape listing page for basic event info ───────────────────────────────────
def scrape_events():
    URL = "https://www.brooklynbowl.com/philadelphia/shows/all"
    res = requests.get(URL, headers=HEADERS)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    events = []
    for wrapper in soup.select("div.eventList__wrapper .eventItem.entry"):
        link_tag = wrapper.select_one("div.thumb a")
        if not link_tag:
            continue
        link = link_tag["href"].strip()

        title_tag = wrapper.select_one("h3.title a")
        title = title_tag.get_text(strip=True) if title_tag else None

        # Date (aria-label on .date.outside)
        start_date = None
        date_tag = wrapper.select_one("div.date.outside")
        if date_tag and date_tag.has_attr("aria-label"):
            date_str = date_tag["aria-label"]
            try:
                start_date = datetime.strptime(date_str, "%B %d %Y").date().isoformat()
            except ValueError:
                pass

        raw_slug = link.rstrip("/").split("/")[-1]
        slug = raw_slug if any(c.isalpha() for c in raw_slug) else slugify(title or raw_slug)

        events.append({
            "title":      title,
            "link":       link,
            "start_date": start_date,
            "slug":       slug,
        })
    return events

# ── Scrape detail page for image, times, description ─────────────────────────
def scrape_detail(event_url: str):
    res = requests.get(event_url, headers=HEADERS)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    # Image
    img_tag = soup.select_one("div#branding img.img-responsive")
    image = img_tag["src"] if img_tag and img_tag.has_attr("src") else None

    # Times
    start_time = end_time = None
    doors_tag = soup.select_one("div.info span.doors")
    if doors_tag:
        m = re.search(r"(\d{1,2}:\d{2}\s*[AP]M)", doors_tag.get_text())
        if m:
            start_time = datetime.strptime(m.group(1), "%I:%M %p").time().isoformat()
    show_tag = soup.select_one("div.info span.show-time")
    if show_tag:
        m = re.search(r"(\d{1,2}:\d{2}\s*[AP]M)", show_tag.get_text())
        if m:
            end_time = datetime.strptime(m.group(1), "%I:%M %p").time().isoformat()

    # Description + age
    desc_tag = soup.select_one("div.event_body_text")
    description = desc_tag.get_text(strip=True) if desc_tag else None
    age_tag = soup.select_one("div.info span.age-restriction")
    if age_tag:
        age_txt = age_tag.get_text(strip=True)
        description = f"{age_txt}. {description}" if description else age_txt

    return image, start_time, end_time, description

# ── Upsert events & venues into Supabase ──────────────────────────────────────
def upsert_data(events):
    for ev in events:
        print(f"⏳ Processing: {ev['title']}")
        image, start_time, end_time, description = scrape_detail(ev["link"])

        # Upsert venue (Brooklyn Bowl Philadelphia)
        venue_name = "Brooklyn Bowl Philadelphia"
        v = supabase.table("venues") \
                    .upsert({"name": venue_name}, on_conflict=["name"], returning="representation") \
                    .execute()
        venue_id = v.data[0]["id"] if v.data else None

        record = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       image,
            "start_date":  ev["start_date"],
            "start_time":  start_time,
            "end_time":    end_time,
            "description": description,
            "venue_id":    venue_id,
            "source":      "brooklynbowl",
            "slug":        ev["slug"],
        }
        supabase.table("all_events").upsert(record, on_conflict=["link"]).execute()
        print(f"✅ Upserted: {ev['title']}")

if __name__ == "__main__":
    events = scrape_events()
    print(f"🔎 Found {len(events)} events")
    if events:
        upsert_data(events)
