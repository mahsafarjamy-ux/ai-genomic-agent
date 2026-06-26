# KEY BIOINFORMATICS GITHUB ORGANIZATIONS & REPOSITORIES
## Engineering reference for the Pipeline Architect agent

---

## TOP ORGANIZATIONS

### Broad Institute — broadinstitute
**URL:** https://github.com/broadinstitute
**Focus:** Genomics tools, variant calling, cancer genomics, cloud workflows (Terra/WDL)
**Key repos:**
- `gatk` — GATK4 variant calling (Java, 10K+ stars)
- `picard` — SAM/BAM/VCF manipulation tools
- `cromwell` — WDL workflow execution engine
- `warp` — Production WDL pipelines (WholeGenomeGermlineSingleSample, etc.)
- `IGV` — Integrative Genomics Viewer
- `terra-jupyter-base` — Terra/cloud genomics notebooks
**Pipeline patterns:** WDL (Workflow Description Language), Google Cloud/Terra, Cromwell

### EMBL-EBI (Ensembl) — Ensembl
**URL:** https://github.com/Ensembl
**Focus:** Genome annotation, variant annotation (VEP), comparative genomics
**Key repos:**
- `ensembl-vep` — Variant Effect Predictor (most widely used annotation tool)
- `ensembl-compara` — Comparative genomics
- `ensembl-genome-browser` — Embedded genome browser
**Use:** VEP annotation is standard for any variant pipeline

### nf-core — nf-core
**URL:** https://github.com/nf-core
**Focus:** Community-curated Nextflow DSL2 pipelines
**Key repos (100+ pipelines):**
- `rnaseq` — 3.14.0 — FastQC→fastp→STAR/HISAT2→Salmon→DESeq2
- `sarek` — Somatic + germline variant calling (BWA-MEM2→GATK4→VEP)
- `scrnaseq` — Cell Ranger/STARsolo→Seurat/Scanpy
- `atacseq` — Bowtie2→MACS3→deepTools→DiffBind
- `chipseq` — ChIP-seq, follows ENCODE guidelines
- `methylseq` — WGBS Bismark + DSS
- `spatialvi` — 10x Visium spatial transcriptomics
- `ampliseq` — 16S/ITS QIIME2+DADA2 amplicon sequencing
- `mag` — Metagenome-assembled genomes
- `pangenome` — Pangenome assembly and analysis
- `nanoseq` — Oxford Nanopore long-read pipeline
- `taxprofiler` — Multi-taxonomy profiling (Kraken2, MetaPhlAn4)
**Engineering patterns:** DSL2 modules system (nf-core/modules), automated testing with nf-test, semantic versioning

### scverse — scverse
**URL:** https://github.com/scverse
**Focus:** Single-cell analysis Python ecosystem
**Key repos:**
- `scanpy` — Single-cell RNA-seq (Python, most widely used after Seurat)
- `anndata` — AnnData format (standard for single-cell data)
- `scvi-tools` — Deep learning for single-cell (SCVI, SCANVI, totalVI, PEAKVI)
- `squidpy` — Spatial single-cell analysis
- `muon` — Multi-omics single-cell (MuData format)
- `spatialdata` — Unified spatial omics data format
- `scirpy` — Immune repertoire analysis in the scverse ecosystem
**AnnData structure:**
```python
adata.X         # expression matrix (cells × genes)
adata.obs       # cell metadata (DataFrame)
adata.var       # gene metadata (DataFrame)
adata.uns       # unstructured annotations
adata.obsm      # dimensional reductions (PCA, UMAP)
adata.layers    # additional count matrices (raw, normalized)
adata.obsp      # sparse pairwise matrices (connectivities)
```

### Google DeepMind — google-deepmind
**URL:** https://github.com/google-deepmind
**Focus:** AI for biology, structure prediction
**Key repos:**
- `alphafold` — AlphaFold2 protein structure prediction (100K+ stars)
- `alphafold3` — AlphaFold3 (protein-ligand-nucleic complexes, Nov 2024)
- `enformer` — Sequence-to-function transformer (gene expression from DNA)
- `graphcast` — (weather, but architecture used for biomolecules)
**AlphaFold3 input format (JSON):**
```json
{
  "sequences": [
    {"protein": {"id": "A", "sequence": "MAHHHHHHM..."}},
    {"ligand": {"id": "B", "ccdCodes": ["ATP"]}}
  ],
  "modelSeeds": [1]
}
```

### Open Targets — opentargets
**URL:** https://github.com/opentargets
**Focus:** Drug target identification and validation
**Key repos:**
- `platform-app` — Open Targets Platform
- `genetics-app` — Open Targets Genetics (GWAS → target)
- `evidence_datasource_parsers` — ETL pipelines for evidence sources
**API access:**
```python
import requests
# GraphQL API
query = """query TargetAssociations($ensemblId: String!) {
  target(ensemblId: $ensemblId) {
    approvedSymbol
    associatedDiseases { count rows { disease { name } score } }
  }
}"""
r = requests.post("https://api.platform.opentargets.org/api/v4/graphql",
    json={"query": query, "variables": {"ensemblId": "ENSG00000157764"}})
```

### 10x Genomics — 10XGenomics
**URL:** https://github.com/10XGenomics
**Focus:** Single-cell sequencing tools and software
**Key repos:**
- `cellranger` — Cell Ranger (FASTQ → gene-barcode matrix)
- `spaceranger` — Space Ranger (Visium spatial FASTQ → count matrix)
- `cellranger-atac` — Cell Ranger ATAC
- `loupe-browser` — Loupe Browser (visualization)
**Cell Ranger output structure:**
```
outs/
├── filtered_feature_bc_matrix/  # use this (empty droplets removed)
│   ├── matrix.mtx.gz
│   ├── features.tsv.gz
│   └── barcodes.tsv.gz
├── raw_feature_bc_matrix/       # all detected barcodes
├── possorted_genome_bam.bam     # aligned reads
├── metrics_summary.csv          # QC stats
└── web_summary.html             # interactive QC report
```

