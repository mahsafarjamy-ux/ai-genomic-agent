# BIOINFORMATICS PIPELINE ENGINEERING — COMPREHENSIVE REFERENCE
## Snakemake, Nextflow (nf-core DSL2), WDL, CWL patterns + best practices

---

## 1. SNAKEMAKE — ARCHITECTURE & PATTERNS

### Core Concepts
- **Rule-based** DAG execution: Snakemake builds a directed acyclic graph from input/output patterns
- **Python-native**: config files are YAML, logic is Python, shell commands in `shell:` or Python in `run:`
- **Reproducibility**: `--use-conda` creates per-rule environments; `--use-singularity` for HPC

### Minimal Working Pipeline Structure
```
my_pipeline/
├── Snakefile              # main workflow
├── config.yaml            # parameters
├── environment.yaml       # conda deps for the entire pipeline
├── envs/                  # per-rule conda envs (optional)
│   ├── align.yaml
│   └── deseq2.yaml
├── scripts/               # R/Python helper scripts
│   ├── deseq2.R
│   └── plot_pca.py
├── rules/                 # modular rule files (include: rules/qc.smk)
│   ├── qc.smk
│   └── align.smk
└── resources/             # static references (not tracked in git)
```

### Production Snakefile Template (RNA-seq pattern)
```python
configfile: "config.yaml"
from pathlib import Path

SAMPLES  = config["samples"]
RESULTS  = Path(config.get("results_dir", "results"))
THREADS  = config.get("threads", 8)

rule all:
    input:
        expand(RESULTS / "counts/{sample}.counts.txt", sample=SAMPLES),
        RESULTS / "qc/multiqc_report.html",
        RESULTS / "deseq2/results.csv",

rule trim:
    input:
        r1 = lambda wc: config["samples"][wc.sample]["r1"],
        r2 = lambda wc: config["samples"][wc.sample]["r2"],
    output:
        r1 = RESULTS / "trimmed/{sample}_R1.fastq.gz",
        r2 = RESULTS / "trimmed/{sample}_R2.fastq.gz",
    log: RESULTS / "logs/trim/{sample}.log"
    threads: 4
    conda: "envs/trim.yaml"
    shell: "fastp -i {input.r1} -I {input.r2} -o {output.r1} -O {output.r2} 2>{log}"

rule star_align:
    input:
        r1 = RESULTS / "trimmed/{sample}_R1.fastq.gz",
        r2 = RESULTS / "trimmed/{sample}_R2.fastq.gz",
        index = config["star_index"],
    output:
        bam = RESULTS / "aligned/{sample}.bam",
        log = RESULTS / "logs/star/{sample}.Log.final.out",
    threads: THREADS
    resources: mem_mb = 40000
    conda: "envs/star.yaml"
    shell:
        """
        STAR --runThreadN {threads} --genomeDir {input.index} \
             --readFilesIn {input.r1} {input.r2} \
             --readFilesCommand zcat \
             --outSAMtype BAM SortedByCoordinate \
             --outFileNamePrefix results/aligned/{wildcards.sample}_ \
             --outBAMsortingThreadN {threads}
        mv results/aligned/{wildcards.sample}_Aligned.sortedByCoord.out.bam {output.bam}
        samtools index {output.bam}
        """
```

### Key Snakemake Patterns
```python
# Lambda functions for dynamic input
input: fastq = lambda wc: samples[wc.sample]["fastq"]

# Ancient files (skip timestamp check for slow reference files)
input: genome = ancient(config["genome_fasta"])

# Temp files (deleted after downstream rules complete)
output: temp(RESULTS / "tmp/{sample}.bam")

# Protected outputs (write-protected after creation)
output: protected(RESULTS / "final/{sample}.vcf.gz")

# Directory outputs
output: directory(RESULTS / "cellranger/{sample}/")

# Checkpoints (for dynamic output not known before execution)
checkpoint split_by_chrom:
    output: directory(RESULTS / "by_chrom/")
    shell: "bash scripts/split.sh {input} {output}"

# Scatter-gather after checkpoint
def get_chrom_files(wildcards):
    chkpt = checkpoints.split_by_chrom.get(**wildcards).output[0]
    return expand("{chrom}.vcf", chrom=glob_wildcards(f"{chkpt}/{{chrom}}.vcf").chrom)
```

