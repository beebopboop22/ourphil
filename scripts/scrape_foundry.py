import os
import re
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime
from urllib.parse import urlparse, parse_qs, unquote

# ── Load environment variables ─────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
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

def slugify(text: str) -> str:
    slug = text.lower()
    slug = re.sub(r'&', ' and ', slug)
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    return slug.strip('-')

def scrape_events():
    URL = "https://www.thefillmorephilly.com/shows/rooms/the-foundry"
    res = requests.get(URL, headers=HEADERS)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    events = []
    # each show is inside a .chakra-linkbox wrapper
    for card in soup.select("div.chakra-linkbox"):
        # title
        t = card.select_one("p.css-zvlevn")
        if not t:
            continue
        title = t.get_text(strip=True)

        # date
        d = card.select_one("p.css-rfy86g")
        try:
            raw_date = d.get_text(strip=True)
            # e.g. "Tue May 27, 2025"
            dt = datetime.strptime(raw_date, "%a %b %d, %Y")
            start_date = dt.date().isoformat()
        except:
            start_date = None

        # buy-tickets link
        a = card.select_one("a.chakra-button")
        link = a["href"] if a and a.has_attr("href") else None

        # image: Next.js wraps via /_next/image?url=ENCODED...&w=... → extract url param
        img = card.find("img", {"data-nimg": "fill"})
        image = None
        if img and img.has_attr("src"):
            src = img["src"]
            qs = parse_qs(urlparse(src).query)
            if "url" in qs:
                image = unquote(qs["url"][0])

        events.append({
            "title":      title,
            "link":       link,
            "image":      image,
            "start_date": start_date,
            "venue_name": "The Foundry",
        })

    return events

def upsert_data(events):
    for ev in events:
        print(f"⏳ Processing: {ev['title']}")

        # upsert venue
        v = supabase.table("venues") \
                    .upsert({"name": ev["venue_name"]},
                            on_conflict=["name"],
                            returning="representation") \
                    .execute()
        venue_id = v.data[0]["id"] if v.data else None

        # slug
        raw_slug = ev["link"].rstrip("/").split("/")[-1]
        final_slug = raw_slug if raw_slug and not raw_slug.isdigit() else slugify(ev["title"])

        record = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "venue_id":    venue_id,
            "source":      "foundry",
            "slug":        final_slug,
        }

        supabase.table("all_events") \
                .upsert(record, on_conflict=["link"]) \
                .execute()

        print(f"✅ Upserted: {ev['title']}")

if __name__ == "__main__":
    evs = scrape_events()
    print(f"🔎 Found {len(evs)} events")
    if evs:
        upsert_data(evs)
