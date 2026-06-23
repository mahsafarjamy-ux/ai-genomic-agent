from pydantic import BaseModel, Field
from typing import Optional, Any
from enum import Enum
from datetime import datetime


class AnalysisType(str, Enum):
    WGS = "WGS"
    WES = "WES"
    RNASEQ = "RNAseq"
    SCRNASEQ = "scRNAseq"
    METHYLATION = "Methylation"
    CHIPSEQ = "ChIPseq"
    ATACSEQ = "ATACseq"
    OTHER = "other"


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    AWAITING_APPROVAL = "awaiting_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# Articles
class ArticleIngestRequest(BaseModel):
    pdf_path: str = Field(..., description="Absolute path to PDF on user's machine")
    work_dir: Optional[str] = None


class ArticleIngestResponse(BaseModel):
    article_id: str
    title: str
    doi: Optional[str]
    analysis_type: AnalysisType
    steps_count: int
    tools_found: list[str]
    github_repos: list[str]
    supplementary_count: int
    pipeline_json_path: str
    confidence_score: float
    missing_info: list[str]


# Pipelines
class PipelineStep(BaseModel):
    step_number: int
    name: str
    tool: str
    version: str
    docker_image: Optional[str]
    command_template: str
    parameters: dict[str, Any]
    input_files: list[str]
    output_files: list[str]
    notes: Optional[str]


class PipelineDefinition(BaseModel):
    pipeline_id: str
    analysis_type: AnalysisType
    title: str
    doi: Optional[str]
    reference_genome: dict[str, Any]
    steps: list[PipelineStep]
    required_input_files: list[dict]
    required_reference_files: list[dict]
    created_at: datetime


# Jobs
class RunJobRequest(BaseModel):
    pipeline_id: str
    data_dir: str = Field(..., description="Absolute path to user's data directory (never moved or uploaded)")
    results_dir: str = Field(..., description="Where to write output files")
    samples: list[str] = Field(..., description="Sample names to process")
    config_overrides: dict[str, Any] = Field(default_factory=dict)
    threads: int = 8
    memory_gb: int = 32


class JobSummary(BaseModel):
    job_id: str
    pipeline_id: str
    status: JobStatus
    current_step: Optional[str]
    progress_percent: float
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]


# Error/Fix approval
class FixProposal(BaseModel):
    job_id: str
    step_name: str
    root_cause: str
    explanation: str
    fix_type: str
    description: str
    before: str
    after: str
    safe_to_autofix: bool


class FixApprovalRequest(BaseModel):
    job_id: str
    approved: bool
    comment: Optional[str] = ""


# Data inspection
class DataInspectRequest(BaseModel):
    pipeline_id: str
    data_dir: str = Field(..., description="Local path to user's data directory")


class DataInspectResponse(BaseModel):
    ready_to_run: bool
    files_found: int
    samples_detected: list[str]
    satisfied_requirements: list[dict]
    missing_requirements: list[dict]
    warnings: list[str]
    suggested_folder_structure: dict


# Reports
class ReportRequest(BaseModel):
    job_id: str


class ReportResponse(BaseModel):
    html_path: str
    pdf_path: Optional[str]
    qc_status: str