### Snakemake Config Best Practices
```yaml
# config.yaml
samples:
  tumor_A:
    r1: /data/tumor_A_R1.fastq.gz
    r2: /data/tumor_A_R2.fastq.gz
    condition: tumor
  normal_A:
    r1: /data/normal_A_R1.fastq.gz
    r2: /data/normal_A_R2.fastq.gz
    condition: normal

reference:
  genome: /ref/GRCh38.fa
  gtf: /ref/gencode.v44.annotation.gtf
  star_index: /ref/STAR_index_2.7.11/
  dbsnp: /ref/dbsnp_146.hg38.vcf.gz

params:
  threads: 16
  memory_gb: 64
  results_dir: results
  deseq2:
    fdr_cutoff: 0.05
    lfc_cutoff: 1.0
```

### Run Commands
```bash
# Dry run (always first)
snakemake -n --cores 8

# Execute with conda environments
snakemake --cores 16 --use-conda

# HPC SLURM profile
snakemake --cores 100 --use-conda --profile slurm

# Docker/Singularity
snakemake --cores 8 --use-singularity --singularity-args "--bind /data"

# Cluster execution
snakemake --cluster "sbatch -c {threads} --mem {resources.mem_mb}M" --jobs 50

# Create report after run
snakemake --report report.html
```

---

## 2. NEXTFLOW DSL2 — ARCHITECTURE & PATTERNS

### Core DSL2 Concepts
- **Processes**: atomic units with `input:`, `output:`, `script:`
- **Channels**: data streams connecting processes
- **Workflows**: orchestrate processes with channel operators
- **Modules**: reusable process definitions (nf-core/modules)
- **Subworkflows**: composable multi-process units

### DSL2 Pipeline Structure
```
my_pipeline/
├── main.nf               # entry point
├── nextflow.config       # resource profiles, executors
├── modules/
│   ├── local/
│   │   └── custom_tool/main.nf
│   └── nf-core/          # imported from nf-core/modules
│       ├── star/align/main.nf
│       └── salmon/quant/main.nf
├── subworkflows/
│   └── local/
│       └── prepare_genome/main.nf
├── workflows/
│   └── rnaseq.nf         # main pipeline logic
├── conf/
│   ├── base.config       # default resources
│   ├── hpc.config        # HPC-specific settings
│   └── test.config       # CI test profile
└── assets/
    └── samplesheet.csv
```

### DSL2 Process Template
```groovy
// modules/local/star_align/main.nf
process STAR_ALIGN {
    tag "$meta.id"
    label 'process_high'

    conda "bioconda::star=2.7.11a"
    container "${ workflow.containerEngine == 'singularity' ?
        'https://depot.galaxyproject.org/singularity/star:2.7.11a--h0033a41_0' :
        'biocontainers/star:2.7.11a--h0033a41_0' }"

    input:
    tuple val(meta), path(reads)
    path  index
    path  gtf

    output:
    tuple val(meta), path("*Aligned.sortedByCoord.out.bam"),  emit: bam
    tuple val(meta), path("*Log.final.out"),                   emit: log_final
    path  "versions.yml",                                      emit: versions

    when:
    task.ext.when == null || task.ext.when

    script:
    def args   = task.ext.args   ?: ''
    def prefix = task.ext.prefix ?: "${meta.id}"
    """
    STAR \\
        --runThreadN $task.cpus \\
        --genomeDir $index \\
        --readFilesIn $reads \\
        --readFilesCommand zcat \\
        --outSAMtype BAM SortedByCoordinate \\
        --outFileNamePrefix ${prefix}_ \\
        $args

    cat <<-END_VERSIONS > versions.yml
    "${task.process}":
        star: \$(STAR --version | sed -e "s/STAR_//g")
    END_VERSIONS
    """
}
```

