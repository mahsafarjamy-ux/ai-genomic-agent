# AI Genomics Agent — Setup Guide

## Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (optional but recommended for pipeline tools)
- Snakemake: `pip install snakemake`

## Step 1 — Add your API key

```bash
cp api/.env.example api/.env
# Then open api/.env and set:
# ANTHROPIC_API_KEY=sk-ant-...
```

## Step 2 — Start development servers

```bash
bash scripts/start-dev.sh
```

Then open http://localhost:3000

## Step 3 — How to use

1. **Upload Article** — Drop a paper PDF. Claude reads the methods section, supplementary files, and any GitHub repos linked in the paper to extract the full pipeline.

2. **Review Pipeline** — See every tool, version, Docker container, and parameter Claude found. Any missing info is flagged.

3. **Check Data** — Point to your data folder. The tool scans file names only — no content is ever read, moved, or uploaded.

4. **Run Analysis** — Set CPU/RAM, click Launch. Pipeline runs locally on your machine via Snakemake + Docker.
   - If a step fails, Claude diagnoses it and proposes a fix. **You must approve every fix before it's applied.**

5. **Report** — Download an HTML/PDF report with QC metrics, results summary, and a ready-to-paste Methods section.

## Built-in pipeline templates

| Analysis | Tools |
|----------|-------|
| RNA-seq | FastQC → fastp → STAR 2.7.11a → featureCounts → MultiQC |
| WGS | FastQC → BWA-MEM2 → GATK4 MarkDuplicates → BQSR → HaplotypeCaller → VQSR |
| WES | Same as WGS + target capture QC |
| scRNA-seq | Cell Ranger → Seurat 5 → Harmony → UMAP clustering |
| Methylation | fastp → Bismark → bismark2bedGraph → DSS |
| ChIP-seq | bowtie2 → SAMtools → MACS2 → deepTools |
| ATAC-seq | bowtie2 → SAMtools → MACS2 → peak annotation |

## Privacy guarantee

- Genomic data **never moves** from its original location
- Genomic data **never uploads** anywhere
- Only article text (PDF + GitHub code) is sent to Claude
- All analysis runs on your machine

## Docker (for production)

```bash
cd docker
cp ../api/.env.example .env
# Set ANTHROPIC_API_KEY in .env
docker compose up
```
