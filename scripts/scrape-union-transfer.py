#!/usr/bin/env python3
import os
import re
import html
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime, timezone
from urllib.parse import urljoin
from typing import Dict, Any, List, Optional, Iterable, Tuple

# ── Load env ────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Config ──────────────────────────────────────────────────────────────
BASE_URL = "https://utphilly.com"
CALENDAR_URL = f"{BASE_URL}/calendar"
FALLBACK_EVENTS_JSON = "https://aegwebprod.blob.core.windows.net/json/events/289/events.json"
SOURCE = "utphilly"
VENUE_NAME = "Union Transfer"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; union-transfer-scraper/3.0)",
    "Accept-Language": "en-US,en;q=0.9",
}

# ── Utils ───────────────────────────────────────────────────────────────
def slugify(text: str) -> str:
    s = html.unescape(text or "").strip().lower()
    s = re.sub(r"[’'`]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")

def to_full_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    if url.startswith(("http://", "https://")):
        return url
    if url.startswith("/"):
        return urljoin(BASE_URL, url)
    if not url.startswith(("javascript:", "#")):
        return urljoin(BASE_URL + "/", url)
    return None

def discover_events_json_url() -> str:
    try:
        r = requests.get(CALENDAR_URL, headers=HEADERS, timeout=20)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        container = soup.select_one(".js-axs-events-section")
        if container and container.has_attr("data-file"):
            return container["data-file"]
    except Exception:
        pass
    return FALLBACK_EVENTS_JSON

