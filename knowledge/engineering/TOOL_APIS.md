# BIOINFORMATICS TOOL API REFERENCE
## Installation, key parameters, input/output formats, Docker images

---

## WORKFLOW SYSTEMS

### Snakemake
```bash
conda install -c bioconda snakemake=7.32.4
snakemake --cores {n} --use-conda [--use-singularity] [--cluster "sbatch"] [--profile slurm]
# Key flags: -n (dry-run), -p (print commands), -r (reason), --dag | dot -Tsvg > dag.svg
# Config override: snakemake --config threads=32
# Version check: snakemake --version
```

### Nextflow
```bash
conda install -c bioconda nextflow
nextflow run main.nf -profile conda,singularity -resume
# nf-core: nextflow run nf-core/rnaseq -r 3.14.0 --input samplesheet.csv --genome GRCh38
# Seqera Tower: nextflow run main.nf -with-tower -w s3://bucket/work
# Pull latest nf-core: nf-core download rnaseq
```

### nf-core Samplesheet Format (standard)
```csv
sample,fastq_1,fastq_2,strandedness
CTRL_1,/path/ctrl_1_R1.fastq.gz,/path/ctrl_1_R2.fastq.gz,reverse
CTRL_2,/path/ctrl_2_R1.fastq.gz,/path/ctrl_2_R2.fastq.gz,reverse
TREAT_1,/path/treat_1_R1.fastq.gz,/path/treat_1_R2.fastq.gz,reverse
```

---

## VARIANT CALLING

### BWA-MEM2 (preferred over BWA for speed)
```bash
conda install -c bioconda bwa-mem2=2.2.1 samtools=1.19
bwa-mem2 index genome.fa                           # index (once)
bwa-mem2 mem -t 16 -R "@RG\tID:sample\tSM:sample\tPL:ILLUMINA" \
    genome.fa R1.fastq.gz R2.fastq.gz | \
    samtools sort -@ 8 -o aligned.bam -          # pipe to samtools sort
samtools index aligned.bam
```

### Minimap2 (long reads — ONT/PacBio)
```bash
conda install -c bioconda minimap2=2.26
# ONT DNA
minimap2 -ax map-ont -t 16 genome.fa reads.fastq.gz | samtools sort -o aligned.bam
# PacBio HiFi
minimap2 -ax ccs -t 16 genome.fa reads.fastq.gz | samtools sort -o aligned.bam
# RNA (splice-aware)
minimap2 -ax splice -t 16 genome.fa rna.fastq.gz | samtools sort -o aligned.bam
```

### GATK4 Key Commands
```bash
# Docker image: broadinstitute/gatk:4.4.0.0
# Conda: conda install -c bioconda gatk4=4.4.0.0

# Mark duplicates (SPARK-enabled for large files)
gatk MarkDuplicatesSpark -I input.bam -O dedup.bam -M metrics.txt --tmp-dir /tmp

# BQSR
gatk BaseRecalibrator -I dedup.bam -R genome.fa --known-sites dbsnp.vcf.gz -O recal.table
gatk ApplyBQSR -I dedup.bam -bqsr recal.table -O recal.bam

# HaplotypeCaller (per-sample GVCF mode for joint genotyping)
gatk HaplotypeCaller -R genome.fa -I recal.bam -O sample.g.vcf.gz -ERC GVCF --native-pair-hmm-threads 4
gatk CombineGVCFs -R genome.fa -V sample1.g.vcf.gz -V sample2.g.vcf.gz -O combined.g.vcf.gz
gatk GenotypeGVCFs -R genome.fa -V combined.g.vcf.gz -O genotyped.vcf.gz

# Mutect2 (somatic)
gatk Mutect2 -R genome.fa -I tumor.bam -I normal.bam -normal NORMAL_SAMPLE \
    --germline-resource af-only-gnomad.vcf.gz --panel-of-normals pon.vcf.gz -O somatic.vcf.gz
gatk LearnReadOrientationModel -I f1r2.tar.gz -O artifact-prior.tar.gz
gatk FilterMutectCalls -V somatic.vcf.gz -R genome.fa --orientation-bias-artifact-priors artifact-prior.tar.gz -O filtered.vcf.gz

# CNV (somatic copy number)
gatk CollectReadCounts -I tumor.bam -L intervals.interval_list -O tumor.counts.hdf5
gatk DenoiseReadCounts -I tumor.counts.hdf5 --standardized-copy-ratios std_cr.tsv --denoised-copy-ratios denoise_cr.tsv
```

