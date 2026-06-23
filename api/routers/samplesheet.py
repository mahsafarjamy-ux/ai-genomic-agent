"""
Samplesheet auto-generation from a data directory.
Scans for FASTQ / BAM / VCF files, infers sample names from naming conventions,
groups paired-end reads, and generates the correct CSV format for each pipeline.
"""

import os
import re
import csv
import io
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# ── FASTQ naming patterns ─────────────────────────────────────────────────
# Order matters — most specific first

_R1_RE = re.compile(
    r'(_S\d+)?(_L\d+)?[_\.]?[Rr]1[_\.]?(\d{3})?\.(fastq|fq)(\.gz)?$'
    r'|[_\.]1\.(fastq|fq)(\.gz)?$'
    r'|[_\.]read1\.(fastq|fq)(\.gz)?$',
    re.IGNORECASE,
)
_R2_RE = re.compile(
    r'(_S\d+)?(_L\d+)?[_\.]?[Rr]2[_\.]?(\d{3})?\.(fastq|fq)(\.gz)?$'
    r'|[_\.]2\.(fastq|fq)(\.gz)?$'
    r'|[_\.]read2\.(fastq|fq)(\.gz)?$',
    re.IGNORECASE,
)
_FASTQ_RE = re.compile(r'\.(fastq|fq)(\.gz)?$', re.IGNORECASE)
_BAM_RE   = re.compile(r'\.bam$', re.IGNORECASE)
_VCF_RE   = re.compile(r'\.(vcf|vcf\.gz|bcf)$', re.IGNORECASE)


def _strip_read_suffix(name: str) -> str:
    """Remove R1/R2/L00N lane/sample suffixes to get clean sample name."""
    # Remove Illumina run suffix: _S1_L001_R1_001
    name = re.sub(r'_S\d+_L\d+_R[12]_\d+$', '', name, flags=re.IGNORECASE)
    # Remove simple _R1 / _R2 / _1 / _2
    name = re.sub(r'[_\.]R[12]$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'[_\.][12]$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'[_\.]read[12]$', '', name, flags=re.IGNORECASE)
    # Remove trailing _ or .
    return name.rstrip('_.')


def _sample_name_from_file(path: Path) -> str:
    """Derive sample name from FASTQ filename (without extension + read suffix)."""
    stem = path.name
    # Strip .fastq.gz / .fq.gz / .fastq / .fq
    stem = re.sub(r'\.(fastq|fq)(\.gz)?$', '', stem, flags=re.IGNORECASE)
    return _strip_read_suffix(stem)


# ── File tree scanner ─────────────────────────────────────────────────────

def _scan_fastq_files(root: Path, max_depth: int = 4) -> list[Path]:
    """Recursively find all FASTQ files up to max_depth levels deep."""
    found = []
    def _walk(p: Path, depth: int):
        if depth > max_depth:
            return
        try:
            for child in sorted(p.iterdir()):
                if child.is_file() and _FASTQ_RE.search(child.name):
                    found.append(child)
                elif child.is_dir() and not child.name.startswith('.'):
                    _walk(child, depth + 1)
        except PermissionError:
            pass
    _walk(root, 0)
    return found


def _group_samples(fastqs: list[Path]) -> list[dict]:
    """
    Group FASTQ files by sample name, pairing R1 and R2.
    Returns list of dicts: {sample, fastq_1, fastq_2, paired}
    """
    r1_files: dict[str, Path] = {}
    r2_files: dict[str, Path] = {}
    unpaired: dict[str, Path] = {}

    for f in fastqs:
        if _R1_RE.search(f.name):
            key = _sample_name_from_file(f)
            r1_files[key] = f
        elif _R2_RE.search(f.name):
            key = _sample_name_from_file(f)
            r2_files[key] = f
        elif _FASTQ_RE.search(f.name):
            key = _sample_name_from_file(f)
            unpaired[key] = f

    samples = []
    # Paired-end
    for name in sorted(set(r1_files) | set(r2_files)):
        r1 = r1_files.get(name)
        r2 = r2_files.get(name)
        samples.append({
            "sample":   name,
            "fastq_1":  str(r1) if r1 else "",
            "fastq_2":  str(r2) if r2 else "",
            "paired":   bool(r1 and r2),
            "warning":  "Missing R2 — will run as single-end" if r1 and not r2
                        else ("Missing R1" if r2 and not r1 else ""),
        })
    # Single-end only files
    for name, f in sorted(unpaired.items()):
        if name not in r1_files and name not in r2_files:
            samples.append({
                "sample":  name,
                "fastq_1": str(f),
                "fastq_2": "",
                "paired":  False,
                "warning": "Single-end reads",
            })
    return samples


