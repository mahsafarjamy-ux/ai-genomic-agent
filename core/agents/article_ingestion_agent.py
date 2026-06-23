"""
Article Ingestion Agent: uses Claude to extract a full, executable bioinformatics
pipeline from a scientific paper (PDF + supplementary + GitHub repos).

Privacy: all processing is local — genomic data never leaves the user's machine.
This agent only touches the article/code, not patient data.
"""

import os
import json
import asyncio
from pathlib import Path
from typing import Optional
import anthropic

from core.article_parser.pdf_parser import extract_text_and_links
from core.article_parser.supplementary_fetcher import fetch_all_supplementary
from core.article_parser.github_crawler import crawl_repos_from_urls


SYSTEM_PROMPT = """You are an expert bioinformatics pipeline architect.
Your job is to read scientific papers and extract a complete, reproducible
analysis pipeline that can be run on the user's own data.

When extracting a pipeline you MUST identify:
1. The exact analysis type (WGS, WES, RNAseq, scRNAseq, Methylation, ChIPseq, ATACseq, etc.)
2. Every software tool used, with exact version numbers
3. Every parameter and threshold mentioned (e.g., --alignIntronMax 1000000, p < 0.05)
4. The order of steps (DAG) from raw reads to final output
5. Reference genomes and annotation files required (genome build, GTF version)
6. QC checkpoints and expected metrics at each step
7. Input file formats required at each step
8. Output files produced at each step

Output structured JSON only. No prose explanations."""

EXTRACTION_PROMPT = """Extract the complete bioinformatics pipeline from this paper.

Paper title: {title}
DOI: {doi}

Paper text (methods section and relevant parts):
{methods_text}

Supplementary material text:
{supplementary_text}

Code found in GitHub repos:
{github_code}

Tool mentions: {tool_mentions}
Software versions: {versions}

IMPORTANT: Many papers perform several distinct analyses. You must identify ALL of them.

Return a JSON object with this exact structure:
{{
  "analysis_type": "primary analysis type (WGS|WES|RNAseq|scRNAseq|Methylation|ChIPseq|ATACseq|other)",
  "title": "paper title",
  "doi": "doi or null",
  "detected_analyses": [
    {{
      "id": "short_snake_case_id",
      "name": "Human-readable analysis name, e.g. Differential gene expression",
      "type": "rnaseq|wgs|wes|scrnaseq|methylation|chipseq|atacseq|proteomics|microbiome|multiomics|survival|other",
      "description": "One sentence: what this analysis does and what data it uses",
      "figure_refs": ["Fig 2A", "Fig 3"],
      "n_samples": "e.g. 50 tumor vs 50 normal, or null if unknown",
      "key_tools": ["STAR", "DESeq2", "GSEA"],
      "is_primary": true
    }}
  ],
  "reference_genome": {{
    "species": "human|mouse|other",
    "build": "GRCh38|GRCh37|mm10|mm39|other",
    "annotation": "Ensembl|GENCODE|RefSeq",
    "annotation_version": "string or null"
  }},
  "steps": [
    {{
      "step_number": 1,
      "name": "Quality Control",
      "tool": "FastQC",
      "version": "0.11.9",
      "docker_image": "biocontainers/fastqc:v0.11.9_cv8",
      "command_template": "fastqc {{input}} -o {{output_dir}} -t {{threads}}",
      "parameters": {{"threads": 8}},
      "input_files": ["*.fastq.gz"],
      "output_files": ["*_fastqc.html", "*_fastqc.zip"],
      "qc_thresholds": {{}},
      "notes": "any special notes from paper"
    }}
  ],
  "required_input_files": [
    {{
      "name": "Raw FASTQ files",
      "format": "fastq.gz",
      "example": "sample_R1.fastq.gz",
      "required": true,
      "description": "Paired-end or single-end reads"
    }}
  ],
  "required_reference_files": [
    {{
      "name": "Genome FASTA",
      "format": "fa.gz",
      "source_url": "https://...",
      "required": true
    }}
  ],
  "environment_variables": {{}},
  "estimated_runtime_hours": null,
  "estimated_disk_gb": null,
  "confidence_score": 0.95,
  "missing_info": ["list any information the paper did not specify"]
}}"""


