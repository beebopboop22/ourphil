#!/usr/bin/env python3
import os
import re
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

# ── Load environment variables ─────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Request headers ────────────────────────────────────────────────────────────
HEADERS = {
    "User-Agent":      "Mozilla/5.0 (...Chrome/... Safari/...)",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept":          "text/html,application/xhtml+xml,*/*;q=0.8",
}

# ── Helpers ────────────────────────────────────────────────────────────────────
def slugify(text: str) -> str:
    s = text.lower()
    s = re.sub(r'&', ' and ', s)
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

def parse_date_time(text: str):
    # e.g. "Saturday, March 29, 2025, 9:00 PM – 11:59 PM"
    parts = text.split(",")
    date_str = f"{parts[1].strip()} {parts[2].strip()}"
    try:
        date_obj = datetime.strptime(date_str, "%B %d %Y").date()
    except ValueError:
        date_obj = datetime.strptime(date_str, "%b %d %Y").date()
    m = re.search(r"(\d{1,2}:\d{2}\s*[AP]M)\s*[–-]\s*(\d{1,2}:\d{2}\s*[AP]M)", text)
    if m:
        start_time = datetime.strptime(m.group(1), "%I:%M %p").time().isoformat()
        end_time   = datetime.strptime(m.group(2), "%I:%M %p").time().isoformat()
    else:
        start_time = end_time = None
    return date_obj.isoformat(), start_time, end_time

# ── Scrape listing page for basic event info ───────────────────────────────────
def scrape_events():
    base_url = "http://www.dolphinphillyinfo.com"
    month_str = datetime.now().strftime("%m-%Y")
    cal_url = f"{base_url}/new-events-1?view=calendar&month={month_str}"

    res = requests.get(cal_url, headers=HEADERS)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    events = []

    # 1) try the <noscript> calendar fallback
    ns = soup.find("noscript")
    if ns:
        cal_soup = BeautifulSoup(ns.decode_contents(), "html.parser")
        for li in cal_soup.select("ul > li"):
            a = li.select_one("h1 a")
            if not a:
                continue

            title = a.get_text(strip=True)
            raw_slug = a["href"].rstrip("/").split("/")[-1]
            slug = raw_slug if any(c.isalpha() for c in raw_slug) else slugify(title)
            link = base_url + a["href"].strip()

            img = li.find("img")
            image = img.get("data-src") or img.get("data-image") or img.get("src")

            date_divs = li.find_all("div")
            date_text = date_divs[1].get_text(" ", strip=True)
            start_date, start_time, end_time = parse_date_time(date_text)

            venue_li = li.select_one("div > ul")
            venue_items = [e.get_text(strip=True) for e in venue_li.find_all("li")]
            venue_name = venue_items[0]
            street      = venue_items[1]
            city_line   = venue_items[2]
            address     = f"{street}, {city_line}"

            desc_div = date_divs[3]
            desc_text = desc_div.get_text(" ", strip=True)
            link_tag = desc_div.find("a")
            ticket_link = link_tag["href"] if link_tag and link_tag.has_attr("href") else None

            events.append({
                "title":       title,
                "link":        ticket_link or link,
                "image":       image,
                "start_date":  start_date,
                "start_time":  start_time,
                "end_time":    end_time,
                "description": desc_text,
                "venue_name":  venue_name,
                "address":     address,
                "slug":        slug,
            })

    # 2) fallback to list‐view if calendar was empty
    if not events:
        list_url = f"{base_url}/new-events-1?view=list"
        res2 = requests.get(list_url, headers=HEADERS)
        res2.raise_for_status()
        lsoup = BeautifulSoup(res2.text, "html.parser")

        for item in lsoup.select("div.event-list-item, div.sqs-event-summary"):
            a = item.select_one("a")
            if not a:
                continue

            title = a.get_text(strip=True)
            raw_slug = a["href"].rstrip("/").split("/")[-1]
            slug = raw_slug if any(c.isalpha() for c in raw_slug) else slugify(title)
            link = base_url + a["href"].strip()

            time_tag = item.find("time")
            if time_tag and time_tag.has_attr("datetime"):
                dt = datetime.fromisoformat(time_tag["datetime"])
                start_date = dt.date().isoformat()
                start_time = dt.time().isoformat()
                end_time   = None
            else:
                start_date = start_time = end_time = None

            img = item.find("img")
            image = img.get("src") if img else None

            desc = item.select_one(".summary-description, .event-description")
            desc_text = desc.get_text(" ", strip=True) if desc else ""

            venue_tag = item.select_one(".summary-venue")
            venue_name = venue_tag.get_text(strip=True) if venue_tag else "The Dolphin Tavern"
            address    = "1539 South Broad Street, Philadelphia, PA, 19147"

            events.append({
                "title":       title,
                "link":        link,
                "image":       image,
                "start_date":  start_date,
                "start_time":  start_time,
                "end_time":    end_time,
                "description": desc_text,
                "venue_name":  venue_name,
                "address":     address,
                "slug":        slug,
            })

    return events

# ── Upsert events & venues into Supabase ──────────────────────────────────────
def upsert_data(events):
    for ev in events:
        print(f"⏳ Processing: {ev['title']}")

        v_rec = {"name": ev["venue_name"], "address": ev["address"]}
        v = supabase.table("venues") \
                    .upsert(v_rec, on_conflict=["name"], returning="representation") \
                    .execute()
        venue_id = v.data[0]["id"] if v.data else None

        record = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "start_time":  ev["start_time"],
            "end_time":    ev["end_time"],
            "description": ev["description"],
            "venue_id":    venue_id,
            "source":      "dolphin",
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