### SAMtools Key Commands
```bash
samtools view -bS -@ 8 input.sam -o output.bam
samtools sort -@ 8 -o sorted.bam input.bam
samtools index sorted.bam
samtools flagstat sorted.bam > flagstat.txt
samtools depth -a sorted.bam > depth.txt
samtools mpileup -f genome.fa sorted.bam > pileup.txt
samtools merge merged.bam sample1.bam sample2.bam  # merge multiple BAMs
```

### BCFtools
```bash
bcftools call -mv -Oz -o variants.vcf.gz input.bcf       # variant calling
bcftools filter -e "QUAL<30 || DP<10" variants.vcf.gz    # filter
bcftools annotate -a dbsnp.vcf.gz -c ID variants.vcf.gz  # annotate rsIDs
bcftools stats variants.vcf.gz > stats.txt
bcftools norm -m -any variants.vcf.gz | bcftools view -s SAMPLE1,SAMPLE2  # normalize + subset
```

---

## RNA-seq TOOLS

### STAR (splice-aware aligner)
```bash
# Docker: biocontainers/star:2.7.11a--h0033a41_0
# Conda: conda install -c bioconda star=2.7.11a

# Build genome index
STAR --runMode genomeGenerate --genomeDir /ref/STAR_GRCh38_100bp \
     --genomeFastaFiles GRCh38.fa --sjdbGTFfile gencode.v44.gtf \
     --sjdbOverhang 99 --runThreadN 16
# Note: sjdbOverhang = read_length - 1

# Align (paired-end, output sorted BAM + gene counts)
STAR --runThreadN 16 --genomeDir /ref/STAR_GRCh38_100bp \
     --readFilesIn R1.fastq.gz R2.fastq.gz --readFilesCommand zcat \
     --outSAMtype BAM SortedByCoordinate --outSAMattributes NH HI AS NM MD \
     --outFilterMultimapNmax 20 --alignSJoverhangMin 8 --alignMatesGapMax 1000000 \
     --quantMode GeneCounts --outFileNamePrefix results/star/sample_

# Output: *Aligned.sortedByCoord.out.bam, *ReadsPerGene.out.tab (counts)
```

### Salmon (quasi-mapping — fast, accurate with bias correction)
```bash
# Docker: biocontainers/salmon:1.10.2--h7e5ed60_0
# Conda: conda install -c bioconda salmon=1.10.2

# Build index
salmon index -t transcriptome.fa -i salmon_index --gencode -p 8

# Quantify
salmon quant -i salmon_index -l A -1 R1.fastq.gz -2 R2.fastq.gz \
    --validateMappings --gcBias --seqBias \
    --numBootstraps 100 -p 16 -o results/salmon/sample/

# Output: quant.sf (TPM + count), aux_info/, lib_format_counts.json
# Import to R: tximeta (preserves gene/transcript metadata)
```

### Kallisto (ultra-fast pseudoalignment)
```bash
kallisto index -i transcriptome.idx transcriptome.fa
kallisto quant -i transcriptome.idx -o results/kallisto/sample/ \
    -b 100 --threads 8 R1.fastq.gz R2.fastq.gz
# Output: abundance.tsv (TPM + estimated counts), run_info.json
```

---

## SINGLE-CELL TOOLS

### Cell Ranger (10x Genomics)
```bash
# Docker: 10xgenomics/cellranger:7.2.0
# Download: https://www.10xgenomics.com/support/software/cell-ranger/downloads

# Download reference
cellranger mkref --genome=GRCh38 --fasta=genome.fa --genes=genes.gtf

# Count (single sample)
cellranger count --id=sample_name --transcriptome=/ref/GRCh38 \
    --fastqs=/data/sample_fastqs/ --sample=sample_name \
    --expect-cells=5000 --localcores=16 --localmem=64

# Aggregate multiple samples
cellranger aggr --id=aggregated --csv=aggr.csv --normalize=mapped
```

### STARsolo (free Cell Ranger alternative in STAR)
```bash
STAR --runThreadN 16 --genomeDir /ref/STAR_GRCh38 \
     --readFilesIn barcodes.fastq.gz cDNA.fastq.gz --readFilesCommand zcat \
     --soloType CB_UMI_Simple --soloCBwhitelist 3M-february-2018.txt \
     --soloCBstart 1 --soloCBlen 16 --soloUMIstart 17 --soloUMIlen 12 \
     --outSAMtype BAM SortedByCoordinate --outFileNamePrefix results/starsolo/sample_
```

