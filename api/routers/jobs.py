import uuid
import asyncio
import subprocess
import json
import re
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse

from api.models.schemas import RunJobRequest, JobSummary, JobStatus, FixApprovalRequest

router = APIRouter()

_job_store: dict = {}
_fix_store: dict = {}


@router.post("/run", response_model=JobSummary)
async def run_job(request: RunJobRequest, background_tasks: BackgroundTasks):
    """
    Launch a pipeline job on the user's local data.
    Data stays in place — the pipeline reads from request.data_dir without moving files.
    """
    from api.routers.articles import _article_store

    pipeline = _article_store.get(request.pipeline_id)
    if not pipeline:
        # Try loading from template
        pipeline = {"analysis_type": request.pipeline_id, "steps": []}

    job_id = str(uuid.uuid4())
    results_dir = Path(request.results_dir)
    results_dir.mkdir(parents=True, exist_ok=True)

    job = {
        "job_id": job_id,
        "pipeline_id": request.pipeline_id,
        "status": JobStatus.PENDING,
        "current_step": None,
        "progress_percent": 0.0,
        "started_at": datetime.utcnow().isoformat(),
        "completed_at": None,
        "error_message": None,
        "data_dir": request.data_dir,
        "results_dir": str(results_dir),
        "samples": request.samples,
        "config": {
            "threads": request.threads,
            "memory_gb": request.memory_gb,
            **request.config_overrides,
        },
        "logs": [],
    }
    _job_store[job_id] = job

    background_tasks.add_task(_run_pipeline_background, job_id, request, pipeline)

    return JobSummary(**{k: job[k] for k in JobSummary.model_fields})


@router.get("/{job_id}", response_model=JobSummary)
async def get_job(job_id: str):
    job = _job_store.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return JobSummary(**{k: job[k] for k in JobSummary.model_fields})


@router.get("/{job_id}/logs")
async def stream_logs(job_id: str):
    """Stream live log lines for a running job."""
    job = _job_store.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    async def log_generator():
        last_idx = 0
        while True:
            logs = job.get("logs", [])
            if logs[last_idx:]:
                for line in logs[last_idx:]:
                    yield f"data: {line}\n\n"
                last_idx = len(logs)
            if job["status"] in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(log_generator(), media_type="text/event-stream")


@router.get("/{job_id}/fix-proposal")
async def get_fix_proposal(job_id: str):
    """Return the pending fix proposal for a failed job (awaiting human approval)."""
    fix = _fix_store.get(job_id)
    if not fix:
        raise HTTPException(404, "No pending fix for this job")
    return fix


@router.post("/{job_id}/approve-fix")
async def approve_fix(job_id: str, approval: FixApprovalRequest, background_tasks: BackgroundTasks):
    """Human approval checkpoint: approve or reject the proposed fix and retry."""
    fix = _fix_store.get(job_id)
    if not fix:
        raise HTTPException(404, "No pending fix for this job")

    job = _job_store.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    from core.agents.error_detective_agent import ErrorDetectiveAgent
    agent = ErrorDetectiveAgent()
    result = agent.apply_fix(fix, approval.approved, approval.comment or "")

    if approval.approved:
        job["status"] = JobStatus.PENDING
        job["error_message"] = None
        _fix_store.pop(job_id, None)
        # Retry with the approved fix
        background_tasks.add_task(_retry_with_fix, job_id, result)
        return {"status": "retrying", "fix_applied": result}
    else:
        job["status"] = JobStatus.FAILED
        job["error_message"] = f"Fix rejected by user: {approval.comment}"
        return {"status": "rejected"}


@router.delete("/{job_id}/cancel")
async def cancel_job(job_id: str):
    job = _job_store.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    job["status"] = JobStatus.CANCELLED
    return {"status": "cancelled"}


@router.get("/")
async def list_jobs():
    return [
        {k: j[k] for k in ["job_id", "pipeline_id", "status", "progress_percent", "started_at"]}
        for j in _job_store.values()
    ]


