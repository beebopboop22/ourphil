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
BASE = "https://www.silkcityphilly.com"
LISTING_URL = f"{BASE}/events"
SOURCE = "silkcityphilly"
VENUE_NAME = "Silk City Diner"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; silkcity-scraper/1.2; +events)",
    "Accept-Language": "en-US,en;q=0.9",
}

# ── Env / Supabase ─────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Regex ──────────────────────────────────────────────────────────────────────
RE_DOT_DATE = re.compile(r"\b(\d{2})\.(\d{2})\.(\d{2})\b")  # MM.DD.YY (site format)
RE_SHOW     = re.compile(r"\bshow\s*[:\-]?\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b", re.I)
RE_DOORS    = re.compile(r"\bdoors?\s*[:\-]?\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b", re.I)
RE_ANY_TIME = re.compile(
    r"\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b", re.I
)  # matches "7:30 pm" (also "7 pm")

# ── Helpers ────────────────────────────────────────────────────────────────────
def slugify(text: str) -> str:
    s = (text or "").lower()
    s = re.sub(r"&", " and ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def to_iso_date_from_dots(mm: str, dd: str, yy: str) -> str | None:
    try:
        year = 2000 + int(yy)
        dt = datetime(year, int(mm), int(dd)).date()
        return dt.isoformat()
    except Exception:
        return None

def to_24h(h: int, m: int, ap: str) -> str:
    """Convert 12h + am/pm to 'HH:MM:SS' (am/pm may be 'a', 'am', with dots, any case)."""
    ap_token = (ap or "").strip().lower()
    if ap_token.startswith("p"):
        if h != 12:
            h += 12
    else:  # AM (or unknown -> treat as AM)
        if h == 12:
            h = 0
    return f"{h:02d}:{m:02d}:00"

def pick_time_from_text(text: str) -> str | None:
    """
    Priority:
      1) 'Show: 7:30 pm'
      2) First generic time NOT immediately marked as doors
      3) Fallback: first generic time
    """
    # 1) explicit "Show"
    m = RE_SHOW.search(text)
    if m:
        hh = int(m.group(1)); mm = int(m.group(2) or 0); ap = m.group(3)
        return to_24h(hh, mm, ap)

    # 2) scan times, skip those preceded by 'doors' within ~20 chars
    for t in RE_ANY_TIME.finditer(text):
        start_idx = t.start()
        window = text[max(0, start_idx - 24):start_idx].lower()
        if "door" in window:  # catches 'door' / 'doors'
            continue
        hh = int(t.group(1)); mm = int(t.group(2) or 0); ap = t.group(3)
        return to_24h(hh, mm, ap)

    return None

def extract_detail_datetime(soup: BeautifulSoup, current_date: str | None) -> tuple[str | None, str | None]:
    """
    Return (start_date, start_time).
    - Try to fill date from header line 'Fri • 10.19.25 • 8:00 pm' if missing.
    - Extract start_time using Show/Doors/generic rules.
    """
    text = soup.get_text(" ", strip=True)
    # Prefer 'Show:' time if present; otherwise the first non-doors time
    start_time = pick_time_from_text(text)

    # If date missing from listing, try to parse "MM.DD.YY" that appears near the header
    start_date = current_date
    if not start_date:
        m = RE_DOT_DATE.search(text)
        if m:
            start_date = to_iso_date_from_dots(*m.groups())

    return start_date, start_time

def abs_href(href: str) -> str:
    return urljoin(BASE, href)

# ── Scrape listing ────────────────────────────────────────────────────────────
def scrape_listing() -> list[dict]:
    r = requests.get(LISTING_URL, headers=HEADERS, timeout=20)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    events = []
    for a in soup.select("a.event"):
        link = abs_href(a.get("href", "").strip())
        title_tag = a.select_one(".red")
        title = title_tag.get_text(strip=True) if title_tag else None

        date_tag = a.select_one(".grey")
        start_date = None
        if date_tag:
            dm = RE_DOT_DATE.search(date_tag.get_text(" ", strip=True))
            if dm:
                start_date = to_iso_date_from_dots(*dm.groups())

        img_tag = a.select_one("img")
        image = abs_href(img_tag["src"]) if img_tag and img_tag.has_attr("src") else None

        raw = link.rstrip("/").split("/")[-1]
        slug = raw if any(c.isalpha() for c in raw) else slugify(title or raw)

        events.append({
            "title":      title,
            "link":       link,
            "image":      image,
            "start_date": start_date,
            "start_time": None,   # filled on detail
            "slug":       slug,
        })
    return events

# ── Enrich with detail page (time + fallback date + description) ──────────────
def enrich_from_detail(ev: dict) -> dict:
    try:
        r = requests.get(ev["link"], headers=HEADERS, timeout=20)
        if r.status_code != 200:
            return ev
        soup = BeautifulSoup(r.text, "html.parser")

        # Time + (optional) date
        start_date, start_time = extract_detail_datetime(soup, ev.get("start_date"))
        ev["start_date"] = start_date
        ev["start_time"] = start_time

        # Description: grab the main content column if present
        desc = None
        # Try a few common containers; keep it short-ish
        cand = soup.select_one("main") or soup.select_one("#content") or soup.select_one(".content") or soup.find("article")
        if cand:
            txt = " ".join(cand.get_text(" ", strip=True).split())
            desc = txt[:5000] if txt else None
        ev["description"] = desc
        return ev
    except requests.RequestException:
        return ev

# ── Upsert ────────────────────────────────────────────────────────────────────
def ensure_venue(name: str) -> str | None:
    try:
        res = sb.table("venues").upsert({"name": name}, on_conflict=["name"], returning="representation").execute()
        return res.data[0]["id"] if res and res.data else None
    except Exception:
        return None

def upsert_all_events(rows: list[dict]) -> None:
    if not rows:
        print("No events to upsert.")
        return

    venue_id = ensure_venue(VENUE_NAME)
    for ev in rows:
        rec = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev.get("image"),
            "start_date":  ev.get("start_date"),
            "start_time":  ev.get("start_time"),  # 'HH:MM:SS' or None
            "description": ev.get("description"),
            "venue_id":    venue_id,
            "source":      SOURCE,
            "slug":        ev.get("slug"),
        }
        try:
            sb.table("all_events").upsert(rec, on_conflict=["link"]).execute()
            print(f"✅ Upserted: {ev['title']} | {ev.get('start_date')} {ev.get('start_time')}")
        except Exception as e:
            print(f"❌ Upsert failed for {ev['title']}: {e}")

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    evs = scrape_listing()
    print(f"🔎 Found {len(evs)} events on listing")
    enriched = [enrich_from_detail(e) for e in evs]
    print(f"🧾 Ready to upsert {len(enriched)} Silk City events (with start_time when available)")
    upsert_all_events(enriched)
    print("🏁 Done.")
