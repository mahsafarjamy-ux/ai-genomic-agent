"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import NavBar from "@/components/NavBar";
import { useAuthOptional } from "@/hooks/useAuthOptional";
import { AuthForm } from "@/components/AuthSidePanel";

const BASE = "http://localhost:8000";

/* ── Reference genomes & annotation tools ───────────────────────────────── */
export const COMMON_GENOMES: Array<{
  value: string; label: string; species: string; description: string;
  annotationTool: "VEP" | "ANNOVAR" | "SnpEff"; ensembl?: string;
}> = [
  // Human
  { value: "GRCh38", label: "Human GRCh38 / hg38 ✦", species: "Homo sapiens",   description: "Current human reference. Use for all new studies. GATK bundle + CLINVAR + OMIM available.", annotationTool: "VEP",    ensembl: "GRCh38" },
  { value: "GRCh37", label: "Human GRCh37 / hg19",   species: "Homo sapiens",   description: "Legacy assembly. Only if comparing to pre-2014 data.", annotationTool: "ANNOVAR", ensembl: "GRCh37" },
  // Mouse
  { value: "GRCm39", label: "Mouse GRCm39 / mm39 ✦", species: "Mus musculus",   description: "Current mouse genome. Recommended for all new mouse studies.", annotationTool: "VEP", ensembl: "GRCm39" },
  { value: "GRCm38", label: "Mouse GRCm38 / mm10",   species: "Mus musculus",   description: "Previous mouse assembly — still widely used in older tools.", annotationTool: "VEP", ensembl: "GRCm38" },
  // Rat
  { value: "mRatBN7", label: "Rat mRatBN7.2 / rn7 ✦", species: "Rattus norvegicus", description: "Current rat genome. Improved assembly with PacBio + Hi-C.", annotationTool: "VEP", ensembl: "mRatBN7.2" },
  { value: "Rnor_6",  label: "Rat Rnor_6.0 / rn6",    species: "Rattus norvegicus", description: "Previous rat assembly — use if matching older studies.", annotationTool: "VEP", ensembl: "Rnor_6.0" },
  // Zebrafish
  { value: "GRCz11",  label: "Zebrafish GRCz11 / danRer11 ✦", species: "Danio rerio", description: "Current zebrafish genome. Excellent Ensembl annotation.", annotationTool: "VEP", ensembl: "GRCz11" },
  // Drosophila
  { value: "BDGP6",   label: "Drosophila BDGP6 / dm6 ✦", species: "Drosophila melanogaster", description: "Current D. melanogaster genome. BDGP6.46 in Ensembl Metazoa.", annotationTool: "VEP", ensembl: "BDGP6" },
  // C. elegans
  { value: "WBcel235", label: "C. elegans WBcel235 / ce11 ✦", species: "Caenorhabditis elegans", description: "Current worm genome. WormBase-curated annotation.", annotationTool: "VEP", ensembl: "WBcel235" },
  // Yeast
  { value: "R64",     label: "Yeast R64 / sacCer3 ✦", species: "Saccharomyces cerevisiae", description: "Current S. cerevisiae reference. SGD-curated annotation.", annotationTool: "SnpEff", ensembl: "R64-1-1" },
  // Arabidopsis
  { value: "TAIR10",  label: "Arabidopsis TAIR10 ✦", species: "Arabidopsis thaliana", description: "Standard A. thaliana plant genome. TAIR-curated.", annotationTool: "SnpEff", ensembl: "TAIR10" },
  // Pig
  { value: "Sscrofa11", label: "Pig Sscrofa11.1 / susScr11", species: "Sus scrofa", description: "Current pig genome. Used in porcine disease and agriculture research.", annotationTool: "VEP", ensembl: "Sscrofa11.1" },
  // Cow
  { value: "ARS-UCD1", label: "Cow ARS-UCD1.3 / bosTau9", species: "Bos taurus", description: "Current cattle genome.", annotationTool: "VEP", ensembl: "ARS-UCD1.3" },
  // Chicken
  { value: "bGalGal1", label: "Chicken bGalGal1 / galGal6", species: "Gallus gallus", description: "Current chicken genome from VGP T2T assembly.", annotationTool: "VEP", ensembl: "bGalGal1" },
  // Macaque
  { value: "Mmul_10", label: "Macaque Mmul_10 / rheMac10", species: "Macaca mulatta", description: "Current rhesus macaque genome. Important for NHP research.", annotationTool: "VEP", ensembl: "Mmul_10" },
  // SARS-CoV-2 (viral)
  { value: "MN908947", label: "SARS-CoV-2 MN908947.3 (Wuhan-Hu-1)", species: "Severe acute respiratory syndrome coronavirus 2", description: "Reference Wuhan strain. For viral variant calling and consensus genome.", annotationTool: "SnpEff", ensembl: undefined },
  // Custom
  { value: "custom",  label: "Custom / non-model organism", species: "Other", description: "Provide your own FASTA + GTF. SnpEff builds a database automatically.", annotationTool: "SnpEff", ensembl: undefined },
];

export const ANNOTATION_TOOL_INFO: Record<"VEP" | "ANNOVAR" | "SnpEff", { label: string; color: string; why: string; cmd: string }> = {
  VEP: {
    label: "Ensembl VEP",
    color: "#7c3aed",
    why: "Best choice for Ensembl-supported species. Annotates with SIFT, PolyPhen-2, CADD, ClinVar, gnomAD AF, and 100+ canonical databases.",
    cmd: "vep --input_file variants.vcf --output_file variants.vep.vcf --vcf --cache --species homo_sapiens --assembly GRCh38 --everything",
  },
  ANNOVAR: {
    label: "ANNOVAR",
    color: "#f05808",
    why: "Human-centric. Best for integrating OMIM, ClinVar, COSMIC, dbSNP, ExAC/gnomAD, SIFT, PolyPhen in clinical human genomics workflows.",
    cmd: "table_annovar.pl input.vcf humandb/ -buildver hg38 -out annotated -remove -protocol refGene,clinvar_20221231,gnomad30_genome -operation g,f,f -nastring . -vcfinput",
  },
  SnpEff: {
    label: "SnpEff",
    color: "#16a34a",
    why: "Broadest species coverage — 40,000+ genomes. Can build a database from any FASTA + GFF/GTF in minutes. Best for non-model organisms and custom genomes.",
    cmd: "snpEff -v <genome_build> variants.vcf > variants.snpEff.vcf  # Build: snpEff build -gff3 -v <genome_build>",
  },
};

/* ══════════════════════════════════════════════════════════════════════════
   PIPELINE CATALOG
══════════════════════════════════════════════════════════════════════════ */

/* Auto resource allocation per pipeline — user never touches these */
const PIPELINE_RESOURCES: Record<string, { threads: number; memory_gb: number }> = {
  rnaseq: { threads: 16, memory_gb: 48 }, wgs: { threads: 32, memory_gb: 64 },
  wes: { threads: 16, memory_gb: 32 },    scrnaseq: { threads: 16, memory_gb: 64 },
  methylation: { threads: 32, memory_gb: 64 }, chipseq: { threads: 16, memory_gb: 32 },
  atacseq: { threads: 16, memory_gb: 32 }, proteomics: { threads: 8, memory_gb: 32 },
  microbiome: { threads: 8, memory_gb: 16 }, multiomics: { threads: 16, memory_gb: 32 },
  riboseq: { threads: 16, memory_gb: 32 },  ctdna: { threads: 32, memory_gb: 64 },
  immune_profiling: { threads: 16, memory_gb: 32 }, sv: { threads: 32, memory_gb: 64 },
  cnv: { threads: 16, memory_gb: 32 },      spatial: { threads: 16, memory_gb: 48 },
};


function parseRunLog(log: string) {
  const pMatch = log.match(/pipeline[_\s]?(?:id|type)[:\s=]+([a-z_]+)/i)
    || log.match(/Starting\s+([a-z_]+)\s+pipeline/i)
    || log.match(/pipeline:\s*([a-z_]+)/i);
  const ddMatch = log.match(/data[_\s]?dir[:\s=]+([^\n\r]+)/i);
  const rdMatch = log.match(/results[_\s]?dir[:\s=]+([^\n\r]+)/i);
  const alMatch = log.match(/aligner[:\s=]+([a-z0-9_]+)/i);
  const gmMatch = log.match(/(GRCh38|GRCh37|GRCm39|GRCm38|hg38|hg19|mm10|mm39)/i);
  return {
    pipelineType: pMatch?.[1]?.trim().toLowerCase(),
    dataDir: ddMatch?.[1]?.trim(),
    resultsDir: rdMatch?.[1]?.trim(),
    aligner: alMatch?.[1]?.trim(),
    genome: gmMatch?.[1]?.trim(),
  };
}