async def _run_pipeline_background(job_id: str, request: RunJobRequest, pipeline: dict):
    """Execute the Snakemake pipeline on the user's local data directory."""
    job = _job_store[job_id]
    job["status"] = JobStatus.RUNNING

    try:
        analysis_type = (pipeline.get("analysis_type") or request.pipeline_id).lower()
        snakefile_dir = Path(__file__).parent.parent.parent / "core" / "pipelines" / analysis_type.lower()
        snakefile = snakefile_dir / "Snakefile"

        if not snakefile.exists():
            job["status"] = JobStatus.FAILED
            job["error_message"] = (
                f"Pipeline '{analysis_type}' is not yet installed on this machine. "
                f"Expected Snakefile at: {snakefile}"
            )
            job["logs"].append(f"FATAL ERROR: {job['error_message']}")
            return

        results_dir = Path(request.results_dir).resolve()
        results_dir.mkdir(parents=True, exist_ok=True)

        # Write samplesheet CSV to disk so the Snakefile can read it
        ss_content = request.config_overrides.get("samplesheet_csv", "")
        ss_path = results_dir / "samplesheet.csv"
        if ss_content:
            ss_path.write_text(ss_content)
            job["logs"].append(f"Samplesheet written to {ss_path} ({ss_content.count(chr(10))} samples)")
        else:
            job["logs"].append("WARNING: No samplesheet provided — pipeline may fail at the first step")

        # Build and write config.yaml
        config = _build_config(request, pipeline, samplesheet_path=str(ss_path))
        config_path = results_dir / "config.yaml"
        import yaml
        config_path.write_text(yaml.dump(config, default_flow_style=False))
        job["logs"].append(f"Config written to {config_path}")
        job["current_step"] = "Starting pipeline"

        # Snakemake command — no --use-singularity; Docker is called inside shell rules
        cmd = [
            "snakemake",
            "--snakefile", str(snakefile),
            "--configfile", str(config_path),
            "--cores", str(request.threads),
            "--printshellcmds",
            "--rerun-incomplete",
            "--nolock",
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=str(snakefile_dir),
        )

        _FATAL_PATTERNS = (
            "WorkflowError", "MissingInputException", "RuleException",
            "Traceback (most recent call last)", "FATAL ERROR",
        )

        # Track progress from Snakemake's "X of Y steps (Z%)" output
        total_steps = 0
        done_steps  = 0

        async for raw in proc.stdout:
            line = raw.decode("utf-8", errors="replace").rstrip()
            if not line:
                continue
            job["logs"].append(line)

            # "N of M steps (X%) done" — Snakemake progress line
            m = re.search(r"(\d+) of (\d+) steps", line)
            if m:
                done_steps  = int(m.group(1))
                total_steps = int(m.group(2))
                job["progress_percent"] = round(100 * done_steps / max(total_steps, 1), 1)

            # Active rule name: "rule fastqc_raw:"
            r = re.match(r"^rule (\w+):", line)
            if r:
                job["current_step"] = r.group(1).replace("_", " ")

            if any(p in line for p in _FATAL_PATTERNS):
                job["logs"].append(f"[PIPELINE ERROR DETECTED] {line}")
                await proc.wait()
                await _trigger_error_analysis(job_id, "\n".join(job["logs"][-60:]), request)
                return

            if job["status"] == JobStatus.CANCELLED:
                proc.terminate()
                return

        await proc.wait()

        if proc.returncode == 0:
            job["status"] = JobStatus.COMPLETED
            job["progress_percent"] = 100.0
            job["completed_at"] = datetime.utcnow().isoformat()
            job["logs"].append("Pipeline completed successfully.")
        else:
            await _trigger_error_analysis(job_id, "\n".join(job["logs"][-80:]), request)

    except Exception as e:
        job["status"] = JobStatus.FAILED
        job["error_message"] = str(e)
        job["logs"].append(f"FATAL ERROR: {e}")


# ── Knowledge base: remembered fixes (persisted to disk) ─────────────────

import json as _json

_KB_PATH = Path(__file__).parent.parent.parent / "data" / "fix_knowledge_base.json"

def _load_kb() -> list[dict]:
    try:
        if _KB_PATH.exists():
            return _json.loads(_KB_PATH.read_text())
    except Exception:
        pass
    return []

def _save_kb(kb: list[dict]):
    _KB_PATH.parent.mkdir(parents=True, exist_ok=True)
    _KB_PATH.write_text(_json.dumps(kb, indent=2))

