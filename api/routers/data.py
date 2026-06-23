from pathlib import Path
from fastapi import APIRouter, HTTPException
from api.models.schemas import DataInspectRequest, DataInspectResponse
from api.routers.articles import _article_store

router = APIRouter()


@router.post("/inspect", response_model=DataInspectResponse)
async def inspect_data(request: DataInspectRequest):
    """
    Scan the user's local data directory and report what's present vs missing.
    PRIVACY: only file names and extensions are read — file content is never accessed.
    """
    pipeline = _article_store.get(request.pipeline_id)
    if not pipeline:
        raise HTTPException(404, "Pipeline not found")

    data_dir = Path(request.data_dir)
    if not data_dir.exists():
        raise HTTPException(400, f"Data directory does not exist: {data_dir}")

    from core.agents.data_inspector_agent import DataInspectorAgent
    agent = DataInspectorAgent()
    report = agent.inspect(pipeline, data_dir)

    return DataInspectResponse(**report)


@router.get("/browse")
async def browse_local_directory(path: str = "/"):
    """
    List files in a local directory for the file-picker UI.
    Returns only names and types — never content.
    """
    dir_path = Path(path)
    if not dir_path.exists():
        raise HTTPException(404, f"Path does not exist: {path}")
    if not dir_path.is_dir():
        raise HTTPException(400, "Path is not a directory")

    # Security: don't allow traversal outside home directory
    home = Path.home()
    try:
        dir_path.resolve().relative_to(home)
    except ValueError:
        raise HTTPException(403, "Access restricted to home directory")

    items = []
    for item in sorted(dir_path.iterdir()):
        items.append({
            "name": item.name,
            "type": "directory" if item.is_dir() else "file",
            "size_bytes": item.stat().st_size if item.is_file() else None,
            "path": str(item),
        })
    return {"path": str(dir_path), "items": items}