def fetch_events(feed_url: str) -> List[Dict[str, Any]]:
    r = requests.get(feed_url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    data = r.json()
    return data.get("events", [])

def get_nested(d: Dict[str, Any], *path, default=None):
    cur = d
    for k in path:
        if not isinstance(cur, dict) or k not in cur:
            return default
        cur = cur[k]
    return cur

def iter_all_strings(obj: Any) -> Iterable[str]:
    if isinstance(obj, dict):
        for v in obj.values():
            yield from iter_all_strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from iter_all_strings(v)
    elif isinstance(obj, str):
        yield obj

# ── Extractors ──────────────────────────────────────────────────────────
def extract_link(ev: Dict[str, Any]) -> Optional[str]:
    for ck in [
        "eventUrl", "url", "ticketUrl", "purchaseUrl", "detailsUrl",
        ("links", "eventUrl"), ("links", "url"),
    ]:
        v = get_nested(ev, *ck) if isinstance(ck, tuple) else ev.get(ck)
        if isinstance(v, str):
            u = to_full_url(v.strip())
            if u:
                return u
    maybe = get_nested(ev, "eventUrl", "url") or get_nested(ev, "url", "href")
    if isinstance(maybe, str):
        u = to_full_url(maybe.strip())
        if u:
            return u
    for s in iter_all_strings(ev):
        s2 = s.strip()
        if s2.startswith(("http://", "https://")):
            return s2
        if "/event/" in s2 or s2.startswith("/calendar/"):
            u = to_full_url(s2)
            if u:
                return u
    return None

IMG_PAT = re.compile(r"https?://\S+\.(?:jpg|jpeg|png|webp)(?:\?\S+)?", re.I)

def extract_image(ev: Dict[str, Any]) -> Optional[str]:
    # common structured spots
    for ck in [
        ("image", "imageUrl"),
        "imageUrl",
        "image",                        # sometimes a direct URL string
        ("heroImage", "imageUrl"),
        "heroImageUrl",
    ]:
        v = get_nested(ev, *ck) if isinstance(ck, tuple) else ev.get(ck)
        if isinstance(v, str) and IMG_PAT.search(v):
            return IMG_PAT.search(v).group(0)
    # images array
    imgs = ev.get("images")
    if isinstance(imgs, list):
        for it in imgs:
            for key in ("imageUrl", "url", "src"):
                vv = (it or {}).get(key)
                if isinstance(vv, str) and IMG_PAT.search(vv):
                    return IMG_PAT.search(vv).group(0)
    # any string in the object
    for s in iter_all_strings(ev):
        m = IMG_PAT.search(s)
        if m:
            return m.group(0)
    return None

def parse_dt(s: str) -> Optional[datetime]:
    """Return a timezone-aware datetime if possible."""
    try:
        # normalize Z → +00:00 for fromisoformat
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        pass
    # epoch seconds
    if re.fullmatch(r"\d{10}", s):
        return datetime.fromtimestamp(int(s), tz=timezone.utc)
    return None

def extract_datetime(ev: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    """
    Returns (start_date, start_time) where date is YYYY-MM-DD and time is HH:MM:SS (or None).
    Prefers local time fields when present.
    """
    candidates = [
        "eventDateTimeLocal", "showDateTimeLocal",
        "eventDateTimeUTC", "showDateTimeUTC",
        "eventDateTime", "showDateTime",
    ]
    for k in candidates:
        val = ev.get(k)
        if isinstance(val, str):
            dt = parse_dt(val)
            if dt:
                # keep only time component as HH:MM:SS in local/UTC given
                return dt.date().isoformat(), dt.time().strftime("%H:%M:%S")
    # split fields (date + time stored separately)
    date_keys = ["eventDate", "showDate", "date"]
    time_keys = ["eventTime", "showTime", "time"]
    ds = None
    for dk in date_keys:
        if isinstance(ev.get(dk), str) and ev[dk].strip():
            ds = ev[dk].strip()
            break
    if ds:
        # normalize separators
        ds2 = ds.replace(".", "-").replace("/", "-")
        for fmt in ("%Y-%m-%d", "%m-%d-%Y", "%m-%d-%y"):
            try:
                d = datetime.strptime(ds2, fmt).date().isoformat()
                ts = None
                for tk in time_keys:
                    if isinstance(ev.get(tk), str) and ev[tk].strip():
                        # try to parse H:MM, HH:MM, HH:MM:SS, with AM/PM
                        raw = ev[tk].strip().upper().replace(".", "")
                        for tfmt in ("%I:%M %p", "%I %p", "%H:%M", "%H:%M:%S"):
                            try:
                                tt = datetime.strptime(raw, tfmt).time()
                                ts = tt.strftime("%H:%M:%S")
                                break
                            except Exception:
                                continue
                        break
                return d, ts
            except Exception:
                continue
    return None, None

def extract_title(ev: Dict[str, Any]) -> Optional[str]:
    title = (
        get_nested(ev, "title", "eventTitleText")
        or ev.get("title")
        or ev.get("eventTitleText")
        or get_nested(ev, "titleText")
        or None
    )
    if isinstance(title, str):
        t = html.unescape(title).strip()
        return t or None
    return None

# ── Mapper ──────────────────────────────────────────────────────────────
def map_event(ev: Dict[str, Any], venue_id: Optional[str]) -> Optional[Dict[str, Any]]:
    title = extract_title(ev)
    start_date, start_time = extract_datetime(ev)
    if not title or not start_date:
        return None

    link = extract_link(ev)
    if not link:
        slug = ev.get("slug") or slugify(title)
        link = f"{BASE_URL}/event/{slug}"

    image = extract_image(ev)

    description = (
        get_nested(ev, "description", "shortDescription")
        or ev.get("shortDescription")
        or ev.get("description")
        or None
    )
    if isinstance(description, str):
        description = html.unescape(description).strip()

    slug_val = ev.get("slug") or f"{slugify(title)}-{start_date}"

    return {
        "name":        title,
        "link":        link,
        "image":       image,          # now populated when present
        "start_date":  start_date,     # YYYY-MM-DD
        "start_time":  start_time,     # HH:MM:SS or None
        "description": description,
        "venue_id":    venue_id,
        "source":      SOURCE,
        "slug":        slug_val,
    }

def dedup_by_link(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = {}
    for r in rows:
        key = r.get("link")
        if key and key not in seen:
            seen[key] = r
    return list(seen.values())

# ── Upserts ─────────────────────────────────────────────────────────────
def ensure_venue() -> Optional[str]:
    res = (
        sb.table("venues")
        .upsert({"name": VENUE_NAME}, on_conflict=["name"], returning="representation")
        .execute()
    )
    if getattr(res, "error", None):
        print(f"⚠️  Could not upsert venue: {res.error}")
        return None
    return res.data[0]["id"] if res.data else None

def upsert_all_events(rows: List[Dict[str, Any]]) -> None:
    for ev in rows:
        try:
            res = sb.table("all_events").upsert(ev, on_conflict=["link"]).execute()
            if getattr(res, "error", None):
                print(f"❌ Upsert failed for {ev.get('name')}: {res.error}")
            else:
                print(
                    f"✅ Upserted: {ev.get('name')}  "
                    f"[date={ev.get('start_date')}, time={ev.get('start_time')}, image={'yes' if ev.get('image') else 'no'}]"
                )
        except Exception as e:
            print(f"❌ Upsert exception for {ev.get('name')}: {e}")

# ── Main ───────────────────────────────────────────────────────────────
def main():
    feed_url = discover_events_json_url()
    print(f"🔗 Using events feed: {feed_url}")

    raw_events = fetch_events(feed_url)
    print(f"🔎 Found {len(raw_events)} Union Transfer events (raw)")

    venue_id = ensure_venue()

    mapped: List[Dict[str, Any]] = []
    skipped_no_title = 0
    skipped_no_date = 0

    for ev in raw_events:
        row = map_event(ev, venue_id=venue_id)
        if row:
            mapped.append(row)
        else:
            if not extract_title(ev):
                skipped_no_title += 1
            elif not extract_datetime(ev)[0]:
                skipped_no_date += 1

    if skipped_no_title or skipped_no_date:
        print(f"ℹ️ Skipped {skipped_no_title} without title, {skipped_no_date} without date")

    deduped = dedup_by_link(mapped)
    print(f"🧹 After de-dup by link: {len(deduped)}")

    if not deduped:
        print("No valid events to upsert.")
        return

    upsert_all_events(deduped)

if __name__ == "__main__":
    main()