def _kb_lookup(error_signature: str) -> dict | None:
    """Check if we have seen this error before and have an approved fix."""
    for entry in _load_kb():
        if entry.get("error_signature") == error_signature and entry.get("times_approved", 0) >= 1:
            return entry
    return None

def _kb_record_fix(error_signature: str, fix: dict, auto_approved: bool):
    kb = _load_kb()
    for entry in kb:
        if entry.get("error_signature") == error_signature:
            entry["times_approved"] = entry.get("times_approved", 0) + 1
            entry["fix"] = fix
            _save_kb(kb)
            return
    kb.append({
        "error_signature": error_signature,
        "fix": fix,
        "times_approved": 1,
        "auto_approved": auto_approved,
    })
    _save_kb(kb)


# ── Error analysis + proposal ─────────────────────────────────────────────

_INSTANT_FIXES = [
    # (pattern, root_cause, fix_description, param_patch)
    (r"snakemake.*not found|snakemake: command not found|No module named snakemake",
     "Snakemake is not installed in this environment",
     "Install Snakemake: pip install snakemake",
     None),
    (r"singularity.*not found|singularity: command not found|apptainer.*not found",
     "Singularity / Apptainer is not installed — required to run containerized tools",
     "Install Singularity or Apptainer, then retry",
     None),
    (r"docker.*not found|Cannot connect to the Docker daemon|docker: command not found",
     "Docker is not running or not installed",
     "Start Docker Desktop (or install Docker), then retry",
     None),
    (r"out of memory|oom kill|killed.*memory|cannot allocate",
     "Out of memory — the tool ran out of RAM",
     "Double the memory allocation and retry",
     {"memory_gb_multiplier": 2}),
    (r"no space left on device|disk quota exceeded",
     "Disk full — no space remaining in the output directory",
     None,  # Cannot auto-fix — needs user action
     None),
    (r"command not found|not found in PATH|No such file.*bin",
     "Tool not installed — Docker image may not have pulled yet",
     "Pull the Docker image and retry",
     {"docker_pull": True}),
    (r"permission denied",
     "Permission denied — cannot write to the output directory",
     "Check that the results directory is writable",
     None),
    (r"file not found|no such file or directory",
     "Input file not found — check the data directory path",
     None,
     None),
    (r"java.*heap|OutOfMemoryError.*java",
     "Java heap space exhausted",
     "Increase Java heap size (-Xmx) and retry",
     {"java_heap_multiplier": 2}),
    (r"connection refused|network unreachable|timeout.*download",
     "Network error during reference download",
     "Retry — this is usually a transient network issue",
     {"retry": True}),
    (r"index.*not found|index file.*missing",
     "Reference index not found — genome index needs to be built",
     "Build the reference index before running the pipeline",
     None),
]


async def _trigger_error_analysis(job_id: str, error_text: str, request: RunJobRequest):
    job = _job_store[job_id]
    lower = error_text.lower()

    # 1. Quick pattern match — instant diagnosis, no Claude needed
    for (pat, cause, fix_desc, patch) in _INSTANT_FIXES:
        if re.search(pat, lower):
            error_sig = pat[:40]
            known = _kb_lookup(error_sig)
            auto_fix = known and known.get("times_approved", 0) >= 3 and patch and fix_desc

            fix = {
                "severity": "RECOVERABLE" if patch else "FATAL",
                "root_cause": cause,
                "explanation": cause,
                "error_signature": error_sig,
                "proposed_fix": {
                    "type": "parameter_change" if patch else "manual_action",
                    "description": fix_desc or "Manual action required — see explanation above",
                    "safe_to_autofix": bool(auto_fix),
                    "requires_human_approval": not auto_fix,
                    "patch": patch or {},
                },
                "step": job.get("current_step", "unknown"),
                "status": "auto_fixed" if auto_fix else "pending_approval",
            }
            _fix_store[job_id] = fix
            job["error_message"] = cause

            if auto_fix:
                job["logs"].append(f"[AUTO-FIX] {fix_desc} (learned from {known['times_approved']} previous fixes)")
                await _apply_and_retry(job_id, fix, request)
            else:
                job["status"] = JobStatus.AWAITING_APPROVAL
            return

    # 2. Fall back to Claude for unknown errors
    job["logs"].append("[AI ANALYSIS] Asking Claude to diagnose this error…")
    try:
        from core.agents.error_detective_agent import ErrorDetectiveAgent
        log_dir = Path(request.results_dir) / "logs"
        log_files = list(log_dir.rglob("*.log")) if log_dir.exists() else []
        log_path = log_files[-1] if log_files else Path("/dev/null")

        agent = ErrorDetectiveAgent()
        diagnosis = agent.analyze_failure(
            step_name=job.get("current_step", "unknown"),
            tool="unknown",
            version="unknown",
            command=error_text[-3000:],
            log_path=log_path,
            config=job.get("config", {}),
        )
        _fix_store[job_id] = diagnosis
        job["error_message"] = diagnosis.get("root_cause", "Unknown error")
        job["status"] = JobStatus.AWAITING_APPROVAL
    except Exception as e:
        job["status"] = JobStatus.FAILED
        job["error_message"] = f"Pipeline failed and error analysis also failed: {e}"


