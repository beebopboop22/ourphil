import os
import json
import html
import time
import re
from datetime import datetime

from dotenv import load_dotenv
import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from supabase import create_client, Client

# ── Load environment variables ─────────────────────────────────────────────────
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── User-agent for Selenium ─────────────────────────────────────────────────────
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/114.0.0.0 Safari/537.36"
    ),
}

def slugify(text: str) -> str:
    s = text.lower()
    s = re.sub(r'&', ' and ', s)
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

def get_or_create_venue(client: Client, slug: str, name: str) -> int:
    # try select
    r = client.table("venues").select("id").eq("slug", slug).execute()
    if r.data:
        return r.data[0]["id"]
    # insert new
    payload = {"name": name, "slug": slug}
    r = client.table("venues").insert(payload).select("id").execute()
    if r.data:
        return r.data[0]["id"]
    raise RuntimeError(f"Could not get or create venue {slug}")

def scrape_events():
    URL = "https://citywinery.com/philadelphia/events"

    # fetch via Selenium (bypass CF/JS)
    opts = Options()
    opts.add_argument("--headless")
    opts.add_argument(f"user-agent={HEADERS['User-Agent']}")
    driver = webdriver.Chrome(options=opts)
    driver.get(URL)
    time.sleep(5)
    html_src = driver.page_source
    driver.quit()

    soup = BeautifulSoup(html_src, "html.parser")

    # find any <astro-island> with a props attr that contains "events"
    data = None
    for ai in soup.find_all("astro-island"):
        props = ai.get("props") or ai.get("data-props")
        if not props:
            continue
        if '"events"' in props:
            raw = html.unescape(props)
            data = json.loads(raw)
            break

    if not data or "events" not in data:
        print("❌ Could not locate events JSON on the page.")
        return []

    raw_ev = data["events"]
    # raw_ev is often [1, [ [0,obj], [0,obj], ... ]]
    if isinstance(raw_ev, list) and len(raw_ev) >= 2 and isinstance(raw_ev[1], list):
        pairs = raw_ev[1]
    elif isinstance(raw_ev, list) and all(isinstance(x, list) for x in raw_ev):
        pairs = raw_ev
    else:
        print("❌ No events found, exiting.")
        return []

    events = []
    for _, ev in pairs:
        name = ev.get("name", [None, None])[1]
        slug = ev.get("url", [None, None])[1]
        img  = ev.get("image", [None, None])[1]
        start_iso = ev.get("start", [None, None])[1]
        end_iso   = ev.get("end",   [None, None])[1]
        desc = ev.get("slogan", [None, ""])[1] or None

        if not (name and slug and start_iso):
            continue

        # parse start
        dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
        sd = dt.date().isoformat()
        st = dt.time().isoformat(timespec="minutes")

        # parse optional end
        et = None
        if end_iso:
            dt2 = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
            et = dt2.time().isoformat(timespec="minutes")

        events.append({
            "title":       name,
            "slug":        slug,
            "link":        f"https://citywinery.com/philadelphia/events/{slug}",
            "image":       img,
            "start_date":  sd,
            "start_time":  st,
            "end_time":    et,
            "description": desc,
            "venue_name":  "City Winery Philadelphia",
        })

    return events

def upsert_data(events):
    for ev in events:
        print(f"⏳ Processing: {ev['title']}")
        vs = ev["venue_name"]
        vslug = slugify(vs)
        vid = get_or_create_venue(supabase, vslug, vs)

        rec = {
            "name":        ev["title"],
            "link":        ev["link"],
            "image":       ev["image"],
            "start_date":  ev["start_date"],
            "description": ev["description"],
            "venue_id":    vid,
            "source":      "citywinery",
            "slug":        ev["slug"],
        }
        if ev["start_time"]:
            rec["start_time"] = ev["start_time"]
        if ev["end_time"]:
            rec["end_time"] = ev["end_time"]

        supabase.table("all_events") \
                .upsert(rec, on_conflict=["link"]) \
                .execute()
        print(f"✅ Upserted: {ev['title']}")

if __name__ == "__main__":
    evs = scrape_events()
    print(f"🔎 Found {len(evs)} events")
    if evs:
        upsert_data(evs)
