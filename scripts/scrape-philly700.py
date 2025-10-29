#!/usr/bin/env python3
import os, re, json, html as htmllib
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# ── Env & Supabase ────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/114.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Cache-Control": "no-cache",
}

EVENTS_URL = "https://philly700.com/events/"

# ── Helpers ───────────────────────────────────────────────────────────────────
def slugify(text: str) -> str:
    s = text.lower().strip()
    s = s.replace("&", " and ")
    s = re.sub(r"[^\w]+", "-", s)
    return s.strip("-")

def parse_iso_datetime(dt: str) -> (Optional[str], Optional[str]):
    if not dt:
        return None, None
    try:
        date_part, time_part = dt.split("T", 1)
        time_part = time_part.split("-")[0].split("+")[0]
        if len(time_part) == 5:
            time_part += ":00"
        return date_part, time_part
    except Exception:
        return None, None

def text_clean(raw: Optional[str]) -> Optional[str]:
    """Unescape HTML entities and strip tags."""
    if not raw:
        return None
    unescaped = htmllib.unescape(raw)
    clean = BeautifulSoup(unescaped, "html.parser").get_text(" ", strip=True)
    return clean or None

def first_nonempty(*vals) -> Optional[str]:
    for v in vals:
        if v:
            return v
    return None

# ── Tag cache (LOOKUP ONLY — no creation) ─────────────────────────────────────
class TagCache:
    def __init__(self, client: Client):
        self.client = client
        self.cache: Dict[str, Optional[int]] = {}

    def get_id(self, slug: str) -> Optional[int]:
        if slug in self.cache:
            return self.cache[slug]
        # lookup only
        res = (
            self.client.table("tags").select("id").eq("slug", slug).limit(1).execute()
        )
        tid = res.data[0]["id"] if res.data else None
        self.cache[slug] = tid
        return tid

tag_cache = TagCache(supabase)

# ── Tag inference rules ───────────────────────────────────────────────────────
COMEDY_PAT = re.compile(r"\b(comedy|stand[-\s]*up|standup|open\s*mic)\b", re.I)
MUSIC_WORD_PAT = re.compile(r"\bmusic\b", re.I)
ARTS_PAT = re.compile(r"\b(dj|dance party|exhibit|gallery|film|screening)\b", re.I)

def extract_series_name(title: str) -> Optional[str]:
    # Works with curly/straight quotes after unescape
    m = re.match(r"[‘'“\"]([^’'”\"]+)[’'”\"]", title)
    return m.group(1).strip() if m else None

def infer_tag_slugs(title: str, description: Optional[str]) -> List[str]:
    text = f"{title} {description or ''}"
    slugs = set()
    # base signals
    if MUSIC_WORD_PAT.search(text):
        slugs.add("music")
    if COMEDY_PAT.search(text):
        slugs.add("comedy")
    if ARTS_PAT.search(text):
        slugs.add("arts")
    # optional series (only if tag already exists)
    series = extract_series_name(title)
    if series:
        slugs.add(slugify(series))
    return list(slugs)

# ── Scrape & parse ───────────────────────────────────────────────────────────
def fetch_html(url: str) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.text

