from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os
load_dotenv()
engine = create_engine(
    os.getenv("DATABASE_URL"),
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=5,
    max_overflow=10
)
def search_activities_by_location(lat, lng, radius_km, category):
    query = text("""
        SELECT name, category, description, address, lat, lng,
               ST_Distance(location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) / 1000 AS distance_km
        FROM activities
        WHERE ST_DWithin(
            location,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
            :radius_meters
        )
        AND (:category = 'all' OR category = :category)
        ORDER BY distance_km ASC
        LIMIT 20
    """)
    with engine.connect() as conn:
        result = conn.execute(query, {
            "lat": lat,
            "lng": lng,
            "radius_meters": radius_km * 1000,
            "category": category
        })
        return [dict(row._mapping) for row in result]