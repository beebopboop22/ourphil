# swarms_mcp_server.py
import os
from fastmcp import FastMCP
import requests
from dotenv import load_dotenv
from supabase import create_client
from typing import Dict, Any

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SWARMS_API_KEY = os.getenv("SWARMS_API_KEY")
BASE_URL = "https://swarms-api-285321057562.us-east1.run.app"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
mcp = FastMCP("swarms-api")

@mcp.tool(name="group_recommendation", description="Recommend community groups based on user interests.")
def group_recommendation(input: Dict[str, Any]):
    user_input = input.get("user_input", "")

    # Pull groups from Supabase
    response = supabase.table("groups").select("Name, Description").limit(50).execute()
    group_data = response.data if response.data else []

    # Build the swarm payload
    payload = {
        "name": "Group Recommender",
        "description": "Recommends local Philly groups based on user input.",
        "task": f"The user said: '{user_input}'. Recommend 3 groups from the list below. Return JSON with Name, Description, and WhyItMatches.",
        "agents": [
            {
                "agent_name": "GroupSelector",
                "description": "Picks 3 best matching groups based on user interest.",
                "system_prompt": "Based on user interests, choose 3 groups from the list (each has a Name and Description). Return JSON with Name, Description, and WhyItMatches.",
                "model_name": "gpt-4o-mini",
                "role": "worker"
            }
        ],
        "swarm_type": "SequentialWorkflow",
        "max_loops": 1,
        "return_history": False,
        "stream": False,
        "messages": [
            {
                "user_input": user_input,
                "groups": group_data
            }
        ]
    }

    headers = {
        "x-api-key": SWARMS_API_KEY,
        "Content-Type": "application/json"
    }

    r = requests.post(f"{BASE_URL}/v1/swarm/completions", json=payload, headers=headers)
    return r.json()

if __name__ == "__main__":
    mcp.run(transport="websocket")


