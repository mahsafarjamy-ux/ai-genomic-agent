"""
Local filesystem browser — lets the frontend show a directory picker so large
FCS / genomic files can be registered by path without uploading.

Security: only exposes directories and FCS files (or other explicitly allowed
extensions). The backend runs on localhost, so only the local user can call it.
"""
from __future__ import annotations

import pathlib
import stat as _stat

from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

# Extensions the file browser will reveal (hidden files are always hidden)
ALLOWED_EXTENSIONS = {".fcs", ".mzml", ".mzxml", ".raw", ".fastq", ".fq",
                       ".bam", ".cram", ".vcf", ".bcf", ".gz", ".zip"}


def _safe_stat(p: pathlib.Path) -> dict | None:
    try:
        s = p.stat()
        return s
    except (PermissionError, OSError):
        return None


@router.get("/browse")
def browse(path: str = Query("~", description="Absolute or ~ path to browse")):
    """Return directory listing at the requested path."""
    p = pathlib.Path(path).expanduser().resolve()

    if not p.exists():
        raise HTTPException(404, f"Path does not exist: {p}")
    if not p.is_dir():
        raise HTTPException(400, f"Not a directory: {p}")

    items = []
    try:
        children = sorted(p.iterdir(), key=lambda c: (not c.is_dir(), c.name.lower()))
    except PermissionError:
        raise HTTPException(403, f"Permission denied: {p}")

    for child in children:
        if child.name.startswith("."):
            continue  # hide dotfiles
        s = _safe_stat(child)
        if s is None:
            continue

        is_dir = child.is_dir()
        ext = child.suffix.lower() if not is_dir else ""

        # Show directories always, but only allowed file types
        if not is_dir and ext not in ALLOWED_EXTENSIONS:
            continue

        items.append({
            "name": child.name,
            "path": str(child),
            "is_dir": is_dir,
            "size": s.st_size if not is_dir else None,
            "ext": ext if not is_dir else None,
        })

    parent = str(p.parent) if p.parent != p else None
    return {"path": str(p), "parent": parent, "items": items}
