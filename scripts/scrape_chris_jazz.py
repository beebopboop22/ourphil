#!/usr/bin/env python3
import os
import re
from datetime import datetime
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# ── Config ─────────────────────────────────────────────────────────────────────
SITE_BASE   = "https://www.chrisjazzcafe.com"
LISTING_URL = f"{SITE_BASE}/events"
SOURCE      = "chrisjazzcafe"
VENUE_NAME  = "Chris' Jazz Cafe"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; chrisjazzcafe-scraper/1.2; +events)",
    "Accept-Language": "en-US,en;q=0.9",
}

# ── Env / Supabase ─────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL / SUPABASE_KEY")
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Regex helpers ──────────────────────────────────────────────────────────────
RE_EVENT_DATE = re.compile(r"^\s*[A-Za-z]{3},\s*[A-Za-z]{3}\s+\d{1,2},\s*\d{4}\s*$")  # "Tue, Oct 7, 2025"
RE_TIME_AMP   = re.compile(r"\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b", re.I)       # "7", "7:30", with am/pm
RE_KEY_SENT   = re.compile(r"(set\s+times?|show\s+times?|starting\s+at)[:\s]+(.+?)$", re.I)

def slugify(text: str) -> str:
    s = (text or "").lower()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[-\s]+", "-", s).strip("-")
    return s

def to_24h(h: int, m: int, ap: str) -> str:
    ap = (ap or "").lower()
    if ap.startswith("p") and h != 12:
        h += 12
    if ap.startswith("a") and h == 12:
        h = 0
    return f"{h:02d}:{m:02d}:00"

def parse_amp_time(text: str) -> list[str]:
    """Return list of 'HH:MM:SS' from '7:30 PM', '9 PM', etc."""
    out = []
    for m in RE_TIME_AMP.finditer(text):
        hh = int(m.group(1))
        mm = int(m.group(2) or 0)
        ap = m.group(3)
        out.append(to_24h(hh, mm, ap))
    return out

def parse_loose_times_assume_pm(text: str) -> list[str]:
    """
    Handle things like 'Show times 7:30 & 9:30' (no am/pm) or 'Starting at 11'.
    We assume PM for jazz shows.
    """
    # Extract the sentence after our keywords and then look for numbers like 7, 7:30, 9:00
    m = RE_KEY_SENT.search(text)
    if not m:
        return []
    tail = m.group(2)
    times = []
    for t in re.finditer(r"\b(\d{1,2})(?::(\d{2}))?\b", tail):
        hh = int(t.group(1))
        mm = int(t.group(2) or 0)
        # Assume PM if not specified; handle 12 properly
        ap = "p"
        times.append(to_24h(hh, mm, ap))
    return times

def extract_date_from_text(s: str) -> str | None:
    """Parse 'Tue, Oct 7, 2025' -> 'YYYY-MM-DD'."""
    s = s.strip()
    if not RE_EVENT_DATE.match(s):
        return None
    try:
        dt = datetime.strptime(s, "%a, %b %d, %Y").date()
        return dt.isoformat()
    except ValueError:
        return None

# ── Scraper ───────────────────────────────────────────────────────────────────
def fetch_listing() -> BeautifulSoup:
    r = requests.get(LISTING_URL, headers=HEADERS, timeout=20)
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser")

def parse_card(card: BeautifulSoup) -> dict | None:
    # Title & link
    a = card.select_one("h3.el-header a")
    if not a or not a.get("href"):
        return None
    link = urljoin(SITE_BASE, a["href"].strip())
    title = a.get_text(strip=True)

    # Image
    img = card.select_one("div.el-image img")
    image = urljoin(SITE_BASE, img["src"]) if img and img.get("src") else None

    # Date (prefer the one in the times group)
    start_date = None
    date_h6 = card.select_one(".el-showtimes h6.event-date")
    if date_h6:
        parsed = extract_date_from_text(date_h6.get_text(" ", strip=True))
        if parsed:
            start_date = parsed

    # Times: first try buttons, then fall back to text
    times = []
    for btn in card.select(".event-times-list a.event-btn-inline"):
        ttxt = btn.get_text(" ", strip=True)
        times += parse_amp_time(ttxt)

    if not times:
        # try within description/text blocks
        raw_text = " ".join(card.get_text(" ", strip=True).split())
        times = parse_amp_time(raw_text)
        if not times:
            times = parse_loose_times_assume_pm(raw_text)

    # Pick earliest time if multiple
    start_time = sorted(times)[0] if times else None

    # Description (short)
    desc_el = card.select_one(".el-description")
    description = None
    if desc_el:
        txt = " ".join(desc_el.get_text(" ", strip=True).split())
        description = txt[:5000] if txt else None

    # Slug: prefer numeric id tail if present; else slugify title-date
    tail = a["href"].rstrip("/").split("/")[-1]
    slug = tail if tail.isdigit() else slugify(f"{title}-{start_date or ''}".strip("-"))

    return {
        "name":        title,
        "link":        link,
        "image":       image,
        "start_date":  start_date,
        "start_time":  start_time,
        "description": description,
        "slug":        slug,
        "source":      SOURCE,
    }

def scrape_events() -> list[dict]:
    soup = fetch_listing()
    cards = soup.select("div.event-list-item")
    events = []
    for c in cards:
        ev = parse_card(c)
        if ev:
            events.append(ev)
    return events

# ── Upsert ────────────────────────────────────────────────────────────────────
def ensure_venue(name: str) -> str | None:
    try:
        r = sb.table("venues").upsert({"name": name}, on_conflict=["name"], returning="representation").execute()
        return r.data[0]["id"] if r and r.data else None
    except Exception as e:
        print(f"⚠️ venue upsert failed: {e}")
        return None

def upsert_all_events(rows: list[dict]) -> None:
    if not rows:
        print("No events to upsert.")
        return
    venue_id = ensure_venue(VENUE_NAME)
    for ev in rows:
        rec = {
            "name":        ev["name"],
            "link":        ev["link"],
            "image":       ev.get("image"),
            "start_date":  ev.get("start_date"),
            "start_time":  ev.get("start_time"),
            "description": ev.get("description"),
            "venue_id":    venue_id,
            "source":      ev["source"],
            "slug":        ev["slug"],
        }
        try:
            sb.table("all_events").upsert(rec, on_conflict=["link"]).execute()
            print(f"✅ {rec['name']} | {rec.get('start_date')} {rec.get('start_time')}")
        except Exception as e:
            print(f"❌ upsert failed for {rec['name']}: {e}")

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    evs = scrape_events()
    print(f"🔎 Found {len(evs)} events")
    upsert_all_events(evs)
    print("🏁 Done.")
