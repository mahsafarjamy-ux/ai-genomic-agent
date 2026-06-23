"""
Public Data Agent: searches GEO, SRA, TCGA, GTEx, HCA, ENCODE and more
to recommend control datasets for comparison to the user's case data.
Privacy-safe: only public accession numbers and metadata are handled here.
"""

import os
import json
import asyncio
import httpx
from pathlib import Path
from typing import Optional
import anthropic

REGISTRY_PATH = Path(__file__).parent.parent / "tool_registry" / "public_datasets.json"

SYSTEM_PROMPT = """You are a genomics data librarian with expertise in all major public repositories.
Given an analysis type and disease context, recommend the most appropriate public control datasets.
For each dataset explain: why it's a good control, sample size, data type match, limitations, and how to access it.
Output JSON only."""

RECOMMENDATION_PROMPT = """Recommend public control datasets for this analysis.

Analysis type: {analysis_type}
Disease / tissue of interest: {disease_context}
Organism: {organism}
Data characteristics: {data_characteristics}
Available databases: {available_databases}

Return JSON:
{{
  "primary_controls": [
    {{
      "database": "GTEx",
      "accession": "specific accession or URL",
      "n_samples": 979,
      "tissue": "matched tissue name",
      "data_type": "RNA-seq",
      "why_recommended": "GTEx v10 provides normal {tissue} expression from 979 donors — ideal healthy reference",
      "limitations": "Post-mortem tissue; may have ischemic effects",
      "access_method": "Download via GTEx portal or R/gtexr",
      "download_command": "wget https://storage.googleapis.com/gtex_analysis_v10/rna_seq_data/GTEx_Analysis_v10_RNASeQCv2.0.1_gene_tpm.gct.gz",
      "priority": 1
    }}
  ],
  "secondary_controls": [],
  "disease_comparison_cohorts": [],
  "meta_analysis_resources": [],
  "gap_in_available_data": "What public data is missing for ideal comparison",
  "suggested_sample_matching": "How to match public controls to user's cases (age, sex, tissue)"
}}"""


