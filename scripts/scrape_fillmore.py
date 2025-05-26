#!/usr/bin/env python3
import os
import re
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from urllib.parse import urlparse, parse_qs, unquote

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
    URL = "https://www.thefillmorephilly.com/shows/rooms/the-fillmore-philadelphia"
    res = requests.get(URL, headers=HEADERS)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    events = []
    # each show is wrapped in a .chakra-linkbox
    for card in soup.select("div.chakra-linkbox"):
        # title & link
        overlay = card.select_one("a.chakra-linkbox__overlay")
        if not overlay:
            continue
        title = overlay.get_text(strip=True)
        link = overlay["href"].strip()

        # date
        date_tag = card.select_one("p.chakra-text.css-rfy86g")
        start_date = date_tag.get_text(strip=True) if date_tag else None

        # image: decode the Next.js proxy URL
        img = card.select_one("img")
        image_url = None
        if img and img.has_attr("src"):
            src = img["src"]
            parsed = urlparse(src)
            qs = parse_qs(parsed.query)
            if "url" in qs:
                # the encoded image URL lives in the `url` param
                image_url = unquote(qs["url"][0])
            else:
                image_url = src

        events.append({
            "title":      title,
            "link":       link,
            "image":      image_url,
            "start_date": start_date,
            "venue_name": "The Fillmore",
        })

    return events

# ── Upsert data into Supabase ──────────────────────────────────────────────────
def upsert_data(events):
    for ev in events:
        print(f"⏳ Processing: {ev['title']}")

        # Upsert venue and get its ID
        v = supabase.table("venues") \
                    .upsert({"name": ev["venue_name"]},
                            on_conflict=["name"],
                            returning="representation") \
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
            "venue_id":    venue_id,
            "source":      "the_fillmore",
            "slug":        final_slug,
        }

        # Upsert into all_events
        supabase.table("all_events") \
                .upsert(record, on_conflict=["link"]) \
                .execute()

        print(f"✅ Upserted: {ev['title']}")

# ── Main entrypoint ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    evs = scrape_events()
    print(f"🔎 Found {len(evs)} events")
    if evs:
        upsert_data(evs)