### Bioconductor — Bioconductor
**URL:** https://github.com/Bioconductor
**Focus:** R packages for bioinformatics (3000+ packages)
**Key packages by category:**
- **Genomic ranges:** GenomicRanges, IRanges, GenomeInfoDb
- **Sequence analysis:** Biostrings, BSgenome, ShortRead
- **RNA-seq:** DESeq2, edgeR, limma, tximeta, tximport
- **Single-cell:** SingleCellExperiment, scran, scater
- **Methylation:** minfi, ChAMP, bismark, DMRcate, DSS
- **ChIP/ATAC:** ChIPseeker, DiffBind, macs3, normr
- **Pathway:** clusterProfiler, ReactomePA, GSEA, fgsea
- **Variant:** VariantAnnotation, VariantFiltering, SNPRelate
- **Multi-omics:** MultiAssayExperiment, MOFA2, mixOmics

### Seqera (Nextflow company) — seqeralabs
**URL:** https://github.com/seqeralabs
**Focus:** Nextflow platform, Pipeline Manager, Tower
**Key repos:**
- `nf-core-tools` — nf-core CLI tool
- `tower-cli` — Seqera Tower command line
- `wave` — Container provisioning for Nextflow
**Wave containers (auto-built from conda specs):**
```groovy
// nextflow.config — use Wave to provision conda envs as containers
wave.enabled = true
process.conda = "bioconda::star=2.7.11a"
// Wave automatically builds a Docker container for this
```

### Galaxy Project — galaxyproject
**URL:** https://github.com/galaxyproject
**Focus:** Web-based bioinformatics platform, accessible to non-programmers
**Key repos:**
- `galaxy` — Main Galaxy server (Django + Python)
- `tools-iuc` — Curated Galaxy tool wrappers (bioinformatics)
- `planemo` — Tool development CLI (test, lint, deploy Galaxy tools)
**Galaxy Tool XML format:**
```xml
<tool id="samtools_sort" name="Samtools sort" version="1.19+galaxy0">
    <requirements>
        <requirement type="package" version="1.19">samtools</requirement>
    </requirements>
    <command><![CDATA[
        samtools sort -@ \$GALAXY_SLOTS -o '$output' '$input'
    ]]></command>
    <inputs>
        <param name="input" type="data" format="bam,sam" label="BAM/SAM file"/>
    </inputs>
    <outputs>
        <data name="output" format="bam"/>
    </outputs>
</tool>
```

---

## KEY INDIVIDUAL TOOL REPOSITORIES

### Workflow Systems
| Tool | Repo | Stars | Language |
|------|------|-------|---------|
| Nextflow | nextflow-io/nextflow | 2.7K | Groovy |
| Snakemake | snakemake/snakemake | 2.1K | Python |
| Cromwell | broadinstitute/cromwell | 1.0K | Scala |
| CWLtool | common-workflow-language/cwltool | 650 | Python |
| Galaxy | galaxyproject/galaxy | 1.2K | Python |

### nf-core Module System
Each nf-core module is a self-contained Nextflow process:
```
modules/nf-core/{tool}/{subcommand}/
├── main.nf       # process definition
├── meta.yml      # documentation (params, inputs, outputs)
└── tests/
    ├── main.nf.test
    └── tags.yml
```

Install modules with:
```bash
nf-core modules install star/align
nf-core modules list installed
nf-core modules update
```

### GATK Best Practice Workflows (WDL)
Available at: https://github.com/broadinstitute/warp
```
workflows/
├── broad/
│   ├── WholeGenomeGermlineSingleSample.wdl
│   ├── JointGenotyping.wdl
│   └── SomaticSingleSample.wdl
└── tasks/
    ├── BwaMemFastqToUnmappedBam.wdl
    ├── GermlineVariantDiscovery.wdl
    └── Qc.wdl
```

---

## ENGINEERING PATTERNS ACROSS ORGANIZATIONS

### Containerization Strategy
- **Broad/GATK:** Docker images on Docker Hub (`broadinstitute/gatk:4.4.0.0`)
- **nf-core:** Biocontainers + Galaxy depot (`depot.galaxyproject.org/singularity/...`)
- **10x Genomics:** Custom images (`us.gcr.io/broad-dsde-methods/genomes-in-the-cloud:...`)
- **scverse:** DockerHub + Quay.io (`quay.io/biocontainers/scanpy:...`)

### Version Pinning Strategy
- Always pin tool versions in `conda:` directives and `container:` directives
- Use `multiqc --version` outputs to capture versions
- nf-core requirement: every process emits `versions.yml`

### Samplesheet Standards (nf-core)
All nf-core pipelines accept CSV with: `sample,fastq_1,fastq_2` at minimum
Extended for tumor-normal: add `patient,status` (0=normal,1=tumor)

### Reference Genome Handling
- nf-core: `--genome GRCh38` auto-downloads from `iGenomes` S3 bucket
- Snakemake: config.yaml with explicit paths (`star_index`, `genome_fasta`, `gtf`)
- Always use GENCODE GTF for human (not Ensembl GTF for ENCODE pipelines)

### Output Directory Conventions
```
results/
├── {tool}/           # one subdirectory per tool
├── multiqc/          # QC aggregation
├── pipeline_info/    # execution trace, timeline, dag
└── {analysis_name}/  # final results (counts, DEGs, peaks)
```
