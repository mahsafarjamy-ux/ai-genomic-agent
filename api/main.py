"""
AI Genomics Agent — FastAPI backend.
Privacy-first: genomic data stays on the user's machine.
All pipeline execution is local; only article text + pipeline definitions reach Claude API.
"""

import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from api.routers import articles, pipelines, jobs, reports, data, tools, public_data, discovery, connectors, flow, auth, fs, genome_personal, samplesheet, billing, counselling


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create working directories on startup
    for d in ["uploads", "uploads/flow", "work", "reports"]:
        Path(d).mkdir(parents=True, exist_ok=True)
    from core.flow.db import init_db
    init_db()
    yield


app = FastAPI(
    title="AI Genomics Agent",
    description="Privacy-first bioinformatics pipeline platform powered by Claude AI",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:3001,http://localhost:3002"
    ).split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(articles.router, prefix="/api/articles", tags=["Articles"])
app.include_router(pipelines.router, prefix="/api/pipelines", tags=["Pipelines"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(data.router, prefix="/api/data", tags=["Data Inspection"])
app.include_router(tools.router, prefix="/api/tools", tags=["Tool Registry & Recommender"])
app.include_router(public_data.router, prefix="/api/public-data", tags=["Public Datasets"])
app.include_router(discovery.router,   prefix="/api/discovery",   tags=["Novel Discovery"])
app.include_router(connectors.router,  prefix="/api/connectors",  tags=["Data Connectors"])
app.include_router(flow.router,        prefix="/api/flow",        tags=["Flow Cytometry"])
app.include_router(auth.router,        prefix="/api/auth",        tags=["Auth"])
app.include_router(fs.router,              prefix="/api/fs",                tags=["Local Filesystem"])
app.include_router(genome_personal.router, prefix="/api/genome-personal",   tags=["Personal Genome"])
app.include_router(samplesheet.router,    prefix="/api/samplesheet",         tags=["Samplesheet"])
app.include_router(counselling.router, prefix="/api/counselling", tags=["Genetic Counselling"])
app.include_router(billing.router,        prefix="/api/billing",             tags=["Billing & Licensing"])


@app.get("/api/health")
async def health():
    database = "ok"
    try:
        from core.persistence import JobRepository
        JobRepository().list()
    except Exception as exc:
        database = f"error: {exc.__class__.__name__}"
    return {
        "status": "ok",
        "version": "0.1.0",
        "database": database,
        "execution_mode": os.getenv("JOB_EXECUTION_MODE", "local"),
        "privacy_note": "Raw genomic data is not sent to an LLM; processing location is controlled by the deployment."
    }