### scvi-tools (deep learning)
```python
# pip install scvi-tools
import scvi

# SCVI (batch integration)
scvi.model.SCVI.setup_anndata(adata, layer="counts", batch_key="batch",
    categorical_covariate_keys=["technology"], continuous_covariate_keys=["percent_mito"])
model = scvi.model.SCVI(adata, n_layers=2, n_latent=30, gene_likelihood="nb")
model.train(max_epochs=400, early_stopping=True, plan_kwargs={"lr": 1e-3})

# SCANVI (semi-supervised cell annotation)
scanvi = scvi.model.SCANVI.from_scvi_model(model, "Unknown", labels_key="cell_type")
scanvi.train(max_epochs=200)

# totalVI (CITE-seq: RNA + protein)
scvi.model.TOTALVI.setup_anndata(adata, layer="counts", protein_expression_obsm_key="protein_counts")
model = scvi.model.TOTALVI(adata)
model.train()
```

### Squidpy (spatial analysis)
```python
import squidpy as sq

# Spatial neighbors graph
sq.gr.spatial_neighbors(adata, coord_type="generic", n_neighs=6)

# Spatially variable genes (Moran's I)
sq.gr.spatial_autocorr(adata, mode="moran")
sq.pl.spatial_scatter(adata, color="cell_type")

# Cell interaction analysis (NICHE)
sq.gr.interaction_matrix(adata, cluster_key="cell_type")
sq.pl.interaction_matrix(adata, cluster_key="cell_type")

# Ligand-receptor analysis
sq.gr.ligrec(adata, n_perms=1000, cluster_key="cell_type",
    transmitter_params={"categories": "ligand"},
    receiver_params={"categories": "receptor"})
```

---

## AI BIOLOGY TOOLS

### AlphaFold2 / AlphaFold3
```bash
# AlphaFold2 (original, most tested)
# Repo: https://github.com/google-deepmind/alphafold
# Docker: docker pull alphafold/alphafold:latest
docker run --gpus all -v /data:/data alphafold/alphafold:latest \
    python docker/run_docker.py \
    --fasta_paths=sequence.fasta \
    --max_template_date=2024-01-01 \
    --model_preset=monomer \  # or multimer
    --data_dir=/data/alphafold_databases/ \
    --output_dir=/output/

# AlphaFold3 (protein-ligand-nucleic)
# Weights: https://github.com/google-deepmind/alphafold3 (academic license)
python run_alphafold.py --json_path=fold_input.json --model_dir=/af3_model/ --output_dir=./output/
```

### ESM-2 (protein language model, Meta)
```python
# pip install fair-esm
import torch
import esm

# Load model (esm2_t33_650M_UR50D recommended for speed; esm2_t48_15B_UR50D for accuracy)
model, alphabet = esm.pretrained.esm2_t33_650M_UR50D()
model.eval()
batch_converter = alphabet.get_batch_converter()

data = [("protein1", "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQTLGQHDFSAGEGLYTHMKALRPDEDRLSPLHSVYVDQWDWERVMGDGERQFSTLKSTVEAIWAGIKATEAAVSEEFGLAPFLPDQIHFVHSQELLSRYPDLDAKGRERAIAKDLGAVFLVGIGGKLSDGHRHDVRAPDYDDWSTPSELGHAGLNGDILVWNPVLEDAFELSSMGIRVDADTLKHQLALTGDEDRLELEWHQALLRGEMPQTIGGGIGQSRLTMLLLQLPHIGQVQAGVWPAAVRESVPSLL"),]
batch_labels, batch_strs, batch_tokens = batch_converter(data)

with torch.no_grad():
    results = model(batch_tokens, repr_layers=[33], return_contacts=True)

token_representations = results["representations"][33]  # shape: (1, seqlen, 1280)

# Variant effect prediction (masked marginal)
# For each variant, mask the position and measure log-likelihood ratio
```

### OpenFold (trainable AlphaFold)
```bash
# Repo: https://github.com/aqlaboratory/openfold
# Docker: aqlaboratory/openfold:latest
pip install openfold
python run_pretrained_openfold.py \
    --fasta_paths seq.fasta \
    --template_mmcif_dir mmcif_files/ \
    --output_dir output/ \
    --config_preset "model_1_ptm"
```

