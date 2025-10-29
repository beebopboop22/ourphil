# scripts/scrape-punchline-philly.py
import os
import re
import json
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime
from zoneinfo import ZoneInfo

# ── Load env & init Supabase ───────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY")
    raise SystemExit(1)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Constants ──────────────────────────────────────────────────────────────────
URL = "https://www.punchlinephilly.com/shows"
VENUE_NAME = "Punch Line Philly"
SOURCE = "punchlinephilly"
LOCAL_TZ = ZoneInfo("America/New_York")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/114.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# ── Helpers ────────────────────────────────────────────────────────────────────
def slugify(text: str) -> str:
    slug = text.lower()
    slug = re.sub(r'&', ' and ', slug)
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    return slug.strip('-')

def to_local_date_time(iso_str: str):
    """
    Parse ISO 8601 datetimes that already include an offset (e.g. 2025-11-01T21:15:00-04:00)
    and convert to America/New_York. Returns (YYYY-MM-DD, HH:MM:SS).
    """
    dt = datetime.fromisoformat(iso_str)
    if dt.tzinfo is None:
        # Treat naive as local (shouldn't happen here, but safe)
        dt = dt.replace(tzinfo=LOCAL_TZ)
    dt_local = dt.astimezone(LOCAL_TZ)
    return dt_local.date().isoformat(), dt_local.time().isoformat()

def clean_text(s):
    if s is None:
        return None
    return re.sub(r'\s+', ' ', s).strip()

# ── Scrape ─────────────────────────────────────────────────────────────────────
def scrape_events():
    res = requests.get(URL, headers=HEADERS, timeout=30)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    scripts = soup.find_all("script", {"type": "application/ld+json"})
    events = []

    for tag in scripts:
        if not tag.string:
            # Some sites put the JSON in .contents; fallback to get_text()
            raw = tag.get_text(strip=True)
        else:
            raw = tag.string.strip()

        if not raw:
            continue

        # Some pages concatenate multiple JSON objects without commas; BeautifulSoup
        # usually keeps them as separate <script> tags. Handle object or list.
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            # Occasionally there are minor HTML comment artifacts; try a loose fix
            raw2 = raw.replace("\u0000", "").strip()
            try:
                data = json.loads(raw2)
            except Exception:
                continue

        payloads = data if isinstance(data, list) else [data]
        for obj in payloads:
            if not isinstance(obj, dict):
                continue

            # Accept Event-like types
            typ = obj.get("@type") or obj.get("type")
            if not typ:
                continue
            if isinstance(typ, list):
                is_event = any("Event" in t for t in typ)
            else:
                is_event = "Event" in str(typ)

            if not is_event:
                continue

            name = clean_text(obj.get("name"))
            startDate = obj.get("startDate")
            link = obj.get("url")
            image = obj.get("image")
            loc = obj.get("location") or {}

            # Only keep items for Punch Line Philly (extra guard)
            loc_name = (loc.get("name") or "").strip()
            if VENUE_NAME.lower() not in loc_name.lower():
                # Still allow if the page is scoped and location omitted; but here keep strict
                continue

            if not name or not startDate or not link:
                continue

            # Local date/time
            start_date, start_time = to_local_date_time(startDate)

            # Build slug: punchline-<title>-YYYYMMDD
            ymd = start_date.replace("-", "")
            slug = f"punchline-{slugify(name)}-{ymd}"

            # Optional address/geo for venue upsert
            addr = loc.get("address") or {}
            street = clean_text(addr.get("streetAddress"))
            locality = clean_text(addr.get("addressLocality"))
            region = clean_text(addr.get("addressRegion"))
            postal = clean_text(addr.get("postalCode"))
            country = addr.get("addressCountry")
            if isinstance(country, dict):
                country = country.get("name")
            country = clean_text(country)

            geo = loc.get("geo") or {}
            lat = geo.get("latitude")
            lng = geo.get("longitude")

            events.append({
                "title": name,
                "link": link,
                "image": image if isinstance(image, str) else None,
                "start_date": start_date,
                "start_time": start_time,
                "end_time": None,  # not provided by Ticketmaster JSON-LD here
                "description": None,  # JSON-LD on this page lacks detail; keep None
                "venue_name": VENUE_NAME,
                "venue_address": ", ".join([p for p in [street, locality, region, postal] if p]),
                "venue_latitude": lat,
                "venue_longitude": lng,
                "slug": slug,
            })

    return events

# ── Upsert ─────────────────────────────────────────────────────────────────────
def upsert_data(events):
    # Upsert the venue first (once), with category = 'comedy'
    venue_id = None
    try:
        v_payload = {
            "name": VENUE_NAME,
            "category": "comedy",
        }
        # Grab one example with address/coords if available
        for ev in events:
            if ev.get("venue_address") and ev.get("venue_latitude") and ev.get("venue_longitude"):
                v_payload.update({
                    "address": ev["venue_address"],
                    "latitude": ev["venue_latitude"],
                    "longitude": ev["venue_longitude"],
                })
                break

        v = supabase.table("venues") \
            .upsert(v_payload, on_conflict=["name"], returning="representation") \
            .execute()
        if v.data:
            venue_id = v.data[0]["id"]
    except Exception as e:
        print(f"⚠️ Venue upsert warning: {e}")

    for ev in events:
        print(f"⏳ Processing: {ev['title']} ({ev['start_date']} {ev['start_time']})")

        record = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "description": ev["description"],
            "venue_id":    venue_id,
            "source":      SOURCE,
            "slug":        ev["slug"],
        }
        if ev["start_time"]:
            record["start_time"] = ev["start_time"]
        if ev["end_time"]:
            record["end_time"] = ev["end_time"]

        # Upsert on link to avoid dupes
        supabase.table("all_events").upsert(record, on_conflict=["link"]).execute()
        print(f"✅ Upserted: {ev['title']}")

# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    evs = scrape_events()
    print(f"🔎 Found {len(evs)} events")
    if evs:
        # Deduplicate by link just in case the page repeats JSON-LD
        seen = set()
        deduped = []
        for e in evs:
            if e["link"] in seen:
                continue
            seen.add(e["link"])
            deduped.append(e)
        print(f"🧹 After de-dupe: {len(deduped)} events")

        upsert_data(deduped)