const PIPELINE_META: Record<string, { label: string; icon: string; steps: { tool: string; role: string; docker: string }[] }> = {
  rnaseq:      { label: "RNA-seq",                 icon: "🧬", steps: [{ tool: "FastQC",        role: "Quality control",                  docker: "biocontainers/fastqc" }, { tool: "Trim Galore", role: "Adapter trimming", docker: "quay.io/biocontainers/trim-galore" }, { tool: "STAR", role: "Alignment", docker: "quay.io/biocontainers/star" }, { tool: "featureCounts", role: "Quantification", docker: "quay.io/biocontainers/subread" }, { tool: "DESeq2", role: "Differential expression", docker: "bioconductor/bioconductor_docker" }, { tool: "GSEA", role: "Pathway enrichment", docker: "quay.io/biocontainers/bioconductor-clusterprofiler" }] },
  wgs:         { label: "Whole Genome (WGS)",      icon: "🔬", steps: [{ tool: "BWA-MEM2", role: "Alignment", docker: "quay.io/biocontainers/bwa-mem2" }, { tool: "GATK HaplotypeCaller", role: "Germline variants", docker: "broadinstitute/gatk" }, { tool: "Mutect2", role: "Somatic variants", docker: "broadinstitute/gatk" }, { tool: "CNVkit", role: "Copy number", docker: "quay.io/biocontainers/cnvkit" }, { tool: "ANNOVAR", role: "Variant annotation", docker: "quay.io/biocontainers/annovar" }] },
  wes:         { label: "Whole Exome (WES)",       icon: "🎯", steps: [{ tool: "BWA-MEM", role: "Alignment", docker: "quay.io/biocontainers/bwa" }, { tool: "GATK", role: "Variant calling + BQSR", docker: "broadinstitute/gatk" }, { tool: "VEP", role: "Variant annotation", docker: "ensemblorg/ensembl-vep" }, { tool: "OpenCRAVAT", role: "Clinical annotation", docker: "karchinlab/opencravat" }] },
  scrnaseq:    { label: "Single-Cell RNA-seq",     icon: "🔵", steps: [{ tool: "STARsolo", role: "Demux + alignment", docker: "quay.io/biocontainers/star" }, { tool: "Seurat", role: "QC + clustering", docker: "satijalab/seurat" }, { tool: "Leiden", role: "Cell clustering", docker: "quay.io/biocontainers/leidenalg" }, { tool: "SingleR", role: "Cell type annotation", docker: "bioconductor/bioconductor_docker" }, { tool: "scVelo", role: "RNA velocity", docker: "quay.io/biocontainers/scvelo" }] },
  methylation: { label: "DNA Methylation",         icon: "🧪", steps: [{ tool: "Bismark", role: "Bisulfite alignment", docker: "quay.io/biocontainers/bismark" }, { tool: "MethylDackel", role: "CpG extraction", docker: "quay.io/biocontainers/methyldackel" }, { tool: "DSS", role: "Differential methylation", docker: "bioconductor/bioconductor_docker" }] },
  chipseq:     { label: "ChIP-seq / CUT&RUN",      icon: "📍", steps: [{ tool: "Bowtie2", role: "Alignment", docker: "quay.io/biocontainers/bowtie2" }, { tool: "MACS3", role: "Peak calling", docker: "quay.io/biocontainers/macs3" }, { tool: "DiffBind", role: "Differential binding", docker: "bioconductor/bioconductor_docker" }, { tool: "HOMER", role: "Motif discovery", docker: "quay.io/biocontainers/homer" }] },
  atacseq:     { label: "ATAC-seq",                icon: "🌊", steps: [{ tool: "Bowtie2", role: "Alignment", docker: "quay.io/biocontainers/bowtie2" }, { tool: "MACS3", role: "Peak calling", docker: "quay.io/biocontainers/macs3" }, { tool: "TOBIAS", role: "TF footprinting", docker: "quay.io/biocontainers/tobias" }] },
  proteomics:  { label: "Proteomics (MS)",         icon: "🔩", steps: [{ tool: "MaxQuant", role: "Peptide ID + quantification", docker: "quay.io/biocontainers/maxquant" }, { tool: "Perseus", role: "Statistical analysis", docker: "quay.io/biocontainers/perseus" }, { tool: "STRING", role: "Network analysis", docker: "quay.io/biocontainers/stringdb" }] },
  microbiome:  { label: "Microbiome / 16S",        icon: "🦠", steps: [{ tool: "DADA2", role: "ASV denoising", docker: "quay.io/biocontainers/bioconductor-dada2" }, { tool: "QIIME2", role: "Full 16S pipeline", docker: "quay.io/qiime2/core" }, { tool: "phyloseq", role: "Diversity analysis", docker: "bioconductor/bioconductor_docker" }] },
  multiomics:        { label: "Multi-omics Integration",   icon: "🔗", steps: [{ tool: "ComBat-seq", role: "Batch correction", docker: "bioconductor/bioconductor_docker" }, { tool: "MOFA+", role: "Factor analysis", docker: "quay.io/biocontainers/mofapy2" }, { tool: "WNN", role: "Integration", docker: "satijalab/seurat" }] },
  riboseq:           { label: "Ribo-seq",                   icon: "⚙️", steps: [{ tool: "Trim Galore", role: "Adapter trimming", docker: "quay.io/biocontainers/trim-galore" }, { tool: "STAR", role: "Alignment", docker: "quay.io/biocontainers/star" }, { tool: "RiboCode", role: "ORF detection", docker: "quay.io/biocontainers/ribocode" }, { tool: "xtail", role: "Translational efficiency", docker: "bioconductor/bioconductor_docker" }] },
  ctdna:             { label: "Liquid Biopsy / ctDNA",      icon: "💧", steps: [{ tool: "BWA-MEM", role: "Alignment", docker: "quay.io/biocontainers/bwa" }, { tool: "Mutect2 (low-VAF)", role: "Somatic variant calling", docker: "broadinstitute/gatk" }, { tool: "ichorCNA", role: "ctDNA fraction", docker: "quay.io/biocontainers/ichorcna" }, { tool: "CNVkit", role: "Copy number", docker: "quay.io/biocontainers/cnvkit" }] },
  immune_profiling:  { label: "Immune Profiling (TCR/BCR)", icon: "🛡️", steps: [{ tool: "MiXCR", role: "Clonotype assembly", docker: "quay.io/biocontainers/mixcr" }, { tool: "TRUST4", role: "BCR/TCR from RNA-seq", docker: "quay.io/biocontainers/trust4" }, { tool: "OptiType", role: "HLA typing", docker: "quay.io/biocontainers/optitype" }, { tool: "CIBERSORTx", role: "Immune deconvolution", docker: "cibersortx/fractions" }] },
  sv:                { label: "Structural Variants",        icon: "🔀", steps: [{ tool: "Sniffles2", role: "Long-read SV calling", docker: "quay.io/biocontainers/sniffles" }, { tool: "PBSV", role: "PacBio SV", docker: "quay.io/biocontainers/pbsv" }, { tool: "GRIDSS", role: "Short-read SV", docker: "gridss/gridss" }, { tool: "SURVIVOR", role: "SV merging", docker: "quay.io/biocontainers/survivor" }, { tool: "AnnotSV", role: "Annotation", docker: "quay.io/biocontainers/annotsv" }] },
  cnv:               { label: "Copy Number Variants",       icon: "📈", steps: [{ tool: "CNVkit", role: "CNV calling", docker: "quay.io/biocontainers/cnvkit" }, { tool: "GATK GermlineCNVCaller", role: "Germline CNV", docker: "broadinstitute/gatk" }, { tool: "facets", role: "Somatic CNV + purity", docker: "quay.io/biocontainers/facets" }, { tool: "PennCNV", role: "Array CNV", docker: "quay.io/biocontainers/penncnv" }] },
  spatial:           { label: "Spatial Transcriptomics",    icon: "🗺️", steps: [{ tool: "Space Ranger", role: "Visium alignment", docker: "litd/docker-cellranger" }, { tool: "Seurat", role: "Spatial clustering", docker: "satijalab/seurat" }, { tool: "RCTD", role: "Cell-type deconvolution", docker: "bioconductor/bioconductor_docker" }, { tool: "BayesSpace", role: "Spatial domains", docker: "bioconductor/bioconductor_docker" }] },
};

/* ══════════════════════════════════════════════════════════════════════════
   PER-PIPELINE PARAMETER SCHEMAS
   Each param: { key, label, type, default, options?, description, why_it_matters }
══════════════════════════════════════════════════════════════════════════ */

type ParamOption = { value: string; label: string; description: string };
type Param = { key: string; label: string; type: "select" | "number" | "text" | "toggle"; default: string | number | boolean; options?: ParamOption[]; description: string; why_it_matters: string; advanced?: boolean };