class ArticleIngestionAgent:
    def __init__(self, api_key: Optional[str] = None, github_token: Optional[str] = None):
        self.client = anthropic.Anthropic(api_key=api_key or os.environ["ANTHROPIC_API_KEY"])
        self.github_token = github_token or os.environ.get("GITHUB_TOKEN")

    async def ingest(self, pdf_path: str | Path, work_dir: Optional[Path] = None) -> dict:
        """
        Full ingestion: parse PDF → fetch supplementary → crawl GitHub → extract pipeline.
        Returns structured pipeline definition.
        """
        pdf_path = Path(pdf_path)
        work_dir = work_dir or pdf_path.parent / f".cache_{pdf_path.stem}"
        work_dir.mkdir(parents=True, exist_ok=True)

        print(f"[1/4] Parsing PDF: {pdf_path.name}")
        parsed = extract_text_and_links(pdf_path)

        # Fetch supplementary materials
        supp_text = ""
        if parsed["supplementary_urls"]:
            print(f"[2/4] Fetching {len(parsed['supplementary_urls'])} supplementary URLs...")
            supp_results = await fetch_all_supplementary(
                parsed["supplementary_urls"],
                work_dir / "supplementary"
            )
            supp_text = "\n\n".join(
                r.get("text_content", "") or ""
                for r in supp_results
                if not r.get("error")
            )
        else:
            print("[2/4] No supplementary URLs found.")

        # Crawl GitHub repos
        github_code = ""
        if parsed["github_urls"]:
            print(f"[3/4] Crawling {len(parsed['github_urls'])} GitHub repos...")
            repo_results = await crawl_repos_from_urls(
                parsed["github_urls"],
                work_dir / "repos",
                github_token=self.github_token
            )
            code_blocks = []
            for repo in repo_results:
                if isinstance(repo, dict) and not repo.get("error"):
                    for f in repo.get("files", []):
                        code_blocks.append(f"# File: {f['path']}\n{f['content'][:3000]}")
            github_code = "\n\n".join(code_blocks[:20])  # cap context size
        else:
            print("[3/4] No GitHub URLs found.")

        # Build methods text (focus on methods + pipeline sections)
        methods_text = ""
        for key in ["methods", "materials and methods", "bioinformatics", "pipeline", "analysis"]:
            if key in parsed["sections"]:
                methods_text += parsed["sections"][key][:5000]

        if not methods_text:
            methods_text = parsed["text"][:8000]

        print("[4/4] Calling Claude to extract pipeline...")
        pipeline = self._extract_pipeline_with_claude(
            title=parsed["title"],
            doi=parsed["doi"],
            methods_text=methods_text,
            supplementary_text=supp_text[:4000],
            github_code=github_code[:6000],
            tool_mentions=parsed["tool_mentions"],
            versions=parsed["software_versions"],
        )

        # Save pipeline definition
        output_path = work_dir / "pipeline.json"
        output_path.write_text(json.dumps(pipeline, indent=2))
        pipeline["_cache_dir"] = str(work_dir)
        pipeline["_pipeline_json"] = str(output_path)

        return pipeline

    def _extract_pipeline_with_claude(self, **kwargs) -> dict:
        prompt = EXTRACTION_PROMPT.format(**{
            "title": kwargs["title"],
            "doi": kwargs["doi"] or "not found",
            "methods_text": kwargs["methods_text"],
            "supplementary_text": kwargs["supplementary_text"] or "not available",
            "github_code": kwargs["github_code"] or "not available",
            "tool_mentions": ", ".join(kwargs["tool_mentions"]) or "none detected",
            "versions": json.dumps(kwargs["versions"]) or "[]",
        })

        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8192,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )

        content = response.content[0].text.strip()

        # Strip markdown code fences if present
        if content.startswith("```"):
            content = re.sub(r'^```[a-z]*\n?', '', content)
            content = re.sub(r'\n?```$', '', content)

        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # Try to find JSON within the response
            import re
            match = re.search(r'\{[\s\S]+\}', content)
            if match:
                return json.loads(match.group())
            return {"error": "Failed to parse Claude response", "raw": content}


import re