def parse_jsonld_events(html: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    blocks = soup.find_all("script", {"type": "application/ld+json"})
    out: List[Dict[str, Any]] = []
    for b in blocks:
        raw = (b.string or "").strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            raw2 = raw.replace("&quot;", '"')
            try:
                data = json.loads(raw2)
            except Exception:
                continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            typ = item.get("@type", "")
            if isinstance(typ, list):
                is_event = any(t.lower().endswith("event") for t in typ if isinstance(t, str))
            else:
                is_event = isinstance(typ, str) and typ.lower().endswith("event")
            if not is_event:
                continue
            out.append(item)
    return out

def normalize_event(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    # Clean title/description
    name_raw = item.get("name") or ""
    name = text_clean(name_raw) or name_raw
    description = text_clean(item.get("description"))

    startDate = item.get("startDate") or ""
    endDate = item.get("endDate") or ""
    start_date, start_time = parse_iso_datetime(startDate)
    _, end_time = parse_iso_datetime(endDate)

    url = item.get("url")
    image = None
    img = item.get("image")
    if isinstance(img, str):
        image = img
    elif isinstance(img, list) and img:
        image = img[0]
    elif isinstance(img, dict):
        image = img.get("url")

    # Venue/location
    venue_name = None
    latitude = None
    longitude = None
    address = None
    loc = item.get("location", {})
    if isinstance(loc, dict):
        venue_name = first_nonempty(loc.get("name"), "Upstairs @ The 700")
        geo = loc.get("geo") or {}
        if isinstance(geo, dict):
            latitude = geo.get("latitude")
            longitude = geo.get("longitude")
        addr = loc.get("address") or {}
        if isinstance(addr, dict):
            parts = [
                addr.get("streetAddress"),
                addr.get("addressLocality"),
                addr.get("addressRegion"),
                addr.get("postalCode"),
                addr.get("addressCountry", {}).get("name") if isinstance(addr.get("addressCountry"), dict) else addr.get("addressCountry")
            ]
            address = ", ".join([p for p in parts if p])

    if not name or not url or not start_date:
        return None

    # Slug
    slug_raw = url.rstrip("/").split("/")[-1]
    slug = slug_raw if any(c.isalpha() for c in slug_raw) else slugify(name)

    return {
        "title": name,
        "description": description,
        "link": url,
        "image": image,
        "start_date": start_date,
        "start_time": start_time,
        "end_time": end_time,
        "venue_name": venue_name,
        "venue_latitude": latitude,
        "venue_longitude": longitude,
        "venue_address": address,
        "slug": slug,
    }

def scrape_events() -> List[Dict[str, Any]]:
    html = fetch_html(EVENTS_URL)
    raw_items = parse_jsonld_events(html)
    events: List[Dict[str, Any]] = []
    for it in raw_items:
        norm = normalize_event(it)
        if norm:
            events.append(norm)
    return events

# ── DB upserts ────────────────────────────────────────────────────────────────
def get_or_create_venue_id(venue_name: Optional[str], addr: Optional[str], lat: Any, lon: Any) -> Optional[str]:
    if not venue_name:
        return None
    payload = {"name": venue_name}
    if addr:
        payload["address"] = addr
    if lat:
        payload["latitude"] = lat
    if lon:
        payload["longitude"] = lon
    res = supabase.table("venues").upsert(payload, on_conflict=["name"], returning="representation").execute()
    return res.data[0]["id"] if res.data else None

def upsert_event(ev: Dict[str, Any]) -> Optional[int]:
    venue_id = get_or_create_venue_id(ev["venue_name"], ev["venue_address"], ev["venue_latitude"], ev["venue_longitude"])
    rec: Dict[str, Any] = {
        "name": ev["title"],
        "link": ev["link"],
        "image": ev["image"],
        "start_date": ev["start_date"],
        "description": ev["description"],
        "venue_id": venue_id,
        "source": "philly700",
        "slug": ev["slug"],
    }
    if ev.get("start_time"):
        rec["start_time"] = ev["start_time"]
    if ev.get("end_time"):
        rec["end_time"] = ev["end_time"]
    res = supabase.table("all_events").upsert(rec, on_conflict=["link"], returning="representation").execute()
    if not res.data:
        return None
    return res.data[0]["id"]

def upsert_taggings_for_type(taggable_type: str, taggable_id: str, tag_ids: List[int]) -> None:
    if not tag_ids:
        return
    existing = (
        supabase.table("taggings")
        .select("tag_id")
        .eq("taggable_type", taggable_type)
        .eq("taggable_id", taggable_id)
        .in_("tag_id", tag_ids)
        .execute()
    ).data or []
    have = {row["tag_id"] for row in existing}
    to_insert = [
        {"tag_id": tid, "taggable_type": taggable_type, "taggable_id": taggable_id}
        for tid in tag_ids if tid not in have
    ]
    if to_insert:
        supabase.table("taggings").insert(to_insert).execute()

def mirror_tags_to_recurring(slug: str, link: str, tag_ids: List[int]) -> None:
    if not tag_ids:
        return
    rec = supabase.table("recurring_events").select("id, slug, link").or_(
        f"slug.eq.{slug},link.eq.{link}"
    ).limit(1).execute()
    if rec.data:
        rid = str(rec.data[0]["id"])
        upsert_taggings_for_type("recurring_events", rid, tag_ids)

def upsert_data(events: List[Dict[str, Any]]):
    # resolve base tags if present (lookup only)
    base_tag_ids = {
        "music": tag_cache.get_id("music"),
        "comedy": tag_cache.get_id("comedy"),
        "arts": tag_cache.get_id("arts"),
    }

    for ev in events:
        print(f"⏳ Processing: {ev['title']}")
        event_id = upsert_event(ev)
        if not event_id:
            print("   ⚠️ Skipped (no id returned).")
            continue

        # Infer candidate tag slugs
        candidate_slugs = infer_tag_slugs(ev["title"], ev.get("description"))

        # Map to EXISTING tag ids only
        tag_ids: List[int] = []
        for slug in candidate_slugs:
            # prefer cached base tags
            if slug in base_tag_ids and base_tag_ids[slug]:
                tag_ids.append(base_tag_ids[slug])  # type: ignore
                continue
            # series or other slugs — only if they ALREADY exist
            tid = tag_cache.get_id(slug)
            if tid:
                tag_ids.append(tid)

        # Dedup ids
        tag_ids = list(dict.fromkeys(tag_ids))

        # Apply to all_events
        upsert_taggings_for_type("all_events", str(event_id), tag_ids)

        # Mirror to recurring_events if a matching row exists
        mirror_tags_to_recurring(ev["slug"], ev["link"], tag_ids)

        print(f"✅ Upserted event + existing tags: {ev['title']}")

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    evs = scrape_events()
    seen = set()
    deduped = []
    for e in evs:
        if e["link"] in seen:
            continue
        seen.add(e["link"])
        deduped.append(e)

    print(f"🔎 Found {len(deduped)} events on philly700")
    if deduped:
        upsert_data(deduped)
    print("🏁 Done.")
