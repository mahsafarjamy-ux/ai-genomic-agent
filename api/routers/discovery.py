"""
Novel Discovery API router.
Searches PubMed + bioRxiv and uses Claude to identify research gaps.
No genomic data is involved — only article metadata reaches Claude.
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
from core.agents.novel_discovery_agent import NovelDiscoveryAgent

router = APIRouter()
agent = NovelDiscoveryAgent()


class GapDiscoveryRequest(BaseModel):
    query: str
    analysis_type: Optional[str] = None
    disease: Optional[str] = None
    max_results: int = 25


class MultiOmicsRequest(BaseModel):
    omics_layers: list[str]
    disease: str


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
