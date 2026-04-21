from langchain_core.tools import tool
from Database import search_activities_by_location
import httpx
import os

@tool
def find_activities(lat: float, lng: float, radius_km: float, category: str) -> str:
    """
    Find activities near a location from local database.
    Category must be one of: party, eating, group_play, all.
    Returns a list of nearby activities with distance.
    """
    results = search_activities_by_location(lat, lng, radius_km, category)
    if not results:
        return "No activities found in that area."
    output = f"Found {len(results)} activities:\n"
    for r in results:
        output += f"- {r['name']} ({r['category']}) — {r['distance_km']:.1f}km away. {r['description']} at {r['address']}\n"
    return output


@tool
def search_real_places(lat: float, lng: float, radius_m: int, category: str, min_rating: float = 0.0, max_results: int = 10) -> str:
    """
    Search for real places near a location using Google Places API.
    Category must be one of: party, eating, group_play, all.
    radius_m is the search radius in meters.
    min_rating filters places by minimum star rating.
    max_results limits the number of returned places.
    """
    google_api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not google_api_key:
        return "Google Places API key is missing. Please configure it in the .env file."

    if category == 'party':
        keyword = 'bar OR nightclub OR pub'
    elif category == 'eating':
        keyword = 'restaurant OR cafe OR food'
    elif category == 'group_play':
        keyword = 'entertainment OR bowling OR arcade OR activity'
    else:
        keyword = 'restaurant OR bar OR activity'

    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lng}",
        "radius": radius_m,
        "keyword": keyword,
        "key": google_api_key
    }

    try:
        response = httpx.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        return f"Could not fetch real places from Google Places API: {str(e)}"

    results = data.get("results", [])
    
    # Filter by minimum rating
    if min_rating > 0:
        results = [r for r in results if r.get("rating", 0) >= min_rating]

    if not results:
        return f"No {category} places found with rating >={min_rating} in that area on Google Maps."

    output = f"Found {len(results)} real places nearby on Google Maps:\n"
    # Take requested max_results
    for el in results[:max_results]:
        name = el.get("name", "Unnamed place")
        address = el.get("vicinity", "Unknown address")
        rating = el.get("rating", 0)
        reviews = el.get("user_ratings_total", 0)
        types = el.get("types", [])
        primary_type = types[0].replace("_", " ") if types else category
        
        output += f"- {name} ({primary_type}) — {address} | Rating: {rating}/5 ({reviews} reviews)\n"

    return output