#!/usr/bin/env python3
import os
import re
import json
import requests
from datetime import datetime
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# ── Load environment & init Supabase ────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Request headers ────────────────────────────────────────────────────────────
HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/115.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept":          "text/html,application/xhtml+xml,*/*;q=0.8",
}

BASE_URL = "https://www.tixr.com/groups/vinyl"

def slugify(text: str) -> str:
    s = text.lower()
    s = re.sub(r'&', ' and ', s)
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

def fetch_events():
    resp = requests.get(BASE_URL, headers=HEADERS, timeout=15)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    ld = soup.select_one('script[type="application/ld+json"]')
    if not ld:
        raise RuntimeError("No JSON-LD block found on page")

    data = json.loads(ld.string)
    events = data.get("events", [])
    parsed = []

    for ev in events:
        name      = ev.get("name")
        url       = ev.get("url")
        image     = ev.get("image")
        desc      = ev.get("description")
        start_iso = ev.get("startDate")
        end_iso   = ev.get("endDate")

        sd = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
        ed = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))

        parsed.append({
            "name":        name,
            "link":        url,
            "image":       image,
            "description": desc,
            "start_date":  sd.date().isoformat(),
            "end_date":    ed.date().isoformat(),
            "start_time":  sd.time().isoformat(),
            "end_time":    ed.time().isoformat(),
            "slug":        slugify(name),
        })

    return parsed

def upsert_events(events):
    # 1) Ensure the Vinyl venue exists
    venue_slug = "vinyl"
    q = supabase.from_("venues") \
        .select("id") \
        .eq("slug", venue_slug) \
        .limit(1) \
        .execute()

    if q.data:
        venue_id = q.data[0]["id"]
    else:
        ins = supabase.from_("venues") \
            .insert(
                {"name": "VINYL", "slug": venue_slug},
                returning="representation"
            ) \
            .execute()
        venue_id = ins.data[0]["id"]

    # 2) Upsert each event by checking slug
    for ev in events:
        print(f"⏳ Processing: {ev['name']}")
        record = {
            "venue_id":     venue_id,
            "name":         ev["name"],
            "link":         ev["link"],
            "image":        ev["image"],
            "description":  ev["description"],
            "start_date":   ev["start_date"],
            "end_date":     ev["end_date"],
            "start_time":   ev["start_time"],
            "end_time":     ev["end_time"],
            "slug":         ev["slug"],
            "source":       "vinyl",
        }

        # does a row with this slug already exist?
        check = supabase.from_("all_events") \
            .select("id") \
            .eq("slug", ev["slug"]) \
            .limit(1) \
            .execute()

        try:
            if check.data:
                # update
                supabase.from_("all_events") \
                    .update(record) \
                    .eq("slug", ev["slug"]) \
                    .execute()
                print(f"🔄 Updated: {ev['name']}")
            else:
                # insert
                supabase.from_("all_events") \
                    .insert(record) \
                    .execute()
                print(f"✅ Inserted: {ev['name']}")
        except Exception as e:
            print(f"❌ Failed to save {ev['name']}: {e}")

def main():
    evs = fetch_events()
    print(f"🔎 Found {len(evs)} events")
    if evs:
        upsert_events(evs)

if __name__ == "__main__":
    main()
