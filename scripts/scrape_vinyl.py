#!/usr/bin/env python3
import os
import re
import time
import json
from datetime import datetime, date, timedelta
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# ── Env & Supabase ─────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.")
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Constants ──────────────────────────────────────────────────────────────────
BASE_URL   = "https://www.tixr.com/groups/vinyl"
VENUE_NAME = "VINYL"
VENUE_SLUG = "vinyl"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "close",
    "Pragma": "no-cache",
    "Cache-Control": "no-cache",
}

EVENT_HREF_RX = re.compile(r"^https://www\.tixr\.com/groups/vinyl/events/[a-z0-9-]+-\d+$", re.I)
TIME_RX = re.compile(r"(\d{1,2})(?::(\d{2}))?\s*([AP]M)", re.I)
DATE_TIME_RX = re.compile(
    r"([A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}).*?(?:at\s*)?(\d{1,2}(?::\d{2})?\s*[AP]M)",
    re.I,
)
MONTHS = {m.lower(): i for i, m in enumerate(
    ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], start=1
)}

def slugify(text: str) -> str:
    s = (text or "").lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

# ── Fetch with 403 proxy fallback (preserve scheme) + retries ─────────────────
def fetch_html(url: str, timeout: int = 20, max_retries: int = 4) -> str | None:
    def _try(u: str, to: int) -> requests.Response:
        return requests.get(u, headers=HEADERS, timeout=to)

    backoffs = [0.5, 1.0, 2.0, 3.0]
    last_err = None
    for attempt in range(max_retries):
        try:
            r = _try(url, timeout)
            if r.status_code == 403:
                p = urlparse(url)
                prox = f"https://r.jina.ai/{p.scheme}://{p.netloc}{p.path}"
                if p.query:
                    prox += f"?{p.query}"
                r = _try(prox, timeout + 10)
            r.raise_for_status()
            return r.text
        except KeyboardInterrupt:
            raise
        except Exception as e:
            last_err = e
            time.sleep(backoffs[min(attempt, len(backoffs)-1)])
    print(f"⚠️  fetch_html failed {url}: {last_err}")
    return None

# ── Date & time parsing helpers ────────────────────────────────────────────────
def infer_year(month: int, day: int) -> int:
    """Pick this year, bump to next year if the date already passed by >60 days."""
    today = date.today()
    try:
        candidate = date(today.year, month, day)
    except Exception:
        return today.year
    if (today - candidate) > timedelta(days=60):
        return today.year + 1
    return today.year

def to_24h_time(token: str) -> str | None:
    m = TIME_RX.search(token or "")
    if not m:
        return None
    hh = int(m.group(1))
    mm = int(m.group(2) or 0)
    ampm = m.group(3).upper()
    if ampm == "PM" and hh != 12:
        hh += 12
    if ampm == "AM" and hh == 12:
        hh = 0
    return f"{hh:02d}:{mm:02d}:00"

def parse_date_time_block(txt: str) -> tuple[str | None, str | None]:
    """
    Accepts text like 'Fri Oct 17 at 6:00PM' or 'Sat Oct 11 at 10:00PM'
    Returns (start_date ISO, start_time 24h)
    """
    if not txt:
        return (None, None)
    m = DATE_TIME_RX.search(" ".join(txt.split()))
    if not m:
        # Try to at least get a time
        return (None, to_24h_time(txt))
    date_part = m.group(1)  # e.g., 'Fri Oct 17'
    time_part = m.group(2)  # e.g., '10:00PM'
    # Parse month/day
    try:
        _dow, mon_txt, day_txt = date_part.split()
        mon = MONTHS[mon_txt[:3].lower()]
        day = int(day_txt)
        yr = infer_year(mon, day)
        sd = date(yr, mon, day).isoformat()
    except Exception:
        sd = None
    st = to_24h_time(time_part)
    return (sd, st)

# ── HTML extraction from cards (desktop & mobile) ──────────────────────────────
def extract_card(a_tag: BeautifulSoup) -> dict | None:
    """
    Input: <a href="https://www.tixr.com/groups/vinyl/events/...">
           surrounding siblings contain .details, .name and a <p class="small footnote">...
    """
    href = a_tag.get("href")
    if not href or not EVENT_HREF_RX.match(href):
        return None

    # Name
    name_el = None
    parent = a_tag.parent or a_tag
    # Desktop: div.details > div.name
    name_el = parent.select_one(".details .name") or parent.select_one(".name")
    title = name_el.get_text(strip=True) if name_el else None
    if title and title.lower().endswith(" at vinyl"):
        title = title[:-9].strip()

    # Date & time (inside p.small.footnote or .details text)
    dt_text = ""
    foot = parent.select_one("p.small.footnote")
    if foot:
        dt_text = " ".join(foot.get_text(" ", strip=True).split())
    else:
        # Mobile alt structure
        det = parent.select_one(".details")
        if det:
            dt_text = " ".join(det.get_text(" ", strip=True).split())
    start_date, start_time = parse_date_time_block(dt_text)

    # Image from inline style background-image on .flyer (desktop) or .background (mobile)
    image = None
    flyer = parent.select_one(".flyer")
    if flyer and flyer.has_attr("style"):
        m = re.search(r"background-image:\s*url\('([^']+)'\)", flyer["style"])
        if m:
            image = m.group(1)
    if not image:
        bg = parent.select_one(".background[style*='background-image']")
        if bg and bg.has_attr("style"):
            m = re.search(r"background-image:\s*url\('([^']+)'\)", bg["style"])
            if m:
                image = m.group(1)

    # Build slug (stable on per-event page name)
    slug = slugify(title or href.rsplit("/", 1)[-1])

    return {
        "name":        title or "VINYL Event",
        "link":        href,
        "image":       image,
        "description": None,
        "start_date":  start_date,
        "end_date":    None,
        "start_time":  start_time,
        "end_time":    None,
        "slug":        slug,
    }

def parse_group_page(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []

    # First: any JSON-LD blocks with Event(s)
    for tag in soup.find_all("script", {"type": "application/ld+json"}):
        try:
            data = json.loads(tag.string or tag.text or "")
        except Exception:
            data = None
        if isinstance(data, dict) and isinstance(data.get("events"), list):
            for ev in data["events"]:
                if isinstance(ev, dict) and (ev.get("@type") or "").lower() in ("event", "musicevent"):
                    name = ev.get("name") or ev.get("headline")
                    url  = ev.get("url")
                    if not (name and url):
                        continue
                    image = ev.get("image")
                    if isinstance(image, list):
                        image = image[0] if image else None
                    sd = ed = st = et = None
                    if ev.get("startDate"):
                        dt = datetime.fromisoformat(ev["startDate"].replace("Z", "+00:00"))
                        sd, st = dt.date().isoformat(), dt.time().replace(microsecond=0).isoformat()
                    if ev.get("endDate"):
                        dt2 = datetime.fromisoformat(ev["endDate"].replace("Z", "+00:00"))
                        ed, et = dt2.date().isoformat(), dt2.time().replace(microsecond=0).isoformat()
                    rows.append({
                        "name": name,
                        "link": url,
                        "image": image,
                        "description": ev.get("description"),
                        "start_date": sd,
                        "end_date": ed,
                        "start_time": st,
                        "end_time": et,
                        "slug": slugify(name),
                    })

    # Then: HTML cards (desktop + mobile)
    for a in soup.find_all("a", href=True):
        if EVENT_HREF_RX.match(a["href"]):
            card = extract_card(a)
            if card:
                rows.append(card)

    # Deduplicate on link or slug
    dedup = {}
    for r in rows:
        key = r.get("link") or r.get("slug")
        if key and key not in dedup:
            dedup[key] = r
    return list(dedup.values())

# ── Supabase writes ────────────────────────────────────────────────────────────
def ensure_venue() -> int:
    row = sb.table("venues").select("id").eq("slug", VENUE_SLUG).limit(1).execute()
    if row.data:
        return row.data[0]["id"]
    ins = sb.table("venues").insert(
        {"name": VENUE_NAME, "slug": VENUE_SLUG},
        returning="representation"
    ).execute()
    return ins.data[0]["id"]

def upsert_events(events: list[dict]) -> None:
    venue_id = ensure_venue()
    for ev in events:
        print(f"⏳ Processing: {ev['name']}")
        rec = {
            "venue_id":    venue_id,
            "name":        ev["name"],
            "link":        ev["link"],
            "image":       ev.get("image"),
            "description": ev.get("description"),
            "start_date":  ev.get("start_date"),
            "end_date":    ev.get("end_date"),
            "start_time":  ev.get("start_time"),
            "end_time":    ev.get("end_time"),
            "slug":        ev["slug"],
            "source":      "vinyl",
        }
        # Idempotent on slug
        exists = sb.table("all_events").select("id").eq("slug", ev["slug"]).limit(1).execute()
        if exists.data:
            sb.table("all_events").update(rec).eq("id", exists.data[0]["id"]).execute()
            print(f"🔄 Updated: {ev['name']}")
        else:
            sb.table("all_events").insert(rec).execute()
            print(f"✅ Inserted: {ev['name']}")

# ── Main ───────────────────────────────────────────────────────────────────────
def fetch_events() -> list[dict]:
    html = fetch_html(BASE_URL, timeout=25)
    if not html:
        return []
    return parse_group_page(html)

def main():
    evs = fetch_events()
    print(f"🔎 Found {len(evs)} events")
    if evs:
        upsert_events(evs)

if __name__ == "__main__":
    main()
