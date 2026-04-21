from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from langchain_mistralai import ChatMistralAI
from langchain_core.messages import SystemMessage, HumanMessage
from auth import get_preferences
from dotenv import load_dotenv
import httpx
import os
import json
from datetime import datetime

load_dotenv()

router = APIRouter(prefix="/trip", tags=["trip"])

llm = ChatMistralAI(model="mistral-small-latest", api_key=os.getenv("MISTRAL_API_KEY"))
GOOGLE_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")


# ── Models ──
class TripPlanRequest(BaseModel):
    source: str
    destination: str
    start_date: str
    end_date: str
    budget: str  # "budget", "moderate", "premium", "luxury"
    travel_mode: str  # "train", "flight", "bus", "any"
    group_size: int = 2
    interests: List[str] = []
    user_id: Optional[int] = None


# ── Google Places: search destination for hotels, restaurants, attractions ──
def search_places_at_destination(destination: str, category: str, max_results: int = 8) -> str:
    if not GOOGLE_API_KEY:
        return f"No Google API key configured. Cannot search {category}."

    # First, geocode the destination
    geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
    geo_resp = httpx.get(geocode_url, params={"address": destination, "key": GOOGLE_API_KEY}, timeout=10)
    geo_data = geo_resp.json()

    if not geo_data.get("results"):
        return f"Could not geocode destination: {destination}"

    location = geo_data["results"][0]["geometry"]["location"]
    lat, lng = location["lat"], location["lng"]

    # Category-specific keywords
    keywords = {
        "hotels": "hotel OR resort OR stay OR lodge",
        "restaurants": "restaurant OR cafe OR dining OR food",
        "attractions": "tourist attraction OR monument OR museum OR park OR temple",
        "nightlife": "bar OR nightclub OR pub OR lounge",
        "breakfast": "cafe OR breakfast OR bakery",
    }

    keyword = keywords.get(category, category)

    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lng}",
        "radius": 15000,
        "keyword": keyword,
        "key": GOOGLE_API_KEY,
    }

    try:
        response = httpx.get(url, params=params, timeout=10)
        data = response.json()
    except Exception as e:
        return f"Google Places API error: {str(e)}"

    results = data.get("results", [])
    if not results:
        return f"No {category} found near {destination}."

    output = f"Found {len(results)} {category} near {destination}:\n"
    for el in results[:max_results]:
        name = el.get("name", "Unnamed")
        address = el.get("vicinity", "Unknown")
        rating = el.get("rating", 0)
        reviews = el.get("user_ratings_total", 0)
        price = el.get("price_level", "N/A")
        price_str = "₹" * price if isinstance(price, int) and price > 0 else "N/A"
        output += f"- {name} | {address} | Rating: {rating}/5 ({reviews} reviews) | Price: {price_str}\n"

    return output


# ── Google Maps: get travel info between source and destination ──
def get_travel_info(source: str, destination: str, mode: str = "driving") -> str:
    if not GOOGLE_API_KEY:
        return "No Google API key for directions."

    maps_mode = {
        "train": "transit",
        "flight": "driving",
        "bus": "transit",
        "any": "driving",
    }.get(mode, "driving")

    url = "https://maps.googleapis.com/maps/api/directions/json"
    params = {
        "origin": source,
        "destination": destination,
        "mode": maps_mode,
        "key": GOOGLE_API_KEY,
    }

    try:
        response = httpx.get(url, params=params, timeout=10)
        data = response.json()
    except Exception as e:
        return f"Directions API error: {str(e)}"

    routes = data.get("routes", [])
    if not routes:
        return f"No route found from {source} to {destination}."

    leg = routes[0]["legs"][0]
    distance = leg.get("distance", {}).get("text", "Unknown")
    duration = leg.get("duration", {}).get("text", "Unknown")

    return f"Distance: {distance} | Travel time: {duration} (by {mode})"


