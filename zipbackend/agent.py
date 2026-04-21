from langchain_mistralai import ChatMistralAI
from tools import find_activities, search_real_places
from dotenv import load_dotenv
import os
import json
from auth import get_preferences
from typing import Optional
from langchain_core.messages import SystemMessage, HumanMessage
from datetime import datetime

load_dotenv()

llm = ChatMistralAI(model="mistral-small-latest", api_key=os.getenv("MISTRAL_API_KEY"))


def run_search(lat: float, lng: float, radius_km: float, category: str) -> str:
    """Synchronous search — kept for backward compatibility."""
    return "Not implemented in v2"


async def stream_search(lat: float, lng: float, radius_km: float, category: str, max_results: int = 10, min_rating: float = 0.0, user_id: Optional[int] = None):
    """
    Async generator that yields SSE-formatted JSON lines.
    Event types:
      - status  : progress messages during tool execution
      - token   : streamed content tokens from the LLM
      - done    : signals the stream is complete
      - error   : an error occurred
    """
    try:
        # Step 1: Fetch raw data
        yield json.dumps({"type": "status", "content": "🌍 Searching for live places on Google Maps..."})
        google_results = search_real_places.invoke({
            "lat": lat,
            "lng": lng,
            "radius_m": int(radius_km * 1000),
            "category": category,
            "min_rating": min_rating,
            "max_results": max_results
        })

        yield json.dumps({"type": "status", "content": "✅ Data received, analyzing results..."})

        # Step 2: Build preferences
        if user_id:
            prefs = get_preferences(user_id)
        else:
            prefs = None

        if prefs and prefs.get('onboarding_completed'):
            cuisines = ", ".join(prefs.get('cuisines', []))
            vibe = ", ".join(prefs.get('vibe', []))
            dislikes = ", ".join(prefs.get('dislikes', []))
            budget = prefs.get('budget', '')
            group_type = prefs.get('group_type', '')
            outing_time = ", ".join(prefs.get('outing_time', []))

            system_msg = """You are a personal local guide. You know this user's taste deeply.
Your job is to filter and rank nearby venues specifically for THIS person.
Not the most popular — the most personally relevant.

STRICT RULES:
1. Return ONLY valid JSON. Zero text outside JSON.
2. Hard exclude any venue matching user's dislikes.
3. why_for_you must mention their actual preference — never generic.
4. If no good match exists, be honest in mismatch_note.
5. Rank by personal fit first, rating second.

ABSOLUTE RULE: Start your response with { and end with }.
No text before the opening brace. No text after the closing brace.
If you cannot follow this rule, return {"status": "error"}."""

            human_msg = f"""CURRENT CONTEXT:
- Time: {datetime.now().strftime('%I:%M %p, %a')}
- Coordinates: {lat}, {lng}
- Category: {category}
- Radius: {radius_km}km

USER PREFERENCE PROFILE:
- Loves: {cuisines}
- Vibe: {vibe}
- Budget: {budget}
- Group: {group_type}
- Goes out: {outing_time}
- Hard exclude (dislikes): {dislikes}

GOOGLE PLACES RAW DATA:
{google_results}

TASK:
Step 1 — Hard remove any venue matching dislikes
Step 2 — Score remaining venues: cuisine match + vibe match + budget match + group fit
Step 3 — Pick top 5 by score
Step 4 — Return this exact JSON:

{{
  "status": "success" | "partial_match" | "no_match",
  "recommendations": [
    {{
      "rank": 1,
      "name": "",
      "category": "",
      "address": "",
      "google_rating": 4.5,
      "price_level": "₹₹ (~₹800–1200 per person)",
      "match_score": "92%",
      "why_for_you": "Rooftop setting with Japanese menu — perfect for your group weekend plans",
      "highlights": ["", "", ""],
      "best_for": "",
      "open_now": true,
      "closing_time": "",
      "google_maps_link": ""
    }}
  ],
  "personalization_note": "",
  "mismatch_note": ""
}}"""
        else:
            system_msg = """You are a helpful local guide. Return ONLY valid JSON. Zero text outside JSON. Rank by rating.

ABSOLUTE RULE: Start your response with { and end with }.
No text before the opening brace. No text after the closing brace.
If you cannot follow this rule, return {"status": "error"}."""
            human_msg = f"""CURRENT CONTEXT:
- Coordinates: {lat}, {lng}
- Category: {category}
- Radius: {radius_km}km

GOOGLE PLACES RAW DATA:
{google_results}

TASK: Return the top 5 places formatted in this EXACT JSON structure:

{{
  "status": "success" | "no_match",
  "recommendations": [
    {{
      "rank": 1,
      "name": "",
      "category": "",
      "address": "",
      "google_rating": 4.5,
      "price_level": "",
      "match_score": "90%",
      "why_for_you": "",
      "highlights": ["", "", ""],
      "best_for": "",
      "open_now": true,
      "closing_time": "",
      "google_maps_link": ""
    }}
  ],
  "personalization_note": "",
  "mismatch_note": ""
}}"""

        # Stream the LLM response
        async for chunk in llm.astream([SystemMessage(content=system_msg), HumanMessage(content=human_msg)]):
            if chunk.content:
                yield json.dumps({"type": "token", "content": chunk.content})

        yield json.dumps({"type": "done"})

    except Exception as e:
        yield json.dumps({"type": "error", "content": str(e)})