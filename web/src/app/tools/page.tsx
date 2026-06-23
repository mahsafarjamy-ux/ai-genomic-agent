"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import NavBar from "@/components/NavBar";
import { useAuthOptional, type AuthUser } from "@/hooks/useAuthOptional";

const FlowCytoWizard = dynamic(
  () => import("@/components/FlowCytoWizard"),
  { ssr: false, loading: () => <div className="py-10 text-center text-sm" style={{ color: "var(--muted)" }}>Loading module…</div> }
);

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Analysis Types ────────────────────────────────────────────────────────────

const ANALYSIS_TYPES = [
  { id: "flow_cytometry",  label: "Flow Cytometry",       icon: "🔴", wizard: true },
  { id: "rnaseq",          label: "RNA-seq",               icon: "🧬" },
  { id: "wgs",             label: "WGS",                   icon: "🔬" },
  { id: "wes",             label: "WES / Exome",           icon: "🎯" },
  { id: "scrnaseq",        label: "scRNA-seq",             icon: "🔵" },
  { id: "methylation",     label: "Methylation",           icon: "🧪" },
  { id: "chipseq",         label: "ChIP-seq",              icon: "📍" },
  { id: "atacseq",         label: "ATAC-seq",              icon: "🌊" },
  { id: "immune_profiling",label: "Immune Profiling",      icon: "🛡️" },
  { id: "ctdna",           label: "ctDNA / cfDNA",         icon: "💧" },
  { id: "microbiome",      label: "Microbiome",            icon: "🦠" },
  { id: "riboseq",         label: "Ribo-seq",              icon: "⚙️" },
  { id: "proteomics",      label: "Proteomics",            icon: "🔩" },
  { id: "multiomics",      label: "Multi-Omics",           icon: "🔗" },
  { id: "spatial",         label: "Spatial / Pathology",   icon: "🗺️" },
  { id: "dark_genome",     label: "Dark Genome",           icon: "🌑" },
  { id: "phylogenetics",   label: "Phylogenetics",         icon: "🌳" },
];

// ─── Per-tool FAQ ──────────────────────────────────────────────────────────────

