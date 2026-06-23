"""
Flow Cytometry Analysis module — FCS upload, metadata, plotting, manual gating.

Privacy: uploaded .fcs files are written to the local `uploads/flow/` directory
on this machine only. Raw event arrays are re-parsed from disk on demand and
never persisted to the database — only metadata, gate definitions, and
computed counts/percentages are stored. Nothing in this router calls Claude;
any future AI-assistant features must only ever receive the metadata/stats
shapes returned here, never raw event arrays.
"""
from __future__ import annotations

import csv
import io
import uuid
from pathlib import Path
from typing import Any, Optional

import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.flow.db import (
    SessionLocal, init_db, FlowProject, FlowSample, FlowFile, FlowGate, FlowResult,
)
from core.flow.fcs_parser import ParsedFCS
from core.flow.transforms import apply_transform
from core.flow.gating import compute_gate_mask, gate_stats

router = APIRouter()

UPLOAD_DIR = Path("uploads/flow")


def _db() -> Session:
    return SessionLocal()


def _channel_index_map(file_row: FlowFile) -> dict[str, int]:
    return {c["pnn"]: c["index"] for c in file_row.metadata_json.get("channels", [])}


def _load_events(file_row: FlowFile) -> np.ndarray:
    parsed = ParsedFCS.from_path(file_row.file_path)
    return parsed.events(preprocess=True)


def _gate_chain(db: Session, gate_id: str) -> list[FlowGate]:
    """Root-to-leaf ordered chain of gates ending at gate_id."""
    chain: list[FlowGate] = []
    current = db.get(FlowGate, gate_id)
    while current is not None:
        chain.append(current)
        current = db.get(FlowGate, current.parent_gate_id) if current.parent_gate_id else None
    chain.reverse()
    return chain


def _replay_chain_mask(events: np.ndarray, chain: list[FlowGate], index_map: dict[str, int]) -> np.ndarray | None:
    """Replays each ancestor gate's own transform + geometry, ANDing masks. None if chain empty."""
    mask: np.ndarray | None = None
    for gate in chain:
        x_idx = index_map[gate.x_channel]
        y_idx = index_map.get(gate.y_channel) if gate.y_channel else None
        tf = gate.transform_json or {"type": "linear"}
        indices = [i for i in (x_idx, y_idx) if i is not None]
        transformed = apply_transform(events, indices, transform_type=tf.get("type", "linear"),
                                       t=tf.get("t", 262144), m=tf.get("m", 4.5), w=tf.get("w", 0.5), a=tf.get("a", 0))
        gate_def = dict(gate.definition_json)
        gate_def["type"] = gate.gate_type
        gate_def["x_index"] = x_idx
        if y_idx is not None:
            gate_def["y_index"] = y_idx
        mask = compute_gate_mask(transformed, gate_def, parent_mask=mask)
    return mask


# ---------- Schemas ----------

class GateCreate(BaseModel):
    name: str
    gate_type: str  # rectangle | polygon | quadrant | interval
    x_channel: str
    y_channel: str = ""
    definition: dict[str, Any]
    transform: dict[str, Any] = {}
    parent_gate_id: Optional[str] = None


class EventsQuery(BaseModel):
    x_channel: str
    y_channel: str
    transform: str = "logicle"
    max_points: int = 5000
    parent_gate_id: Optional[str] = None


# ---------- Shared DB-write helper ----------

def _register_file_row(
    db, project_name: str, sample_name: str, filename: str,
    file_path: str, metadata: dict, compensation: dict,
) -> FlowFile:
    project = db.query(FlowProject).filter_by(name=project_name).first()
    if not project:
        project = FlowProject(name=project_name)
        db.add(project)
        db.flush()

    sample = FlowSample(project_id=project.id, name=sample_name or filename)
    db.add(sample)
    db.flush()

    file_id = str(uuid.uuid4())
    row = FlowFile(
        id=file_id,
        sample_id=sample.id,
        filename=filename,
        file_path=file_path,
        fcs_version=str(metadata["version"]),
        cytometer=metadata["cytometer"],
        acquisition_date=metadata["acquisition_date"],
        event_count=metadata["event_count"],
        channel_count=metadata["channel_count"],
        metadata_json=metadata,
        compensation_json=compensation,
    )
    db.add(row)
    db.commit()
    return row


# ---------- Endpoints ----------

