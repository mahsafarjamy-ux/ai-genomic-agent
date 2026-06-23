"use client";

import { useState, useRef, useEffect } from "react";
import NavBar from "@/components/NavBar";

const TOOLS = [
  {
    icon: "🧬", id: "rnaseq", label: "RNA-seq · Bulk Transcriptomics",
    tags: ["Gene expression", "DEGs", "Pathways"],
    data_needed: "FASTQ files (.fastq.gz) — paired-end R1 + R2, or single-end. Minimum 2 biological replicates per group.",
    application: "Measures which genes are switched on or off across conditions — e.g. tumor vs. normal, drug-treated vs. control. Produces a ranked list of differentially expressed genes, pathway enrichment, and splice-variant events.",
    tools_used: ["FastQC", "Trim Galore", "STAR / HISAT2", "featureCounts", "DESeq2 / edgeR", "GSEA"],
    output: "Gene expression matrix · DEG list · Volcano plot · Pathway report",
    time: "2–6 h",
  },
  {
    icon: "🔬", id: "wgs", label: "WGS · Whole Genome Sequencing",
    tags: ["SNVs", "Indels", "CNVs", "SVs"],
    data_needed: "FASTQ files (30–60× coverage). Matched tumor + normal pairs for somatic analysis. Illumina short reads or PacBio/Nanopore long reads.",
    application: "Finds every DNA change across the entire genome — inherited variants, somatic mutations in cancer, copy number changes, large structural rearrangements. Gold standard for research and rare disease discovery.",
    tools_used: ["BWA-MEM2", "GATK HaplotypeCaller", "Mutect2", "CNVkit", "ANNOVAR / VEP"],
    output: "VCF variant file · Annotated mutation table · CNV segments · SV calls",
    time: "8–24 h",
  },
  {
    icon: "🎯", id: "wes", label: "WES · Whole Exome Sequencing",
    tags: ["Coding variants", "Clinical diagnosis"],
    data_needed: "FASTQ files with 100× coverage. A capture kit BED file (e.g. Agilent SureSelect, Twist) to restrict analysis to exonic regions.",
    application: "Same as WGS but focused on the 1–2% of the genome that codes for proteins. 10× cheaper per sample. Best for finding disease-causing mutations in genes.",
    tools_used: ["BWA-MEM", "GATK", "VEP", "OpenCRAVAT"],
    output: "Annotated VCF · Clinical variant report · Population frequency table",
    time: "4–10 h",
  },
  {
    icon: "🔵", id: "scrnaseq", label: "scRNA-seq · Single-Cell Transcriptomics",
    tags: ["Cell types", "Clustering", "Cell states"],
    data_needed: "FASTQ files from 10x Chromium, Parse Biosciences, or similar. R1 contains barcodes + UMIs, R2 contains cDNA reads.",
    application: "Measures gene expression in thousands of individual cells simultaneously. Discover new cell subtypes, identify rare populations, track how cells change state during disease or development.",
    tools_used: ["STARsolo / Cell Ranger", "Seurat / Scanpy", "Leiden / Louvain", "SingleR", "scVelo"],
    output: "UMAP / t-SNE plot · Cell type annotations · Marker gene table · Pseudotime trajectory",
    time: "4–12 h",
  },
  {
    icon: "🧪", id: "methylation", label: "DNA Methylation · Epigenomics",
    tags: ["CpG methylation", "Epigenetics", "Gene silencing"],
    data_needed: "WGBS / RRBS: bisulfite-converted FASTQ files. EPIC / 450k array: IDAT files from the Illumina scanner.",
    application: "Maps epigenetic marks — which genes are chemically silenced — across the genome. Used in cancer epigenomics, aging clocks, and developmental biology.",
    tools_used: ["Bismark", "MethylDackel", "DSS", "minfi (arrays)", "ChAMP"],
    output: "Methylation BED file · DMR (differentially methylated regions) · Heatmap",
    time: "6–18 h (WGBS) · 1–3 h (array)",
  },
  {
    icon: "📍", id: "chipseq", label: "ChIP-seq · Protein–DNA Binding",
    tags: ["Histone marks", "TF binding", "Peak calling"],
    data_needed: "FASTQ files for the IP sample + an Input control (or IgG control). Single-end reads are common (50–100 bp).",
    application: "Shows where specific histone modifications (H3K27me3, H3K4me3…) or transcription factors physically bind on DNA. Maps regulatory elements, promoters, and enhancers.",
    tools_used: ["Bowtie2", "SAMtools", "MACS3", "DiffBind", "HOMER"],
    output: "Peak BED file · Signal bigWig tracks · Motif enrichment · Differential binding table",
    time: "3–8 h",
  },
  {
    icon: "🌊", id: "atacseq", label: "ATAC-seq · Open Chromatin Mapping",
    tags: ["Chromatin accessibility", "TF footprints", "Enhancers"],
    data_needed: "Paired-end FASTQ files (50–150 bp). Transposase-treated input — no sonication needed. 25,000+ cells recommended.",
    application: "Maps which regions of the genome are physically open and accessible to transcription factors. Identifies active enhancers, promoters, and transcription factor binding footprints genome-wide.",
    tools_used: ["Bowtie2", "MACS3", "TOBIAS", "ChromVAR", "ArchR (single-cell)"],
    output: "Peak BED file · Footprint scores · Accessibility bigWig · TF activity matrix",
    time: "3–8 h",
  },
  {
    icon: "🛡️", id: "immune_profiling", label: "Immune Profiling · TCR / BCR Repertoire",
    tags: ["TCR", "BCR", "HLA typing", "TILs"],
    data_needed: "RNA-seq FASTQ files from bulk or single-cell. For clonotype analysis: targeted amplicon sequencing (AIRR-seq, 10x Immune Profiling).",
    application: "Reconstructs the full immune receptor repertoire (T-cell and B-cell clonotypes), performs HLA typing, and quantifies tumor-infiltrating immune cells — critical for immunotherapy response prediction.",
    tools_used: ["MiXCR", "immunarch", "TRUST4", "OptiType (HLA)", "CIBERSORTx"],
    output: "Clonotype table · Diversity indices · HLA alleles · Immune cell deconvolution",
    time: "4–12 h",
  },
  {
    icon: "💧", id: "ctdna", label: "Liquid Biopsy / ctDNA",
    tags: ["Cell-free DNA", "Cancer monitoring", "Early detection"],
    data_needed: "Ultra-deep FASTQ files (>1000× coverage) from cell-free plasma DNA. Matched germline DNA (blood or saliva) strongly recommended as control.",
    application: "Detects cancer-derived DNA fragments circulating in blood. Used for early cancer detection, monitoring treatment response, and identifying drug-resistance mutations without a tissue biopsy.",
    tools_used: ["BWA-MEM", "Mutect2 (low-VAF mode)", "CNVkit", "ichorCNA", "GATK FilterMutectCalls"],
    output: "Low-VAF somatic variants · ctDNA fraction estimate · CNV genome-wide plot",
    time: "6–16 h",
  },
  {
    icon: "🦠", id: "microbiome", label: "Microbiome · 16S / Metagenomics",
    tags: ["16S rRNA", "Diversity", "Taxonomy"],
    data_needed: "16S: Paired-end FASTQ from amplicon sequencing (V3–V4 region). Shotgun: whole metagenome FASTQ at ≥1 Gbp per sample.",
    application: "Identifies and quantifies microorganisms — bacteria, fungi, viruses — in a sample. Used in gut microbiome research, environmental microbiology, and infection studies.",
    tools_used: ["DADA2", "QIIME2", "Kraken2 (shotgun)", "phyloseq", "MetaPhlAn4"],
    output: "OTU / ASV table · Alpha & beta diversity · Taxonomy barplot · Differential abundance",
    time: "2–8 h",
  },
  {
    icon: "⚙️", id: "riboseq", label: "Ribo-seq · Active Translation",
    tags: ["Ribosome profiling", "Translation", "ORFs"],
    data_needed: "Ribo-seq FASTQ (ribosome-protected fragments, 28–30 nt) AND matched RNA-seq FASTQ from the same sample.",
    application: "Captures ribosomes mid-translation to measure which mRNAs are actively being turned into protein, and at what rate. Discovers novel upstream ORFs, non-canonical translation, and translational control.",
    tools_used: ["Trim Galore", "STAR", "RiboCode", "xtail", "riboseQC"],
    output: "Translational efficiency per gene · Novel ORF list · Codon occupancy · P-site coverage",
    time: "4–10 h",
  },
  {
    icon: "🔩", id: "proteomics", label: "Proteomics · Mass Spectrometry",
    tags: ["Protein ID", "LFQ", "TMT", "Phosphoproteomics"],
    data_needed: "Raw mass spectrometry files (.raw, .mzML) from LC-MS/MS. Optionally, a custom protein FASTA if working with non-model organisms or cell lines with transgenes.",
    application: "Identifies and quantifies proteins directly from cells or tissue. Captures what the cell is actually doing (not just what it could do from RNA). Used in biomarker discovery, drug target validation, post-translational modification mapping.",
    tools_used: ["MaxQuant", "MSFragger", "Perseus", "STRING", "PhosphoSitePlus"],
    output: "Protein quantification table · Differential abundance · Pathway enrichment · PTM site table",
    time: "2–12 h (data-dependent)",
  },
  {
    icon: "🗺️", id: "spatial_transcriptomics", label: "Spatial Transcriptomics",
    tags: ["10x Visium", "Tissue mapping", "Spatial clusters"],
    data_needed: "10x Visium: FASTQ files + the tissue image (H&E TIFF). Slide-seq / MERFISH: platform-specific output files. A reference transcriptome.",
    application: "Maps gene expression to physical coordinates in tissue sections — see exactly where in a tumor, brain, or embryo each cell type and gene is located. Bridges histology and transcriptomics.",
    tools_used: ["Space Ranger", "Seurat / Squidpy", "RCTD (deconvolution)", "BayesSpace"],
    output: "Spatial UMAP · Gene expression tissue map · Cell-type deconvolution overlay",
    time: "4–14 h",
  },
  {
    icon: "🔗", id: "multiomics", label: "Multi-omics Integration",
    tags: ["MOFA+", "Data fusion", "Joint embedding"],
    data_needed: "Two or more processed omics matrices from the same samples: e.g. RNA-seq counts + ATAC-seq peaks + proteomics intensities. Samples must share the same IDs.",
    application: "Finds coordinated signals across different data types — which transcriptional changes are driven by epigenetic marks, which protein changes correlate with mutations. Gives a holistic picture no single omics can provide.",
    tools_used: ["MOFA+", "DIABLO", "WNN (Seurat)", "ComBat-seq (batch correction)", "MINT"],
    output: "Latent factor matrix · Multi-omics correlation heatmap · Integrated embedding · Factor loading plots",
    time: "1–6 h (after individual omics are processed)",
  },
  {
    icon: "🔀", id: "sv", label: "Structural Variant (SV) Analysis",
    tags: ["Translocations", "Inversions", "Large deletions", "Gene fusions"],
    data_needed: "Long-read FASTQ (PacBio HiFi or Oxford Nanopore ≥30× coverage) OR short-read WGS paired-end FASTQ (≥30×). Matched normal sample strongly recommended for somatic SV calling.",
    application: "Detects large-scale chromosomal rearrangements — deletions, duplications, inversions, translocations — that short-read SNV pipelines completely miss. Critical in cancer (e.g. BCR-ABL fusion in CML), rare disease, and constitutional disorders.",
    tools_used: ["Sniffles2 (long-read)", "PBSV (PacBio)", "GRIDSS (short-read)", "SURVIVOR (merging)", "ANNOTSV"],
    output: "VCF of structural variants · SV circos plot · Gene disruption table · Fusion gene list",
    time: "6–18 h",
  },
  {
    icon: "📈", id: "cnv", label: "Copy Number Variant (CNV) Analysis",
    tags: ["Amplifications", "Deletions", "LOH", "Aneuploidy"],
    data_needed: "WGS FASTQ (15–30× for germline, 60× for somatic) OR WES FASTQ with matched normal. For arrays: CEL files (SNP array) or IDAT files (Illumina CytoSNP).",
    application: "Finds regions where the genome has too many or too few copies of a gene — amplifications drive oncogenes (e.g. HER2, EGFR), deletions knock out tumor suppressors (e.g. CDKN2A, RB1). Used in cancer subtyping, treatment selection, and prenatal diagnostics.",
    tools_used: ["CNVkit", "GATK GermlineCNVCaller", "facets (somatic)", "PennCNV (array)", "VarSeq"],
    output: "Segmented CNV profile · Genome-wide plot · Amplification / deletion table · Tumor purity + ploidy",
    time: "3–10 h",
  },
  {
    icon: "🌑", id: "dark_genome", label: "Dark Genome · Non-coding & Repeats",
    tags: ["Transposons", "lncRNA", "Fusions", "Non-coding"],
    data_needed: "Long-read FASTQ (PacBio HiFi or Nanopore) for repeat-rich regions. Standard RNA-seq FASTQ for fusion and lncRNA detection.",
    application: "Explores the 98% of the genome that doesn't code for proteins — repetitive elements, transposons, long non-coding RNAs, gene fusions, and cryptic regulatory sequences. Important in cancer, aging, and neurological disease.",
    tools_used: ["STAR-Fusion", "Arriba", "RepeatMasker", "LongPhase", "Sniffles2"],
    output: "Gene fusion calls · lncRNA expression table · Repeat annotation · SV phasing",
    time: "6–20 h",
  },
  {
    icon: "🔹", id: "mirnaseq", label: "miRNA-seq · Small RNA Profiling",
    tags: ["microRNA", "Small RNA", "Post-transcriptional", "miRDeep2"],
    data_needed: "Small RNA-seq FASTQ — single-end reads, 17–35 nt after adapter trimming. Libraries from Qiagen, NEBNext, or SMARTer smRNA-seq kits. 1–5 M mapped reads per sample minimum.",
    application: "Quantifies microRNAs (miRNAs), piRNAs, and other small non-coding RNAs that post-transcriptionally silence gene expression. miRNAs regulate ~60% of human protein-coding genes. Dysregulated in virtually all cancers and many developmental disorders. Can discover novel miRNAs de novo from the data.",
    tools_used: ["Trim Galore (adapter: TGGAATTCTCGG)", "miRDeep2 v2.0.1 (de novo + known)", "miRge3.0 (quantification)", "exceRpt v5.1 (ENCODE pipeline)", "DESeq2 (DE)", "miRTarBase / TargetScan (target prediction)"],
    output: "miRNA count matrix · Novel miRNA candidates · DE miRNAs · Target gene network · miRNA–mRNA regulatory pairs",
    time: "2–6 h",
  },
  {
    icon: "🎛️", id: "mrna_isoforms", label: "mRNA Isoforms, Splicing & m⁶A Modifications",
    tags: ["Alternative splicing", "m6A", "Isoforms", "NMD", "Transcript assembly"],
    data_needed: "For splicing/isoforms: stranded paired-end RNA-seq FASTQ (≥60 M reads/sample for isoform resolution). For m⁶A: MeRIP-seq / m⁶A-seq paired-end FASTQ (IP + Input). For long-read isoforms: PacBio Iso-Seq or Nanopore direct-RNA FASTQ.",
    application: "Goes beyond gene-level RNA-seq to resolve (1) alternative splicing events — skipped exons, retained introns, alternative 5′/3′ sites — (2) transcript isoform abundance and switching between conditions, and (3) N⁶-methyladenosine (m⁶A) modification sites, the most abundant internal mRNA modification, which controls mRNA stability, translation efficiency, and splicing. Critical for cancer neoantigens, neurological disease, and drug resistance mechanisms.",
    tools_used: ["StringTie2 (transcript assembly)", "SUPPA2 (differential splicing events)", "IsoformSwitchAnalyzeR (consequence prediction)", "Salmon + alevin-fry (isoform quantification)", "exomePeak2 (m⁶A peak calling — best benchmarked)", "WHISTLE (m⁶A site prediction)", "LeafCutter (splicing QTL)", "isoquant (long-read isoforms)"],
    output: "Splicing event table (SE / RI / A5SS / A3SS) · Isoform switch plots · m⁶A peak BED + motif · dPSI (delta percent-spliced-in) · NMD-sensitive transcript list",
    time: "4–12 h (short-read) · 8–20 h (Iso-Seq / direct-RNA)",
  },
  {
    icon: "🔁", id: "msi", label: "Microsatellite Instability (MSI) Analysis",
    tags: ["MSI-H", "MSS", "Lynch syndrome", "Immunotherapy biomarker"],
    data_needed: "Tumor BAM + matched normal BAM (WGS or WES). Tumor-only mode available (WGS ≥30× or WES ≥100×). RNA-seq BAM also supported for MSIseq. At least 50 microsatellite loci recommended for reliable scoring.",
    application: "Determines microsatellite instability status — MSI-High (MSI-H), MSS, or borderline — across the genome. MSI-H tumors have defective DNA mismatch repair (dMMR) and are strong candidates for pembrolizumab/nivolumab checkpoint immunotherapy (FDA-agnostic approval). Also the hallmark of Lynch syndrome (hereditary colorectal, endometrial, and ovarian cancer). Clinically actionable: MSI status directly guides treatment decisions.",
    tools_used: ["MSIsensor2 v0.1 (highest precision/recall; Zheng et al., Nat Commun 2021)", "MSIsensor-pro (tumor-only + cfDNA capable)", "MANTIS (WES, very high specificity)", "mSINGS (WGS locus-level resolution)", "MSIseq (RNA-seq-based)", "ANNOVAR (MMR gene variant annotation)"],
    output: "MSI score (MSI-H / MSS / MSI-L) · Per-locus instability table · MMR gene mutation status · Tumor mutation burden (TMB) estimate",
    time: "1–4 h",
  },
  {
    icon: "🔄", id: "transposable_elements", label: "Transposable Elements · LINE / SINE / ERV",
    tags: ["LINE-1", "SINE/Alu", "ERV", "Retrotransposons", "TE expression", "Somatic insertions"],
    data_needed: "For TE expression: stranded RNA-seq FASTQ (multi-mapped reads must be retained — do NOT use --alignIntronMax uniquely-mapped-only). For somatic TE insertion detection: WGS paired-end FASTQ ≥30× (tumor + normal). For long-read insertion mapping: PacBio HiFi or Nanopore FASTQ ≥20×.",
    application: "Transposable elements — LINE-1, Alu/SINE, LTR retrotransposons, and endogenous retroviruses (ERVs) — make up ~45% of the human genome and are mostly silenced in normal cells. In cancer and aging they reactivate: (1) somatic TE insertions disrupt tumor suppressors (e.g. L1 insertions into APC in colorectal cancer), (2) TE transcription creates immunogenic dsRNA that activates innate immunity, and (3) ERV-derived transcripts are cancer-specific neoantigens. Also key in neurological disease (ALS, schizophrenia) and embryonic development.",
    tools_used: ["Telescope v1.0.3 (locus-specific ERV/TE quantification, highest resolution — Bendall et al., PLOS Comput Biol 2019)", "xTEA (somatic L1/Alu/SVA insertions from WGS — Chu et al., Nat Commun 2021, highest benchmark F1)", "TEtranscripts (bulk TE expression from RNA-seq)", "TLDR (long-read somatic TE insertions)", "RepeatMasker + RepeatModeler2 (TE annotation)", "ERVmap (endogenous retrovirus quantification)", "L1EM (L1 expression quantification)"],
    output: "TE expression matrix by locus · Somatic insertion VCF (LINE-1 / Alu / SVA) · ERV transcript table · TE-disrupted gene list · dsRNA-forming TE loci",
    time: "4–14 h (expression) · 8–24 h (somatic insertions)",
  },
  {
    icon: "🌡️", id: "cfdna_multianalyte", label: "Cell-Free DNA · Multi-analyte Liquid Biopsy",
    tags: ["cfDNA", "Fragmentomics", "Tissue-of-origin", "Methylation", "DELFI", "Griffin"],
    data_needed: "Low-pass WGS FASTQ (0.5–5× coverage) OR ultra-deep targeted FASTQ (>1000×) from plasma cell-free DNA. For methylation deconvolution: cfMeDIP-seq or WGBS FASTQ from plasma. Matched germline (buffy coat) strongly recommended. cfDNA yield typically 1–30 ng/mL plasma.",
    application: "Goes beyond ctDNA mutation calling to exploit the full information in circulating cell-free DNA: (1) fragment length profiles — cancer cells release characteristically short cfDNA (~145 bp) with altered nucleosome positioning detectable by DELFI (Science 2019, AUC >0.94 across 7 cancer types), (2) copy number profiles from ultra-low-pass WGS via ichorCNA, (3) tissue-of-origin deconvolution from methylation patterns using EPIC-seq or cfMeSurv, (4) nucleosome positioning at regulatory elements via Griffin (Nature Communications 2022). Enables simultaneous cancer detection, tumor fraction estimation, and organ-of-origin identification from a single blood draw.",
    tools_used: ["DELFI (fragmentomics — Cristiano et al., Science 2019)", "Griffin v0.2 (nucleosome accessibility — Doebley et al., Nat Commun 2022)", "ichorCNA (ultra-low-pass CNV — Adalsteinsson et al., Nat Commun 2017)", "cfDNApipe v1.0 (end-to-end cfDNA pipeline)", "cfMeSurv / MethylResolver (methylation tissue-of-origin)", "EPIC-seq (enhancer-based tissue-ID — Vlassenbroeck et al., Nat Cancer 2022)", "Mutect2 low-VAF (somatic SNVs)", "WisecondorX (NIPT / CNV from low-pass)"],
    output: "Tumor fraction estimate · CNV profile · Fragment length distribution · Nucleosome accessibility score per TF · Tissue-of-origin probabilities · Somatic variant calls",
    time: "6–20 h",
  },
];