### DSL2 Main Workflow Pattern
```groovy
// workflows/rnaseq.nf
include { FASTQC           } from '../modules/nf-core/fastqc/main'
include { STAR_ALIGN       } from '../modules/local/star_align/main'
include { SALMON_QUANT     } from '../modules/nf-core/salmon/quant/main'
include { DESEQ2_ANALYSIS  } from '../modules/local/deseq2/main'

workflow RNASEQ {
    take:
    samplesheet  // channel: [ val(meta), [ fastq_1, fastq_2 ] ]
    genome_index // path
    gtf          // path

    main:
    ch_versions = Channel.empty()

    // QC
    FASTQC(samplesheet)
    ch_versions = ch_versions.mix(FASTQC.out.versions.first())

    // Align
    STAR_ALIGN(samplesheet, genome_index, gtf)
    ch_versions = ch_versions.mix(STAR_ALIGN.out.versions.first())

    // Quantify
    SALMON_QUANT(STAR_ALIGN.out.bam, gtf)

    // Differential expression
    DESEQ2_ANALYSIS(SALMON_QUANT.out.results.collect())

    emit:
    multiqc_files = FASTQC.out.zip.mix(STAR_ALIGN.out.log_final)
    versions      = ch_versions
}
```

### nextflow.config — Resource Profiles
```groovy
// nextflow.config
params {
    input              = null
    genome             = 'GRCh38'
    star_index         = null
    gtf                = null
    results_dir        = 'results'
    max_memory         = '128.GB'
    max_cpus           = 32
    max_time           = '240.h'
}

profiles {
    conda {
        conda.enabled     = true
        docker.enabled    = false
    }
    docker {
        docker.enabled    = true
        docker.runOptions = '-u $(id -u):$(id -g)'
    }
    singularity {
        singularity.enabled    = true
        singularity.autoMounts = true
    }
    test {
        params.input  = "${projectDir}/assets/test_samplesheet.csv"
        params.genome = 'GRCh38_test'
        max_memory    = '6.GB'
        max_cpus      = 4
    }
}

process {
    withLabel: process_single { cpus = 1;  memory = '6.GB';  time = '4.h'  }
    withLabel: process_medium { cpus = 8;  memory = '36.GB'; time = '8.h'  }
    withLabel: process_high   { cpus = 16; memory = '72.GB'; time = '16.h' }
}
```

### Nextflow Run Commands
```bash
# Local with conda
nextflow run main.nf -profile conda --input samplesheet.csv

# nf-core pipeline
nextflow run nf-core/rnaseq -r 3.14.0 -profile docker \
    --input samplesheet.csv --genome GRCh38

# Resume after failure
nextflow run main.nf -resume

# SLURM HPC
nextflow run main.nf -profile slurm,singularity

# Tower monitoring
nextflow run main.nf -with-tower
```

---

## 3. CONDA ENVIRONMENT FILES (best practice)

```yaml
# environment.yaml — complete, pinned, channel-ordered
name: genomics_pipeline
channels:
  - bioconda
  - conda-forge
  - defaults
dependencies:
  - python=3.11
  - snakemake=7.32.4
  # Aligners
  - star=2.7.11a
  - bwa-mem2=2.2.1
  - minimap2=2.26
  - hisat2=2.2.1
  # BAM/VCF processing
  - samtools=1.19
  - bcftools=1.19
  - picard=3.1.1
  - gatk4=4.4.0.0
  # RNA quantification
  - salmon=1.10.2
  - kallisto=0.50.1
  # QC
  - fastqc=0.12.1
  - fastp=0.23.4
  - multiqc=1.19
  # Python packages
  - pandas=2.1.4
  - numpy=1.26.3
  - matplotlib=3.8.2
  - seaborn=0.13.2
  - pip
  - pip:
    - DESeq2  # via rpy2
    - anndata==0.10.5
    - scanpy==1.9.8
```

---

## 4. TOOL BEST PRACTICES BY CATEGORY

