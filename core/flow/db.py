"""
SQLite-backed persistence for the Flow Cytometry module.

This is the first real persistence layer in the codebase (everything else
still uses in-memory dicts — see api/routers/connectors.py). Uses the same
DATABASE_URL as the rest of the app (api/.env), defaulting to a local SQLite
file so no Postgres/Docker setup is required for development.

Privacy: only metadata/paths/gate definitions/computed stats are stored here.
Raw FCS event arrays are never written to this database — they're re-parsed
from the on-disk file (uploads/flow/<file_id>.fcs) on demand.
"""
from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timezone

from sqlalchemy import create_engine, ForeignKey, JSON, DateTime, Integer, Float, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker, relationship

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./genomic_agent.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine_options = {"pool_pre_ping": True}
if os.getenv("VERCEL") and not DATABASE_URL.startswith("sqlite"):
    from sqlalchemy.pool import NullPool
    engine_options["poolclass"] = NullPool
DATABASE_SCHEMA = os.getenv("DATABASE_SCHEMA", "")
if DATABASE_SCHEMA and not re.fullmatch(r"[a-z][a-z0-9_]*", DATABASE_SCHEMA):
    raise ValueError("Invalid database schema name")
engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_options)
if DATABASE_SCHEMA:
    engine = engine.execution_options(schema_translate_map={None: DATABASE_SCHEMA})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class FlowProject(Base):
    __tablename__ = "flow_projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    samples: Mapped[list["FlowSample"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class FlowSample(Base):
    __tablename__ = "flow_samples"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("flow_projects.id"))
    name: Mapped[str] = mapped_column(String)
    group_label: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    project: Mapped["FlowProject"] = relationship(back_populates="samples")
    files: Mapped[list["FlowFile"]] = relationship(back_populates="sample", cascade="all, delete-orphan")


class FlowFile(Base):
    __tablename__ = "flow_files"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    sample_id: Mapped[str] = mapped_column(ForeignKey("flow_samples.id"))
    filename: Mapped[str] = mapped_column(String)
    file_path: Mapped[str] = mapped_column(String)  # local path only, never a cloud URL
    fcs_version: Mapped[str] = mapped_column(String, default="")
    cytometer: Mapped[str] = mapped_column(String, default="")
    acquisition_date: Mapped[str] = mapped_column(String, default="")
    event_count: Mapped[int] = mapped_column(Integer, default=0)
    channel_count: Mapped[int] = mapped_column(Integer, default=0)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    compensation_json: Mapped[dict] = mapped_column(JSON, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    sample: Mapped["FlowSample"] = relationship(back_populates="files")
    gates: Mapped[list["FlowGate"]] = relationship(back_populates="file", cascade="all, delete-orphan")
    results: Mapped[list["FlowResult"]] = relationship(back_populates="file", cascade="all, delete-orphan")


class FlowGateTemplate(Base):
    __tablename__ = "flow_gate_templates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, default="")
    definition_json: Mapped[dict] = mapped_column(JSON)  # ordered list of gate defs to replay on any file
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class FlowGate(Base):
    __tablename__ = "flow_gates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    file_id: Mapped[str] = mapped_column(ForeignKey("flow_files.id"))
    parent_gate_id: Mapped[str | None] = mapped_column(ForeignKey("flow_gates.id"), nullable=True)
    name: Mapped[str] = mapped_column(String)
    gate_type: Mapped[str] = mapped_column(String)  # rectangle | polygon | quadrant | interval
    x_channel: Mapped[str] = mapped_column(String)
    y_channel: Mapped[str] = mapped_column(String, default="")
    definition_json: Mapped[dict] = mapped_column(JSON)  # raw gate geometry (bounds/vertices/thresholds)
    transform_json: Mapped[dict] = mapped_column(JSON, default=dict)  # transform applied when gate was drawn
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    file: Mapped["FlowFile"] = relationship(back_populates="gates")


class FlowResult(Base):
    __tablename__ = "flow_results"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    file_id: Mapped[str] = mapped_column(ForeignKey("flow_files.id"))
    gate_id: Mapped[str] = mapped_column(ForeignKey("flow_gates.id"))
    count: Mapped[int] = mapped_column(Integer)
    percent_of_parent: Mapped[float] = mapped_column(Float)
    percent_of_total: Mapped[float] = mapped_column(Float)
    computed_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    file: Mapped["FlowFile"] = relationship(back_populates="results")


class FlowReport(Base):
    __tablename__ = "flow_reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("flow_projects.id"), nullable=True)
    file_id: Mapped[str] = mapped_column(ForeignKey("flow_files.id"), nullable=True)
    report_type: Mapped[str] = mapped_column(String, default="gating_summary")
    format: Mapped[str] = mapped_column(String, default="csv")  # csv | pdf
    file_path: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    token: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    # Billing / licensing
    plan: Mapped[str] = mapped_column(String(50), default="free")
    stripe_customer_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    license_key: Mapped[str | None] = mapped_column(String(64), nullable=True)


class DeviceActivation(Base):
    __tablename__ = "device_activations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    device_id: Mapped[str] = mapped_column(String(128))   # stable ID stored in localStorage
    device_label: Mapped[str] = mapped_column(String(255), default="")
    activated_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    from sqlalchemy import inspect, text
    columns = {column["name"] for column in inspect(engine).get_columns("users", schema=DATABASE_SCHEMA or None)}
    users_table = f'"{DATABASE_SCHEMA}"."users"' if DATABASE_SCHEMA else '"users"'
    for name, definition in [
        ("plan", "VARCHAR(50) NOT NULL DEFAULT 'free'"),
        ("stripe_customer_id", "VARCHAR(100)"),
        ("license_key", "VARCHAR(64)"),
    ]:
        if name not in columns:
            with engine.begin() as conn:
                conn.execute(text(f'ALTER TABLE {users_table} ADD COLUMN "{name}" {definition}'))
    if DATABASE_SCHEMA and engine.dialect.name == "postgresql":
        # API access uses the server's database role; client Data API roles have no policies.
        with engine.begin() as conn:
            for table in Base.metadata.sorted_tables:
                conn.execute(text(f'ALTER TABLE "{DATABASE_SCHEMA}"."{table.name}" ENABLE ROW LEVEL SECURITY'))


def get_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
