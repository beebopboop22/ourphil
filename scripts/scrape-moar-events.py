#!/usr/bin/env python3
import os
import re
import time
import requests
from bs4 import BeautifulSoup
from dateutil import parser as dtparser
from urllib.parse import urljoin
from dotenv import load_dotenv
from supabase import create_client, Client

# ───────────────────────────────────────────────
# CONFIG
# ───────────────────────────────────────────────
load_dotenv()

BASE_URL = "https://www.amrevmuseum.org"
LIST_URL = f"{BASE_URL}/at-the-museum/events"
VENUE_NAME = "Museum of the American Revolution"
SOURCE_KEY = "amrevmuseum"

TAG_MAP = {
    "Concerts & Performances": 6,          # Music
    "Holiday Weekends": 10,                # Family
    "Talks & Tours": 2,                    # Arts
    "Lectures & Discussions": 2,           # Arts
    "Living History Demonstrations": 2,    # Arts
    "Special Events": 2,                   # Arts
    "Events": 2,                           # Arts fallback
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.google.com/",
    "DNT": "1",
    "Upgrade-Insecure-Requests": "1",
    "Connection": "keep-alive",
}

# Supabase init
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_KEY.")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ───────────────────────────────────────────────
# HELPERS
# ───────────────────────────────────────────────
def slugify(text):
    s = text.lower()
    s = re.sub(r"&", "and", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def fetch_html(url, retries=3):
    """Fetch page with full browser headers and fallback UA on 403"""
    for attempt in range(1, retries + 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            if r.status_code == 403:
                # retry with alternate UA
                alt_headers = HEADERS.copy()
                alt_headers["User-Agent"] = (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0"
                )
                r = requests.get(url, headers=alt_headers, timeout=30)
            if r.status_code == 200:
                return r.text
            print(f"⚠️ Attempt {attempt}: {r.status_code} for {url}")
        except Exception as e:
            print(f"⚠️ Attempt {attempt} failed: {e}")
        time.sleep(2)
    raise RuntimeError(f"Failed to fetch {url} after {retries} attempts")


def get_or_create_venue_id():
    slug = slugify(VENUE_NAME)
    res = supabase.table("venues").select("id").eq("slug", slug).limit(1).execute()
    if res.data:
        return res.data[0]["id"]
    ins = (
        supabase.table("venues")
        .insert({"name": VENUE_NAME, "slug": slug})
        .select("id")
        .single()
        .execute()
    )
    return ins.data["id"]


def parse_date_range(date_text):
    """Extract ISO date from text like 'November 8-11, 2025' or 'November 13, 2025 from 6:30-7:30 p.m.'"""
    text = date_text.strip()
    text = re.sub(r"[–—]", "-", text)
    text = re.sub(r"\s+", " ", text)
    # Range: November 8-11, 2025
    m = re.search(r"([A-Za-z]+)\s+(\d{1,2})-(\d{1,2}),\s*(\d{4})", text)
    if m:
        return dtparser.parse(f"{m.group(1)} {m.group(2)}, {m.group(4)}").date().isoformat()
    # Single date: November 13, 2025
    m = re.search(r"([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})", text)
    if m:
        return dtparser.parse(m.group(0)).date().isoformat()
    return None


# ───────────────────────────────────────────────
# SCRAPER
# ───────────────────────────────────────────────
def parse_events():
    events = []
    page = 1
    while True:
        url = LIST_URL if page == 1 else f"{LIST_URL}?page={page}"
        html = fetch_html(url)
        soup = BeautifulSoup(html, "html.parser")
        cards = soup.select(".m-card.m-card--date")
        if not cards:
            break

        for card in cards:
            title = card.select_one(".m-card__title")
            title = title.get_text(strip=True) if title else None
            date_text = card.select_one(".m-card__subtitle")
            date_text = date_text.get_text(strip=True) if date_text else None
            desc = card.select_one(".m-card__text")
            desc = desc.get_text(strip=True) if desc else None
            link = card.select_one(".m-card__content a.a-cta")
            link = urljoin(BASE_URL, link["href"]) if link else None
            img = card.select_one(".m-card__image img")
            image = urljoin(BASE_URL, img["src"]) if img and img.has_attr("src") else None
            cats = [c.get_text(strip=True) for c in card.select(".m-card__labels a")]

            tag_id = None
            for c in cats:
                if c in TAG_MAP:
                    tag_id = TAG_MAP[c]
                    break

            start_date = parse_date_range(date_text or "")

            if not title or not link:
                continue

            events.append(
                {
                    "name": title,
                    "link": link,
                    "image": image,
                    "start_date": start_date,
                    "description": desc,
                    "tag_id": tag_id,
                }
            )

        if len(cards) < 10:
            break
        page += 1
    return events


# ───────────────────────────────────────────────
# SUPABASE UPSERT
# ───────────────────────────────────────────────
def upsert_data(events):
    venue_id = get_or_create_venue_id()
    print(f"🏛 Venue ID: {venue_id}")
    for ev in events:
        slug = slugify(ev["name"])
        record = {
            "name": ev["name"],
            "link": ev["link"],
            "image": ev.get("image"),
            "start_date": ev.get("start_date"),
            "venue_id": venue_id,
            "source": SOURCE_KEY,
            "slug": slug,
            "long_description": ev.get("description"),
        }
        res = supabase.table("all_events").upsert(record, on_conflict="link").execute()
        if not res.data:
            print(f"⚠️ Failed to upsert {ev['name']}")
            continue

        print(f"✅ Upserted {ev['name']}")
        if ev.get("tag_id"):
            tag = {
                "tag_id": ev["tag_id"],
                "taggable_type": "all_events",
                "taggable_id": res.data[0]["id"],
            }
            supabase.table("taggings").upsert(tag).execute()
            print(f"🏷️ Tagged with {ev['tag_id']}")


# ───────────────────────────────────────────────
# MAIN
# ───────────────────────────────────────────────
def run():
    print("🎨 Scraping Museum of the American Revolution...")
    events = parse_events()
    print(f"📅 Found {len(events)} events.")
    if events:
        upsert_data(events)
    print("🎉 Done!")


if __name__ == "__main__":
    run()