### GATK4 Variant Calling (BEST PRACTICE PIPELINE)
```bash
# 1. Mark duplicates
gatk MarkDuplicates \
    -I input.bam -O dedup.bam -M metrics.txt \
    --REMOVE_DUPLICATES false --OPTICAL_DUPLICATE_PIXEL_DISTANCE 2500

# 2. Base Quality Score Recalibration
gatk BaseRecalibrator \
    -I dedup.bam -R genome.fa \
    --known-sites dbsnp.vcf.gz --known-sites mills.vcf.gz \
    -O recal.table
gatk ApplyBQSR -I dedup.bam -R genome.fa --bqsr-recal-file recal.table -O recal.bam

# 3. Haplotype Caller (germline)
gatk HaplotypeCaller -R genome.fa -I recal.bam -O sample.g.vcf.gz -ERC GVCF

# 4. Somatic (Mutect2)
gatk Mutect2 -R genome.fa -I tumor.bam -I normal.bam \
    -normal normal_sample_name \
    --germline-resource af-only-gnomad.vcf.gz \
    -O somatic.vcf.gz
gatk FilterMutectCalls -R genome.fa -V somatic.vcf.gz -O filtered.vcf.gz
```

### STAR Alignment (RNA-seq)
```bash
# Build index (once per genome)
STAR --runMode genomeGenerate \
    --genomeDir /ref/STAR_GRCh38 \
    --genomeFastaFiles GRCh38.fa \
    --sjdbGTFfile gencode.v44.annotation.gtf \
    --runThreadN 16

# Alignment
STAR --runThreadN 16 \
    --genomeDir /ref/STAR_GRCh38 \
    --readFilesIn sample_R1.fastq.gz sample_R2.fastq.gz \
    --readFilesCommand zcat \
    --outSAMtype BAM SortedByCoordinate \
    --outSAMattributes NH HI AS NM MD \
    --outFilterMultimapNmax 20 \
    --alignSJoverhangMin 8 \
    --outFileNamePrefix results/aligned/sample_
```

### Salmon Quantification (accurate, fast)
```bash
# Build index
salmon index -t gencode.v44.transcripts.fa -i salmon_index --gencode

# Quantify (with automatic GC bias + sequence bias correction)
salmon quant -i salmon_index -l A \
    -1 sample_R1.fastq.gz -2 sample_R2.fastq.gz \
    --validateMappings --gcBias --seqBias \
    -p 16 -o results/salmon/sample/
```

### DESeq2 (R) — Differential Expression
```r
library(DESeq2); library(tximeta)
# Load Salmon quantifications
se <- tximeta(coldata)  # coldata has 'files' (paths to quant.sf) and 'condition'
dds <- DESeqDataSet(se, design = ~ condition)
dds <- DESeq(dds)
res <- results(dds, contrast = c("condition", "treatment", "control"),
               alpha = 0.05, lfcThreshold = 1)
res_shrunk <- lfcShrink(dds, coef = 2, type = "ashr")  # recommended
write.csv(as.data.frame(res_shrunk), "results/deseq2_results.csv")
```

### Seurat v5 Single-Cell Pipeline
```r
library(Seurat)
# Read 10x output
obj <- Read10X("cellranger/outs/filtered_feature_bc_matrix/")
seu <- CreateSeuratObject(counts = obj, min.cells = 3, min.features = 200)

# QC filtering
seu[["percent.mt"]] <- PercentageFeatureSet(seu, pattern = "^MT-")
seu <- subset(seu, subset = nFeature_RNA > 500 & percent.mt < 20)

# Standard workflow
seu <- NormalizeData(seu) |>
    FindVariableFeatures(nfeatures = 3000) |>
    ScaleData() |>
    RunPCA(npcs = 50) |>
    RunHarmony("batch") |>              # batch correction
    FindNeighbors(dims = 1:30) |>
    FindClusters(resolution = 0.5) |>
    RunUMAP(dims = 1:30)

# Save
saveRDS(seu, "results/seurat_clustered.rds")
```

### Scanpy (Python) Single-Cell
```python
import scanpy as sc
import anndata as ad

adata = sc.read_10x_mtx("cellranger/outs/filtered_feature_bc_matrix/")
adata.var_names_make_unique()

# QC
sc.pp.calculate_qc_metrics(adata, qc_vars=["mt"], percent_top=None, inplace=True)
adata = adata[adata.obs.pct_counts_mt < 20]
adata = adata[adata.obs.n_genes_by_counts > 500]

# Standard workflow
sc.pp.normalize_total(adata, target_sum=1e4)
sc.pp.log1p(adata)
sc.pp.highly_variable_genes(adata, n_top_genes=3000)
sc.pp.pca(adata, n_comps=50)
sc.external.pp.harmony_integrate(adata, key="batch")  # batch correction
sc.pp.neighbors(adata, use_rep="X_pca_harmony")
sc.tl.umap(adata)
sc.tl.leiden(adata, resolution=0.5)

adata.write("results/adata_clustered.h5ad")
```

