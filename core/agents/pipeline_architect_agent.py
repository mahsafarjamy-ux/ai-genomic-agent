"""
Pipeline Architect Agent
Takes a natural-language scientific question, reasons about which data types
and tools to combine, and generates a complete runnable Snakemake pipeline
(Snakefile + config.yaml + environment.yaml + README).

Output is saved to work/generated/{pipeline_id}/ and can be run with:
    cd work/generated/{pipeline_id}
    conda env create -f environment.yaml && conda activate {env_name}
    snakemake --cores 8 --use-conda

Privacy guarantee: only the question text reaches Claude. No genomic data is involved.
"""

import os
import sys
import uuid
import json
import textwrap
from pathlib import Path
from typing import Optional
from anthropic import Anthropic

sys.path.insert(0, str(Path(__file__).parents[2]))

CLAUDE_MODEL = "claude-sonnet-4-6"

PIPELINE_SYSTEM_PROMPT = """You are a world-class bioinformatics pipeline engineer with deep expertise in:
- Snakemake (Python-based workflow management, conda environments, Docker containers)
- nf-core / Nextflow
- All major NGS analysis tools: STAR, BWA-MEM2, GATK4, Salmon, DESeq2, Seurat, Scanpy, scVI,
  cell2location, MOFA+, MetaPhlAn4, HUMAnN3, ArchR, MACS3, TOBIAS, AlphaFold2/3, DIA-NN,
  Bismark, HISAT2, featureCounts, MultiQC, FastQC, fastp, Trim Galore, bcftools, bedtools
- R bioconductor packages: DESeq2, edgeR, limma, clusterProfiler, Seurat, ArchR, minfi, ChAMP
- Python genomics: pysam, cyvcf2, pyranges, scanpy, anndata, squidpy, cellxgene-census

When writing pipelines you ALWAYS:
1. Use real, installable tool names with conda-forge or bioconda channels
2. Follow Snakemake best practices: configfile, expand(), wildcards, log: directives
3. Include a rule all: that lists all final outputs
4. Make Docker/conda commands reproducible with pinned versions where critical
5. Generate meaningful outputs: QC reports, count matrices, plots, summary tables
6. Comment the WHY of each rule, not just the what
7. Write config.yaml with every parameter the user might need to change
8. Write environment.yaml with all required conda packages

Generate COMPLETE, RUNNABLE code — not pseudocode or skeletons.
The pipeline must work if the user has the input data and conda installed."""


# ------------------------------------------------------------------
# Helper: retrieve brain context for the question
# ------------------------------------------------------------------
def _get_brain_context(question: str) -> str:
    try:
        from knowledge.brain_loader import build_context_for_discovery
        return build_context_for_discovery(question, n_results=5)
    except Exception:
        return ""