const PIPELINE_PARAMS: Record<string, Param[]> = {
  rnaseq: [
    {
      key: "strandedness", label: "Library strandedness", type: "select",
      default: "auto",
      options: [
        { value: "auto",    label: "Auto-detect (recommended)",  description: "The pipeline will figure it out from the first sample. Uses a small read subset — adds ~2 min." },
        { value: "forward", label: "Forward / stranded",         description: "Reads map to the same strand as the gene (typical for dUTP, TruSeq Stranded). Choose if you know your library prep." },
        { value: "reverse", label: "Reverse / reverse-stranded", description: "Reads map to the opposite strand (typical for Illumina TruSeq Stranded mRNA). Check your library prep kit." },
        { value: "unstranded", label: "Unstranded",              description: "No strand information — older or non-stranded protocols (e.g., classic TruSeq). Loses ~20% sensitivity." },
      ],
      description: "How reads relate to the gene strand. Wrong setting causes all counts to be half or zero.",
      why_it_matters: "The most common source of zero-count results in RNA-seq. If unsure, use Auto-detect.",
    },
    {
      key: "aligner", label: "Aligner", type: "select",
      default: "star",
      options: [
        { value: "star",   label: "STAR (recommended)", description: "Gold standard for RNA-seq. Handles splicing perfectly. Requires ~30 GB RAM for human genome." },
        { value: "hisat2", label: "HISAT2",             description: "Lower memory (~8 GB) but slightly less accurate at novel junctions. Good for laptops." },
        { value: "salmon", label: "Salmon (quasi-mapping)", description: "Fastest (~minutes). No alignment — goes straight to counts. Less accurate for novel transcripts." },
      ],
      description: "Algorithm used to map reads to the reference genome.",
      why_it_matters: "STAR is most accurate for splice junctions. If RAM is limited (<16 GB), choose HISAT2.",
    },
    {
      key: "genome", label: "Reference genome", type: "select",
      default: "GRCh38",
      options: [
        { value: "GRCh38", label: "Human GRCh38 / hg38 (recommended)", description: "Latest human genome. Use for all new human studies." },
        { value: "GRCh37", label: "Human GRCh37 / hg19",               description: "Older human genome. Use only if your existing data was aligned to hg19." },
        { value: "GRCm39", label: "Mouse GRCm39 / mm39",               description: "Latest mouse genome." },
        { value: "GRCm38", label: "Mouse GRCm38 / mm10",               description: "Previous mouse reference — still commonly used." },
        { value: "custom", label: "Custom genome (provide path)",       description: "Your own FASTA + GTF. You will be asked for the paths." },
      ],
      description: "The genome your samples will be aligned against.",
      why_it_matters: "Human samples must use a human genome. Mixing genome builds causes alignment failures.",
    },
    {
      key: "star_index", label: "STAR genome index path (optional)", type: "text",
      default: "",
      description: "Full path to a pre-built STAR genome index directory on your machine. Leave empty to run FastQC + trimming only.",
      why_it_matters: "STAR needs a pre-built index to align reads. Without it only QC runs. Build once: STAR --runMode genomeGenerate --genomeDir /path/index --genomeFastaFiles genome.fa --sjdbGTFfile genes.gtf",
    },
    {
      key: "gtf", label: "GTF annotation file path (optional)", type: "text",
      default: "",
      description: "Full path to a GTF gene annotation file (.gtf or .gtf.gz). Required for counting reads per gene after alignment.",
      why_it_matters: "featureCounts needs the GTF to know which genomic coordinates belong to which gene. Download from Ensembl or GENCODE.",
    },
    {
      key: "remove_ribosomal_rna", label: "Remove ribosomal RNA reads", type: "toggle",
      default: false,
      description: "Filter out rRNA before alignment. Only needed if your library prep did NOT include ribo-depletion.",
      why_it_matters: "rRNA can be >90% of reads in total RNA without depletion. Wastes sequencing depth.",
    },
    {
      key: "min_mapping_quality", label: "Minimum mapping quality", type: "number",
      default: 10, advanced: true,
      description: "MAPQ threshold to keep a read in featureCounts. Reads below this are discarded.",
      why_it_matters: "Higher values (20–30) mean stricter multimapper filtering. Default 10 is a safe balance.",
    },
  ],
  wgs: [
    {
      key: "variant_type", label: "Variant calling mode", type: "select",
      default: "germline",
      options: [
        { value: "germline", label: "Germline (inherited variants)", description: "For healthy individuals or patient germline. Uses GATK HaplotypeCaller. Standard for diagnostic panels." },
        { value: "somatic",  label: "Somatic (tumor vs normal)",    description: "For tumor/normal pairs. Uses Mutect2. Identifies acquired cancer mutations. Requires a matched normal sample." },
        { value: "both",     label: "Both germline + somatic",      description: "Run both pipelines. Good for comprehensive cancer genomics." },
      ],
      description: "What type of variants you want to find.",
      why_it_matters: "Germline and somatic pipelines use completely different algorithms and filtering.",
    },
    {
      key: "genome", label: "Reference genome", type: "select",
      default: "GRCh38",
      options: [
        { value: "GRCh38", label: "Human GRCh38 / hg38 (recommended)", description: "Latest human genome. GATK bundle available." },
        { value: "GRCh37", label: "Human GRCh37 / hg19",               description: "Legacy. Use only if comparing to hg19-aligned data." },
        { value: "GRCm39", label: "Mouse GRCm39",                       description: "Latest mouse reference." },
      ],
      description: "Reference genome for alignment and variant calling.",
      why_it_matters: "Variants from GRCh38 and GRCh37 have different coordinates — they cannot be mixed.",
    },
    {
      key: "target_bed", label: "Target regions BED file (WES only)", type: "text",
      default: "",
      description: "Path to the capture kit BED file. Leave empty for whole-genome (no restriction).",
      why_it_matters: "For exome data, restricting to target regions removes noise and speeds up the analysis 10×.",
    },
    {
      key: "min_tumor_vaf", label: "Minimum somatic VAF (%)", type: "number",
      default: 5, advanced: true,
      description: "Minimum variant allele frequency to report a somatic mutation (Mutect2 filter).",
      why_it_matters: "Lower VAF (1–5%) finds more subclonal mutations but also more noise. 5% is a standard threshold.",
    },
  ],
  scrnaseq: [
    {
      key: "chemistry", label: "10x chemistry version", type: "select",
      default: "10x_v3",
      options: [
        { value: "10x_v3",   label: "10x Chromium v3 / v3.1 (most common)", description: "28-bp R1 (16-bp barcode + 12-bp UMI). Used since 2019. Most common." },
        { value: "10x_v2",   label: "10x Chromium v2",                       description: "26-bp R1 (16-bp barcode + 10-bp UMI). Older libraries (2017–2019)." },
        { value: "10x_multiome", label: "10x Multiome (RNA + ATAC)",         description: "Joint RNA + ATAC experiment. Uses a combined reference." },
        { value: "parse",    label: "Parse Biosciences SPLiT-seq",           description: "Combinatorial barcoding — different read structure than 10x." },
        { value: "visium",   label: "10x Visium (spatial)",                  description: "Spatial transcriptomics — uses spot barcodes." },
      ],
      description: "The library chemistry used during sequencing.",
      why_it_matters: "Wrong chemistry causes total failure — the barcode and UMI positions are read-length specific.",
    },
    {
      key: "expected_cells", label: "Expected number of cells", type: "number",
      default: 5000,
      description: "How many cells you loaded into the 10x instrument. Used to set the cell-calling threshold.",
      why_it_matters: "If you set this too high, empty droplets become 'cells'. Too low and real cells are missed. Check your loading sheet.",
    },
    {
      key: "min_genes_per_cell", label: "Minimum genes per cell", type: "number",
      default: 200,
      description: "Cells with fewer detected genes are removed as likely empty droplets.",
      why_it_matters: "Typical cells express 1,000–5,000 genes. Droplets with <200 are usually empty. Increase for strict QC.",
    },
    {
      key: "max_mito_pct", label: "Max mitochondrial gene %", type: "number",
      default: 20,
      description: "Cells where >X% of UMIs come from mitochondrial genes are flagged as dying/damaged cells and removed.",
      why_it_matters: "High mito % = stressed or dead cells. Typical threshold is 15–25%. Strict = 10% for healthy tissue.",
    },
    {
      key: "clustering_resolution", label: "Clustering resolution", type: "number",
      default: 0.5,
      description: "Controls how many clusters are found. Higher = more, smaller clusters. Range 0.2–2.0.",
      why_it_matters: "0.3–0.5 = major cell types. 0.8–1.5 = subtypes and states. Start at 0.5 and re-cluster if needed.",
    },
    {
      key: "genome", label: "Reference genome / transcriptome", type: "select",
      default: "GRCh38",
      options: [
        { value: "GRCh38",   label: "Human GRCh38 (refdata-gex-GRCh38-2020-A)", description: "Standard 10x human reference. Most studies." },
        { value: "GRCm39",   label: "Mouse GRCm39 (refdata-gex-GRCm39-2024-A)", description: "Latest mouse reference from 10x." },
        { value: "custom",   label: "Custom transcriptome (provide path)",       description: "Your own FASTA + GTF. Useful for engineered cell lines or non-model organisms." },
      ],
      description: "Transcriptome reference for read alignment.",
      why_it_matters: "Human cells need a human transcriptome. Cell lines with transgenes need a custom reference.",
    },
  ],
  chipseq: [
    {
      key: "peak_type", label: "Peak type", type: "select",
      default: "narrow",
      options: [
        { value: "narrow", label: "Narrow peaks (TF binding / H3K4me3)", description: "Sharp, focused peaks from transcription factors or active promoter marks. MACS3 default." },
        { value: "broad",  label: "Broad peaks (H3K27me3 / H3K9me3)",   description: "Diffuse marks covering large genomic domains like repressed regions. Use --broad flag." },
        { value: "very_broad", label: "Very broad (H3K36me3)",           description: "Gene-body scale marks. Requires EPIC or SEACR peak callers." },
      ],
      description: "Shape of the expected ChIP-seq peaks — depends on your antibody target.",
      why_it_matters: "Wrong peak type causes MACS3 to miss most peaks. H3K4me3 = narrow. H3K27me3 = broad.",
    },
    {
      key: "has_input_control", label: "Do you have an Input/IgG control?", type: "toggle",
      default: true,
      description: "Input control (sonicated chromatin without antibody) or IgG control sample.",
      why_it_matters: "Without a control, MACS3 cannot distinguish real signal from background. Strongly recommended.",
    },
    {
      key: "genome", label: "Reference genome", type: "select",
      default: "GRCh38",
      options: [
        { value: "GRCh38", label: "Human GRCh38", description: "Use for human samples." },
        { value: "GRCm39", label: "Mouse GRCm39", description: "Use for mouse samples." },
      ],
      description: "Genome to align against.",
      why_it_matters: "Must match the species of your samples.",
    },
  ],
  methylation: [
    {
      key: "protocol", label: "Methylation protocol", type: "select",
      default: "WGBS",
      options: [
        { value: "WGBS",  label: "WGBS (Whole-Genome Bisulfite Sequencing)", description: "Sequencing-based genome-wide methylation. Highest coverage but expensive. Produces FASTQ files." },
        { value: "RRBS",  label: "RRBS (Reduced Representation)",            description: "MspI-digested, covers CpG islands and promoters. Lower cost than WGBS. FASTQ input." },
        { value: "EPIC",  label: "Illumina EPIC / 850k array",               description: "Array-based. Produces IDAT files, not FASTQ. Covers ~850,000 CpG sites." },
        { value: "450k",  label: "Illumina 450k array",                      description: "Older array. IDAT files. Covers ~450,000 CpG sites. Use for legacy data." },
      ],
      description: "The experimental protocol used to measure methylation.",
      why_it_matters: "WGBS/RRBS use Bismark (FASTQ). EPIC/450k use minfi (IDAT). Completely different tools.",
    },
    {
      key: "genome", label: "Reference genome", type: "select",
      default: "GRCh38",
      options: [
        { value: "GRCh38", label: "Human GRCh38", description: "Build bisulfite index from GRCh38." },
        { value: "GRCh37", label: "Human GRCh37 / hg19", description: "Legacy — for older studies." },
        { value: "GRCm39", label: "Mouse GRCm39", description: "Latest mouse reference." },
      ],
      description: "Reference genome for bisulfite alignment.",
      why_it_matters: "The reference must be converted to a bisulfite genome before alignment (Bismark does this automatically).",
    },
    {
      key: "min_coverage", label: "Minimum CpG coverage (reads)", type: "number",
      default: 5,
      description: "Only report CpG sites with at least this many reads covering them.",
      why_it_matters: "CpGs with <5× coverage have unreliable methylation estimates. 5–10× is standard.",
    },
  ],
  microbiome: [
    {
      key: "sequencing_type", label: "Sequencing type", type: "select",
      default: "16S",
      options: [
        { value: "16S",     label: "16S rRNA amplicon sequencing", description: "Amplifies a specific region of the 16S gene. Identifies bacteria. Cannot detect viruses or fungi. Most common." },
        { value: "shotgun", label: "Shotgun metagenomics",        description: "Full genome sequencing of all DNA. Detects bacteria, viruses, fungi. Much higher cost and analysis complexity." },
        { value: "ITS",     label: "ITS amplicon (fungi)",        description: "Internal transcribed spacer — targets fungi specifically. Use for mycobiome studies." },
      ],
      description: "How the microbiome was sequenced.",
      why_it_matters: "16S and shotgun use completely different pipelines and databases.",
    },
    {
      key: "region_16S", label: "16S variable region", type: "select",
      default: "V3V4",
      options: [
        { value: "V3V4", label: "V3-V4 (most common, Illumina)",  description: "~460 bp amplicon. Best balance of length and resolution. Most published studies use V3V4." },
        { value: "V4",   label: "V4 region only",                 description: "~250 bp. Very commonly used with paired 250 bp reads. Good for Illumina MiSeq 2×250." },
        { value: "V1V3", label: "V1-V3",                          description: "Less common. Better discrimination for some Actinobacteria." },
        { value: "V6V8", label: "V6-V8",                          description: "Good for long-read platforms (PacBio, Nanopore)." },
      ],
      description: "Which region of the 16S gene was amplified.",
      why_it_matters: "Different regions have different primer pairs and trim lengths. Affects which taxa are detected.",
    },
    {
      key: "taxonomy_db", label: "Taxonomy database", type: "select",
      default: "silva",
      options: [
        { value: "silva",      label: "SILVA (recommended)",   description: "Comprehensive, regularly updated. 16S, 18S, 23S. Most widely used." },
        { value: "greengenes2", label: "Greengenes2 (2022)",   description: "Updated Greengenes with improved phylogeny. Good for QIIME2." },
        { value: "unite",      label: "UNITE (fungi / ITS)",   description: "ITS sequences for fungi. Use if sequencing_type = ITS." },
      ],
      description: "Reference database for taxonomic classification.",
      why_it_matters: "SILVA is the gold standard for 16S. UNITE is required for ITS fungal studies.",
    },
  ],
  atacseq: [
    {
      key: "genome", label: "Reference genome", type: "select",
      default: "GRCh38",
      options: [
        { value: "GRCh38", label: "Human GRCh38", description: "Standard human genome with blacklist regions included." },
        { value: "GRCm39", label: "Mouse GRCm39", description: "Latest mouse genome." },
      ],
      description: "Reference genome for alignment and peak calling.",
      why_it_matters: "ATAC-seq requires genome-specific blacklists to remove artefact peaks.",
    },
    {
      key: "min_fragment_size", label: "Minimum fragment size (bp)", type: "number",
      default: 100,
      description: "Fragments shorter than this are considered nucleosome-free reads (open chromatin). Shorter = more open chromatin signal.",
      why_it_matters: "Mono-nucleosomal (~200 bp) and sub-nucleosomal (<100 bp) fragments give different biological signals.",
    },
    {
      key: "is_single_cell", label: "Single-cell ATAC (scATAC-seq)?", type: "toggle",
      default: false,
      description: "If yes, uses ArchR or SnapATAC2 for per-cell peak calling instead of bulk MACS3.",
      why_it_matters: "Bulk ATAC and scATAC have completely different bioinformatics. Select correctly.",
    },
  ],
  proteomics: [
    {
      key: "quantification_method", label: "Quantification method", type: "select",
      default: "LFQ",
      options: [
        { value: "LFQ",  label: "Label-Free Quantification (LFQ)", description: "No chemical labeling. Compare samples by intensity. Most flexible." },
        { value: "TMT",  label: "TMT / iTRAQ labeling",            description: "Chemical isotope labels. More samples per run, less missing values. More expensive prep." },
        { value: "SILAC", label: "SILAC (heavy isotopes)",         description: "Metabolic labeling. Very precise. Requires specific cell culture conditions." },
      ],
      description: "How protein abundance is measured.",
      why_it_matters: "MaxQuant needs to know the labeling scheme to find the right mass shifts.",
    },
    {
      key: "species_fasta", label: "Protein FASTA database", type: "select",
      default: "human_uniprot",
      options: [
        { value: "human_uniprot",  label: "Human UniProt/SwissProt (recommended)", description: "Curated human proteome. ~20,000 proteins." },
        { value: "mouse_uniprot",  label: "Mouse UniProt",                         description: "Curated mouse proteome." },
        { value: "custom",         label: "Custom FASTA (provide path)",            description: "Your own protein database — useful for pathogen or non-model organisms." },
      ],
      description: "Protein sequence database for peptide identification.",
      why_it_matters: "Must match your sample species. Human peptides cannot be identified against a mouse database.",
    },
    {
      key: "fdr_threshold", label: "FDR threshold", type: "number",
      default: 0.01,
      description: "False discovery rate for peptide and protein identification. 0.01 = 1% FDR (standard).",
      why_it_matters: "Higher FDR (0.05) finds more proteins but with more false positives. 1% is the field standard.",
    },
  ],
  wes: [],   // inherits wgs params
  multiomics: [],
};
// WES shares WGS params
PIPELINE_PARAMS["wes"] = PIPELINE_PARAMS["wgs"];

