import os
import json
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv
import html  # Added for decoding weird characters

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

URL = "https://southstreet.com/things-to-do/"


def scrape_south_street_events():
    res = requests.get(URL)
    soup = BeautifulSoup(res.text, 'html.parser')
    events = []

    for script in soup.find_all('script', type='application/ld+json'):
        data = json.loads(script.string)

        if isinstance(data, list):
            for item in data:
                if item.get('@type') == 'Event':
                    events.append(parse_event(item))
        elif data.get('@type') == 'Event':
            events.append(parse_event(data))

    return events


def parse_event(event):
    return {
        "title": html.unescape(event.get('name')),
        "date": event.get('startDate'),
        "end_date": event.get('endDate'),
        "link": event.get('url'),
        "image": event.get('image'),
        "description": html.unescape((event.get('description')[:150] + "...") if event.get('description') else "")
    }


def upsert_events(events):
    for event in events:
        print(f"Inserting or Updating: {event['title']}")

        supabase.table("south_street_events") \
            .upsert(event, on_conflict=["link"]) \
            .execute()


if __name__ == "__main__":
    events = scrape_south_street_events()
    print(f"Found {len(events)} events")

    if events:
        upsert_events(events)

