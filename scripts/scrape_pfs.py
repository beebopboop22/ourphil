#!/usr/bin/env python3
import os
import re
import cloudscraper
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
    "User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept":          "text/html,application/xhtml+xml,*/*;q=0.8",
}

# ── Helper to slugify titles ────────────────────────────────────────────────────
def slugify(text: str) -> str:
    s = text.strip().lower()
    s = re.sub(r"&", " and ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

MASTER_URL = "https://filmadelphia.org/showtimes/?start_date=6/26/2025"

def scrape_showings(url: str):
    # Use cloudscraper to bypass basic anti-bot measures
    scraper = cloudscraper.create_scraper()
    scraper.headers.update(HEADERS)

    res = scraper.get(url)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    showings = []
    for movie_block in soup.select("div.movie-tags"):
        # movie container
        title_tag = movie_block.select_one("div.text-xl.font-bold a")
        if not title_tag:
            continue

        title = title_tag.get_text(strip=True)
        slug = slugify(title)

        # image
        img = movie_block.select_one("div.aspect-[445/249] img")
        image_url = img["src"] if img and img.has_attr("src") else None

        # theater & runtime
        theater = movie_block.select_one(".font-bold.text-brand-gold:contains('Theater')") 
        theater = theater.find_next_sibling(text=True).strip() if theater else None

        runtime = movie_block.select_one(".font-bold.text-brand-gold:contains('Runtime')")
        runtime = runtime.find_next_sibling(text=True).strip().split()[0] if runtime else None

        # description
        desc = movie_block.select_one("div.mb-5:not(.text-xl)")
        description = desc.get_text(strip=True) if desc else None

        # collect showtime buttons
        for btn in movie_block.select("a.button-showtime"):
            showtime_raw = btn.get_text(strip=True)
            # normalize to 24h
            try:
                dt = datetime.strptime(showtime_raw, "%I:%M%p").time().isoformat()
            except ValueError:
                dt = None
            ticket_link = btn["href"]

            showings.append({
                "movie":        title,
                "slug":         slug,
                "image_url":    image_url,
                "theater":      theater,
                "runtime_min":  runtime,
                "description":  description,
                "showtime":     dt,
                "ticket_link":  ticket_link,
                "source":       "filmadelphia",
            })

    return showings

def upsert_data():
    movies = scrape_showings(MASTER_URL)
    print(f"🔎 Found {len(movies)} showings")

    for m in movies:
        print(f"⏳ Upserting: {m['movie']} @ {m['showtime']}")
        record = {
            "movie":        m["movie"],
            "slug":         m["slug"],
            "image_url":    m["image_url"],
            "theater":      m["theater"],
            "runtime_min":  m["runtime_min"],
            "description":  m["description"],
            "showtime":     m["showtime"],
            "ticket_link":  m["ticket_link"],
            "source":       m["source"],
        }
        # On conflict, you might choose movie+showtime as your unique key
        supabase.table("film_showings") \
                .upsert(record, on_conflict=["movie", "showtime"]) \
                .execute()
        print(f"✅ Upserted: {m['movie']} @ {m['showtime']}")

if __name__ == "__main__":
    upsert_data()
