#!/usr/bin/env python3
import os
import re
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime
from urllib.parse import urljoin

# ── Env / Supabase ─────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── HTTP headers ───────────────────────────────────────────────────────────────
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Cache-Control": "no-cache",
}

BASE_URL = "https://www.dolphinphillyinfo.com"
CAL_PATH = "/new-events-1"

# ── Helpers ────────────────────────────────────────────────────────────────────
_non_alnum = re.compile(r"[^a-z0-9]+")
def slugify(text: str) -> str:
    s = (text or "").lower().replace("&", " and ")
    s = _non_alnum.sub("-", s)
    return s.strip("-")

def clean_spaces(s: str) -> str:
    # Normalize unicode narrow no-break spaces and dashes
    return (
        (s or "")
        .replace("\u202f", " ")  # narrow no-break space
        .replace("\u00a0", " ")  # nbsp
        .replace("\u2013", "-")  # en dash
        .replace("\u2014", "-")  # em dash
    )

_date_re = re.compile(r"([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})")
_time_re = re.compile(r"(\d{1,2}:\d{2}\s*[AP]M)", re.I)

def parse_date_time(text: str):
    """
    Example: 'Friday, March 21, 2025, 9:00 PM – 11:59 PM'
    → ('2025-03-21', '21:00:00', '23:59:00')
    """
    t = clean_spaces(text)
    mdate = _date_re.search(t)
    start_time = end_time = None
    if mdate:
        month_name, day, year = mdate.groups()
        try:
            date_obj = datetime.strptime(f"{month_name} {day} {year}", "%B %d %Y").date()
        except ValueError:
            date_obj = datetime.strptime(f"{month_name} {day} {year}", "%b %d %Y").date()
        date_str = date_obj.isoformat()
    else:
        date_str = None

    times = _time_re.findall(t)
    if times:
        try:
            st = datetime.strptime(times[0].upper().replace(" ", ""), "%I:%M%p").time()
            start_time = st.isoformat()
        except ValueError:
            start_time = None
        if len(times) > 1:
            try:
                et = datetime.strptime(times[1].upper().replace(" ", ""), "%I:%M%p").time()
                end_time = et.isoformat()
            except ValueError:
                end_time = None

    return date_str, start_time, end_time

def abs_or_join(href: str | None, base: str) -> str | None:
    if not href:
        return None
    return href if href.startswith(("http://", "https://")) else urljoin(base, href)

# ── Scrape listing page for basic event info ───────────────────────────────────
def scrape_events():
    month_str = datetime.now().strftime("%m-%Y")  # ensures current month/year like '03-2025'
    cal_url = f"{BASE_URL}{CAL_PATH}?view=calendar&month={month_str}"

    r = requests.get(cal_url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    events = []

    # Prefer the <noscript> fallback which contains a clean, static list
    ns = soup.find("noscript")
    if ns:
        cal_soup = BeautifulSoup(ns.decode_contents(), "html.parser")
        for li in cal_soup.select("ul > li"):
            # Title and per-event page
            h1a = li.select_one("h1 a")
            if not h1a:
                continue
            title = h1a.get_text(strip=True)
            event_page = abs_or_join(h1a.get("href"), BASE_URL)

            # Image (optional)
            img = li.find("img")
            image = None
            if img:
                image = img.get("data-src") or img.get("data-image") or img.get("src")

            # Find the div that contains the date/time line (it has a year and a time)
            date_div = None
            for d in li.find_all("div", recursive=False):
                txt = d.get_text(" ", strip=True)
                if _date_re.search(txt) and _time_re.search(txt):
                    date_div = d
                    break
            start_date = start_time = end_time = None
            if date_div:
                start_date, start_time, end_time = parse_date_time(date_div.get_text(" ", strip=True))

            # Venue block: first <div> with a <ul> of <li>s
            venue_name = "The Dolphin Tavern"
            address = "1539 South Broad Street, Philadelphia, PA, 19147"
            v_ul = None
            for d in li.find_all("div", recursive=False):
                u = d.find("ul")
                if u:
                    v_ul = u
                    break
            if v_ul:
                items = [e.get_text(strip=True) for e in v_ul.find_all("li")]
                if items:
                    venue_name = items[0] or venue_name
                # stitch street + city line if available
                if len(items) >= 3:
                    address = f"{items[1]}, {items[2]}"

            # Description / ticket link: take the last <div> with text or an <a href>
            desc_text = ""
            ticket_link = None
            candidate_divs = [d for d in li.find_all("div", recursive=False)]
            for d in reversed(candidate_divs):
                text = d.get_text(" ", strip=True)
                a = d.find("a", href=True)
                if text or a:
                    desc_text = text
                    if a and a["href"]:
                        ticket_link = a["href"]
                    break

            # Choose link priority: ticket link if present, else event page
            link = ticket_link or event_page

            # Slug
            ymd = start_date or "tbd"
            slug = slugify(f"dolphin-{title}-{ymd}")

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

    # Fallback: list view if noscript missing/empty
    if not events:
        list_url = f"{BASE_URL}{CAL_PATH}?view=list"
        r2 = requests.get(list_url, headers=HEADERS, timeout=30)
        r2.raise_for_status()
        lsoup = BeautifulSoup(r2.text, "html.parser")

        for item in lsoup.select("div.event-list-item, div.sqs-event-summary"):
            a = item.find("a", href=True)
            if not a:
                continue
            title = a.get_text(strip=True)
            event_page = abs_or_join(a["href"], BASE_URL)

            # ISO time if present on <time datetime="...">
            time_tag = item.find("time")
            start_date = start_time = end_time = None
            if time_tag and time_tag.has_attr("datetime"):
                try:
                    dt = datetime.fromisoformat(time_tag["datetime"].replace("Z", "+00:00"))
                    start_date = dt.date().isoformat()
                    start_time = dt.time().isoformat()
                except Exception:
                    pass

            img = item.find("img")
            image = img.get("src") if img else None

            desc = item.select_one(".summary-description, .event-description")
            desc_text = desc.get_text(" ", strip=True) if desc else ""

            venue_tag = item.select_one(".summary-venue")
            venue_name = venue_tag.get_text(strip=True) if venue_tag else "The Dolphin Tavern"
            address    = "1539 South Broad Street, Philadelphia, PA, 19147"

            ymd = start_date or "tbd"
            slug = slugify(f"dolphin-{title}-{ymd}")

            events.append({
                "title":       title,
                "link":        event_page,
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

# ── Upsert into Supabase (link is unique) ──────────────────────────────────────
def upsert_data(events):
    for ev in events:
        print(f"⏳ Processing: {ev['title']}")

        v_rec = {"name": ev["venue_name"], "address": ev["address"]}
        v = (
            supabase.table("venues")
            .upsert(v_rec, on_conflict=["name"], returning="representation")
            .execute()
        )
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

        # De-dupe on link (your table has UNIQUE(link))
        supabase.table("all_events").upsert(record, on_conflict=["link"]).execute()
        print(f"✅ Upserted: {ev['title']}")

# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    evs = scrape_events()
    print(f"🔎 Found {len(evs)} events")
    if evs:
        upsert_data(evs)
