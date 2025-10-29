#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Tattooed Mom (South St) — Event Scraper
- Source: The Events Calendar list pages
- Inserts/updates: public.all_events (on_conflict=["link"])
- Replaces polymorphic taggings per event in public.taggings
"""

import os
import re
import html
from datetime import datetime
from typing import List, Dict, Any, Optional

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# ──────────────────────────────────────────────────────────────────────────────
# ENV & SUPABASE
# ──────────────────────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/114.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
})

BASE = "https://www.tattooedmomphilly.com"
LIST_URL = f"{BASE}/events/"

# Venue constants (single address column in your schema)
VENUE_NAME = "Tattooed Mom"
VENUE_ADDRESS = "530 South Street, Philadelphia, PA 19147"
VENUE_LATITUDE = None   # fill in if you want, else stays None
VENUE_LONGITUDE = None  # fill in if you want, else stays None

TAGGABLE_TYPE = "all_events"

# Only use tags that already exist in DB
ALLOWED_TAG_NAMES = {
    "comedy",
    "arts",
    "music",
    "markets",
    "family",
    "kids",
    "theatre",
    "pride",
    "organize",
    "fitness",
    "literary",
    "poetry",
    "drag",
    "queer",
}

# Heuristic keyword → tag name mapping (applied only if tag exists)
KEYWORD_TAG_RULES = [
    (r"\bcomedy|stand[\s\-]?up|open mic\b", "comedy"),
    (r"\bpoetry|poet\b", "poetry"),
    (r"\bdrag|burlesque\b", "drag"),
    (r"\bvariety show|live performance\b", "arts"),
    (r"\bmusic|dj\b", "music"),
    (r"\bliterary|reading\b", "literary"),
    (r"\bmarket|vendor\b", "markets"),
    (r"\bfamily friendly|kid[s]?\b", "family"),
    (r"\btheatre|theater\b", "theatre"),
    (r"\bqueer|lgbt|lgbtq|sapphic\b", "pride"),
    (r"\bmixer|meetup|organizing|benefit\b", "organize"),
    (r"\bcraft|collage|art show|gallery\b", "arts"),
]

# The Events Calendar category class → tag name (if tag exists)
TEC_CLASS_TAG_MAP = {
    "tribe-events-category-comedy": "comedy",
    "tribe-events-category-live-performance": "arts",
    "tribe-events-category-literary-event": "literary",
}

# ──────────────────────────────────────────────────────────────────────────────
# UTILITIES
# ──────────────────────────────────────────────────────────────────────────────

def slugify(text: str) -> str:
    s = html.unescape(text).strip().lower()
    s = re.sub(r"[’'`]", "", s)
    s = re.sub(r"&", " and ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def to_time_iso(s: str) -> Optional[str]:
    s = s.strip()
    s = re.sub(r"\s*(am|pm)\s*$", r"\1", s, flags=re.I)
    try:
        t = datetime.strptime(s, "%I:%M%p").time()
        return t.isoformat()
    except ValueError:
        try:
            t = datetime.strptime(s, "%I%p").time()
            return t.isoformat()
        except ValueError:
            return None

def parse_date(text: str, year_hint: Optional[int] = None) -> Optional[str]:
    text = text.strip()
    if not text:
        return None
    if year_hint is None:
        year_hint = datetime.now().year
    for fmt in ("%B %d %Y", "%b %d %Y"):
        try:
            dt = datetime.strptime(f"{text} {year_hint}", fmt)
            return dt.date().isoformat()
        except ValueError:
            pass
    return None

def clean_text(html_fragment: str) -> str:
    soup = BeautifulSoup(html_fragment, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    txt = soup.get_text(separator="\n")
    txt = html.unescape(txt)
    txt = re.sub(r"\n\s*\n\s*\n+", "\n\n", txt)
    return txt.strip()

def trim_tmoms_footer(desc_text: str) -> str:
    if not desc_text:
        return desc_text
    markers = [
        "What’s Up at TMoms",
        "What's Up at TMoms",
        "What&#8217;s Up at TMoms",
        "What's Up at Tmoms",
        "What’s Up @ TMoms",
    ]
    low = desc_text.lower()
    for m in markers:
        pos = low.find(m.lower())
        if pos != -1:
            return desc_text[:pos].rstrip()
    return desc_text

def fetch(url: str) -> BeautifulSoup:
    r = SESSION.get(url, timeout=30)
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser")

# ──────────────────────────────────────────────────────────────────────────────
# TAGS
# ──────────────────────────────────────────────────────────────────────────────

def load_allowed_tags() -> Dict[str, int]:
    data = supabase.table("tags").select("id,name").execute().data or []
    allowed = {}
    target = {n.lower() for n in ALLOWED_TAG_NAMES}
    for row in data:
        nm = (row.get("name") or "").strip().lower()
        if nm in target:
            allowed[nm] = row["id"]
    print(f"✅ Loaded {len(allowed)} allowed tags (present in DB)")
    return allowed

def collect_tag_names_for_event(title: str, description: str, category_classes: List[str]) -> List[str]:
    t = f"{title}\n{description}".lower()
    found = set()
    for cls in category_classes:
        tag_name = TEC_CLASS_TAG_MAP.get(cls)
        if tag_name:
            found.add(tag_name)
    for pattern, tag_name in KEYWORD_TAG_RULES:
        if re.search(pattern, t, flags=re.I):
            found.add(tag_name)
    if re.search(r"\bmusic\b", t, flags=re.I):
        found.add("music")
    return sorted(found)

# ──────────────────────────────────────────────────────────────────────────────
# SUPABASE HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def get_or_create_venue_id() -> Optional[str]:
    """
    Upsert venue by name; your schema has:
      - name (unique)
      - address (single column)
      - latitude (optional)
      - longitude (optional)
    """
    payload = {
        "name": VENUE_NAME,
        "address": VENUE_ADDRESS,
    }
    if VENUE_LATITUDE is not None:
        payload["latitude"] = VENUE_LATITUDE
    if VENUE_LONGITUDE is not None:
        payload["longitude"] = VENUE_LONGITUDE

    r = supabase.table("venues").upsert(
        payload,
        on_conflict=["name"],
        returning="representation"
    ).execute()
    return r.data[0]["id"] if r.data else None

def reset_event_taggings(event_id: str | int, tag_ids: List[int]):
    ev_id = str(event_id)
    supabase.table("taggings") \
        .delete() \
        .eq("taggable_type", TAGGABLE_TYPE) \
        .eq("taggable_id", ev_id) \
        .execute()
    if not tag_ids:
        return
    rows = [{"taggable_type": TAGGABLE_TYPE, "taggable_id": ev_id, "tag_id": int(tid)} for tid in tag_ids]
    supabase.table("taggings").insert(rows).execute()

# ──────────────────────────────────────────────────────────────────────────────
# SCRAPE
# ──────────────────────────────────────────────────────────────────────────────

def parse_list_page(url: str) -> List[Dict[str, Any]]:
    soup = fetch(url)
    cards = soup.select("div.type-tribe_events")
    print(f"🧮 Unique event cards found: {len(cards)}")

    # Try to infer a year from any month header; fallback to current
    year_hint = datetime.now().year
    header = soup.select_one("h2.tribe-events-list-separator-month span")
    if header:
        m = re.search(r"(\d{4})", header.get_text(" ", strip=True))
        if m:
            year_hint = int(m.group(1))

    events = []
    for card in cards:
        classes = card.get("class", [])
        a = card.select_one("h2.tribe-events-list-event-title a.tribe-event-url")
        if not a:
            continue
        link = a.get("href", "").strip()
        title = html.unescape(a.get_text(" ", strip=True))

        img = card.select_one(".tribe-events-event-image img")
        image = img.get("src") if img and img.has_attr("src") else None

        meta = card.select_one(".tribe-event-schedule-details")
        date_start = date_end = time_start = time_end = None
        if meta:
            date_span = meta.select_one(".date")
            if date_span:
                s = date_span.select_one(".start")
                e = date_span.select_one(".end")
                if s:
                    date_start = parse_date(s.get_text(strip=True), year_hint=year_hint)
                if e:
                    date_end = parse_date(e.get_text(strip=True), year_hint=year_hint)
            time_span = meta.select_one(".time")
            if time_span:
                s = time_span.select_one(".start")
                e = time_span.select_one(".end")
                if s:
                    time_start = to_time_iso(s.get_text(strip=True))
                if e:
                    time_end = to_time_iso(e.get_text(strip=True))

        events.append({
            "title": title,
            "link": link,
            "image": image,
            "start_date": date_start,
            "end_date": date_end,
            "start_time": time_start,
            "end_time": time_end,
            "classes": classes,
        })
    return events

def parse_detail_description(url: str) -> str:
    soup = fetch(url)
    content = soup.select_one(".tribe-events-single-event-description") or soup.select_one(".tribe-events-content")
    if not content:
        content = soup.select_one("div.entry-content") or soup
    raw_html = str(content)
    text = clean_text(raw_html)
    return trim_tmoms_footer(text)

def dedupe_by_link(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen, out = set(), []
    for r in rows:
        key = r["link"]
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out

# ──────────────────────────────────────────────────────────────────────────────
# UPSERT
# ──────────────────────────────────────────────────────────────────────────────

def upsert_event(record: Dict[str, Any]) -> Optional[str]:
    resp = supabase.table("all_events") \
        .upsert(record, on_conflict=["link"], returning="representation") \
        .execute()
    if resp.data:
        return resp.data[0]["id"]
    return None

# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

def run():
    print("🔎 Scraping Tattooed Mom list…")
    list_rows = parse_list_page(LIST_URL)

    events = []
    for r in list_rows:
        try:
            desc = parse_detail_description(r["link"])
        except Exception as e:
            print(f"⚠️  Failed to fetch detail for {r['link']}: {e}")
            desc = None
        r["description"] = desc
        events.append(r)

    events = dedupe_by_link(events)
    print(f"✅ Parsed {len(events)} events")

    venue_id = get_or_create_venue_id()

    allowed = load_allowed_tags()  # {tag_name_lower: id}

    upserted = 0
    for ev in events:
        tag_names = collect_tag_names_for_event(
            title=ev["title"],
            description=ev.get("description") or "",
            category_classes=ev.get("classes", []),
        )
        tag_ids = [allowed[nm] for nm in (t.lower() for t in tag_names) if nm in allowed]

        record = {
            "name": ev["title"],
            "slug": slugify(ev["title"]),
            "link": ev["link"],
            "image": ev.get("image"),
            "description": ev.get("description"),
            "start_date": ev.get("start_date"),
            "end_date": ev.get("end_date"),
            "source": "tattooedmomphilly",
        }
        if ev.get("start_time"):
            record["start_time"] = ev["start_time"]
        if ev.get("end_time"):
            record["end_time"] = ev["end_time"]
        if venue_id:
            record["venue_id"] = venue_id

        event_id = upsert_event(record)
        if event_id:
            reset_event_taggings(event_id, tag_ids)
            upserted += 1
            print(f"⬆️  Upserted: {ev['title']} (id={event_id}) tags={tag_ids}")
        else:
            print(f"❌ Failed upsert: {ev['title']}")

    print(f"🎉 Done. Upserted {upserted}/{len(events)} events.")

if __name__ == "__main__":
    run()
