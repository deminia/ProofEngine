"""ProofEngine Local Development API Server.

Serves niche configuration and pipeline APIs for the React dashboard.
Zero hardcoded niche terms.
"""
import os
import sys
from pathlib import Path
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from engine.api import (
    router as niche_router,
    get_active_niche,
    list_niches,
    switch_active_niche,
    SwitchNicheRequest,
)

app = FastAPI(
    title="ProofEngine API",
    version="1.1.0",
    description="Universal Short-Form Video Automation Framework API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Standard API route (/api/niche/*)
app.include_router(niche_router)

# 2. Vite proxy rewrite route (/niche/*) for seamless frontend communication
niche_direct = APIRouter(prefix="/niche", tags=["niche-direct"])
niche_direct.add_api_route("/active", get_active_niche, methods=["GET"])
niche_direct.add_api_route("/list", list_niches, methods=["GET"])
niche_direct.add_api_route("/switch", switch_active_niche, methods=["POST"])
app.include_router(niche_direct)


@app.get("/")
def root():
    return {
        "name": "ProofEngine API",
        "version": "1.1.0",
        "docs": "http://localhost:8081/docs",
        "status": "online",
    }


@app.get("/healthz")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("server:app", host="127.0.0.1", port=8081, reload=True)
