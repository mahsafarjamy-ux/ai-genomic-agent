# CROSS-DOMAIN NOVEL DISCOVERY OPPORTUNITIES
## Curated high-impact research blueprints with available public data

---

## TIER 1 — HIGHEST IMPACT (Publication-ready concepts)

### 1. Pan-cancer Tertiary Lymphoid Structure (TLS) Spatial Atlas
**Hypothesis:** TLS maturity and spatial architecture predict immunotherapy response better than TIL density alone
**Why novel:** TLS studies exist but no standardized spatial quantification pipeline across tumor types
**Public data:**
- HTAN portal (humantumoratlas.org): Visium HD data for NSCLC, CRC, breast, pancreatic
- TCGA clinical outcomes: survival, immunotherapy response (GDC portal)
- ImmPort SDY112 (melanoma anti-PD1 cohort)
**Pipeline:** Cell2location deconvolution → TLS gene module scoring → BayesSpace spatial domains → survival Cox regression
**Expected output:** TLS maturity score as independent predictor of immunotherapy response
**Tools:** squidpy, cell2location, BayesSpace, lifelines
**Landmark papers:** Dieu-Nosjean 2006 (NSCLC TLS), Sautes-Fridman 2022 (TLS review Cell)

---

### 2. cfDNA Fragmentomics + Methylation Multi-Cancer Early Detection
**Hypothesis:** Combined fragmentomics (DELFI) + methylation deconvolution outperforms each alone for cancer type classification
**Why novel:** Most studies use either fragmentomics or methylation separately
**Public data:**
- GEO GSE172230: DELFI cfDNA WGS from 208 cancer patients + 215 controls
- GEO GSE149438: cfDNA methylation from cancer patients
- CancerSEEK validation cohort (PMID 29348365)
**Pipeline:** GATK WGS → fragment ratio features (5Mb windows) → CpG methylation (nanopore/bisulfite) → ensemble XGBoost/RF → tissue-of-origin deconvolution
**Tools:** DELFI R package, nanodoc (methylation from nanopore), scikit-learn
**Expected output:** >95% specificity multi-cancer detection from a blood draw

---

### 3. Single-Cell Cross-Disease Immune Atlas (33 million cells)
**Hypothesis:** Universal immune cell states (not disease-specific) exist across autoimmune, cancer, infection
**Why novel:** Cross-disease single-cell integration at scale has not been done comprehensively
**Public data:**
- CellxGene census API: query 33M human cells across 800+ datasets
  ```python
  import cellxgene_census
  census = cellxgene_census.open_soma()
  # Query T cells across all diseases
  ```
- ImmPort: flow cytometry reference data for 500+ studies
- COVID-19 Cell Atlas: 4M+ cells
**Pipeline:** scVI integration → scArches reference mapping → UMAP consensus → cell state taxonomy → disease-specific deviation scoring (MELD)
**Tools:** scVI, scArches, MELD, CellChat, scCODA
**Expected output:** Disease-agnostic immune taxonomy with universal state definitions

---

### 4. Foundation Model Variant Effect Prediction Atlas
**Hypothesis:** ESM-2 protein language model predicts pathogenicity comparably to wet-lab functional assays
**Why novel:** Most tools use evolutionary conservation; LLM-based approaches at scale are emerging
**Public data:**
- gnomAD v4 missense variants (gnomad.broadinstitute.org): 10M+ variants with population AF
- ClinVar P/LP and B/LB variants (ncbi.nlm.nih.gov/clinvar): 1M+ labeled variants
- ProteinGym benchmark: 2.7M variant fitness measurements
**Pipeline:** Download gnomAD VCF → extract protein changes → ESM-2 masked marginal log-likelihood → AlphaMissense scores → calibrated ensemble → AUROC vs ClinVar labels
**Tools:** ESM (Facebook/Meta), AlphaMissense, CADD, SpliceAI
**Expected output:** A calibrated variant effect predictor outperforming existing tools on ClinVar benchmarks

---

### 5. Microbiome-Immunotherapy Response Meta-analysis
**Hypothesis:** Specific gut microbiome signatures are causally linked (not just correlated) to anti-PD1 response
**Why novel:** Individual studies are small (n<50); meta-analysis with causal methods hasn't been done
**Public data:**
- curatedMetagenomicData (Bioconductor): 80+ standardized shotgun metagenomics studies
- GEO GSE115212: Gopalakrishnan melanoma anti-PD1 microbiome (2018)
- GEO GSE126802: Matson 2018 melanoma microbiome
- ENA PRJEB22893: Routy 2018 NSCLC + urothelial anti-PD1
**Pipeline:** MetaPhlAn4 → ANCOM-BC2 differential abundance → conditional random forest → mediation analysis (metabolomics if available) → IVW Mendelian randomization using gut microbiome GWAS (MiBioGen)
**Tools:** MetaPhlAn4, ANCOM-BC2, ALDEx2, MaAsLin2, mendelianRandomization R
**Expected output:** Causal species list for anti-PD1 response with mechanistic hypothesis

---

## TIER 2 — HIGH IMPACT

### 6. CHIP Somatic Mutations → Cardiovascular Risk (UK Biobank)
**Hypothesis:** Specific CHIP mutations (DNMT3A, TET2, ASXL1) interact with lipid genes to amplify atherosclerosis risk
**Public data:**
- UK Biobank exome sequencing (available via application): 200K+ WES
- CHIP caller results: available in supplementary of Jaiswal 2017 NEJM
- UK Biobank phenotypes: ICD-10 codes for MI, stroke, cardiac death
**Pipeline:** GATK Mutect2 (VAF 0.01-0.35) → CHIP caller → burden test per gene → interaction with PRS → survival analysis (coronary artery disease)
**Tools:** GATK, mutserve, CHIP_detection, PRSice2, Plink2
**Expected output:** Gene-specific CHIP-CVD interaction model for clinical risk stratification

