"""
AquaGuard Backend — FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import pipeline, sensors, network, savings, sandbox

app = FastAPI(
    title="AquaGuard API",
    description="Smart Water Leak Detection System — API Backend",
    version="1.0.0",
)

# CORS — allow Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(pipeline.router)
app.include_router(sensors.router)
app.include_router(network.router)
app.include_router(savings.router)
app.include_router(sandbox.router)


@app.get("/")
async def root():
    return {"status": "ok", "app": "AquaGuard API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
