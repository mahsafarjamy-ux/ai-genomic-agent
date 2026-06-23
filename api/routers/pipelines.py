import json
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException
from api.models.schemas import PipelineDefinition, AnalysisType

router = APIRouter()

TEMPLATE_DIR = Path(__file__).parent.parent.parent / "core" / "pipelines"

_pipeline_store: dict = {}


@router.get("/templates")
async def list_templates():
    """List all built-in pipeline templates."""
    templates = []
    for analysis_dir in TEMPLATE_DIR.iterdir():
        if analysis_dir.is_dir():
            snakefile = analysis_dir / "Snakefile"
            if snakefile.exists():
                templates.append({
                    "id": f"template_{analysis_dir.name}",
                    "name": analysis_dir.name.upper(),
                    "type": analysis_dir.name,
                    "snakefile": str(snakefile),
                    "description": _template_descriptions.get(analysis_dir.name, ""),
                })
    return templates


@router.get("/templates/{analysis_type}/config-schema")
async def get_config_schema(analysis_type: str):
    """Return the config.yaml schema for a pipeline type."""
    schemas = {
        "rnaseq": {
            "samples": ["sample1", "sample2"],
            "fastq": {
                "sample1": {"R1": "/path/to/sample1_R1.fastq.gz", "R2": "/path/to/sample1_R2.fastq.gz"}
            },
            "genome_fasta": "/path/to/GRCh38.fa",
            "gtf": "/path/to/gencode.v44.annotation.gtf",
            "star_index": "/path/to/STAR_index/",
            "results_dir": "results",
            "threads": 8,
            "memory_gb": 32,
        },
        "wgs": {
            "samples": ["sample1"],
            "fastq": {
                "sample1": {"R1": "/path/to/sample1_R1.fastq.gz", "R2": "/path/to/sample1_R2.fastq.gz"}
            },
            "genome_fasta": "/path/to/GRCh38.fa",
            "dbsnp_vcf": "/path/to/dbsnp_146.hg38.vcf.gz",
            "mills_vcf": "/path/to/Mills_and_1000G_gold_standard.indels.hg38.vcf.gz",
            "g1000_vcf": "/path/to/1000G_phase1.snps.high_confidence.hg38.vcf.gz",
            "results_dir": "results",
            "threads": 16,
            "memory_gb": 64,
        },
        "scrnaseq": {
            "samples": ["sample1"],
            "fastq_dirs": {"sample1": "/path/to/sample1/fastqs/"},
            "cellranger_transcriptome": "/path/to/refdata-gex-GRCh38-2020-A/",
            "results_dir": "results",
            "min_cells": 3,
            "min_features": 200,
            "max_mt_percent": 20,
            "clustering_resolution": 0.5,
            "threads": 16,
            "memory_gb": 64,
        },
    }
    schema = schemas.get(analysis_type.lower())
    if not schema:
        raise HTTPException(404, f"No schema for analysis type: {analysis_type}")
    return schema


@router.get("/{pipeline_id}")
async def get_pipeline(pipeline_id: str):
    if pipeline_id in _pipeline_store:
        return _pipeline_store[pipeline_id]
    raise HTTPException(404, "Pipeline not found")


_template_descriptions = {
    "rnaseq":       "Bulk RNA-seq: FastQC → fastp → STAR → featureCounts → DESeq2",
    "wgs":          "WGS: BWA-MEM2 → GATK4 MarkDuplicates → BQSR → HaplotypeCaller → VQSR",
    "wes":          "WES: BWA-MEM2 → GATK4 → target capture QC → variant annotation",
    "scrnaseq":     "scRNA-seq: Cell Ranger → Seurat 5 → Harmony integration → clustering",
    "methylation":  "Methylation (WGBS/RRBS): Bismark → bismark_extractor → DSS DMR",
    "chipseq":      "ChIP-seq: Bowtie2 → MACS3 → deepTools → ChIPseeker → DiffBind",
    "atacseq":      "ATAC-seq: Bowtie2 → MACS3 (nucleosome-free) → TOBIAS footprinting",
    "immune_profiling": "Immune profiling: TRUST4 (TCR/BCR) → OptiType (HLA) → quanTIseq → neoantigen",
    "ctdna":        "ctDNA/cfDNA: BWA-MEM2 → Mutect2 (0.5% VAF) → ichorCNA → Griffin",
    "microbiome":   "Microbiome: 16S QIIME2+DADA2 / Shotgun Kraken2+MetaPhlAn4+HUMAnN3",
    "riboseq":      "Ribo-seq: STAR → fragment length filter → riboWaltz P-site → ORF discovery → TE",
    "proteomics":   "Proteomics: DIA-NN (DIA) / Fragpipe (DDA) → MSstats → pathway enrichment",
    "multiomics":   "Multi-omics: MOFA+ (unsupervised) / DIABLO (supervised) → WGCNA",
    "spatial":      "Spatial: Space Ranger → Seurat 5 → SPARK-X SVGs → cell2location deconvolution",
    "dark_genome":  "Dark Genome: long-read alignment → repeat element analysis → transposon expression",
}