class PublicDataAgent:
    def __init__(self, api_key: Optional[str] = None):
        self.client = anthropic.Anthropic(api_key=api_key or os.environ["ANTHROPIC_API_KEY"])
        self.ncbi_key = (
            os.environ.get("NCBI_API_KEY")
            or os.environ.get("PUBMED_API_KEY")
            or ""
        )  # free at ncbi.nlm.nih.gov/account
        self.registry = json.loads(REGISTRY_PATH.read_text())
        self.http = httpx.AsyncClient(
            timeout=30.0,
            headers={"User-Agent": "AI-Genomics-Agent/1.0 (academic research; contact: researcher@institution.edu)"}
        )

    async def recommend_controls(
        self,
        analysis_type: str,
        disease_context: str,
        organism: str = "human",
        n_samples: Optional[int] = None,
        tissue: Optional[str] = None,
        extra_context: str = "",
    ) -> dict:
        """Main entry: recommend public control datasets for the user's experiment."""
        # Get relevant databases for this analysis type
        relevant_dbs = self.registry["analysis_type_to_databases"].get(
            analysis_type.lower(), list(self.registry["databases"].keys())
        )
        db_summaries = {
            k: {
                "name": v["name"],
                "description": v["description"],
                "best_for": v.get("best_for", ""),
                "n_samples": v.get("n_donors") or v.get("n_cells"),
            }
            for k, v in self.registry["databases"].items()
            if k in relevant_dbs
        }

        data_characteristics = {
            "n_samples": n_samples,
            "tissue": tissue,
            "extra": extra_context,
        }

        prompt = RECOMMENDATION_PROMPT.format(
            analysis_type=analysis_type,
            disease_context=disease_context,
            organism=organism,
            data_characteristics=json.dumps(data_characteristics),
            available_databases=json.dumps(db_summaries, indent=2),
        )

        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )

        import re
        content = response.content[0].text.strip()
        content = re.sub(r'^```[a-z]*\n?', '', content)
        content = re.sub(r'\n?```$', '', content)

        try:
            recommendations = json.loads(content)
        except json.JSONDecodeError:
            match = re.search(r'\{[\s\S]+\}', content)
            recommendations = json.loads(match.group()) if match else {}

        # Enrich with live search results from GEO and other APIs
        geo_results = await self._search_geo(analysis_type, disease_context, n=10)
        recommendations["live_geo_search"] = geo_results

        if analysis_type.lower() in ["wgs", "wes", "rnaseq"]:
            tcga_results = await self._search_tcga(disease_context)
            recommendations["tcga_cohorts"] = tcga_results

        return recommendations

    async def search_geo(self, query: str, n: int = 20) -> list[dict]:
        """Search GEO directly by keyword."""
        return await self._search_geo(query, query, n=n)

    async def _search_geo(self, analysis_type: str, disease: str, n: int = 10) -> list[dict]:
        """Search NCBI GEO for matching datasets."""
        # Build a smart query
        type_terms = {
            "rnaseq": "RNA-seq",
            "scrnaseq": "single cell RNA-seq",
            "chipseq": "ChIP-seq",
            "atacseq": "ATAC-seq",
            "methylation": "WGBS OR RRBS OR methylation array",
            "microbiome": "16S rRNA OR metagenomics",
            "proteomics": "proteomics OR mass spectrometry",
            "riboseq": "ribosome profiling OR ribo-seq",
            "spatial_transcriptomics": "spatial transcriptomics OR Visium",
        }
        type_term = type_terms.get(analysis_type.lower(), analysis_type)
        query = f"{type_term} {disease} Homo sapiens"

        params: dict = {"db": "gds", "term": query, "retmax": n, "retmode": "json", "sort": "relevance"}
        if self.ncbi_key:
            params["api_key"] = self.ncbi_key
        try:
            r = await self.http.get(
                "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", params=params
            )
            ids = r.json().get("esearchresult", {}).get("idlist", [])
            if not ids:
                return []
            # Fetch summaries
            id_str = ",".join(ids[:10])
            sum_params: dict = {"db": "gds", "id": id_str, "retmode": "json"}
            if self.ncbi_key:
                sum_params["api_key"] = self.ncbi_key
            sr = await self.http.get(
                "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi", params=sum_params
            )
            result_data = sr.json().get("result", {})
            datasets = []
            for uid in result_data.get("uids", []):
                item = result_data.get(uid, {})
                datasets.append({
                    "accession": item.get("accession"),
                    "title": item.get("title"),
                    "summary": item.get("summary", "")[:300],
                    "n_samples": item.get("n_samples"),
                    "pdat": item.get("pdat"),
                    "gpl": item.get("gpl"),
                    "url": f"https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc={item.get('accession')}",
                })
            return datasets
        except Exception as e:
            return [{"error": str(e)}]

    async def _search_tcga(self, disease: str) -> list[dict]:
        """Query GDC API for TCGA projects matching the disease."""
        url = "https://api.gdc.cancer.gov/projects"
        params = {
            "filters": json.dumps({
                "op": "and",
                "content": [{"op": "in", "content": {"field": "program.name", "value": ["TCGA"]}}]
            }),
            "fields": "project_id,name,summary.case_count,disease_type,primary_site",
            "size": 50,
            "format": "json",
        }
        try:
            r = await self.http.get(url, params=params)
            hits = r.json().get("data", {}).get("hits", [])
            # Filter by disease relevance (simple keyword match)
            disease_lower = disease.lower()
            matched = []
            for h in hits:
                if (disease_lower in h.get("name", "").lower() or
                    disease_lower in " ".join(h.get("disease_type", [])).lower() or
                    disease_lower in " ".join(h.get("primary_site", [])).lower()):
                    matched.append({
                        "project": h.get("project_id"),
                        "name": h.get("name"),
                        "n_cases": h.get("summary", {}).get("case_count", 0),
                        "disease_type": h.get("disease_type", []),
                        "primary_site": h.get("primary_site", []),
                        "url": f"https://portal.gdc.cancer.gov/projects/{h.get('project_id')}",
                    })
            return matched or hits[:5]  # fallback: return top 5 if no match
        except Exception as e:
            return [{"error": str(e)}]

    async def search_cellxgene(self, tissue: str = None, disease: str = None) -> list[dict]:
        """Query CellxGene Census for matching scRNA-seq datasets."""
        url = "https://api.cellxgene.cziscience.com/dp/v1/datasets/"
        try:
            r = await self.http.get(url)
            datasets = r.json()
            results = []
            for d in datasets[:100]:
                name = d.get("name", "").lower()
                tissue_str = " ".join(t.get("label", "") for t in d.get("tissue", [])).lower()
                disease_str = " ".join(t.get("label", "") for t in d.get("disease", [])).lower()
                match = True
                if tissue and tissue.lower() not in tissue_str:
                    match = False
                if disease and disease.lower() not in disease_str:
                    match = False
                if match:
                    results.append({
                        "id": d.get("id"),
                        "name": d.get("name"),
                        "n_cells": d.get("cell_count"),
                        "tissue": [t.get("label") for t in d.get("tissue", [])],
                        "disease": [t.get("label") for t in d.get("disease", [])],
                        "url": f"https://cellxgene.cziscience.com/datasets/{d.get('id')}",
                    })
            return results[:20]
        except Exception as e:
            return [{"error": str(e)}]

    async def get_gtex_expression(self, gene: str, tissue: str) -> dict:
        """Get GTEx normal expression for a specific gene + tissue."""
        url = f"https://gtexportal.org/api/v2/expression/geneExpression"
        params = {"gencodeId": gene, "tissueSiteDetailId": tissue}
        try:
            r = await self.http.get(url, params=params)
            return r.json()
        except Exception as e:
            return {"error": str(e)}

    async def generate_comparison_plan(
        self,
        public_dataset: dict,
        user_analysis_type: str,
        user_disease: str,
        selected_analyses: list[str],
        local_data_path: str = "",
    ) -> dict:
        """
        Generate a full comparison plan: download instructions + pipeline config.
        The public dataset is downloaded to the USER's local machine only.
        No patient data is ever sent anywhere.
        """
        import re

        prompt = f"""
A researcher wants to compare their patient data with a public dataset.

Public dataset selected:
{json.dumps(public_dataset, indent=2)}

User's study:
- Analysis type: {user_analysis_type}
- Disease: {user_disease}
- Local data path: {local_data_path or "(not specified yet)"}
- Analyses requested: {', '.join(selected_analyses)}

Generate a detailed comparison plan with:
1. Exact download commands (wget/curl/ffq/prefetch) to get the public data onto their machine
2. For each requested analysis: the tools, pipeline steps, and what biological questions it answers
3. Statistical considerations (batch correction, normalization, covariates)
4. Expected outputs and visualizations

Return JSON:
{{
  "dataset_summary": "one sentence about the selected dataset",
  "download_instructions": [
    {{
      "step": 1,
      "description": "Install SRA tools or download via wget",
      "command": "prefetch GSE123456 --output-directory /your/data/public/",
      "estimated_size_gb": 5.2,
      "tool_required": "sra-tools",
      "install_command": "conda install -c bioconda sra-tools"
    }}
  ],
  "analyses": [
    {{
      "id": "deg",
      "name": "Differential Expression Analysis",
      "question": "Which genes are up/down regulated in your patients vs public controls?",
      "tools": ["DESeq2", "limma-voom"],
      "steps": ["Normalize counts", "Model batch effects (ComBat-seq)", "Run DESeq2", "GSEA pathway analysis"],
      "key_output": "Volcano plot + top 50 DEG table + pathway enrichment",
      "estimated_time": "1-2 hours on workstation",
      "batch_correction_needed": true,
      "batch_correction_tool": "ComBat-seq"
    }}
  ],
  "statistical_notes": "Key considerations for this specific comparison",
  "privacy_confirmation": "All public data downloads to your local machine. No patient data is transferred."
}}"""

        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system="You are a bioinformatics expert. Output JSON only. Be specific about commands and tools.",
            messages=[{"role": "user", "content": prompt}]
        )

        content = response.content[0].text.strip()
        content = re.sub(r'^```[a-z]*\n?', '', content)
        content = re.sub(r'\n?```$', '', content)
        try:
            return json.loads(content)
        except Exception:
            match = re.search(r'\{[\s\S]+\}', content)
            return json.loads(match.group()) if match else {"error": "Failed to generate plan"}

    async def close(self):
        await self.http.aclose()