### scVI-tools (deep learning integration)
```python
import scvi
import anndata as ad

adata = ad.read_h5ad("adata_combined.h5ad")
scvi.model.SCVI.setup_anndata(adata, batch_key="batch", layer="counts")
model = scvi.model.SCVI(adata, n_layers=2, n_latent=30)
model.train(max_epochs=400, early_stopping=True)
adata.obsm["X_scVI"] = model.get_latent_representation()

# Cell type annotation with scANVI
scanvi_model = scvi.model.SCANVI.from_scvi_model(model, unlabeled_category="Unknown",
                                                  labels_key="cell_type")
scanvi_model.train(max_epochs=200)
adata.obs["predicted_cell_type"] = scanvi_model.predict()
```

### cell2location (spatial deconvolution)
```python
import cell2location, anndata as ad
import matplotlib.pyplot as plt

# Reference: scRNA-seq (source of cell type signatures)
ref = ad.read_h5ad("scrna_reference.h5ad")
cell2location.models.RegressionModel.setup_anndata(ref, batch_key="sample",
    labels_key="cell_type", layer="counts")
ref_model = cell2location.models.RegressionModel(ref)
ref_model.train(max_epochs=250)
ref.var["means_per_cluster_mu_fg"] = ref_model.get_factor_expectations()

# Spatial: Visium slides
sp = ad.read_h5ad("visium_data.h5ad")
cell2location.models.Cell2location.setup_anndata(sp, batch_key="sample")
sp_model = cell2location.models.Cell2location(sp,
    cell_state_df=ref.var[["means_per_cluster_mu_fg"]],
    N_cells_per_location=8, detection_alpha=200)
sp_model.train(max_epochs=30000)
sp.obs[sp_model.factor_names_] = sp_model.get_cell_abundance_df(use_mean=True)
```

---

## 5. DOCKER / CONTAINER PATTERNS

### Bioconductor Docker images (pinned versions)
```
biocontainers/fastqc:v0.12.1_cv1
biocontainers/star:2.7.11a--h0033a41_0
biocontainers/salmon:1.10.2--h7e5ed60_0
biocontainers/samtools:1.19--h50ea8bc_0
biocontainers/gatk4:4.4.0.0--py36hdfd78af_0
bioconductor/bioconductor_docker:RELEASE_3_18
```

### Galaxy depot containers (preferred in nf-core)
```
https://depot.galaxyproject.org/singularity/star:2.7.11a--h0033a41_0
https://depot.galaxyproject.org/singularity/samtools:1.19--h50ea8bc_0
```

---

## 6. MULTI-OMICS INTEGRATION PATTERNS

### MOFA+ (unsupervised multi-omics)
```python
from mofapy2.run.entry_point import entry_point
import muon

# Build MuData object
mdata = muon.MuData({"rna": rna_adata, "atac": atac_adata, "protein": protein_adata})
muon.pp.filter_var(mdata, shared=False)

ent = entry_point()
ent.set_data_options(scale_groups=False, scale_views=False)
ent.set_data_matrix(mdata, groups_label="sample", use_raw=False)
ent.set_model_options(factors=15, spikeslab_weights=True, ard_factors=True, ard_weights=True)
ent.set_train_options(iter=1000, convergence_mode="fast", seed=42)
ent.build()
ent.run()
ent.save("mofa_model.hdf5")

import mofax
model = mofax.mofa_model("mofa_model.hdf5")
model.plot_variance_explained()
```

