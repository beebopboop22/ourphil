# scripts/scrape-orchestra.py
import os
import re
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

# ── Load env & init Supabase (service-role first) ─────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Request headers ────────────────────────────────────────────────────────────
HEADERS = {
    "User-Agent":      "Mozilla/5.0 (...Chrome/... Safari/...)",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept":          "text/html,application/xhtml+xml;*/*;q=0.8"
}


def slugify(text: str) -> str:
    s = text.lower()
    s = re.sub(r'&', ' and ', s)
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

def scrape_events():
    URL = "https://www.ensembleartsphilly.org/tickets-and-events/philadelphia-orchestra/2024-25-season"
    res = requests.get(URL, headers=HEADERS)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    events = []
    for item in soup.select("div.events-grid__item a.event-item"):
        # link
        link = item["href"].strip()

        # title
        title_tag = item.select_one("h3.event-item__title")
        title = title_tag.get_text(strip=True) if title_tag else None

        # prefix as description
        desc_tag = item.select_one("span.event-item__prefix")
        description = desc_tag.get_text(strip=True) if desc_tag else None

        # dates
        date_tag = item.select_one("span.event-item__date")
        start_date = end_date = None
        if date_tag:
            dr = date_tag.get_text(strip=True)
            parts = dr.split("-")
            if len(parts) == 2:
                left, right = parts
                right = right.strip()
                try:
                    ed = datetime.strptime(right, "%b %d, %Y").date()
                except ValueError:
                    ed = datetime.strptime(right, "%B %d, %Y").date()
                end_date = ed.isoformat()
                ls = left.strip()
                # attach year from end_date
                ys = ed.year
                try:
                    sd = datetime.strptime(f"{ls}, {ys}", "%b %d, %Y").date()
                except ValueError:
                    sd = datetime.strptime(f"{ls}, {ys}", "%B %d, %Y").date()
                start_date = sd.isoformat()
            else:
                # single date
                d = dr.strip()
                try:
                    dt = datetime.strptime(d, "%b %d, %Y").date()
                except ValueError:
                    dt = datetime.strptime(d, "%B %d, %Y").date()
                start_date = end_date = dt.isoformat()

        # image
        img_tag = item.select_one("img.event-item__image")
        image = img_tag["src"] if img_tag and img_tag.has_attr("src") else None

        # venue
        venue_tag = item.select_one("span.event-item__venue")
        venue = venue_tag.get_text(strip=True) if venue_tag else None

        # slug
        raw = link.rstrip("/").split("/")[-1]
        slug = raw if any(c.isalpha() for c in raw) else slugify(title or raw)

        events.append({
            "title":       title,
            "link":        link,
            "image":       image,
            "start_date":  start_date,
            "end_date":    end_date,
            "start_time":  None,
            "end_time":    None,
            "description": description,
            "venue_name":  venue,
            "slug":        slug,
        })
    return events

def upsert_data(events):
    for ev in events:
        print(f"⏳ Processing: {ev['title']}")

        # upsert venue → venue_id
        venue_id = None
        if ev["venue_name"]:
            v = supabase.table("venues") \
                        .upsert({"name": ev["venue_name"]},
                                on_conflict=["name"],
                                returning="representation") \
                        .execute()
            if v.data:
                venue_id = v.data[0]["id"]

        # build record
        rec = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "end_date":    ev["end_date"],
            "description": ev["description"],
            "venue_id":    venue_id,
            "source":      "ensembleartsphilly",
            "slug":        ev["slug"],
        }
        supabase.table("all_events") \
                .upsert(rec, on_conflict=["link"]) \
                .execute()
        print(f"✅ Upserted: {ev['title']}")

if __name__ == "__main__":
    evs = scrape_events()
    print(f"🔎 Found {len(evs)} events")
    if evs:
        upsert_data(evs)
