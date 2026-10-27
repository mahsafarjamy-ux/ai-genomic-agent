"""Vercel-hosted account, payment and counselling API.

Genomic pipelines and local filesystem endpoints are intentionally excluded.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routers import auth, billing, counselling
from core.flow.db import init_db


def durable_database_configured():
    return os.getenv('DATABASE_URL', '').startswith(('postgres://', 'postgresql://', 'postgresql+psycopg2://'))


@asynccontextmanager
async def lifespan(application):
    application.state.database_ready = False
    if durable_database_configured():
        try:
            init_db()
            application.state.database_ready = True
        except Exception:
            # Health reports readiness without exposing connection strings or errors.
            pass
    yield


app = FastAPI(title='BioVerse account and counselling API', lifespan=lifespan)
app.state.database_ready = False



@app.middleware('http')
async def readiness(request, call_next):
    if not app.state.database_ready and request.method != 'OPTIONS':
        if request.url.path == '/api/counselling/config':
            version, text = counselling.consent_content()
            return JSONResponse({'enabled': False, 'consultants': [], 'support_phone': '',
                                 'consent_version': version, 'consent_text': text, 'video_provider': 'daily'},
                                headers={'Cache-Control': 'no-store'})
        if request.url.path not in ('/api/health', '/api/billing/plans'):
            return JSONResponse({'detail': 'Account and appointment services are not available yet. Please try again later.'},
                                status_code=503, headers={'Cache-Control': 'no-store'})
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.get('/api/health')
def health():
    return {'status': 'ok', 'ready': app.state.database_ready,
            'database': 'ready' if app.state.database_ready else ('unavailable' if durable_database_configured() else 'not_configured')}


app.include_router(auth.router, prefix='/api/auth')
app.include_router(billing.router, prefix='/api/billing')
app.include_router(counselling.router, prefix='/api/counselling')


# Wrap readiness responses as well as router responses for the website origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in os.getenv('CORS_ORIGINS', 'https://ai-genomic-agent.vercel.app').split(',') if x.strip()],
    allow_methods=['GET', 'POST', 'DELETE', 'OPTIONS'],
    allow_headers=['Authorization', 'Content-Type'],
)