### DeepChem (ML for molecules)
```python
import deepchem as dc

# Featurize SMILES
featurizer = dc.feat.MolGraphConvFeaturizer(use_edges=True)
X = featurizer.featurize(["CC(=O)OC1=CC=CC=C1C(=O)O"])  # aspirin

# Graph neural network for drug property prediction
dataset = dc.data.NumpyDataset(X, y=np.array([1.0]))  # e.g. activity
splitter = dc.splits.RandomSplitter()
train, valid, test = splitter.train_valid_test_split(dataset)

model = dc.models.AttentiveFPModel(n_tasks=1, batch_size=32, learning_rate=0.001)
model.fit(train, nb_epoch=50)
```

---

## IMMUNOLOGY TOOLS

### pVACtools (neoantigen prediction pipeline)
```bash
# pip install pvactools or conda install -c bioconda pvactools
# Docker: griffithlab/pvactools:latest

# Full neoantigen prediction from VCF
pvacseq run \
    input.vcf \              # annotated VCF (VEP required)
    patient_name \
    HLA-A*02:01,HLA-B*35:01,HLA-C*04:01 \
    NetMHCpan MHCflurry \   # prediction algorithms
    output_dir/ \
    --iedb-install-directory /opt/iedb/ \
    --run-reference-proteome-similarity \
    -e1 8,9,10,11 \         # class I epitope lengths
    --pass-only
```

### MiXCR (TCR/BCR repertoire)
```bash
# Docker: milaboratory/mixcr:latest
# License: free for academic use

# Full pipeline (RNA-seq to clonotypes)
mixcr analyze rnaseq-cdr3 \
    --species hsa \
    --rna \
    R1.fastq.gz R2.fastq.gz \
    output

# Output: output.clonotypes.TCRB.tsv, output.qc.txt
# Key output columns: cloneCount, cloneFraction, aaSeqCDR3, allVHitsWithScore
```

---

## PROTEOMICS TOOLS

### DIA-NN (Data-Independent Acquisition)
```bash
# Download: https://github.com/vdemichev/DiaNN
# License: free

diann \
    --f sample1.raw --f sample2.raw \  # raw files
    --lib library.tsv \                # spectral library (optional)
    --out report.tsv \
    --out-lib refined_library.tsv \
    --fasta proteome.fasta \
    --mass-acc 10 \                    # ppm
    --cut K*,R* \                      # trypsin
    --qvalue 0.01 \
    --threads 16 \
    --smart-profiling
```

### FragPipe (DDA proteomics — MSFragger + TMT/LFQ)
```bash
# Download: https://github.com/Nesvilab/FragPipe
# Java-based, GUI + CLI available

# MSFragger: ultra-fast database search
java -Xmx32G -jar MSFragger.jar fragger.params input1.mzML input2.mzML

# Philosopher (downstream: FDR, quantification)
philosopher workspace --init
philosopher database --reviewed --contam --generate --UniProtID UP000005640
philosopher msfragger fragger.params *.mzML
philosopher peptideprophet --combine --ppm --accmass *.pepXML
philosopher proteinprophet *.pepXML
philosopher filter --sequential --pepxml interact.pep.xml --protxml interact.prot.xml
philosopher report
```

---

## EPIGENOMICS / ATAC-seq

### MACS3 (peak calling)
```bash
conda install -c bioconda macs3
# ATAC-seq narrow peaks
macs3 callpeak -t sample.bam -f BAMPE -g hs -n sample \
    --nomodel --shift -100 --extsize 200 --nolambda --call-summits \
    --outdir results/peaks/

# ChIP-seq (with control)
macs3 callpeak -t chip.bam -c input.bam -f BAM -g hs -n sample \
    -q 0.05 --broad --broad-cutoff 0.1 -B --outdir results/peaks/
```

### TOBIAS (ATAC-seq TF footprinting)
```bash
conda install -c bioconda tobias
# Full footprinting pipeline:
TOBIAS ATACorrect --bam atac.bam --genome genome.fa --peaks peaks.bed \
    --outdir correction/

TOBIAS ScoreBigwig --signal correction/atac_corrected.bw \
    --regions peaks.bed --output scored.bw

TOBIAS BINDetect --signals scored.bw --motifs jaspar.pfm \
    --genome genome.fa --peaks peaks.bed \
    --outdir bindetect/ --cores 16
```

