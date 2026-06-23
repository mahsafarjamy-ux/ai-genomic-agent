"""
Channel transformations for flow cytometry plotting: logicle, biexponential
(hyperlog), arcsinh, and log10. Thin wrapper over flowutils.transforms.
"""
from __future__ import annotations

import numpy as np
import flowutils

TRANSFORM_TYPES = ("logicle", "biexponential", "arcsinh", "log10", "linear")


def apply_transform(
    data: np.ndarray,
    channel_indices: list[int],
    transform_type: str = "logicle",
    t: float = 262144,
    m: float = 4.5,
    w: float = 0.5,
    a: float = 0,
) -> np.ndarray:
    """Returns a copy of `data` with the given channels transformed."""
    if transform_type == "linear" or not channel_indices:
        return data
    out = data.copy()
    if transform_type == "logicle":
        out = flowutils.transforms.logicle(out, channel_indices, t=t, m=m, w=w, a=a)
    elif transform_type == "biexponential":
        out = flowutils.transforms.hyperlog(out, channel_indices, t=t, m=m, w=w, a=a)
    elif transform_type == "arcsinh":
        out = flowutils.transforms.asinh(out, channel_indices, t, m, a)
    elif transform_type == "log10":
        out = flowutils.transforms.log(out, channel_indices, t, m)
    else:
        raise ValueError(f"Unknown transform_type: {transform_type}")
    return out
