"""
GitHub Engineering Knowledge Fetcher
Fetches README, docs, example pipelines, and key issues from bioinformatics
GitHub repos to populate the brain's engineering knowledge base.

Usage:
    python knowledge/github_fetcher.py                  # fetch all repos
    python knowledge/github_fetcher.py --repo owner/name # fetch one repo
    python knowledge/github_fetcher.py --reindex         # fetch + reindex brain

Set GITHUB_TOKEN env var to get 5000 req/hour instead of 60.
"""

import os
import re
import sys
import time
import base64
import argparse
import textwrap
from pathlib import Path
from typing import Optional
import requests

KNOWLEDGE_DIR = Path(__file__).parent
ENGINEERING_DIR = KNOWLEDGE_DIR / "engineering"
REPOS_DIR = ENGINEERING_DIR / "github_repos"
REPOS_DIR.mkdir(parents=True, exist_ok=True)

GITHUB_API = "https://api.github.com"
HEADERS = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
if os.environ.get("GITHUB_TOKEN"):
    HEADERS["Authorization"] = f"Bearer {os.environ['GITHUB_TOKEN']}"

# ------------------------------------------------------------------
# Master repo list — (owner/repo, category, priority, description)
# ------------------------------------------------------------------
REPOS = [
    # ── Workflow Engineering (highest priority for pipeline generation) ──────
    ("nextflow-io/nextflow",               "workflow",    1, "Nextflow DSL2 workflow system"),
    ("snakemake/snakemake",                "workflow",    1, "Snakemake Python-based workflow system"),
    ("broadinstitute/cromwell",            "workflow",    2, "Cromwell WDL workflow engine (Broad Institute)"),
    ("common-workflow-language/cwltool",   "workflow",    2, "Common Workflow Language reference implementation"),
    ("galaxyproject/galaxy",               "workflow",    3, "Galaxy workflow platform"),
    # ── nf-core (key pipelines as patterns) ────────────────────────────────
    ("nf-core/rnaseq",                     "nfcore",      1, "nf-core RNA-seq pipeline"),
    ("nf-core/sarek",                      "nfcore",      1, "nf-core WGS/WES somatic + germline variant calling"),
    ("nf-core/scrnaseq",                   "nfcore",      1, "nf-core single-cell RNA-seq"),
    ("nf-core/atacseq",                    "nfcore",      2, "nf-core ATAC-seq"),
    ("nf-core/chipseq",                    "nfcore",      2, "nf-core ChIP-seq"),
    ("nf-core/methylseq",                  "nfcore",      2, "nf-core bisulfite methylation"),
    ("nf-core/ampliseq",                   "nfcore",      2, "nf-core amplicon microbiome 16S"),
    ("nf-core/spatialvi",                  "nfcore",      2, "nf-core spatial transcriptomics Visium"),
    ("nf-core/proteomicslfq",              "nfcore",      3, "nf-core proteomics label-free quantification"),
    # ── Variant Calling ─────────────────────────────────────────────────────
    ("broadinstitute/gatk",                "variant",     1, "GATK4 variant calling toolkit"),
    ("broadinstitute/picard",              "variant",     1, "Picard tools for SAM/BAM processing"),
    ("samtools/samtools",                  "variant",     1, "SAMtools — BAM/CRAM processing"),
    ("samtools/bcftools",                  "variant",     1, "BCFtools — VCF/BCF processing"),
    ("samtools/htslib",                    "variant",     2, "HTSlib — C library for HTS formats"),
    ("lh3/bwa",                            "variant",     1, "BWA — Burrows-Wheeler short-read aligner"),
    ("lh3/minimap2",                       "variant",     1, "Minimap2 — long-read aligner"),
    # ── RNA-seq ─────────────────────────────────────────────────────────────
    ("alexdobin/STAR",                     "rnaseq",      1, "STAR splice-aware RNA-seq aligner"),
    ("DaehwanKimLab/hisat2",               "rnaseq",      1, "HISAT2 genome + splice aligner"),
    ("COMBINE-lab/salmon",                 "rnaseq",      1, "Salmon quasi-mapping RNA quantification"),
    ("pachterlab/kallisto",                "rnaseq",      1, "Kallisto RNA quantification"),
    ("deweylab/RSEM",                      "rnaseq",      2, "RSEM RNA-seq expression estimation"),
    # ── Single-Cell ─────────────────────────────────────────────────────────
    ("scverse/scanpy",                     "singlecell",  1, "Scanpy single-cell RNA-seq analysis"),
    ("scverse/anndata",                    "singlecell",  1, "AnnData annotated data matrix format"),
    ("scverse/scvi-tools",                 "singlecell",  1, "scvi-tools deep learning for single-cell"),
    ("satijalab/seurat",                   "singlecell",  1, "Seurat single-cell R toolkit"),
    ("10XGenomics/cellranger",             "singlecell",  1, "10x Genomics Cell Ranger pipeline"),
    # ── Spatial Transcriptomics ─────────────────────────────────────────────
    ("scverse/squidpy",                    "spatial",     1, "Squidpy spatial single-cell analysis"),
    # ── AI / Foundation Models ───────────────────────────────────────────────
    ("google-deepmind/alphafold",          "ai_bio",      1, "AlphaFold protein structure prediction"),
    ("aqlaboratory/openfold",              "ai_bio",      1, "OpenFold trainable AlphaFold implementation"),
    ("facebookresearch/esm",               "ai_bio",      1, "ESM protein language models (Meta)"),
    ("deepchem/deepchem",                  "ai_bio",      2, "DeepChem molecular ML"),
    ("Project-MONAI/MONAI",               "ai_bio",      2, "MONAI medical imaging AI"),
    # ── Proteomics ───────────────────────────────────────────────────────────
    ("OpenMS/OpenMS",                      "proteomics",  1, "OpenMS mass spectrometry"),
    ("Nesvilab/FragPipe",                  "proteomics",  1, "FragPipe proteomics workflow"),
    # ── Immunology ───────────────────────────────────────────────────────────
    ("griffithlab/pVACtools",              "immunology",  1, "pVACtools neoantigen prediction"),
    ("milaboratory/mixcr",                 "immunology",  1, "MiXCR TCR/BCR repertoire analysis"),
    # ── Pathology ────────────────────────────────────────────────────────────
    ("qupath/qupath",                      "pathology",   1, "QuPath computational pathology"),
    ("slideflow/slideflow",                "pathology",   1, "Slideflow whole-slide image DL"),
    ("TissueImageAnalytics/tiatoolbox",    "pathology",   1, "TIAToolbox digital pathology"),
    # ── General AI Engineering ───────────────────────────────────────────────
    ("huggingface/transformers",           "ml_infra",    1, "Hugging Face Transformers"),
    ("run-llama/llama_index",              "ml_infra",    2, "LlamaIndex LLM data framework"),
    ("langchain-ai/langgraph",             "ml_infra",    2, "LangGraph LLM agent framework"),
    ("fastapi/fastapi",                    "ml_infra",    1, "FastAPI web framework"),
]

