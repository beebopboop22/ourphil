#!/usr/bin/env python3
"""
scripts/scrape_met.py

Fetches upcoming shows from The Met Philly and upserts them into your Supabase tables,
in the same style as scrape_livingarts.py.
"""

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

def extract_image_url(proxy_path: str) -> str:
    """
    Next.js gives us /_next/image?url=<encoded>&w=...&q=...
    This pulls out the `url` param and decodes it.
    """
    if proxy_path.startswith("/_next/image"):
        parsed = urlparse(proxy_path)
        qs = parse_qs(parsed.query)
        real = qs.get("url", [None])[0]
        return unquote(real) if real else proxy_path
    return proxy_path

def scrape_shows():
    URL = "https://www.themetphilly.com/shows"
    res = requests.get(URL, headers=HEADERS)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    shows = []
    grid = soup.select_one('section[data-automation="shows-grid"]')
    for grp in grid.select('div[role="group"]'):
        title_tag = grp.select_one('a.chakra-linkbox__overlay')
        if not title_tag:
            continue

        title = title_tag.get_text(strip=True)

        # the external "Buy Tickets" link
        buy = grp.find("a", string=re.compile(r"Buy Tickets", re.I))
        link = buy["href"] if buy else None

        # date like "Fri May 30, 2025"
        date_p = grp.find("p", string=re.compile(r'^\w{3} \w{3} \d{1,2}, \d{4}$'))
        if date_p:
            try:
                dt = datetime.strptime(date_p.get_text(strip=True), "%a %b %d, %Y")
                start_date = dt.strftime("%Y-%m-%d")
            except ValueError:
                start_date = None
        else:
            start_date = None

        # image
        img = grp.select_one("div.css-1d5l6os img")
        raw = img["src"] if img and img.has_attr("src") else None
        image = extract_image_url(raw) if raw else None

        shows.append({
            "title":       title,
            "link":        link,
            "image":       image,
            "start_date":  start_date,
            "description": None,
            "venue_name":  "The Met Presented by Highmark",
        })

    return shows

def upsert_data(shows):
    for show in shows:
        print(f"⏳ Processing: {show['title']}")

        # upsert the venue
        v = supabase.table("venues") \
                    .upsert({"name": show["venue_name"]},
                            on_conflict=["name"],
                            returning="representation") \
                    .execute()
        venue_id = v.data[0]["id"] if v.data else None

        # build slug from the external link or title
        raw_slug = show["link"].rstrip("/").split("/")[-1] if show["link"] else ""
        final_slug = raw_slug if raw_slug and not raw_slug.isdigit() else slugify(show["title"])

        record = {
            "name":        show["title"],
            "link":        show["link"],
            "image":       show["image"],
            "start_date":  show["start_date"],
            "description": show["description"],
            "venue_id":    venue_id,
            "source":      "themetphilly",
            "slug":        final_slug,
        }

        # upsert into the same all_events table
        supabase.table("all_events") \
                .upsert(record, on_conflict=["link"]) \
                .execute()

        print(f"✅ Upserted: {show['title']}")

if __name__ == "__main__":
    shows = scrape_shows()
    print(f"🔎 Found {len(shows)} shows")
    if shows:
        upsert_data(shows)