# ------------------------------------------------------------------
# Core generation function
# ------------------------------------------------------------------
def generate_pipeline(
    question: str,
    data_types: list[str],
    disease: Optional[str] = None,
    goal: Optional[str] = None,
    output_dir: Optional[Path] = None,
) -> dict:
    """
    Generate a complete Snakemake pipeline for the given scientific question.

    Returns dict with:
      pipeline_id, name, snakefile, config_yaml, environment_yaml, readme,
      explanation, tools, data_types, saved_path
    """
    client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    brain_context = _get_brain_context(question)

    # Build the context section
    brain_section = f"\n{brain_context}\n" if brain_context else ""

    data_types_str = ", ".join(data_types) if data_types else "inferred from question"
    context_parts = [f"Scientific question: {question}"]
    if data_types:
        context_parts.append(f"Available data types: {data_types_str}")
    if disease:
        context_parts.append(f"Disease / phenotype: {disease}")
    if goal:
        context_parts.append(f"Analysis goal: {goal}")
    context_str = "\n".join(context_parts)

    prompt = f"""{brain_section}
A researcher has asked me to build a novel bioinformatics pipeline to answer the following question:

{context_str}

Please design and write a complete Snakemake pipeline that answers this question. The pipeline should:
1. Combine all relevant data types in a novel way that addresses the research question
2. Include every step from raw input to final interpretable result
3. Use only tools that can be installed via conda (bioconda / conda-forge)
4. Generate publication-quality outputs (plots, tables, HTML reports)
5. Be configured via a config.yaml so the user can adapt it to their data

Return your response as a JSON object with exactly these keys:
{{
  "name": "short_pipeline_name_no_spaces",
  "title": "Human readable title",
  "biological_hypothesis": "The specific hypothesis this pipeline tests",
  "novelty": "What makes this combination novel vs. standard pipelines",
  "tools_used": ["tool1", "tool2", ...],
  "data_types_combined": ["type1", "type2", ...],
  "snakefile": "COMPLETE Snakefile content here (multi-line string)",
  "config_yaml": "COMPLETE config.yaml content here",
  "environment_yaml": "COMPLETE environment.yaml content here with all conda deps",
  "readme": "COMPLETE README.md with background, installation, run instructions, expected outputs",
  "run_command": "exact snakemake command to run this pipeline",
  "expected_outputs": ["output1.html", "results/final_table.tsv", ...],
  "estimated_runtime": "estimate with 16 cores, 64GB RAM",
  "compute_requirements": {{"min_cores": 4, "min_ram_gb": 16, "gpu": false}},
  "explanation": "2-3 paragraph scientific rationale for the pipeline design choices"
}}

The Snakefile MUST be complete and runnable — not a skeleton or pseudocode.
Make it as specific to the research question as possible, not a generic template."""

    msg = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=8192,
        system=PIPELINE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = msg.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.rsplit("```", 1)[0]

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = {"explanation": raw, "snakefile": "", "config_yaml": "", "environment_yaml": ""}

    pipeline_id = str(uuid.uuid4())[:8]
    pipeline_name = data.get("name", "custom_pipeline").replace(" ", "_")

    # Save files to disk
    if output_dir is None:
        output_dir = Path("work/generated") / f"{pipeline_name}_{pipeline_id}"
    output_dir.mkdir(parents=True, exist_ok=True)

    saved_files = {}
    for filename, key in [
        ("Snakefile",       "snakefile"),
        ("config.yaml",     "config_yaml"),
        ("environment.yaml","environment_yaml"),
        ("README.md",       "readme"),
    ]:
        content = data.get(key, "")
        if content:
            fpath = output_dir / filename
            fpath.write_text(content, encoding="utf-8")
            saved_files[filename] = str(fpath)

    # Write a launch script
    run_cmd = data.get("run_command", f"snakemake --cores 8 --use-conda --snakefile Snakefile")
    launch_script = textwrap.dedent(f"""\
        #!/bin/bash
        # Launch script for: {data.get('title', pipeline_name)}
        set -euo pipefail
        cd "$(dirname "$0")"
        conda env create -f environment.yaml --name {pipeline_name} || true
        conda run -n {pipeline_name} {run_cmd}
    """)
    launch_path = output_dir / "launch.sh"
    launch_path.write_text(launch_script)
    launch_path.chmod(0o755)

    return {
        "pipeline_id": pipeline_id,
        "name": pipeline_name,
        "title": data.get("title", pipeline_name),
        "biological_hypothesis": data.get("biological_hypothesis", ""),
        "novelty": data.get("novelty", ""),
        "tools_used": data.get("tools_used", []),
        "data_types_combined": data.get("data_types_combined", data_types),
        "snakefile": data.get("snakefile", ""),
        "config_yaml": data.get("config_yaml", ""),
        "environment_yaml": data.get("environment_yaml", ""),
        "readme": data.get("readme", ""),
        "run_command": run_cmd,
        "expected_outputs": data.get("expected_outputs", []),
        "estimated_runtime": data.get("estimated_runtime", ""),
        "compute_requirements": data.get("compute_requirements", {}),
        "explanation": data.get("explanation", ""),
        "saved_path": str(output_dir),
        "saved_files": saved_files,
    }
