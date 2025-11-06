#!/usr/bin/env python3
import os
import re
import requests
from bs4 import BeautifulSoup
from dateutil import parser as dtparser
from supabase import create_client, Client
from dotenv import load_dotenv

# ── Config ───────────────────────────────────────────────────────────────
URL = "https://velvetwhipphilly.com/events"
VENUE_NAME = "Velvet Whip Arts & Social Club"
VENUE_ADDRESS = "319 North 11th Street, Philadelphia, PA 19107"
LAT, LNG = 39.958307, -75.159174
SOURCE_KEY = "velvet-whip"
TAG_ID_MUSIC = 6
DEFAULT_IMAGE = (
    "https://images.squarespace-cdn.com/content/v1/6110696d419b37283fe5b6b7/"
    "1fc791f3-44fd-4a0d-a8ea-7cf65fa79c2e/vw+logo+new+2025.png"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

# ── Init Supabase ────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Helpers ──────────────────────────────────────────────────────────────
def slugify(text):
    s = text.lower()
    s = re.sub(r"&", "and", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def normalize_time_text(text: str):
    """Clean fancy unicode dashes/spaces and normalize to '7:00 PM - 10:00 PM'"""
    if not text:
        return ""
    text = text.replace("–", "-")  # en dash → hyphen
    text = re.sub(r"\s*-\s*", " - ", text)
    return text.strip()

def extract_start_time(time_text: str):
    """Return 'HH:MM:SS' string for the start time."""
    if not time_text:
        return None
    time_text = normalize_time_text(time_text)
    part = time_text.split("-")[0].strip()
    try:
        dt = dtparser.parse(part, fuzzy=True)
        return dt.strftime("%H:%M:%S")
    except Exception:
        return None

def get_or_create_venue_id():
    slug = slugify(VENUE_NAME)
    res = supabase.table("venues").select("id").eq("slug", slug).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]["id"]
    ins = supabase.table("venues").insert(
        {
            "name": VENUE_NAME,
            "slug": slug,
            "address": VENUE_ADDRESS,
            "latitude": LAT,
            "longitude": LNG,
        }
    ).execute()
    if ins.data and len(ins.data) > 0:
        return ins.data[0]["id"]
    raise RuntimeError("Failed to insert venue record")

# ── Parser ──────────────────────────────────────────────────────────────
def parse_events():
    r = requests.get(URL, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    events = []
    for block in soup.select(".eventlist-event--upcoming"):
        title_el = block.select_one(".eventlist-title")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        # Remove embedded time fragments like “7PM-10PM” from titles
        title = re.sub(r"\b\d{1,2}:?\d{0,2}\s*[APMapm]+\b(\s*-\s*\d{1,2}:?\d{0,2}\s*[APMapm]+\b)?", "", title).strip(" -")

        link_el = title_el.find("a")
        link = link_el["href"] if link_el else URL
        if link and not link.startswith("http"):
            link = f"https://velvetwhipphilly.com{link}"

        # Event image (Squarespace CDN)
        img_el = block.select_one("img")
        image_url = img_el["src"] if img_el and img_el.get("src") else DEFAULT_IMAGE
        # remove ?format params if present, keep high-res
        if image_url and "?format=" in image_url:
            image_url = image_url.split("?format=")[0]

        date_el = block.select_one(".event-date")
        time_el = block.select_one(".event-time")
        date_text = date_el.get_text(" ", strip=True) if date_el else ""
        time_text = time_el.get_text(" ", strip=True) if time_el else ""

        start_date = None
        start_time = extract_start_time(time_text)
        if date_text:
            try:
                dt = dtparser.parse(date_text, fuzzy=True)
                start_date = dt.date().isoformat()
            except Exception:
                pass

        events.append(
            {
                "name": title,
                "link": link,
                "image": image_url,
                "start_date": start_date,
                "start_time": start_time,
            }
        )
    return events

# ── Tagging helper ───────────────────────────────────────────────────────
def ensure_music_tag(event_id):
    existing = (
        supabase.table("taggings")
        .select("id")
        .eq("taggable_type", "all_events")
        .eq("taggable_id", event_id)
        .eq("tag_id", TAG_ID_MUSIC)
        .execute()
    )
    if not existing.data:
        supabase.table("taggings").insert(
            {
                "tag_id": TAG_ID_MUSIC,
                "taggable_type": "all_events",
                "taggable_id": event_id,
            }
        ).execute()

# ── Upsert ───────────────────────────────────────────────────────────────
def upsert_data(events):
    venue_id = get_or_create_venue_id()
    print(f"🏛 Venue ID: {venue_id}")

    for ev in events:
        slug = slugify(ev["name"])
        record = {
            "name": ev["name"],
            "link": ev["link"],
            "image": ev["image"],
            "start_date": ev.get("start_date"),
            "start_time": ev.get("start_time"),
            "venue_id": venue_id,
            "source": SOURCE_KEY,
            "slug": slug,
            "latitude": LAT,
            "longitude": LNG,
        }

        res = supabase.table("all_events").upsert(record, on_conflict="link").execute()
        if not res.data:
            print(f"⚠️ Failed to upsert {ev['name']}")
            continue

        event_id = res.data[0]["id"]
        ensure_music_tag(event_id)
        print(f"✅ Upserted {ev['name']} ({ev.get('start_date')} {ev.get('start_time')}) 🎵")

# ── Main ─────────────────────────────────────────────────────────────────
def run():
    print("🎶 Scraping Velvet Whip Philly...")
    events = parse_events()
    print(f"📅 Found {len(events)} events")
    if events:
        upsert_data(events)
    print("🎉 Done!")

if __name__ == "__main__":
    run()
