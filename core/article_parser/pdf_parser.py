"""
PDF parser: extracts text, figures, tables, and external links from scientific papers.
Handles both main text and supplementary material.
"""

import re
import io
from pathlib import Path
from typing import Optional
import pdfplumber
import PyPDF2


def extract_text_and_links(pdf_path: str | Path) -> dict:
    """
    Extract all text, URLs, and GitHub references from a PDF.
    Returns structured content for downstream pipeline extraction.
    """
    pdf_path = Path(pdf_path)
    result = {
        "title": "",
        "text": "",
        "sections": {},
        "github_urls": [],
        "supplementary_urls": [],
        "doi": None,
        "tool_mentions": [],
        "software_versions": [],
    }

    raw_pages = []
    urls = []

    # pdfplumber for text + hyperlinks
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            raw_pages.append(text)
            # Extract hyperlinks from annotations
            if page.annots:
                for annot in page.annots:
                    uri = annot.get("uri") or annot.get("A", {}).get("URI", "")
                    if uri:
                        urls.append(str(uri))

    full_text = "\n".join(raw_pages)
    result["text"] = full_text

    # Also scan with PyPDF2 for any additional embedded links
    with open(pdf_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            if "/Annots" in page:
                for annot in page["/Annots"]:
                    obj = annot.get_object()
                    if obj.get("/Subtype") == "/Link":
                        uri = obj.get("/A", {}).get("/URI", "")
                        if uri:
                            urls.append(str(uri))

    # Find URLs in raw text (many papers embed them as plain text)
    text_urls = re.findall(
        r'https?://[^\s\)\]\>\"\']+',
        full_text
    )
    urls.extend(text_urls)
    urls = list(set(urls))  # deduplicate

    # Classify URLs
    for url in urls:
        url = url.rstrip(".,;)")
        if "github.com" in url or "gitlab.com" in url:
            result["github_urls"].append(url)
        elif any(kw in url.lower() for kw in ["supplement", "suppl", "figshare", "zenodo", "dryad", "osf.io"]):
            result["supplementary_urls"].append(url)

    # Extract DOI
    doi_match = re.search(r'\b(10\.\d{4,}/[^\s\)\]\"\']+)', full_text)
    if doi_match:
        result["doi"] = doi_match.group(1).rstrip(".,;)")

    # Extract title (usually the largest text on page 1, or first non-empty line)
    lines = raw_pages[0].split("\n") if raw_pages else []
    for line in lines:
        line = line.strip()
        if len(line) > 20:
            result["title"] = line
            break

    # Parse sections
    result["sections"] = _parse_sections(full_text)

    # Extract tool/software mentions with versions
    result["tool_mentions"] = _extract_tools(full_text)
    result["software_versions"] = _extract_versions(full_text)

    return result


def _parse_sections(text: str) -> dict:
    """Split text into named sections (Methods, Results, etc.)."""
    section_headers = [
        "abstract", "introduction", "background", "methods", "materials and methods",
        "results", "discussion", "conclusion", "supplementary", "data availability",
        "code availability", "software", "pipeline", "analysis", "workflow",
        "bioinformatics", "statistical analysis", "acknowledgements", "references"
    ]
    sections = {}
    current = "preamble"
    current_lines = []

    for line in text.split("\n"):
        lower = line.strip().lower()
        matched = next((h for h in section_headers if lower == h or lower.startswith(h + " ")), None)
        if matched and len(line.strip()) < 60:
            if current_lines:
                sections[current] = "\n".join(current_lines)
            current = matched
            current_lines = []
        else:
            current_lines.append(line)

    if current_lines:
        sections[current] = "\n".join(current_lines)

    return sections


def _extract_tools(text: str) -> list[str]:
    """Find mentions of known bioinformatics tools."""
    known_tools = [
        "STAR", "HISAT2", "BWA", "Bowtie2", "GATK", "DESeq2", "edgeR", "limma",
        "Seurat", "Scanpy", "Cell Ranger", "STARsolo", "Salmon", "kallisto", "RSEM",
        "Trimmomatic", "fastp", "FastQC", "MultiQC", "Picard", "SAMtools", "BCFtools",
        "ANNOVAR", "VEP", "SnpEff", "Bismark", "bsseq", "DSS", "MethylKit",
        "Snakemake", "Nextflow", "WDL", "CWL", "nf-core", "featureCounts",
        "HTSeq", "MACS2", "bedtools", "deepTools", "HOMER", "cellranger",
        "DoubletFinder", "Harmony", "Seurat", "UMAP", "t-SNE", "scVI",
        "Monocle", "velocyto", "scvelo", "CellChat", "NicheNet", "inferCNV",
        "Mutect2", "HaplotypeCaller", "FreeBayes", "Strelka2", "DELLY", "Lumpy",
        "SvABA", "CNVkit", "PURPLE", "AMBER", "COBALT"
    ]
    found = []
    for tool in known_tools:
        if re.search(r'\b' + re.escape(tool) + r'\b', text, re.IGNORECASE):
            found.append(tool)
    return found


def _extract_versions(text: str) -> list[dict]:
    """Extract software version strings like 'STAR v2.7.9a' or 'Seurat 4.0.1'."""
    pattern = r'\b([A-Za-z][A-Za-z0-9_\-\.]+)\s+(?:v|version\s+)?(\d+\.\d+[\.\d]*(?:[a-z]\d*)?)\b'
    matches = re.findall(pattern, text)
    seen = set()
    results = []
    for name, version in matches:
        key = f"{name}:{version}"
        if key not in seen and len(name) > 2:
            seen.add(key)
            results.append({"tool": name, "version": version})
    return results