// ── Chat-based pipeline suggester ──────────────────────────────────────────
// Keyword → pipeline mapping for instant client-side suggestions
const SUGGESTIONS: Array<{ patterns: RegExp; id: string; label: string; icon: string; reason: string }> = [
  { patterns: /\b(gene expression|rna.?seq|differentially expressed|deg|transcriptom|mrna|deseq|edger)\b/i, id: "rnaseq",      icon: "🧬", label: "RNA-seq",                   reason: "measures which genes are switched on/off" },
  { patterns: /\b(single.cell|scrna|sc rna|10x|cell type|cluster|umap|seurat|scanpy)\b/i,                  id: "scrnaseq",    icon: "🔵", label: "Single-Cell RNA-seq",         reason: "resolves gene expression in individual cells" },
  { patterns: /\b(whole genome|wgs|snv|indel|variant call|germline|somatic|gatk|mutect)\b/i,               id: "wgs",         icon: "🔬", label: "Whole Genome Sequencing",     reason: "finds all DNA variants across the full genome" },
  { patterns: /\b(exome|wes|coding region|panel|targeted seq)\b/i,                                          id: "wes",         icon: "🎯", label: "Whole Exome Sequencing",      reason: "focuses variant calling on protein-coding regions" },
  { patterns: /\b(structural variant|sv|translocation|inversion|fusion gene|rearrangement|breakpoint)\b/i, id: "sv",          icon: "🔀", label: "Structural Variant Analysis", reason: "detects large chromosomal rearrangements and fusions" },
  { patterns: /\b(copy number|cnv|amplification|deletion|loh|aneuploidy|her2|egfr amplif)\b/i,             id: "cnv",         icon: "📈", label: "Copy Number Analysis",         reason: "finds amplified oncogenes and deleted tumor suppressors" },
  { patterns: /\b(methylation|epigenetic|cpg|bisulfite|wgbs|rrbs|epic|450k|dnmt)\b/i,                     id: "methylation", icon: "🧪", label: "DNA Methylation",              reason: "maps epigenetic silencing across the genome" },
  { patterns: /\b(chip.?seq|cut.?run|histone|transcription factor|binding|peak|macs)\b/i,                  id: "chipseq",     icon: "📍", label: "ChIP-seq",                    reason: "maps where proteins bind to DNA" },
  { patterns: /\b(atac.?seq|open chromatin|accessibility|nucleosome|footprint|enhancer)\b/i,               id: "atacseq",     icon: "🌊", label: "ATAC-seq",                    reason: "maps which genomic regions are physically open" },
  { patterns: /\b(microbiome|16s|metagenom|bacteria|gut|diversity|qiime|dada2)\b/i,                        id: "microbiome",  icon: "🦠", label: "Microbiome",                  reason: "profiles microbial communities from 16S or shotgun data" },
  { patterns: /\b(proteom|mass spec|ms.?ms|protein quant|maxquant|lfq|tmt)\b/i,                           id: "proteomics",  icon: "🔩", label: "Proteomics",                  reason: "identifies and quantifies proteins by mass spectrometry" },
  { patterns: /\b(spatial|visium|slide.seq|merfish|in situ|tissue section|spatial cluster)\b/i,            id: "spatial_transcriptomics", icon: "🗺️", label: "Spatial Transcriptomics", reason: "shows where genes are expressed in tissue sections" },
  { patterns: /\b(multi.?omics|integrat|mofa|diablo|fuse|combine rna|combine proteom)\b/i,                 id: "multiomics",  icon: "🔗", label: "Multi-omics Integration",     reason: "fuses multiple data types to find coordinated signals" },
  { patterns: /\b(immune|tcr|bcr|repertoire|hla|til|immunotherapy|cibersort)\b/i,                         id: "immune_profiling", icon: "🛡️", label: "Immune Profiling",      reason: "reconstructs T/B cell repertoires and immune cell composition" },
  { patterns: /\b(liquid biopsy|ctdna|cell.free|cfDNA|plasma dna|early detection)\b/i,                    id: "ctdna",       icon: "💧", label: "Liquid Biopsy / ctDNA",       reason: "detects cancer DNA fragments circulating in blood" },
  { patterns: /\b(ribo.?seq|translation|ribosome|orf|codon|polyribo)\b/i,                                       id: "riboseq",              icon: "⚙️", label: "Ribo-seq",                          reason: "measures active protein translation from ribosome profiling" },
  { patterns: /\b(mirna|mirna.seq|microrna|small.?rna|mirdeep|pirna|ncrna|let.?7)\b/i,                          id: "mirnaseq",             icon: "🔹", label: "miRNA-seq",                         reason: "profiles microRNAs that post-transcriptionally silence gene expression" },
  { patterns: /\b(m6a|mecrip|isoform|alternative splicing|nmd|suppa|stringtie|leafcutter|transcript assembl)\b/i, id: "mrna_isoforms",       icon: "🎛️", label: "mRNA Isoforms & m⁶A",             reason: "resolves isoform switching, alternative splicing, and mRNA modifications" },
  { patterns: /\b(msi|microsatellite instab|mismatch repair|mmr|msi.h|mss|lynch syndrome|mantis|msisensor)\b/i,  id: "msi",                 icon: "🔁", label: "Microsatellite Instability",       reason: "determines MSI status — a key immunotherapy biomarker" },
  { patterns: /\b(transposable|retrotranspos|line.1|alu element|sine|erv|endogenous retrovirus|telescope|xtea)\b/i, id: "transposable_elements", icon: "🔄", label: "Transposable Elements",      reason: "quantifies LINE/SINE/ERV activity and detects somatic TE insertions" },
  { patterns: /\b(cell.free dna|fragmentomics|delfi|griffin cfDNA|nucleosome positioning cfDNA|tissue.of.origin cfDNA)\b/i, id: "cfdna_multianalyte", icon: "🌡️", label: "cfDNA Multi-analyte", reason: "exploits fragment patterns, methylation, and CNV from a single blood draw" },
];