# Files to try fetching beyond README (relative to repo root)
EXTRA_PATHS = [
    "CHANGELOG.md", "INSTALL.md", "USAGE.md", "TUTORIAL.md",
    "docs/usage.md", "docs/installation.md", "docs/output.md",
    "docs/README.md", "docs/index.md",
    "example/Snakefile", "examples/Snakefile",
    "example/main.nf", "examples/main.nf", "examples/demo/main.nf",
    "nextflow.config", "schema_input.json",
]


# ------------------------------------------------------------------
# GitHub API helpers
# ------------------------------------------------------------------
def _get(url: str, retries: int = 3) -> Optional[dict]:
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 403:
                reset = int(r.headers.get("X-RateLimit-Reset", time.time() + 60))
                wait = max(1, reset - int(time.time()) + 2)
                print(f"  Rate limited — waiting {wait}s …")
                time.sleep(wait)
                continue
            if r.status_code == 404:
                return None
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2)
    return None


def _decode_content(data: dict) -> str:
    if data.get("encoding") == "base64":
        return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
    return data.get("content", "")


def fetch_readme(owner: str, repo: str) -> str:
    data = _get(f"{GITHUB_API}/repos/{owner}/{repo}/readme")
    return _decode_content(data) if data else ""


def fetch_file(owner: str, repo: str, path: str) -> str:
    data = _get(f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}")
    if data and isinstance(data, dict) and "content" in data:
        return _decode_content(data)
    return ""


def fetch_issues(owner: str, repo: str, n: int = 10) -> list[dict]:
    data = _get(f"{GITHUB_API}/repos/{owner}/{repo}/issues?state=closed&sort=comments&per_page={n}")
    return data if isinstance(data, list) else []


