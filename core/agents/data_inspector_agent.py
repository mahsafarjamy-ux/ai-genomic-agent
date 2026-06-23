"""
Data Inspector Agent: given a pipeline definition, tells the user exactly
what files they need, in what folder structure, and validates their local data
WITHOUT moving or copying any files (privacy-first).
"""

import os
import re
import json
from pathlib import Path
from typing import Optional
import anthropic


SYSTEM_PROMPT = """You are a bioinformatics data manager.
Given a pipeline definition and a user's data directory, produce a clear,
actionable checklist of what the user needs and whether they already have it.
Be specific about file naming conventions and formats. Never suggest uploading data."""


class DataInspectorAgent:
    def __init__(self, api_key: Optional[str] = None):
        self.client = anthropic.Anthropic(api_key=api_key or os.environ["ANTHROPIC_API_KEY"])

    def inspect(self, pipeline: dict, user_data_dir: str | Path) -> dict:
        """
        Scan user's data directory (read filenames only, never content) and
        report what's present vs missing for the pipeline.
        """
        user_data_dir = Path(user_data_dir)
        found_files = self._scan_directory(user_data_dir)

        requirements = pipeline.get("required_input_files", [])
        ref_requirements = pipeline.get("required_reference_files", [])

        satisfied = []
        missing = []
        warnings = []

        for req in requirements:
            pattern = req.get("format", "*")
            matches = self._find_matching(found_files, pattern, req.get("name", ""))
            if matches:
                satisfied.append({**req, "found": matches})
            else:
                missing.append(req)

        # Reference files typically live outside the data dir — just list them
        for ref in ref_requirements:
            missing.append({**ref, "note": "Reference file — download separately"})

        # Check sample count
        fastq_files = [f for f in found_files if f.endswith((".fastq.gz", ".fastq", ".fq.gz", ".fq"))]
        paired = [f for f in fastq_files if "_R1" in f or "_1.fastq" in f]
        if fastq_files and not paired and pipeline.get("analysis_type") in ["RNAseq", "WGS", "WES"]:
            warnings.append("Could not detect paired-end file naming (_R1/_R2). Check file names.")

        suggested_structure = self._suggest_structure(pipeline, user_data_dir)

        report = {
            "data_dir": str(user_data_dir),
            "analysis_type": pipeline.get("analysis_type"),
            "files_found": len(found_files),
            "satisfied_requirements": satisfied,
            "missing_requirements": missing,
            "warnings": warnings,
            "suggested_folder_structure": suggested_structure,
            "ready_to_run": len(missing) == 0,
            "samples_detected": self._detect_samples(found_files),
        }

        return report

    def _scan_directory(self, path: Path, max_depth: int = 4) -> list[str]:
        """Recursively list file paths relative to root. Never reads file content."""
        files = []
        if not path.exists():
            return files
        for item in path.rglob("*"):
            if item.is_file():
                try:
                    rel = item.relative_to(path)
                    depth = len(rel.parts)
                    if depth <= max_depth:
                        files.append(str(rel))
                except ValueError:
                    pass
        return files

    def _find_matching(self, files: list[str], format_hint: str, name: str) -> list[str]:
        ext_map = {
            "fastq.gz": [".fastq.gz", ".fq.gz"],
            "bam": [".bam"],
            "vcf": [".vcf", ".vcf.gz"],
            "bed": [".bed"],
            "csv": [".csv", ".tsv"],
            "idat": [".idat"],
        }
        exts = ext_map.get(format_hint.lower(), [f".{format_hint}"])
        return [f for f in files if any(f.lower().endswith(e) for e in exts)]

    def _detect_samples(self, files: list[str]) -> list[str]:
        """Extract sample names from file list."""
        patterns = [
            r'^([^/]+?)(?:_R[12]|_[12]\.fastq|\.bam|\.vcf)',
            r'samples?/([^/]+)',
        ]
        samples = set()
        for f in files:
            fname = Path(f).name
            for pat in patterns:
                m = re.match(pat, fname)
                if m:
                    samples.add(m.group(1))
        return sorted(samples)

    def _suggest_structure(self, pipeline: dict, base_dir: Path) -> dict:
        analysis = pipeline.get("analysis_type", "analysis")
        return {
            "recommended_layout": {
                f"{base_dir}/": {
                    "raw/": "Raw FASTQ or BAM files (one file per sample, or paired _R1/_R2)",
                    "reference/": "Reference genome FASTA + GTF annotation files",
                    "results/": "Will be created by the pipeline",
                    "logs/": "Will be created by the pipeline",
                    "config.yaml": "Sample sheet and pipeline config (auto-generated)",
                }
            },
            "naming_convention": self._naming_convention(pipeline),
        }

    def _naming_convention(self, pipeline: dict) -> str:
        atype = pipeline.get("analysis_type", "")
        if atype in ["RNAseq", "WGS", "WES"]:
            return "SampleName_R1.fastq.gz / SampleName_R2.fastq.gz for paired-end"
        elif atype == "scRNAseq":
            return "SampleName_S1_L001_R1_001.fastq.gz (10x Genomics convention)"
        elif atype == "Methylation":
            return "SampleName_R1.fastq.gz / SampleName_R2.fastq.gz (RRBS or WGBS)"
        return "SampleName_R1.fastq.gz"