/* ══════════════════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════════════════ */

interface DetectedSample {
  sample: string;
  fastq_1: string;
  fastq_2: string;
  paired: boolean;
  warning: string;
}

interface ScanResult {
  samples: DetectedSample[];
  sample_count: number;
  paired_count: number;
  samplesheet_csv: string;
  pipeline_type: string;
  warnings: string[];
  files_scanned: number;
}

interface FixProposal {
  severity: string;
  root_cause: string;
  explanation: string;
  proposed_fix: {
    type: string;
    description: string;
    safe_to_autofix: boolean;
    requires_human_approval: boolean;
  };
  step: string;
  status: string;
}

/* ══════════════════════════════════════════════════════════════════════════
   SMALL COMPONENTS
══════════════════════════════════════════════════════════════════════════ */

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 12,
        background: done ? "var(--flame)" : active ? "var(--flame)" : "var(--border)",
        color: (done || active) ? "#fff" : "var(--muted)",
        transition: "all 0.2s",
      }}>
        {done ? "✓" : n}
      </div>
      <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? "var(--text)" : "var(--muted)" }}>
        {label}
      </span>
    </div>
  );
}

function ParamCard({ param, value, onChange }: { param: Param; value: string | number | boolean; onChange: (v: string | number | boolean) => void }) {
  const [open, setOpen] = useState(false);
  const selectedOption = param.type === "select"
    ? (param.options?.find(o => o.value === value) || param.options?.[0])
    : null;

  return (
    <div style={{
      borderRadius: 16, border: "1px solid var(--border)",
      background: "var(--surface)", overflow: "hidden",
      marginBottom: "0.75rem",
    }}>
      <div style={{ padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>
              {param.label}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
              {param.description}
            </div>
          </div>

          {/* Control */}
          <div style={{ flexShrink: 0, minWidth: 180 }}>
            {param.type === "select" && (
              <select
                value={value as string}
                onChange={e => onChange(e.target.value)}
                style={{
                  width: "100%", borderRadius: 8, border: "1px solid var(--border)",
                  padding: "6px 10px", fontSize: 13, background: "var(--canvas)",
                  color: "var(--text)", cursor: "pointer",
                }}>
                {param.options?.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
            {param.type === "number" && (
              <input type="number" value={value as number}
                onChange={e => onChange(parseFloat(e.target.value) || param.default as number)}
                style={{
                  width: "100%", borderRadius: 8, border: "1px solid var(--border)",
                  padding: "6px 10px", fontSize: 13, background: "var(--canvas)", color: "var(--text)",
                }} />
            )}
            {param.type === "text" && (
              <input type="text" value={value as string}
                onChange={e => onChange(e.target.value)}
                placeholder="(optional)"
                style={{
                  width: "100%", borderRadius: 8, border: "1px solid var(--border)",
                  padding: "6px 10px", fontSize: 13, background: "var(--canvas)", color: "var(--text)",
                  fontFamily: "monospace",
                }} />
            )}
            {param.type === "toggle" && (
              <button
                onClick={() => onChange(!value)}
                style={{
                  padding: "6px 14px", borderRadius: 8, border: "none",
                  background: value ? "var(--flame)" : "var(--border)",
                  color: value ? "#fff" : "var(--muted)", cursor: "pointer",
                  fontWeight: 600, fontSize: 13, transition: "all 0.18s",
                }}>
                {value ? "Enabled" : "Disabled"}
              </button>
            )}
          </div>
        </div>

        {/* Why it matters */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            marginTop: 8, fontSize: 11, color: "var(--flame)", background: "none",
            border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4,
          }}>
          💡 Why does this matter? {open ? "▲" : "▼"}
        </button>
        {open && (
          <div style={{
            marginTop: 8, padding: "0.6rem 0.85rem", borderRadius: 8,
            background: "#fff8f3", border: "1px solid #ffd4bc",
            fontSize: 12, color: "#5a3a00", lineHeight: 1.6,
          }}>
            {param.why_it_matters}
            {selectedOption && param.type === "select" && (
              <div style={{ marginTop: 6, color: "#7a4e00" }}>
                <strong>Your selection:</strong> {selectedOption.description}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */

export default function LaunchPage() {
  const { user, loading, signOut, refresh } = useAuthOptional();

  // ── Wizard state ──────────────────────────────────────────────────────
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [pipelineType, setPipelineType] = useState("rnaseq");
  const [dataDir, setDataDir]   = useState("");
  const [resultsDir, setResultsDir] = useState("./results");
  const [customRequirements, setCustomRequirements] = useState("");

  // Start-mode: new analysis or repeat previous run
  type StartMode = "new" | "repeat";
  const [startMode, setStartMode] = useState<StartMode>("new");
  const [repeatLog, setRepeatLog] = useState("");
  const [repeatParsed, setRepeatParsed] = useState<ReturnType<typeof parseRunLog> | null>(null);

  // ── Step 1: Scan ──────────────────────────────────────────────────────
  const [scanning, setScanning]     = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError]   = useState("");

  // ── Step 2: Samplesheet ───────────────────────────────────────────────
  const [editedSamples, setEditedSamples] = useState<DetectedSample[]>([]);
  const [csvPreview, setCsvPreview]   = useState("");

  // ── Step 3: Parameters ────────────────────────────────────────────────
  const [paramValues, setParamValues] = useState<Record<string, string | number | boolean>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Step 4: Run + Monitor ─────────────────────────────────────────────
  const [jobId, setJobId]         = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<"running" | "done" | "error" | "awaiting_fix">("running");
  const [logs, setLogs]           = useState<string[]>([]);
  const [progress, setProgress]   = useState(0);
  const [currentStep, setCurrentStep] = useState("Initializing…");
  const [fixProposal, setFixProposal] = useState<FixProposal | null>(null);
  const [approvingFix, setApprovingFix] = useState(false);
  const esRef  = useRef<EventSource | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Read ?type= from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("type");
    if (t && PIPELINE_META[t]) setPipelineType(t);
  }, []);

  // Init default param values when pipeline changes
  useEffect(() => {
    const params = PIPELINE_PARAMS[pipelineType] || [];
    const defaults: Record<string, string | number | boolean> = {};
    params.forEach(p => { defaults[p.key] = p.default; });
    setParamValues(defaults);
  }, [pipelineType]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => () => { esRef.current?.close(); }, []);

  const meta = PIPELINE_META[pipelineType] || PIPELINE_META["rnaseq"];
  const params = (PIPELINE_PARAMS[pipelineType] || []).filter(p => showAdvanced ? true : !p.advanced);

  // ── Step 1: Scan directory ─────────────────────────────────────────────
  async function scanDirectory() {
    if (!dataDir.trim()) return;
    setScanning(true);
    setScanError("");
    setScanResult(null);
    try {
      const res = await fetch(`${BASE}/api/samplesheet/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data_dir: dataDir.trim(),
          pipeline_type: pipelineType,
          strandedness: (paramValues["strandedness"] as string) || "auto",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Scan failed" }));
        throw new Error(err.detail);
      }
      const data: ScanResult = await res.json();
      setScanResult(data);
      setEditedSamples(data.samples);
      setCsvPreview(data.samplesheet_csv);
    } catch (e: unknown) {
      setScanError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  // ── Step 2: Update CSV when samples are edited ─────────────────────────
  const updateCsv = useCallback(async (samples: DetectedSample[]) => {
    try {
      const res = await fetch(`${BASE}/api/samplesheet/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_type: pipelineType, rows: samples }),
      });
      if (res.ok) {
        const d = await res.json();
        setCsvPreview(d.samplesheet_csv);
      }
    } catch { /* non-critical */ }
  }, [pipelineType]);

  function updateSample(idx: number, field: keyof DetectedSample, val: string) {
    const updated = editedSamples.map((s, i) => i === idx ? { ...s, [field]: val } : s);
    setEditedSamples(updated);
    updateCsv(updated);
  }

  function removeSample(idx: number) {
    const updated = editedSamples.filter((_, i) => i !== idx);
    setEditedSamples(updated);
    updateCsv(updated);
  }

  // ── Cancel job ────────────────────────────────────────────────────────
  async function cancelJob() {
    if (!jobId) return;
    esRef.current?.close();
    try {
      await fetch(`${BASE}/api/jobs/${jobId}/cancel`, { method: "DELETE" });
    } catch { /* best effort */ }
    setJobStatus("error");
    setLogs(prev => [...prev, "Job cancelled by user."]);
  }

  // ── Step 4: Launch + stream ────────────────────────────────────────────
  async function launchPipeline() {
    setWizardStep(4);
    setLogs([]);
    setProgress(0);
    setCurrentStep("Submitting job…");
    setJobStatus("running");
    setFixProposal(null);

    const resources = PIPELINE_RESOURCES[pipelineType] ?? { threads: 16, memory_gb: 32 };
    const configOverrides: Record<string, unknown> = {
      samplesheet_csv: csvPreview,
      ...paramValues,
      ...(customRequirements.trim() ? { custom_requirements: customRequirements.trim() } : {}),
    };

    try {
      const res = await fetch(`${BASE}/api/jobs/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline_id: pipelineType,
          data_dir: dataDir.trim(),
          results_dir: resultsDir.trim() || "./results",
          threads: resources.threads,
          memory_gb: resources.memory_gb,
          samples: editedSamples.map(s => s.sample),
          config_overrides: configOverrides,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Launch failed" }));
        throw new Error(err.detail || "Launch failed");
      }
      const job = await res.json();
      setJobId(job.job_id);
      streamLogs(job.job_id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Launch failed";
      setLogs([`ERROR: ${msg}`]);
      setJobStatus("error");
    }
  }

  function streamLogs(id: string) {
    esRef.current?.close();
    const es = new EventSource(`${BASE}/api/jobs/${id}/logs`);
    esRef.current = es;

    es.onmessage = (e) => {
      const line: string = e.data;
      setLogs(prev => [...prev, line]);

      // Progress from "X of Y steps" pattern
      const pct = line.match(/(\d+) of (\d+) steps/);
      if (pct) setProgress(Math.round(100 * +pct[1] / +pct[2]));

      // Current rule name
      const ruleMatch = line.match(/^rule (\w+):/);
      if (ruleMatch) setCurrentStep(ruleMatch[1].replace(/_/g, " "));

      // Completion indicator
      if (line.includes("Pipeline completed successfully") || line.includes("100 of 100")) {
        setProgress(100);
        setJobStatus("done");
        es.close();
      }
    };

    es.onerror = () => {
      es.close();
      pollJobStatus(id);
    };
  }

  async function pollJobStatus(id: string) {
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 4000));
      try {
        const r = await fetch(`${BASE}/api/jobs/${id}`);
        const j = await r.json();
        setProgress(j.progress_percent ?? progress);
        if (j.current_step) setCurrentStep(j.current_step);

        if (j.status === "completed") { setJobStatus("done"); setProgress(100); return; }
        if (j.status === "failed")    { setJobStatus("error"); return; }

        if (j.status === "awaiting_approval") {
          // Fetch the fix proposal
          const fr = await fetch(`${BASE}/api/jobs/${id}/fix-proposal`);
          if (fr.ok) {
            const fp: FixProposal = await fr.json();
            setFixProposal(fp);
            setJobStatus("awaiting_fix");
          }
          return;
        }
      } catch { /* network hiccup — keep polling */ }
    }
  }

  async function approveFix(approved: boolean) {
    if (!jobId) return;
    setApprovingFix(true);
    try {
      await fetch(`${BASE}/api/jobs/${jobId}/approve-fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, comment: "" }),
      });
      setFixProposal(null);
      if (approved) {
        setJobStatus("running");
        setLogs(prev => [...prev, "✓ Fix approved — retrying pipeline…"]);
        streamLogs(jobId);
      } else {
        setJobStatus("error");
        setLogs(prev => [...prev, "Fix rejected by user."]);
      }
    } catch (e) {
      setLogs(prev => [...prev, `Approval request failed: ${e}`]);
    } finally {
      setApprovingFix(false);
    }
  }

  // Don't redirect — show sign-in inline at Step 1 instead

  /* ════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)", color: "var(--text)" }}>
      <NavBar active="/launch" user={user} onSignOut={signOut} />

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Header row ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: 36 }}>{meta.icon}</span>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>
              Launch Pipeline
            </h1>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(PIPELINE_META).map(([k, v]) => (
                <button key={k} onClick={() => { setPipelineType(k); setWizardStep(1); setScanResult(null); }}
                  style={{
                    fontSize: 11, padding: "3px 10px", borderRadius: 20, cursor: "pointer",
                    border: "none",
                    background: pipelineType === k ? "var(--flame)" : "var(--border)",
                    color: pipelineType === k ? "#fff" : "var(--muted)",
                    fontWeight: pipelineType === k ? 700 : 400,
                  }}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Wizard progress ── */}
        <div style={{
          display: "flex", gap: "2rem", marginBottom: "2rem", flexWrap: "wrap",
          padding: "1rem 1.5rem", borderRadius: 16,
          background: "var(--surface)", border: "1px solid var(--border)",
        }}>
          {[
            [1, "Scan samples"],
            [2, "Review samplesheet"],
            [3, "Set parameters"],
            [4, "Run & monitor"],
          ].map(([n, label]) => (
            <StepDot key={n} n={n as number} label={label as string}
              active={wizardStep === n}
              done={wizardStep > (n as number)} />
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            STEP 1 — SCAN
        ══════════════════════════════════════════════════════════════ */}
        {wizardStep === 1 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

            {/* Left: sign-in gate OR scan form */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

              {/* ── NOT SIGNED IN: show auth form ── */}
              {!loading && !user ? (
                <>
                  <h2 style={{ fontWeight: 800, fontSize: 17, color: "var(--text)" }}>
                    Point to your data folder
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
                    Sign in (or create a free account) to run analyses. All computation stays on your machine — we never see your data.
                  </p>
                  <AuthForm
                    onSuccess={refresh}
                    benefits={[
                      "Run any of 15 genomics pipelines locally",
                      "AI monitors runs & fixes errors automatically",
                      "Save job history and download results",
                      "All genomic data stays on your machine",
                    ]}
                  />
                </>
              ) : loading ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                  Loading…
                </div>
              ) : (
                /* ── SIGNED IN: normal scan form ── */
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #86efac" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--flame)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                      {user!.name[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#15803d" }}>{user!.name}</div>
                      <div style={{ fontSize: 11, color: "#166534" }}>{user!.email}</div>
                    </div>
                    <button onClick={signOut} style={{ fontSize: 11, color: "#166534", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Sign out</button>
                  </div>

                  {/* ── Start mode selector ── */}
                  <div style={{ display: "flex", gap: 6, padding: "4px", borderRadius: 12, background: "var(--canvas)", border: "1px solid var(--border)" }}>
                    {([["new","New analysis"],["repeat","Repeat run"]] as [StartMode,string][]).map(([mode, label]) => (
                      <button key={mode} onClick={() => setStartMode(mode)}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12, fontWeight: startMode === mode ? 700 : 500, transition: "all 0.15s",
                          background: startMode === mode ? "var(--flame)" : "transparent",
                          color: startMode === mode ? "#fff" : "var(--muted)" }}>
                        {mode === "new" ? "🆕" : "🔁"} {label}
                      </button>
                    ))}
                  </div>

                  {/* ── NEW ANALYSIS MODE ── */}
                  {startMode === "new" && (<>
                    <h2 style={{ fontWeight: 800, fontSize: 17, color: "var(--text)" }}>Point to your data folder</h2>
                    <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
                      Paste the full path to the folder containing your FASTQ files. Subfolders per sample are fine.
                    </p>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>Data directory</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input value={dataDir} onChange={e => setDataDir(e.target.value)}
                          placeholder="/Users/you/data/rnaseq_samples"
                          onKeyDown={e => e.key === "Enter" && scanDirectory()}
                          style={{ flex: 1, borderRadius: 10, border: "1px solid var(--border)", padding: "10px 14px", fontSize: 13, background: "var(--canvas)", color: "var(--text)", fontFamily: "monospace" }} />
                        <a href="/connect" style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", padding: "10px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", color: "var(--muted)", background: "var(--canvas)", textDecoration: "none" }} title="Connect to HPC, S3, or remote system">
                          🔗 Connect system
                        </a>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>Results directory</label>
                      <input value={resultsDir} onChange={e => setResultsDir(e.target.value)}
                        style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)", padding: "10px 14px", fontSize: 13, background: "var(--canvas)", color: "var(--text)", fontFamily: "monospace" }} />
                    </div>
                    <div style={{ padding: "8px 12px", borderRadius: 10, background: "#f3fff0", border: "1px solid #90d080", fontSize: 12, color: "#15803d" }}>
                      ⚡ Resources auto-selected: {(PIPELINE_RESOURCES[pipelineType] ?? { threads: 16, memory_gb: 32 }).threads} CPU threads · {(PIPELINE_RESOURCES[pipelineType] ?? { threads: 16, memory_gb: 32 }).memory_gb} GB RAM
                    </div>
                    <button onClick={scanDirectory} disabled={!dataDir.trim() || scanning}
                      style={{ padding: "12px 0", borderRadius: 12, border: "none", background: "var(--flame)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: (!dataDir.trim() || scanning) ? 0.5 : 1 }}>
                      {scanning ? "Scanning…" : "🔍 Scan for samples"}
                    </button>
                  </>)}

                  {/* ── REPEAT PREVIOUS RUN MODE ── */}
                  {startMode === "repeat" && (<>
                    <h2 style={{ fontWeight: 800, fontSize: 17, color: "var(--text)" }}>Repeat a previous run</h2>
                    <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
                      Paste your previous run log or job output. We extract the pipeline type, data paths and key parameters automatically.
                    </p>
                    <textarea value={repeatLog} onChange={e => setRepeatLog(e.target.value)}
                      rows={6} placeholder="Paste log output or config here…&#10;&#10;e.g.:&#10;Starting rnaseq pipeline&#10;data_dir: /Users/me/data&#10;aligner: star&#10;genome: GRCh38"
                      style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)", padding: "10px 14px", fontSize: 12, background: "var(--canvas)", color: "var(--text)", fontFamily: "monospace", resize: "vertical", lineHeight: 1.7 }} />
                    <button onClick={() => { const p = parseRunLog(repeatLog); setRepeatParsed(p); if (p.pipelineType && PIPELINE_META[p.pipelineType]) setPipelineType(p.pipelineType); if (p.dataDir) setDataDir(p.dataDir); if (p.resultsDir) setResultsDir(p.resultsDir); }}
                      disabled={!repeatLog.trim()}
                      style={{ padding: "10px 0", borderRadius: 12, border: "none", background: "var(--flame)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: !repeatLog.trim() ? 0.5 : 1 }}>
                      🔁 Load settings from log
                    </button>
                    {repeatParsed && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #86efac" }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}>Detected settings:</p>
                        {[
                          ["Pipeline", repeatParsed.pipelineType ?? "—"],
                          ["Data dir", repeatParsed.dataDir ?? "—"],
                          ["Results dir", repeatParsed.resultsDir ?? "—"],
                          ["Aligner", repeatParsed.aligner ?? "—"],
                          ["Genome", repeatParsed.genome ?? "—"],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: "flex", gap: 8, fontSize: 12 }}>
                            <span style={{ color: "var(--muted)", minWidth: 80 }}>{k}:</span>
                            <span style={{ color: "var(--text)", fontFamily: "monospace" }}>{v}</span>
                          </div>
                        ))}
                        <button onClick={() => setStartMode("new")}
                          style={{ marginTop: 6, padding: "8px 0", borderRadius: 9, border: "none", background: "#15803d", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                          Continue with these settings →
                        </button>
                      </div>
                    )}
                  </>)}

              {scanError && (
                <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: "0.75rem 1rem", fontSize: 13, color: "#dc2626" }}>
                  ⚠ {scanError}
                </div>
              )}
                </>
              )}
            </div>

            {/* Right: scan results (or sign-in teaser when not authed) */}
            <div>
              {!scanResult && !scanning && !user && !loading && (
                <div style={{
                  height: "100%", minHeight: 260, borderRadius: 16,
                  border: "1px solid var(--border)", background: "var(--surface)",
                  padding: "1.5rem", display: "flex", flexDirection: "column", gap: 14,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>What you get after signing in</div>
                  {[
                    ["🔍", "Auto-detect samples", "Paste a folder path — AI finds and pairs all your FASTQ files instantly"],
                    ["🧠", "AI error recovery",   "If the pipeline fails, Claude diagnoses it and proposes a fix you approve with one click"],
                    ["📊", "Real results",         "FastQC, alignment, gene counts, MultiQC report — all runs locally via Docker"],
                    ["💾", "Job history",          "Every run is saved so you can revisit results and re-run with different params"],
                  ].map(([icon, title, desc]) => (
                    <div key={title as string} style={{ display: "flex", gap: 10 }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{title}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!scanResult && !scanning && !!user && (
                <div style={{
                  height: "100%", minHeight: 260, borderRadius: 16,
                  border: "2px dashed var(--border)", display: "flex",
                  flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  <div style={{ fontSize: 40 }}>📁</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
                    Detected samples will appear here
                  </div>
                </div>
              )}
              {scanning && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
                  <div style={{ fontSize: 40, animation: "spin 1s linear infinite" }}>🔍</div>
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>Scanning directory…</div>
                </div>
              )}
              {scanResult && !scanning && (
                <div>
                  <div style={{
                    borderRadius: 12, padding: "0.85rem 1rem", marginBottom: "0.75rem",
                    background: "#f0fdf4", border: "1px solid #86efac",
                    display: "flex", gap: "1.5rem",
                  }}>
                    <div><div style={{ fontSize: 22, fontWeight: 800, color: "#15803d" }}>{scanResult.sample_count}</div><div style={{ fontSize: 11, color: "#15803d" }}>samples found</div></div>
                    <div><div style={{ fontSize: 22, fontWeight: 800, color: "#15803d" }}>{scanResult.paired_count}</div><div style={{ fontSize: 11, color: "#15803d" }}>paired-end</div></div>
                    <div><div style={{ fontSize: 22, fontWeight: 800, color: "#15803d" }}>{scanResult.files_scanned}</div><div style={{ fontSize: 11, color: "#15803d" }}>FASTQ files</div></div>
                  </div>

                  {scanResult.warnings.map((w, i) => (
                    <div key={i} style={{ background: "#fff8e6", border: "1px solid #f5c842", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#9a6e00", marginBottom: 6 }}>
                      ⚠ {w}
                    </div>
                  ))}

                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {scanResult.samples.slice(0, 10).map((s, i) => (
                      <div key={i} style={{
                        padding: "6px 10px", borderBottom: "1px solid var(--border)",
                        display: "flex", alignItems: "center", gap: 8, fontSize: 12,
                      }}>
                        <span style={{ fontSize: 16 }}>{s.paired ? "🟢" : "🟡"}</span>
                        <span style={{ fontWeight: 600, color: "var(--text)", flex: 1 }}>{s.sample}</span>
                        {s.warning && <span style={{ color: "#9a6e00", fontSize: 10 }}>{s.warning}</span>}
                      </div>
                    ))}
                    {scanResult.sample_count > 10 && (
                      <div style={{ padding: "6px 10px", fontSize: 12, color: "var(--dim)" }}>
                        + {scanResult.sample_count - 10} more samples…
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setWizardStep(2)}
                    style={{
                      marginTop: "1rem", width: "100%", padding: "11px", borderRadius: 12,
                      border: "none", background: "var(--flame)", color: "#fff",
                      fontWeight: 700, fontSize: 14, cursor: "pointer",
                    }}>
                    Review samplesheet →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            STEP 2 — REVIEW SAMPLESHEET
        ══════════════════════════════════════════════════════════════ */}
        {wizardStep === 2 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: 17, color: "var(--text)", marginBottom: 4 }}>
                  Review & edit the samplesheet
                </h2>
                <p style={{ fontSize: 13, color: "var(--muted)" }}>
                  The pipeline uses this table to know which files belong to which sample. Edit any field — click a cell to change it.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setWizardStep(1)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", fontSize: 12 }}>← Back</button>
                <button
                  onClick={() => {
                    const blob = new Blob([csvPreview], { type: "text/csv" });
                    const url  = URL.createObjectURL(blob);
                    const a    = document.createElement("a");
                    a.href = url; a.download = `samplesheet_${pipelineType}.csv`; a.click();
                  }}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer", fontSize: 12 }}>
                  ⬇ Download CSV
                </button>
                <button onClick={() => setWizardStep(3)}
                  style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--flame)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                  Set parameters →
                </button>
              </div>
            </div>

            {/* Editable table */}
            <div style={{ borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden", marginBottom: "1.25rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--canvas)" }}>
                    {["Sample name", "FASTQ R1", "FASTQ R2", "Status", ""].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {editedSamples.map((s, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 12px" }}>
                        <input value={s.sample} onChange={e => updateSample(i, "sample", e.target.value)}
                          style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 12, background: "var(--canvas)", color: "var(--text)", fontFamily: "monospace" }} />
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <input value={s.fastq_1} onChange={e => updateSample(i, "fastq_1", e.target.value)}
                          style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 11, background: "var(--canvas)", color: "var(--text)", fontFamily: "monospace" }} />
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <input value={s.fastq_2} onChange={e => updateSample(i, "fastq_2", e.target.value)}
                          placeholder="(single-end)"
                          style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 11, background: "var(--canvas)", color: "var(--muted)", fontFamily: "monospace" }} />
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        {s.warning
                          ? <span style={{ fontSize: 11, color: "#9a6e00", background: "#fff8e6", padding: "2px 7px", borderRadius: 10 }}>⚠ {s.warning}</span>
                          : <span style={{ fontSize: 11, color: "#15803d" }}>✓ OK</span>}
                      </td>
                      <td style={{ padding: "8px 8px", textAlign: "center" }}>
                        <button onClick={() => removeSample(i)}
                          style={{ fontSize: 16, background: "none", border: "none", cursor: "pointer", color: "var(--dim)", lineHeight: 1 }}>
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CSV preview */}
            <details>
              <summary style={{ fontSize: 12, color: "var(--muted)", cursor: "pointer", padding: "6px 0" }}>
                Preview raw CSV
              </summary>
              <pre style={{ marginTop: 8, fontSize: 11, padding: "0.85rem 1rem", borderRadius: 10, background: "#1c1a16", color: "#c8c4bc", overflowX: "auto", lineHeight: 1.7 }}>
                {csvPreview}
              </pre>
            </details>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            STEP 3 — PARAMETERS
        ══════════════════════════════════════════════════════════════ */}
        {wizardStep === 3 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: 17, color: "var(--text)", marginBottom: 4 }}>
                  Configure pipeline parameters
                </h2>
                <p style={{ fontSize: 13, color: "var(--muted)" }}>
                  Defaults are good for most experiments. Click "Why does this matter?" on any parameter for a plain-language explanation.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setWizardStep(2)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", fontSize: 12 }}>← Back</button>
                <button onClick={launchPipeline}
                  style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: "var(--flame)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 14px rgba(240,88,8,0.25)" }}>
                  🚀 Launch Pipeline
                </button>
              </div>
            </div>

            {params.length === 0 ? (
              <div style={{ borderRadius: 16, border: "2px dashed var(--border)", padding: "2.5rem", textAlign: "center", color: "var(--muted)" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>⚙️</div>
                No additional parameters needed — defaults are sufficient.<br />
                <textarea value={customRequirements} onChange={e => setCustomRequirements(e.target.value)} rows={2}
                  placeholder="Any custom requirements? (optional) e.g. use tool version X, skip step Y…"
                  style={{ marginTop: "1rem", width: "100%", maxWidth: 420, borderRadius: 8, border: "1px solid var(--border)", padding: "8px 12px", fontSize: 12, background: "var(--canvas)", color: "var(--text)", resize: "none", fontFamily: "inherit" }} />
                <br />
                <button onClick={launchPipeline} style={{ marginTop: "1rem", padding: "12px 32px", borderRadius: 12, border: "none", background: "var(--flame)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                  🚀 Launch Pipeline
                </button>
              </div>
            ) : (
              <>
                {params.map(p => (
                  <ParamCard key={p.key} param={p}
                    value={paramValues[p.key] ?? p.default}
                    onChange={v => setParamValues(prev => ({ ...prev, [p.key]: v }))} />
                ))}

                {(PIPELINE_PARAMS[pipelineType] || []).some(p => p.advanced) && (
                  <button onClick={() => setShowAdvanced(a => !a)}
                    style={{ fontSize: 12, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", marginBottom: "1rem" }}>
                    {showAdvanced ? "▲ Hide" : "▼ Show"} advanced parameters
                  </button>
                )}

                {/* Custom requirements bar */}
                <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "1rem 1.25rem", marginTop: "0.5rem" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                    Custom requirements <span style={{ fontWeight: 400 }}>(optional)</span>
                  </label>
                  <textarea
                    value={customRequirements}
                    onChange={e => setCustomRequirements(e.target.value)}
                    rows={3}
                    placeholder="Describe any specific needs, e.g.:&#10;• Use STAR 2.7.11 instead of the default&#10;• Increase sensitivity for low-input libraries&#10;• Skip deduplication (amplicon data)&#10;• Prioritize speed — use more CPU"
                    style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", padding: "8px 12px", fontSize: 12, background: "var(--canvas)", color: "var(--text)", resize: "vertical", lineHeight: 1.65, fontFamily: "inherit" }}
                  />
                  <p style={{ fontSize: 11, color: "var(--dim)", marginTop: 5 }}>
                    These notes are forwarded to the AI pipeline manager, which will adjust tool flags and versions accordingly.
                  </p>
                </div>

                <div style={{ paddingTop: "1rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={launchPipeline}
                    style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "var(--flame)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 14px rgba(240,88,8,0.25)" }}>
                    🚀 Launch {meta.label} Pipeline
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            STEP 4 — RUN + MONITOR
        ══════════════════════════════════════════════════════════════ */}
        {wizardStep === 4 && (
          <div>
            {/* Status bar */}
            <div style={{
              borderRadius: 16, padding: "1.25rem 1.5rem", marginBottom: "1rem",
              background: jobStatus === "done" ? "#f0fdf4" :
                         jobStatus === "error" ? "#fff5f5" :
                         jobStatus === "awaiting_fix" ? "#fff8e6" : "var(--surface)",
              border: `1px solid ${jobStatus === "done" ? "#86efac" : jobStatus === "error" ? "#fecaca" : jobStatus === "awaiting_fix" ? "#f5c842" : "var(--border)"}`,
              display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap",
            }}>
              <div style={{ fontSize: 28 }}>
                {jobStatus === "done" ? "✅" : jobStatus === "error" ? "❌" : jobStatus === "awaiting_fix" ? "🔧" : "⚙️"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
                  {jobStatus === "done" ? "Pipeline completed successfully" :
                   jobStatus === "error" ? "Pipeline failed" :
                   jobStatus === "awaiting_fix" ? "Error detected — AI diagnosis ready" :
                   `Running: ${currentStep}`}
                </div>
                {jobId && <div style={{ fontSize: 11, color: "var(--dim)", fontFamily: "monospace", marginTop: 2 }}>job {jobId.slice(0, 12)}…</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(jobStatus === "done" || jobStatus === "error") && (
                  <button onClick={() => setWizardStep(1)}
                    style={{ padding: "8px 14px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer" }}>
                    Start new job
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                <span>{currentStep}</span><span>{progress}%</span>
              </div>
              <div style={{ height: 6, background: "var(--border)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 6, transition: "width 0.5s ease",
                  width: `${progress}%`,
                  background: jobStatus === "done" ? "#22c55e" : jobStatus === "error" ? "#ef4444" : "var(--flame)",
                }} />
              </div>
            </div>

            {/* Pipeline step indicators */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "1rem" }}>
              {meta.steps.map((s, i) => {
                const isActive = currentStep.toLowerCase().includes(s.tool.toLowerCase().split(" ")[0]);
                return (
                  <div key={i} style={{
                    padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                    background: isActive ? "var(--flame)" : "var(--surface)",
                    color: isActive ? "#fff" : "var(--muted)",
                    border: isActive ? "none" : "1px solid var(--border)",
                    transition: "all 0.3s",
                  }}>
                    {s.tool}
                  </div>
                );
              })}
            </div>

            {/* ── RUNNING: animated status card ── */}
            {jobStatus === "running" && (
              <div style={{
                borderRadius: 16, border: "1px solid var(--border)",
                background: "var(--surface)", padding: "2rem 1.5rem",
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 16, textAlign: "center", marginBottom: "1rem",
              }}>
                <div style={{ position: "relative", width: 56, height: 56 }}>
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    border: "3px solid var(--border)",
                  }} />
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    border: "3px solid var(--flame)",
                    borderRightColor: "transparent",
                    animation: "spin 0.9s linear infinite",
                  }} />
                  <span style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22,
                  }}>{meta.icon}</span>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", marginBottom: 6 }}>
                    {currentStep === "Submitting job…" ? "Starting pipeline…" : `Running: ${currentStep}`}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, maxWidth: 400 }}>
                    AI is monitoring the run in real time. If an error occurs, it will be diagnosed automatically and you will be asked to approve any fix.
                  </div>
                  <button
                    onClick={cancelJob}
                    style={{
                      marginTop: 12, padding: "8px 20px", borderRadius: 9,
                      border: "1px solid #fecaca", background: "#fff5f5",
                      color: "#dc2626", fontWeight: 600, fontSize: 13, cursor: "pointer",
                    }}>
                    ⏹ Cancel job
                  </button>
                </div>
              </div>
            )}

            {/* ── ERROR: friendly message (no raw traceback) ── */}
            {jobStatus === "error" && (
              <div style={{
                borderRadius: 16, border: "1px solid #fecaca",
                background: "#fff5f5", padding: "1.5rem", marginBottom: "1rem",
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#dc2626", marginBottom: 8 }}>
                  The pipeline encountered an error
                </div>
                <div style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.65, marginBottom: 12 }}>
                  {/* Show the last meaningful error line from logs, not raw traceback */}
                  {logs.filter(l => /FATAL ERROR|No Snakefile|not found|permission denied|out of memory/i.test(l)).slice(-1)[0]
                    ?.replace(/^FATAL ERROR:\s*/, "")
                    || "The pipeline stopped unexpectedly. See the technical logs below for details."}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setWizardStep(3)}
                    style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: "var(--flame)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    ← Adjust parameters & retry
                  </button>
                  <button onClick={() => setWizardStep(1)}
                    style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}>
                    Start over
                  </button>
                </div>
              </div>
            )}

            {/* ── FIX PROPOSAL CARD ── */}
            {jobStatus === "awaiting_fix" && fixProposal && (
              <div style={{
                borderRadius: 16, border: "2px solid #f5c842",
                background: "#fff8e6", padding: "1.5rem", marginBottom: "1rem",
              }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#7a5800", marginBottom: 8 }}>
                  🔧 AI diagnosed the error and proposed a fix
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#9a6e00", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                    What went wrong
                  </div>
                  <div style={{ fontSize: 14, color: "#5a3a00", lineHeight: 1.6, background: "#fff", borderRadius: 8, padding: "0.75rem 1rem" }}>
                    {fixProposal.root_cause}
                  </div>
                </div>

                {fixProposal.explanation && fixProposal.explanation !== fixProposal.root_cause && (
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#9a6e00", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                      Technical detail
                    </div>
                    <div style={{ fontSize: 13, color: "#7a5800", lineHeight: 1.6 }}>
                      {fixProposal.explanation}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: "1.25rem" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#9a6e00", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                    Proposed fix
                  </div>
                  <div style={{ fontSize: 14, color: "#5a3a00", background: "#fff", borderRadius: 8, padding: "0.75rem 1rem", fontWeight: 600 }}>
                    {fixProposal.proposed_fix?.description}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, padding: "0.75rem 0 0", borderTop: "1px solid #f5c842" }}>
                  <button onClick={() => approveFix(true)} disabled={approvingFix}
                    style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#15803d", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: approvingFix ? 0.6 : 1 }}>
                    ✓ Apply fix & retry
                  </button>
                  <button onClick={() => approveFix(false)} disabled={approvingFix}
                    style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #f5c842", background: "#fff", color: "#7a5800", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                    ✗ Cancel job
                  </button>
                  <div style={{ marginLeft: "auto", fontSize: 11, color: "#9a6e00", alignSelf: "center" }}>
                    Severity: <strong>{fixProposal.severity}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* ── DONE panel ── */}
            {jobStatus === "done" && (
              <div style={{
                borderRadius: 16, border: "1px solid #86efac",
                background: "#f0fdf4", padding: "1.5rem", marginBottom: "1rem",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#15803d", marginBottom: 6 }}>
                  Analysis complete
                </div>
                <div style={{ fontSize: 13, color: "#166534", marginBottom: 16 }}>
                  Your results are ready in <code style={{ fontFamily: "monospace", fontSize: 12 }}>{resultsDir}</code>
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <a href="/dashboard" style={{ padding: "11px 22px", borderRadius: 10, background: "#22c55e", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
                    View results in Dashboard →
                  </a>
                  <a href="/tools" style={{ padding: "11px 18px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13, textDecoration: "none" }}>
                    Browse downstream tools
                  </a>
                </div>
              </div>
            )}

            {/* ── Technical logs (collapsed by default) ── */}
            {logs.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{
                  fontSize: 12, color: "var(--muted)", cursor: "pointer",
                  padding: "8px 0", userSelect: "none",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span>🔍 Show technical logs</span>
                  <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 8, background: "var(--border)", color: "var(--muted)" }}>
                    {logs.length} lines
                  </span>
                </summary>
                <div ref={logRef} style={{
                  marginTop: 8, background: "#1c1a16", borderRadius: 12, padding: "0.85rem 1rem",
                  maxHeight: 320, overflowY: "auto", fontFamily: "monospace",
                  fontSize: 11, lineHeight: 1.75, color: "#c8c4bc",
                  border: "1px solid #3d3a34",
                }}>
                  {logs.map((line, i) => (
                    <div key={i} style={{
                      color:
                        /ERROR|Error|FAILED|FATAL/.test(line)          ? "#f87171" :
                        /^rule |100%|completed|successfully/.test(line) ? "#86efac" :
                        /^\[FIX\]|^\[AUTO-FIX\]|^\[RETRY\]/.test(line) ? "#fbbf24" :
                        /^\[AI ANALYSIS\]/.test(line)                   ? "#a78bfa" :
                        /^Config|^Starting/.test(line)                  ? "#93c5fd" :
                                                                          "#c8c4bc",
                    }}>
                      {line}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