def fetch_repo_meta(owner: str, repo: str) -> dict:
    data = _get(f"{GITHUB_API}/repos/{owner}/{repo}")
    return data or {}


# ------------------------------------------------------------------
# Build a rich knowledge document from a repo
# ------------------------------------------------------------------
def build_repo_doc(owner: str, repo: str, category: str, description: str) -> str:
    print(f"  Fetching {owner}/{repo} …")
    meta = fetch_repo_meta(owner, repo)
    readme = fetch_readme(owner, repo)

    sections = []

    # Header
    stars = meta.get("stargazers_count", 0)
    lang  = meta.get("language", "")
    topics = ", ".join(meta.get("topics", []))
    sections.append(textwrap.dedent(f"""\
        # {repo} — {description}

        **GitHub:** https://github.com/{owner}/{repo}
        **Category:** {category}
        **Language:** {lang}
        **Stars:** {stars:,}
        **Topics:** {topics}
        **Description:** {meta.get('description', description)}
        """))

    # README (truncate to ~3000 chars to keep chunks manageable)
    if readme:
        readme_trim = readme[:4000] + ("\n…[truncated]" if len(readme) > 4000 else "")
        sections.append(f"## README\n\n{readme_trim}")

    # Extra docs and examples
    extras_found = []
    for path in EXTRA_PATHS:
        content = fetch_file(owner, repo, path)
        if content and len(content) > 100:
            trim = content[:2000] + ("\n…[truncated]" if len(content) > 2000 else "")
            extras_found.append(f"### {path}\n\n```\n{trim}\n```")
            time.sleep(0.3)  # gentle rate limit
        if len(extras_found) >= 3:
            break

    if extras_found:
        sections.append("## Key Files\n\n" + "\n\n".join(extras_found))

    # Top closed issues (real-world usage patterns and gotchas)
    issues = fetch_issues(owner, repo, n=5)
    if issues:
        issue_texts = []
        for iss in issues[:5]:
            title = iss.get("title", "")
            body  = (iss.get("body") or "")[:300]
            comments = iss.get("comments", 0)
            issue_texts.append(f"- [{comments} comments] **{title}**\n  {body[:200]}")
        sections.append("## Common Issues & Discussions (top closed issues by comments)\n\n" + "\n\n".join(issue_texts))

    return "\n\n---\n\n".join(sections)


# ------------------------------------------------------------------
# Fetch one repo and save
# ------------------------------------------------------------------
def fetch_and_save(owner_repo: str, category: str, description: str) -> Path:
    owner, repo = owner_repo.split("/", 1)
    safe_name = owner_repo.replace("/", "__")
    out_path = REPOS_DIR / f"{safe_name}.md"

    doc = build_repo_doc(owner, repo, category, description)
    out_path.write_text(doc, encoding="utf-8")
    print(f"  Saved → {out_path.name} ({len(doc):,} chars)")
    return out_path


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------
def fetch_all(priority_max: int = 2):
    """Fetch all repos up to priority_max (1=highest, 3=lowest)."""
    to_fetch = [(r, c, d) for r, c, p, d in REPOS if p <= priority_max]
    print(f"Fetching {len(to_fetch)} repos (priority ≤ {priority_max}) …\n")

    for i, (repo, category, desc) in enumerate(to_fetch):
        print(f"[{i+1}/{len(to_fetch)}] {repo}")
        try:
            fetch_and_save(repo, category, desc)
        except Exception as e:
            print(f"  ERROR: {e}")
        time.sleep(0.5)  # polite pacing

    print(f"\nDone. Files in {REPOS_DIR}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI Genomics GitHub Knowledge Fetcher")
    parser.add_argument("--repo",     type=str, help="Fetch a single repo (owner/name)")
    parser.add_argument("--priority", type=int, default=2, help="Max priority level to fetch (1-3, default 2)")
    parser.add_argument("--reindex",  action="store_true", help="Reindex brain after fetching")
    args = parser.parse_args()

    if args.repo:
        # Find in list or use defaults
        match = next(((r, c, d) for r, c, p, d in REPOS if r == args.repo), None)
        if match:
            fetch_and_save(*match)
        else:
            fetch_and_save(args.repo, "custom", "User-specified repo")
    else:
        fetch_all(priority_max=args.priority)

    if args.reindex:
        print("\nReindexing brain …")
        sys.path.insert(0, str(Path(__file__).parents[1]))
        from knowledge.brain_loader import index_all
        index_all()
