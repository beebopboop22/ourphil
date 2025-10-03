import os
import re
import json
import uuid
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
import pytz
import requests
from slugify import slugify  # pip install python-slugify

# --- CONFIG ---
GROUP_ID = "e987c463-14e3-4ed2-96db-b571fb048146"  # Philly Girls Who Walk
# You can use either the vanity URL or the communityId form:
HEYLO_URL = "https://www.heylo.com/g/phillygirlswhowalk"
# HEYLO_URL = "https://www.heylo.com/g/3022c3f1-0422-447c-a36a-99ec0c5ed142"

# DB connection: set via env or hardcode for testing
PG_DSN = os.getenv(
    "PG_DSN",
    "dbname=postgres user=postgres password=postgres host=localhost port=5432",
)

# --- HELPERS ---
def fetch_next_data(url: str) -> dict:
    html = requests.get(url, timeout=30).text
    m = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html, re.S
    )
    if not m:
        raise RuntimeError("Could not find __NEXT_DATA__ JSON on the page.")
    return json.loads(m.group(1))

def extract_events(next_data: dict):
    q = (
        next_data["props"]["pageProps"]["dehydratedState"]["queries"][0]
        ["state"]["data"]
    )
    profile = q["communityProfile"]
    tz_str = profile.get("timezone", "America/New_York")
    tz = pytz.timezone(tz_str)

    events_out = []
    for ev in q.get("events", []):
        # Timestamp is epoch milliseconds (UTC)
        start_utc = datetime.fromtimestamp(ev["timestamp"] / 1000, tz=timezone.utc)
        start_local = start_utc.astimezone(tz)

        start_date = start_local.date().isoformat()
        start_time = start_local.time().replace(microsecond=0).isoformat()

        # Create a stable, readable slug; keep it <= 120 chars
        slug = slugify(f'{ev["name"]}-{start_date}-{ev["id"]}')[:120]

        # Deep link like /event/<id>?redirect=0
        source_url = f'https://www.heylo.com{ev["deepLink"]}' if ev.get("deepLink") else url

        events_out.append({
            "title": ev["name"],
            "image_url": ev.get("image"),
            "start_date": start_date,
            "start_time": start_time,
            "slug": slug,
            "source_url": source_url,
            "source_event_id": ev["id"],
            "timezone": tz_str,
        })
    return profile, events_out

UPSERT_SQL = """
INSERT INTO group_events (
  id, group_id, title, description, image_url,
  start_date, start_time, end_date, end_time,
  slug, source, source_event_id, source_url, created_at, updated_at
)
VALUES (
  gen_random_uuid(), %(group_id)s, %(title)s, %(description)s, %(image_url)s,
  %(start_date)s::date, %(start_time)s::time, NULL, NULL,
  %(slug)s, 'heylo', %(source_event_id)s, %(source_url)s, now(), now()
)
ON CONFLICT (source, source_event_id) DO UPDATE
SET title = EXCLUDED.title,
    image_url = EXCLUDED.image_url,
    start_date = EXCLUDED.start_date,
    start_time = EXCLUDED.start_time,
    slug = EXCLUDED.slug,
    source_url = EXCLUDED.source_url,
    updated_at = now();
"""

def upsert_events(rows):
    with psycopg2.connect(PG_DSN) as conn, conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        for r in rows:
            params = {
                "group_id": uuid.UUID(GROUP_ID),
                "title": r["title"],
                "description": None,  # Heylo doesn’t include body here; set if you want
                "image_url": r["image_url"],
                "start_date": r["start_date"],
                "start_time": r["start_time"],
                "slug": r["slug"],
                "source_event_id": r["source_event_id"],
                "source_url": r["source_url"],
            }
            cur.execute(UPSERT_SQL, params)
        conn.commit()

def main():
    data = fetch_next_data(HEYLO_URL)
    profile, events = extract_events(data)

    if not events:
        print("No events found on Heylo.")
        return

    upsert_events(events)
    print(f"Upserted {len(events)} events for group {GROUP_ID} ({profile.get('communityName')}).")

if __name__ == "__main__":
    main()
