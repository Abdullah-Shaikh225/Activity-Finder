"""
Tracking Module — User Behavior Tracking & Signal Updates
Tracks clicks, bookmarks, and searches to dynamically update user preferences.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from Database import engine
from typing import Optional, List
import json
import re

router = APIRouter(prefix="/track", tags=["tracking"])


# ═══════════════════════════════════════════
#  Database Table Initialization
# ═══════════════════════════════════════════

# Tables are created manually via SQL editor (Neon Console).
# See SQL schema in project docs.


# ═══════════════════════════════════════════
#  Helper — Signal Update (UPSERT)
# ═══════════════════════════════════════════

def update_signal(user_id: int, signal_type: str, signal_value: str, weight: float):
    """
    Update or insert a user signal.
    - If signal exists → increase strength by weight
    - If not → insert new with initial strength = weight
    """
    if not signal_value or not signal_value.strip():
        return

    signal_value = signal_value.strip().lower()

    with engine.connect() as conn:
        # Check if signal already exists
        existing = conn.execute(
            text("""
                SELECT id, strength FROM user_signals
                WHERE user_id = :uid AND signal_type = :stype AND signal_value = :sval
            """),
            {"uid": user_id, "stype": signal_type, "sval": signal_value}
        ).fetchone()

        if existing:
            row = dict(existing._mapping)
            new_strength = row["strength"] + weight
            conn.execute(
                text("""
                    UPDATE user_signals
                    SET strength = :strength, updated_at = NOW()
                    WHERE id = :id
                """),
                {"strength": new_strength, "id": row["id"]}
            )
        else:
            conn.execute(
                text("""
                    INSERT INTO user_signals (user_id, signal_type, signal_value, strength, updated_at)
                    VALUES (:uid, :stype, :sval, :weight, NOW())
                """),
                {"uid": user_id, "stype": signal_type, "sval": signal_value, "weight": weight}
            )
        conn.commit()


# ═══════════════════════════════════════════
#  Metadata Extraction Helpers
# ═══════════════════════════════════════════

# Vibe keywords mapped to signal values
VIBE_KEYWORDS = {
    "romantic": "romantic",
    "cozy": "cozy",
    "chill": "chill",
    "party": "party",
    "nightlife": "nightlife",
    "rooftop": "rooftop",
    "outdoor": "outdoor",
    "aesthetic": "aesthetic",
    "family": "family-friendly",
    "fine dining": "fine-dining",
    "casual": "casual",
    "luxury": "luxury",
    "adventure": "adventure",
    "quiet": "quiet",
    "lively": "lively",
    "trendy": "trendy",
    "hipster": "hipster",
    "traditional": "traditional",
}

# Cuisine keywords
CUISINE_KEYWORDS = [
    "italian", "indian", "chinese", "japanese", "korean", "thai",
    "mexican", "american", "french", "mediterranean", "middle eastern",
    "sushi", "pizza", "burger", "biryani", "ramen", "tacos",
    "bbq", "seafood", "vegan", "vegetarian", "steakhouse",
    "cafe", "coffee", "dessert", "bakery", "ice cream",
]


def extract_metadata_from_place(place_name: str, category: str, highlights: list = None):
    """Extract vibe and cuisine signals from place metadata."""
    signals = []
    searchable = f"{place_name} {category} {' '.join(highlights or [])}".lower()

    # Extract vibe
    for keyword, vibe_value in VIBE_KEYWORDS.items():
        if keyword in searchable:
            signals.append(("vibe", vibe_value))

    # Extract cuisine
    for cuisine in CUISINE_KEYWORDS:
        if cuisine in searchable:
            signals.append(("cuisine", cuisine))

    # Category is always a signal
    if category:
        signals.append(("category", category.lower()))

    return signals


def extract_intent_from_query(query: str):
    """Extract intent signals from a search query.
    Example: 'romantic dinner' → vibe=romantic, cuisine=dinner
    """
    signals = []
    query_lower = query.lower()

    # Vibe detection
    for keyword, vibe_value in VIBE_KEYWORDS.items():
        if keyword in query_lower:
            signals.append(("vibe", vibe_value))

    # Cuisine detection
    for cuisine in CUISINE_KEYWORDS:
        if cuisine in query_lower:
            signals.append(("cuisine", cuisine))

    # Activity type keywords
    activity_keywords = {
        "dinner": "dining", "lunch": "dining", "breakfast": "dining",
        "brunch": "dining", "drinks": "nightlife", "club": "nightlife",
        "bar": "nightlife", "pub": "nightlife", "cafe": "cafe",
        "coffee": "cafe", "walk": "outdoor", "hike": "outdoor",
        "game": "gaming", "bowling": "gaming", "movie": "entertainment",
        "museum": "culture", "shopping": "shopping", "spa": "wellness",
    }
    for keyword, activity in activity_keywords.items():
        if keyword in query_lower:
            signals.append(("activity", activity))

    return signals


# ═══════════════════════════════════════════
#  Request Models
# ═══════════════════════════════════════════

class PlaceObject(BaseModel):
    place_id: Optional[str] = None
    name: str
    category: Optional[str] = ""
    address: Optional[str] = ""
    highlights: Optional[List[str]] = []
    rating: Optional[str] = ""
    price_level: Optional[str] = ""

class ClickRequest(BaseModel):
    user_id: int
    place: PlaceObject

class BookmarkRequest(BaseModel):
    user_id: int
    place: PlaceObject

class SearchTrackRequest(BaseModel):
    user_id: int
    query: str
    category: Optional[str] = ""
    lat: Optional[float] = None
    lng: Optional[float] = None

class UnbookmarkRequest(BaseModel):
    user_id: int
    place_name: str


# ═══════════════════════════════════════════
#  API Routes
# ═══════════════════════════════════════════

@router.post("/click")
def track_click(req: ClickRequest):
    """
    Track a place click.
    - Insert into user_clicks
    - Extract metadata (vibe, cuisine)
    - Update user_signals (+1 weight, +2 for repeat clicks)
    """
    try:
        with engine.connect() as conn:
            # Check for repeat click
            repeat = conn.execute(
                text("""
                    SELECT COUNT(*) as cnt FROM user_clicks
                    WHERE user_id = :uid AND place_name = :pname
                """),
                {"uid": req.user_id, "pname": req.place.name}
            ).fetchone()

            is_repeat = dict(repeat._mapping)["cnt"] > 0
            click_weight = 2.0 if is_repeat else 1.0

            # Insert click record
            conn.execute(
                text("""
                    INSERT INTO user_clicks (user_id, place_id, place_name, category, clicked_at)
                    VALUES (:uid, :pid, :pname, :cat, NOW())
                """),
                {
                    "uid": req.user_id,
                    "pid": req.place.place_id or req.place.name,
                    "pname": req.place.name,
                    "cat": req.place.category or "",
                }
            )
            conn.commit()

        # Extract metadata and update signals
        metadata_signals = extract_metadata_from_place(
            req.place.name,
            req.place.category or "",
            req.place.highlights or []
        )
        for signal_type, signal_value in metadata_signals:
            update_signal(req.user_id, signal_type, signal_value, click_weight)

        # Also update a "clicked_place" signal for the place itself
        update_signal(req.user_id, "clicked_place", req.place.name, click_weight)

        return {"status": "success"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bookmark")
def track_bookmark(req: BookmarkRequest):
    """
    Track a place bookmark.
    - Insert into user_bookmarks (handle duplicates)
    - Update user_signals (+3 weight)
    """
    try:
        with engine.connect() as conn:
            # Handle duplicate bookmarks gracefully
            existing = conn.execute(
                text("""
                    SELECT id FROM user_bookmarks
                    WHERE user_id = :uid AND place_name = :pname
                """),
                {"uid": req.user_id, "pname": req.place.name}
            ).fetchone()

            if existing:
                return {"status": "already_bookmarked", "message": "Place is already bookmarked"}

            # Insert bookmark
            conn.execute(
                text("""
                    INSERT INTO user_bookmarks (user_id, place_id, place_name, saved_at)
                    VALUES (:uid, :pid, :pname, NOW())
                """),
                {
                    "uid": req.user_id,
                    "pid": req.place.place_id or req.place.name,
                    "pname": req.place.name,
                }
            )
            conn.commit()

        # Extract metadata and update signals with bookmark weight (+3)
        metadata_signals = extract_metadata_from_place(
            req.place.name,
            req.place.category or "",
            req.place.highlights or []
        )
        for signal_type, signal_value in metadata_signals:
            update_signal(req.user_id, signal_type, signal_value, 3.0)

        # Also update a "bookmarked_place" signal
        update_signal(req.user_id, "bookmarked_place", req.place.name, 3.0)

        return {"status": "success"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/unbookmark")
def track_unbookmark(req: UnbookmarkRequest):
    """Remove a bookmark."""
    try:
        with engine.connect() as conn:
            conn.execute(
                text("""
                    DELETE FROM user_bookmarks
                    WHERE user_id = :uid AND place_name = :pname
                """),
                {"uid": req.user_id, "pname": req.place_name}
            )
            conn.commit()

        return {"status": "success"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
def track_search(req: SearchTrackRequest):
    """
    Track a search.
    - Insert into user_searches
    - Extract intent from query
    - Update user_signals
    """
    try:
        with engine.connect() as conn:
            conn.execute(
                text("""
                    INSERT INTO user_searches (user_id, query, category, lat, lng, searched_at)
                    VALUES (:uid, :query, :cat, :lat, :lng, NOW())
                """),
                {
                    "uid": req.user_id,
                    "query": req.query,
                    "cat": req.category or "",
                    "lat": req.lat,
                    "lng": req.lng,
                }
            )
            conn.commit()

        # Extract intent and update signals
        intent_signals = extract_intent_from_query(req.query)
        for signal_type, signal_value in intent_signals:
            update_signal(req.user_id, signal_type, signal_value, 1.5)

        # Category from search is also a signal
        if req.category:
            update_signal(req.user_id, "search_category", req.category.lower(), 1.5)

        return {"status": "success"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════
#  Query Routes — Get user's bookmarks/signals
# ═══════════════════════════════════════════

@router.get("/bookmarks/{user_id}")
def get_user_bookmarks(user_id: int):
    """Get all bookmarked place names for a user."""
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT place_name, place_id, saved_at
                    FROM user_bookmarks
                    WHERE user_id = :uid
                    ORDER BY saved_at DESC
                """),
                {"uid": user_id}
            ).fetchall()

        return {
            "status": "success",
            "bookmarks": [dict(r._mapping) for r in rows]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/signals/{user_id}")
def get_user_signals(user_id: int):
    """Get all signals for a user, ordered by strength."""
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT signal_type, signal_value, strength, updated_at
                    FROM user_signals
                    WHERE user_id = :uid
                    ORDER BY strength DESC
                """),
                {"uid": user_id}
            ).fetchall()

        return {
            "status": "success",
            "signals": [dict(r._mapping) for r in rows]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clicks/{user_id}")
def get_user_clicks(user_id: int):
    """Get recent click history for a user."""
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT place_name, place_id, category, clicked_at
                    FROM user_clicks
                    WHERE user_id = :uid
                    ORDER BY clicked_at DESC
                    LIMIT 50
                """),
                {"uid": user_id}
            ).fetchall()

        return {
            "status": "success",
            "clicks": [dict(r._mapping) for r in rows]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
