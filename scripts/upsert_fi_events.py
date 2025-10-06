#!/usr/bin/env python3
import os
import re
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

# ── Load environment variables (mirrors your working pattern) ───────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Constants ───────────────────────────────────────────────────────────
BASE_URL = "https://fi.edu"
LIST_URL = f"{BASE_URL}/en/events-calendar"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/114.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

VENUE_NAME = "The Franklin Institute"
SOURCE     = "franklininstitute"

# ── Helpers ─────────────────────────────────────────────────────────────
def slugify(text: str) -> str:
    slug = text.lower()
    slug = re.sub(r'&', ' and ', slug)
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    return slug.strip('-')

def _parse_date_str(s: str) -> str | None:
    s = s.strip()
    # Accept "Oct 10 2025", "Oct 10, 2025", "October 10 2025", "October 10, 2025"
    fmts = ["%b %d %Y", "%b %d, %Y", "%B %d %Y", "%B %d, %Y"]
    for f in fmts:
        try:
            return datetime.strptime(s, f).date().isoformat()
        except Exception:
            continue
    return None

_TIME_RE = re.compile(
    r"^\s*(?P<h>\d{1,2})(:(?P<m>\d{2}))?\s*(?P<ampm>[ap]\s*\.?\s*m\.?)?\s*$",
    re.IGNORECASE,
)

def _to_24h(h: int, m: int, ampm: str | None) -> str:
    if ampm:
        a = ampm.lower().replace(".", "").replace(" ", "")
        if a in ("pm",) and h != 12:
            h += 12
        if a in ("am",) and h == 12:
            h = 0
    return f"{h:02d}:{m:02d}:00"

def _parse_time_token(tok: str, fallback_ampm: str | None) -> tuple[str | None, str | None]:
    """Return (hh:mm:ss, ampm_used) from a token like '7:30', '7:30pm', '10am'."""
    tok = tok.strip()
    m = _TIME_RE.match(tok)
    if not m:
        return None, fallback_ampm
    h = int(m.group("h"))
    mm = int(m.group("m") or 0)
    ampm = m.group("ampm")
    if not ampm:
        ampm = fallback_ampm  # inherit from the other side if missing
    return _to_24h(h, mm, ampm), ampm

def _split_date_and_times(raw: str) -> tuple[str | None, str | None, str | None, str | None]:
    """
    Parses FI’s raw date/time text into (start_date, end_date, start_time, end_time).
    Handles:
      - 'Oct 10 2025 | 7:30 - 11:30pm'
      - 'Oct 10 2025 | 7:30pm - 11:30pm'
      - 'Oct 10 2025'
      - 'August 4, 2025 through August 8, 2025'
    """
    txt = " ".join(raw.split())  # collapse whitespace
    lower = txt.lower()
    # Normalize unicode dashes to hyphen
    txt = txt.replace("–", "-").replace("—", "-")
    if "through" in lower:
        left, right = re.split(r"\bthrough\b", txt, flags=re.IGNORECASE, maxsplit=1)
        sd = _parse_date_str(left.strip().rstrip("|").strip())
        ed = _parse_date_str(right.strip())
        return sd, ed, None, None

    # No range: maybe "date | times" or just "date"
    if "|" in txt:
        date_part, time_part = [p.strip() for p in txt.split("|", 1)]
    else:
        date_part, time_part = txt.strip(), ""

    sd = _parse_date_str(date_part)
    ed = sd  # single-day default

    st = et = None
    if time_part:
        # e.g. "7:30 - 11:30pm" or "7:30pm-11:30pm" or "10am - 2pm" or "7:30pm"
        time_part = time_part.replace("–", "-").replace("—", "-")
        if "-" in time_part:
            left_t, right_t = [p.strip() for p in time_part.split("-", 1)]
            # parse right first to capture am/pm for inheritance
            et, ampm = _parse_time_token(right_t, fallback_ampm=None)
            st, _ = _parse_time_token(left_t, fallback_ampm=ampm)
        else:
            st, _ = _parse_time_token(time_part, fallback_ampm=None)
    return sd, ed, st, et

# ── Scrape & parse events (mirrors your working flow) ───────────────────
def scrape_events():
    res = requests.get(LIST_URL, headers=HEADERS, timeout=30)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    events = []
    for row in soup.select(".view-events-calendar .views-row"):
        # Image
        img_tag = row.select_one(".views-field-field-hero-image img")
        image = None
        if img_tag and img_tag.get("src"):
            # join relative URLs
            image = requests.compat.urljoin(BASE_URL, img_tag["src"])

        # Raw date/time text
        dt_tag = row.select_one(".views-field-field-date-and-time .field-content")
        if not dt_tag:
            continue
        raw_dt = dt_tag.get_text(" ", strip=True)
        start_date, end_date, start_time, end_time = _split_date_and_times(raw_dt)
        if not start_date:
            continue  # must have at least a start date

        # Title + link
        a = row.select_one(".views-field-title a")
        if not a or not a.get("href"):
            continue
        title = a.get_text(strip=True)
        link  = requests.compat.urljoin(BASE_URL, a["href"])

        # Description
        desc_tag = row.select_one(".views-field-field-short-description .field-content")
        description = desc_tag.get_text(" ", strip=True) if desc_tag else None

        # Slug (prefer URL segment; if numeric, fallback to slugified title)
        raw_slug = a["href"].rstrip("/").split("/")[-1]
        final_slug = raw_slug if not raw_slug.isdigit() else slugify(title)

        events.append({
            "title":       title,
            "link":        link,
            "image":       image,
            "start_date":  start_date,
            "end_date":    end_date,
            "start_time":  start_time,
            "end_time":    end_time,
            "description": description,
            "venue_name":  VENUE_NAME,
            "slug":        final_slug,
        })
    return events

# ── Upsert into all_events (mirrors your working pattern) ───────────────
def upsert_data(events):
    for ev in events:
        print(f"⏳ Processing: {ev['title']}")

        # Upsert venue and get its ID
        v = (
            supabase.table("venues")
            .upsert({"name": ev["venue_name"]}, on_conflict=["name"], returning="representation")
            .execute()
        )
        venue_id = v.data[0]["id"] if v.data else None

        record = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "end_date":    ev["end_date"],
            "description": ev["description"],
            "venue_id":    venue_id,
            "source":      SOURCE,
            "slug":        ev["slug"],
        }
        if ev["start_time"]:
            record["start_time"] = ev["start_time"]
        if ev["end_time"]:
            record["end_time"]   = ev["end_time"]

        supabase.table("all_events").upsert(record, on_conflict=["link"]).execute()
        print(f"✅ Upserted: {ev['title']}")

# ── Main ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"Scraping {LIST_URL}")
    events = scrape_events()
    print(f"🔎 Found {len(events)} events")
    if events:
        upsert_data(events)
