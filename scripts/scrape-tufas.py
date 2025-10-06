#!/usr/bin/env python3
import os, re, requests, html
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

# ── Env & Supabase ───────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Config ───────────────────────────────────────────────────────────────
PAGE_URL   = "https://tufasboulderlounge.com/events/"  # set to the real page
VENUE_NAME = "Tufas Boulder Lounge"
SOURCE     = "tufasboulderlounge"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; tufas-scraper/1.0)",
    "Accept-Language": "en-US,en;q=0.9",
}

# ── Utils ────────────────────────────────────────────────────────────────
MONTHS = {m.lower(): i for i, m in enumerate(
    ["January","February","March","April","May","June","July","August","September","October","November","December"], 1)}
ABBR   = {"jan":"january","feb":"february","mar":"march","apr":"april","jun":"june","jul":"july","aug":"august","sep":"september","sept":"september","oct":"october","nov":"november","dec":"december"}

def slugify(text: str) -> str:
    s = html.unescape(text or "").strip().lower()
    s = re.sub(r"[’'`]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def to_24h(h: int, m: int, ampm: str | None) -> str:
    if ampm:
        a = ampm.lower().replace(".", "").replace(" ", "")
        if a == "pm" and h != 12: h += 12
        if a == "am" and h == 12: h = 0
    return f"{h:02d}:{m:02d}:00"

TIME_TOKEN = re.compile(r"(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?", re.I)

def parse_time_range(s: str) -> tuple[str|None, str|None]:
    """
    Pull first one or two time tokens from a messy string:
    '5pm-8pm (tufas) 8pm (suttons)' -> 17:00:00, 20:00:00
    '6 pm' -> 18:00:00, None
    """
    tokens = TIME_TOKEN.findall(s)
    if not tokens:
        return None, None
    # Normalize tokens → (h, m, ampm) and carry am/pm forward if missing
    norm = []
    last_ampm = None
    for h, m, ampm in tokens:
        ampm = ampm or last_ampm
        last_ampm = ampm or last_ampm
        hh = int(h); mm = int(m or 0)
        norm.append(to_24h(hh, mm, ampm))
    start = norm[0]
    end   = norm[1] if len(norm) > 1 else None
    return start, end

def parse_date_time_line(s: str, default_year: int | None = None) -> tuple[str|None, str|None, str|None]:
    """
    Returns (start_date_iso, start_time, end_time).
    Accepts lines like:
      'Wednesday, October 8th | 6pm'
      'Thursday, Oct 16 | 5pm-8pm (tufas) 8pm (suttons)'
      'Saturday, October 25th | 8pm'
    """
    s = " ".join(s.replace("–","-").split())
    # split date vs times by a strong separator
    date_part, time_part = (s.split("|", 1) + [""])[:2]
    date_part = date_part.strip()
    time_part = time_part.strip()

    # strip weekday
    date_part = re.sub(r"^(Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+", "", date_part, flags=re.I)
    # remove ordinal suffix 1st, 2nd, 3rd, 4th...
    date_part = re.sub(r"(\d{1,2})(st|nd|rd|th)", r"\1", date_part, flags=re.I)

    # normalize month word
    m = re.search(r"([A-Za-z]{3,9})\s+(\d{1,2})(?:,\s*(\d{4}))?$", date_part)
    if not m:
        return None, None, None
    month_word, day, year = m.group(1), int(m.group(2)), m.group(3)
    mw = month_word.lower()
    mw = ABBR.get(mw, mw)
    month = MONTHS.get(mw)
    if not month:
        return None, None, None
    year = int(year) if year else (default_year or datetime.now().year)

    try:
        start_date = datetime(year, month, day).date().isoformat()
    except ValueError:
        return None, None, None

    start_time, end_time = (None, None)
    if time_part:
        start_time, end_time = parse_time_range(time_part)

    return start_date, start_time, end_time

# ── Scrape ──────────────────────────────────────────────────────────────
def scrape_events():
    r = requests.get(PAGE_URL, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    blocks = soup.select("div.wp-block-media-text")
    events = []

    for blk in blocks:
        # Image
        img = blk.select_one("figure img")
        image = img.get("src") if img and img.get("src") else None

        # Title candidates (be flexible)
        title = None
        for sel in [
            ".wp-block-media-text__content .has-xxxxxl-font-size",
            ".wp-block-media-text__content h2",
            ".wp-block-media-text__content h3",
            ".wp-block-media-text__content p strong",
            ".wp-block-media-text__content p:first-child",
        ]:
            n = blk.select_one(sel)
            if n and n.get_text(strip=True):
                title = n.get_text(" ", strip=True)
                break
        if not title:
            # fallback: image alt or filename stem
            if img and img.get("alt"):
                title = img["alt"].strip()
            elif image:
                title = slugify(image.rsplit("/", 1)[-1].split(".")[0]).replace("-", " ").title()
            else:
                continue  # skip block with no title signal

        # Date/time line: try “big font” first; else any <p> that looks like a date
        dt_node = blk.select_one(".wp-block-media-text__content .has-big-font-size")
        if not dt_node:
            for p in blk.select(".wp-block-media-text__content p"):
                if re.search(r"(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b", p.get_text("", strip=True), re.I):
                    dt_node = p
                    break
        if not dt_node:
            # No recognizable date → skip
            continue

        dt_text = dt_node.get_text(" ", strip=True)
        sd, st, et = parse_date_time_line(dt_text)

        if not sd:
            continue  # must have a date

        # Description: other <p> tags except the dt_node
        desc_parts = []
        for p in blk.select(".wp-block-media-text__content p"):
            if p is dt_node: 
                continue
            txt = p.get_text(" ", strip=True)
            if not txt:
                continue
            # avoid repeating the giant title line
            if title.strip().lower() in txt.strip().lower():
                continue
            desc_parts.append(txt)
        description = " ".join(desc_parts) or None

        # There’s no per-event page → synthesize a stable link
        slug = slugify(f"{title}-{sd}")
        link = f"{PAGE_URL.rstrip('/') }#{slug}"

        events.append({
            "title":       title,
            "link":        link,
            "image":       image,
            "start_date":  sd,
            "start_time":  st,
            "end_time":    et,
            "description": description,
            "venue_name":  VENUE_NAME,
            "slug":        slug,
        })
    return events

# ── Upsert ──────────────────────────────────────────────────────────────
def upsert_data(events):
    # Ensure venue
    v = sb.table("venues").upsert({"name": VENUE_NAME}, on_conflict=["name"], returning="representation").execute()
    venue_id = v.data[0]["id"] if v.data else None

    for ev in events:
        rec = {
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
            rec["start_time"] = ev["start_time"]
        if ev["end_time"]:
            rec["end_time"] = ev["end_time"]

        sb.table("all_events").upsert(rec, on_conflict=["link"]).execute()
        print(f"✅ Upserted: {ev['title']} | {ev['start_date']} {ev.get('start_time') or ''}")

# ── Main ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"Scraping {PAGE_URL} …")
    evs = scrape_events()
    print(f"Found {len(evs)} events.")
    if evs:
        upsert_data(evs)
