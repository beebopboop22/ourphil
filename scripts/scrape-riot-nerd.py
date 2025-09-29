#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Scrape Riot Nerd Philly (Wix) event listings and write into public.group_events.
No DB schema changes required. Manual upsert by slug. Uses fixed user_id.
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
GROUP_ID = "41bc9e93-7550-4519-80e0-0cfacfa06b68"           # Riot Nerd Philly group
USER_ID  = "26f671a4-2f54-4377-9518-47c7f21663c7"           # provided user_id (NOT NULL)
LISTING_URLS = [
    "https://www.riotnerdphilly.com/events",
    "https://www.riotnerdphilly.com/",
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
}

# ── Helpers ────────────────────────────────────────────────────────────────────
MONTH_LOOKUP = {"Jan":1,"Feb":2,"Mar":3,"Apr":4,"May":5,"Jun":6,"Jul":7,"Aug":8,"Sep":9,"Oct":10,"Nov":11,"Dec":12}
_slug_non_alnum = re.compile(r"[^a-z0-9]+")

def slugify(text: str) -> str:
    s = (text or "").lower().replace("&", " and ")
    s = _slug_non_alnum.sub("-", s)
    return s.strip("-")

def canon_link(u: str) -> str | None:
    if not u: return None
    p = urlparse(u)
    scheme = "https" if p.scheme in ("http","https") else p.scheme
    netloc = p.netloc.lower()
    path = (p.path or "/").rstrip("/") or "/"
    return urlunparse((scheme, netloc, path, "", "", ""))

def coerce_year_for_mmdd(month: int, day: int) -> int:
    today = date.today()
    candidate = date(today.year, month, day)
    return today.year + 1 if (candidate - today).days < -60 else today.year

def parse_short_date(text: str) -> str | None:
    m = re.search(r"([A-Za-z]{3})\s*,\s*([A-Za-z]{3})\s+(\d{1,2})", text or "")
    if not m: return None
    mon_abbr, day_ = m.group(2)[:3], int(m.group(3))
    month = MONTH_LOOKUP.get(mon_abbr)
    if not month: return None
    try:
        return date(coerce_year_for_mmdd(month, day_), month, day_).isoformat()
    except Exception:
        return None

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

# ── Scraper ────────────────────────────────────────────────────────────────────
def scrape_listing_page(url: str) -> list[dict]:
    soup = fetch(url)
    if not soup: return []
    events = []
    for li in soup.select('ul[data-hook="events-cards"] li[data-hook="events-card"]'):
        title_a = li.select_one('a[data-hook="title"]')
        if not title_a: continue
        title = title_a.get_text(strip=True)

        # link used only for in-run dedupe
        link = title_a.get("href", "").strip()
        if link and not link.startswith(("http://","https://")):
            link = urljoin(url, link)
        link = canon_link(link)

        short_date_el = li.select_one('[data-hook="short-date"]')
        start_date = parse_short_date(short_date_el.get_text(strip=True)) if short_date_el else None

        img_tag = li.select_one("wow-image img, img")
        image_url = absolute_img_src(img_tag, url)

        slug = slugify(f"{title}-{start_date or 'tbd'}")

        events.append({
            "group_id": GROUP_ID,
            "title": title,
            "description": None,
            "address": None,
            "latitude": None,
            "longitude": None,
            "start_date": start_date,
            "end_date": None,
            "start_time": None,
            "end_time": None,
            "image_url": image_url,
            "slug": slug,
            "_link": link,  # internal only
        })
    return events

def scrape_all() -> list[dict]:
    all_events = []
    for u in LISTING_URLS:
        all_events.extend(scrape_listing_page(u))
    # de-dup within this run by link (if present) else slug
    dedup = {}
    for ev in all_events:
        key = ev.get("_link") or ev["slug"]
        if key not in dedup:
            dedup[key] = ev
    return list(dedup.values())

# ── Manual upsert (no unique constraint needed) ────────────────────────────────
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

        # 1) Does a row with this slug already exist?
        try:
            sel = sb.table("group_events").select("id").eq("slug", payload["slug"]).execute()
            existing = sel.data if hasattr(sel, "data") else []
        except APIError as e:
            print(f"❌ Select failed for {payload['slug']}: {e}")
            existing = []

        if existing:
            # 2) UPDATE existing row by id
            gid = existing[0]["id"]
            try:
                sb.table("group_events").update(payload).eq("id", gid).execute()
                print(f"♻️  Updated: {payload['title']} ({payload['slug']})")
            except APIError as e:
                print(f"❌ Update failed for {payload['slug']}: {e}")
        else:
            # 3) INSERT new row
            try:
                sb.table("group_events").insert(payload).execute()
                print(f"➕ Inserted: {payload['title']} ({payload['slug']})")
            except APIError as e:
                print(f"❌ Insert failed for {payload['slug']}: {e}")

# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    events = scrape_all()
    print(f"🔎 Found {len(events)} Riot Nerd events")
    upsert_group_events(events)
