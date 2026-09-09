"""Durable control-plane persistence and artifact storage.

The analysis workers may use local files, but job state, evidence reviews and
artifact manifests must survive API restarts and multiple API replicas.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import JSON, DateTime, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


class Base(DeclarativeBase):
    pass


class JobRecord(Base):
    __tablename__ = "analysis_jobs"
    job_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class CriticReviewRecord(Base):
    __tablename__ = "critic_reviews"
    review_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    analysis_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


def _session_factory():
    url = os.environ.get("DATABASE_URL", "sqlite:///./genomic_agent.db")
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    engine = create_engine(url, connect_args=connect_args)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


class JobRepository:
    def __init__(self, session_factory=None):
        self._sessions = session_factory or _session_factory()

    def create(self, job: dict[str, Any]) -> dict[str, Any]:
        with self._sessions() as db:
            record = JobRecord(job_id=job["job_id"], status=str(job.get("status", "pending")), payload=dict(job))
            db.merge(record)
            db.commit()
        return job

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self._sessions() as db:
            record = db.get(JobRecord, job_id)
            return dict(record.payload) if record else None

    def update(self, job_id: str, **fields: Any) -> dict[str, Any] | None:
        with self._sessions() as db:
            record = db.get(JobRecord, job_id)
            if not record:
                return None
            payload = dict(record.payload or {})
            payload.update(fields)
            record.payload = payload
            record.status = str(payload.get("status", record.status))
            record.updated_at = datetime.now(timezone.utc)
            db.commit()
            return payload

    def save(self, job: dict[str, Any]) -> dict[str, Any] | None:
        return self.update(job["job_id"], **job)

    def list(self) -> list[dict[str, Any]]:
        with self._sessions() as db:
            rows = db.scalars(select(JobRecord).order_by(JobRecord.created_at.desc())).all()
            return [dict(row.payload or {}) for row in rows]


class CriticRepository:
    def __init__(self, session_factory=None):
        self._sessions = session_factory or _session_factory()

    def create(self, review_id: str, analysis_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        with self._sessions() as db:
            db.merge(CriticReviewRecord(review_id=review_id, analysis_id=analysis_id,
                                        status=str(payload.get("status", "needs_more_analysis")), payload=payload))
            db.commit()
        return payload

    def get(self, review_id: str) -> dict[str, Any] | None:
        with self._sessions() as db:
            row = db.get(CriticReviewRecord, review_id)
            return dict(row.payload) if row else None

    def update(self, review_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        with self._sessions() as db:
            row = db.get(CriticReviewRecord, review_id)
            if not row:
                return None
            row.payload = payload
            row.status = str(payload.get("status", row.status))
            row.updated_at = datetime.now(timezone.utc)
            db.commit()
            return payload


class ArtifactStore:
    """Local MVP storage with an S3-compatible seam for production."""
    def __init__(self, root: str | Path | None = None):
        self.root = Path(root or os.environ.get("ARTIFACT_STORAGE_PATH", "./artifacts")).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def put_bytes(self, key: str, content: bytes) -> str:
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise ValueError("artifact key escapes storage root")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return f"file://{path}"

    def get_bytes(self, uri: str) -> bytes:
        parsed = urlparse(uri)
        if parsed.scheme != "file":
            raise ValueError("only file:// storage is enabled in the local adapter")
        path = Path(parsed.path).resolve()
        if self.root not in path.parents:
            raise ValueError("artifact URI escapes storage root")
        return path.read_bytes()


class S3ArtifactStore:
    """S3-compatible adapter, loaded only when ARTIFACT_STORAGE=s3."""
    def __init__(self, bucket: str | None = None, prefix: str = ""):
        try:
            import boto3
        except ImportError as exc:
            raise RuntimeError("Install boto3 to enable S3 artifact storage") from exc
        self.bucket = bucket or os.environ.get("ARTIFACT_S3_BUCKET", "")
        if not self.bucket:
            raise ValueError("ARTIFACT_S3_BUCKET is required")
        self.prefix = prefix or os.environ.get("ARTIFACT_S3_PREFIX", "")
        self.client = boto3.client("s3", endpoint_url=os.environ.get("ARTIFACT_S3_ENDPOINT") or None)

    def put_bytes(self, key: str, content: bytes) -> str:
        object_key = f"{self.prefix.rstrip('/')}/{key.lstrip('/')}".lstrip("/")
        self.client.put_object(Bucket=self.bucket, Key=object_key, Body=content)
        return f"s3://{self.bucket}/{object_key}"

    def get_bytes(self, uri: str) -> bytes:
        parsed = urlparse(uri)
        if parsed.scheme != "s3" or parsed.netloc != self.bucket:
            raise ValueError("URI does not belong to configured S3 bucket")
        return self.client.get_object(Bucket=self.bucket, Key=parsed.path.lstrip("/"))["Body"].read()


def reset_for_tests() -> None:
    """Compatibility hook; repositories create their own engine per instance."""
    return None
