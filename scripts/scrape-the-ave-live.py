#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/scrape-the-ave-live.py

Scrapes The AVE Live events by reading visible event cards from /calendar,
then enriches each via its Tixr event page (which provides reliable JSON-LD).

Writes to `all_events` (on_conflict: link). Ensures venue exists by slug.

ENV:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY)
"""

import os
import re
import json
import time
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

# ── Setup ──────────────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_URL   = "https://www.theavelive.com"
LIST_URL   = f"{BASE_URL}/calendar"
VENUE_NAME = "The AVE Live"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Connection": "close",
}

# ── Helpers ────────────────────────────────────────────────────────────────────
_slug_non_alnum = re.compile(r"[^a-z0-9]+")

def slugify(text: str) -> str:
    s = (text or "").lower().replace("&", " and ")
    s = _slug_non_alnum.sub("-", s)
    return s.strip("-")

def get_soup(url: str) -> BeautifulSoup | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()
        return BeautifulSoup(r.text, "html.parser")
    except Exception as e:
        print(f"⚠️  Fetch failed {url}: {e}")
        return None

def parse_card_time(text: str | None) -> str | None:
    if not text:
        return None
    s = text.strip().lower()
    m = re.match(r"^(\d{1,2})(?::(\d{2}))?\s*([ap]m)$", s)
    if not m:
        return None
    hh, mm = int(m.group(1)), int(m.group(2) or 0)
    ampm = m.group(3)
    if ampm == "pm" and hh != 12:
        hh += 12
    if ampm == "am" and hh == 12:
        hh = 0
    return f"{hh:02d}:{mm:02d}:00"

# ── Card scraping ──────────────────────────────────────────────────────────────
def harvest_cards(soup: BeautifulSoup) -> list[dict]:
    """
    Scrape the visible event cards on /calendar.
    Pulls date, time, image, and link to Tixr.
    """
    out = []
    for it in soup.select(".event-item.w-dyn-item"):
        a = it.select_one("a.ticket-links")
        if not a or not a.get("href"):
            continue
        link = a["href"]

        month_full_el = it.select_one(".date-info .custom-filter")
        day_el        = it.select_one(".date-info .month.day")
        time_el       = it.select_one(".date-info .month.day.time")

        month_full = month_full_el.get_text(strip=True) if month_full_el else ""
        day_txt    = day_el.get_text(strip=True) if day_el else ""
        time_txt   = time_el.get_text(strip=True) if time_el else ""

        start_date = None
        if month_full and day_txt.isdigit():
            try:
                today = datetime.today().date()
                year  = today.year
                mon = datetime.strptime(month_full[:3], "%b").month
                cand = datetime(year, mon, int(day_txt)).date()
                if cand < today:
                    cand = datetime(year + 1, mon, int(day_txt)).date()
                start_date = cand.isoformat()
            except Exception:
                pass

        start_time = parse_card_time(time_txt)

        image = None
        poster = it.select_one(".poster-art")
        if poster:
            style = poster.get("style", "")
            m = re.search(r'url\\([\'"]?(.*?)[\'"]?\\)', style)
            if m:
                image = m.group(1)

        out.append({
            "link": link,
            "start_date": start_date,
            "start_time": start_time,
            "image": image,
        })
    return out

# ── JSON-LD enrichment (Tixr) ──────────────────────────────────────────────────
def fetch_jsonld_from_url(url: str) -> dict | None:
    soup = get_soup(url)
    if not soup:
        return None
    objs = []
    for s in soup.select('script[type="application/ld+json"]'):
        try:
            data = json.loads(s.string or s.get_text(strip=True))
            if isinstance(data, list): objs.extend(data)
            elif isinstance(data, dict): objs.append(data)
        except Exception:
            continue

    for o in objs:
        t = o.get("@type")
        is_event = (isinstance(t, str) and t.lower().endswith("event")) or (
            isinstance(t, list) and any(str(x).lower().endswith("event") for x in t)
        )
        if not is_event:
            continue

        title = o.get("name")
        desc  = o.get("description")
        url2  = o.get("url") or url
        img   = o.get("image")
        if isinstance(img, list):
            img = img[0] if img else None

        start_date = None
        start_time = None
        dt = o.get("startDate") or o.get("start_date")
        if dt:
            try:
                dtx = datetime.fromisoformat(str(dt).replace("Z","+00:00"))
                start_date = dtx.date().isoformat()
                start_time = dtx.strftime("%H:%M:%S")
            except Exception:
                try:
                    d = datetime.strptime(dt.split(",")[0] + "," + dt.split(",")[1], "%b %d, %Y")
                    start_date = d.date().isoformat()
                except Exception:
                    pass

        address = None
        loc = o.get("location")
        if isinstance(loc, dict):
            addr = loc.get("address")
            if isinstance(addr, dict):
                parts = [addr.get("streetAddress"), addr.get("addressLocality"),
                         addr.get("addressRegion"), addr.get("postalCode")]
                address = ", ".join([p for p in parts if p]) or loc.get("name")

        return {
            "title": title,
            "description": desc,
            "link": url2,
            "image": img,
            "start_date": start_date,
            "start_time": start_time,
            "address": address,
        }
    return None

# ── Core scrape ────────────────────────────────────────────────────────────────
def scrape_shows() -> list[dict]:
    soup = get_soup(LIST_URL)
    if not soup:
        return []

    base = harvest_cards(soup)
    print(f"🔎 Found {len(base)} cards on /calendar")

    out = []
    for ev in base:
        detail = fetch_jsonld_from_url(ev["link"]) or {}
        merged = {
            "title": detail.get("title"),
            "link": ev["link"],
            "image": ev.get("image") or detail.get("image"),
            "start_date": ev.get("start_date") or detail.get("start_date"),
            "start_time": ev.get("start_time") or detail.get("start_time"),
            "description": detail.get("description"),
            "address": detail.get("address"),
        }
        tail = ev["link"].rstrip("/").split("/")[-1]
        tail = tail if (tail and not tail.isdigit()) else ""
        ymd  = (merged.get("start_date") or "").replace("-", "")
        slug = tail or slugify(f"the-ave-live-{merged.get('title','')}-{ymd}" if ymd else f"the-ave-live-{merged.get('title','')}")
        merged["slug"] = slug
        out.append(merged)
        time.sleep(0.25)
    dedup = {}
    for ev in out:
        k = ev["link"]
        if k not in dedup:
            dedup[k] = ev
    return list(dedup.values())

# ── Supabase upserts ───────────────────────────────────────────────────────────
def get_or_upsert_venue(name: str) -> int:
    slug = slugify(name)
    resp = sb.table("venues").upsert(
        {"name": name, "slug": slug},
        on_conflict=["slug"],
        returning="representation",
    ).execute()
    return resp.data[0]["id"]

def upsert_all_events(rows: list[dict]) -> None:
    venue_id = get_or_upsert_venue(VENUE_NAME)
    for ev in rows:
        rec = {
            "name": ev.get("title"),
            "link": ev.get("link"),
            "image": ev.get("image"),
            "start_date": ev.get("start_date"),
            "start_time": ev.get("start_time"),
            "description": ev.get("description"),
            "address": ev.get("address"),
            "venue_id": venue_id,
            "source": "theavelive",
            "slug": ev.get("slug"),
        }
        if not rec["start_date"]:
            print(f"⚠️  Skipping (no date): {rec['name']}")
            continue
        try:
            sb.table("all_events").upsert(rec, on_conflict=["link"]).execute()
            print(f"✅ Upserted: {rec['name']} ({rec['start_date']} {rec['start_time'] or ''})")
        except Exception as e:
            print(f"❌ Upsert failed for {rec['name']}: {e}")

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    rows = scrape_shows()
    print(f"🧾 Keeping {len(rows)} rows after dedup")
    if rows:
        upsert_all_events(rows)
    else:
        print("No rows to write.")