async def _apply_and_retry(job_id: str, fix: dict, request: RunJobRequest):
    """Apply a fix and re-run the Snakemake pipeline."""
    job = _job_store[job_id]
    patch = fix.get("proposed_fix", {}).get("patch", {})

    # Apply parameter patches
    if patch.get("memory_gb_multiplier"):
        request.memory_gb = int(request.memory_gb * patch["memory_gb_multiplier"])
        job["config"]["memory_gb"] = request.memory_gb
        job["logs"].append(f"[FIX] Memory increased to {request.memory_gb} GB")

    if patch.get("java_heap_multiplier"):
        current = request.config_overrides.get("java_heap_gb", request.memory_gb // 2)
        request.config_overrides["java_heap_gb"] = int(current * patch["java_heap_multiplier"])
        job["logs"].append(f"[FIX] Java heap increased to {request.config_overrides['java_heap_gb']} GB")

    if patch.get("docker_pull"):
        job["logs"].append("[FIX] Pulling Docker images before retry…")

    job["status"] = JobStatus.RUNNING
    job["progress_percent"] = 0
    job["logs"].append("[RETRY] Restarting pipeline with fixes applied…")

    pipeline = {"analysis_type": request.pipeline_id, "steps": []}
    await _run_pipeline_background(job_id, request, pipeline)


async def _retry_with_fix(job_id: str, fix: dict):
    """Called after user approves a fix proposal."""
    job = _job_store.get(job_id)
    if not job:
        return

    # Reconstruct request from stored job state
    from api.models.schemas import RunJobRequest
    try:
        req = RunJobRequest(
            pipeline_id=job["pipeline_id"],
            data_dir=job["data_dir"],
            results_dir=job["results_dir"],
            threads=job["config"].get("threads", 8),
            memory_gb=job["config"].get("memory_gb", 32),
            samples=job.get("samples", []),
            config_overrides=job.get("config", {}),
        )
        # Learn from this approval
        err_sig = job.get("error_signature", "")
        if err_sig:
            _kb_record_fix(err_sig, fix, auto_approved=False)

        await _apply_and_retry(job_id, {"proposed_fix": {"patch": fix}}, req)
    except Exception as e:
        job["status"] = JobStatus.FAILED
        job["error_message"] = f"Retry failed: {e}"
        job["logs"].append(f"[RETRY FAILED] {e}")


def _build_config(request: RunJobRequest, pipeline: dict, samplesheet_path: str = "") -> dict:
    overrides = dict(request.config_overrides)
    # Remove the raw CSV string — the Snakefile gets a file path instead
    overrides.pop("samplesheet_csv", None)

    config = {
        "samplesheet_path": samplesheet_path,
        "results_dir": str(Path(request.results_dir).resolve()),
        "threads": request.threads,
        "memory_gb": request.memory_gb,
        # Genome resources — empty string means "not provided"
        "genome":     overrides.pop("genome", "GRCh38"),
        "star_index": overrides.pop("star_index", ""),
        "gtf":        overrides.pop("gtf", ""),
    }
    # Pass remaining overrides (pipeline-specific params like strandedness, aligner, etc.)
    config.update(overrides)
    return config
