"""
AquaGuard Backend — FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from .routers import pipeline, sensors, network, savings, sandbox, dispatch

app = FastAPI(
    title="AquaGuard API",
    description="Smart Water Leak Detection System — API Backend",
    version="1.0.0",
)

import numpy as np
from fastapi.encoders import ENCODERS_BY_TYPE

ENCODERS_BY_TYPE[np.ndarray] = lambda x: x.tolist()
ENCODERS_BY_TYPE[np.int32] = int
ENCODERS_BY_TYPE[np.int64] = int
ENCODERS_BY_TYPE[np.float32] = float
ENCODERS_BY_TYPE[np.float64] = float
ENCODERS_BY_TYPE[np.bool_] = bool

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
app.include_router(dispatch.router)


@app.get("/")
async def root():
    return {"status": "ok", "app": "AquaGuard API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