@router.post("/register-path")
def register_from_path(
    file_path: str = Form(...),
    project_name: str = Form("Default Project"),
    sample_name: str = Form(""),
):
    """Register a local FCS file by filesystem path — no upload needed.

    The file stays where it is; only the path is stored.  Use this for large
    files that would be impractical to upload (FCS files routinely reach 1 GB+).
    """
    p = Path(file_path).expanduser().resolve()
    if not p.exists() or not p.is_file():
        raise HTTPException(400, f"File not found: {p}")
    if not p.name.lower().endswith(".fcs"):
        raise HTTPException(400, "Only .fcs files are accepted")

    init_db()
    try:
        parsed = ParsedFCS.from_path(p)
        metadata = parsed.metadata()
        compensation = parsed.compensation_matrix()
    except Exception as e:
        raise HTTPException(400, f"Could not parse FCS file: {e}")

    db = _db()
    try:
        row = _register_file_row(
            db, project_name, sample_name, p.name, str(p), metadata, compensation
        )
        return {"file_id": row.id, "metadata": metadata, "compensation": compensation}
    finally:
        db.close()


@router.post("/upload")
async def upload_fcs(
    file: UploadFile = File(...),
    project_name: str = Form("Default Project"),
    sample_name: str = Form(""),
):
    if not file.filename.lower().endswith(".fcs"):
        raise HTTPException(400, "Only .fcs files are accepted")

    init_db()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    file_id = str(uuid.uuid4())
    save_path = UPLOAD_DIR / f"{file_id}.fcs"
    content = await file.read()
    save_path.write_bytes(content)

    try:
        parsed = ParsedFCS.from_path(save_path)
        metadata = parsed.metadata()
        compensation = parsed.compensation_matrix()
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(400, f"Could not parse FCS file: {e}")

    db = _db()
    try:
        file_row = _register_file_row(
            db, project_name, sample_name or (file.filename or ""),
            file.filename or "sample.fcs", str(save_path), metadata, compensation
        )
        return {"file_id": file_row.id, "metadata": metadata, "compensation": compensation}
    finally:
        db.close()


@router.get("/files")
async def list_files():
    db = _db()
    try:
        rows = db.query(FlowFile).all()
        return [
            {
                "file_id": r.id,
                "filename": r.filename,
                "sample_name": r.sample.name if r.sample else "",
                "project_name": r.sample.project.name if r.sample and r.sample.project else "",
                "cytometer": r.cytometer,
                "acquisition_date": r.acquisition_date,
                "event_count": r.event_count,
                "channel_count": r.channel_count,
                "uploaded_at": r.uploaded_at.isoformat(),
            }
            for r in rows
        ]
    finally:
        db.close()


@router.get("/files/{file_id}")
async def get_file_metadata(file_id: str):
    db = _db()
    try:
        row = db.get(FlowFile, file_id)
        if not row:
            raise HTTPException(404, "File not found")
        return {"file_id": row.id, "filename": row.filename, **row.metadata_json}
    finally:
        db.close()


@router.get("/files/{file_id}/compensation")
async def get_compensation(file_id: str):
    db = _db()
    try:
        row = db.get(FlowFile, file_id)
        if not row:
            raise HTTPException(404, "File not found")
        return row.compensation_json or {"channel_labels": [], "matrix": []}
    finally:
        db.close()


@router.get("/files/{file_id}/events")
async def get_events(
    file_id: str,
    x_channel: str = Query(...),
    y_channel: str = Query(...),
    transform: str = Query("logicle"),
    max_points: int = Query(5000, le=20000),
    parent_gate_id: Optional[str] = Query(None),
):
    db = _db()
    try:
        row = db.get(FlowFile, file_id)
        if not row:
            raise HTTPException(404, "File not found")

        index_map = _channel_index_map(row)
        if x_channel not in index_map or y_channel not in index_map:
            raise HTTPException(400, "Unknown channel name")

        events = _load_events(row)

        parent_mask = None
        if parent_gate_id:
            chain = _gate_chain(db, parent_gate_id)
            parent_mask = _replay_chain_mask(events, chain, index_map)
            events = events[parent_mask]

        x_idx, y_idx = index_map[x_channel], index_map[y_channel]
        plot_data = apply_transform(events, [x_idx, y_idx], transform_type=transform)

        n = plot_data.shape[0]
        if n > max_points:
            rng = np.random.default_rng(0)
            sample_idx = rng.choice(n, size=max_points, replace=False)
            plot_data = plot_data[sample_idx]

        return {
            "x_channel": x_channel,
            "y_channel": y_channel,
            "transform": transform,
            "total_events": n,
            "returned_events": plot_data.shape[0],
            "x": plot_data[:, x_idx].tolist(),
            "y": plot_data[:, y_idx].tolist(),
        }
    finally:
        db.close()


