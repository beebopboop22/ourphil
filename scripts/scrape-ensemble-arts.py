#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import time
from datetime import datetime, date, timedelta
from typing import Optional

from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# Selenium (headless Chrome)
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

LIST_URL = "https://www.ensembleartsphilly.org/tickets-and-events/events"
VENUE_SLUG = "kimmel-center"
DEFAULT_IMAGE = os.getenv(
    "KIMMEL_DEFAULT_IMAGE",
    "https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/kimmel-cen.jpg",
)

# ── Env & Supabase ─────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.")
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Helpers ────────────────────────────────────────────────────────────────────
MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12
}
DATE_TOKEN_RE = re.compile(
    r"(?P<mon>(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December))"
    r"\s+(?P<day>\d{1,2})(?:\s*[–\-]\s*\d{1,2})?(?:,\s*(?P<year>\d{4}))?",
    re.I,
)

def month_to_int(mon_str: str) -> Optional[int]:
    k = mon_str.strip().lower()
    k = k[:4] if k.startswith(("sept",)) else k[:3]
    return MONTHS.get(k)

def infer_year(m: int, d: int, explicit_year: Optional[int]) -> int:
    if explicit_year:
        return explicit_year
    today = date.today()
    try:
        candidate = date(today.year, m, d)
    except ValueError:
        return today.year
    return today.year + 1 if candidate < (today - timedelta(days=3)) else today.year

def parse_first_date(text: str) -> Optional[str]:
    if not text:
        return None
    m = DATE_TOKEN_RE.search(text)
    if not m:
        return None
    mon = month_to_int(m.group("mon"))
    day = int(m.group("day"))
    yr = int(m.group("year")) if m.group("year") else None
    if not mon:
        return None
    try:
        return date(infer_year(mon, day, yr), mon, day).isoformat()
    except ValueError:
        return None

def normalize_space(s: Optional[str]) -> Optional[str]:
    if s is None: return None
    return re.sub(r"\s+", " ", s).strip()

def slugify(text: str) -> str:
    s = (text or "").lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def first_src_from_srcset(srcset: str) -> Optional[str]:
    """
    Takes a srcset and returns the first URL before any width descriptor.
    """
    if not srcset:
        return None
    # split by comma, take first candidate, then take the first token (URL)
    first = srcset.split(",")[0].strip()
    url = first.split()[0] if first else None
    return url

def extract_card_image(card: BeautifulSoup) -> str:
    """
    Prefer the card image rendered on the grid (img.event-item__image).
    Fallback to DEFAULT_IMAGE if missing.
    """
    img = card.select_one("img.event-item__image")
    if img:
        if img.has_attr("src"):
            return img["src"]
        if img.has_attr("srcset"):
            u = first_src_from_srcset(img["srcset"])
            if u:
                return u
    return DEFAULT_IMAGE

def find_venue_id() -> Optional[int]:
    try:
        q = sb.table("venues").select("id").eq("slug", VENUE_SLUG).limit(1).execute()
        if q.data:
            return q.data[0]["id"]
        q2 = sb.table("venues").select("id").eq("name", "Kimmel Center").limit(1).execute()
        return q2.data[0]["id"] if q2.data else None
    except Exception as e:
        print(f"⚠️  Venue lookup failed: {e}")
        return None

# ── Selenium ───────────────────────────────────────────────────────────────────
def build_driver() -> webdriver.Chrome:
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1400,1600")
    opts.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/122.0.0.0 Safari/537.36")
    return webdriver.Chrome(options=opts)

def scrape_events() -> list[dict]:
    driver = build_driver()
    try:
        driver.get(LIST_URL)
        WebDriverWait(driver, 25).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".events-grid__item a.event-item"))
        )
        # Scroll to load more results
        for _ in range(8):
            driver.execute_script("window.scrollBy(0, 2000);")
            time.sleep(0.8)
        html = driver.page_source
    finally:
        driver.quit()

    soup = BeautifulSoup(html, "html.parser")
    rows = []

    for card in soup.select(".events-grid__item a.event-item"):
        href = card.get("href") or ""
        link = "https://www.ensembleartsphilly.org" + href if href.startswith("/") else href

        title_el = card.select_one(".event-item__title")
        title = normalize_space(title_el.get_text(" ", strip=True) if title_el else "")
        if not title:
            continue

        date_el = card.select_one(".event-item__date")
        date_text = normalize_space(date_el.get_text(" ", strip=True) if date_el else "")
        start_date = parse_first_date(date_text)

        venue_el = card.select_one(".event-item__venue")
        venue_name = normalize_space(venue_el.get_text(" ", strip=True) if venue_el else None)

        image_url = extract_card_image(card)

        desc_parts = []
        if date_text: desc_parts.append(date_text)
        if venue_name: desc_parts.append(venue_name)
        description = " • ".join(desc_parts) if desc_parts else None

        slug_bits = [title]
        if start_date: slug_bits.append(start_date)
        slug = slugify("-".join(slug_bits))

        rows.append({
            "title":       title,
            "link":        link,
            "image":       image_url,
            "start_date":  start_date,
            "end_date":    None,
            "start_time":  None,  # not on grid
            "end_time":    None,
            "description": description,
            "slug":        slug,
        })

    # de-dup within this run by link
    dedup = {}
    for ev in rows:
        key = ev["link"] or ev["slug"]
        if key not in dedup:
            dedup[key] = ev
    out = list(dedup.values())
    print(f"🔎 Found {len(out)} events")
    return out

def upsert_all_events(events: list[dict], venue_id: Optional[int]) -> None:
    if not events:
        print("No events to write.")
        return
    for ev in events:
        record = {
            "venue_id":    venue_id,
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "end_date":    ev["end_date"],
            "start_time":  ev["start_time"],
            "end_time":    ev["end_time"],
            "description": ev["description"],
            "slug":        ev["slug"],
            "source":      "ensemblearts",
        }
        try:
            sb.table("all_events").upsert(record, on_conflict=["link"]).execute()
            print(f"✅ Upserted: {ev['title']} ({ev['start_date']})")
        except Exception as e:
            print(f"❌ Upsert failed for {ev['title']}: {e}")

if __name__ == "__main__":
    evs = scrape_events()
    vid = find_venue_id()
    upsert_all_events(evs, vid)
