#!/usr/bin/env python3
import os
import re
import html
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
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
        ("ticketing", "eventUrl"),
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
    for ck in [
        ("image", "imageUrl"),
        "imageUrl",
        "image",
        ("heroImage", "imageUrl"),
        "heroImageUrl",
    ]:
        v = get_nested(ev, *ck) if isinstance(ck, tuple) else ev.get(ck)
        if isinstance(v, str):
            m = IMG_PAT.search(v)
            if m:
                return m.group(0)
    imgs = ev.get("images")
    if isinstance(imgs, list):
        for it in imgs:
            for key in ("imageUrl", "url", "src"):
                vv = (it or {}).get(key)
                if isinstance(vv, str):
                    m = IMG_PAT.search(vv)
                    if m:
                        return m.group(0)
    for s in iter_all_strings(ev):
        m = IMG_PAT.search(s)
        if m:
            return m.group(0)
    return None

def _fmt(dt: datetime) -> Tuple[str, str]:
    return dt.date().isoformat(), dt.time().strftime("%H:%M:%S")

def extract_datetime(ev: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    """
    Returns (start_date, start_time) as local SHOW time (never doors).
    Priority:
      1) eventDateTimeISO (has offset)
      2) eventDateTime (assumed local to eventDateTimeZone)
      3) eventDateTimeUTC -> convert to eventDateTimeZone (fallback America/New_York)
      4) split (date + time) fields
    """
    tz_str = (
        ev.get("eventDateTimeZone")
        or ev.get("eventDateTimeTimeZone")
        or ev.get("showDateTimeZone")
        or "America/New_York"
    )

    # 1) ISO with offset, e.g. "2025-10-06T20:00:00-04:00"
    iso = ev.get("eventDateTimeISO") or ev.get("showDateTimeISO")
    if isinstance(iso, str) and iso.strip():
        try:
            dt = datetime.fromisoformat(iso.strip())
            # Convert to the declared local TZ to be explicit (usually no-op)
            local = dt.astimezone(ZoneInfo(tz_str))
            return _fmt(local)
        except Exception:
            pass

    # 2) Local naive timestamp string + explicit zone
    local_str = ev.get("eventDateTime") or ev.get("showDateTime")
    if isinstance(local_str, str) and local_str.strip():
        try:
            dt_local = datetime.fromisoformat(local_str.strip())
            # Treat as local time in tz_str (no conversion needed for display)
            if dt_local.tzinfo is None:
                dt_local = dt_local.replace(tzinfo=ZoneInfo(tz_str))
            else:
                dt_local = dt_local.astimezone(ZoneInfo(tz_str))
            return _fmt(dt_local)
        except Exception:
            pass

    # 3) UTC → convert into local zone
    utc_str = ev.get("eventDateTimeUTC") or ev.get("showDateTimeUTC")
    if isinstance(utc_str, str) and utc_str.strip():
        try:
            dt_utc = datetime.fromisoformat(utc_str.strip())
            if dt_utc.tzinfo is None:
                dt_utc = dt_utc.replace(tzinfo=timezone.utc)
            local = dt_utc.astimezone(ZoneInfo(tz_str))
            return _fmt(local)
        except Exception:
            pass

    # 4) Split date+time fields (rare here but safe)
    date_keys = ["eventDate", "showDate", "date"]
    time_keys = ["eventTime", "showTime", "time"]
    ds = None
    for dk in date_keys:
        if isinstance(ev.get(dk), str) and ev[dk].strip():
            ds = ev[dk].strip()
            break

    if ds:
        ds2 = ds.replace(".", "-").replace("/", "-")
        dval = None
        for fmt in ("%Y-%m-%d", "%m-%d-%Y", "%m-%d-%y"):
            try:
                dval = datetime.strptime(ds2, fmt).date()
                break
            except Exception:
                continue

        ts = None
        for tk in time_keys:
            if isinstance(ev.get(tk), str) and ev[tk].strip():
                raw = ev[tk].strip().upper().replace(".", "")
                for tfmt in ("%I:%M %p", "%I %p", "%H:%M", "%H:%M:%S"):
                    try:
                        tt = datetime.strptime(raw, tfmt).time()
                        ts = tt.strftime("%H:%M:%S")
                        break
                    except Exception:
                        continue
                break

        if dval:
            return dval.isoformat(), ts

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
        "image":       image,
        "start_date":  start_date,     # local YYYY-MM-DD
        "start_time":  start_time,     # local HH:MM:SS (showtime), or None
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