@router.post("/files/{file_id}/gates")
async def create_gate(file_id: str, body: GateCreate):
    db = _db()
    try:
        row = db.get(FlowFile, file_id)
        if not row:
            raise HTTPException(404, "File not found")

        index_map = _channel_index_map(row)
        if body.x_channel not in index_map:
            raise HTTPException(400, f"Unknown x_channel: {body.x_channel}")
        if body.y_channel and body.y_channel not in index_map:
            raise HTTPException(400, f"Unknown y_channel: {body.y_channel}")

        events = _load_events(row)

        parent_mask = None
        if body.parent_gate_id:
            parent = db.get(FlowGate, body.parent_gate_id)
            if not parent or parent.file_id != file_id:
                raise HTTPException(400, "Invalid parent_gate_id")
            chain = _gate_chain(db, body.parent_gate_id)
            parent_mask = _replay_chain_mask(events, chain, index_map)

        x_idx = index_map[body.x_channel]
        y_idx = index_map.get(body.y_channel) if body.y_channel else None
        indices = [i for i in (x_idx, y_idx) if i is not None]
        tf = body.transform or {"type": "linear"}
        transformed = apply_transform(events, indices, transform_type=tf.get("type", "linear"),
                                       t=tf.get("t", 262144), m=tf.get("m", 4.5), w=tf.get("w", 0.5), a=tf.get("a", 0))

        gate_def = dict(body.definition)
        gate_def["type"] = body.gate_type
        gate_def["x_index"] = x_idx
        if y_idx is not None:
            gate_def["y_index"] = y_idx

        mask = compute_gate_mask(transformed, gate_def, parent_mask=parent_mask)
        stats = gate_stats(mask, parent_mask, total_events=events.shape[0])

        gate_row = FlowGate(
            file_id=file_id,
            parent_gate_id=body.parent_gate_id,
            name=body.name,
            gate_type=body.gate_type,
            x_channel=body.x_channel,
            y_channel=body.y_channel,
            definition_json=body.definition,
            transform_json=tf,
        )
        db.add(gate_row)
        db.flush()

        result_row = FlowResult(
            file_id=file_id,
            gate_id=gate_row.id,
            count=stats["count"],
            percent_of_parent=stats["percent_of_parent"],
            percent_of_total=stats["percent_of_total"],
        )
        db.add(result_row)
        db.commit()

        return {
            "gate_id": gate_row.id,
            "name": gate_row.name,
            "gate_type": gate_row.gate_type,
            "parent_gate_id": gate_row.parent_gate_id,
            **stats,
        }
    finally:
        db.close()


@router.get("/files/{file_id}/gates")
async def list_gates(file_id: str):
    db = _db()
    try:
        gates = db.query(FlowGate).filter_by(file_id=file_id).all()
        out = []
        for g in gates:
            latest_result = (
                db.query(FlowResult)
                .filter_by(gate_id=g.id)
                .order_by(FlowResult.computed_at.desc())
                .first()
            )
            out.append({
                "gate_id": g.id,
                "name": g.name,
                "gate_type": g.gate_type,
                "x_channel": g.x_channel,
                "y_channel": g.y_channel,
                "parent_gate_id": g.parent_gate_id,
                "definition": g.definition_json,
                "transform": g.transform_json,
                "count": latest_result.count if latest_result else None,
                "percent_of_parent": latest_result.percent_of_parent if latest_result else None,
                "percent_of_total": latest_result.percent_of_total if latest_result else None,
            })
        return out
    finally:
        db.close()


@router.delete("/gates/{gate_id}")
async def delete_gate(gate_id: str):
    db = _db()
    try:
        gate = db.get(FlowGate, gate_id)
        if not gate:
            raise HTTPException(404, "Gate not found")

        # cascade-delete descendants (children may reference this gate as parent)
        to_delete = [gate]
        frontier = [gate.id]
        while frontier:
            children = db.query(FlowGate).filter(FlowGate.parent_gate_id.in_(frontier)).all()
            if not children:
                break
            to_delete.extend(children)
            frontier = [c.id for c in children]

        for g in to_delete:
            db.query(FlowResult).filter_by(gate_id=g.id).delete()
        for g in to_delete:
            db.delete(g)
        db.commit()
        return {"deleted": [g.id for g in to_delete]}
    finally:
        db.close()


@router.get("/files/{file_id}/export")
async def export_gating_csv(file_id: str):
    db = _db()
    try:
        row = db.get(FlowFile, file_id)
        if not row:
            raise HTTPException(404, "File not found")
        gates = db.query(FlowGate).filter_by(file_id=file_id).all()

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["gate_name", "gate_type", "parent_gate", "x_channel", "y_channel", "count", "percent_of_parent", "percent_of_total"])
        gate_names = {g.id: g.name for g in gates}
        for g in gates:
            latest_result = (
                db.query(FlowResult)
                .filter_by(gate_id=g.id)
                .order_by(FlowResult.computed_at.desc())
                .first()
            )
            writer.writerow([
                g.name, g.gate_type, gate_names.get(g.parent_gate_id, ""), g.x_channel, g.y_channel,
                latest_result.count if latest_result else "",
                latest_result.percent_of_parent if latest_result else "",
                latest_result.percent_of_total if latest_result else "",
            ])

        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={row.filename}_gating.csv"},
        )
    finally:
        db.close()
