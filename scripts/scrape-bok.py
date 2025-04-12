import json
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client

# Supabase Credentials (directly hardcoded)
SUPABASE_URL = "https://qdartpzrxmftmaftfdbd.supabase.co"   # your real url
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkYXJ0cHpyeG1mdG1hZnRmZGJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxMDc3OTgsImV4cCI6MjA1ODY4Mzc5OH0.maFYGLz62w4n-BVERIvbxhIewzjPkkqJgXAn61FmIA8"            # your real key

# Initialize Supabase Client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# Target Tockify page
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
        print(event)  # Optional: see the raw event data

        data = {
            "title": event.get('title'),
            "date": event.get('date'),
            "link": event.get('link'),
            "image": event.get('image')  # <-- pulling image too!
        }

        print(f"Inserting: {data['title']}")

        supabase.table("bok_events").upsert(data).execute()



if __name__ == "__main__":
    events = scrape_events()
    print(f"Found {len(events)} events")

    if events:
        upsert_events(events)