### DIABLO (supervised multi-omics, mixOmics R)
```r
library(mixOmics)
X <- list(mRNA = rna_matrix, prot = protein_matrix, methy = methyl_matrix)
Y <- factor(condition)  # outcome variable
design <- matrix(0.1, nrow = 3, ncol = 3, dimnames = list(names(X), names(X)))
diag(design) <- 0

result <- block.splsda(X, Y, ncomp = 5, design = design, scale = TRUE)
perf <- perf(result, validation = "Mfold", folds = 5, nrepeat = 10, cpus = 4)
ncomp_opt <- perf$choice.ncomp$WeightedVote["Overall.BER", "centroids.dist"]
```

---

## 7. PIPELINE TEMPLATES BY ANALYSIS TYPE

### For each analysis type, the canonical tool chain:

| Type | Aligner | Quantifier | DE/Analysis | QC |
|------|---------|-----------|-------------|-----|
| RNA-seq | STAR 2.7.11 | Salmon → tximeta | DESeq2 / edgeR | FastQC + MultiQC |
| WGS germline | BWA-MEM2 | — | GATK HaplotypeCaller | FastQC + Picard |
| WGS somatic | BWA-MEM2 | — | GATK Mutect2 + Funcotator | FastQC + Picard |
| scRNA-seq | Cell Ranger / STARsolo | — | Seurat/Scanpy, scVI | emptyDrops |
| ATAC-seq | Bowtie2 | MACS3 | TOBIAS / chromVAR | FastQC + ATACseqQC |
| ChIP-seq | Bowtie2 | MACS3 peaks | DiffBind / ChIPseeker | FastQC + deepTools |
| Methylation | Bismark (WGBS) / bsmap | bismark_extractor | DSS / DMRfinder | FastQC + Bismark |
| Microbiome 16S | QIIME2 + DADA2 | — | ANCOM-BC2, phyloseq | QIIME2 demux |
| Microbiome WGS | — | MetaPhlAn4 + HUMAnN3 | MaAsLin2, ALDEx2 | FastQC |
| Proteomics DIA | — | DIA-NN 1.9 | MSstats, limma | DIA-NN QC |
| Proteomics DDA | — | FragPipe + MSFragger | MSstats | FragPipe QC |
| Spatial | Space Ranger | — | SPARK-X, cell2location | Space Ranger |
| cfDNA | BWA-MEM2 | ichorCNA | Griffin (nucleosome) | FastQC + Picard |
| Immune | — | TRUST4 (TCR/BCR) | VDJtools, scBCR | MiXCR |
| Long-read | Minimap2 | — | FLAMES/IsoQuant | NanoPlot |

---

## 8. SNAKEMAKE vs NEXTFLOW — WHEN TO USE WHICH

| Criteria | Snakemake | Nextflow DSL2 |
|----------|-----------|---------------|
| Primary language | Python | Groovy/Java |
| Learning curve | Low (Python users) | Medium |
| Local execution | Excellent | Good |
| HPC/Cloud native | Good (profiles) | Excellent (Tower) |
| Resumability | Moderate | Excellent (`-resume`) |
| Community pipelines | Good | Best (nf-core 100+ pipelines) |
| Docker/Singularity | Yes | Yes (built-in) |
| Reporting | HTML reports | Tower + trace |
| Best for | Local lab pipelines | Production, HPC, cloud |

**Recommendation:** Use Snakemake for custom novel pipelines (easier to generate and modify). Use nf-core/Nextflow for standard analyses where a mature pipeline exists.

---

## 9. ERROR HANDLING & DEBUGGING

### Snakemake
```python
# Per-rule error handling
rule risky_rule:
    output: "result.txt"
    log: "logs/risky.log"
    shell:
        """
        set -euo pipefail  # exit on error, undefined var, or pipe failure
        my_tool input.txt > {output} 2>{log}
        """

# Test a single rule
snakemake --cores 1 results/aligned/sample.bam

# Unlock after failed run
snakemake --unlock

# Force re-run specific rule
snakemake --force-run star_align
```

### Nextflow
```groovy
// Retry on failure with more memory
process HEAVY_TOOL {
    errorStrategy { task.exitStatus in 137..140 ? 'retry' : 'terminate' }
    maxRetries 3
    memory { 8.GB * task.attempt }
}

// Ignore errors for optional steps
process OPTIONAL_STEP {
    errorStrategy 'ignore'
}
```
