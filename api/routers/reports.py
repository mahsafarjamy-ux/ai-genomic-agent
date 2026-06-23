from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from api.models.schemas import ReportRequest, ReportResponse
from api.routers.jobs import _job_store
from api.routers.articles import _article_store

router = APIRouter()

_report_store: dict = {}


@router.post("/generate", response_model=ReportResponse)
async def generate_report(request: ReportRequest):
    job = _job_store.get(request.job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job["status"] != "completed":
        raise HTTPException(400, "Job must be completed before generating a report")

    pipeline = _article_store.get(job["pipeline_id"], {})
    results_dir = Path(job["results_dir"])
    report_dir = results_dir / "report"

    # Collect QC metrics from MultiQC JSON if present
    qc_metrics = _collect_qc_metrics(results_dir)

    from core.agents.report_agent import ReportAgent
    agent = ReportAgent()
    result = agent.generate(
        pipeline=pipeline,
        qc_metrics=qc_metrics,
        result_summary={"results_dir": str(results_dir)},
        output_dir=report_dir,
        sample_ids=job.get("samples", []),
    )

    _report_store[request.job_id] = result
    return ReportResponse(
        html_path=result["html"],
        pdf_path=result.get("pdf"),
        qc_status=result["qc_status"],
    )


@router.get("/{job_id}/html", response_class=HTMLResponse)
async def view_report_html(job_id: str):
    report = _report_store.get(job_id)
    if not report:
        raise HTTPException(404, "Report not found — generate it first")
    html_path = Path(report["html"])
    if not html_path.exists():
        raise HTTPException(404, "Report HTML file not found on disk")
    return html_path.read_text(encoding="utf-8")


@router.get("/{job_id}/pdf")
async def download_report_pdf(job_id: str):
    report = _report_store.get(job_id)
    if not report or not report.get("pdf"):
        raise HTTPException(404, "PDF report not found")
    pdf_path = Path(report["pdf"])
    if not pdf_path.exists():
        raise HTTPException(404, "PDF file not found on disk")
    return FileResponse(str(pdf_path), media_type="application/pdf", filename="genomic_report.pdf")


def _collect_qc_metrics(results_dir: Path) -> dict:
    """Try to parse MultiQC JSON for structured QC metrics."""
    multiqc_json = results_dir / "multiqc" / "multiqc_data" / "multiqc_general_stats.json"
    if multiqc_json.exists():
        import json
        try:
            return json.loads(multiqc_json.read_text())
        except Exception:
            pass
    return {}