const FAQS: Record<string, { q: string; a: string }[]> = {
  flow_cytometry: [
    { q: "How do I know my gate boundaries are correct?", a: "Use a biologically anchored control: an unstained sample (or FMO) to set the negative boundary, and a positive reference for the upper boundary. If populations overlap, check % of parent consistency across replicates — stable values indicate robust gating. Fluorescence-minus-one (FMO) controls are the gold standard for every channel." },
    { q: "Which transform should I choose?", a: "Logicle is the gold standard for fluorescence channels and handles negative values well. Use Linear for FSC/SSC (scatter) channels. ArcSinh (cofactor 5 for CyTOF, 150 for fluorescence) is preferred for mass cytometry data." },
    { q: "My FCS file loads but shows no events — what's wrong?", a: "Check that the file version is FCS 2.0, 3.0, or 3.1. Some instruments export proprietary formats (BD FCS 3.2 with non-standard headers). Re-export from your acquisition software as standard FCS 3.1 and reload. Also verify the file is not corrupted (file size should match expected event count × parameter count × bytes per parameter)." },
    { q: "How do I interpret % of parent vs. % of total in my results?", a: "% of parent = fraction within the immediate parent gate (use this for immunophenotyping reports and gating hierarchies). % of total = fraction of all acquired events (use this to compare absolute cell type prevalence across samples or conditions)." },
    { q: "Does my data leave my computer?", a: "No. FCS files stay entirely on your machine. Only gating coordinates and aggregated cell counts are stored in the local database — never raw events." },
  ],
  rnaseq: [
    { q: "How do I interpret adjusted p-value (padj) in my DESeq2 results?", a: "padj is the p-value corrected for multiple testing (Benjamini-Hochberg). padj < 0.05 means you expect fewer than 5% of your significant genes to be false positives. For small samples, relax to padj < 0.1. For large cohorts, also apply a fold-change cutoff (|log2FC| > 1 = 2× change) to focus on biologically meaningful changes." },
    { q: "My volcano plot shows thousands of significant genes — is that normal?", a: "Yes, for large sample sizes or strong biological signals. Narrow down by applying |log2FC| > 1 alongside padj < 0.05. For pathway analysis, rank genes by |log2FC| × −log10(padj) and focus on the top 50–100. A high number of significant genes often signals a broad transcriptional response — check if your groups differ by cell cycle, immune infiltration, or batch effects." },
    { q: "DESeq2 or edgeR?", a: "Both are excellent. DESeq2 is the most-cited and slightly more conservative. edgeR handles very small sample sizes (n = 2 per group) better. Use DESeq2 as your default; switch to edgeR if you have very few replicates or highly variable data." },
    { q: "How many replicates do I need?", a: "At minimum 3 per condition. 5–6 replicates give substantially better power for detecting small fold changes (< 1.5×). For clinical samples with inter-individual variability, aim for ≥ 5 per group. Power analyses (RNASeqPower, pwr) can tell you the exact n for your expected effect size." },
    { q: "Salmon vs. STAR — which quantification should I use?", a: "Salmon (quasi-mapping) is 20–30× faster and sufficient for differential expression. Use STAR when you need to: visualize alignments in IGV, detect novel splice junctions, run tools that require a BAM file (e.g., GATK, RseQC), or quantify structural variants." },
  ],
  wgs: [
    { q: "What coverage depth do I need?", a: "30× for germline variant calling. 60–100× for somatic mutation detection (cancer). 5–10× for CNV-only or population allele frequency studies. Low-pass WGS at 1–5× with imputation is increasingly used for large population cohorts — discuss with your bioinformatician before sequencing." },
    { q: "My results show variants marked VQSR FAIL — should I use them?", a: "VQSR FAIL variants have patterns resembling known false positives (strand bias, low mapping quality, clustering near indels). Exclude them for clinical reporting. For discovery research, you may retain them as 'candidate' variants, but they require independent validation. Your primary analysis set should use FILTER = PASS variants only." },
    { q: "GATK HaplotypeCaller or DeepVariant?", a: "GATK HaplotypeCaller is the clinical standard and most widely validated. DeepVariant (Google) has marginally better recall on PCR-free Illumina data. Use HaplotypeCaller for clinical workflows; consider DeepVariant for high-accuracy research cohorts or PacBio/ONT long-read data." },
    { q: "How do I prioritize variants in my annotated output?", a: "Start with PASS variants → filter by population frequency (gnomAD AF < 0.01 for rare disease, < 0.001 for dominant) → keep protein-altering effects (missense, nonsense, splice) → cross-reference ClinVar pathogenic/likely pathogenic. For cancer: sort by COSMIC tier and variant allele frequency. CADD score > 20 is a useful pathogenicity filter." },
  ],
  wes: [
    { q: "My on-target rate is under 70% — what went wrong?", a: "Common causes: degraded DNA input (check with Bioanalyzer/TapeStation before capture), incorrect capture kit BED file (must match the exact kit version and genome build used), or low adapter ligation efficiency. Values of 85%+ are expected. Re-sequencing is advisable below 60%; investigate the library prep protocol if you see this consistently." },
    { q: "Can I detect somatic variants from WES?", a: "Yes, with a matched normal sample using Mutect2. WES has lower sensitivity than WGS for somatic mutations in intronic/intergenic regions, SVs, and variants in poorly captured target regions. For high-sensitivity tumor analysis, consider a targeted panel with deeper coverage instead." },
    { q: "How do I filter my variant list for a rare disease case?", a: "Filter to: PASS, population AF < 0.01 in gnomAD (< 0.001 for autosomal dominant), protein-altering consequence (missense/nonsense/splice), in genes from your phenotype-matched gene panel (OMIM, PanelApp). Apply inheritance models (de novo for trio, homozygous, compound heterozygous). Rank remaining variants by CADD score > 20." },
    { q: "What capture kits are supported?", a: "Any BED file defining your target regions is accepted. If you don't have the BED file, download it from the vendor: Agilent SureSelect, Twist Bioscience, or IDT xGen all provide BED files per kit version. Match the BED to your genome build (hg38 vs. hg19) — mismatches cause 30–50% drops in apparent on-target rate." },
  ],
  scrnaseq: [
    { q: "My UMAP shows one big blob with no cluster structure — what does that mean?", a: "Usually means insufficient variation, over-filtering, or missing batch correction. Try: increase PCA components (use 30–50 instead of default 10–20), verify your QC thresholds aren't removing too many cells, check that cells from different samples/batches need integration (Harmony, BBKNN, Scanorama). Homogeneous tissues also genuinely produce sparse UMAPs." },
    { q: "Many cells have high mitochondrial % — what does that indicate?", a: "High mitochondrial % (> 20–30%) suggests stressed or dying cells — cytoplasmic RNA has leaked, leaving mitochondrial RNA over-represented. Exclude cells above your threshold (typically 20% for most tissues, up to 50% for heart or muscle). If your entire sample is > 30%, the dissociation protocol needs optimization — re-process with a gentler enzyme or reduce incubation time." },
    { q: "How do I choose the right clustering resolution?", a: "Start at 0.5. Increase for more subtypes (0.8–2.0 for fine-grained immune profiling). Decrease for broad cell categories (0.2–0.4). The right resolution is when each cluster has a clear set of unique marker genes. Check using FindAllMarkers (Seurat) or rank_genes_groups (Scanpy) — clusters without unique markers should be merged." },
    { q: "Seurat vs. Scanpy?", a: "Seurat (R) has the largest community, most tutorials, and the most integrated single-cell ecosystem. Scanpy (Python) scales better to millions of cells and integrates with deep learning frameworks. This platform supports both through the backend API — choose based on your team's language preference." },
  ],
  methylation: [
    { q: "My bisulfite conversion rate is below 95% — is my data usable?", a: "Below 95% is a warning sign; below 90% makes your data unreliable (unconverted cytosines read as methylated, inflating methylation calls). Check your spike-in control (lambda phage DNA should show < 1% methylation). If no control was included, samples below 95% should be re-treated or excluded. Good experiments typically achieve 98–99.5% conversion." },
    { q: "How do I interpret a significant DMR in my results?", a: "A robust DMR requires: ≥ 10% methylation difference between groups, padj < 0.05 after multiple testing, and ≥ 3 consecutive significant CpGs. Check the direction: promoter hypomethylation typically activates gene expression; gene body methylation often correlates positively with expression. Annotate with ENCODE regulatory elements to assess functional context." },
    { q: "WGBS vs. RRBS vs. 450K/EPIC arrays?", a: "WGBS: complete genome-wide CpG coverage, expensive ($500–1,500/sample). RRBS: cost-effective, targets CpG-rich regions. 450K/EPIC arrays: cheapest ($200–300/sample), cover 850K CpGs, best for clinical studies with large reference datasets (GEO, TCGA). Choose arrays for cohorts > 50 samples where cost matters; use WGBS for comprehensive coverage." },
  ],
  chipseq: [
    { q: "I forgot to include an input control — can I still call peaks?", a: "You can call peaks using MACS3 with --nolambda, but false positive rates are higher near repetitive elements and high-GC regions. Use IgG control as a proxy if available. Without any control, validate called peaks by checking overlap with publicly available data for your factor/histone mark (ENCODE, Cistrome) and by motif enrichment — real TF peaks show motif enrichment > 60%." },
    { q: "Narrow vs. broad peaks — how do I know which to use?", a: "Narrow peaks (MACS3 default): TF binding sites and H3K4me3 (active promoters) — typical width 200–500 bp. Broad peaks (MACS3 --broad or SICER2): H3K27me3, H3K9me3, H3K36me3 — typical width 1–10 kb. When unsure, call narrow first and examine the width distribution in your BED output. Median peak width > 1 kb suggests broad marks." },
    { q: "How many reads do I need?", a: "20–40 million uniquely mapped reads for TF ChIP-seq. Broad histone marks need 40–60 million. Sequence the input control to at least the same depth as the IP. Check NRF (non-redundant fraction) and PCR bottleneck coefficient before deep sequencing — if NRF < 0.5, more sequencing won't help, the library complexity is the bottleneck." },
  ],
  atacseq: [
    { q: "How do I interpret peak scores in my output?", a: "Peak score (−log10 q-value from MACS3) indicates statistical confidence. Scores > 5 are high-confidence open chromatin; scores > 10 are the most robust peaks. For downstream TF footprinting and motif analysis, filter to the top 50,000–100,000 peaks by score. The total peak count in a well-prepared ATAC library is typically 80,000–150,000 for human samples." },
    { q: "Why do I see periodic nucleosome banding in my fragment size distribution?", a: "This is expected and a sign of a successful experiment. ATAC fragments align in nucleosome-sized increments: sub-nucleosomal (< 100 bp, TF binding sites), mono-nucleosome (~200 bp), di-nucleosome (~400 bp). A clear multi-modal distribution means Tn5 digestion worked correctly. A single broad peak or no banding suggests over- or under-digestion." },
    { q: "My peaks overlap known enhancers — how do I identify which TFs are bound?", a: "Use TOBIAS for bias-corrected footprinting: it scores each TF motif within your peaks by the ratio of Tn5 cuts surrounding vs. within the motif binding site. Alternatively, motif enrichment with HOMER or MEME-ChIP identifies which motifs are over-represented in your peaks. For direct TF binding validation, pair with CUT&RUN or CUT&TAG for the TF of interest." },
  ],
  immune_profiling: [
    { q: "How do I interpret clonal expansion in my results?", a: "Expanded clones (high-frequency clonotypes) indicate antigen-driven selection — common in infections, vaccination responses, and tumor-infiltrating lymphocytes. A top-10 clone frequency sum > 30% of the repertoire indicates oligoclonal expansion. Compare clonotype overlap between timepoints (Jaccard similarity, Morisita overlap) to track antigen-specific clone persistence." },
    { q: "Can I use bulk RNA-seq data for immune profiling?", a: "Yes — TRUST4 and MiXCR reconstruct TCR/BCR sequences from bulk RNA-seq reads mapping to the V(D)J locus. You need ≥ 50 million reads for reasonable sensitivity. This is lower sensitivity than dedicated amplicon sequencing but allows immune profiling from existing RNA-seq data without additional sequencing cost." },
    { q: "My Shannon entropy is high but clonality is low — what does that mean?", a: "High Shannon entropy + low clonality = highly diverse repertoire with no dominant clones (healthy steady-state or polyclonal response). Low entropy + high clonality = oligoclonal expansion. For tumor-infiltrating lymphocytes, high clonality (oligoclonal, antigen-experienced T cells) correlates with response to immune checkpoint therapy." },
  ],
  ctdna: [
    { q: "My VAF results are near the detection limit — how confident should I be?", a: "At VAF < 0.1%, technical noise is significant. Confidence depends on: sequencing depth at that site (≥ 10,000× recommended), unique molecular identifier (UMI) support (each unique molecule counted only once), and whether the variant was first identified in a tissue biopsy. Report as 'detected, low confidence — confirm with orthogonal method or follow-up draw'." },
    { q: "How sensitive is ctDNA detection in practice?", a: "Modern UMI-based assays detect VAF as low as 0.01–0.1%. Sensitivity depends on tumor type (hematologic >> solid tumor), stage (stage IV much higher shedding than stage I), and cfDNA input (use ≥ 30 ng). Early-stage solid tumors can be ctDNA-negative in > 40% of cases even with active disease." },
    { q: "How do I track treatment response using serial ctDNA results?", a: "Plot VAF or ctDNA fraction against treatment timeline. A ≥ 10-fold decrease within 1–3 cycles indicates response. Rising ctDNA (molecular relapse) typically precedes radiographic progression by 1–6 months. Use the same assay, same target variants, and the same analytical pipeline across all timepoints — cross-platform comparisons are unreliable." },
  ],
  microbiome: [
    { q: "16S rRNA vs. shotgun metagenomics — which should I use?", a: "16S targets a conserved bacterial gene (cheaper, ~$50–100/sample), identifies bacteria to genus level, but misses fungi/viruses and gives no functional data. Shotgun sequences all DNA (~$200–500/sample), gives species-level taxonomy, functional gene content, and detects all kingdoms. Use 16S for large cohort surveys (n > 50); use shotgun when function or non-bacterial kingdoms matter." },
    { q: "My PCoA shows clear separation between groups — how do I test if it's significant?", a: "Use PERMANOVA (adonis2 in vegan R package) on your distance matrix (UniFrac or Bray-Curtis). Report both p-value (< 0.05 = statistically significant) and R² (effect size — how much variance is explained by your grouping). In large cohorts, even tiny R² (< 0.02) can be statistically significant — always report the effect size, not just p-value." },
    { q: "Why is microbiome composition so variable between samples?", a: "Biological variability is genuinely high. Host genetics, diet, antibiotics in the last 6 months, stool collection time, and DNA extraction method all contribute. Stool composition can vary > 50% day-to-day in the same person. Design studies with ≥ 20 subjects per group, match sampling protocols, and include co-variates (BMI, antibiotics, geography) in your statistical model." },
  ],
  riboseq: [
    { q: "How do I interpret high translation efficiency (TE) for a gene?", a: "High TE means many ribosomes per mRNA molecule — efficient active translation. Compare TE across conditions using anota2seq or Xtail, which separate translational regulation from mRNA changes. A gene with stable mRNA but increased TE under stress (e.g., ATF4 in the integrated stress response) is a key translational target. Check whether TE changes are concordant with protein abundance if proteomics data is available." },
    { q: "My RNA-seq looks normal but Ribo-seq RPF counts are low for a gene — why?", a: "Possible causes: upstream open reading frames (uORFs) titrating ribosomes before the main ORF; highly structured 5'UTR blocking initiation; ribosome drop-off on long transcripts; or the gene is regulated by IRES-dependent translation disrupted by your cycloheximide treatment. Check the metagene plot for ribosome accumulation patterns along the transcript." },
    { q: "Do I need matched RNA-seq for Ribo-seq analysis?", a: "Yes — always sequence a paired total RNA-seq library from the same sample. Without it, you cannot distinguish whether ribosome occupancy changes reflect mRNA abundance changes (transcriptional) or true translational regulation. Submit both libraries to GEO/SRA together when publishing." },
  ],
  proteomics: [
    { q: "Label-free (LFQ) vs. TMT/iTRAQ — which quantification strategy fits my experiment?", a: "LFQ: run each sample separately, compare by extracted ion chromatogram area. Simpler, lower cost, scales to any sample count. Best for < 6 samples or when samples must be processed at different times. TMT: multiplex 6–18 samples in one MS run, reducing missing values and run-to-run variation. Best for large cohorts or plasma samples with high protein complexity." },
    { q: "My protein list is very long — how do I set a meaningful FDR cutoff?", a: "Apply 1% FDR at both peptide and protein levels (target-decoy approach). At 1% protein FDR with 5,000 identified proteins, expect ~50 false positives. For clinical biomarker studies, tighten to 0.1% and require ≥ 2 unique peptides per protein. For a final discovery list, also filter by quantitative reproducibility (CV < 20% across replicates)." },
    { q: "MaxQuant or Proteome Discoverer or MSFragger?", a: "MaxQuant: free, the academic standard for LFQ and TMT on Orbitrap/TimsTOF. Proteome Discoverer: commercial Thermo GUI, tightly integrated with their instruments, best for clinical labs. MSFragger: fastest for large datasets or open/modification searches (finds unexpected PTMs). MSFragger + FragPipe is the best free alternative for high-throughput or DIA workflows." },
  ],
  multiomics: [
    { q: "How do I interpret a MOFA+ factor that explains 30% of variance?", a: "A 30% variance factor is a dominant signal in your data. Inspect top-weighted features (genes, peaks, CpGs) from each omics layer — run enrichment analysis (GSEA, GO) on the top 100 features per layer. Correlate the factor scores with clinical metadata (disease status, survival, treatment) to identify biological relevance. Factors correlating with technical variables (batch, sequencing depth) should be regressed out." },
    { q: "DIABLO vs. MOFA+ — which integration method fits my study?", a: "DIABLO is supervised (needs group labels) and selects features that best discriminate your groups — ideal for biomarker discovery with a defined clinical endpoint. MOFA+ is unsupervised and finds shared variation across layers without labels — ideal for exploratory discovery. Use DIABLO if you have a clear outcome variable; use MOFA+ if you want to discover hidden structure." },
    { q: "How do I handle missing data when some samples lack a full omics layer?", a: "MOFA+ explicitly models missing data — samples with missing layers still contribute to shared factor estimation. For simpler methods: restrict to complete cases (loses power), or impute missing values with KNN/softImpute before integration. If a large proportion of samples lack a layer (> 40%), consider a block-design analysis treating the missing layer as a separate subgroup." },
  ],
  spatial: [
    { q: "How do I identify cell type boundaries in my Visium data?", a: "Run spatial deconvolution (RCTD, cell2location) to map cell type proportions per spot, then visualize predictions overlaid on the H&E image. Boundaries between high-purity regions often correspond to known anatomical structures (tumor margin, cortical layers, follicle boundaries). Validate by checking spatial expression of canonical marker genes — they should co-localize with deconvolution predictions." },
    { q: "Visium vs. Xenium vs. MERFISH — how do I know which data I have?", a: "Visium: whole transcriptome, ~55 µm spots, 1–10 cells/spot, output is a spaceranger folder with barcodes.tsv/features.tsv/matrix.mtx. Xenium/MERFISH/CosMx: single-cell resolution, 100–5,000 gene panel, output is per-cell CSV with x/y coordinates. Check your sequencing report or instrument model — each platform has a distinct data format." },
    { q: "My deconvolution shows unexpected cell types in a region — should I trust it?", a: "Check three things: (1) Is that cell type in your single-cell reference? If absent, the algorithm assigns to the nearest similar type. (2) Does the canonical marker gene for that cell type show matching spatial expression? (3) Is the region near the tissue edge or an artifact zone? If markers agree with deconvolution predictions, trust the result — the biology may be genuinely surprising." },
  ],
  dark_genome: [
    { q: "How do I know which non-coding results in my output are biologically relevant?", a: "Prioritize by: conservation across mammals (PhastCons, PhyloP scores — highly conserved non-coding elements have higher functional importance), overlap with ENCODE regulatory annotations (promoters, enhancers, CTCF sites), expression correlation with neighboring protein-coding genes (cis-regulatory effect), and co-localization with GWAS risk loci. Focus experimental follow-up on elements passing multiple criteria." },
    { q: "My results show elevated TE expression — how do I distinguish signal from noise?", a: "Confirm by checking: (1) Multiple TE families showing coordinated upregulation (a single hit is more likely artifact). (2) Correlation with known TE-activating conditions (DNA methylation loss, DNMT1/DNMT3A loss, inflammation). (3) Multi-mapping handling — SalmonTE and TEtools handle multi-mappers properly; tools that discard multi-mapping reads will undercount TEs. (4) Independent validation by RT-PCR or FISH." },
    { q: "How do I determine if a lncRNA in my results is functionally important?", a: "Assess: (1) Subcellular localization (chromatin-associated lncRNAs often regulate nearby genes; cytoplasmic lncRNAs act post-transcriptionally). (2) Co-expression with nearby protein-coding genes (cis-regulation). (3) ENCODE ChIP-seq overlap to find associated chromatin regulators. (4) Conservation — most functional lncRNAs are conserved at the secondary structure or synteny level even if not at sequence level. CRISPRi is the gold standard for functional validation." },
  ],
  phylogenetics: [
    { q: "My tree has branches with low bootstrap support (< 50) — how should I interpret them?", a: "Branches with bootstrap < 50 are unresolved — the data is insufficient to confidently place those taxa. This occurs in fast-evolving sequences, short internodes, or conflicting signal across loci. In your final figure, collapse low-support branches into polytomies and note this in the methods. IQ-TREE2's ultrafast bootstrap (UFBoot) with --bnni correction provides more accurate support values than standard bootstrap." },
    { q: "How do I use my phylogenetic tree to estimate divergence times?", a: "Apply a molecular clock using BEAST2 or LSD2. You need ≥ 2–3 fossil calibration points or dated sequences (for viral evolution). Use a relaxed clock model (uncorrelated log-normal) unless strict clock assumptions are justified. BEAST2 outputs a posterior distribution of node ages — report the mean and 95% highest posterior density (HPD) interval, not a single value." },
    { q: "Maximum likelihood vs. Bayesian phylogenetics?", a: "ML (IQ-TREE2, RAxML-NG) is fast, scales to thousands of sequences, and is the standard for genomics-scale trees. Bayesian (BEAST, MrBayes) is slower but gives posterior probability credible intervals and allows molecular clock dating. Use ML for topology reconstruction and large datasets; use Bayesian when you need formal uncertainty quantification or temporal inference." },
  ],
};

