"""
Novel Discovery API router.
Searches PubMed + bioRxiv and uses Claude to identify research gaps.
No genomic data is involved — only article metadata reaches Claude.
"""

import uuid
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from core.agents.novel_discovery_agent import NovelDiscoveryAgent
from core.agents.critic_agent import CriticAgent
from core.persistence import CriticRepository
from core.agents.cost_reuse_planner import CostReusePlanner

router = APIRouter()
agent = NovelDiscoveryAgent()
critic_agent = CriticAgent()
reuse_planner = CostReusePlanner()
_critic_store: dict[str, dict] = {}
_critic_repo = CriticRepository()


class GapDiscoveryRequest(BaseModel):
    query: str
    analysis_type: Optional[str] = None
    disease: Optional[str] = None
    max_results: int = 25


class MultiOmicsRequest(BaseModel):
    omics_layers: list[str]
    disease: str


class CriticReviewRequest(BaseModel):
    """Evidence package sent by an analysis section to the critic."""
    claim: str
    analysis_id: Optional[str] = None
    analysis_type: Optional[str] = None
    metrics: dict = Field(default_factory=dict)
    datasets: list[dict] = Field(default_factory=list)
    methods: list[dict] = Field(default_factory=list)
    results_artifacts: list[str] = Field(default_factory=list)
    human_review_required: bool = True


class CriticAnswerRequest(BaseModel):
    """New evidence supplied after the critic requests more work."""
    evidence: dict = Field(default_factory=dict)
    comment: Optional[str] = ""


class CostReusePlanRequest(BaseModel):
    """Inputs used to avoid duplicating an already reproducible analysis."""
    request: dict = Field(default_factory=dict)
    catalog: list[dict] = Field(default_factory=list)
    compute_options: dict[str, dict] = Field(default_factory=dict)


@router.post("/cost-reuse-plan")
async def cost_reuse_plan(req: CostReusePlanRequest):
    """Select an existing artifact or the cheapest valid compute route."""
    return reuse_planner.plan(req.request, req.catalog, req.compute_options)


@router.post("/critic/review")
async def critic_review(req: CriticReviewRequest):
    """Run reproducibility and statistics gates over an analysis result.

    This endpoint never calls an LLM and never approves a clinical finding.
    It returns explicit requests that the analysis section can satisfy.
    """
    try:
        result = critic_agent.review(req.model_dump())
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    review_id = str(uuid.uuid4())
    result["review_id"] = review_id
    result["analysis_id"] = req.analysis_id
    record = {"request": req.model_dump(), "result": result, "history": []}
    _critic_store[review_id] = record
    _critic_repo.create(review_id, req.analysis_id or "", record)
    return result


@router.get("/critic/{review_id}")
async def get_critic_review(review_id: str):
    review = _critic_store.get(review_id)
    if not review:
        review = _critic_repo.get(review_id)
    if not review:
        raise HTTPException(404, "Critic review not found")
    return review["result"]


@router.post("/critic/{review_id}/evidence")
async def answer_critic_review(review_id: str, req: CriticAnswerRequest):
    """Send a repeat, independent cohort, or metadata package back for review."""
    review = _critic_store.get(review_id)
    if not review:
        review = _critic_repo.get(review_id)
    if not review:
        raise HTTPException(404, "Critic review not found")
    original = review["request"]
    evidence = req.evidence or {}
    merged = {
        **original,
        "metrics": {**(original.get("metrics") or {}), **(evidence.get("metrics") or {})},
        "datasets": [*(original.get("datasets") or []), *(evidence.get("datasets") or [])],
        "methods": [*(original.get("methods") or []), *(evidence.get("methods") or [])],
        "results_artifacts": [*(original.get("results_artifacts") or []), *(evidence.get("results_artifacts") or [])],
    }
    result = critic_agent.review(merged)
    result["review_id"] = review_id
    result["analysis_id"] = original.get("analysis_id")
    review["request"] = merged
    review["result"] = result
    review["history"].append({"comment": req.comment, "evidence": evidence, "result": result})
    _critic_store[review_id] = review
    _critic_repo.update(review_id, review)
    return result


@router.post("/gaps")
async def discover_gaps(req: GapDiscoveryRequest):
    """
    Search recent literature and identify methodological + data gaps.
    Claude analyses article titles/abstracts only — no patient data involved.
    """
    return await agent.discover_gaps(
        query=req.query,
        analysis_type=req.analysis_type,
        disease=req.disease,
        max_results=req.max_results,
    )


@router.get("/literature")
async def search_literature(
    query: str = Query(..., description="Search query"),
    source: str = Query("all", description="pubmed | biorxiv | all"),
    n: int = Query(30, description="Number of results"),
):
    """Live literature search across PubMed and/or bioRxiv."""
    results = await agent.search_all(query, source=source, n=n)
    return results


@router.post("/reproducibility-gaps")
async def reproducibility_gaps(analysis_type: str = Query(...)):
    """Find benchmark and reproducibility gaps for a given analysis type."""
    return await agent.find_reproducibility_gaps(analysis_type)


@router.post("/multi-omics-strategy")
async def multi_omics_strategy(req: MultiOmicsRequest):
    """Suggest novel multi-omics integration strategies for a disease."""
    return await agent.suggest_multi_omics_integration(req.omics_layers, req.disease)


@router.get("/clinical-trials")
async def search_clinical_trials(
    query: str = Query(..., description="Search keyword"),
    n: int = Query(5, le=20),
):
    """Search ClinicalTrials.gov v2 API for studies matching the query."""
    import httpx
    url = "https://clinicaltrials.gov/api/v2/studies"
    params = {"query.term": query, "format": "json", "pageSize": n,
              "filter.overallStatus": "RECRUITING,ACTIVE_NOT_RECRUITING,COMPLETED"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, params=params)
            if not r.is_success:
                return []
            data = r.json()
        studies = data.get("studies", [])
        out = []
        for s in studies:
            proto = s.get("protocolSection", {})
            id_mod = proto.get("identificationModule", {})
            status_mod = proto.get("statusModule", {})
            design_mod = proto.get("designModule", {})
            nct = id_mod.get("nctId", "")
            out.append({
                "nct": nct,
                "title": id_mod.get("officialTitle") or id_mod.get("briefTitle", ""),
                "status": status_mod.get("overallStatus", ""),
                "phase": ", ".join(design_mod.get("phases", [])),
                "url": f"https://clinicaltrials.gov/study/{nct}",
            })
        return out
    except Exception:
        return []
