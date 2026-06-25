"""
Novel Discovery Agent
Searches PubMed + bioRxiv for published work, identifies methodological gaps,
and suggests novel analysis angles the user could pursue.

Privacy guarantee: only article metadata (titles, abstracts) reaches Claude.
Genomic data from the local machine is NEVER sent anywhere.
"""

import os
import sys
import json
import time
import httpx
import asyncio
from pathlib import Path
from typing import Optional
from anthropic import Anthropic
from xml.etree import ElementTree as ET

# Make knowledge/ importable
sys.path.insert(0, str(Path(__file__).parents[2]))

CLAUDE_MODEL = "claude-sonnet-4-6"
PUBMED_BASE  = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
BIORXIV_BASE = "https://api.biorxiv.org"

PROFESSOR_SYSTEM_PROMPT = """You are a world-class bioinformatics professor with deep expertise across all biomedical sciences.

Your knowledge synthesizes hundreds of textbooks and thousands of papers including:
Janeway's Immunobiology, DeVita Cancer (12th ed), Thompson & Thompson Genetics, Lehninger Biochemistry,
Robbins & Cotran Pathology, Bioinformatics Algorithms (Compeau), Human Molecular Genetics (Strachan),
The Biology of Cancer (Weinberg), Goodman & Gilman Pharmacology, and 500+ landmark papers.

You know every major public dataset: TCGA (33 tumor types, 20K patients), gnomAD v4 (807K exomes),
UK Biobank (500K participants), CellxGene Census (33M cells), HTAN spatial datasets,
CPTAC proteogenomics, curatedMetagenomicData (80+ studies), GTEx v8 (54 tissues),
ENCODE (5000+ experiments), ICGC/PCAWG (2658 WGS), DepMap (900+ cell lines),
L1000/LINCS (30K drug signatures), ImmPort (500+ immunology studies), All of Us (100K+ WGS).

You know every major bioinformatics tool: GATK4, STAR, BWA-MEM2, Salmon, DESeq2, edgeR, Seurat,
Scanpy, scVI, Harmony, cell2location, MOFA+, DIABLO, MetaPhlAn4, HUMAnN3, ArchR, MACS3,
TOBIAS, AlphaFold2/3, ESM-2, Geneformer, DIA-NN, MaxQuant, Nextflow/nf-core, Snakemake.

When suggesting novel analyses, you ALWAYS:
1. State the BIOLOGICAL HYPOTHESIS being tested
2. Name EXACT PUBLIC DATASETS with accession numbers (GEO GSE#, GDC, SRA, etc.)
3. Describe PIPELINE steps with specific tool names and parameters
4. Estimate EXPECTED FINDINGS and clinical/biological significance
5. Rate NOVELTY (⭐-⭐⭐⭐⭐⭐) based on published literature
6. Suggest VALIDATION experiments and appropriate statistical controls
7. Name the LANDMARK PAPERS that establish biological rationale

Prioritize discoveries that: have NOT been done (high novelty), are FEASIBLE with public data TODAY,
would have HIGH IMPACT if validated, and could be published in Nature/Science/Cell or top specialty journals.
Focus on cross-domain integration — the biggest discoveries happen at domain intersections."""