// ─── Per-tool instructions ─────────────────────────────────────────────────────

const INSTRUCTIONS: Record<string, string[]> = {
  flow_cytometry: [
    "Load your FCS file — upload directly or point to a large file on disk (no upload needed for big files)",
    "Review auto-detected metadata: cytometer model, acquisition date, and channel list",
    "Select X and Y channels for your scatter plot (FSC-A vs SSC-A is the classic starting point)",
    "Choose a data transform — Logicle is recommended for fluorescence; Linear for scatter channels",
    "Draw gates interactively (rectangle or freehand polygon) to select cell populations of interest",
    "Chain gates to refine populations (e.g., gate on live cells first, then T cells, then CD4+ within those)",
    "Export results: CSV with event counts, percentages of parent, and percentages of total",
  ],
  rnaseq: [
    "Provide FASTQ files, or point to large files on your local disk using the path input",
    "Select a reference genome (hg38 for human, mm10 for mouse) and annotation GTF",
    "Configure QC thresholds and trimming settings (adapter type, minimum quality)",
    "Choose your quantification tool: Salmon (fast, DE-only) or STAR (alignment + splicing)",
    "Define sample groups and comparisons for differential expression",
    "Review QC report, then download: count matrix, DE results table, volcano plot, pathway enrichment",
  ],
  wgs: [
    "Provide FASTQ files or a pre-aligned BAM/CRAM file",
    "Select variant calling mode: germline (single sample) or somatic (requires matched normal)",
    "Configure filtering: VQSR (recommended for cohorts ≥ 30) or hard-filter thresholds",
    "Choose annotation databases: ClinVar, gnomAD, COSMIC, CADD score",
    "Download annotated VCF, filtered variant table, coverage statistics report",
  ],
  wes: [
    "Provide FASTQ files and specify your capture kit BED file (target regions)",
    "QC: review on-target rate, coverage uniformity, and duplication rate",
    "Variant calling: germline (HaplotypeCaller) or somatic paired (Mutect2)",
    "Annotate with ClinVar, dbSNP, COSMIC, and population frequency (gnomAD)",
    "Clinical filtering: apply inheritance models (dominant, recessive, de novo) for rare disease analysis",
  ],
  scrnaseq: [
    "Provide Cell Ranger output (barcodes.tsv, features.tsv, matrix.mtx) or raw FASTQ files",
    "QC filtering: remove low-quality cells (low UMI count, high mitochondrial %, doublets)",
    "Normalization and dimensionality reduction (PCA → UMAP/tSNE)",
    "Leiden/Louvain clustering — tune resolution parameter to your expected cell type granularity",
    "Cell type annotation: check marker genes against known markers or use SingleR / CellTypist",
    "Optional: trajectory analysis (Monocle3) or RNA velocity (scVelo) for developmental data",
  ],
};

