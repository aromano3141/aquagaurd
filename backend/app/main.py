"""
AquaGuard Backend — FastAPI Application

Provides REST API endpoints for water network upload, parsing,
leak detection, and simulation.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tempfile
import os

app = FastAPI(
    title="AquaGuard API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    """Service health check endpoint."""
    return {"status": "ok", "service": "aquaguard"}


@app.post("/api/upload")
async def upload_network(file: UploadFile = File(...)):
    """
    Accept an EPANET .inp file, parse the water network topology,
    and return a JSON representation of nodes, edges, and metadata.
    """
    if not file.filename.endswith(".inp"):
        raise HTTPException(status_code=400, detail="File must be an EPANET .inp file")

    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".inp") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        from app.services.network_parser import parse_inp_file
        network_data = parse_inp_file(tmp_path)
        return JSONResponse(content=network_data)
    finally:
        os.unlink(tmp_path)


@app.post("/api/detect")
async def run_detection():
    """
    Run the full leak detection pipeline on the currently loaded network.
    Returns heatmap data, leak reports, and timeline events.
    """
    # Placeholder — will be implemented in Sprint 3
    return {"status": "not_implemented", "message": "Detection pipeline coming in Sprint 3"}


@app.post("/api/simulate")
async def simulate_leak(pipe_id: str, leak_rate: float = 10.0):
    """
    Inject a simulated leak at a specified pipe and run detection.
    Used by the City Sandbox feature.
    """
    # Placeholder — will be implemented in Sprint 3
    return {"status": "not_implemented", "pipe_id": pipe_id, "leak_rate": leak_rate}
