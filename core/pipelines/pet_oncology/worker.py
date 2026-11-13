"""Runpod handler for pre-staged and staff-approved case bundles."""
import os
import re
import subprocess
import time
from pathlib import Path

import runpod
import yaml

PIPELINE = Path(__file__).resolve().parent / "Snakefile"


def handler(job):
    case_id = job["input"]["case_id"]
    if not re.fullmatch(r"[a-f0-9-]{36}", case_id):
        raise ValueError("Invalid case ID.")
    root = Path(os.getenv("PET_CASE_ROOT", "/runpod-volume/cases")).resolve()
    case = (root / case_id).resolve()
    if case.parent != root:
        raise ValueError("Invalid case location.")
    config = yaml.safe_load((case / "approved.yaml").read_text())
    files = [case / f"{sample}_{mate}.fastq.gz" for sample in ("tumor", "normal") for mate in (1, 2)]
    if any(not file.is_file() or file.stat().st_size == 0 for file in files):
        raise ValueError("Expected four staged, nonempty FASTQ files.")
    config["reads"] = {"tumor": list(map(str, files[:2])), "normal": list(map(str, files[2:]))}
    config["output"] = str(case / "results")
    config["gpu"] = True
    threads = int(config.get("threads", 8))
    config_path = case / "worker-config.yaml"
    config_path.write_text(yaml.safe_dump(config))
    started = time.monotonic()
    with (case / "workflow.log").open("a") as log:
        subprocess.run(["snakemake", "--snakefile", str(PIPELINE), "--configfile", str(config_path),
                        "--directory", str(case), "--cores", str(threads), "--resources", "gpu=1", "--rerun-incomplete"],
                       stdout=log, stderr=subprocess.STDOUT, check=True)
    if not (case / "results/review.md").is_file():
        raise RuntimeError("Missing review report.")
    return {"case_id": case_id, "elapsed_seconds": round(time.monotonic() - started)}


runpod.serverless.start({"handler": handler})
