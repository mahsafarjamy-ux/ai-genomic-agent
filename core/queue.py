"""Execution boundary for local development and production workers.

Set JOB_EXECUTION_MODE=celery and run ``celery -A core.queue worker`` in a
separate worker container. The local mode remains useful for a single VM.
"""
from __future__ import annotations

import os

from celery import Celery

celery_app = Celery(
    "genomic_agent",
    broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
)
celery_app.conf.update(task_serializer="json", result_serializer="json", accept_content=["json"])


@celery_app.task(name="genomic_agent.execute_pipeline")
def execute_pipeline(job_id: str, request_data: dict, pipeline: dict) -> str:
    """Worker entry point; the API remains responsible for submission/auth."""
    import asyncio
    from api.models.schemas import RunJobRequest
    from api.routers.jobs import _run_pipeline_background
    asyncio.run(_run_pipeline_background(job_id, RunJobRequest(**request_data), pipeline))
    return job_id


def enqueue_pipeline(job_id: str, request_data: dict, pipeline: dict, background_tasks=None) -> str:
    if os.getenv("JOB_EXECUTION_MODE", "local").lower() == "celery":
        return execute_pipeline.delay(job_id, request_data, pipeline).id
    if background_tasks is None:
        raise ValueError("background_tasks is required in local execution mode")
    background_tasks.add_task(_local_entrypoint, job_id, request_data, pipeline)
    return job_id


async def _local_entrypoint(job_id: str, request_data: dict, pipeline: dict) -> None:
    from api.models.schemas import RunJobRequest
    from api.routers.jobs import _run_pipeline_background
    await _run_pipeline_background(job_id, RunJobRequest(**request_data), pipeline)
