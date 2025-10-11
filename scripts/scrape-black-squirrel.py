#!/usr/bin/env python3
import os
import re
from datetime import date, datetime
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError

# ── Static config ───────────────────────────────────────────────────────────────
GROUP_ID = "2874ddaa-7c44-4c47-bcb1-77b4283e4da7"  # Black Squirrel Club
USER_ID = "26f671a4-2f54-4377-9518-47c7f21663c7"   # same user as others
LISTING_URL = "https://blacksquirrelclub.com/"

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
    "Cache-Control": "no-cache",
}

# ── Helpers ────────────────────────────────────────────────────────────────────
MONTHS = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "SEPT": 9, "OCT": 10, "NOV": 11, "DEC": 12
}
_slug_non_alnum = re.compile(r"[^a-z0-9]+")

def slugify(text: str) -> str:
    s = (text or "").lower().replace("&", " and ")
    s = _slug_non_alnum.sub("-", s)
    return s.strip("-")

def canon_link(u: str) -> str | None:
    if not u:
        return None
    p = urlparse(u)
    scheme = "https" if p.scheme in ("http", "https") else p.scheme
    netloc = p.netloc.lower()
    path = (p.path or "/").rstrip("/") or "/"
    return urlunparse((scheme, netloc, path, "", "", ""))

def fetch(url: str) -> BeautifulSoup | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()
        return BeautifulSoup(r.text, "html.parser")
    except Exception as e:
        print(f"⚠️  Fetch failed {url}: {e}")
        return None

def coerce_year(month: int, day: int, explicit_year: int | None = None) -> int:
    if explicit_year:
        return explicit_year
    today = date.today()
    try:
        candidate = date(today.year, month, day)
    except Exception:
        return today.year
    # If the date this year is >60 days in the past, assume it's next year
    return today.year + 1 if (today - candidate).days > 60 else today.year

_time_re = re.compile(r"(\d{1,2})(?::(\d{2}))?\s*([AP]M)", re.I)
def parse_time_12h(t: str) -> str | None:
    if not t:
        return None
    m = _time_re.search(t)
    if not m:
        return None
    hour = int(m.group(1))
    minute = int(m.group(2) or 0)
    ampm = m.group(3).upper()
    if ampm == "PM" and hour != 12:
        hour += 12
    if ampm == "AM" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}:00"

def parse_time_range(text: str) -> tuple[str | None, str | None]:
    if not text:
        return (None, None)
    parts = re.split(r"\s*[-–]\s*", text.strip())
    start = parse_time_12h(parts[0]) if parts else None
    end = parse_time_12h(parts[1]) if len(parts) > 1 else None
    return (start, end)

_year_in_url_re = re.compile(r"(20\d{2})")
_md_in_url_re = re.compile(r"/([A-Za-z]{3,})-(\d{1,2})-(20\d{2})", re.I)  # .../Oct-05-2025...

def year_from_href(href: str) -> int | None:
    if not href:
        return None
    mdy = _md_in_url_re.search(href)
    if mdy:
        try:
            return int(mdy.group(3))
        except Exception:
            pass
    y = _year_in_url_re.search(href)
    return int(y.group(1)) if y else None

def parse_month_day(block_text: str) -> tuple[int | None, int | None]:
    if not block_text:
        return (None, None)
    txt = " ".join(block_text.split())
    m = re.search(r"\b([A-Z]{3,})\b\s+(\d{1,2})\b", txt)
    if not m:
        return (None, None)
    mon = MONTHS.get(m.group(1).upper())
    day = int(m.group(2))
    return (mon, day)

# ── Tagging helpers ────────────────────────────────────────────────────────────
def get_music_tag_id() -> int | None:
    """Fetch the ID of the Music tag (prefer slug='music')."""
    try:
        got = sb.table("tags").select("id,name,slug").eq("slug", "music").execute()
        if got.data:
            return got.data[0]["id"]
        got2 = sb.table("tags").select("id,name,slug").eq("name", "Music").execute()
        if got2.data:
            return got2.data[0]["id"]
    except APIError as e:
        print(f"⚠️  Could not fetch Music tag id: {e}")
    return None