// ─── Flow cytometry feature showcase (for unauthenticated users) ──────────────

const FLOW_FEATURES = [
  { icon: "📁", title: "Any size FCS file", desc: "Upload small files directly or open large files from your disk without moving them. FCS 2.0 / 3.0 / 3.1 supported." },
  { icon: "🔄", title: "5 data transforms", desc: "Logicle, Biexponential, ArcSinh, Log₁₀, or Linear — each explained in plain language so you can choose without prior expertise." },
  { icon: "⬜", title: "Interactive gating", desc: "Draw rectangle or polygon gates directly on the scatter plot. Chain gates to refine populations step by step." },
  { icon: "📊", title: "Export ready results", desc: "Download a CSV with event counts, % of parent, and % of total for every gate — ready for your paper or report." },
  { icon: "🔒", title: "Complete privacy", desc: "Raw event data never leaves your machine. Only aggregated statistics and gate coordinates are stored locally." },
];

// ─── Pipelines ────────────────────────────────────────────────────────────────

type Tool = { name: string; role: string };
type Pipeline = { step: string; tools: Tool[] };
const PIPELINES: Record<string, { summary: string; steps: Pipeline[]; links: { label: string; href: string }[] }> = {
  rnaseq: {
    summary: "Bulk RNA-seq differential expression, splicing, and pathway analysis",
    steps: [
      { step: "QC", tools: [{ name: "FastQC", role: "Read quality" }, { name: "MultiQC", role: "Aggregate QC reports" }] },
      { step: "Trimming", tools: [{ name: "Trim Galore", role: "Adapter + quality trimming" }, { name: "fastp", role: "Faster alternative" }] },
      { step: "Alignment", tools: [{ name: "STAR", role: "Splice-aware, best accuracy" }, { name: "HISAT2", role: "Lower memory" }] },
      { step: "Quantification", tools: [{ name: "featureCounts", role: "Gene-level counts" }, { name: "Salmon", role: "Quasi-mapping, fast" }] },
      { step: "Differential Expression", tools: [{ name: "DESeq2", role: "Gold standard (R)" }, { name: "edgeR", role: "Alternative GLM" }] },
      { step: "Pathway Analysis", tools: [{ name: "GSEA", role: "Gene set enrichment" }, { name: "clusterProfiler", role: "GO/KEGG in R" }] },
    ],
    links: [{ label: "Run RNA-seq pipeline →", href: "/wizard?analysis=rnaseq" }],
  },
  wgs: {
    summary: "Whole-genome sequencing: variant calling (germline & somatic), CNV, SV",
    steps: [
      { step: "QC", tools: [{ name: "FastQC", role: "Read quality" }, { name: "Qualimap", role: "Coverage metrics" }] },
      { step: "Alignment", tools: [{ name: "BWA-MEM2", role: "Fastest WGS aligner" }, { name: "Bowtie2", role: "Alternative" }] },
      { step: "Pre-processing", tools: [{ name: "GATK MarkDuplicates", role: "Remove PCR duplicates" }, { name: "samblaster", role: "Faster alternative" }] },
      { step: "Variant Calling", tools: [{ name: "GATK HaplotypeCaller", role: "Germline SNPs/indels" }, { name: "Mutect2", role: "Somatic variants" }] },
      { step: "Annotation", tools: [{ name: "ANNOVAR", role: "Variant annotation" }, { name: "SnpEff", role: "Open-source alternative" }] },
      { step: "CNV / SV", tools: [{ name: "CNVkit", role: "Copy number variants" }, { name: "Manta", role: "Structural variants" }] },
    ],
    links: [{ label: "Run WGS pipeline →", href: "/wizard?analysis=wgs" }],
  },
  wes: {
    summary: "Targeted exome sequencing for clinical variant discovery",
    steps: [
      { step: "QC", tools: [{ name: "FastQC", role: "Read quality" }, { name: "Picard CollectTargetedPcrMetrics", role: "On-target rate" }] },
      { step: "Alignment", tools: [{ name: "BWA-MEM", role: "Standard short-read aligner" }] },
      { step: "Variant Calling", tools: [{ name: "GATK HaplotypeCaller", role: "Germline" }, { name: "Mutect2", role: "Somatic (matched normal)" }] },
      { step: "Annotation", tools: [{ name: "ANNOVAR", role: "ClinVar, dbSNP, COSMIC" }, { name: "VEP", role: "Ensembl Variant Effect Predictor" }] },
      { step: "Clinical Filtering", tools: [{ name: "GEMINI", role: "Family-based filtering" }, { name: "OpenCRAVAT", role: "Clinical annotation hub" }] },
    ],
    links: [{ label: "Run WES pipeline →", href: "/wizard?analysis=wes" }],
  },
  scrnaseq: {
    summary: "Single-cell RNA-seq: clustering, cell type annotation, trajectory",
    steps: [
      { step: "Demux / QC", tools: [{ name: "STARsolo", role: "Cell barcode + UMI" }, { name: "cellranger", role: "10x official" }] },
      { step: "QC Filtering", tools: [{ name: "Seurat", role: "R — industry standard" }, { name: "Scanpy", role: "Python — scalable" }] },
      { step: "Normalization", tools: [{ name: "scran", role: "Pooling-based normalization" }, { name: "SCTransform", role: "Variance stabilizing" }] },
      { step: "Clustering", tools: [{ name: "Leiden / Louvain", role: "Community detection" }, { name: "UMAP / tSNE", role: "Visualization" }] },
      { step: "Cell Type Annotation", tools: [{ name: "SingleR", role: "Reference-based" }, { name: "CellTypist", role: "ML-based" }] },
      { step: "Trajectory", tools: [{ name: "Monocle3", role: "Pseudotime" }, { name: "scVelo", role: "RNA velocity" }] },
    ],
    links: [{ label: "Run scRNA-seq pipeline →", href: "/wizard?analysis=scrnaseq" }],
  },
  methylation: {
    summary: "DNA methylation: WGBS, RRBS, and methylation arrays",
    steps: [
      { step: "Alignment", tools: [{ name: "Bismark", role: "Bisulfite-aware aligner" }, { name: "bwa-meth", role: "Faster alternative" }] },
      { step: "Methylation Calling", tools: [{ name: "MethylDackel", role: "CpG methylation extraction" }, { name: "Bismark extractor", role: "Comprehensive metrics" }] },
      { step: "Differential Methylation", tools: [{ name: "DSS", role: "Dispersion shrinkage" }, { name: "methylKit", role: "CpG-level DMR" }] },
      { step: "Arrays", tools: [{ name: "minfi", role: "450K / EPIC array" }, { name: "ChAMP", role: "Pipeline for arrays" }] },
    ],
    links: [{ label: "Run methylation pipeline →", href: "/wizard?analysis=methylation" }],
  },
  chipseq: {
    summary: "ChIP-seq: peak calling, motif finding, differential binding",
    steps: [
      { step: "Alignment", tools: [{ name: "Bowtie2", role: "Short-read alignment" }, { name: "BWA", role: "Alternative" }] },
      { step: "Peak Calling", tools: [{ name: "MACS3", role: "Standard peak caller" }, { name: "SICER2", role: "Broad histone marks" }] },
      { step: "Differential Binding", tools: [{ name: "DiffBind", role: "R — consensus peaks" }, { name: "DESeq2", role: "Count-based approach" }] },
      { step: "Motif Analysis", tools: [{ name: "HOMER", role: "De novo motif discovery" }, { name: "MEME-ChIP", role: "Web + CLI" }] },
      { step: "Annotation", tools: [{ name: "ChIPseeker", role: "R — genomic context" }, { name: "GREAT", role: "Gene ontology enrichment" }] },
    ],
    links: [{ label: "Run ChIP-seq pipeline →", href: "/wizard?analysis=chipseq" }],
  },
  atacseq: {
    summary: "ATAC-seq: open chromatin, TF footprinting, co-accessibility",
    steps: [
      { step: "Alignment", tools: [{ name: "Bowtie2", role: "Fast short-read aligner" }] },
      { step: "Peak Calling", tools: [{ name: "MACS3", role: "Narrow peaks" }, { name: "HMMRATAC", role: "ATAC-specific" }] },
      { step: "TF Footprinting", tools: [{ name: "TOBIAS", role: "Bias-corrected footprinting" }, { name: "HINT-ATAC", role: "Alternative" }] },
      { step: "Co-accessibility", tools: [{ name: "Cicero", role: "Monocle integration" }, { name: "ArchR", role: "scATAC-seq full pipeline" }] },
    ],
    links: [{ label: "Run ATAC-seq pipeline →", href: "/wizard?analysis=atacseq" }],
  },
  microbiome: {
    summary: "16S amplicon and shotgun metagenomics analysis",
    steps: [
      { step: "Amplicon QC / Clustering", tools: [{ name: "DADA2", role: "ASV-based denoising" }, { name: "QIIME2", role: "Full amplicon pipeline" }] },
      { step: "Taxonomy", tools: [{ name: "SILVA", role: "16S reference database" }, { name: "Kraken2 + Bracken", role: "Shotgun classification" }] },
      { step: "Diversity", tools: [{ name: "vegan", role: "Alpha/beta diversity (R)" }, { name: "phyloseq", role: "Microbiome data container (R)" }] },
      { step: "Differential Abundance", tools: [{ name: "DESeq2", role: "Count-based" }, { name: "ANCOM-BC", role: "Composition-aware" }] },
    ],
    links: [{ label: "Run microbiome pipeline →", href: "/wizard?analysis=microbiome" }],
  },
  proteomics: {
    summary: "LC-MS/MS data processing, protein quantification, and pathway analysis",
    steps: [
      { step: "Raw Data", tools: [{ name: "MaxQuant", role: "Label-free / TMT quantification" }, { name: "Proteome Discoverer", role: "Thermo commercial" }] },
      { step: "Database Search", tools: [{ name: "Mascot", role: "Peptide identification" }, { name: "MSFragger", role: "Open search, fast" }] },
      { step: "Statistical Analysis", tools: [{ name: "Perseus", role: "Standard proteomics stats" }, { name: "limma", role: "R — linear models" }] },
      { step: "Pathway", tools: [{ name: "STRING", role: "Protein interactions" }, { name: "Enrichr", role: "Online pathway analysis" }] },
    ],
    links: [{ label: "Run proteomics pipeline →", href: "/wizard?analysis=proteomics" }],
  },
  multiomics: {
    summary: "Multi-omics integration: RNA + ATAC + methylation + proteomics",
    steps: [
      { step: "Data Harmonization", tools: [{ name: "ComBat-seq", role: "Batch correction" }, { name: "Harmony", role: "Integration" }] },
      { step: "Integration", tools: [{ name: "MOFA+", role: "Factor analysis" }, { name: "WNN (Seurat)", role: "Weighted nearest neighbor" }] },
      { step: "Visualization", tools: [{ name: "ggplot2 / plotly", role: "Publication figures" }, { name: "ComplexHeatmap", role: "Multi-layer heatmaps" }] },
    ],
    links: [{ label: "Open Multi-Omics →", href: "/multiomics" }],
  },
  spatial: {
    summary: "Spatial transcriptomics (Visium, Xenium, MERFISH) and pathology slides",
    steps: [
      { step: "Preprocessing", tools: [{ name: "Space Ranger", role: "10x Visium alignment" }, { name: "STARsolo", role: "Slide-seq" }] },
      { step: "Analysis", tools: [{ name: "Seurat", role: "Spatial DE" }, { name: "Squidpy", role: "Python spatial analysis" }] },
      { step: "Deconvolution", tools: [{ name: "RCTD", role: "Cell type mapping" }, { name: "cell2location", role: "Bayesian approach" }] },
    ],
    links: [{ label: "Run spatial pipeline →", href: "/wizard?analysis=spatial" }],
  },
  immune_profiling: {
    summary: "Immune repertoire profiling: TCR, BCR clonotype analysis",
    steps: [
      { step: "V(D)J Assembly", tools: [{ name: "MiXCR", role: "TCR/BCR from RNA-seq" }, { name: "TRUST4", role: "From bulk or scRNA-seq" }] },
      { step: "Clonotype Analysis", tools: [{ name: "Immunarch", role: "R — diversity, clonal" }, { name: "scRepertoire", role: "scRNA-seq integration" }] },
      { step: "Epitope Prediction", tools: [{ name: "NetMHCpan", role: "MHC binding prediction" }] },
    ],
    links: [{ label: "Run immune profiling →", href: "/wizard?analysis=immune_profiling" }],
  },
  ctdna: {
    summary: "Liquid biopsy: circulating tumor DNA detection and monitoring",
    steps: [
      { step: "QC + Alignment", tools: [{ name: "BWA-MEM", role: "Short-read alignment" }] },
      { step: "cfDNA Fragmentation", tools: [{ name: "ichorCNA", role: "CNV from low-pass WGS" }, { name: "DELFI", role: "Fragment patterns" }] },
      { step: "Mutation Detection", tools: [{ name: "Mutect2", role: "Low VAF somatic" }, { name: "LoFreq", role: "Ultra-sensitive variants" }] },
    ],
    links: [{ label: "Run ctDNA pipeline →", href: "/wizard?analysis=ctdna" }],
  },
  riboseq: {
    summary: "Ribosome profiling: translation efficiency and ribosome occupancy",
    steps: [
      { step: "rRNA Depletion", tools: [{ name: "bowtie2 (rRNA filter)", role: "Remove rRNA reads" }] },
      { step: "Alignment", tools: [{ name: "STAR", role: "Splice-aware alignment" }] },
      { step: "Ribosome Occupancy", tools: [{ name: "RiboWaltz", role: "P-site offset" }, { name: "riboseQC", role: "QC metrics" }] },
      { step: "Translation Efficiency", tools: [{ name: "anota2seq", role: "TE with RNA-seq" }, { name: "Xtail", role: "Differential TE" }] },
    ],
    links: [{ label: "Run Ribo-seq pipeline →", href: "/wizard?analysis=riboseq" }],
  },
  dark_genome: {
    summary: "Non-coding, repetitive elements, transposons, and structural annotation",
    steps: [
      { step: "Repeat Masking", tools: [{ name: "RepeatMasker", role: "Transposons / LTRs" }, { name: "EDTA", role: "Plant TE annotation" }] },
      { step: "lncRNA", tools: [{ name: "CPAT", role: "Coding potential" }, { name: "FEELnc", role: "Filter + annotate lncRNAs" }] },
      { step: "TE Expression", tools: [{ name: "TEtools", role: "TE quantification" }, { name: "SalmonTE", role: "Fast TE quantification" }] },
    ],
    links: [{ label: "Run dark genome pipeline →", href: "/wizard?analysis=dark_genome" }],
  },
  phylogenetics: {
    summary: "Multiple sequence alignment, phylogenetic trees, and population genetics",
    steps: [
      { step: "Alignment", tools: [{ name: "MAFFT", role: "Fast, scalable MSA" }, { name: "MUSCLE", role: "High-accuracy MSA" }] },
      { step: "Phylogenetic Inference", tools: [{ name: "IQ-TREE2", role: "ML phylogenetics" }, { name: "BEAST", role: "Bayesian MCMC" }] },
      { step: "Population Genetics", tools: [{ name: "DnaSP", role: "Population statistics" }, { name: "STRUCTURE", role: "Population clustering" }] },
    ],
    links: [{ label: "Run phylogenetics pipeline →", href: "/wizard?analysis=phylogenetics" }],
  },
};

