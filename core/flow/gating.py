"""
Manual gating geometry: rectangle, polygon, quadrant, interval.
Pure NumPy — no FlowJo/Cytobank gating-engine code involved.

A gate is defined against two channel indices (or one, for interval gates)
and a `parent_gate_id` so gates can nest into a tree. Each gate's boolean
mask is computed against the full preprocessed event array, so percentages
are always relative to the parent population (or to all events at the root).
"""
from __future__ import annotations

from typing import Any

import numpy as np

GATE_TYPES = ("rectangle", "polygon", "quadrant", "interval")


def apply_rectangle_gate(data: np.ndarray, x_index: int, y_index: int, x_min: float, x_max: float, y_min: float, y_max: float) -> np.ndarray:
    x = data[:, x_index]
    y = data[:, y_index]
    return (x >= x_min) & (x <= x_max) & (y >= y_min) & (y <= y_max)


def apply_polygon_gate(data: np.ndarray, x_index: int, y_index: int, vertices: list[list[float]]) -> np.ndarray:
    """Point-in-polygon via the ray-casting algorithm, vectorized over all events."""
    x = data[:, x_index]
    y = data[:, y_index]
    poly = np.asarray(vertices, dtype=np.float64)
    n = len(poly)
    inside = np.zeros(len(x), dtype=bool)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        cond = (yi > y) != (yj > y)
        # avoid division by zero when the edge is horizontal
        denom = (yj - yi)
        denom = np.where(denom == 0, np.finfo(np.float64).eps, denom)
        x_intersect = xi + (y - yi) / denom * (xj - xi)
        toggle = cond & (x < x_intersect)
        inside = np.where(toggle, ~inside, inside)
        j = i
    return inside


def apply_quadrant_gate(data: np.ndarray, x_index: int, y_index: int, x_threshold: float, y_threshold: float, quadrant: str) -> np.ndarray:
    """quadrant is one of: 'UL', 'UR', 'LL', 'LR' (upper/lower-left/right)."""
    x = data[:, x_index]
    y = data[:, y_index]
    x_pos = x >= x_threshold
    y_pos = y >= y_threshold
    mapping = {
        "UR": x_pos & y_pos,
        "UL": (~x_pos) & y_pos,
        "LR": x_pos & (~y_pos),
        "LL": (~x_pos) & (~y_pos),
    }
    if quadrant not in mapping:
        raise ValueError(f"quadrant must be one of {list(mapping)}, got {quadrant}")
    return mapping[quadrant]


def apply_interval_gate(data: np.ndarray, x_index: int, x_min: float, x_max: float) -> np.ndarray:
    x = data[:, x_index]
    return (x >= x_min) & (x <= x_max)


def compute_gate_mask(data: np.ndarray, gate_def: dict[str, Any], parent_mask: np.ndarray | None = None) -> np.ndarray:
    """gate_def: {"type": ..., "x_index": ..., "y_index": ..., **params}"""
    gtype = gate_def["type"]
    if gtype == "rectangle":
        mask = apply_rectangle_gate(
            data, gate_def["x_index"], gate_def["y_index"],
            gate_def["x_min"], gate_def["x_max"], gate_def["y_min"], gate_def["y_max"],
        )
    elif gtype == "polygon":
        mask = apply_polygon_gate(data, gate_def["x_index"], gate_def["y_index"], gate_def["vertices"])
    elif gtype == "quadrant":
        mask = apply_quadrant_gate(
            data, gate_def["x_index"], gate_def["y_index"],
            gate_def["x_threshold"], gate_def["y_threshold"], gate_def["quadrant"],
        )
    elif gtype == "interval":
        mask = apply_interval_gate(data, gate_def["x_index"], gate_def["x_min"], gate_def["x_max"])
    else:
        raise ValueError(f"Unknown gate type: {gtype}")

    if parent_mask is not None:
        mask = mask & parent_mask
    return mask


def gate_stats(mask: np.ndarray, parent_mask: np.ndarray | None, total_events: int) -> dict[str, Any]:
    count = int(mask.sum())
    parent_count = int(parent_mask.sum()) if parent_mask is not None else total_events
    return {
        "count": count,
        "percent_of_parent": round(100 * count / parent_count, 3) if parent_count else 0.0,
        "percent_of_total": round(100 * count / total_events, 3) if total_events else 0.0,
    }
