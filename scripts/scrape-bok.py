#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Scrape Bok Building (Tockify) events and upsert into `all_events`,
then attach up to 2 tags via the polymorphic `taggings` table.

Tables used:
- public.venues(name)
- public.all_events(name, link, image, start_date, start_time, end_time,
                    description, venue_id, source, slug)
- public.tags(id, slug, name, ...)
- public.taggings(id, tag_id, taggable_type, taggable_id, created_at)

Taggings rows are written as:
  { tag_id, taggable_type: "all_events", taggable_id: <all_events.id as text> }
"""

import os
import re
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError

# ── Config ───────────────────────────────────────────────────────────
URL = "https://tockify.com/buildingbok/agenda"
VENUE_NAME = "Bok Building"
SOURCE = "tockify/buildingbok"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Connection": "close",
}

# Your 13 allowed tag slugs
ALLOWED_TAGS = {
    "pride","arts","nomnomslurp","organize","fitness","music","outdoors",
    "markets","family","kids","sports","birds","halloween"
}
MAX_TAGS = 2
# Prefer more specific/community-facing tags first
TAG_PRIORITY = [
    "markets","kids","family","fitness","nomnomslurp","arts","music",
    "organize","outdoors","sports","pride"
]
# These are only applied when they match (no special date logic here)
SEASONAL_OVERRIDES = {"birds","halloween"}

# Keyword/organizer heuristics (maps → your allowed tags only)
KEYWORD_TO_TAGS = {
    r"\bmarket|pop[- ]?up|bazaar|vendor(s)?|studio sale|sale\b":        ["markets"],
    r"\bkids?\b|\bday camp|summer camp\b":                              ["kids"],
    r"\bfamily|caregiver(s)?\b":                                        ["family"],
    r"\byoga|workout|fitness|pilates|barre|lululemon|run club\b":       ["fitness"],
    r"\bhappy hour|tast(ing|e)|dinner|kitchen|sip|coffee|cupping\b":    ["nomnomslurp"],
    r"\bconcert|live music|dj(s)?\b":                                   ["music"],
    r"\bfilm|movie|screening|cinema\b":                                 ["arts"],
    r"\bcomedy|stand[- ]?up|laugh along\b":                             ["arts"],
    r"\bweav(e|ing)|loom|tapestry|tuft(ing)?|ceramic(s)?|pottery|clay|jewel(l)?ery|metals?\b":
                                                                         ["arts"],
    r"\bexhibit(ion)?|gallery|reception|show(case)?|open studios?\b":   ["arts"],
    r"\bread(ing) party|storytell(ing)?\b":                              ["arts"],
    r"\btown hall|info session|budget 101|community meeting|grant|small business|training\b":
                                                                         ["organize"],
    r"\bhike|trail|cleanup|park\b":                                     ["outdoors"],
    r"\b(eagles|phillies|sixers|union)\b|\bgame (watch|night)\b":       ["sports","birds"],
    r"\b(pride|lgbtq\+?|queer|drag)\b":                                 ["pride"],
    r"\bhalloween|spooky|costume|pumpkin|haunt(ed|ing)?\b":             ["halloween"],
}
ORG_TO_TAGS = {
    "weaver house":         ["arts"],
    "tuft the world":       ["arts"],
    "alloy atelier":        ["arts"],
    "lightbox film center": ["arts"],
    "bok movie club":       ["arts"],
    "philly inmovement":    ["kids","fitness"],
    "kula collective":      ["fitness"],
    "dg print lab":         ["arts"],
    "kalaya":               ["nomnomslurp"],
    "oxtail exchange":      ["nomnomslurp"],
    "the moth":             ["arts"],
    "lululemon":            ["fitness"],
}

# ── Env / Supabase ──────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
# Prefer service role to avoid RLS surprises
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_*KEY in env.")
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Utilities ───────────────────────────────────────────────────────
def slugify(text: str) -> str:
    s = text.lower()
    s = re.sub(r'&', ' and ', s)
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

def fetch_html(url: str) -> Optional[str]:
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()
        return r.text
    except Exception as e:
        print(f"⚠️  Fetch failed: {e}")
        return None

def _normalize_image(img_val: Any) -> Optional[str]:
    if not img_val:
        return None
    if isinstance(img_val, str):
        return img_val
    if isinstance(img_val, list):
        for x in img_val:
            if isinstance(x, str):
                return x
            if isinstance(x, dict) and ("url" in x or "contentUrl" in x):
                return x.get("url") or x.get("contentUrl")
    if isinstance(img_val, dict):
        return img_val.get("url") or img_val.get("contentUrl")
    return None

def _iso_to_parts(iso_str: Optional[str]) -> (Optional[str], Optional[str]):
    """Return (YYYY-MM-DD, HH:MM:SS) from an ISO-8601 string with TZ."""
    if not iso_str:
        return None, None
    try:
        dt = datetime.fromisoformat(iso_str)
        return dt.date().isoformat(), dt.time().replace(microsecond=0).isoformat()
    except Exception:
        return None, None

def _extract_events_from_jsonld(data: Any) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []

    def handle_event(ev: Dict[str, Any]) -> None:
        if not isinstance(ev, dict) or ev.get("@type") != "Event":
            return
        name = (ev.get("name") or "").strip()
        url  = (ev.get("url") or "").strip()
        start = ev.get("startDate")
        end   = ev.get("endDate")
        img   = _normalize_image(ev.get("image"))
        desc  = ev.get("description")
        if isinstance(desc, dict):
            desc = desc.get("text") or desc.get("name")
        if desc:
            desc = re.sub(r"<[^>]+>", " ", str(desc)).strip()
            desc = re.sub(r"\s+", " ", desc)
        if not (name and url and start):
            return
        sd, st = _iso_to_parts(start)
        _, et  = _iso_to_parts(end)
        out.append({
            "title": name,
            "link": url,
            "image": img,
            "start_date": sd,
            "start_time": st,
            "end_time": et,
            "description": desc,
        })

    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                if item.get("@type") == "Event":
                    handle_event(item)
                elif "@graph" in item and isinstance(item["@graph"], list):
                    for node in item["@graph"]:
                        handle_event(node)
    elif isinstance(data, dict):
        if data.get("@type") == "Event":
            handle_event(data)
        if "@graph" in data and isinstance(data["@graph"], list):
            for node in data["@graph"]:
                handle_event(node)

    return out

def scrape_events() -> List[Dict[str, Any]]:
    html = fetch_html(URL)
    if not html:
        return []
    soup = BeautifulSoup(html, "html.parser")

    events: List[Dict[str, Any]] = []
    seen: set[str] = set()

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            raw = script.string
            if not raw:
                continue
            data = json.loads(raw)
        except Exception:
            continue

        for ev in _extract_events_from_jsonld(data):
            if ev["link"] in seen:
                continue
            seen.add(ev["link"])
            raw_slug = ev["link"].rstrip("/").split("/")[-1]
            slug = raw_slug if any(c.isalpha() for c in raw_slug) else slugify(ev["title"])
            ev["slug"] = slug
            events.append(ev)

    return events

# ── Tagging helpers (13 slugs only) ─────────────────────────────────
def predict_tag_slugs(title: str, description: Optional[str]) -> List[str]:
    text = f"{title or ''} {description or ''}".lower()
    matched: set[str] = set()

    for pattern, slugs in KEYWORD_TO_TAGS.items():
        if re.search(pattern, text, flags=re.I):
            matched.update(slugs)

    for needle, slugs in ORG_TO_TAGS.items():
        if needle in text:
            matched.update(slugs)

    matched &= ALLOWED_TAGS
    if not matched:
        return []

    seasonal = [t for t in matched if t in SEASONAL_OVERRIDES]

    ordered = sorted(
        matched,
        key=lambda t: (
            t not in seasonal,
            TAG_PRIORITY.index(t) if t in TAG_PRIORITY else 999
        )
    )
    trimmed = ordered[:MAX_TAGS]
    for s in seasonal:
        if s not in trimmed and len(trimmed) < MAX_TAGS:
            trimmed.append(s)

    return trimmed

def _ensure_tags_by_slugs(slugs: List[str]) -> List[Dict[str, Any]]:
    if not slugs:
        return []
    uniq = list(dict.fromkeys([s for s in slugs if s in ALLOWED_TAGS]))
    if not uniq:
        return []
    try:
        resp = sb.table("tags").select("id, slug").in_("slug", uniq).execute()
        return resp.data or []
    except APIError as e:
        print(f"⚠️  Tag fetch failed: {e}")
        return []

def attach_tags_via_taggings(event_id: Any, tag_rows: List[Dict[str, Any]]) -> None:
    """Insert rows into public.taggings for this event, skipping existing ones."""
    if not tag_rows:
        return
    event_id_str = str(event_id)
    try:
        existing = sb.table("taggings") \
            .select("tag_id") \
            .eq("taggable_type", "all_events") \
            .eq("taggable_id", event_id_str) \
            .execute()
        existing_ids = {row["tag_id"] for row in (existing.data or [])}
    except APIError:
        existing_ids = set()

    rows = [
        {"tag_id": t["id"], "taggable_type": "all_events", "taggable_id": event_id_str}
        for t in tag_rows if t["id"] not in existing_ids
    ]
    if not rows:
        return
    try:
        sb.table("taggings").insert(rows).execute()
    except APIError as e:
        print(f"⚠️  Taggings insert failed: {e}")

# ── DB Writes ───────────────────────────────────────────────────────
def upsert_venue(name: str) -> Optional[Any]:
    try:
        res = sb.table("venues") \
            .upsert({"name": name}, on_conflict=["name"], returning="representation") \
            .execute()
        if res.data:
            return res.data[0]["id"]
        sel = sb.table("venues").select("id").eq("name", name).limit(1).execute()
        return sel.data[0]["id"] if sel.data else None
    except APIError as e:
        print(f"⚠️  Venue upsert failed: {e}")
        return None

def upsert_event(ev: Dict[str, Any], venue_id: Optional[Any]) -> Optional[Dict[str, Any]]:
    record = {
        "name":        ev["title"],
        "link":        ev["link"],
        "image":       ev.get("image"),
        "start_date":  ev.get("start_date"),
        "start_time":  ev.get("start_time"),
        "end_time":    ev.get("end_time"),
        "description": ev.get("description"),
        "venue_id":    venue_id,
        "source":      SOURCE,
        "slug":        ev.get("slug"),
    }
    try:
        res = sb.table("all_events").upsert(
            record, on_conflict=["link"], returning="representation"
        ).execute()
        if res.data:
            return res.data[0]
        sel = sb.table("all_events").select("id, link").eq("link", ev["link"]).limit(1).execute()
        return sel.data[0] if sel.data else None
    except APIError as e:
        print(f"❌ Upsert failed for {ev['title']}: {e}")
        return None

# ── Main ────────────────────────────────────────────────────────────
def main() -> None:
    events = scrape_events()
    print(f"🔎 Found {len(events)} events on Bok/Tockify")

    if not events:
        print("No events to write.")
        return

    venue_id = upsert_venue(VENUE_NAME)

    inserted = 0
    tagged = 0

    for ev in events:
        stored = upsert_event(ev, venue_id)
        if not stored:
            continue
        inserted += 1

        slugs = predict_tag_slugs(ev["title"], ev.get("description"))
        tag_rows = _ensure_tags_by_slugs(slugs)
        attach_tags_via_taggings(stored["id"], tag_rows)

        if tag_rows:
            tagged += 1
            print(f"🏷️  {ev['title']} -> {', '.join([t['slug'] for t in tag_rows])}")
        else:
            print(f"—  {ev['title']} (no tags)")

    print(f"✅ Upserted {inserted} events; tagged {tagged} via taggings.")

if __name__ == "__main__":
    main()
