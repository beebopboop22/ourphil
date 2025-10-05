#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Scrape events from The Craft Coven (Wix + TicketSpot iframe) and write them
into public.group_events with the tag 'arts'.

ENV (required):
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY)

Install:
  pip install playwright beautifulsoup4 requests supabase python-dotenv
  playwright install chromium
"""

import os
import re
import sys
import json
import hashlib
from dataclasses import dataclass
from typing import Optional, List, Dict, Tuple
from datetime import date, datetime, timedelta
from urllib.parse import urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

# ── Config ─────────────────────────────────────────────────────────────────────
SITE_URL  = "https://www.thecraftcoven.org/"
IFRAME_TITLE_PAT = re.compile(r"(ticket|event|calendar|spot)", re.I)

GROUP_ID = "cd9b65c6-7444-4fd0-9809-88839d7b3a4d"   # Craft Coven
USER_ID  = "26f671a4-2f54-4377-9518-47c7f21663c7"

TAG_SLUG = "arts"
TAG_NAME = "Arts"

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/114.0.0.0 Safari/537.36"
)

HEADERS = {
    "User-Agent": UA,
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Connection": "close",
    "Cache-Control": "no-cache",
}

# ── Env & Supabase ─────────────────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

def get_sb_client() -> Optional[Client]:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    return create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Helpers ────────────────────────────────────────────────────────────────────
MONTHS = {
    "jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,
    "jul":7,"aug":8,"sep":9,"sept":9,"oct":10,"nov":11,"dec":12
}
_slug_non_alnum = re.compile(r"[^a-z0-9]+")

def slugify(text: str) -> str:
    s = (text or "").lower().replace("&", " and ")
    s = _slug_non_alnum.sub("-", s)
    return s.strip("-")

def canon_link(u: Optional[str]) -> Optional[str]:
    if not u:
        return None
    try:
        p = urlparse(u)
        scheme = "https" if p.scheme in ("http","https") else p.scheme
        netloc = (p.netloc or "").lower()
        path = (p.path or "/").rstrip("/") or "/"
        return urlunparse((scheme, netloc, path, "", "", ""))
    except Exception:
        return u

def short_hash(s: str) -> str:
    return hashlib.sha1((s or "").encode("utf-8")).hexdigest()[:8]

def normalize_ws(s: str) -> str:
    return re.sub(r"[ \t]+", " ", (s or "").strip())

# time like "6:30 PM" or "6 PM"
_TIME_RE = re.compile(r"\b(\d{1,2})(?::(\d{2}))?\s*([AP]M)\b", re.I)

def parse_time_12h(t: str) -> Optional[str]:
    if not t: return None
    m = _TIME_RE.search(t)
    if not m: return None
    hour = int(m.group(1))
    minute = int(m.group(2) or 0)
    ampm = m.group(3).upper()
    if ampm == "PM" and hour != 12:
        hour += 12
    if ampm == "AM" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}:00"

_ORD = r"(?:st|nd|rd|th)"
# Matches:
# "Sun Oct 5th 12:00 AM - 4:00 PM"
# "Next Event Wed Oct 8th 6:30 PM - 8:30 PM"
# "Fri Oct 3, 2025 7 PM - 10 PM"
_DT_RE = re.compile(
    r"(?:(?:Next\s+Event)\s+)?"
    r"(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+)?"
    r"([A-Za-z]{3,})\s+(\d{1,2})" + _ORD + "?,?\s*(\d{4})?"
    r"(?:\s+at)?\s+(\d{1,2}(?::\d{2})?\s*[AP]M)"
    r"(?:\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*[AP]M))?",
    re.I
)

def coerce_year(month: int, day: int, explicit_year: Optional[int]) -> int:
    if explicit_year:
        return explicit_year
    today = date.today()
    try:
        candidate = date(today.year, month, day)
    except Exception:
        return today.year
    return today.year + 1 if (today - candidate).days > 60 else today.year

def parse_dt_from_text(text: str) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    if not text:
        return (None, None, None, None)
    m = _DT_RE.search(text)
    if not m:
        return (None, None, None, None)
    mon_txt = (m.group(2) or "").lower()[:4].strip()
    mon = MONTHS.get(mon_txt if mon_txt != "sept" else "sept") or MONTHS.get(mon_txt[:3])
    if not mon:
        return (None, None, None, None)
    day = int(m.group(3))
    year = int(m.group(4)) if m.group(4) else None
    start_t_raw = m.group(5)
    end_t_raw = m.group(6) if m.group(6) else None
    start_time = parse_time_12h(start_t_raw)
    end_time = parse_time_12h(end_t_raw) if end_t_raw else None
    year2 = coerce_year(mon, day, year)
    start_dt = date(year2, mon, day)
    end_dt = start_dt
    if start_time and end_time:
        st = datetime.strptime(f"{start_time}", "%H:%M:%S")
        et = datetime.strptime(f"{end_time}", "%H:%M:%S")
        if et <= st:
            end_dt = start_dt + timedelta(days=1)
    return (start_dt.isoformat(), end_dt.isoformat(), start_time, end_time)

@dataclass
class Row:
    group_id: str
    title: str
    description: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    image_url: Optional[str] = None
    slug: str = ""
    link: Optional[str] = None
    _link: Optional[str] = None

# ── Tagging helpers ────────────────────────────────────────────────────────────
def get_tag_id(sb: Client, slug: str, name: str) -> Optional[int]:
    try:
        got = sb.table("tags").select("id").eq("slug", slug).execute()
        if getattr(got, "data", None):
            return got.data[0]["id"]
        got2 = sb.table("tags").select("id").eq("name", name).execute()
        if getattr(got2, "data", None):
            return got2.data[0]["id"]
    except APIError as e:
        print(f"⚠️  Could not fetch tag id for '{slug}': {e}")
    return None

def ensure_tagging(sb: Client, event_id: str, tag_id: int) -> None:
    try:
        existing = (
            sb.table("taggings")
            .select("id")
            .eq("tag_id", tag_id)
            .eq("taggable_type", "group_events")
            .eq("taggable_id", str(event_id))
            .execute()
        )
        if getattr(existing, "data", None):
            return
        sb.table("taggings").insert({
            "tag_id": tag_id,
            "taggable_type": "group_events",
            "taggable_id": str(event_id),
        }).execute()
    except APIError as e:
        print(f"⚠️  Tagging failed for event {event_id}: {e}")

# ── HTTP helpers for enrichment ────────────────────────────────────────────────
def fetch_html(url: str) -> Optional[BeautifulSoup]:
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()
        return BeautifulSoup(r.text, "html.parser")
    except Exception as e:
        print(f"⚠️  Fetch failed {url}: {e}")
        return None

def first_meta(soup: BeautifulSoup, *names) -> Optional[str]:
    for n in names:
        el = soup.find("meta", attrs={"property": n}) or soup.find("meta", attrs={"name": n})
        if el and el.get("content"):
            return el["content"].strip()
    return None

def text_from_selectors(soup: BeautifulSoup, selectors: List[str], joiner="\n") -> Optional[str]:
    for sel in selectors:
        el = soup.select_one(sel)
        if el:
            t = el.get_text(" ", strip=True)
            if t:
                return t
    return None

def parse_ld_json_address(soup: BeautifulSoup) -> Optional[str]:
    """
    Pull a postal address from JSON-LD Event schema (Eventbrite usually has it).
    """
    try:
        for sc in soup.find_all("script", type="application/ld+json"):
            data = sc.string or sc.get_text()
            if not data: 
                continue
            obj = json.loads(data)
            items = obj if isinstance(obj, list) else [obj]
            for it in items:
                if isinstance(it, dict) and it.get("@type") in ("Event", "MusicEvent", "TheaterEvent"):
                    loc = it.get("location")
                    if not loc:
                        continue
                    # location can be string or object or Place
                    if isinstance(loc, str):
                        return loc.strip()
                    if isinstance(loc, dict):
                        parts = []
                        name = loc.get("name")
                        if name:
                            parts.append(str(name).strip())
                        addr = loc.get("address")
                        if isinstance(addr, dict):
                            line = ", ".join([s for s in [
                                addr.get("streetAddress"),
                                addr.get("addressLocality"),
                                addr.get("addressRegion"),
                                addr.get("postalCode")
                            ] if s])
                            if line:
                                parts.append(line)
                        elif isinstance(addr, str):
                            parts.append(addr.strip())
                        if parts:
                            return "\n".join(parts)
    except Exception:
        pass
    return None

def enrich_from_event_page(ev: Row) -> Row:
    """
    Visit the linked event page (Eventbrite/TicketSpot/etc.) and pull description,
    image, and address. Does not override date/time unless we were missing them.
    """
    href = ev.link or ""
    if not href or not href.startswith(("http://", "https://")):
        return ev

    soup = fetch_html(href)
    if not soup:
        return ev

    # Title (only if our title is "Event" or empty)
    if not ev.title or ev.title.lower() == "event":
        og_title = first_meta(soup, "og:title")
        if og_title:
            ev.title = normalize_ws(og_title)

    # Description
    desc = first_meta(soup, "og:description", "description")
    if not desc:
        # common Eventbrite content bucket
        desc = text_from_selectors(
            soup,
            [
                "[data-automation='listing-event-description']",
                ".eds-l-mar-top-6 .structured-content-rich-text",
                ".event-details .has-user-generated-content",
                ".main-event-details",  # fallback
            ]
        )
    if desc:
        # crisp it up a bit
        desc = re.sub(r"\s{2,}", " ", desc).strip()
        ev.description = desc

    # Image
    img = first_meta(soup, "og:image", "twitter:image")
    if img:
        ev.image_url = img

    # Address
    addr = parse_ld_json_address(soup)
    if not addr:
        # loose fallback: any visible location block or a Google Maps link text
        addr = text_from_selectors(
            soup,
            [
                "[data-automation='event-details-location']",
                "a[href*='google.com/maps']",
                "[data-spec='event-details'] [class*='location']",
            ]
        )
    if addr:
        # tidy multi-line
        addr = "\n".join([line.strip() for line in re.split(r"[\n\r]+", addr) if line.strip()])
        ev.address = addr

    # If we were missing date/time, try to parse from JSON-LD
    if not ev.start_date:
        try:
            for sc in soup.find_all("script", type="application/ld+json"):
                data = sc.string or sc.get_text()
                if not data:
                    continue
                obj = json.loads(data)
                items = obj if isinstance(obj, list) else [obj]
                for it in items:
                    if isinstance(it, dict) and it.get("@type") in ("Event", "MusicEvent", "TheaterEvent"):
                        sd = it.get("startDate")
                        ed = it.get("endDate")
                        # Normalize to date/time pieces
                        def split_dt(x: str) -> Tuple[Optional[str], Optional[str]]:
                            if not x:
                                return (None, None)
                            try:
                                dt = datetime.fromisoformat(x.replace("Z","+00:00"))
                                return (dt.date().isoformat(), dt.strftime("%H:%M:%S"))
                            except Exception:
                                return (None, None)
                        sD, sT = split_dt(sd)
                        eD, eT = split_dt(ed)
                        if sD: ev.start_date = sD
                        if eD: ev.end_date   = eD
                        if sT: ev.start_time = sT
                        if eT: ev.end_time   = eT
                        raise StopIteration
        except StopIteration:
            pass
        except Exception:
            pass

    return ev

# ── Scrape logic (Playwright for the Wix page) ─────────────────────────────────
EVENT_LINK_SELECTORS = [
    'a[href*="eventbrite"]',
    'a[href*="/e/"]',
    'a[href*="tickets"]',
    'a[href*="ticket"]',
    'a[href*="events"]',
    'a[href*="tix"]',
    'a:has(img)',
    'a:has(h1), a:has(h2), a:has(h3), a:has(h4)',
]

JS_HARVEST = """
(el) => {
  function txt(n){ return (n && (n.innerText || n.textContent) || '').trim(); }
  function nearestHeading(e){
    let cur = e;
    for (let i=0; i<6 && cur; i++){
      const h = cur.querySelector && cur.querySelector('h1,h2,h3,h4');
      if (h && txt(h)) return txt(h);
      cur = cur.parentElement;
    }
    return '';
  }
  function ctxText(e){
    let blocks = [];
    let cur = e;
    for (let i=0;i<5 && cur;i++){
      if (txt(cur)) blocks.push(txt(cur));
      cur = cur.parentElement;
    }
    const p = e.parentElement;
    if (p){
      const sibs = Array.from(p.children).filter(x => x !== e).map(txt).filter(Boolean);
      if (sibs.length) blocks.push(sibs.join('\\n'));
    }
    return blocks.filter(Boolean).slice(0,5).join('\\n');
  }
  const imgEl = el.querySelector('img');
  return {
    href: el.href || el.getAttribute('href') || '',
    text: txt(el),
    img: imgEl ? (imgEl.src || imgEl.getAttribute('src') || '') : '',
    heading: nearestHeading(el),
    ctx: ctxText(el)
  };
}
"""

def collect_events_from_frame(frame) -> List[Row]:
    anchors: List[Dict[str, str]] = []
    seen = set()
    for sel in EVENT_LINK_SELECTORS:
        try:
            elts = frame.query_selector_all(sel)
            for el in elts:
                try:
                    a = el.evaluate(JS_HARVEST)
                except Exception:
                    continue
                href = (a.get("href") or "").strip()
                if not href:
                    continue
                key = href.split("#")[0]
                if key in seen:
                    continue
                seen.add(key)
                anchors.append(a)
        except Exception:
            pass

    rows: List[Row] = []
    for a in anchors:
        href = a.get("href") or ""
        heading = normalize_ws(a.get("heading") or "")
        text = normalize_ws(a.get("text") or "")
        img  = (a.get("img") or "").strip()
        ctx  = a.get("ctx") or ""

        # Title preference
        title = heading or text or "Event"

        # Parse date/time from context
        s_date, e_date, s_time, e_time = (None, None, None, None)
        for blob in [heading, text, ctx]:
            s_date, e_date, s_time, e_time = parse_dt_from_text(blob or "")
            if s_date:
                break

        # Slug
        base = f"craft-coven-{slugify(title)}"
        suffix = short_hash(href or title)
        slug = slugify(f"{base}-{s_date}-{suffix}") if s_date else slugify(f"{base}-{suffix}")

        rows.append(Row(
            group_id=GROUP_ID,
            title=title,
            description=None,
            address=None,
            latitude=None,
            longitude=None,
            start_date=s_date,
            end_date=e_date,
            start_time=s_time,
            end_time=e_time,
            image_url=img or None,
            slug=slug,
            link=href,
            _link=canon_link(href),
        ))

    # de-dup
    dedup: Dict[str, Row] = {}
    for ev in rows:
        key = ev._link or ev.slug
        if key not in dedup:
            dedup[key] = ev
    return list(dedup.values())

def scrape() -> List[Row]:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=UA, viewport={"width": 1280, "height": 1800})
        page = context.new_page()
        try:
            page.goto(SITE_URL, wait_until="domcontentloaded", timeout=30000)
        except PWTimeout:
            print(f"⚠️  Timed out loading {SITE_URL}")
            browser.close()
            return []

        try: page.wait_for_load_state("networkidle", timeout=15000)
        except PWTimeout: pass

        # find an events/tickets iframe
        target_frame = None
        try:
            for fh in page.query_selector_all('iframe[title]'):
                title = (fh.get_attribute("title") or "").strip()
                if IFRAME_TITLE_PAT.search(title):
                    cf = fh.content_frame()
                    if cf:
                        target_frame = cf
                        break
            if not target_frame:
                for fh in page.query_selector_all("iframe"):
                    cf = fh.content_frame()
                    if cf:
                        target_frame = cf
                        break
        except Exception:
            pass

        if not target_frame:
            print("⚠️  Could not find an event/ticket iframe on the page.")
            browser.close()
            return []

        try: target_frame.wait_for_load_state("domcontentloaded", timeout=15000)
        except PWTimeout: pass
        try: target_frame.wait_for_load_state("networkidle", timeout=15000)
        except PWTimeout: pass

        rows = collect_events_from_frame(target_frame)
        browser.close()
        return rows

# ── Upsert ─────────────────────────────────────────────────────────────────────
def upsert_rows(rows: List[Row]) -> None:
    # Enrich each row by visiting its event page
    enriched: List[Row] = []
    for r in rows:
        enriched.append(enrich_from_event_page(r))

    # Filter out rows missing start_date to satisfy NOT NULL constraint
    filtered = [r for r in enriched if r.start_date]
    skipped = len(enriched) - len(filtered)
    if skipped:
        print(f"ℹ️  Skipping {skipped} events with no parseable start date (NOT NULL).")

    sb = get_sb_client()
    if not filtered:
        print("No events to write.")
        return

    if not sb:
        print(f"🔎 Would write {len(filtered)} events (print-only mode)")
        for r in filtered[:50]:
            print(f"• {r.start_date} {r.start_time or ''} — {r.title}  → {r.link or ''}")
        print("ℹ️  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found; skipping DB writes.")
        return

    tag_id = get_tag_id(sb, TAG_SLUG, TAG_NAME)
    if not tag_id:
        print(f"⚠️  Tag '{TAG_SLUG}' not found. Rows will be upserted without taggings.")

    print(f"🔎 Writing {len(filtered)} events to DB...")

    for ev in filtered:
        payload = {
            "group_id": ev.group_id,
            "user_id": USER_ID,
            "title": ev.title,
            "description": ev.description,
            "address": ev.address,
            "latitude": ev.latitude,
            "longitude": ev.longitude,
            "start_date": ev.start_date,
            "end_date": ev.end_date,
            "start_time": ev.start_time,
            "end_time": ev.end_time,
            "image_url": ev.image_url,
            "slug": ev.slug,
            "link": ev.link,  # remove if your table doesn't have this column
        }

        gid = None
        try:
            sel = sb.table("group_events").select("id").eq("slug", payload["slug"]).execute()
            existing = sel.data if hasattr(sel, "data") else []
        except APIError as e:
            print(f"❌ Select failed for {payload['slug']}: {e}")
            existing = []

        if existing:
            gid = existing[0]["id"]
            try:
                sb.table("group_events").update(payload).eq("id", gid).execute()
                print(f"♻️  Updated: {payload['title']} ({payload['slug']})")
            except APIError as e:
                print(f"❌ Update failed for {payload['slug']}: {e}")
        else:
            try:
                ins = sb.table("group_events").insert(payload).execute()
                if getattr(ins, "data", None) and len(ins.data) > 0 and "id" in ins.data[0]:
                    gid = ins.data[0]["id"]
                else:
                    sel2 = sb.table("group_events").select("id").eq("slug", payload["slug"]).execute()
                    if getattr(sel2, "data", None):
                        gid = sel2.data[0]["id"]
                print(f"➕ Inserted: {payload['title']} ({payload['slug']})")
            except APIError as e:
                print(f"❌ Insert failed for {payload['slug']}: {e}")

        if gid and tag_id:
            ensure_tagging(sb, gid, tag_id)

# ── Main ───────────────────────────────────────────────────────────────────────
def main() -> None:
    rows = scrape()
    print(f"🔎 Found {len(rows)} events (pre-enrichment)")
    upsert_rows(rows)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
