from dotenv import load_dotenv
from swarms import Agent
from swarms.utils.str_to_dict import str_to_dict
from supabase import create_client
import os
import json

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Get group data
response = supabase.table("groups").select("Name, Description").limit(50).execute()
group_data = response.data if response.data else []

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
                                "WhyItMatches": {"type": "string"}
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

system_prompt = (
    "You are a group recommendation assistant.\n"
    "The user said: 'I'm into volunteering, animals, and creative expression'.\n"
    "You're given a list of groups. Choose 3 that best match and return:\n\n"
    "{\n"
    '  "output": [\n'
    "    {\n"
    '      "Name": "Group Name",\n'
    '      "Description": "Group Description",\n'
    '      "WhyItMatches": "One-sentence explanation of the match"\n'
    "    },\n"
    "    ...\n"
    "  ]\n"
    "}\n\n"
    "Return ONLY valid JSON."
)

agent = Agent(
    agent_name="Group Recommender",
    agent_description="Recommends 3 matching groups from a dataset",
    system_prompt=system_prompt,
    max_loops=1,
    tools_list_dictionary=tools
)

# Run agent with data
query = {
    "user_input": "I'm into volunteering, animals, and creative expression",
    "groups": group_data
}

response = agent.run(query)

print("RAW RESPONSE:")
print(response)
print("\nPARSED:")
print(json.dumps(str_to_dict(response), indent=2))
