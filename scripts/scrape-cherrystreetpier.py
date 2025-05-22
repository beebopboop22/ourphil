import os
import re
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

# ── Load env & init Supabase ─────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Request headers ────────────────────────────────────────────────────────────
HEADERS = {
    "User-Agent":      "Mozilla/5.0 (...Chrome/... Safari/...)",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept":          "text/html,application/xhtml+xml,*/*;q=0.8",
}

# ── Helpers ─────────────────────────────────────────────────────────────────────
def slugify(text: str) -> str:
    s = text.lower()
    s = re.sub(r'&', ' and ', s)
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')


def parse_date_range(date_str: str):
    """
    Parse strings like "May 10–June 7", "May 23–26", "Thursday, May 22" into ISO dates.
    """
    # Remove weekday if present
    date_str = re.sub(r"^\w+,\s*", "", date_str)
    parts = date_str.split('–')
    current_year = datetime.now().year
    try:
        if len(parts) == 2:
            # "May 10" and "June 7" or "May 23" and "26"
            start_raw, end_raw = parts
            start_raw = start_raw.strip()
            end_raw   = end_raw.strip()
            # determine month/day
            if ',' not in start_raw and len(parts[0].split()) == 2:
                # e.g. May 10
                pass
            # parse end with full or partial month
            if re.match(r"^[A-Za-z]+ \d{1,2}$", end_raw):
                # full month name
                ed = datetime.strptime(f"{end_raw}, {current_year}", "%B %d, %Y").date()
            else:
                # only day given, reuse month from start
                month = start_raw.split()[0]
                ed = datetime.strptime(f"{month} {end_raw}, {current_year}", "%B %d, %Y").date()
            sd = datetime.strptime(f"{start_raw}, {current_year}", "%B %d, %Y").date()
            return sd.isoformat(), ed.isoformat()
        else:
            # single date
            dt = datetime.strptime(date_str.strip(), "%B %d").replace(year=current_year)
            return dt.date().isoformat(), dt.date().isoformat()
    except Exception:
        return None, None

# ── Scrape listing ──────────────────────────────────────────────────────────────
def scrape_events():
    URL = "https://www.cherrystreetpier.com/events/"
    res = requests.get(URL, headers=HEADERS)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    events = []
    cards = soup.select("div.card-event a.card-hit")
    for a in cards:
        link = a["href"].strip()
        title_tag = a.select_one("h5.card-title")
        title = title_tag.get_text(strip=True) if title_tag else None

        date_tag = a.select_one("h6.card-subtitle")
        date_str = date_tag.get_text(strip=True) if date_tag else ""
        start_date, end_date = parse_date_range(date_str)

        # image from inline style
        thumb = a.select_one("div.card-thumb-inner")
        image = None
        if thumb and thumb.has_attr("style"):
            m = re.search(r"url\('(.+?)'\)", thumb["style"])
            if m:
                image = m.group(1)

        raw_slug = link.rstrip("/").split("/")[-1]
        slug = raw_slug if any(c.isalpha() for c in raw_slug) else slugify(title or raw_slug)

        events.append({
            "title":       title,
            "link":        link,
            "image":       image,
            "start_date":  start_date,
            "end_date":    end_date,
            # no time info on listing
            "start_time":  None,
            "end_time":    None,
            "description": None,
            # venue fixed
            "venue_name":  "Cherry Street Pier",
            "slug":        slug,
        })
    return events

# ── Upsert to Supabase ──────────────────────────────────────────────────────────
def upsert_data(events):
    for ev in events:
        print(f"⏳ Processing: {ev['title']}")
        # upsert venue
        v = supabase.table("venues") \
                    .upsert({"name": ev["venue_name"]}, on_conflict=["name"], returning="representation") \
                    .execute()
        venue_id = v.data[0]["id"] if v.data else None

        rec = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "end_date":    ev["end_date"],
            "start_time":  ev["start_time"],
            "end_time":    ev["end_time"],
            "description": ev["description"],
            "venue_id":    venue_id,
            "source":      "cherrystreetpier",
            "slug":        ev["slug"],
        }
        supabase.table("all_events").upsert(rec, on_conflict=["link"]).execute()
        print(f"✅ Upserted: {ev['title']}")

if __name__ == "__main__":
    evs = scrape_events()
    print(f"🔎 Found {len(evs)} events")
    if evs:
        upsert_data(evs)