---

### 7. Spatial Epigenome-Transcriptome Integration
**Hypothesis:** Local chromatin accessibility (spatial ATAC) determines transcriptional heterogeneity within tumor regions
**Why novel:** Spatial multi-modal (ATAC + RNA) has just become feasible (10x Multiome)
**Public data:**
- GEO GSE171820: Paired Visium + scATAC in mouse brain
- ENCODE portal: tissue ATAC-seq for deconvolution reference
- HCA spatial datasets (humancellatlas.org)
**Pipeline:** ArchR spatial ATAC → cis-regulatory module detection → GLUE RNA-ATAC integration → TF motif activity mapping → spatial gradients
**Tools:** ArchR, GLUE, pyscikit-misc, chromVAR, JASPAR motif database

---

### 8. Proteogenomics Drug Sensitivity Atlas
**Hypothesis:** Post-translational modifications (PTMs) not captured by RNA predict drug sensitivity better than transcript levels
**Public data:**
- CPTAC proteomics (proteomics.cancer.gov): matched WES + RNA-seq + proteomics + phosphoproteomics for 10 tumor types
- DepMap PRISM (depmap.org): 4,500 drugs × 900 cell lines
- CCLE transcriptomics + proteomics (Nusinow 2020 Cell)
**Pipeline:** PTM normalization (vsn) → PhosphoScore per pathway → WGCNA modules → Pearson correlation with drug AUC (PRISM) → network-based drug repurposing
**Tools:** PhosR, PhosphoSiteMapper, WGCNA, rcdk

---

### 9. TDP-43 Cryptic Exon Biomarker from RNA-seq
**Hypothesis:** TDP-43 pathology (ALS/FTD) can be detected from blood/CSF RNA-seq by cryptic exon inclusion
**Why novel:** Stathmin-2 and UNC13A cryptic exons just validated (2023), full atlas of cryptic exons not made
**Public data:**
- GEO GSE67196: ALS patient motor neuron RNA-seq
- GEO GSE122649: ALS blood RNA-seq
- Answer ALS project: 1,400 ALS patient RNA-seq
**Pipeline:** STAR alignment → rMATS differential splicing → cryptic exon catalog → ENCODE eCLIP TDP-43 binding overlap → biomarker validation in blood
**Tools:** STAR, rMATS, DEXSeq, ggplot2

---

### 10. Epigenetic Age Acceleration Pan-Cancer Biomarker
**Hypothesis:** Epigenetic age acceleration correlates with cancer aggressiveness and predicts survival independently of stage
**Public data:**
- TCGA 450K methylation arrays: all 33 tumor types (GDC portal)
- GTEx v8 normal tissue methylation (for baseline)
- TCGA clinical outcomes (survival, response)
**Pipeline:** minfi preprocessing → Horvath/GrimAge/DunedinPACE clocks → age acceleration residuals → pan-cancer meta-analysis → multivariable Cox regression
**Tools:** minfi, methylclock, EnhancedVolcano, survminer

---

## TIER 3 — FRONTIER OPPORTUNITIES (2-3 years ahead)

### 11. In Silico Clinical Trial Design with Geneformer
**Hypothesis:** Geneformer perturbation predictions can identify synergistic drug combinations before wet-lab testing
**Tools:** Geneformer, scGen, CellOracle
**Data:** Perturb-seq (Replogle 2022 Cell: 2.5M cells), L1000 LINCS

### 12. Pangenome Graph Variant Discovery
**Hypothesis:** Reference-graph alignment (vg toolkit) reveals population-specific variants invisible to linear alignment
**Data:** Human Pangenome Reference Consortium (HPRC): 47 phased assemblies
**Tools:** vg toolkit, Bandage, GraphAligner

### 13. Long-read Single-Cell Multi-modal (MAS-seq)
**Hypothesis:** Full-length isoform-aware scRNA-seq reveals cell-type-specific splicing programs
**Data:** PacBio MAS-seq public datasets (GEO)
**Tools:** FLAMES, TALON, scnanoatlas

### 14. Spatial Proteomics (CODEX/MERFISH protein)
**Hypothesis:** Tumor microenvironment protein co-expression patterns not visible in scRNA-seq
**Data:** HTAN CODEX data (40+ protein markers)
**Tools:** MIBI-TOF analysis pipeline, steinbock, histocat++

### 15. Synthetic Biology Data Augmentation for Rare Diseases
**Hypothesis:** scGen + fine-tuned foundation models can generate realistic training data for rare disease cell types
**Data:** CellxGene census rare disease annotations, Orphanet gene lists
**Tools:** scGen, scFoundation, CellOT

---

## ANALYSIS PLAN GENERATION RULES

When generating a discovery plan, always include:
```
DISCOVERY PLAN
==============
Title: [Specific research question]
Biological Hypothesis: [Mechanistic statement]
Novelty Score: ⭐⭐⭐⭐⭐ (why it hasn't been done)
Impact: [Clinical/biological significance]

DATA NEEDED:
- Dataset 1: [Name + URL + accession + size]
- Dataset 2: ...

PIPELINE:
Step 1: [Tool + command + parameters]
Step 2: [Tool + parameters]
...

EXPECTED OUTPUTS:
- Primary: [Main finding]
- Secondary: [Ancillary insights]

VALIDATION STRATEGY:
- Independent cohort: [Name it]
- Statistical approach: [Method]
- Negative controls: [What to use]

PUBLICATION TARGET: [Journal tier + section]
ESTIMATED TIME: [With adequate compute]
COMPUTE REQUIREMENTS: [CPU/GPU/RAM]
```
