#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
South Street Headhouse District -> public.group_events (Playwright, MEC-only)
- Navigates to /events
- Waits for MEC cards to render
- Expands month dividers
- Clicks "Load More" until no new items (or cap)
- Parses and upserts into group_events
"""

import os, re, html, json, asyncio
from urllib.parse import urljoin, urlparse, urlunparse
from datetime import date as d

from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError
from playwright.async_api import async_playwright

# ── Config ────────────────────────────────────────────────────────────────────
GROUP_ID = "bec42575-dd24-484e-9c93-f9dd1cdf5e19"
USER_ID  = "26f671a4-2f54-4377-9518-47c7f21663c7"
URL_MEC  = "https://southstreet.com/events/"

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Helpers ───────────────────────────────────────────────────────────────────
_SLUG_NONALNUM = re.compile(r"[^a-z0-9]+")
MONTH = {"Jan":1,"Feb":2,"Mar":3,"Apr":4,"May":5,"Jun":6,"Jul":7,"Aug":8,"Sep":9,"Oct":10,"Nov":11,"Dec":12}

def slugify(s: str) -> str:
    s = (s or "").lower().replace("&", " and ")
    s = html.unescape(s)
    s = _SLUG_NONALNUM.sub("-", s)
    return s.strip("-")

def canon_link(u: str) -> str | None:
    if not u: return None
    p = urlparse(u)
    scheme = "https"
    netloc = (p.netloc or "").lower()
    path = (p.path or "/").rstrip("/") or "/"
    return urlunparse((scheme, netloc, path, "", "", ""))

def parse_time_12h(s: str) -> str | None:
    if not s: return None
    m = re.match(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", s.strip().lower())
    if not m: return None
    hh = int(m.group(1)); mm = int(m.group(2) or 0); ap = m.group(3)
    if ap == "pm" and hh != 12: hh += 12
    if ap == "am" and hh == 12: hh = 0
    return f"{hh:02d}:{mm:02d}:00"

def parse_card_date(txt: str) -> str | None:
    m = re.search(r"(\d{1,2})\s+([A-Za-z]{3})", txt or "")
    if not m: return None
    day = int(m.group(1)); mon = MONTH.get(m.group(2).title())
    if not mon: return None
    today = d.today()
    cand = d(today.year, mon, day)
    year = today.year + 1 if (cand - today).days < -60 else today.year
    return d(year, mon, day).isoformat()

def dedupe(rows):
    seen, out = set(), []
    for ev in rows:
        key = ev.get("_link") or ev["slug"]
        if key not in seen:
            seen.add(key); out.append(ev)
    return out

# ── MEC parser ────────────────────────────────────────────────────────────────
def parse_mec(html_text: str, base_url: str):
    soup = BeautifulSoup(html_text, "html.parser")
    out = []
    for art in soup.select("article.mec-event-article"):
        classes = art.get("class") or []
        if "mec-past-event" in classes:
            # Skip explicitly-marked past events
            continue

        a = art.select_one(".mec-event-title a")
        if not a:
            continue
        title = a.get_text(strip=True)
        link = a.get("href", "").strip()
        if link and not link.startswith(("http://", "https://")):
            link = urljoin(base_url, link)
        link = canon_link(link)

        desc_el = art.select_one(".mec-event-description")
        desc = html.unescape(desc_el.get_text(" ", strip=True)) if desc_el else None

        img = art.select_one(".mec-event-image img")
        img_url = img.get("src") if img else None
        if img_url and not img_url.startswith(("http://","https://")):
            img_url = urljoin(base_url, img_url)

        date_el = art.select_one(".mec-date-details .mec-start-date-label")
        sd = parse_card_date(date_el.get_text(strip=True)) if date_el else None

        st_el = art.select_one(".mec-time-details .mec-start-time")
        et_el = art.select_one(".mec-time-details .mec-end-time")
        st = parse_time_12h(st_el.get_text(strip=True)) if st_el else None
        et = parse_time_12h(et_el.get_text(strip=True)) if et_el else None
        if et == st: et = None

        venue_span = art.select_one(".mec-venue-details span")
        venue = venue_span.get_text(strip=True) if venue_span else None

        slug = slugify(f"{title}-{sd or 'tbd'}-{venue or ''}")
        out.append({
            "group_id": GROUP_ID, "title": title, "description": desc,
            "address": None, "latitude": None, "longitude": None,
            "start_date": sd, "end_date": None, "start_time": st, "end_time": et,
            "image_url": img_url, "slug": slug, "_link": link,
        })
    return dedupe(out)

# ── DB write ───────────────────────────────────────────────────────────────────
def upsert_group_events(rows):
    if not rows:
        print("No events to write."); return
    for ev in rows:
        payload = {
            "group_id": ev["group_id"], "user_id": USER_ID,
            "title": ev["title"], "description": ev.get("description"),
            "address": ev.get("address"), "latitude": ev.get("latitude"), "longitude": ev.get("longitude"),
            "start_date": ev.get("start_date"), "end_date": ev.get("end_date"),
            "start_time": ev.get("start_time"), "end_time": ev.get("end_time"),
            "image_url": ev.get("image_url"), "slug": ev.get("slug"),
        }
        try:
            sel = sb.table("group_events").select("id").eq("slug", payload["slug"]).execute()
            existing = sel.data if hasattr(sel, "data") else []
        except APIError as e:
            print(f"❌ Select failed for {payload['slug']}: {e}"); existing = []
        if existing:
            gid = existing[0]["id"]
            try:
                sb.table("group_events").update(payload).eq("id", gid).execute()
                print(f"♻️  Updated: {payload['title']} ({payload['slug']})")
            except APIError as e:
                print(f"❌ Update failed for {payload['slug']}: {e}")
        else:
            try:
                sb.table("group_events").insert(payload).execute()
                print(f"➕ Inserted: {payload['title']} ({payload['slug']})")
            except APIError as e:
                print(f"❌ Insert failed for {payload['slug']}: {e}")

# ── Playwright flow for MEC page ──────────────────────────────────────────────
async def get_mec_full_html(play, url: str, max_load_more_clicks: int = 6) -> str | None:
    browser = await play.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
    ctx = await browser.new_context(
        user_agent=("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"),
        locale="en-US",
        ignore_https_errors=True,
    )
    page = await ctx.new_page()

    # Reduce headless fingerprinting a bit
    await page.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
    """)

    try:
        # Warmup
        await page.goto("https://southstreet.com/", wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(600)

        # MEC page
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)

        # Some sites lazy-render; wait for the MEC container or any article
        try:
            await page.wait_for_selector("article.mec-event-article, .mec-skin-list-events-container", timeout=30000)
        except Exception:
            # Try a small scroll to trigger lazy load
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(800)
            await page.wait_for_selector("article.mec-event-article", timeout=10000)

        # Expand month dividers if present
        dividers = page.locator(".mec-month-divider i")
        count = await dividers.count()
        for i in range(count):
            try:
                await dividers.nth(i).click()
                await page.wait_for_timeout(200)
            except Exception:
                pass

        # Click "Load More" repeatedly until no growth or cap reached
        prev_count = await page.locator("article.mec-event-article").count()
        for _ in range(max_load_more_clicks):
            btn = page.locator(".mec-load-more-button").first
            if not await btn.is_visible():
                break
            try:
                await btn.click()
                # Wait for network and DOM to settle and number of articles to increase
                await page.wait_for_load_state("networkidle", timeout=30000)
                await page.wait_for_timeout(900)
                # small scroll to trigger any lazy observers
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await page.wait_for_timeout(500)
                new_count = await page.locator("article.mec-event-article").count()
                if new_count <= prev_count:
                    break
                prev_count = new_count
            except Exception:
                break

        # Ensure we really have articles
        total = await page.locator("article.mec-event-article").count()
        print(f"🧭 MEC DOM shows {total} <article> nodes before parse")
        return await page.content()

    finally:
        await ctx.close()
        await browser.close()

# ── Main ──────────────────────────────────────────────────────────────────────
async def main():
    async with async_playwright() as play:
        html_doc = await get_mec_full_html(play, URL_MEC, max_load_more_clicks=8)
        rows = parse_mec(html_doc, URL_MEC) if html_doc else []
        print(f"🔎 Found {len(rows)} South Street events")
        upsert_group_events(rows)

if __name__ == "__main__":
    asyncio.run(main())
