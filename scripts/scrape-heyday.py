# scripts/scrape-heyday.py

import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

URL = "https://philadelphia.leaguelab.com/leagues"

def scrape_heyday_leagues():
    res = requests.get(URL)
    soup = BeautifulSoup(res.text, 'html.parser')
    leagues = []

    rows = soup.find_all('tr', class_='widget-league-listing')

    for row in rows:
        link_tag = row.find('a', class_='registration-link')
        if not link_tag:
            continue

        image_tag = row.find('img', class_='league-icon')
        desc_row = row.find_next_sibling('tr', class_='widget-short-description')
        desc = desc_row.find('td', class_='shortDescription').get_text(strip=True) if desc_row else ''

        league = {
            "sport": safe_get_text(row, "Sport:"),
            "location": safe_get_text(row, "Location:"),
            "days": safe_get_text(row, "Days:"),
            "time": safe_get_text(row, "Time(s):"),
            "gender": safe_get_text(row, "Gender(s):"),
            "format": safe_get_text(row, "Format:"),
            "team_price": safe_get_text(row, "Team Price:"),
            "individual_price": safe_get_text(row, "Individual Price:"),
            "start_date": safe_get_text(row, "Start Date:"),
            "signup_deadline": safe_get_text(row, "Signup Deadline:"),
            "status": safe_get_text(row, "Status:"),
            "link": link_tag['href'],
            "image": image_tag['src'] if image_tag else None,
            "description": desc
        }

        leagues.append(league)

    return leagues


def safe_get_text(row, label):
    span = row.find('span', string=lambda text: text and label in text)
    if span:
        return span.next_sibling.strip() if span.next_sibling else ''
    return ''


def upsert_leagues(leagues):
    for league in leagues:
        print(f"Inserting or Updating: {league['sport']} at {league['location']}")
        supabase.table("heyday_leagues").upsert(league, on_conflict=["link"]).execute()


if __name__ == "__main__":
    leagues = scrape_heyday_leagues()
    print(f"Found {len(leagues)} leagues")

    if leagues:
        upsert_leagues(leagues)