class NovelDiscoveryAgent:
    def __init__(self, api_key: Optional[str] = None):
        self.client = Anthropic(api_key=api_key or os.environ["ANTHROPIC_API_KEY"])
        self._brain_available = self._check_brain()

    def _check_brain(self) -> bool:
        try:
            from knowledge.brain_loader import is_brain_indexed
            return is_brain_indexed()
        except Exception:
            return False

    def _get_brain_context(self, query: str) -> str:
        """Retrieve relevant knowledge from the brain for this query."""
        if not self._brain_available:
            return ""
        try:
            from knowledge.brain_loader import build_context_for_discovery
            return build_context_for_discovery(query, n_results=6)
        except Exception:
            return ""

    # ── Public search methods ──────────────────────────────────────────────

    async def search_pubmed(self, query: str, n: int = 30) -> list[dict]:
        """Full-text search PubMed; return list of article metadata dicts."""
        async with httpx.AsyncClient(timeout=30) as http:
            search_r = await http.get(f"{PUBMED_BASE}/esearch.fcgi", params={
                "db": "pubmed", "term": query, "retmax": n,
                "retmode": "json", "sort": "relevance",
                "datetype": "pdat", "mindate": "2020",
            })
            search_r.raise_for_status()
            ids = search_r.json().get("esearchresult", {}).get("idlist", [])
            if not ids:
                return []

            summary_r = await http.get(f"{PUBMED_BASE}/esummary.fcgi", params={
                "db": "pubmed", "id": ",".join(ids), "retmode": "json",
            })
            summary_r.raise_for_status()
            result = summary_r.json().get("result", {})

            articles = []
            for pmid in ids:
                item = result.get(pmid, {})
                articles.append({
                    "source":   "PubMed",
                    "pmid":     pmid,
                    "title":    item.get("title", ""),
                    "authors":  [a.get("name", "") for a in item.get("authors", [])[:5]],
                    "journal":  item.get("fulljournalname", ""),
                    "year":     item.get("pubdate", "")[:4],
                    "abstract": "",   # esummary doesn't include abstract; fetch separately if needed
                    "url":      f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                })
            return articles

    async def search_biorxiv(self, query: str, n: int = 20) -> list[dict]:
        """Search bioRxiv preprints (last 6 months)."""
        async with httpx.AsyncClient(timeout=30) as http:
            cursor = 0
            articles = []
            while len(articles) < n:
                r = await http.get(
                    f"{BIORXIV_BASE}/details/biorxiv/2024-01-01/9999-12-31/{cursor}/json"
                )
                if r.status_code != 200:
                    break
                data = r.json()
                for item in data.get("collection", []):
                    title = item.get("title", "")
                    abstract = item.get("abstract", "")
                    if query.lower() in (title + abstract).lower():
                        articles.append({
                            "source":   "bioRxiv",
                            "doi":      item.get("doi", ""),
                            "title":    title,
                            "authors":  item.get("authors", "").split("; ")[:5],
                            "category": item.get("category", ""),
                            "year":     item.get("date", "")[:4],
                            "abstract": abstract[:500],
                            "url":      f"https://doi.org/{item.get('doi', '')}",
                        })
                        if len(articles) >= n:
                            break
                total = data.get("messages", [{}])[0].get("total", 0)
                cursor += 100
                if cursor >= int(total):
                    break
            return articles

    async def search_all(self, query: str, source: str = "all", n: int = 30) -> list[dict]:
        if source == "pubmed":
            return await self.search_pubmed(query, n)
        elif source == "biorxiv":
            return await self.search_biorxiv(query, n)
        else:
            pubmed_task  = self.search_pubmed(query, n)
            biorxiv_task = self.search_biorxiv(query, max(10, n // 2))
            results = await asyncio.gather(pubmed_task, biorxiv_task, return_exceptions=True)
            articles = []
            for r in results:
                if isinstance(r, list):
                    articles.extend(r)
            return articles[:n]

    # ── Core gap analysis ──────────────────────────────────────────────────

    async def discover_gaps(
        self,
        query: str,
        analysis_type: Optional[str] = None,
        disease: Optional[str] = None,
        max_results: int = 25,
    ) -> dict:
        """
        1. Search PubMed + bioRxiv for `query`.
        2. Feed article titles + abstracts to Claude.
        3. Claude identifies: what has been done, what's missing, novel hypotheses.
        Returns structured dict with gaps, opportunities, and suggested next steps.
        """
        articles = await self.search_all(query, n=max_results)

        # Retrieve relevant context from the professor brain (gracefully absent if not indexed)
        brain_context = self._get_brain_context(query)

        if not articles:
            return {
                "query": query,
                "articles_found": 0,
                "summary": "No recent articles found for this query.",
                "known_work": [],
                "methodological_gaps": [],
                "data_gaps": [],
                "novel_hypotheses": [],
                "suggested_experiments": [],
                "analysis_plans": [],
                "recommended_tools": [],
            }

        # Build a compact literature summary for Claude (titles + short abstracts only)
        lit_text = "\n".join([
            f"[{i+1}] {a['year']} ({a['source']}) — {a['title']}"
            + (f"\n    Abstract: {a['abstract'][:200]}..." if a.get("abstract") else "")
            for i, a in enumerate(articles[:max_results])
        ])

        context_parts = [f"Research query: {query}"]
        if analysis_type:
            context_parts.append(f"Analysis type: {analysis_type}")
        if disease:
            context_parts.append(f"Disease / phenotype: {disease}")
        context_str = " | ".join(context_parts)

        brain_section = f"\n{brain_context}\n" if brain_context else ""

        prompt = f"""{brain_section}I have searched the recent literature and found {len(articles)} articles related to:

{context_str}

Here is a summary of the recent published work:

{lit_text}

Based on your comprehensive knowledge and this literature landscape, please analyze:

1. **What has been done** — summarise the main approaches already published (3-5 bullet points)
2. **Methodological gaps** — specific computational or experimental methods that are missing or underused
3. **Data gaps** — cohorts, tissues, omics layers, or disease subtypes that are poorly represented
4. **Novel hypotheses** — 3-5 specific, testable hypotheses with clear biological rationale
5. **Suggested experiments / analyses** — concrete next steps runnable TODAY with existing public data
6. **Recommended tool combinations** — novel pipelines well-suited to address the gaps
7. **Detailed analysis plans** — for the TOP 2 most novel and feasible opportunities, provide a full
   step-by-step analysis plan a researcher could execute using public data

Return your response as valid JSON with these keys:
{{
  "known_work": ["bullet 1", ...],
  "methodological_gaps": ["gap 1", ...],
  "data_gaps": ["gap 1", ...],
  "novel_hypotheses": [
    {{"hypothesis": "...", "rationale": "...", "feasibility": "high|medium|low", "novelty_score": 1-5}}
  ],
  "suggested_experiments": [
    {{"title": "...", "analysis_type": "...", "tools": ["tool1", ...], "dataset": "...", "expected_finding": "..."}}
  ],
  "recommended_tool_combinations": [
    {{"tools": ["tool1", "tool2"], "rationale": "...", "novelty": "..."}}
  ],
  "analysis_plans": [
    {{
      "title": "Specific research question title",
      "hypothesis": "Mechanistic biological hypothesis being tested",
      "novelty_score": 1-5,
      "novelty_explanation": "Why this has not been done / what makes it original",
      "impact": "Clinical or biological significance if validated",
      "datasets": [
        {{"name": "Dataset name", "accession": "GEO GSE# / SRA / GDC / etc.", "url": "portal URL", "size": "n samples"}}
      ],
      "pipeline_steps": [
        {{"step": 1, "tool": "ToolName", "action": "what it does", "parameters": "key params"}}
      ],
      "expected_outputs": ["primary finding", "secondary insights"],
      "validation_strategy": {{"independent_cohort": "...", "statistical_approach": "...", "negative_controls": "..."}},
      "compute_requirements": "CPU/GPU/RAM estimate",
      "estimated_time": "with adequate compute",
      "publication_target": "journal tier + section"
    }}
  ],
  "executive_summary": "2-3 sentence summary of the biggest opportunity in this space"
}}"""

        msg = self.client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=8192,
            system=PROFESSOR_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = msg.content[0].text.strip()
        # Strip markdown code fence if present
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.rsplit("```", 1)[0]

        try:
            analysis = json.loads(raw)
        except json.JSONDecodeError:
            analysis = {"raw_analysis": raw}

        return {
            "query": query,
            "analysis_type": analysis_type,
            "disease": disease,
            "articles_found": len(articles),
            "articles": articles[:10],   # return top 10 for display
            **analysis,
        }

    async def find_reproducibility_gaps(self, analysis_type: str) -> dict:
        """
        Specifically search for reproducibility issues and benchmark gaps
        in a given analysis type — high-value for novel methods papers.
        """
        query = f"{analysis_type} bioinformatics benchmark reproducibility comparison"
        return await self.discover_gaps(
            query=query,
            analysis_type=analysis_type,
            max_results=20,
        )

    async def suggest_multi_omics_integration(
        self, omics_layers: list[str], disease: str
    ) -> dict:
        """Suggest novel multi-omics integration strategies for a given disease."""
        query = f"multi-omics integration {' '.join(omics_layers)} {disease}"
        return await self.discover_gaps(
            query=query,
            analysis_type="multiomics",
            disease=disease,
            max_results=25,
        )
