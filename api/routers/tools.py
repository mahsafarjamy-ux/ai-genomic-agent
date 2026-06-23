import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

REGISTRY_PATH = Path(__file__).parent.parent.parent / "core" / "tool_registry" / "registry.json"
DATASETS_PATH = Path(__file__).parent.parent.parent / "core" / "tool_registry" / "public_datasets.json"


class RecommendRequest(BaseModel):
    analysis_type: str
    study_goal: str
    organism: str = "human"
    platform: str = "Illumina NovaSeq"
    read_length: int = 150
    paired_end: bool = True
    n_samples: int = 10
    depth: int = 30
    cpu_cores: int = 16
    ram_gb: int = 64
    has_gpu: bool = False
    has_hpc: bool = False
    special_notes: str = ""


class CompareRequest(BaseModel):
    tool_a: str
    tool_b: str
    context: str


@router.get("/analysis-types")
async def list_analysis_types():
    registry = json.loads(REGISTRY_PATH.read_text())
    return [
        {"id": k, "name": v["name"], "description": v["description"]}
        for k, v in registry["categories"].items()
    ]


@router.get("/registry/{analysis_type}")
async def get_registry_for_type(analysis_type: str):
    registry = json.loads(REGISTRY_PATH.read_text())
    cat = registry["categories"].get(analysis_type.lower())
    if not cat:
        raise HTTPException(404, f"Analysis type '{analysis_type}' not in registry")
    return cat


@router.post("/recommend")
async def recommend_tools(request: RecommendRequest):
    from core.agents.tool_recommender_agent import ToolRecommenderAgent
    agent = ToolRecommenderAgent()
    result = agent.recommend(
        analysis_type=request.analysis_type,
        study_goal=request.study_goal,
        organism=request.organism,
        platform=request.platform,
        read_length=request.read_length,
        paired_end=request.paired_end,
        n_samples=request.n_samples,
        depth=request.depth,
        cpu_cores=request.cpu_cores,
        ram_gb=request.ram_gb,
        has_gpu=request.has_gpu,
        has_hpc=request.has_hpc,
        special_notes=request.special_notes,
    )
    return result


@router.post("/compare")
async def compare_tools(request: CompareRequest):
    from core.agents.tool_recommender_agent import ToolRecommenderAgent
    agent = ToolRecommenderAgent()
    return agent.compare_tools(request.tool_a, request.tool_b, request.context)


@router.get("/tool/{tool_name}")
async def get_tool_info(tool_name: str):
    from core.agents.tool_recommender_agent import ToolRecommenderAgent
    agent = ToolRecommenderAgent()
    info = agent.get_tool_info(tool_name)
    if not info:
        raise HTTPException(404, f"Tool '{tool_name}' not found in registry")
    return info
