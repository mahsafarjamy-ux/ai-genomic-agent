import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import aiofiles

from api.models.schemas import ArticleIngestRequest, ArticleIngestResponse

router = APIRouter()

# In-memory store (replace with DB in production)
_article_store: dict = {}


@router.post("/ingest", response_model=ArticleIngestResponse)
async def ingest_article(request: ArticleIngestRequest, background_tasks: BackgroundTasks):
    """
    Ingest a scientific paper PDF and extract its analysis pipeline.
    The PDF is read from the user's local path — never moved or uploaded to cloud.
    """
    pdf_path = Path(request.pdf_path)
    if not pdf_path.exists():
        raise HTTPException(404, f"PDF not found: {pdf_path}")
    if not pdf_path.suffix.lower() == ".pdf":
        raise HTTPException(400, "File must be a PDF")

    article_id = str(uuid.uuid4())
    work_dir = Path(request.work_dir or f"work/{article_id}")

    # Run ingestion (can be moved to background task for large PDFs)
    from core.agents.article_ingestion_agent import ArticleIngestionAgent
    import asyncio

    agent = ArticleIngestionAgent()
    pipeline = await agent.ingest(pdf_path, work_dir)

    if "error" in pipeline:
        raise HTTPException(500, f"Pipeline extraction failed: {pipeline['error']}")

    # Store
    pipeline["_id"] = article_id
    _article_store[article_id] = pipeline

    return ArticleIngestResponse(
        article_id=article_id,
        title=pipeline.get("title", "Unknown"),
        doi=pipeline.get("doi"),
        analysis_type=pipeline.get("analysis_type", "other"),
        steps_count=len(pipeline.get("steps", [])),
        tools_found=[s.get("tool", "") for s in pipeline.get("steps", [])],
        github_repos=[],  # populated by agent during parsing
        supplementary_count=0,
        pipeline_json_path=pipeline.get("_pipeline_json", ""),
        confidence_score=pipeline.get("confidence_score", 0.0),
        missing_info=pipeline.get("missing_info", []),
    )


@router.post("/upload")
async def upload_article_pdf(file: UploadFile = File(...)):
    """
    Alternative: upload PDF through the browser instead of providing a local path.
    File is saved temporarily to the server's work dir (local machine only, not cloud).
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted")

    upload_path = Path("uploads") / file.filename
    async with aiofiles.open(upload_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    return {"uploaded_path": str(upload_path), "filename": file.filename}


@router.get("/{article_id}")
async def get_article(article_id: str):
    pipeline = _article_store.get(article_id)
    if not pipeline:
        raise HTTPException(404, "Article not found")
    return pipeline


@router.get("/")
async def list_articles():
    return [
        {"id": aid, "title": p.get("title"), "analysis_type": p.get("analysis_type")}
        for aid, p in _article_store.items()
    ]