function suggestPipeline(query: string) {
  if (!query.trim()) return null;
  for (const s of SUGGESTIONS) {
    if (s.patterns.test(query)) return s;
  }
  return null;
}

const STATS = [
  ["17",   "Analysis types"],
  ["150+", "Bioinformatics tools"],
  ["18+",  "Public databases"],
  ["100%", "Local computation"],
];

const MULTI_LAYER_OPTIONS = [
  { id: "rnaseq",      icon: "🧬", label: "RNA-seq" },
  { id: "scrnaseq",    icon: "🔵", label: "scRNA-seq" },
  { id: "atacseq",     icon: "🌊", label: "ATAC-seq" },
  { id: "methylation", icon: "🧪", label: "Methylation" },
  { id: "chipseq",     icon: "📍", label: "ChIP-seq" },
  { id: "proteomics",  icon: "🔩", label: "Proteomics" },
  { id: "wgs",         icon: "🔬", label: "WGS" },
  { id: "spatial",     icon: "🗺️", label: "Spatial" },
];

// ── Paper replication ──────────────────────────────────────────────────────

type PaperResult = {
  analyses: Array<{ id: string; icon: string; label: string }>;
  codeLinks: Array<{ url: string; label: string; type: string }>;
  vizTypes: string[];
};

const PAPER_PIPELINES = [
  { id: "rnaseq",                icon: "🧬", label: "RNA-seq · Bulk Transcriptomics",    patterns: /\b(rna.?seq|rnaseq|differentially expressed|deg|deseq|edger|transcriptom|mrna|star aligner|hisat2|featurecounts|htseq|kallisto|salmon)\b/i },
  { id: "scrnaseq",              icon: "🔵", label: "Single-Cell RNA-seq",               patterns: /\b(single.cell|scrna|sc.rna|10x chromium|seurat|scanpy|cell type|leiden|louvain|scvelo|monocle|celltypist|cellranger)\b/i },
  { id: "wgs",                   icon: "🔬", label: "Whole Genome Sequencing",           patterns: /\b(whole genome|wgs|snv|indel|variant call|germline|somatic|gatk|mutect|haplotypecaller|strelka|deepvariant)\b/i },
  { id: "wes",                   icon: "🎯", label: "Whole Exome Sequencing",            patterns: /\b(exome|wes|coding region|panel capture|targeted seq|sureselect|twist capture)\b/i },
  { id: "sv",                    icon: "🔀", label: "Structural Variant Analysis",       patterns: /\b(structural variant|sv caller|translocation|inversion|fusion gene|rearrangement|breakpoint|sniffles|pbsv|gridss|survivor|lumpy)\b/i },
  { id: "cnv",                   icon: "📈", label: "Copy Number Analysis",              patterns: /\b(copy number|cnv|amplification|focal deletion|loh|aneuploidy|cnvkit|ichorcna|facets|ascat|purple)\b/i },
  { id: "methylation",           icon: "🧪", label: "DNA Methylation",                  patterns: /\b(methylation|cpg|bisulfite|wgbs|rrbs|epic array|450k|dnmt|bismark|methyldackel|champ|minfi)\b/i },
  { id: "chipseq",               icon: "📍", label: "ChIP-seq",                         patterns: /\b(chip.?seq|cut.?run|cut.?tag|histone mark|h3k27|h3k4|h3k36|macs2|macs3|tf binding)\b/i },
  { id: "atacseq",               icon: "🌊", label: "ATAC-seq",                         patterns: /\b(atac.?seq|open chromatin|chromatin accessibility|nucleosome|tobias|chromvar|archr|footprint)\b/i },
  { id: "microbiome",            icon: "🦠", label: "Microbiome / 16S",                 patterns: /\b(microbiome|16s|metagenom|bacteria|gut microb|diversity|qiime|dada2|kraken|metaphlan|humann)\b/i },
  { id: "proteomics",            icon: "🔩", label: "Proteomics",                       patterns: /\b(proteom|mass spec|ms.?ms|protein quant|maxquant|lfq|tmt|itraq|perseus|msfragger|diann)\b/i },
  { id: "spatial_transcriptomics", icon: "🗺️", label: "Spatial Transcriptomics",       patterns: /\b(spatial|visium|slide.seq|merfish|in situ sequenc|seqfish|space ranger|squidpy|bayesspace)\b/i },
  { id: "multiomics",            icon: "🔗", label: "Multi-omics Integration",          patterns: /\b(multi.?omics|mofa|diablo|wnn|joint embedding|data integrat|multi.modal|mixomics)\b/i },
  { id: "immune_profiling",      icon: "🛡️", label: "Immune Profiling",                patterns: /\b(immune|tcr|bcr|repertoire|hla typing|til|cibersort|mixcr|trust4|optityp|airr)\b/i },
  { id: "ctdna",                 icon: "💧", label: "Liquid Biopsy / ctDNA",            patterns: /\b(liquid biopsy|ctdna|cell.free dna|cfdna|plasma dna|ichorCNA|low vaf)\b/i },
  { id: "riboseq",               icon: "⚙️", label: "Ribo-seq",                         patterns: /\b(ribo.?seq|ribosome profiling|translation effic|riboseqc|ribocode|p.site)\b/i },
  { id: "mirnaseq",             icon: "🔹", label: "miRNA-seq",                         patterns: /\b(mirna|mirna.seq|microrna|small rna.?seq|mirdeep|pirna|let.?7|mir.?21)\b/i },
  { id: "mrna_isoforms",        icon: "🎛️", label: "mRNA Isoforms & m⁶A",             patterns: /\b(m6a|mecrip|alternative splicing|isoform switch|nmd|suppa|stringtie|leafcutter|dexseq|iso.?seq)\b/i },
  { id: "msi",                  icon: "🔁", label: "Microsatellite Instability",       patterns: /\b(microsatellite instab|msi.h|mss|mismatch repair|mmr deficient|lynch|msisensor|mantis)\b/i },
  { id: "transposable_elements", icon: "🔄", label: "Transposable Elements",           patterns: /\b(transposable element|retrotransposon|line.?1|alu|sine|erv|endogenous retrovirus|telescope|xtea|te expression)\b/i },
  { id: "cfdna_multianalyte",   icon: "🌡️", label: "cfDNA Multi-analyte",             patterns: /\b(fragmentomics|delfi|griffin nucleosome|nucleosome positioning|tissue.of.origin|cfmedip|epic.seq)\b/i },
];

