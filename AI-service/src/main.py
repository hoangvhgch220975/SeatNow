"""
main.py  – SeatNow AI Service
Port: 3007

Features:
  • Customer AI  → restaurant recommendations + multi-turn chat
  • Admin AI     → revenue analytics + business direction suggestions
  • Chat history → Redis, TTL 7 days (auto-expire)
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers import customer, admin, public

load_dotenv()

PORT = int(os.getenv("PORT", 3007))

# ─────────────────────── App setup ───────────────────────

app = FastAPI(
    title="SeatNow AI Service",
    description=(
        "AI service for SeatNow:\n"
        "- **Customer**: restaurant recommendations based on booking history\n"
        "- **Admin**: revenue analytics + near-future business suggestions\n"
        "- **Chat history**: Redis, TTL 7 days"
    ),
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True
)

# ─────────────────────── Routers ───────────────────────

app.include_router(customer.router)
app.include_router(admin.router)
app.include_router(public.router)

# ─────────────────────── Health check ───────────────────────

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "OK", "service": "SeatNow AI Service", "port": PORT}


# ─────────────────────── Entrypoint ───────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
