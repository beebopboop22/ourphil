#!/usr/bin/env python3
import os
import re
import html
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

# ── Config ─────────────────────────────────────────────────────────────────────
LISTING_URL = "https://wowphilly.com/events/"
SOURCE = "wowphilly"
VENUE_NAME = "Warehouse on Watts"     # force all events to this venue
TIMEOUT = 15
MAX_WORKERS = 8
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; wow-scraper/1.1; +events)",
    "Accept-Language": "en-US,en;q=0.9",
}

# ── Env / Supabase ─────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── HTTP session with retries ──────────────────────────────────────────────────
def make_session() -> requests.Session:
    sess = requests.Session()
    retry = Retry(
        total=4,
        connect=4,
        read=4,
        backoff_factor=0.7,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET", "HEAD"]),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=20, pool_maxsize=20)
    sess.mount("http://", adapter)
    sess.mount("https://", adapter)
    sess.headers.update(HEADERS)
    return sess

SESSION = make_session()

# ── Helpers ────────────────────────────────────────────────────────────────────
def slugify(text: str) -> str:
    s = html.unescape(text or "").lower()
    s = re.sub(r"&", " and ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

MONTHS = {m.lower(): i for i, m in enumerate(
    ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], start=1
)}

def parse_list_date(text: str) -> str | None:
    # examples: "Wed, Oct 01", "Thu, Oct 02"
    t = (text or "").strip().replace("\xa0", " ")
    m = re.search(r"[A-Za-z]{3},\s*([A-Za-z]{3})\s+(\d{1,2})", t)
    if not m:
        return None
    mon_abbr = m.group(1)[:3].lower()
    day = int(m.group(2))
    month = MONTHS.get(mon_abbr)
    if not month:
        return None
    today = datetime.now().date()
    year = today.year
    try:
        dt = datetime(year, month, day).date()
        if dt < today:
            dt = datetime(year + 1, month, day).date()
        return dt.isoformat()
    except ValueError:
        return None

# Only accept "show/start" times as start_time; if only "doors", leave None
TIME_PATTERNS_SHOW = [
    r"(?:show|start)\s*[:\-]?\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?",
    r"(?:show|start)\s*@\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?",
]

def to_24h(h: int, m: int, ap: str) -> str:
    ap = ap.lower()
    if h == 12:
        h = 0
    if ap == "p":
        h += 12
    return f"{h:02d}:{m:02d}:00"

def extract_start_time_guaranteed(soup: BeautifulSoup) -> str | None:
    text = soup.get_text(" ", strip=True).lower()
    for pat in TIME_PATTERNS_SHOW:
        m = re.search(pat, text)
        if m:
            hh = int(m.group(1))
            mm = int(m.group(2) or 0)
            ap = m.group(3)
            return to_24h(hh, mm, ap)
    return None

def safe_get(url: str) -> requests.Response | None:
    try:
        r = SESSION.get(url, timeout=TIMEOUT)
        if r.status_code == 200 and r.text:
            return r
        return None
    except requests.RequestException:
        return None

# ── Listing scrape ─────────────────────────────────────────────────────────────
def scrape_listing() -> list[dict]:
    print(f"🔗 Using listing: {LISTING_URL}")
    r = safe_get(LISTING_URL)
    if not r:
        print("❌ Failed to get listing page.")
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    cards = soup.select(".rhp-event-series .rhpSingleEvent")
    print(f"🔎 Found {len(cards)} WOW cards (raw)")

    events = []
    for card in cards:
        a = card.select_one("a.url")
        if not a or not a.has_attr("href"):
            continue
        link = a["href"].strip()

        # title
        title = (a.get("title") or a.get_text(strip=True) or "").strip()

        # image
        img = card.select_one(".rhp-events-event-image img")
        image = img["src"].strip() if img and img.has_attr("src") else None

        # date text (e.g., "Wed, Oct 01")
        date_div = card.select_one(".eventDateList.BelowImage .singleEventDate")
        start_date = parse_list_date(date_div.get_text()) if date_div else None

        events.append({
            "title": title,
            "link": link,
            "image": image,
            "start_date": start_date,
        })

    # de-dup by link
    seen = {}
    for ev in events:
        if ev["link"] not in seen:
            seen[ev["link"]] = ev
    dedup = list(seen.values())
    print(f"🧹 After de-dup by link: {len(dedup)}")
    return dedup

# ── Detail fetch ───────────────────────────────────────────────────────────────
def enrich_event(ev: dict) -> dict:
    r = safe_get(ev["link"])
    if not r:
        ev["start_time"] = None
        ev["description"] = None
    else:
        soup = BeautifulSoup(r.text, "html.parser")
        ev["start_time"] = extract_start_time_guaranteed(soup)
        desc = soup.select_one(".rhp-event-info") or soup.find("article")
        if desc:
            txt = " ".join(desc.get_text(" ", strip=True).split())
            ev["description"] = txt[:5000]
        else:
            ev["description"] = None
    # build a clean slug from title + start_date (never the URL tail)
    base = ev["title"] or "event"
    if ev.get("start_date"):
        ev["slug"] = slugify(f"{base}-{ev['start_date']}")
    else:
        ev["slug"] = slugify(base)
    return ev

def enrich_all(events: list[dict]) -> list[dict]:
    total = len(events)
    if total == 0:
        return []
    print(f"🌐 Fetching {total} detail pages (concurrent, timeout={TIMEOUT}s)...")
    out = []
    done = 0
    last = time.time()
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futs = {ex.submit(enrich_event, ev): ev for ev in events}
        for fut in as_completed(futs):
            try:
                out.append(fut.result())
            except Exception:
                pass
            done += 1
            now = time.time()
            if now - last >= 1.0 or done == total:
                print(f"   … {done}/{total} done")
                last = now
    return out

# ── Venue ensure ───────────────────────────────────────────────────────────────
def ensure_venue(name: str) -> str | None:
    try:
        res = sb.table("venues").upsert({"name": name}, on_conflict=["name"], returning="representation").execute()
        if res.data:
            return res.data[0]["id"]
    except Exception as e:
        print(f"⚠️ Could not upsert venue '{name}': {e}")
    return None

# ── Upsert to all_events ──────────────────────────────────────────────────────
def upsert_all_events(rows: list[dict]) -> None:
    if not rows:
        print("No valid events to upsert.")
        return

    venue_id = ensure_venue(VENUE_NAME) if not DRY_RUN else None

    for ev in rows:
        rec = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev.get("image"),
            "start_date":  ev.get("start_date"),
            "start_time":  ev.get("start_time"),  # may be None
            "description": ev.get("description"),
            "venue_id":    venue_id,
            "source":      SOURCE,
            "slug":        ev.get("slug"),
        }
        if DRY_RUN:
            print(f"🧪 DRY RUN — would upsert: {rec['name']} | slug={rec['slug']} | venue={VENUE_NAME}")
            continue

        try:
            res = sb.table("all_events").upsert(rec, on_conflict=["link"]).execute()
            if getattr(res, "error", None):
                print(f"❌ Upsert failed for {ev['title']}: {res.error}")
            else:
                print(f"✅ Upserted: {ev['title']} ({rec['slug']})")
        except Exception as e:
            print(f"❌ Exception upserting {ev['title']}: {e}")

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    events = scrape_listing()
    if not events:
        raise SystemExit(0)
    enriched = enrich_all(events)
    print(f"🧾 Ready to upsert {len(enriched)} events to all_events "
          f"(start_time only when Show/Start found; venue='{VENUE_NAME}').")
    upsert_all_events(enriched)
    print("🏁 Done.")