const VIZ_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(umap|t.sne|tsne)\b/i,                          label: "UMAP / t-SNE embedding" },
  { pattern: /\bvolcano\s*plot\b/i,                              label: "Volcano plot" },
  { pattern: /\bheatmap\b/i,                                     label: "Heatmap" },
  { pattern: /\bviolin\s*plot|boxplot\b/i,                       label: "Violin / Boxplot" },
  { pattern: /\bpca\s*(plot|biplot|analysis)\b/i,                label: "PCA plot" },
  { pattern: /\bcircos\b/i,                                      label: "Circos diagram" },
  { pattern: /\bkaplan.meier|survival\s*curve\b/i,               label: "Kaplan-Meier survival" },
  { pattern: /\bigv|genome\s*browser\s*track\b/i,                label: "Genome browser tracks" },
  { pattern: /\bwaterfall\s*plot\b/i,                            label: "Waterfall plot" },
  { pattern: /\boncoprint\b/i,                                   label: "OncoPrint" },
  { pattern: /\bdot\s*plot|bubble\s*plot\b/i,                    label: "Dot / Bubble plot" },
  { pattern: /\bforest\s*plot\b/i,                               label: "Forest plot" },
  { pattern: /\bphylogen|\bdendrogram\b/i,                       label: "Phylogenetic tree" },
  { pattern: /\bvenn\s*diagram\b/i,                              label: "Venn diagram" },
  { pattern: /\bsankey\b/i,                                      label: "Sankey diagram" },
  { pattern: /\bpseudotime|trajectory\s*(analys|plot)\b/i,       label: "Pseudotime trajectory" },
  { pattern: /\bma.plot\b/i,                                     label: "MA plot" },
  { pattern: /\blollipop\s*plot\b/i,                             label: "Lollipop plot" },
  { pattern: /\bswarm\s*plot\b/i,                                label: "Swarm plot" },
];