# ── Samplesheet generators per pipeline ──────────────────────────────────

def _make_rnaseq(samples: list[dict], strandedness: str = "auto") -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["sample", "fastq_1", "fastq_2", "strandedness"])
    for s in samples:
        w.writerow([s["sample"], s["fastq_1"], s["fastq_2"], strandedness])
    return buf.getvalue()


def _make_wgs(samples: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["patient", "sample", "fastq_1", "fastq_2", "sex", "status"])
    for s in samples:
        # Guess tumor/normal from name
        status = "1" if re.search(r'tumor|tumour|cancer|case|T\d*$', s["sample"], re.I) else "0"
        w.writerow(["Patient1", s["sample"], s["fastq_1"], s["fastq_2"], "", status])
    return buf.getvalue()


def _make_scrnaseq(samples: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["sample", "fastq_1", "fastq_2", "expected_cells"])
    for s in samples:
        w.writerow([s["sample"], s["fastq_1"], s["fastq_2"], "auto"])
    return buf.getvalue()


def _make_chipseq(samples: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["sample", "fastq_1", "fastq_2", "antibody", "control"])
    for s in samples:
        is_input = bool(re.search(r'input|control|IgG', s["sample"], re.I))
        w.writerow([
            s["sample"], s["fastq_1"], s["fastq_2"],
            "" if is_input else "ANTIBODY",
            "" if is_input else "INPUT",
        ])
    return buf.getvalue()


def _make_generic(samples: list[dict]) -> str:
    """Generic CSV for methylation, microbiome, ATAC-seq, etc."""
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["sample", "fastq_1", "fastq_2"])
    for s in samples:
        w.writerow([s["sample"], s["fastq_1"], s["fastq_2"]])
    return buf.getvalue()


_GENERATORS = {
    "rnaseq":     _make_rnaseq,
    "wgs":        _make_wgs,
    "wes":        _make_wgs,   # same format
    "scrnaseq":   _make_scrnaseq,
    "chipseq":    _make_chipseq,
    "atacseq":    _make_generic,
    "methylation":_make_generic,
    "microbiome": _make_generic,
    "proteomics": _make_generic,
    "multiomics": _make_generic,
}


# ── Request / response models ─────────────────────────────────────────────

class ScanRequest(BaseModel):
    data_dir: str
    pipeline_type: str = "rnaseq"
    strandedness: str  = "auto"


class EditedSamplesheet(BaseModel):
    pipeline_type: str
    rows: list[dict]


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.post("/detect")
async def detect_samples(req: ScanRequest):
    """
    Scan a directory for FASTQ files.
    Returns detected samples and a ready-to-use samplesheet CSV.
    """
    root = Path(req.data_dir).expanduser()
    if not root.exists():
        raise HTTPException(404, f"Directory not found: {req.data_dir}")
    if not root.is_dir():
        raise HTTPException(400, f"Path is not a directory: {req.data_dir}")

    fastqs = _scan_fastq_files(root)
    if not fastqs:
        # Fall back to BAM files
        bams = [f for f in root.rglob("*.bam")]
        if bams:
            samples = [{"sample": f.stem, "fastq_1": str(f), "fastq_2": "", "paired": False, "warning": "BAM input"} for f in sorted(bams)]
        else:
            samples = []
    else:
        samples = _group_samples(fastqs)

    if not samples:
        raise HTTPException(422, (
            f"No FASTQ or BAM files found in {req.data_dir}. "
            "Make sure you selected the correct folder."
        ))

    gen = _GENERATORS.get(req.pipeline_type, _make_generic)
    if req.pipeline_type == "rnaseq":
        csv_content = gen(samples, req.strandedness)
    else:
        csv_content = gen(samples)

    warnings = [s["warning"] for s in samples if s["warning"]]

    return {
        "samples": samples,
        "sample_count": len(samples),
        "paired_count": sum(1 for s in samples if s["paired"]),
        "samplesheet_csv": csv_content,
        "pipeline_type": req.pipeline_type,
        "warnings": warnings,
        "files_scanned": len(fastqs),
    }


@router.post("/generate")
async def generate_from_edits(req: EditedSamplesheet):
    """Regenerate the samplesheet CSV from user-edited rows."""
    gen = _GENERATORS.get(req.pipeline_type, _make_generic)
    try:
        csv_content = gen(req.rows)
    except Exception as e:
        raise HTTPException(400, f"Could not generate samplesheet: {e}")
    return {"samplesheet_csv": csv_content}
