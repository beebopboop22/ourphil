import os
import re
import time
from datetime import datetime
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from dateutil import parser
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from supabase import create_client, Client

# ── Load environment variables ─────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Helper to slugify titles ─────────────────────────────────────────────────────
def slugify(text: str) -> str:
    slug = text.lower()
    slug = re.sub(r"&", " and ", slug)
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")

# ── Scrape events via Selenium ──────────────────────────────────────────────────
def scrape_events():
    URL = "https://philorch.ensembleartsphilly.org/tickets-and-events/events"

    chrome_opts = Options()
    chrome_opts.add_argument("--headless")
    chrome_opts.add_argument("--disable-gpu")
    chrome_opts.add_argument("--no-sandbox")
    chrome_opts.add_argument(
        "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
    )
    driver = webdriver.Chrome(options=chrome_opts)
    driver.get(URL)

    # wait up to 15s for events to render
    timeout = 15
    end = time.time() + timeout
    while time.time() < end:
        if driver.find_elements(By.CSS_SELECTOR, ".events-grid__item"):
            break
        time.sleep(0.5)

    soup = BeautifulSoup(driver.page_source, "html.parser")
    driver.quit()

    events = []
    for item in soup.select(".events-grid__item"):
        link_el = item.select_one("a.event-item")
        href = link_el["href"]
        link = urljoin(URL, href)

        title = item.select_one(".event-item__title").get_text(strip=True)
        slug = slugify(href.rstrip("/").split("/")[-1] or title)

        # parse date or date range
        date_text = item.select_one(".event-item__date").get_text(strip=True)
        start_date = end_date = None
        if "-" in date_text:
            # e.g. "Jun 25 - Jun 27, 2025"
            parts = [p.strip() for p in date_text.split("-")]
            end_part = parts[-1]
            # determine year
            try:
                dt_end = parser.parse(end_part)
            except Exception:
                # if end_part missing year, append from start
                raise
            year = dt_end.year
            # parse start
            start_part = parts[0]
            # if start_part missing year
            if not re.search(r"\d{4}", start_part):
                start_part = f"{start_part}, {year}"
            dt_start = parser.parse(start_part)

            start_date = dt_start.date().isoformat()
            end_date   = dt_end.date().isoformat()
        else:
            # single date, e.g. "August 13, 2025"
            try:
                dt = parser.parse(date_text)
                start_date = dt.date().isoformat()
            except Exception:
                start_date = None

        img = item.select_one(".event-item__image")
        image = img["src"] if img and img.has_attr("src") else None

        venue_el = item.select_one(".event-item__venue")
        venue_name = venue_el.get_text(strip=True) if venue_el else None

        events.append({
            "title":       title,
            "link":        link,
            "image":       image,
            "start_date":  start_date,
            "end_date":    end_date,
            "start_time":  None,
            "end_time":    None,
            "description": None,
            "venue_name":  venue_name,
            "slug":        slug,
        })

    return events

# ── Upsert into Supabase, skipping unwanted venues ───────────────────────────────
def upsert_data(events):
    for ev in events:
        if ev.get("venue_name") in ("Gerald R. Ford Amphitheater", "Saratoga Performing Arts Center"):
            print(f"⏭ Skipping unwanted venue: {ev['venue_name']}")
            continue
        print(f"⏳ Processing: {ev['title']}")

        venue_id = None
        if ev["venue_name"]:
            resp = (
                supabase.table("venues")
                .upsert(
                    {"name": ev["venue_name"], "slug": slugify(ev["venue_name"])},
                    on_conflict=["slug"],
                    returning="representation"
                )
                .execute()
            )
            if resp.data:
                venue_id = resp.data[0]["id"]

        record = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "end_date":    ev.get("end_date"),
            "description": ev["description"],
            "venue_id":    venue_id,
            "source":      "ensemblearts",
            "slug":        ev["slug"],
        }

        supabase.table("all_events") \
                .upsert(record, on_conflict=["link"]) \
                .execute()

        print(f"✅ Upserted: {ev['title']}")

if __name__ == "__main__":
    evs = scrape_events()
    print(f"🔎 Found {len(evs)} events")
    if evs:
        upsert_data(evs)