function extractCodeLinks(text: string): Array<{ url: string; label: string; type: string }> {
  const results: Array<{ url: string; label: string; type: string }> = [];
  const seen = new Set<string>();

  const patterns: Array<{ re: RegExp; type: string; mkLabel: (u: string) => string }> = [
    {
      re: /https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[^\s,)>'"]*)?/g,
      type: "GitHub",
      mkLabel: (u) => { const p = u.replace(/https?:\/\/github\.com\//, "").split("/"); return `${p[0]}/${p[1]}`; },
    },
    {
      re: /https?:\/\/gitlab\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[^\s,)>'"]*)?/g,
      type: "GitLab",
      mkLabel: (u) => { const p = u.replace(/https?:\/\/gitlab\.com\//, "").split("/"); return `${p[0]}/${p[1]}`; },
    },
    {
      re: /https?:\/\/zenodo\.org\/(?:record|doi|badge\/doi|records)\/[^\s,)>'"]+/g,
      type: "Zenodo",
      mkLabel: () => "Zenodo dataset/code",
    },
    {
      re: /https?:\/\/figshare\.com\/[^\s,)>'"]+/g,
      type: "figshare",
      mkLabel: () => "figshare dataset",
    },
    {
      re: /https?:\/\/osf\.io\/[A-Za-z0-9]+/g,
      type: "OSF",
      mkLabel: () => "OSF repository",
    },
    {
      re: /https?:\/\/(?:www\.)?bioconductor\.org\/packages\/[^\s,)>'"]+/g,
      type: "Bioconductor",
      mkLabel: (u) => { const pkg = u.split("/packages/")[1]?.split("/")[0]; return pkg ? `Bioconductor: ${pkg}` : "Bioconductor package"; },
    },
    {
      re: /https?:\/\/(?:www\.)?ncbi\.nlm\.nih\.gov\/geo\/query\/acc\.cgi\?acc=[A-Z0-9]+/g,
      type: "GEO",
      mkLabel: (u) => { const acc = u.split("acc=")[1]; return acc ? `GEO: ${acc}` : "GEO dataset"; },
    },
    {
      re: /https?:\/\/(?:www\.)?ebi\.ac\.uk\/[^\s,)>'"]+/g,
      type: "EBI",
      mkLabel: () => "EBI dataset",
    },
    {
      re: /https?:\/\/(?:www\.)?synapse\.org\/[^\s,)>'"]+/g,
      type: "Synapse",
      mkLabel: () => "Synapse dataset",
    },
  ];

  for (const { re, type, mkLabel } of patterns) {
    for (const match of text.matchAll(new RegExp(re.source, re.flags))) {
      const url = match[0].replace(/[.,;)>'"]+$/, "");
      if (!seen.has(url)) {
        seen.add(url);
        results.push({ url, label: mkLabel(url), type });
      }
    }
  }
  return results;
}

function analysePaper(text: string): PaperResult {
  const analyses = PAPER_PIPELINES.filter(p => p.patterns.test(text));
  const codeLinks = extractCodeLinks(text);
  const vizTypes = VIZ_PATTERNS.filter(v => v.pattern.test(text)).map(v => v.label);
  return { analyses, codeLinks, vizTypes };
}

export default function Home() {
  const [openTool, setOpenTool]       = useState<string | null>(null);
  const [chatQuery, setChatQuery]     = useState("");
  const [suggestion, setSuggestion]   = useState<ReturnType<typeof suggestPipeline>>(null);
  const [multiLayers, setMultiLayers] = useState<string[]>(["rnaseq", "atacseq"]);
  const chatRef = useRef<HTMLInputElement>(null);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [paperText, setPaperText]             = useState("");
  const [paperResult, setPaperResult]         = useState<PaperResult | null>(null);
  const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>([]);
  const [paperMode, setPaperMode]             = useState<"paste"|"pmid"|"doi"|"upload">("paste");
  const [pmidInput, setPmidInput]             = useState("");
  const [doiInput, setDoiInput]               = useState("");
  const [fetchLoading, setFetchLoading]       = useState(false);
  const [fetchError, setFetchError]           = useState<string|null>(null);

  /* ACGT Matrix canvas animation ─────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    const bases = ["A","C","G","T"];
    const baseColors: Record<string,string> = { A:"#00ff7f", C:"#00cfcf", G:"#00ff44", T:"#44ffcc" };
    const fs = 14;
    let drops: number[] = [];

    function resize() {
      if (!canvas) return;
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      drops = Array.from({ length: Math.floor(canvas.width / (fs * 0.78)) },
                         () => Math.random() * -(canvas.height / fs));
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (!canvas || !ctx) return;
      ctx.fillStyle = "rgba(5,13,26,0.055)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `bold ${fs}px 'Courier New',monospace`;
      for (let i = 0; i < drops.length; i++) {
        const base = bases[Math.floor(Math.random() * 4)];
        const x = i * fs * 0.78, y = drops[i] * fs;
        ctx.globalAlpha = 1; ctx.fillStyle = "#e0fff0";
        ctx.fillText(base, x, y);
        ctx.globalAlpha = 0.65; ctx.fillStyle = baseColors[base];
        ctx.fillText(bases[Math.floor(Math.random() * 4)], x, y - fs);
        ctx.globalAlpha = 1;
        if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.42;
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  /* PubMed PMID fetch ─────────────────────────────────────────────────── */
  async function fetchByPmid() {
    if (!pmidInput.trim()) return;
    setFetchLoading(true); setFetchError(null);
    try {
      const res = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${encodeURIComponent(pmidInput.trim())}&rettype=abstract&retmode=text`
      );
      const text = await res.text();
      if (text.length < 30) throw new Error("No abstract found. Check the PMID.");
      setPaperText(text);
      const r = analysePaper(text);
      setPaperResult(r); setSelectedAnalyses(r.analyses.map(a => a.id));
    } catch (e: any) {
      setFetchError(e.message || "Could not fetch from PubMed.");
    } finally { setFetchLoading(false); }
  }

  /* CrossRef DOI fetch ────────────────────────────────────────────────── */
  async function fetchByDoi() {
    if (!doiInput.trim()) return;
    setFetchLoading(true); setFetchError(null);
    try {
      const doi = doiInput.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "");
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
      if (!res.ok) throw new Error("DOI not found in CrossRef.");
      const { message: w } = await res.json();
      const parts: string[] = [];
      if (w.title?.[0])               parts.push(`Title: ${w.title[0]}`);
      if (w.author?.length)           parts.push(`Authors: ${w.author.slice(0,6).map((a: any) => `${a.given??""} ${a.family??""}`.trim()).join(", ")}`);
      if (w["container-title"]?.[0])  parts.push(`Journal: ${w["container-title"][0]}`);
      if (w.published?.["date-parts"]?.[0]?.[0]) parts.push(`Year: ${w.published["date-parts"][0][0]}`);
      if (w.abstract)                 parts.push(`\nAbstract:\n${w.abstract.replace(/<[^>]+>/g,"")}`);
      const text = parts.join("\n");
      if (text.length < 20) throw new Error("CrossRef returned no usable text for this DOI.");
      setPaperText(text);
      const r = analysePaper(text);
      setPaperResult(r); setSelectedAnalyses(r.analyses.map(a => a.id));
    } catch (e: any) {
      setFetchError(e.message || "Could not fetch from CrossRef.");
    } finally { setFetchLoading(false); }
  }

  /* File upload ───────────────────────────────────────────────────────── */
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFetchError(null);
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = ev => setPaperText((ev.target?.result as string) ?? "");
      reader.readAsText(file);
    } else {
      setFetchError(`PDF "${file.name}" uploaded. PDF text parsing runs in browser — paste the Methods/Abstract section below for best results, or use PMID/DOI for automatic fetching.`);
    }
  }

  function handleChat(q: string) {
    setChatQuery(q);
    setSuggestion(suggestPipeline(q));
  }

  function toggleLayer(id: string) {
    setMultiLayers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)", color: "var(--text)" }}>
      <NavBar />

      {/* ── Dark ACGT matrix hero ────────────────────────────────────────── */}
      <section style={{ position: "relative", background: "#040d1a", overflow: "hidden", minHeight: "91vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {/* ACGT matrix canvas */}
        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.52 }} />
        {/* Vignette overlay */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 80% at 25% 50%, rgba(4,13,26,0.25) 0%, rgba(4,13,26,0.88) 70%)" }} />

        {/* Content grid */}
        <div style={{ position: "relative", zIndex: 10, maxWidth: 1280, margin: "0 auto", padding: "72px 48px", width: "100%", boxSizing: "border-box", display: "grid", gridTemplateColumns: "1fr min(500px,44%)", gap: 52, alignItems: "center" }}>

          {/* Left: text */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, padding: "7px 18px", marginBottom: 32, background: "rgba(240,88,8,0.14)", border: "1px solid rgba(240,88,8,0.45)", color: "#ff9050", fontSize: 12, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff8c00", display: "inline-block", flexShrink: 0, boxShadow: "0 0 8px #ff8c00" }} />
              Privacy-first · Your genomic data never leaves your machine
            </div>

            <h1 style={{ color: "#ffffff", fontSize: "clamp(2.5rem,4.8vw,4rem)", fontWeight: 900, lineHeight: 1.06, marginBottom: 22, letterSpacing: "-0.035em" }}>
              Accelerating<br />
              <span style={{ color: "#ff6b35" }}>Scientific</span><br />
              Discovery
            </h1>

            <p style={{ color: "#94a3b8", fontSize: "1.1rem", lineHeight: 1.68, marginBottom: 44, maxWidth: 460 }}>
              One AI platform for Genomics, Multi-omics, Proteomics, Imaging, Pathology &amp; Biomedical Discovery — privacy-first, all computation stays on your machine.
            </p>

            {/* Stats */}
            <div style={{ display: "flex", gap: 36, marginBottom: 44, flexWrap: "wrap" }}>
              {STATS.map(([n, l], i) => (
                <div key={l}>
                  <div style={{ fontSize: "1.9rem", fontWeight: 900, lineHeight: 1, color: i===0?"#ff6b35":i===1?"#a855f7":i===2?"#f59e0b":"#00d4ff" }}>{n}</div>
                  <div style={{ color: "#475569", fontSize: "0.75rem", marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <a href="/launch" style={{ padding: "13px 30px", borderRadius: 12, background: "#ff6600", color: "#fff", fontWeight: 700, textDecoration: "none", fontSize: "0.9rem", boxShadow: "0 4px 20px rgba(255,102,0,0.42)" }}>
                Start Analysis →
              </a>
              <a href="/data" style={{ padding: "13px 30px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", color: "#e2e8f0", fontWeight: 600, textDecoration: "none", fontSize: "0.9rem", background: "rgba(255,255,255,0.05)" }}>
                Browse Public Data
              </a>
            </div>
          </div>

          {/* Right: tool grid card */}
          <div style={{ background: "rgba(255,255,255,0.97)", borderRadius: 24, padding: "24px 22px 18px", boxShadow: "0 32px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.09em", color: "#94a3b8", marginBottom: 16 }}>Analysis Tools</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
              {[
                { icon:"🧬", label:"RNA-seq",            desc:"Expression profiling",      id:"rnaseq" },
                { icon:"🔵", label:"Single-Cell",        desc:"Cell type clustering",       id:"scrnaseq" },
                { icon:"🔬", label:"WGS / WES",          desc:"Whole genome sequencing",    id:"wgs" },
                { icon:"🔀", label:"Structural Variants", desc:"SV detection & fusion",     id:"sv" },
                { icon:"📈", label:"CNV Analysis",        desc:"Copy number variation",     id:"cnv" },
                { icon:"🌊", label:"ATAC-seq",            desc:"Chromatin accessibility",   id:"atacseq" },
                { icon:"📍", label:"ChIP-seq",            desc:"Protein-DNA binding",       id:"chipseq" },
                { icon:"🧪", label:"Methylation",         desc:"DNA methylation",           id:"methylation" },
                { icon:"🦠", label:"Microbiome",          desc:"Microbial profiling",        id:"microbiome" },
                { icon:"🔩", label:"Proteomics",          desc:"Mass spec quantification",  id:"proteomics" },
                { icon:"🗺️", label:"Spatial",             desc:"Spatial transcriptomics",   id:"spatial_transcriptomics" },
                { icon:"🔗", label:"Multi-omics",         desc:"Integrative analysis",      id:"multiomics" },
              ].map(t => (
                <a key={t.label} href={`/science#${t.id}`}
                  style={{ display:"block", padding:"10px 8px", borderRadius:10, border:"1px solid #f1f5f9", textDecoration:"none" }}>
                  <div style={{ fontSize:18, marginBottom:5 }}>{t.icon}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:"#1e293b", lineHeight:1.3 }}>{t.label}</div>
                  <div style={{ fontSize:9, color:"#94a3b8", marginTop:2, lineHeight:1.3 }}>{t.desc}</div>
                </a>
              ))}
            </div>
            <div style={{ marginTop:14, padding:"9px 12px", borderRadius:10, background:"#f8fafc", display:"flex", alignItems:"center", justifyContent:"center", gap:18 }}>
              {["🛡️ Privacy-first","🔒 Secure","💻 Local Processing"].map(s => (
                <span key={s} style={{ fontSize:10, color:"#64748b", fontWeight:600 }}>{s}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Replicate a Paper ──────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-8 pb-10" style={{ borderTop: "1px solid var(--border)", paddingTop: 40 }}>
        {/* Section header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 18, marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, flexShrink: 0,
            background: "linear-gradient(135deg, #fff0e8, #ffd4bc)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
          }}>📄</div>
          <div>
            <h2 className="text-xl font-semibold" style={{ color: "var(--text)" }}>Replicate a Paper</h2>
            <p className="text-sm mt-1" style={{ color: "var(--muted)", lineHeight: 1.6, maxWidth: 620 }}>
              Have you read a paper and want to replicate their analysis? Paste the abstract or
              methods section below — we identify every analysis type performed, extract code &amp;
              repository links (including figure scripts), detect what visualizations were made,
              and let you run the exact same workflow on your own data.
            </p>
          </div>
        </div>

        {!paperResult ? (
          /* Input state */
          <div>
            {/* Mode tabs */}
            <div style={{ display:"flex", gap:2, marginBottom:14, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:4, width:"fit-content" }}>
              {(["paste","pmid","doi","upload"] as const).map(m => (
                <button key={m} onClick={() => { setPaperMode(m); setFetchError(null); }}
                  style={{ padding:"7px 16px", borderRadius:9, fontSize:12, fontWeight:600, border:"none", cursor:"pointer", transition:"all 0.15s",
                    background: paperMode===m ? "var(--flame)" : "transparent",
                    color: paperMode===m ? "#fff" : "var(--muted)" }}>
                  {m==="paste"?"Paste Text":m==="pmid"?"PubMed PMID":m==="doi"?"DOI":"Upload PDF / TXT"}
                </button>
              ))}
            </div>

            {/* PMID row */}
            {paperMode === "pmid" && (
              <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                <input value={pmidInput} onChange={e=>setPmidInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&fetchByPmid()}
                  placeholder="e.g. 34616062"
                  style={{ flex:1, padding:"11px 14px", borderRadius:10, fontSize:13, background:"var(--surface)", border:"1.5px solid var(--border)", color:"var(--text)", outline:"none" }} />
                <button onClick={fetchByPmid} disabled={fetchLoading||!pmidInput.trim()}
                  style={{ padding:"11px 22px", borderRadius:10, background:"var(--flame)", color:"#fff", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", opacity:fetchLoading||!pmidInput.trim()?0.5:1 }}>
                  {fetchLoading?"Fetching...":"Fetch Abstract →"}
                </button>
              </div>
            )}

            {/* DOI row */}
            {paperMode === "doi" && (
              <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                <input value={doiInput} onChange={e=>setDoiInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&fetchByDoi()}
                  placeholder="e.g. 10.1038/s41586-021-03544-w  or  https://doi.org/10.1038/..."
                  style={{ flex:1, padding:"11px 14px", borderRadius:10, fontSize:13, background:"var(--surface)", border:"1.5px solid var(--border)", color:"var(--text)", outline:"none" }} />
                <button onClick={fetchByDoi} disabled={fetchLoading||!doiInput.trim()}
                  style={{ padding:"11px 22px", borderRadius:10, background:"var(--flame)", color:"#fff", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", opacity:fetchLoading||!doiInput.trim()?0.5:1 }}>
                  {fetchLoading?"Fetching...":"Fetch via CrossRef →"}
                </button>
              </div>
            )}

            {/* Upload row */}
            {paperMode === "upload" && (
              <label style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, padding:28, borderRadius:14, border:"2px dashed var(--border)", cursor:"pointer", background:"var(--surface)", marginBottom:12 }}>
                <span style={{ fontSize:30 }}>📄</span>
                <span style={{ fontSize:13, color:"var(--muted)", fontWeight:600 }}>Click to upload PDF or TXT file</span>
                <span style={{ fontSize:11, color:"var(--dim)", textAlign:"center", maxWidth:380 }}>
                  .txt files: text extracted automatically. PDFs: paste the Methods section below or use PMID/DOI for instant fetch.
                </span>
                <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md" style={{ display:"none" }} onChange={handleFileUpload} />
              </label>
            )}

            {fetchError && (
              <div style={{ marginBottom:12, padding:"10px 14px", borderRadius:10, background:"#fff0f0", border:"1px solid #fca5a5", color:"#dc2626", fontSize:12 }}>
                {fetchError}
              </div>
            )}

            <textarea
              value={paperText}
              onChange={e => setPaperText(e.target.value)}
              rows={paperMode==="paste" ? 7 : 4}
              placeholder={
                paperMode==="pmid" ? "Abstract will appear here after fetching — you can also edit or add the methods section..." :
                paperMode==="doi"  ? "Metadata & abstract will appear here after fetching from CrossRef..." :
                paperMode==="upload" ? "Extracted text will appear here, or paste additional context..." :
                "Paste the paper abstract or methods section here...\n\ne.g. \"...total RNA was extracted... aligned with STAR 2.7.9... DESeq2 (v1.40)... code at github.com/author/repo... UMAP computed using SCANPY...\""
              }
              style={{
                width: "100%", padding: "14px 16px", borderRadius: 14, fontSize: 13,
                lineHeight: 1.65, resize: "vertical", boxSizing: "border-box",
                background: "var(--surface)", border: "1.5px solid var(--border)",
                color: "var(--text)", outline: "none", fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
              <span style={{ fontSize: 11, color: "var(--dim)" }}>
                {paperMode==="pmid"?"PubMed eutils API · free, no key needed":paperMode==="doi"?"CrossRef API · free, no key needed":paperMode==="upload"?"File read in your browser · nothing uploaded":"Methods, abstract, or supplementary text · parsed entirely in your browser"}
              </span>
              <button
                onClick={() => {
                  if (!paperText.trim()) return;
                  const result = analysePaper(paperText);
                  setPaperResult(result);
                  setSelectedAnalyses(result.analyses.map(a => a.id));
                }}
                disabled={!paperText.trim()}
                style={{
                  padding: "10px 24px", borderRadius: 12, fontWeight: 700, fontSize: 13,
                  background: paperText.trim() ? "var(--flame)" : "var(--border)",
                  color: paperText.trim() ? "#fff" : "var(--muted)",
                  border: "none", cursor: paperText.trim() ? "pointer" : "default",
                  transition: "all 0.15s", boxShadow: paperText.trim() ? "0 3px 10px rgba(240,88,8,0.2)" : "none",
                }}>
                Analyse Paper →
              </button>
            </div>
          </div>
        ) : (
          /* Results state */
          <div>
            {/* Summary bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 18,
              padding: "10px 14px", borderRadius: 10,
              background: "var(--surface)", border: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: 13, color: "var(--muted)", flex: 1 }}>
                Found&nbsp;
                <strong style={{ color: "var(--flame)" }}>{paperResult.analyses.length} pipeline{paperResult.analyses.length !== 1 ? "s" : ""}</strong>,&nbsp;
                <strong style={{ color: "#7c3aed" }}>{paperResult.codeLinks.length} code link{paperResult.codeLinks.length !== 1 ? "s" : ""}</strong>,&nbsp;
                <strong style={{ color: "var(--amber)" }}>{paperResult.vizTypes.length} figure type{paperResult.vizTypes.length !== 1 ? "s" : ""}</strong>
              </span>
              <button
                onClick={() => { setPaperResult(null); setPaperText(""); setSelectedAnalyses([]); }}
                style={{
                  fontSize: 12, padding: "4px 12px", borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--canvas)",
                  color: "var(--muted)", cursor: "pointer",
                }}>
                ← Paste another paper
              </button>
            </div>

            {/* Three columns */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 18 }}>

              {/* Analyses */}
              <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--flame)", marginBottom: 10 }}>
                  🔬 Analyses found ({paperResult.analyses.length})
                </div>
                {paperResult.analyses.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--dim)", lineHeight: 1.5 }}>
                    No known analysis types detected. Try pasting the full methods section.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {paperResult.analyses.map(a => {
                      const sel = selectedAnalyses.includes(a.id);
                      return (
                        <label key={a.id} style={{
                          display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                          padding: "7px 8px", borderRadius: 8,
                          background: sel ? "#fff8f3" : "transparent",
                          border: `1px solid ${sel ? "#ffd4bc" : "transparent"}`,
                          transition: "all 0.12s",
                        }}>
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => setSelectedAnalyses(prev =>
                              prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]
                            )}
                            style={{ accentColor: "var(--flame)", width: 14, height: 14, flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 15 }}>{a.icon}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: sel ? "var(--flame)" : "var(--text)" }}>
                            {a.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Code & Repo links */}
              <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7c3aed", marginBottom: 10 }}>
                  💻 Code & Repository links ({paperResult.codeLinks.length})
                </div>
                {paperResult.codeLinks.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--dim)", lineHeight: 1.5 }}>
                    No repository links found. Code may be in supplementary files or not publicly shared.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {paperResult.codeLinks.map((link, i) => (
                      <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                        style={{
                          display: "flex", alignItems: "center", gap: 7,
                          padding: "7px 9px", borderRadius: 8,
                          background: "#f5f3ff", border: "1px solid #e9d5ff",
                          textDecoration: "none", overflow: "hidden",
                        }}>
                        <span style={{
                          fontSize: 10, padding: "2px 7px", borderRadius: 5, flexShrink: 0,
                          background: "#7c3aed", color: "#fff", fontWeight: 700,
                        }}>{link.type}</span>
                        <span style={{
                          fontSize: 11, color: "#6d28d9", fontWeight: 500,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1,
                        }}>{link.label}</span>
                        <span style={{ fontSize: 10, color: "#a78bfa", flexShrink: 0 }}>↗</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Figures & visualizations */}
              <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--amber)", marginBottom: 10 }}>
                  📊 Figures & Visualizations ({paperResult.vizTypes.length})
                </div>
                {paperResult.vizTypes.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--dim)", lineHeight: 1.5 }}>
                    No figure types detected. Try including figure captions or results section.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {paperResult.vizTypes.map((v, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text)", padding: "4px 6px" }}>
                        <span style={{ color: "var(--amber)", flexShrink: 0 }}>▸</span>
                        {v}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Launch strip */}
            {selectedAnalyses.length > 0 && (
              <div style={{
                padding: "14px 18px", borderRadius: 14,
                background: "#fff8f3", border: "1.5px solid #ffd4bc",
                display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
              }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--flame)" }}>
                    Ready to replicate — {selectedAnalyses.length} analysis{selectedAnalyses.length !== 1 ? "es" : ""} selected
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                    You&apos;ll provide your own data in the next step. Everything stays on your machine.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {selectedAnalyses.slice(0, 3).map(id => {
                    const p = PAPER_PIPELINES.find(x => x.id === id);
                    return p ? (
                      <a key={id}
                        href={`/launch?type=${id}&mode=paper`}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "8px 16px", borderRadius: 10,
                          background: "var(--flame)", color: "#fff",
                          fontWeight: 700, fontSize: 12, textDecoration: "none",
                          boxShadow: "0 3px 10px rgba(240,88,8,0.2)",
                          whiteSpace: "nowrap",
                        }}>
                        {p.icon} Run {p.label.split(" ·")[0]} →
                      </a>
                    ) : null;
                  })}
                  {selectedAnalyses.length > 3 && (
                    <a href={`/launch?type=${selectedAnalyses[0]}&mode=paper`}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "8px 16px", borderRadius: 10,
                        border: "1.5px solid var(--flame)", color: "var(--flame)",
                        fontWeight: 700, fontSize: 12, textDecoration: "none",
                        background: "#fff", whiteSpace: "nowrap",
                      }}>
                      +{selectedAnalyses.length - 3} more →
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Chat suggester */}
      <section className="max-w-5xl mx-auto px-8 pb-10" style={{ borderTop: "1px solid var(--border)", paddingTop: 32 }}>
        <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--text)" }}>Not sure where to start?</h2>
        <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
          Describe your data or research goal and we&apos;ll point you to the right pipeline.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={chatRef}
            value={chatQuery}
            onChange={e => handleChat(e.target.value)}
            placeholder='e.g. "I have single-cell RNA data from tumor samples" or "looking for structural variants in cancer"'
            style={{
              flex: 1, padding: "11px 14px", borderRadius: 12, fontSize: 14,
              background: "var(--surface)", border: "1px solid var(--border)",
              color: "var(--text)", outline: "none",
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && suggestion) {
                setOpenTool(suggestion.id);
                document.getElementById(suggestion.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
          />
          <button
            onClick={() => {
              if (suggestion) {
                setOpenTool(suggestion.id);
                document.getElementById(suggestion.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
            style={{
              padding: "11px 20px", borderRadius: 12, fontWeight: 700, fontSize: 13,
              background: suggestion ? "var(--flame)" : "var(--border)",
              color: suggestion ? "#fff" : "var(--muted)", border: "none", cursor: suggestion ? "pointer" : "default",
              transition: "all 0.15s",
            }}>
            Find Pipeline →
          </button>
        </div>

        {suggestion && (
          <div style={{
            marginTop: 10, padding: "10px 14px", borderRadius: 10,
            background: "#fff8f3", border: "1px solid #ffd4bc",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>{suggestion.icon}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "var(--flame)" }}>{suggestion.label}</span>
              <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 6 }}>— {suggestion.reason}</span>
            </div>
            <button
              onClick={() => {
                setOpenTool(suggestion.id);
                document.getElementById(suggestion.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: "var(--flame)", color: "#fff", border: "none", cursor: "pointer",
              }}>
              Show me ↓
            </button>
          </div>
        )}
      </section>

      {/* Tool accordion */}
      <section className="max-w-5xl mx-auto px-8 py-10 pb-24">
        <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--text)" }}>Available Pipelines</h2>
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
          Click any pipeline to see what data you need and what you will get out.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {TOOLS.map(t => {
            const isOpen = openTool === t.id;
            return (
              <div key={t.id} id={t.id} style={{
                borderRadius: 14,
                border: `1px solid ${isOpen ? "var(--flame)" : "var(--border)"}`,
                background: isOpen ? "#fff8f3" : "var(--surface)",
                overflow: "hidden",
                transition: "border-color 0.18s, background 0.18s",
              }}>
                {/* Row header — always visible */}
                <button
                  onClick={() => setOpenTool(isOpen ? null : t.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center",
                    gap: 12, padding: "14px 16px",
                    background: "none", border: "none", cursor: "pointer", textAlign: "left",
                  }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{t.icon}</span>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: isOpen ? "var(--flame)" : "var(--text)" }}>
                      {t.label}
                    </div>
                    <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
                      {t.tags.map(tag => (
                        <span key={tag} style={{
                          fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 600,
                          background: isOpen ? "#ffd4bc" : "var(--border)",
                          color: isOpen ? "var(--flame)" : "var(--muted)",
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>⏱ {t.time}</span>
                    <span style={{
                      fontSize: 13, color: "var(--muted)", transition: "transform 0.2s",
                      transform: isOpen ? "rotate(180deg)" : "none",
                      display: "inline-block",
                    }}>▼</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ padding: "0 16px 18px 52px", display: "flex", flexDirection: "column", gap: 14 }}>

                    {/* Data needed */}
                    <div>
                      <div style={{
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.08em", color: "var(--flame)", marginBottom: 5,
                      }}>
                        📁 What data do you need?
                      </div>
                      {t.id === "multiomics" ? (
                        <div>
                          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10, lineHeight: 1.5 }}>
                            Select which omic layers you have. Each must share the same sample IDs.
                          </p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {MULTI_LAYER_OPTIONS.map(opt => {
                              const selected = multiLayers.includes(opt.id);
                              return (
                                <button
                                  key={opt.id}
                                  onClick={() => toggleLayer(opt.id)}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 6,
                                    padding: "7px 14px", borderRadius: 10, cursor: "pointer",
                                    fontSize: 12, fontWeight: 600, border: "1.5px solid",
                                    borderColor: selected ? "var(--flame)" : "var(--border)",
                                    background: selected ? "#fff8f3" : "var(--canvas)",
                                    color: selected ? "var(--flame)" : "var(--muted)",
                                    transition: "all 0.15s",
                                  }}>
                                  <span>{opt.icon}</span>
                                  <span>{opt.label}</span>
                                  {selected && <span style={{ fontSize: 10, marginLeft: 2, color: "var(--flame)" }}>✓</span>}
                                </button>
                              );
                            })}
                          </div>
                          {multiLayers.length < 2 && (
                            <p style={{ fontSize: 11, color: "#dc2626", marginTop: 8 }}>Select at least 2 omic layers to integrate.</p>
                          )}
                        </div>
                      ) : (
                        <div style={{
                          fontSize: 13, color: "var(--text)", lineHeight: 1.65,
                          background: "#fff", borderRadius: 8, padding: "10px 12px",
                          border: "1px solid #ffd4bc",
                        }}>
                          {t.data_needed}
                        </div>
                      )}
                    </div>

                    {/* Application */}
                    <div>
                      <div style={{
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 5,
                      }}>
                        🔬 What is it used for?
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.65 }}>
                        {t.application}
                      </div>
                    </div>

                    {/* Output + tools row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 5 }}>
                          📊 Outputs
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.7 }}>
                          {t.output.split(" · ").map((o, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
                              <span style={{ color: "var(--flame)", marginTop: 1 }}>▸</span>
                              <span>{o}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 5 }}>
                          🔧 Key tools
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {t.tools_used.map(tool => (
                            <span key={tool} style={{
                              fontSize: 11, padding: "3px 8px", borderRadius: 8,
                              background: "var(--canvas)", border: "1px solid var(--border)",
                              color: "var(--text)", fontFamily: "monospace",
                            }}>
                              {tool}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Launch button */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <a
                        href={t.id === "multiomics"
                          ? `/launch?type=multiomics&layers=${multiLayers.join(",")}`
                          : `/launch?type=${t.id}`}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "9px 20px", borderRadius: 10,
                          background: (t.id === "multiomics" && multiLayers.length < 2) ? "var(--border)" : "var(--flame)",
                          color: (t.id === "multiomics" && multiLayers.length < 2) ? "var(--muted)" : "#fff",
                          fontWeight: 700, fontSize: 13, textDecoration: "none",
                          boxShadow: "0 2px 8px rgba(240,88,8,0.2)",
                          pointerEvents: (t.id === "multiomics" && multiLayers.length < 2) ? "none" : "auto",
                        }}>
                        🚀 Launch this pipeline
                      </a>
                      <a href="/connect"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "9px 20px", borderRadius: 10,
                          border: "1.5px solid var(--border)", color: "var(--muted)",
                          fontWeight: 600, fontSize: 13, textDecoration: "none",
                          background: "var(--canvas)",
                        }}>
                        🔗 Connect HPC / Cloud
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