# ── Stream trip plan generation ──
async def stream_trip_plan(req: TripPlanRequest):
    """
    Async generator that yields SSE-formatted JSON lines for trip planning.
    """
    try:
        # Step 1: Get travel info
        yield json.dumps({"type": "status", "content": "🗺️ Calculating route & travel details..."})
        travel_info = get_travel_info(req.source, req.destination, req.travel_mode)

        # Step 2: Search for hotels
        yield json.dumps({"type": "status", "content": "🏨 Finding hotels & accommodations..."})
        hotels_data = search_places_at_destination(req.destination, "hotels")

        # Step 3: Search for restaurants
        yield json.dumps({"type": "status", "content": "🍽️ Discovering restaurants & cafés..."})
        restaurants_data = search_places_at_destination(req.destination, "restaurants")

        # Step 4: Search for attractions
        yield json.dumps({"type": "status", "content": "🎯 Finding attractions & things to do..."})
        attractions_data = search_places_at_destination(req.destination, "attractions")

        # Step 5: Search for nightlife
        yield json.dumps({"type": "status", "content": "🎉 Exploring nightlife & entertainment..."})
        nightlife_data = search_places_at_destination(req.destination, "nightlife")

        # Step 6: Breakfast spots
        yield json.dumps({"type": "status", "content": "☕ Finding breakfast & café spots..."})
        breakfast_data = search_places_at_destination(req.destination, "breakfast")

        # Step 7: User preferences
        prefs_context = ""
        if req.user_id:
            prefs = get_preferences(req.user_id)
            if prefs and prefs.get("onboarding_completed"):
                prefs_context = f"""
USER PREFERENCES:
- Favourite cuisines: {', '.join(prefs.get('cuisines', []))}
- Preferred vibe: {', '.join(prefs.get('vibe', []))}
- Budget preference: {prefs.get('budget', 'moderate')}
- Group type: {prefs.get('group_type', 'friends')}
- Preferred outing time: {', '.join(prefs.get('outing_time', []))}
- Dislikes (AVOID these): {', '.join(prefs.get('dislikes', []))}
"""

        # Calculate trip duration
        try:
            start = datetime.strptime(req.start_date, "%Y-%m-%d")
            end = datetime.strptime(req.end_date, "%Y-%m-%d")
            num_days = max((end - start).days, 1)
        except:
            num_days = 3

        yield json.dumps({"type": "status", "content": f"🤖 AI is crafting {num_days}-day itineraries for you..."})

        # Step 8: LLM generates itineraries
        system_msg = """You are an expert travel planner AI. You create detailed, practical, and exciting trip itineraries.

STRICT OUTPUT RULES:
1. Return ONLY valid JSON. No text outside the JSON.
2. Generate exactly 3-4 different itinerary options.
3. Each itinerary must cover EVERY day of the trip with specific timings, real place names, and activities.
4. Include realistic estimated costs in INR (₹).
5. Use the REAL hotels, restaurants, and attractions from the Google data provided.
6. Start your response with { and end with }. No exceptions.
7. Make each itinerary genuinely different in style/approach.

ITINERARY STYLES:
- Itinerary 1: Budget-Friendly — cheapest transport, affordable stays, free attractions
- Itinerary 2: Balanced — mid-range everything, best value mix
- Itinerary 3: Premium — best-rated hotels/restaurants, exclusive experiences
- Itinerary 4: Adventure/Unique — offbeat spots, local hidden gems, unique experiences"""

        human_msg = f"""TRIP DETAILS:
- From: {req.source}
- To: {req.destination}
- Dates: {req.start_date} to {req.end_date} ({num_days} days)
- Budget Level: {req.budget}
- Travel Mode Preference: {req.travel_mode}
- Group Size: {req.group_size}
- Special Interests: {', '.join(req.interests) if req.interests else 'General sightseeing'}

{prefs_context}

TRAVEL ROUTE DATA:
{travel_info}

REAL HOTELS AT DESTINATION:
{hotels_data}

REAL RESTAURANTS AT DESTINATION:
{restaurants_data}

REAL ATTRACTIONS AT DESTINATION:
{attractions_data}

NIGHTLIFE OPTIONS:
{nightlife_data}

BREAKFAST & CAFÉ SPOTS:
{breakfast_data}

TASK: Create 3-4 complete itineraries using the REAL places above.

Return this EXACT JSON structure:
{{
  "trip_summary": {{
    "source": "{req.source}",
    "destination": "{req.destination}",
    "dates": "{req.start_date} to {req.end_date}",
    "duration": "{num_days} days",
    "group_size": {req.group_size},
    "travel_distance": ""
  }},
  "itineraries": [
    {{
      "id": 1,
      "name": "Budget Explorer",
      "style": "budget",
      "tagline": "Maximum experience, minimum spend",
      "estimated_total_cost": "₹XXXXX",
      "cost_breakdown": {{
        "transport": "₹XXXX",
        "accommodation": "₹XXXX",
        "food": "₹XXXX",
        "activities": "₹XXXX"
      }},
      "transport": {{
        "mode": "train/flight/bus",
        "details": "Train name/flight suggestion",
        "estimated_cost": "₹XXXX",
        "booking_tip": "Book on IRCTC/MakeMyTrip/etc",
        "departure_time": "",
        "arrival_time": ""
      }},
      "hotel": {{
        "name": "Real hotel name from data",
        "rating": 4.2,
        "price_per_night": "₹XXXX",
        "why_chosen": "Great value near attractions",
        "address": ""
      }},
      "days": [
        {{
          "day": 1,
          "title": "Arrival & City Vibes",
          "schedule": [
            {{
              "time": "09:00 AM",
              "activity": "Arrive at destination",
              "type": "transport",
              "place": "",
              "cost": "₹0",
              "tip": ""
            }},
            {{
              "time": "12:00 PM",
              "activity": "Lunch at local restaurant",
              "type": "meal",
              "place": "Real restaurant name",
              "cost": "₹XXX",
              "tip": "Try the local specialty"
            }}
          ]
        }}
      ],
      "highlights": ["highlight 1", "highlight 2", "highlight 3"]
    }}
  ]
}}"""

        # Stream LLM response
        async for chunk in llm.astream([SystemMessage(content=system_msg), HumanMessage(content=human_msg)]):
            if chunk.content:
                yield json.dumps({"type": "token", "content": chunk.content})

        yield json.dumps({"type": "done"})

    except Exception as e:
        yield json.dumps({"type": "error", "content": str(e)})
