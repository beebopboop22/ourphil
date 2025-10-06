#!/usr/bin/env python3
import os
import re
import html
import requests
from bs4 import BeautifulSoup
from datetime import datetime, date
from dotenv import load_dotenv
from supabase import create_client, Client
from typing import List, Dict, Optional, Tuple, Set

# ── Config ──────────────────────────────────────────────────────────────
LISTING_URL = "https://www.cherrystreetpier.com/events/"
VENUE_ID = 665
SOURCE = "cherrystreetpier"

TAGGINGS_TABLE = "taggings"
TAGGABLE_TYPE = "all_events"  # change to "events" if that's your convention

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; philly-events/1.1)",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Connection": "close",
}

# Your tags (slug -> id) exactly as provided
TAGS = {
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
    "fourthfriday": 14,
    "peco-multicultural": 21,
    "oktoberfest": 24,
    "birds": 25,
    "halloween": 26,
}

SEASONS = {
    "peco-multicultural": ("2025-06-14", "2025-09-25"),
    "oktoberfest": ("2025-09-07", "2025-10-20"),
    "birds": ("2025-08-07", "2026-02-14"),
    "halloween": ("2025-10-01", "2025-11-01"),
}

# ── Boot Supabase ───────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY")
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Helpers ─────────────────────────────────────────────────────────────
def slugify(text: str) -> str:
    s = (text or "").strip().lower()
    s = re.sub(r"&", " and ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def to_iso_time(h: int, m: int, ampm: Optional[str]) -> str:
    if ampm:
        ampm = ampm.lower()
        if ampm == "pm" and h < 12:
            h += 12
        if ampm == "am" and h == 12:
            h = 0
    return f"{h:02d}:{m:02d}:00"

def _parse_word_time(word: str) -> Optional[str]:
    w = word.strip().lower()
    if w in {"noon", "midday"}:
        return "12:00:00"
    if w in {"midnight"}:
        return "00:00:00"
    return None

TIME_SPANS = [
    re.compile(r"\btime\s*:\s*([0-9]{1,2})(?::([0-9]{2}))?\s*(am|pm)\s*(?:to|-|–|—)\s*([0-9]{1,2})(?::([0-9]{2}))?\s*(am|pm)\b", re.I),
    re.compile(r"\bfrom\s+([0-9]{1,2})(?::([0-9]{2}))?\s*(am|pm)\s*(?:to|-|–|—)\s*([0-9]{1,2})(?::([0-9]{2}))?\s*(am|pm)\b", re.I),
    re.compile(r"\b([0-9]{1,2})(?::([0-9]{2}))?\s*(am|pm)\s*[–—-]\s*([0-9]{1,2})(?::([0-9]{2}))?\s*(am|pm)\b", re.I),
]
SINGLE_TIMES = [
    re.compile(r"\btime\s*:\s*([0-9]{1,2})(?::([0-9]{2}))?\s*(am|pm)\b", re.I),
    re.compile(r"\bat\s+([0-9]{1,2})(?::([0-9]{2}))?\s*(am|pm)\b", re.I),
    re.compile(r"\bshow\s*:\s*([0-9]{1,2})(?::([0-9]{2}))?\s*(am|pm)\b", re.I),
]
WORD_SINGLE_TIMES = [
    re.compile(r"\btime\s*:\s*(noon|midnight)\b", re.I),
    re.compile(r"\bat\s*(noon|midnight)\b", re.I),
]

def parse_detail_times(text: str) -> Tuple[Optional[str], Optional[str]]:
    if not text:
        return None, None
    for rx in TIME_SPANS:
        m = rx.search(text)
        if m:
            h1, m1, ap1, h2, m2, ap2 = m.groups()
            h1, h2 = int(h1), int(h2)
            m1 = int(m1) if m1 else 0
            m2 = int(m2) if m2 else 0
            return to_iso_time(h1, m1, ap1), to_iso_time(h2, m2, ap2)
    for rx in WORD_SINGLE_TIMES:
        m = rx.search(text)
        if m:
            t = _parse_word_time(m.group(1))
            return (t, None) if t else (None, None)
    for rx in SINGLE_TIMES:
        m = rx.search(text)
        if m:
            h, mm, ap = m.groups()
            h = int(h); mm = int(mm) if mm else 0
            return to_iso_time(h, mm, ap), None
    m = re.search(r"\b([0-9]{1,2})(?::([0-9]{2}))?\s*(am|pm)\s*(?:to|-|–|—)\s*([0-9]{1,2})(?::([0-9]{2}))?\s*(am|pm)\b", text, re.I)
    if m:
        h1, m1, ap1, h2, m2, ap2 = m.groups()
        h1, h2 = int(h1), int(h2)
        m1 = int(m1) if m1 else 0
        m2 = int(m2) if m2 else 0
        return to_iso_time(h1, m1, ap1), to_iso_time(h2, m2, ap2)
    m = re.search(r"\b(noon|midnight)\b", text, re.I)
    if m:
        t = _parse_word_time(m.group(1))
        return (t, None) if t else (None, None)
    return None, None

def in_season(slug: str, dt: date) -> bool:
    ss, ee = SEASONS[slug]
    return ss <= dt.isoformat() <= ee

def classify_tags(name: str, description: Optional[str], link: str, page_text: str, start_date: Optional[str]) -> Set[int]:
    text = " ".join(filter(None, [name or "", description or "", link or "", page_text or ""]))
    text_l = html.unescape(text).lower()
    tag_ids: Set[int] = set()

    # Program/series
    if "peco multicultural series" in text_l or "part of the peco multicultural series" in text_l:
        tag_ids.add(TAGS["peco-multicultural"])

    if any(k in text_l for k in ["go birds", "eagles", "fly eagles fly"]):
        tag_ids.add(TAGS["birds"]); tag_ids.add(TAGS["sports"])

    if any(k in text_l for k in ["halloween", "spooky", "costume", "cosplay", "villain", "haunt", "trick-or-treat"]):
        tag_ids.add(TAGS["halloween"])

    if "oktoberfest" in text_l or "biergarten" in text_l or "lederhosen" in text_l:
        tag_ids.add(TAGS["oktoberfest"]); tag_ids.add(TAGS["nomnomslurp"])

    if "pride" in text_l or "lgbtq" in text_l or "queer" in text_l:
        tag_ids.add(TAGS["pride"])

    # Categories
    if any(k in text_l for k in ["market", "flea", "bazaar", "mercado", "vendors", "book fair", "bookfair"]):
        tag_ids.add(TAGS["markets"])
    if any(k in text_l for k in ["exhibition", "exhibit", "gallery", "installation", "artist", "film", "screening", "animation", "festival", "showcase", "photo", "photography"]):
        tag_ids.add(TAGS["arts"])
    if any(k in text_l for k in ["dj", "concert", "band", "live music", "soul series", "orchestra", "choir", "performance"]):
        tag_ids.add(TAGS["music"])
    if any(k in text_l for k in ["wine", "beer", "brew", "food", "drink", "cuisine", "tasting", "bratwurst", "food truck"]):
        tag_ids.add(TAGS["nomnomslurp"])
    if any(k in text_l for k in ["waterfront", "fireworks", "boat", "river", "pier party", "outdoors"]):
        tag_ids.add(TAGS["outdoors"])
    if any(k in text_l for k in ["family", "all ages", "kid-friendly", "kid friendly", "children", "youth"]):
        tag_ids.add(TAGS["family"])
    if any(k in text_l for k in ["kids", "child", "camp", "teen"]):
        tag_ids.add(TAGS["kids"]); tag_ids.add(TAGS["family"])
    if "walk around philadelphia" in text_l or any(k in text_l for k in ["5k", "run", "yoga", "fitness", "wellness walk", "wellness expo"]):
        tag_ids.add(TAGS["fitness"])
    if any(k in text_l for k in ["rally", "protest", "organizing", "organize", "mutual aid"]):
        tag_ids.add(TAGS["organize"])

    if start_date:
        try:
            d = datetime.strptime(start_date, "%Y-%m-%d").date()
        except Exception:
            d = None
        if d:
            if "peco multicultural series" in text_l and in_season("peco-multicultural", d):
                tag_ids.add(TAGS["peco-multicultural"])
            if ("oktoberfest" in text_l or "bier" in text_l) and in_season("oktoberfest", d):
                tag_ids.add(TAGS["oktoberfest"])
            if any(k in text_l for k in ["go birds", "eagles"]) and in_season("birds", d):
                tag_ids.add(TAGS["birds"])
            if any(k in text_l for k in ["halloween", "spooky", "cosplay", "villain"]) and in_season("halloween", d):
                tag_ids.add(TAGS["halloween"])

    return tag_ids

def parse_date_range(date_str: str) -> Tuple[Optional[str], Optional[str]]:
    s = re.sub(r"^\w+,\s*", "", (date_str or "").strip())
    parts = [p.strip() for p in s.split("–")]
    year = datetime.now().year
    try:
        if len(parts) == 2:
            start_raw, end_raw = parts
            sd = datetime.strptime(f"{start_raw}, {year}", "%B %d, %Y").date()
            if re.match(r"^[A-Za-z]+ \d{1,2}$", end_raw):
                ed = datetime.strptime(f"{end_raw}, {year}", "%B %d, %Y").date()
            else:
                month = start_raw.split()[0]
                ed = datetime.strptime(f"{month} {end_raw}, {year}", "%B %d, %Y").date()
            return sd.isoformat(), ed.isoformat()
        elif s:
            dt = datetime.strptime(f"{s}, {year}", "%B %d, %Y").date()
            return dt.isoformat(), dt.isoformat()
    except Exception:
        return None, None
    return None, None

# ── Scrape listing ──────────────────────────────────────────────────────
def fetch_listing() -> List[Dict]:
    r = requests.get(LISTING_URL, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    events = []
    cards = soup.select("div.card-event a.card-hit")
    for a in cards:
        link = a.get("href", "").strip()
        title_tag = a.select_one("h5.card-title")
        title = title_tag.get_text(strip=True) if title_tag else None

        date_tag = a.select_one("h6.card-subtitle")
        date_str = date_tag.get_text(strip=True) if date_tag else ""
        start_date, end_date = parse_date_range(date_str)

        thumb = a.select_one("div.card-thumb-inner")
        image = None
        if thumb and thumb.has_attr("style"):
            m = re.search(r"url\('(.+?)'\)", thumb["style"])
            if m:
                image = m.group(1)

        raw_slug = link.rstrip("/").split("/")[-1]
        slug = raw_slug if any(c.isalpha() for c in raw_slug) else slugify(title or raw_slug)

        events.append({
            "title": title,
            "link": link,
            "image": image,
            "start_date": start_date,
            "end_date": end_date,
            "slug": slug,
        })
    return events

# ── Detail fetch (times + page text for tagging) ────────────────────────
def fetch_detail_text(url: str) -> str:
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        return soup.get_text(" ", strip=True)
    except Exception:
        return ""

# ── DB helpers ─────────────────────────────────────────────────────────
def upsert_event(row: Dict) -> Optional[int]:
    res = sb.table("all_events").upsert(row, on_conflict=["link"], returning="representation").execute()
    if getattr(res, "error", None):
        print(f"❌ Upsert failed for {row.get('name')}: {res.error}")
        return None
    data = res.data[0] if res.data else None
    return data["id"] if data and "id" in data else None

def get_existing_tag_ids(event_id: int) -> Set[int]:
    res = (
        sb.table(TAGGINGS_TABLE)
        .select("tag_id")
        .eq("taggable_type", TAGGABLE_TYPE)
        .eq("taggable_id", str(event_id))
        .execute()
    )
    if getattr(res, "error", None) or not res.data:
        return set()
    return {row["tag_id"] for row in res.data}

def insert_missing_taggings(event_id: int, tag_ids: Set[int]) -> None:
    if not tag_ids:
        return
    existing = get_existing_tag_ids(event_id)
    to_add = sorted(t for t in tag_ids if t not in existing)
    if not to_add:
        return
    payload = [{"tag_id": t, "taggable_type": TAGGABLE_TYPE, "taggable_id": str(event_id)} for t in to_add]
    res = sb.table(TAGGINGS_TABLE).insert(payload).execute()
    if getattr(res, "error", None):
        print(f"⚠️  Taggings insert issue for event_id={event_id}: {res.error}")

# ── Main ───────────────────────────────────────────────────────────────
def main():
    print("🔎 Fetching Cherry Street Pier listing…")
    listing = fetch_listing()
    print(f"Found {len(listing)} cards")

    for it in listing:
        title = it["title"]
        link = it["link"]
        start_date = it["start_date"]
        end_date = it["end_date"]

        detail_text = ""
        start_time = None
        end_time = None
        if start_date and end_date and start_date == end_date:
            detail_text = fetch_detail_text(link)
            st, et = parse_detail_times(detail_text)
            start_time, end_time = st, et

        description = None
        tag_ids = classify_tags(title or "", description, link, detail_text, start_date)

        rec = {
            "name":        title,
            "link":        link,
            "image":       it["image"],
            "start_date":  start_date,
            "end_date":    end_date,
            "start_time":  start_time,
            "end_time":    end_time,
            "description": description,
            "venue_id":    VENUE_ID,
            "source":      SOURCE,
            "slug":        it["slug"],
        }

        print(f"⏳ Upserting: {title} [{start_date}{' '+(start_time or '') if start_time else ''}]")
        event_id = upsert_event(rec)
        if event_id:
            insert_missing_taggings(event_id, tag_ids)
            if tag_ids:
                print(f"   ↳ tags added (new only): {sorted(tag_ids)}")
        else:
            print("   ↳ skipped taggings (no event id)")

    print("✅ Done.")

if __name__ == "__main__":
    main()
