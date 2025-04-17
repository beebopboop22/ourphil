from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client
import os
import requests

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SWARMS_API_KEY = os.getenv("SWARMS_API_KEY")
BASE_URL = "https://swarms-api-285321057562.us-east1.run.app"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

class RecommendationRequest(BaseModel):
    user_input: str

@app.post("/recommend-groups")
def recommend_groups(req: RecommendationRequest):
    user_input = req.user_input

    # Fetch group data from Supabase
    response = supabase.table("groups").select("Name, Description").limit(50).execute()
    group_data = response.data if response.data else []

    # JSON Schema for structured output
    tools = [
        {
            "type": "function",
            "function": {
                "name": "recommend_groups",
                "description": "Recommend 3 community groups based on a user's interests",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "output": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "Name": {"type": "string"},
                                    "Description": {"type": "string"},
                                    "WhyItMatches": {"type": "string"},
                                },
                                "required": ["Name", "Description", "WhyItMatches"]
                            }
                        }
                    },
                    "required": ["output"]
                }
            }
        }
    ]

    # Clear instruction for Swarms
    prompt = (
        f"The user said: '{user_input}'.\n"
        "You're given a list of groups with Name and Description.\n"
        "Pick 3 that best match the user's interests.\n"
        "Return ONLY valid JSON exactly in this format:\n"
        "{\n"
        '  "output": [\n'
        "    {\n"
        '      "Name": "Group Name",\n'
        '      "Description": "Group Description",\n'
        '      "WhyItMatches": "One-sentence reason it fits"\n'
        "    },\n"
        "    ...\n"
        "  ]\n"
        "}"
    )

    # Final payload to Swarms
    payload = {
        "name": "Group Recommender",
        "description": "Recommends local groups based on user input.",
        "system_prompt": prompt,
        "agents": [
            {
                "agent_name": "GroupSelector",
                "description": "Picks 3 matching groups based on user interest.",
                "system_prompt": prompt,
                "model_name": "gpt-4o-mini",
                "role": "worker"
            }
        ],
        "tools": tools,
        "task": prompt,
        "messages": [
            {
                "user_input": user_input,
                "groups": group_data
            }
        ],
        "swarm_type": "SequentialWorkflow",
        "max_loops": 1,
        "stream": False,
        "return_history": False
    }

    headers = {
        "x-api-key": SWARMS_API_KEY,
        "Content-Type": "application/json"
    }

    r = requests.post(f"{BASE_URL}/v1/swarm/completions", json=payload, headers=headers)
    return r.json()
