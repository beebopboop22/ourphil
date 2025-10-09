#!/usr/bin/env python3
import os
import re
import json
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from urllib.parse import urlparse, parse_qs, unquote

# ── Config ─────────────────────────────────────────────────────────────────────
FILLMORE_URL = "https://www.thefillmorephilly.com/shows/rooms/the-fillmore-philadelphia"
DEFAULT_VENUE_NAME = os.getenv("VENUE_NAME", "The Fillmore Philadelphia")
DEFAULT_VENUE_SLUG = os.getenv("VENUE_SLUG")  # optional override if your DB uses a different slug
SOURCE_KEY = "the_fillmore"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
}

# ── Load env & init Supabase ───────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY in environment.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Utils ──────────────────────────────────────────────────────────────────────
def slugify(text: str) -> str:
    s = text.lower()
    s = re.sub(r"&", " and ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def get_first_image(image_field):
    """
    JSON-LD `image` can be a string, dict, or list. Return a string URL or None.
    """
    if not image_field:
        return None
    if isinstance(image_field, str):
        return image_field
    if isinstance(image_field, dict):
        # common keys: url, contentUrl
        return image_field.get("url") or image_field.get("contentUrl")
    if isinstance(image_field, list):
        # pick first usable
        for it in image_field:
            url = get_first_image(it)
            if url:
                return url
    return None

# ── Scraping ───────────────────────────────────────────────────────────────────
def fetch_html(url: str) -> str:
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.text

def parse_events_from_jsonld(html: str, venue_name_filter: str = "The Fillmore Philadelphia"):
    """
    Parse <script type="application/ld+json"> blocks and collect MusicEvent/Event items.
    Filters to events whose location.name matches the venue (when present).
    """
    soup = BeautifulSoup(html, "html.parser")
    events = []
    seen_links = set()

    def maybe_add(obj):
        if not isinstance(obj, dict):
            return
        t = obj.get("@type")
        if t not in ("MusicEvent", "Event"):
            return

        # Ensure it belongs to this venue (when location provided)
        loc = obj.get("location")
        loc_name = None
        if isinstance(loc, dict):
            loc_name = loc.get("name")
        elif isinstance(loc, str):
            loc_name = loc

        if loc_name and venue_name_filter and venue_name_filter.lower() not in loc_name.lower():
            return

        title = obj.get("name") or obj.get("headline")
        start = obj.get("startDate")
        link = obj.get("url")
        image = get_first_image(obj.get("image"))

        # Skip if core fields missing
        if not title or not link:
            return

        if link in seen_links:
            return
        seen_links.add(link)

        events.append(
            {
                "title": title.strip(),
                "link": link.strip(),
                "image": image,
                "start_date": start,  # already ISO8601 with TZ from JSON-LD
                "venue_name": venue_name_filter,
            }
        )

    # Walk all ld+json scripts
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        text = tag.string or tag.get_text(strip=True)
        if not text:
            continue
        try:
            data = json.loads(text)
        except Exception:
            # ignore illegible JSON-LD blocks
            continue

        if isinstance(data, list):
            for item in data:
                maybe_add(item)
        else:
            maybe_add(data)

    return events

def parse_events_from_dom(html: str, venue_name: str = "The Fillmore Philadelphia"):
    """
    Fallback parser (if needed). Attempts to read server-side card markup (rarely present).
    """
    soup = BeautifulSoup(html, "html.parser")
    events = []
    for card in soup.select("div.chakra-linkbox"):
        overlay = card.select_one("a.chakra-linkbox__overlay")
        if not overlay:
            continue
        title = overlay.get_text(strip=True)
        link = overlay.get("href", "").strip()
        date_tag = card.select_one("p.chakra-text.css-rfy86g")
        start_date = date_tag.get_text(strip=True) if date_tag else None

        img = card.select_one("img")
        image_url = None
        if img and img.has_attr("src"):
            src = img["src"]
            # Chakra/Next image proxy can carry ?url=<encoded>
            parsed = urlparse(src)
            qs = parse_qs(parsed.query)
            image_url = unquote(qs["url"][0]) if "url" in qs else src

        if title and link:
            events.append(
                {
                    "title": title,
                    "link": link,
                    "image": image_url,
                    "start_date": start_date,
                    "venue_name": venue_name,
                }
            )
    return events

def scrape_events():
    html = fetch_html(FILLMORE_URL)

    events = parse_events_from_jsonld(html, venue_name_filter=DEFAULT_VENUE_NAME)
    if not events:
        # Fallback, in case JSON-LD is absent for some reason
        events = parse_events_from_dom(html, venue_name=DEFAULT_VENUE_NAME)

    return events

# ── Supabase upsert helpers ────────────────────────────────────────────────────
def get_or_create_venue_id(venue_name: str, venue_slug_override: str | None = None):
    venue_slug = venue_slug_override or slugify(venue_name)

    # Look up by slug (you said slug is the unique in venues)
    res = (
        supabase.table("venues")
        .select("id")
        .eq("slug", venue_slug)
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]["id"]

    # Insert if missing (no ON CONFLICT)
    ins = (
        supabase.table("venues")
        .insert({"name": venue_name, "slug": venue_slug})
        .select("id")
        .single()
        .execute()
    )
    return ins.data["id"]

def upsert_data(events):
    venue_id = get_or_create_venue_id(DEFAULT_VENUE_NAME, DEFAULT_VENUE_SLUG)

    for ev in events:
        print(f"⏳ Processing: {ev['title']}")
        # Build a stable slug for your app view (does NOT need to be unique in DB)
        # Prefer last path segment of the link; if empty/numeric, fallback to slugified title.
        parsed = urlparse(ev["link"])
        last_seg = parsed.path.rstrip("/").split("/")[-1] if parsed.path else ""
        final_slug = last_seg if (last_seg and not last_seg.isdigit()) else slugify(ev["title"])

        record = {
            "name": ev["title"],
            "link": ev["link"],               # unique in all_events
            "image": ev.get("image"),
            "start_date": ev.get("start_date"),
            "venue_id": venue_id,
            "source": SOURCE_KEY,
            "slug": final_slug,
        }

        # Upsert on link (since link has a unique constraint in all_events)
        supabase.table("all_events").upsert(record, on_conflict="link").execute()
        print(f"✅ Upserted: {ev['title']}")

# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    evs = scrape_events()
    print(f"🔎 Found {len(evs)} events")
    if evs:
        upsert_data(evs)