def ensure_music_tagging(event_id: str, tag_id: int) -> None:
    """Create taggings row if not already present."""
    try:
        existing = (
            sb.table("taggings")
            .select("id")
            .eq("tag_id", tag_id)
            .eq("taggable_type", "group_events")
            .eq("taggable_id", str(event_id))
            .execute()
        )
        if existing.data:
            print("🏷️  Already tagged: Music")
            return
        sb.table("taggings").insert({
            "tag_id": tag_id,
            "taggable_type": "group_events",
            "taggable_id": str(event_id),
        }).execute()
        print("🏷️  Tagged with Music")
    except APIError as e:
        print(f"⚠️  Tagging failed (Music): {e}")

# ── Scraper ────────────────────────────────────────────────────────────────────
def scrape() -> list[dict]:
    soup = fetch(LISTING_URL)
    if not soup:
        return []

    rows = []
    for card in soup.select(".event-card"):
        # image
        img = None
        img_tag = card.select_one(".event-image img")
        if img_tag:
            img = img_tag.get("src") or None

        # date (month/day, weekday is noise)
        date_div = card.select_one(".event-date")
        mon, day = parse_month_day(date_div.get_text(" ", strip=True) if date_div else "")

        # title
        title_el = card.select_one(".event-details h3")
        title = (title_el.get_text(strip=True) if title_el else "Event").strip()

        # time range (first <p> is time block)
        time_el = card.select_one(".event-details p")
        time_text = time_el.get_text(strip=True) if time_el else None
        start_time, end_time = parse_time_range(time_text or "")

        # description (optional)
        desc_el = card.select_one(".event-details .event-description")
        description = (desc_el.get_text(" ", strip=True) if desc_el else None)

        # link (Ticketleap, etc.)
        link_el = card.select_one(".event-details a.ticket-button")
        href = link_el.get("href").strip() if link_el and link_el.get("href") else None
        full_href = href if (href or "").startswith(("http://", "https://")) else urljoin(LISTING_URL, href or "")

        # year: try URL, else infer
        explicit_year = year_from_href(full_href or "")
        if mon and day:
            year = coerce_year(mon, day, explicit_year)
            try:
                start_date = date(year, mon, day).isoformat()
            except Exception:
                start_date = None
        else:
            start_date = None

        end_date = start_date  # single-day cards

        # slug
        suffix = (href or "")[-8:].lower().replace("/", "")
        ymd = start_date or "tbd"
        slug = slugify(f"black-squirrel-club-{title}-{ymd}-{suffix}")

        rows.append({
            "group_id": GROUP_ID,
            "title": title,
            "description": description,
            "address": None,
            "latitude": None,
            "longitude": None,
            "start_date": start_date,
            "end_date": end_date,
            "start_time": start_time,
            "end_time": end_time,
            "image_url": img,
            "slug": slug,
            "_link": canon_link(full_href),
        })

    # de-dup within this run by link (if present) else slug
    dedup = {}
    for ev in rows:
        key = ev.get("_link") or ev["slug"]
        if key not in dedup:
            dedup[key] = ev
    return list(dedup.values())

# ── Manual upsert + Music tagging ──────────────────────────────────────────────
def upsert_group_events(rows: list[dict]) -> None:
    if not rows:
        print("No events to write.")
        return

    music_tag_id = get_music_tag_id()
    if not music_tag_id:
        print("⚠️  Skipping tagging: could not resolve 'Music' tag id.")

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

        gid = None
        try:
            sel = sb.table("group_events").select("id").eq("slug", payload["slug"]).execute()
            existing = sel.data if hasattr(sel, "data") else []
        except APIError as e:
            print(f"❌ Select failed for {payload['slug']}: {e}")
            existing = []

        if existing:
            gid = existing[0]["id"]
            try:
                # return updated row (works across client versions)
                sb.table("group_events") \
                  .update(payload, returning="representation") \
                  .eq("id", gid) \
                  .execute()
                print(f"♻️  Updated: {payload['title']} ({payload['slug']})")
            except APIError as e:
                print(f"❌ Update failed for {payload['slug']}: {e}")
        else:
            try:
                # insert and return row (get id)
                ins = sb.table("group_events") \
                        .insert(payload, returning="representation") \
                        .execute()
                if ins.data:
                    gid = ins.data[0]["id"]
                print(f"➕ Inserted: {payload['title']} ({payload['slug']})")
            except APIError as e:
                print(f"❌ Insert failed for {payload['slug']}: {e}")

        # Always ensure Music tagging, if we have both pieces
        if music_tag_id and gid:
            ensure_music_tagging(gid, music_tag_id)

# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    rows = scrape()
    print(f"🔎 Found {len(rows)} Black Squirrel Club events")
    upsert_group_events(rows)
