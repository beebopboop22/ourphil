#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from dateutil import parser as dtparser
from dotenv import load_dotenv
from supabase import create_client, Client

# ──────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────
BASE_URL = "https://www.club624.com"
LIST_URL = f"{BASE_URL}/upcoming-events-0RfZR-WrGUd"
VENUE_NAME = "Club 624"
VENUE_SLUG = "club-624"
VENUE_ADDRESS = "624 S 6th St, Philadelphia, PA 19147"
SOURCE_KEY = "club624"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

# Your real tag IDs
TAG_IDS = {
    "pride": 1,
    "arts": 2,
    "nomnomslurp": 3,
    "organize": 4,
    "fitness": 5,
    "music": 6,
    "outdoors": 7,
    "markets": 8,
    "family": 10,
    "kids": 12,
    "sports": 13,
    "comedy": 43,
}

KEYWORDS_TO_TAGS = [
    (re.compile(r"\b(comedy|comedian|stand-?up)\b", re.I), TAG_IDS["comedy"]),
    (re.compile(r"\b(jazz|funk|music|band|dj|dance party|burlesque|cabaret)\b", re.I), TAG_IDS["music"]),
    (re.compile(r"\b(burlesque|cabaret|draglesque|performance art)\b", re.I), TAG_IDS["arts"]),
    (re.compile(r"\b(taco|kitchen|drinks?)\b", re.I), TAG_IDS["nomnomslurp"]),
    (re.compile(r"\bfamily\b", re.I), TAG_IDS["family"]),
    (re.compile(r"\bkids?\b", re.I), TAG_IDS["kids"]),
    (re.compile(r"\b(eagles|phillies|sixers|flyers|union)\b", re.I), TAG_IDS["sports"]),
]


# ──────────────────────────────────────────────────────────────
# Supabase Init
# ──────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────
def fetch_html(url, retries=3):
    for i in range(1, retries + 1):
        r = requests.get(url, headers=HEADERS, timeout=30)
        if r.status_code == 200:
            return r.text
        print(f"⚠️ Fetch attempt {i}/{retries} failed ({r.status_code}) → {url}")
        time.sleep(i)
    raise RuntimeError(f"Failed after {retries} attempts: {url}")


def slugify(text):
    s = text.lower()
    s = re.sub(r"&", " and ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def parse_iso_date(text):
    try:
        return dtparser.parse(text, fuzzy=True).date().isoformat()
    except Exception:
        return None


def parse_hms(text):
    if not text:
        return None
    cleaned = re.sub(r"[\u2006\u2007\u2009\u202F\u00A0]", " ", text).strip()
    try:
        t = dtparser.parse(cleaned, fuzzy=True)
        return t.strftime("%H:%M:%S")
    except Exception:
        return None


def get_text(el):
    return el.get_text(" ", strip=True) if el else ""


def extract_image(img):
    if not img:
        return None
    for attr in ["data-image", "data-src", "src"]:
        if img.has_attr(attr):
            url = img[attr].strip()
            if url.startswith("//"):
                return "https:" + url
            if url.startswith("/"):
                return urljoin(BASE_URL, url)
            return url
    return None


def extract_description(event_url):
    """Open event detail page and scrape full description HTML→cleaned text."""
    html = fetch_html(event_url)
    soup = BeautifulSoup(html, "html.parser")

    body = (
        soup.select_one(".sqs-html-content") or
        soup.select_one(".eventitem-description") or
        soup.select_one(".eventitem-excerpt") or
        soup.select_one("div.event-description")
    )

    if not body:
        return None

    # Clean text but keep paragraphs
    texts = [p.get_text(" ", strip=True) for p in body.find_all(["p", "div", "span"])]
    final = "\n\n".join([t for t in texts if t])
    return final.strip() or None


def infer_tags(title, description):
    blob = (title + "\n" + (description or "")).lower()
    tags = set()
    for pattern, tag_id in KEYWORDS_TO_TAGS:
        if pattern.search(blob):
            tags.add(tag_id)
    return tags


def get_or_create_venue_id():
    res = supabase.table("venues").select("id").eq("slug", VENUE_SLUG).limit(1).execute()
    if res.data:
        return res.data[0]["id"]

    ins = (
        supabase.table("venues")
        .insert({"name": VENUE_NAME, "slug": VENUE_SLUG, "address": VENUE_ADDRESS})
        .execute()
    )
    return ins.data[0]["id"]


def ensure_tags(event_id, tag_ids):
    for tag_id in tag_ids:
        exists = (
            supabase.table("taggings")
            .select("id")
            .eq("taggable_type", "all_events")
            .eq("taggable_id", event_id)
            .eq("tag_id", tag_id)
            .execute()
        )
        if exists.data:
            continue

        supabase.table("taggings").insert(
            {
                "taggable_type": "all_events",
                "taggable_id": event_id,
                "tag_id": tag_id,
            }
        ).execute()


# ──────────────────────────────────────────────────────────────
# Parse listing page
# ──────────────────────────────────────────────────────────────
def parse_events():
    html = fetch_html(LIST_URL)
    soup = BeautifulSoup(html, "html.parser")
    events = []

    for art in soup.select("article.eventlist-event"):
        title_el = art.select_one("h1.eventlist-title a")
        if not title_el:
            continue

        title = get_text(title_el)
        link = urljoin(BASE_URL, title_el["href"])

        # Image
        img_el = art.select_one("a.eventlist-column-thumbnail img")
        image = extract_image(img_el)

        # Date
        date_el = art.select_one("time.event-date")
        start_date = parse_iso_date(date_el.get("datetime")) if date_el else None

        # Times
        time_wrap = art.select_one("li.eventlist-meta-time")
        start_time = end_time = None
        if time_wrap:
            s = time_wrap.select_one("time.event-time-localized-start")
            e = time_wrap.select_one("time.event-time-localized-end")
            start_time = parse_hms(get_text(s))
            end_time = parse_hms(get_text(e))

        # Full description (event detail page)
        description = extract_description(link)

        tags = infer_tags(title, description)

        events.append(
            {
                "name": title,
                "link": link,
                "image": image,
                "start_date": start_date,
                "start_time": start_time,
                "end_time": end_time,
                "description": description,
                "tags": tags,
            }
        )

    return events


# ──────────────────────────────────────────────────────────────
# Upsert
# ──────────────────────────────────────────────────────────────
def upsert_events(events):
    venue_id = get_or_create_venue_id()
    for ev in events:
        slug = slugify(ev["name"])

        record = {
            "name": ev["name"],
            "link": ev["link"],
            "image": ev["image"],
            "description": ev["description"],
            "start_date": ev["start_date"],
            "start_time": ev["start_time"],
            "end_time": ev["end_time"],
            "venue_id": venue_id,
            "source": SOURCE_KEY,
            "slug": slug,
        }

        supabase.table("all_events").upsert(record, on_conflict="link").execute()

        # fetch event id
        sel = supabase.table("all_events").select("id").eq("link", ev["link"]).limit(1).execute()
        if not sel.data:
            print(f"❌ Failed: {ev['name']}")
            continue

        event_id = sel.data[0]["id"]

        if ev["tags"]:
            ensure_tags(event_id, ev["tags"])

        print(f"✅ Upserted {ev['name']} with description + tags")


# ──────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────
def run():
    print("🎭 Scraping Club 624…")
    events = parse_events()
    print(f"📅 Found {len(events)} events")
    upsert_events(events)
    print("🎉 Done!")


if __name__ == "__main__":
    run()
