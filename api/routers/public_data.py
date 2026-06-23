import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

DATASETS_PATH = Path(__file__).parent.parent.parent / "core" / "tool_registry" / "public_datasets.json"


class ControlRecommendRequest(BaseModel):
    analysis_type: str
    disease_context: str
    organism: str = "human"
    n_samples: Optional[int] = None
    tissue: Optional[str] = None
    extra_context: str = ""


class ComparisonPlanRequest(BaseModel):
    public_dataset: dict          # the selected GEO/TCGA/GTEx record
    user_analysis_type: str       # rnaseq, wgs, scrnaseq, etc.
    user_disease: str
    selected_analyses: list[str]  # ["deg", "pathway", "survival", "integration"]
    local_data_path: str = ""


@router.get("/databases")
async def list_databases():
    datasets = json.loads(DATASETS_PATH.read_text())
    return [
        {
            "id": k,
            "name": v["name"],
            "description": v["description"],
            "free": v.get("free", True),
            "registration_required": v.get("registration_required", False),
            "analysis_types": v.get("analysis_types", []),
            "best_for": v.get("best_for", ""),
        }
        for k, v in datasets["databases"].items()
    ]


@router.get("/databases/{analysis_type}")
async def databases_for_analysis_type(analysis_type: str):
    datasets = json.loads(DATASETS_PATH.read_text())
    db_ids = datasets["analysis_type_to_databases"].get(analysis_type.lower(), [])
    return {
        db_id: datasets["databases"][db_id]
        for db_id in db_ids
        if db_id in datasets["databases"]
    }


@router.post("/recommend-controls")
async def recommend_controls(request: ControlRecommendRequest):
    from core.agents.public_data_agent import PublicDataAgent
    agent = PublicDataAgent()
    try:
        result = await agent.recommend_controls(
            analysis_type=request.analysis_type,
            disease_context=request.disease_context,
            organism=request.organism,
            n_samples=request.n_samples,
            tissue=request.tissue,
            extra_context=request.extra_context,
        )
        return result
    finally:
        await agent.close()


@router.get("/search/geo")
async def search_geo(
    query: str = Query(..., description="Search terms for GEO"),
    n: int = Query(20, le=100),
):
    from core.agents.public_data_agent import PublicDataAgent
    agent = PublicDataAgent()
    try:
        return await agent.search_geo(query, n=n)
    finally:
        await agent.close()


@router.get("/search/cellxgene")
async def search_cellxgene(
    tissue: Optional[str] = None,
    disease: Optional[str] = None,
):
    from core.agents.public_data_agent import PublicDataAgent
    agent = PublicDataAgent()
    try:
        return await agent.search_cellxgene(tissue=tissue, disease=disease)
    finally:
        await agent.close()


@router.post("/comparison-plan")
async def generate_comparison_plan(request: ComparisonPlanRequest):
    """
    Generate download commands + analysis pipeline for comparing a public dataset
    with the user's local patient data. Public data is downloaded to user's machine only.
    """
    from core.agents.public_data_agent import PublicDataAgent
    agent = PublicDataAgent()
    try:
        return await agent.generate_comparison_plan(
            public_dataset=request.public_dataset,
            user_analysis_type=request.user_analysis_type,
            user_disease=request.user_disease,
            selected_analyses=request.selected_analyses,
            local_data_path=request.local_data_path,
        )
    finally:
        await agent.close()


@router.get("/tcga/projects")
async def search_tcga_projects(disease: str = Query(...)):
    """Search TCGA GDC projects by disease keyword. Returns open-access cohorts."""
    from core.agents.public_data_agent import PublicDataAgent
    agent = PublicDataAgent()
    try:
        return await agent._search_tcga(disease)
    finally:
        await agent.close()


@router.get("/gtex/expression")
async def gtex_expression(
    gene: str = Query(..., description="GENCODE ID e.g. ENSG00000141510.20"),
    tissue: str = Query(..., description="GTEx tissue e.g. Brain_Cortex"),
):
    from core.agents.public_data_agent import PublicDataAgent
    agent = PublicDataAgent()
    try:
        return await agent.get_gtex_expression(gene=gene, tissue=tissue)
    finally:
        await agent.close()
