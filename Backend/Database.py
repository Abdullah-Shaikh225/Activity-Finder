from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()

# Get the URL and replace the scheme for pg8000
db_url = os.getenv("DATABASE_URL")
# Handle both postgresql:// and postgres:// prefixes
db_url = db_url.replace("postgresql://", "postgresql+pg8000://").replace("postgres://", "postgresql+pg8000://")
# Strip query params not supported by pg8000 (SSL handled via connect_args)
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
parsed = urlparse(db_url)
params = parse_qs(parsed.query)
params.pop("sslmode", None)
params.pop("channel_binding", None)
clean_query = urlencode(params, doseq=True)
db_url = urlunparse(parsed._replace(query=clean_query))

engine = create_engine(
    db_url,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=5,
    max_overflow=10,
    connect_args={"ssl_context": True}  # Required for Neon SSL
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