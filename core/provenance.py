"""Machine-readable provenance manifests for every reproducible run."""
from __future__ import annotations

import hashlib
import json
import os
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def write_manifest(output_dir: str | Path, request: dict[str, Any], command: list[str],
                   inputs: list[str] | None = None) -> Path:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    input_hashes = {}
    for value in inputs or []:
        path = Path(value)
        if path.is_file():
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            input_hashes[str(path)] = digest
    manifest = {
        "schema_version": "1.0",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "request": request,
        "command": command,
        "inputs_sha256": input_hashes,
        "environment": {
            "python": sys.version,
            "platform": platform.platform(),
            "git_commit": _git_commit(),
            "container_image": os.getenv("ANALYSIS_CONTAINER_IMAGE", ""),
        },
    }
    path = output / "reproducibility_manifest.json"
    path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    return path


def _git_commit() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return "unknown"
