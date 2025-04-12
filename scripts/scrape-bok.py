import os
import json
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Supabase Credentials from .env
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Initialize Supabase Client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Tockify Bok Events URL
URL = "https://tockify.com/buildingbok/agenda"

def scrape_events():
    res = requests.get(URL)
    soup = BeautifulSoup(res.text, 'html.parser')
    events = []

    for script in soup.find_all('script', type='application/ld+json'):
        data = json.loads(script.string)

        if isinstance(data, list):
            for event in data:
                if event.get('@type') == 'Event':
                    events.append(parse_event(event))

    return events


def parse_event(event):
    return {
        "title": event.get('name'),
        "date": event.get('startDate'),
        "link": event.get('url'),
        "image": event.get('image', [None])[0] if event.get('image') else None
    }


def upsert_events(events):
    for event in events:
        print(f"Inserting or Updating: {event['title']}")

        data = {
            "title": event.get('title'),
            "date": event.get('date'),
            "link": event.get('link'),
            "image": event.get('image')
        }

        supabase.table("bok_events").upsert(data, on_conflict=["link"]).execute()


if __name__ == "__main__":
    events = scrape_events()
    print(f"Found {len(events)} events")

    if events:
        upsert_events(events)
