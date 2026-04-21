from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agent import stream_search
from auth import router as auth_router
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


from typing import Optional

class SearchRequest(BaseModel):
    lat: float
    lng: float
    radius_km: float
    category: str
    max_results: int = 10
    min_rating: float = 0.0
    user_id: Optional[int] = None


@app.get("/")
def root():
    return {"status": "Activity Finder API is running"}


@app.post("/search")
async def search(req: SearchRequest):
    """
    Streams search results as Server-Sent Events (SSE).
    Each event is a JSON line: { type: "status"|"token"|"done"|"error", content: "..." }
    """

    async def event_generator():
        try:
            async for data in stream_search(
                req.lat, req.lng, req.radius_km, req.category, req.max_results, req.min_rating, req.user_id
            ):
                yield f"data: {data}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )