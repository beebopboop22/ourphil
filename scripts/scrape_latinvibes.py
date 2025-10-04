#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Scrape Latin Vibes Group (Elementor) tiles and write into public.group_events.
Keeps ONLY Philadelphia events. We key off `.venuename` so we don't miss cards.

ENV:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY)

USAGE:
  python3 scripts/scrape_latinvibes.py
"""

import os
import re
from datetime import date
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError

# ── Static config ───────────────────────────────────────────────────────────────
GROUP_ID = "f778824e-a130-44fc-ad24-af0420bfd657"  # Latin Vibes Group
USER_ID  = "26f671a4-2f54-4377-9518-47c7f21663c7"
LISTING_URLS = [
    "https://latinvibesgroup.com/",
    "https://latinvibesgroup.com/events/",
]

# ── Env & Supabase ─────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.")
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── HTTP defaults (polite) ─────────────────────────────────────────────────────
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/114.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Connection": "close",
    "Pragma": "no-cache",
    "Cache-Control": "no-cache",
}

# ── Helpers ────────────────────────────────────────────────────────────────────
MONTHS = {
    "jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,
    "jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12
}
_slug_non_alnum = re.compile(r"[^a-z0-9]+")

def slugify(text: str) -> str:
    s = (text or "").lower().replace("&", " and ")
    s = _slug_non_alnum.sub("-", s)
    return s.strip("-")

def canon_link(u: str) -> str | None:
    if not u: return None
    p = urlparse(u)
    scheme = "https" if p.scheme in ("http","https") else p.scheme
    netloc = (p.netloc or "").lower()
    path = (p.path or "/").rstrip("/") or "/"
    return urlunparse((scheme, netloc, path, "", "", ""))

def absolute_img_src(img_tag, base: str) -> str | None:
    if not img_tag: return None
    src = img_tag.get("src") or img_tag.get("data-src")
    if not src: return None
    return src if src.startswith(("http://","https://")) else urljoin(base, src)

def fetch(url: str):
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()
        return BeautifulSoup(r.text, "html.parser")
    except Exception as e:
        print(f"⚠️  Fetch failed {url}: {e}")
        return None

def clean_text(html_text: str | None) -> str:
    t = (html_text or "").strip()
    t = re.sub(r"[ \t]+", " ", t)
    t = t.replace("\u2013", "-").replace("\u2014", "-")
    return t

def parse_time_token(token: str) -> tuple[int,int]:
    m = re.match(r"(\d{1,2}):(\d{2})\s*([ap]m)", token.strip(), re.I)
    if not m:
        raise ValueError(f"Unrecognized time '{token}'")
    hh = int(m.group(1)); mm = int(m.group(2)); ampm = m.group(3).lower()
    if ampm == "pm" and hh != 12: hh += 12
    if ampm == "am" and hh == 12: hh = 0
    return hh, mm

def parse_datetime_block(block: str) -> tuple[str|None, str|None, str|None, str|None]:
    """
    'Fri. Oct 3, 2025 at 10:00pm - Sat. Oct 4, 2025 at 2:00am EDT'
      → ('2025-10-03','2025-10-04','22:00','02:00')
    """
    txt = clean_text(block)
    parts = [p.strip() for p in re.split(r"\s*-\s*", txt) if p.strip()]
    if not parts: return (None, None, None, None)

    def parse_one(side: str) -> tuple[str|None, str|None]:
        m = re.search(
            r"(?P<mon>[A-Za-z]{3,})\s+(?P<day>\d{1,2}),\s*(?P<year>\d{4})\s+at\s+(?P<time>\d{1,2}:\d{2}\s*[ap]m)",
            side, re.I
        )
        if not m: return (None, None)
        mon = MONTHS.get(m.group("mon").lower()[:3]); day = int(m.group("day")); year = int(m.group("year"))
        try:
            dt = date(year, mon, day)
            hh, mm = parse_time_token(m.group("time"))
            return (dt.isoformat(), f"{hh:02d}:{mm:02d}")
        except Exception:
            return (None, None)

    s_date, s_time = parse_one(parts[0])
    e_date, e_time = (None, None)
    if len(parts) > 1: e_date, e_time = parse_one(parts[1])
    return (s_date, e_date, s_time, e_time)

# ── Philly-only filter ─────────────────────────────────────────────────────────
PHILLY_OK = re.compile(r"\b(philadelphia|phila)\b", re.I)
ZIP_191 = re.compile(r"\b191\d{2}(?:-\d{4})?\b")  # Philly ZIPs
NON_PHILLY_BLOCKLIST = re.compile(
    r"\b(NYC|New\s*York|Manhattan|Brooklyn|Queens|Bronx|NY\b|NJ\b|Delaware|DE\b|TX\b|Texas|MD\b|Maryland|DC\b|Washington\s*DC)\b",
    re.I
)

def is_philly_address(text: str) -> bool:
    """
    Keep if:
      - contains 'Philadelphia' or 'Phila' OR has a 191xx ZIP,
      - and does NOT contain obvious non-Philly markers (NYC/NJ/DE/TX/etc).
    """
    if not text: return False
    t = clean_text(text)
    if NON_PHILLY_BLOCKLIST.search(t):  # hard skip
        return False
    return bool(PHILLY_OK.search(t) or ZIP_191.search(t))

# ── Core scraping (venue-first) ────────────────────────────────────────────────
def extract_card_from_column(col, base_url: str) -> dict | None:
    # Title
    title_el = col.select_one(".elementor-widget-heading h1, .elementor-widget-heading .showtitle, h1.elementor-heading-title")
    title = clean_text(title_el.get_text(" ", strip=True)) if title_el else None
    if not title:
        return None

    # Date/time (look for a strong that has month + time)
    dt_el = None
    for cand in col.select(".elementor-widget-text-editor strong"):
        text = cand.get_text(" ", strip=True)
        if re.search(r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b.*\bat\b.*\d{1,2}:\d{2}", text, re.I):
            dt_el = cand
            break
    start_date = end_date = start_time = end_time = None
    if dt_el:
        start_date, end_date, start_time, end_time = parse_datetime_block(dt_el.get_text(" ", strip=True))

    # Address block: find <p> containing .venuename; join with <br> text
    addr_p = None
    for p in col.select(".elementor-widget-text-editor p"):
        if p.select_one(".venuename"):
            addr_p = p
            break
    venue = None
    address = None
    if addr_p:
        # Preserve line breaks: get_text with '\n', then pretty join
        raw = addr_p.get_text("\n", strip=True).replace(" ,", ",")
        parts = [s.strip() for s in raw.split("\n") if s.strip()]
        if parts:
            # e.g., "Brasil’s Nightclub," then "112 Chestnut Street" then "Philadelphia, PA 19106"
            if parts[0].endswith(","):
                venue = parts[0].rstrip(",").strip()
                address = ", ".join(parts[1:]) if len(parts) > 1 else None
            else:
                address = raw

    # Philly gate
    if not is_philly_address(address or ""):
        return None

    # Image
    img_tag = col.select_one(".elementor-widget-image img")
    image_url = absolute_img_src(img_tag, base_url)

    # Ticket link
    ticket_a = col.select_one(".elementor-widget-button a[href]")
    ticket_url = ticket_a.get("href").strip() if ticket_a else None

    # Slug
    slug_bits = [title]
    if start_date: slug_bits.append(start_date)
    slug = slugify("-".join([b for b in slug_bits if b]))

    desc_parts = []
    if venue: desc_parts.append(f"Venue: {venue}")
    if ticket_url: desc_parts.append(f"Tickets: {ticket_url}")
    description = " • ".join(desc_parts) if desc_parts else None

    return {
        "group_id": GROUP_ID,
        "title": title,
        "description": description,
        "address": address,
        "latitude": None,
        "longitude": None,
        "start_date": start_date,
        "end_date": end_date,
        "start_time": start_time,
        "end_time": end_time,
        "image_url": image_url,
        "slug": slug,
        "_link": canon_link(ticket_url) if ticket_url else None,
    }

def scrape_listing_page(url: str) -> list[dict]:
    soup = fetch(url)
    if not soup:
        return []

    rows = []
    seen_cols = 0
    # Go broad: any Elementor "top column" OR "column"
    for col in soup.select("div.elementor-top-column, div.elementor-column"):
        # only consider columns that actually contain a .venuename
        if not col.select_one(".venuename"):
            continue
        seen_cols += 1
        card = extract_card_from_column(col, url)
        if card:
            rows.append(card)

    print(f"• Scanned {seen_cols} venue columns on {url}; kept {len(rows)} Philadelphia cards")
    return rows

def scrape_all() -> list[dict]:
    all_rows = []
    for u in LISTING_URLS:
        all_rows.extend(scrape_listing_page(u))
    # de-dup within this run by link (if present) else slug
    dedup = {}
    for ev in all_rows:
        key = ev.get("_link") or ev["slug"]
        if key not in dedup:
            dedup[key] = ev
    return list(dedup.values())

# ── Manual upsert ──────────────────────────────────────────────────────────────
def upsert_group_events(rows: list[dict]) -> None:
    if not rows:
        print("No events to write.")
        return

    for ev in rows:
        payload = {
            "group_id": ev["group_id"],
            "user_id": USER_ID,              # REQUIRED (NOT NULL)
            "title": ev["title"],
            "description": ev.get("description"),
            "address": ev.get("address"),
            "latitude": ev.get("latitude"),
            "longitude": ev.get("longitude"),
            "start_date": ev.get("start_date"),
            "end_date": ev.get("end_date"),
            "start_time": ev.get("start_time"),
            "end_time": ev.get("end_time"),
            "image_url": ev.get("image_url"),
            "slug": ev.get("slug"),
        }

        try:
            sel = sb.table("group_events").select("id").eq("slug", payload["slug"]).execute()
            existing = sel.data if hasattr(sel, "data") else []
        except APIError as e:
            print(f"❌ Select failed for {payload['slug']}: {e}")
            existing = []

        if existing:
            gid = existing[0]["id"]
            try:
                sb.table("group_events").update(payload).eq("id", gid).execute()
                print(f"♻️  Updated: {payload['title']} ({payload['slug']})")
            except APIError as e:
                print(f"❌ Update failed for {payload['slug']}: {e}")
        else:
            try:
                sb.table("group_events").insert(payload).execute()
                print(f"➕ Inserted: {payload['title']} ({payload['slug']})")
            except APIError as e:
                print(f"❌ Insert failed for {payload['slug']}: {e}")

# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    rows = scrape_all()
    print(f"🔎 Found {len(rows)} Philadelphia events total")
    upsert_group_events(rows)
