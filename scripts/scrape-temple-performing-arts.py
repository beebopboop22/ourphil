#!/usr/bin/env python3
import os
import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from dateutil import parser as dtparser
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

# ───────────────────────────────────────────────
# CONFIG
# ───────────────────────────────────────────────
BASE_URL = "http://templeperformingartscenter.org"
LIST_URL = f"{BASE_URL}/calendar"
VENUE_NAME = "Temple Performing Arts Center"
SOURCE_KEY = "temple-performing-arts"
TAG_ID_MUSIC = 6  # Music tag
FALLBACK_IMAGE = "https://boyer.temple.edu/sites/boyer/files/media/image/20100301_Baptist_001.jpg"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

# ───────────────────────────────────────────────
# INIT SUPABASE
# ───────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ───────────────────────────────────────────────
# HELPERS
# ───────────────────────────────────────────────
def slugify(text):
    s = text.lower()
    s = re.sub(r"&", "and", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def fetch_html(url):
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.text

def normalize_image_url(src: str):
    """Convert relative or protocol-relative src into a full HTTPS URL."""
    if not src:
        return FALLBACK_IMAGE
    src = src.strip()
    if src.startswith("http://"):
        src = src.replace("http://", "https://")
    elif src.startswith("//"):
        src = "https:" + src
    elif src.startswith("/"):
        src = urljoin(BASE_URL, src)
    elif src.startswith("sites/"):
        src = f"{BASE_URL}/{src}"
    return src or FALLBACK_IMAGE

def parse_datetime(text):
    """Extract both date and time, returning a datetime object."""
    try:
        clean = re.sub(r"<br\s*/?>", " ", text, flags=re.IGNORECASE)
        clean = re.sub(r"\s+", " ", clean).strip()
        return dtparser.parse(clean, fuzzy=True)
    except Exception:
        return None

def get_or_create_venue_id():
    slug = slugify(VENUE_NAME)
    res = supabase.table("venues").select("id").eq("slug", slug).limit(1).execute()
    if res.data:
        return res.data[0]["id"]
    ins = (
        supabase.table("venues")
        .insert(
            {
                "name": VENUE_NAME,
                "slug": slug,
                "address": "1837 N. Broad St., Philadelphia, PA 19122",
            }
        )
        .select("id")
        .single()
        .execute()
    )
    return ins.data["id"]

# ───────────────────────────────────────────────
# PARSE EVENTS
# ───────────────────────────────────────────────
def parse_events():
    html = fetch_html(LIST_URL)
    soup = BeautifulSoup(html, "html.parser")
    events = []

    for li in soup.select("li.views-row"):
        title_el = li.select_one("h2 a")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        link = urljoin(BASE_URL, title_el.get("href", ""))
        date_el = li.select_one(".date-display-single")
        date_text = date_el.decode_contents() if date_el else ""
        dt_obj = parse_datetime(date_text)

        start_date = dt_obj.date().isoformat() if dt_obj else None
        start_time = dt_obj.strftime("%H:%M:%S") if dt_obj else None

        image = FALLBACK_IMAGE  # static fallback for all

        events.append(
            {
                "name": title,
                "link": link,
                "image": image,
                "start_date": start_date,
                "start_time": start_time,
            }
        )
    return events

# ───────────────────────────────────────────────
# TAGGING
# ───────────────────────────────────────────────
def ensure_music_tag(event_id: int):
    """Insert music tag only if not already tagged."""
    existing = (
        supabase.table("taggings")
        .select("id")
        .eq("taggable_type", "all_events")
        .eq("taggable_id", event_id)
        .eq("tag_id", TAG_ID_MUSIC)
        .execute()
    )
    if existing.data:
        return
    supabase.table("taggings").insert(
        {
            "tag_id": TAG_ID_MUSIC,
            "taggable_type": "all_events",
            "taggable_id": event_id,
        }
    ).execute()

# ───────────────────────────────────────────────
# UPSERT
# ───────────────────────────────────────────────
def upsert_data(events):
    venue_id = get_or_create_venue_id()
    print(f"🏛 Venue ID: {venue_id}")

    for ev in events:
        slug = slugify(ev["name"])
        record = {
            "name": ev["name"],
            "link": ev["link"],
            "image": ev["image"],
            "start_date": ev["start_date"],
            "start_time": ev["start_time"],
            "venue_id": venue_id,
            "source": SOURCE_KEY,
            "slug": slug,
        }

        res = supabase.table("all_events").upsert(record, on_conflict="link").execute()
        if not res.data:
            print(f"⚠️ Failed to upsert {ev['name']}")
            continue

        event_id = res.data[0]["id"]
        ensure_music_tag(event_id)
        print(f"✅ Upserted {ev['name']} ({ev['start_date']} {ev['start_time']}) 🎵 tagged Music")

# ───────────────────────────────────────────────
# MAIN
# ───────────────────────────────────────────────
def run():
    print("🎶 Scraping Temple Performing Arts Center...")
    events = parse_events()
    print(f"📅 Found {len(events)} events")
    if events:
        upsert_data(events)
    print("🎉 Done!")

if __name__ == "__main__":
    run()