### ArchR (scATAC-seq, R)
```r
library(ArchR)
set.seed(1); addArchRThreads(threads = 16)

# Create project
proj <- ArchRProject(
    ArrowFiles = createArrowFiles(inputFiles = bam_files, sampleNames = sample_names,
        minTSS = 4, minFrags = 1000, addTileMat = TRUE, addGeneScoreMat = TRUE),
    outputDirectory = "ArchRProject", copyArrows = FALSE)

# Dimensionality reduction + clustering
proj <- addIterativeLSI(proj, name = "IterativeLSI")
proj <- addHarmony(proj, reducedDims = "IterativeLSI", groupBy = "Sample")
proj <- addClusters(proj, reducedDims = "Harmony")
proj <- addUMAP(proj, reducedDims = "Harmony")

# Peak calling (per-cluster with MACS2)
proj <- addGroupCoverages(proj, groupBy = "Clusters")
proj <- addReproduciblePeakSet(proj, groupBy = "Clusters", pathToMacs2 = "macs2")

# Motif enrichment
proj <- addMotifAnnotations(proj, name = "Motif", motifSet = "JASPAR2020")
proj <- addDeviationsMatrix(proj, peakAnnotation = "Motif")
```

---

## PATHOLOGY / WHOLE-SLIDE IMAGE TOOLS

### QuPath (open-source WSI analysis)
```groovy
// QuPath script (Groovy)
// Detect tissue regions
createAnnotationsFromPixelClassifier("Tissue", 100, 100)

// Cell detection
runPlugin('qupath.imagej.detect.cells.WatershedCellDetection', [
    'detectionImageBrightfield': 'Hematoxylin OD',
    'requestedPixelSizeMicrons': 0.5,
    'backgroundRadiusMicrons': 8.0,
    'cellExpansionMicrons': 5.0,
    'includeNuclei': true
])

// Classifier (Random Forest or deep learning)
loadClassifier("cell_type_classifier")
classifyDetectionsByCentroid("TumorCells")
```

### TIAToolbox (PyTorch-based)
```python
from tiatoolbox.models import IOSegmentorConfig, SemanticSegmentor
from tiatoolbox.wsicore.wsireader import WSIReader

reader = WSIReader.open("slide.svs")
thumb = reader.slide_thumbnail(resolution=1.25, units="power")

segmentor = SemanticSegmentor(
    pretrained_model="fcn_resnet50_unet-bcss",  # breast cancer semantic seg
    num_loader_workers=4, batch_size=8
)
output = segmentor.predict(
    imgs=["slide.svs"],
    save_dir="output/",
    mode="wsi",
    resolution=0.5, units="mpp"
)
```

---

## CONDA CHANNELS & PACKAGE SOURCES

Priority order for bioinformatics:
1. `bioconda` — bioinformatics tools (STAR, GATK, Salmon, etc.)
2. `conda-forge` — general Python/R packages
3. `defaults` — Anaconda defaults

```bash
# Install mamba for faster dependency solving (strongly recommended)
conda install -n base -c conda-forge mamba

# Create environment from file
mamba env create -f environment.yaml
mamba env update -f environment.yaml --prune

# Quick installs
mamba install -c bioconda -c conda-forge snakemake star samtools gatk4 salmon
```

## KEY BIOCONDUCTOR PACKAGES (R)
```r
BiocManager::install(c(
    "DESeq2",          # differential expression
    "edgeR",           # differential expression (count-based)
    "limma",           # microarray + RNA-seq DE
    "tximeta",         # Salmon/Kallisto import with metadata
    "Seurat",          # single-cell (also CRAN)
    "Signac",          # single-cell ATAC
    "ArchR",           # scATAC-seq
    "clusterProfiler", # pathway enrichment
    "enrichplot",      # pathway visualization
    "ChIPseeker",      # ChIP/ATAC peak annotation
    "DiffBind",        # differential binding
    "minfi",           # methylation arrays
    "methylKit",       # BS-seq methylation
    "DSS",             # DSS differential methylation
    "GenomicRanges",   # genomic interval operations
    "VariantAnnotation",# VCF manipulation
    "BSgenome",        # reference genome sequences
    "Biostrings",      # sequence manipulation
    "MultiAssayExperiment", # multi-omics data container
    "MOFA2",           # multi-omics factor analysis
    "mixOmics",        # DIABLO multi-omics integration
    "PhosR",           # phosphoproteomics
    "survminer",       # survival analysis + visualization
    "ComplexHeatmap",  # publication-quality heatmaps
    "ggplot2",         # (CRAN) visualization
    "pheatmap"         # simple heatmaps
))
```