// ─── Accepted file formats per analysis type ───────────────────────────────────

const FILE_FORMATS: Record<string, { note: string; accept: string; examples: string[] }> = {
  flow_cytometry:   { note: "FCS 2.0, 3.0, 3.1",                                       accept: ".fcs",                          examples: [".fcs"] },
  rnaseq:           { note: "FASTQ (raw reads) or BAM/CRAM (pre-aligned)",               accept: ".fastq,.fq,.gz,.bam,.cram",     examples: [".fastq.gz", ".bam"] },
  wgs:              { note: "FASTQ paired-end or BAM/CRAM",                              accept: ".fastq,.fq,.gz,.bam,.cram",     examples: [".fastq.gz", ".bam", ".cram"] },
  wes:              { note: "FASTQ + capture BED file",                                  accept: ".fastq,.fq,.gz,.bam,.bed",      examples: [".fastq.gz", ".bam", ".bed"] },
  scrnaseq:         { note: "FASTQ or Cell Ranger output (barcodes, features, matrix)",  accept: ".fastq,.fq,.gz,.mtx,.tsv,.csv", examples: [".fastq.gz", ".mtx", ".tsv"] },
  methylation:      { note: "FASTQ (WGBS/RRBS) or IDAT files (450K/EPIC arrays)",        accept: ".fastq,.fq,.gz,.idat",          examples: [".fastq.gz", ".idat"] },
  chipseq:          { note: "FASTQ — IP sample + input control (both required)",          accept: ".fastq,.fq,.gz,.bam",           examples: [".fastq.gz", ".bam"] },
  atacseq:          { note: "FASTQ paired-end or pre-aligned BAM",                       accept: ".fastq,.fq,.gz,.bam",           examples: [".fastq.gz", ".bam"] },
  immune_profiling: { note: "FASTQ or BAM — bulk RNA-seq or targeted V(D)J amplicon",    accept: ".fastq,.fq,.gz,.bam",           examples: [".fastq.gz", ".bam"] },
  ctdna:            { note: "FASTQ or BAM — cfDNA (low-pass WGS or targeted panel)",     accept: ".fastq,.fq,.gz,.bam,.vcf",      examples: [".fastq.gz", ".bam", ".vcf"] },
  microbiome:       { note: "FASTQ — 16S amplicon or shotgun metagenomics",              accept: ".fastq,.fq,.gz",                examples: [".fastq.gz", ".fq.gz"] },
  riboseq:          { note: "FASTQ — RPF reads + matched RNA-seq recommended",            accept: ".fastq,.fq,.gz",                examples: [".fastq.gz"] },
  proteomics:       { note: "RAW (Thermo) or mzML / mzXML — LC-MS/MS data",             accept: ".raw,.mzml,.mzxml",             examples: [".raw", ".mzML", ".mzXML"] },
  multiomics:       { note: "Upload each omics layer: FASTQ, BAM, or count matrix CSV",  accept: ".fastq,.fq,.gz,.bam,.csv,.tsv", examples: [".fastq.gz", ".csv", ".tsv"] },
  spatial:          { note: "FASTQ + H&E TIFF (Visium) or per-cell CSV (Xenium/MERFISH)",accept: ".fastq,.fq,.gz,.tif,.tiff,.csv",examples: [".fastq.gz", ".tiff", ".csv"] },
  dark_genome:      { note: "FASTQ or BAM — total RNA-seq, small RNA-seq, or WGBS",      accept: ".fastq,.fq,.gz,.bam",           examples: [".fastq.gz", ".bam"] },
  phylogenetics:    { note: "FASTA sequences or pre-computed MSA alignment",              accept: ".fasta,.fa,.fna,.aln,.mfa,.phy",examples: [".fasta", ".fa", ".aln"] },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function DataInputSection({ analysisType, user }: { analysisType: string; user: AuthUser | null }) {
  const fmt = FILE_FORMATS[analysisType];
  const meta = ANALYSIS_TYPES.find(t => t.id === analysisType);
  const wizardUrl = `/wizard?analysis=${analysisType}`;

  if (!user) {
    return (
      <div className="rounded-xl px-5 py-4 space-y-1" style={{ background: "#fff8f3", border: "1.5px dashed var(--flame)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--flame)" }}>Sign in to load your data and launch the analysis</p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>Create a free account or sign in using the panel on the right →</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div>
        <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Load your data</h3>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
          {fmt?.note ?? "FASTQ, BAM, or analysis-specific formats"}
          {fmt && <span className="ml-2 font-mono text-xs" style={{ color: "var(--dim)" }}>{fmt.examples.join("  ")}</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition-colors"
          style={{ border: "1.5px dashed var(--border)", background: "var(--canvas)" }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--flame)")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
          <input type="file" accept={fmt?.accept} className="sr-only"
            onChange={() => { window.location.href = wizardUrl; }} />
          <span className="text-2xl">⬆</span>
          <div className="text-center">
            <p className="text-xs font-medium" style={{ color: "var(--text)" }}>Upload file</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--dim)" }}>For files under ~500 MB</p>
          </div>
        </label>

        <a href={wizardUrl}
          className="flex flex-col items-center gap-2 p-4 rounded-xl transition-colors"
          style={{ border: "1.5px dashed var(--border)", background: "var(--canvas)", textDecoration: "none" }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--flame)")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
          <span className="text-2xl">📂</span>
          <div className="text-center">
            <p className="text-xs font-medium" style={{ color: "var(--text)" }}>Use local file</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--dim)" }}>Any size — stays on your computer</p>
          </div>
        </a>
      </div>

      <a href={wizardUrl}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold"
        style={{ background: "var(--flame)", color: "#fff" }}>
        Launch {meta?.label} analysis →
      </a>
    </div>
  );
}

function FAQ({ analysisType }: { analysisType: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const items = FAQS[analysisType];
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-2 mt-8">
      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>Frequently asked questions</h3>
      {items.map((item, i) => (
        <div key={i} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-3 text-left text-sm"
            style={{ background: "var(--surface)", color: "var(--text)" }}
          >
            <span className="font-medium">{item.q}</span>
            <span className="ml-3 text-xs shrink-0" style={{ color: "var(--muted)" }}>{open === i ? "▲" : "▼"}</span>
          </button>
          {open === i && (
            <div className="px-4 py-3 text-sm leading-relaxed" style={{ background: "var(--canvas)", borderTop: "1px solid var(--border)", color: "var(--muted)" }}>
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Auth panel (inline sign-in / register) ────────────────────────────────────

function AuthPanel({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode]         = useState<"login" | "register">("login");
  const [email, setEmail]       = useState("");
  const [name, setName]         = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function submit() {
    setLoading(true); setError("");
    try {
      const body = mode === "login" ? { email, password } : { email, name, password };
      const res = await fetch(`${BASE}/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Authentication failed");
      localStorage.setItem("genomics_token", data.token);
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ background: "var(--surface)" }}>
        <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>
          {mode === "login" ? "Sign In" : "Create Account"}
        </h3>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
          {mode === "login"
            ? "Sign in to run analyses on your data"
            : "Free — all processing stays on your machine"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        {(["login", "register"] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setError(""); }}
            className="flex-1 py-2 text-xs font-semibold"
            style={mode === m
              ? { background: "var(--flame)", color: "#fff" }
              : { background: "var(--canvas)", color: "var(--muted)" }}>
            {m === "login" ? "Sign In" : "Register"}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="px-5 py-4 space-y-3" style={{ background: "var(--surface)" }}>
        {mode === "register" && (
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Full name"
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
            style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
        )}
        <input value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email address" type="email"
          className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
          style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
        <input value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Password" type="password"
          onKeyDown={e => e.key === "Enter" && submit()}
          className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
          style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />

        {error && <p className="text-xs" style={{ color: "#dc2626" }}>{error}</p>}

        <button onClick={submit}
          disabled={loading || !email || !password || (mode === "register" && !name)}
          className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
          style={{ background: "var(--flame)", color: "#fff" }}>
          {loading
            ? (mode === "login" ? "Signing in…" : "Creating account…")
            : (mode === "login" ? "Sign In →" : "Create Account →")}
        </button>

        <p className="text-xs text-center pt-1" style={{ color: "var(--dim)" }}>
          🔒 All data stays on your machine
        </p>
      </div>
    </div>
  );
}

// ─── Run panel (authenticated) ─────────────────────────────────────────────────

function RunPanel({ user, selectedType, onSignOut }: { user: AuthUser; selectedType: string | null; onSignOut: () => void }) {
  const meta = ANALYSIS_TYPES.find(t => t.id === selectedType);
  return (
    <div className="space-y-4">
      {/* User card */}
      <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
            style={{ background: "var(--flame)", color: "#fff" }}>
            {user.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{user.name}</p>
            <p className="text-xs truncate" style={{ color: "var(--dim)" }}>{user.email}</p>
          </div>
        </div>
        <button onClick={onSignOut} className="text-xs hover:underline" style={{ color: "var(--muted)" }}>Sign out</button>
      </div>

      {/* Launch action */}
      {selectedType && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            {meta?.icon} {meta?.label}
          </p>
          {meta?.wizard ? (
            <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
              The interactive wizard is active in the panel below — scroll down to begin.
            </p>
          ) : (
            <div className="space-y-2">
              {PIPELINES[selectedType]?.links.map(link => (
                <a key={link.href} href={link.href}
                  className="block w-full text-center py-2.5 rounded-lg text-sm font-semibold"
                  style={{ background: "var(--flame)", color: "#fff" }}>
                  {link.label}
                </a>
              ))}
              <a href="/connect"
                className="block w-full text-center py-2 rounded-lg text-sm"
                style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }}>
                Connect my data →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Quick links */}
      <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted)" }}>Quick access</p>
        <div className="space-y-0.5">
          {[
            { href: "/dashboard",  label: "📊 Dashboard" },
            { href: "/data",       label: "🗂 Data Inspector" },
            { href: "/discovery",  label: "🔭 AI Discovery" },
            { href: "/multiomics", label: "🔗 Multi-Omics" },
            { href: "/replicate",  label: "🧪 Replicate Check" },
          ].map(l => (
            <a key={l.href} href={l.href}
              className="flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors"
              style={{ color: "var(--text)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--canvas)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <span>{l.label}</span>
              <span style={{ color: "var(--dim)" }}>→</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ToolsPage() {
  const { user, loading: authLoading, signOut, refresh } = useAuthOptional();
  const [selectedType, setSelectedType]                  = useState<string | null>(null);
  const [activeTab, setActiveTab]                        = useState<"pipeline" | "instructions" | "faq">("pipeline");

  const meta     = ANALYSIS_TYPES.find(t => t.id === selectedType);
  const pipeline = selectedType && !meta?.wizard ? PIPELINES[selectedType] : null;
  const faqs     = selectedType ? FAQS[selectedType] : null;
  const steps    = selectedType ? INSTRUCTIONS[selectedType] : null;

  // Reset tab when tool changes
  useEffect(() => { setActiveTab("pipeline"); }, [selectedType]);

  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)", color: "var(--text)" }}>
      <NavBar active="/tools" user={user} onSignOut={signOut} />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-8 items-start">

          {/* ── Left column: tool explorer ─────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-8">

            {/* Header */}
            <div>
              <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text)" }}>Tool Finder & Analysis</h1>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Pick an analysis type to see the recommended tool stack, instructions, and FAQ.
                Sign in on the right to launch interactive analyses on your local data.
              </p>
            </div>

            {/* Analysis type grid */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {ANALYSIS_TYPES.map(t => (
                <button key={t.id}
                  onClick={() => setSelectedType(selectedType === t.id ? null : t.id)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all text-xs relative"
                  style={selectedType === t.id
                    ? { border: "1.5px solid var(--flame)", background: "#fff8f3", color: "var(--flame)" }
                    : { border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)" }}>
                  <span className="text-xl">{t.icon}</span>
                  <span className="text-center leading-tight">{t.label}</span>
                  {t.wizard && (
                    <span className="absolute top-1.5 right-1.5 px-1 rounded"
                      style={{ background: "var(--flame)", color: "#fff", fontSize: "9px", fontWeight: 700 }}>
                      LIVE
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── No tool selected ────────────────────────────────────────── */}
            {!selectedType && (
              <p className="text-sm py-2" style={{ color: "var(--dim)" }}>
                Select an analysis type above to see the tool stack, instructions, and FAQ.
                <span className="ml-1" style={{ color: "var(--flame)" }}>🔴 Flow Cytometry</span> is an interactive in-browser wizard — no setup required.
              </p>
            )}

            {/* ── Tool selected ────────────────────────────────────────────── */}
            {selectedType && meta && (
              <div className="space-y-6">

                {/* Tool header */}
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{meta.icon}</span>
                  <div>
                    <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                      {meta.label}
                      {meta.wizard && (
                        <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold"
                          style={{ background: "var(--flame)", color: "#fff", verticalAlign: "middle" }}>
                          Interactive
                        </span>
                      )}
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
                      {pipeline?.summary ?? (meta.wizard ? "Interactive browser-based analysis — no pipeline setup required." : "")}
                    </p>
                  </div>
                </div>

                {/* Data input — shown for all non-wizard tools */}
                {!meta.wizard && (
                  <DataInputSection analysisType={selectedType} user={user} />
                )}

                {/* Tabs (only for non-wizard tools with pipeline data) */}
                {!meta.wizard && (
                  <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    {(["pipeline", "instructions", "faq"] as const).filter(tab => {
                      if (tab === "instructions" && !steps) return false;
                      if (tab === "faq" && (!faqs || faqs.length === 0)) return false;
                      return true;
                    }).map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                        style={activeTab === tab
                          ? { background: "var(--flame)", color: "#fff" }
                          : { color: "var(--muted)" }}>
                        {tab === "pipeline" ? "Tool stack" : tab === "instructions" ? "How to use" : "FAQ"}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── Flow cytometry ─── */}
                {meta.wizard && (
                  <>
                    {!user && !authLoading && (
                      /* Feature showcase for unauthenticated users */
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {FLOW_FEATURES.map(f => (
                            <div key={f.title} className="flex gap-3 p-4 rounded-xl"
                              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                              <span className="text-xl shrink-0">{f.icon}</span>
                              <div>
                                <p className="text-sm font-medium mb-0.5" style={{ color: "var(--text)" }}>{f.title}</p>
                                <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{f.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="rounded-xl px-5 py-4 text-center" style={{ background: "#fff8f3", border: "1.5px dashed var(--flame)" }}>
                          <p className="text-sm font-medium mb-1" style={{ color: "var(--flame)" }}>Sign in to launch the interactive wizard</p>
                          <p className="text-xs" style={{ color: "var(--muted)" }}>Create a free account or sign in using the panel on the right →</p>
                        </div>
                        <FAQ analysisType="flow_cytometry" />
                      </div>
                    )}
                    {(user || authLoading) && (
                      <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                        {authLoading
                          ? <p className="text-sm text-center py-6" style={{ color: "var(--muted)" }}>Loading…</p>
                          : <FlowCytoWizard />}
                      </div>
                    )}
                  </>
                )}

                {/* ── Pipeline tab ─── */}
                {!meta.wizard && activeTab === "pipeline" && pipeline && (
                  <div className="space-y-3">
                    {pipeline.steps.map((step, i) => (
                      <div key={i} className="rounded-xl p-4"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: "#fff8f3", color: "var(--flame)", border: "1px solid var(--flame)" }}>
                            {i + 1}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                              {step.step}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                              {step.tools.map((tool, j) => (
                                <div key={j} className="flex items-baseline gap-1.5">
                                  <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{tool.name}</span>
                                  <span className="text-xs" style={{ color: "var(--dim)" }}>— {tool.role}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Run buttons — gated */}
                    <div className="pt-2 flex gap-3 flex-wrap">
                      {user ? (
                        <>
                          {pipeline.links.map(link => (
                            <a key={link.href} href={link.href}
                              className="px-5 py-2.5 rounded-lg text-sm font-semibold"
                              style={{ background: "var(--flame)", color: "#fff" }}>
                              {link.label}
                            </a>
                          ))}
                          <a href="/connect"
                            className="px-5 py-2.5 rounded-lg text-sm"
                            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                            Connect my data →
                          </a>
                        </>
                      ) : (
                        <div className="rounded-xl px-5 py-3 text-sm"
                          style={{ background: "#fff8f3", border: "1.5px dashed var(--flame)", color: "var(--flame)" }}>
                          Sign in to run this pipeline → use the panel on the right
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Instructions tab ─── */}
                {!meta.wizard && activeTab === "instructions" && steps && (
                  <div className="rounded-2xl p-6 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>How to use {meta.label}</h3>
                    <ol className="space-y-3">
                      {steps.map((s, i) => (
                        <li key={i} className="flex gap-3 items-start">
                          <div className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: "var(--flame)", color: "#fff" }}>
                            {i + 1}
                          </div>
                          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{s}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* ── FAQ tab ─── */}
                {!meta.wizard && activeTab === "faq" && <FAQ analysisType={selectedType} />}
              </div>
            )}
          </div>

          {/* ── Right column: auth / run panel ────────────────────────────── */}
          <div className="w-72 shrink-0">
            <div className="sticky top-6">
              {authLoading ? (
                <div className="rounded-2xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto"
                    style={{ borderColor: "var(--flame)", borderTopColor: "transparent" }} />
                </div>
              ) : user ? (
                <RunPanel user={user} selectedType={selectedType} onSignOut={signOut} />
              ) : (
                <>
                  <AuthPanel onSuccess={refresh} />
                  {/* Privacy note below auth form */}
                  <div className="mt-4 rounded-xl p-4 space-y-2"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Why create an account?</p>
                    <ul className="space-y-1.5">
                      {[
                        "Save and recall gating sessions",
                        "Track pipeline job history",
                        "Access AI-powered discovery",
                        "Share reports with collaborators",
                      ].map(item => (
                        <li key={item} className="flex gap-1.5 text-xs" style={{ color: "var(--dim)" }}>
                          <span style={{ color: "var(--flame)" }}>✓</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
