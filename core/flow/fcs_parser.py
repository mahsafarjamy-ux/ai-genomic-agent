"""
Parse FCS 2.0/3.0/3.1 files into plot-ready metadata and event arrays.
Built directly on flowio (FCS parsing) + flowutils (compensation/transforms) —
both pure-Python, open-source, MIT licensed. No FlowJo/Cytobank code or assets.

Privacy: this module only ever reads a file path on the user's machine. Event
data and parsed objects stay in this process; only summarized metadata/stats
are meant to cross into anything that talks to Claude.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import flowio
import numpy as np

SCATTER_NAMES = {"FSC-A", "FSC-H", "FSC-W", "SSC-A", "SSC-H", "SSC-W"}
TIME_NAMES = {"TIME"}


class ParsedFCS:
    """Wraps a flowio.FlowData instance with convenience accessors."""

    def __init__(self, flow_data: flowio.FlowData):
        self.fd = flow_data

    @classmethod
    def from_path(cls, file_path: str | Path) -> "ParsedFCS":
        return cls(flowio.FlowData(str(file_path)))

    def channel_info(self) -> list[dict[str, Any]]:
        channels = []
        for i in range(self.fd.channel_count):
            ch = self.fd.channels.get(i + 1, {})
            pnn = ch.get("pnn", "")
            is_scatter = pnn.upper() in SCATTER_NAMES
            is_time = pnn.upper() in TIME_NAMES
            channels.append({
                "index": i,
                "pnn": pnn,
                "pns": ch.get("pns", ""),
                "pnr": ch.get("pnr"),
                "pne": ch.get("pne"),
                "png": ch.get("png"),
                "is_scatter": is_scatter,
                "is_time": is_time,
                "is_fluoro": not is_scatter and not is_time,
            })
        return channels

    def metadata(self) -> dict[str, Any]:
        text = self.fd.text
        channels = self.channel_info()
        fluoro_channels = [c for c in channels if c["is_fluoro"]]
        spill_raw = text.get("spillover") or text.get("spill")
        return {
            "version": self.fd.version,
            "cytometer": text.get("cyt", "Unknown"),
            "experiment_name": text.get("exp", ""),
            "acquisition_date": text.get("date", ""),
            "acquisition_time": text.get("btim", ""),
            "event_count": self.fd.event_count,
            "channel_count": self.fd.channel_count,
            "channels": channels,
            "panel_markers": [c["pns"] for c in fluoro_channels if c["pns"]],
            "fluorophores": [c["pnn"] for c in fluoro_channels],
            "has_compensation": bool(spill_raw),
        }

    def events(self, preprocess: bool = True) -> np.ndarray:
        """(n_events, n_channels) float64 array, gain/log-decade scaled if preprocess."""
        return self.fd.as_array(preprocess=preprocess)

    def compensation_matrix(self) -> dict[str, Any] | None:
        """Returns the spillover matrix from the FCS file's own keyword, if present."""
        text = self.fd.text
        spill_raw = text.get("spillover") or text.get("spill")
        if not spill_raw:
            return None
        import flowutils
        channel_labels = [c["pnn"] for c in self.channel_info()]
        try:
            parsed = flowutils.compensate.parse_compensation_matrix(spill_raw, channel_labels)
        except Exception:
            return None
        # parse_compensation_matrix returns (n+1, n): row 0 is 1-indexed channel
        # numbers, rows 1..n are the actual spillover matrix.
        channel_numbers = parsed[0].astype(int).tolist()
        matrix = parsed[1:].tolist()
        labels = [channel_labels[n - 1] for n in channel_numbers]
        return {
            "channel_labels": labels,
            "matrix": matrix,
        }
