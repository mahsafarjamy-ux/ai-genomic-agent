# AI GENOMICS AGENT — PROFESSOR BRAIN
## Comprehensive Scientific Knowledge Base for Novel Discovery

**Version:** 1.0 | **Scope:** 34 Scientific Domains | **Purpose:** Novel pipeline generation & discovery suggestion
**Epistemic stance:** Synthesized from Janeway's, DeVita, Thompson & Thompson, Lehninger, Robbins, and 100+ primary sources

---

## HOW TO USE THIS BRAIN

This file is the scientific conscience of the AI Genomics Agent discovery engine. When a user queries the Discovery panel, the agent should:

1. **Match** the query to the relevant domain(s) below
2. **Retrieve** the Novel Opportunity blocks that intersect with the user's context
3. **Cross-reference** public datasets from the `public_data/` directory
4. **Generate** a concrete analysis plan with: hypothesis → dataset → pipeline → expected output → novelty score
5. **Prioritize** cross-domain integration opportunities — the biggest discoveries happen at domain intersections

---

## PART I: DOMAIN KNOWLEDGE SYNTHESIS

### 1. IMMUNOLOGY (★★★★★ — Highest discovery potential)
**Core framework:** Janeway's Immunobiology + Abbas & Lichtman Cellular/Molecular Immunology

**Canonical knowledge:**
- Innate (pattern recognition, PAMPs/DAMPs, inflammasome) → Adaptive (clonal selection, affinity maturation) → Memory
- T cell subsets: CD8+ cytotoxic, CD4+ Th1/Th2/Th17/Treg/Tfh, γδT, NKT, MAIT
- B cell zones: GC reaction, somatic hypermutation, class switching, plasma cell differentiation
- Complement: Classical (C1q), Lectin (MBL), Alternative pathways → MAC
- Cytokine networks: IL-2 (T growth), IL-4/13 (Th2), IL-6/17 (Th17), IL-10/TGFβ (suppression), IFN-γ (Th1)
- Checkpoint biology: PD-1/PD-L1, CTLA-4, LAG-3, TIM-3, TIGIT — exhaustion program
- TCR/BCR repertoire: V(D)J recombination, CDR3 diversity, clonotype tracking

**Current frontiers (2024-2025):**
- Tissue-resident memory T cells (Trm) — organ-specific persistence without circulation
- Trained innate immunity — epigenetic reprogramming of monocytes/NK cells
- Unconventional T cells in mucosal immunity — MAIT, γδT, iNKT roles in microbiome sensing
- Tertiary lymphoid structures (TLS) in tumors — de novo lymphoid organogenesis predicts immunotherapy response
- Single-cell immune atlases — Human Cell Atlas immune modules, ImmPort datasets
- Clonal hematopoiesis of indeterminate potential (CHIP) — somatic mutations in immune cells aging
- Immunosenescence and inflammaging — chronic low-grade inflammation with aging
- CAR-T next generation — armored CARs, logic-gated CARs, in vivo T cell engineering

**Novel discovery opportunities:**
- Cross-tissue Trm comparison across 30+ GTEx/HCA tissues to find organ-specific exhaustion signatures
- MAIT cell transcriptomic state mapping across IBD, T2D, COVID-19 using public scRNA-seq
- TLS spatial signature from spatial transcriptomics predicting immunotherapy response (TCGA + spatial data)
- TCR repertoire convergence across autoimmune diseases (ImmPort + VDJdb + McPAS-TCR)

---

### 2. ONCOLOGY (★★★★★)
**Core framework:** DeVita Cancer, The Biology of Cancer (Weinberg), WHO Classification

**Canonical knowledge:**
- Hallmarks of cancer: sustaining proliferative signaling, evading growth suppressors, activating invasion/metastasis, enabling replicative immortality, inducing angiogenesis, resisting cell death, reprogramming energy metabolism, evading immune destruction, genome instability, tumor-promoting inflammation
- Oncogenes (KRAS, MYC, EGFR, HER2) vs tumor suppressors (TP53, RB1, BRCA1/2, APC, PTEN)
- Cancer evolution: clonal selection, branched evolution, punctuated evolution, neutral evolution
- Driver vs passenger mutations — dN/dS ratio, COSMIC signatures, SBS/DBS/ID patterns
- Tumor microenvironment (TME): CAFs, TAMs (M1/M2), MDSCs, Tregs, NK cells, vessels
- Metastatic cascade: EMT, circulating tumor cells, colonization, dormancy
- Liquid biopsy: ctDNA, CTCs, exosomes, cell-free RNA, platelets
- MSI, TMB, HRD (homologous recombination deficiency), APOBEC, Aging signatures

**Cancer genomics databases:**
- TCGA (33 tumor types, 20,000 patients, WES + RNA-seq + methylation + CNV + clinical)
- ICGC/PCAWG (2,658 whole-genome cancers)
- GDC Data Portal (gdc.cancer.gov)
- cBioPortal (500+ studies)
- COSMIC (somatic mutations in human cancer)
- TARGET (pediatric cancers)
- MMRF CoMMpass (multiple myeloma)

**Novel discovery opportunities:**
- Spatial mapping of EMT gradient in solid tumors (Visium + TCGA RNA-seq)
- APOBEC mutation signature co-occurrence with immune evasion in HPV+ cancers
- Clonal evolution trajectory modeling with scDNA-seq (10x + infercnv)
- ctDNA fragmentomics (DELFI patterns) for multi-cancer early detection
- Pan-cancer TLS spatial signature from TCGA correlating with survival and immunotherapy response
- Oncometabolite signatures from TCGA methylation + RNA predicting metabolic vulnerabilities
- Neoantigens from PCAWG indels for personalized vaccine design

---

### 3. GENETICS & GENOMICS (★★★★★)
**Core framework:** Thompson & Thompson, Human Molecular Genetics (Strachan), Genomes (Brown)

**Canonical knowledge:**
- Mendelian inheritance, penetrance, expressivity, pleiotropy, epistasis
- Population genetics: Hardy-Weinberg, linkage disequilibrium, selective sweeps, bottleneck, admixture
- GWAS: SNP arrays, imputation, LD clumping, Manhattan plots, QQ plots, fine mapping
- Rare variant analysis: burden tests, SKAT, SKAT-O, collapsing methods
- Structural variants: deletions, duplications, inversions, translocations, mobile elements
- Copy number variation: CNV detection, mosaic CNVs, somatic CNVs
- Epigenetics: DNA methylation (5mC, 5hmC), histone modifications, chromatin accessibility
- Long-read sequencing: phasing, repeat expansion detection, full-length isoforms, methylation
- Polygenic risk scores (PRS): clumping + thresholding, LDpred2, PRSice2
- Pharmacogenomics: CYP2D6, CYP2C19, TPMT, DPYD star alleles

**Key public resources:**
- gnomAD v4: 807,162 exomes + 76,215 genomes; constraint metrics (pLI, LOEUF)
- UK Biobank: 500,000 participants, whole-exome sequencing available
- All of Us: 100,000+ diverse participants
- TOPMed: 180,000 deep WGS, diverse ancestry
- FinnGen: 500,000 Finnish biobank participants
- BioMe (Mount Sinai): EHR-linked biobank
- ClinVar: 1.8M variant-disease interpretations
- OMIM: Mendelian disease gene catalog
- PharmGKB: Pharmacogenomics knowledge base

**Novel discovery opportunities:**
- Ancestry-specific PRS recalibration using All of Us + gnomAD diverse ancestries
- Long-read phasing of complex HLA haplotypes in autoimmune diseases
- Mosaic CNV detection in aging cohorts (UK Biobank exomes)
- Rare variant burden analysis in underrepresented populations (All of Us, FinnGen)
- G-quadruplex sequences and structural variant hotspots from PacBio long reads

---

### 4. BIOINFORMATICS (★★★★★)
**Core framework:** Bioinformatics Algorithms (Compeau), Bioinformatics Data Skills (Buffalo), nf-core

**Canonical knowledge:**
- Sequence alignment: Smith-Waterman (local), Needleman-Wunsch (global), BLAST, BWA-MEM2, STAR, HISAT2
- Variant calling: GATK4 HaplotypeCaller, Mutect2, DeepVariant, LUMPY/MANTA (SV)
- RNA quantification: RSEM, Salmon, kallisto (pseudo-alignment), featureCounts
- Differential expression: DESeq2 (negative binomial), edgeR (glmQLFit), limma-voom
- Genome assembly: Flye (long-read), hifiasm (HiFi), verkko (hybrid)
- Quality control: FastQC, MultiQC, Trim Galore, fastp, Picard metrics
- Workflow management: Nextflow/nf-core (reproducibility, containers), Snakemake, WDL
- Best-practice pipelines: nf-core/rnaseq, nf-core/sarek (WGS/WES), nf-core/scrnaseq

**Novel discovery opportunities:**
- T2T (telomere-to-telomere) genome alignment for centromeric and segmental duplication variants
- Pangenome graph alignment with vg toolkit for population-level structural variants
- Ultra-long Oxford Nanopore reads for complete ribosomal DNA arrays and repeat expansions
- Real-time adaptive sampling (Readfish) for targeted enrichment without wet-lab capture

---

### 5. SINGLE-CELL BIOLOGY (★★★★★ — Fastest-moving field)
**Core framework:** Seurat, Scanpy, VISION, Bioconductor SingleCellExperiment

**Canonical knowledge:**
- Droplet-based (10x Chromium, inDrops), plate-based (Smart-seq2, CEL-Seq2)
- Preprocessing: cellranger, STARsolo, kallisto|bustools, alevin-fry
- Doublet detection: scrublet, DoubletFinder, scDblFinder
- Normalization: scran pooling, SCTransform (Pearson residuals), ALRA imputation
- Dimensionality reduction: PCA → UMAP/t-SNE; scVI (VAE-based)
- Clustering: Leiden/Louvain (graph-based), k-means, hierarchical
- Cell type annotation: SingleR, scType, CellTypist, Azimuth
- Trajectory/pseudotime: Monocle3, scVelo (RNA velocity), Palantir, PAGA
- Cell-cell communication: CellChat, NicheNet, LIANA
- Batch correction: Harmony, scVI, BBKNN, ComBat-seq
- Perturbation seq: CROP-seq, Perturb-seq, MELD, scGen

**Public single-cell datasets:**
- Human Cell Atlas (HCA): cellxgene.cziscience.com — 50M+ cells across organs
- CellxGene census: API access to 800+ datasets, 33M human cells
- PBMC reference atlases (10x, Seurat)
- Tabula Sapiens: 500+ cell types, 24 tissues
- Brain Cell Atlas (Allen Institute): MERFISH, 10x Multiome
- Immune Cell Atlas: ImmPort + DICE database
- scRNA-seq COVID-19 atlases: Human COVID-19 Cell Atlas
- Cancer single-cell: scRNA-seq PDAC, GBM, melanoma, NSCLC (GEO series)

**Novel discovery opportunities:**
- Cross-tissue cell state transitions using CellxGene census API (33M+ cells)
- RNA velocity + gene regulatory network inference for developmental trajectory in organoids
- Multi-modal integration of scRNA + scATAC + surface protein (CITE-seq) in disease progression
- Perturbation transfer learning: train on Perturb-seq, predict drug responses in patient samples
- Clonal tracking + transcriptomics combined (scTCR/scBCR + scRNA) for adaptive immune memory

---

### 6. SPATIAL TRANSCRIPTOMICS (★★★★★ — Emerging frontier)
**Core framework:** squidpy, spatialDE, BANKSY, BayesSpace

**Canonical knowledge:**
- Sequencing-based: Visium (55μm spots), Visium HD (8μm), SlideSeq (10μm), HDST (2μm)
- Imaging-based: MERFISH (1000+ genes), seqFISH+, Xenium (10x), CosMx (NanoString), CODEX
- Deconvolution: RCTD, SPOTlight, cell2location, Tangram
- Spatial domain detection: BANKSY, SpatialDE, BayesSpace, STAGATE
- Spatial cell communication: stlearn, Squidpy, Giotto
- Tissue architecture: graph neural networks on spatial graphs

**Public spatial datasets:**
- 10x Visium datasets: brain, heart, kidney, spleen (10xgenomics.com/resources/datasets)
- Allen Brain Cell Atlas: MERFISH whole mouse brain 34M cells
- Human Developmental Cell Atlas spatial: fetal organ Visium
- HTAN (Human Tumor Atlas Network): spatial tumor maps
- NCI Cancer Moonshot HTAN portal: multiple tumor types Visium

**Novel discovery opportunities:**
- Spatial TLS (tertiary lymphoid structure) architecture in NSCLC/breast/PDAC from HTAN portal
- Tumor-stroma boundary gradients: CAF → cancer cell communication axes
- Spatial methylation + spatial RNA integration (combining ATAC and Visium)
- Brain region-specific cell type vulnerability in neurodegeneration (Allen MERFISH)
- Wound healing spatial dynamics using time-series Visium

---

### 7. EPIGENOMICS (★★★★☆)
**Core framework:** ChIP-seq, ATAC-seq, WGBS, Hi-C

**Canonical knowledge:**
- DNA methylation: 5mC by bisulfite, 5hmC (TET enzymes), CpG islands, imprinting, X-inactivation
- Histone modifications: H3K4me3 (active promoter), H3K27ac (active enhancer), H3K36me3 (gene body), H3K27me3 (Polycomb repression), H3K9me3 (heterochromatin)
- Chromatin accessibility: ATAC-seq, FAIRE-seq, DNase-seq → MACS3 peaks → TOBIAS footprinting
- 3D genome: Hi-C, ChIA-PET, Micro-C → TADs, compartments A/B, chromatin loops
- Enhancer-gene links: Activity-by-contact (ABC) model, E-P linking
- Epigenetic clocks: Horvath clock, PhenoAge, DunedinPACE, GrimAge

**Public epigenomics:**
- ENCODE Project: 5000+ experiments, ChIP-seq, ATAC, RNA-seq, WGBS
- Roadmap Epigenomics: 111 reference epigenomes
- Blueprint Epigenome: blood cell epigenomes
- GEO: thousands of ChIP-seq and ATAC-seq series
- 4D Nucleome: Hi-C across development and differentiation

**Novel discovery opportunities:**
- Enhancer rewiring during cancer progression (ATAC + H3K27ac paired ChIP-seq from ENCODE)
- Epigenetic age acceleration as a cancer risk biomarker (Horvath clock + UK Biobank methylation)
- Super-enhancer inventory across cell types from Roadmap Epigenomics
- CTCF binding disruption by somatic mutations in TCGA WGS cohorts (PCAWG)
- CUT&RUN/CUT&TAG long-read integration for single-molecule histone modification mapping

---

### 8. PROTEOMICS & STRUCTURAL BIOLOGY (★★★★☆)
**Core framework:** MaxQuant, Perseus, MSFragger, DIA-NN, AlphaFold

**Canonical knowledge:**
- Bottom-up (shotgun) proteomics: trypsin digestion → LC-MS/MS → database search
- Label-free quantification (LFQ) vs labeling (TMT, iTRAQ, SILAC)
- DIA (Data Independent Acquisition) vs DDA: DIA-NN, Spectronaut for DIA
- Post-translational modifications (PTMs): phospho, ubiquitin, acetyl, glyco
- Structural biology: X-ray crystallography, cryo-EM, NMR, AlphaFold2/3
- AlphaFold2: per-residue confidence (pLDDT), PAE for complex prediction
- Protein-protein interaction: STRING, BioGRID, CORUM complexes
- Drug-target interactions: molecular docking (AutoDock Vina), MD simulation

**Public proteomics:**
- PRIDE archive (pride.ebi.ac.uk): 40,000+ datasets
- PhosphoSitePlus: PTM databases
- ProteomicsDB: 18,000 human proteins with expression
- Human Protein Atlas (proteinatlas.org): protein expression in tissues + cancer
- AlphaFold Protein Structure Database: 200M+ structure predictions
- RCSB PDB: 200,000+ experimental structures

**Novel discovery opportunities:**
- AlphaFold2 missense variant effect on protein stability (ΔΔG prediction via FoldX/EvoEF)
- Proteogenomics: integrate TCGA RNA-seq + CPTAC proteomics for post-transcriptional regulation
- PTM crosstalk mapping from PhosphoSitePlus → cancer signaling network rewiring
- Disordered region function prediction using AlphaFold + flDPnn
- Cryo-EM structure of SARS-CoV-2 variants → antibody escape mechanism modeling

---

### 9. MULTI-OMICS INTEGRATION (★★★★★ — Highest novelty potential)
**Core framework:** MOFA+, DIABLO, MUON, Seurat WNN, scVI multi-modal

**Canonical knowledge:**
- Horizontal integration (same features, different samples): ComBat, limma removeBatchEffect
- Vertical integration (different features, same samples): MOFA+, DIABLO, NMF
- Single-cell multi-modal: CITE-seq (RNA+protein), 10x Multiome (RNA+ATAC), Slide-tags
- Graph-based integration: multi-view GNN, GLUE, scArches transfer learning
- Causal inference: Mendelian randomization for omics → phenotype

**Novel discovery opportunities:**
- Three-omics (RNA + ATAC + protein) factor analysis for transcription factor activity inference
- Mendelian randomization: causal analysis of metabolomics → disease phenotype using UK Biobank
- Cross-omics module preservation (WGCNA + protein co-expression) in aging
- Longitudinal multi-omics in treatment response (COMBAT COVID cohort, PRECISION-ALS)

---

### 10. MICROBIOME (★★★★☆)
**Core framework:** QIIME2, DADA2, MetaPhlAn4, HUMAnN3, MicrobiomeDB

**Canonical knowledge:**
- 16S rRNA V3-V4 amplicon sequencing: DADA2 ASVs vs OTUs
- Shotgun metagenomics: Kraken2 + Bracken, MetaPhlAn4, HUMAnN3 (functional)
- Diversity: alpha (Shannon, Chao1, Faith's PD), beta (UniFrac, Bray-Curtis)
- Enterotypes: Bacteroidetes/Firmicutes ratio, dysbiosis
- Gut-brain axis, gut-liver axis, gut-lung axis crosstalk
- Microbiome-immune crosstalk: SCFAs → Tregs, LPS → inflammasome, tryptophan → IDO

**Public microbiome data:**
- HMP (Human Microbiome Project): HMP1, HMP2 iHMP
- curatedMetagenomicData: 80+ studies, R package, 20,000+ samples
- GMrepo: gut microbiome reference
- ENA/SRA: thousands of 16S and shotgun metagenomics studies
- MicrobiomeDB (Gates Foundation): clinical microbiome studies

**Novel discovery opportunities:**
- Microbiome-immunotherapy response prediction: Fusobacterium + anti-PD1 in CRC
- Oral microbiome as cancer biomarker (TCGA + TCGA microbiome data)
- Phage-bacteria interaction networks in IBD from shotgun metagenomics
- SCFA metabolomics + 16S integration for host immune regulation
- Longitudinal microbiome dynamics during chemotherapy (HMP2 IBDMDB)

---

### 11. SYSTEMS BIOLOGY (★★★★☆)
**Core framework:** Reactome, KEGG, STRING, NetworkX, Cytoscape

**Canonical knowledge:**
- Pathway enrichment: GSEA (ranked list), ORA (hypergeometric), ssGSEA (single-sample)
- Network analysis: scale-free networks, hub genes, betweenness centrality
- Boolean network models, ODEs for signaling dynamics
- Metabolic network reconstruction: COBRA Toolbox, flux balance analysis (FBA)
- Transcription factor regulatory networks: VIPER, ARACNe, GENIE3, SCENIC

**Novel discovery opportunities:**
- Context-specific metabolic modeling with TCGA RNA-seq + COBRA (cancer metabolic subtypes)
- Master transcription factor regulatory network rewiring in cancer vs normal (VIPER + TCGA)
- Drug synergy prediction from network proximity in drug-protein interaction networks

---

### 12. DRUG DISCOVERY & PHARMACOGENOMICS (★★★★☆)
**Core framework:** Goodman & Gilman, ChEMBL, DrugBank, RDKit, DeepChem

**Canonical knowledge:**
- Drug target identification: target-based vs phenotypic screening
- ADMET: absorption, distribution, metabolism, excretion, toxicity
- Lipinski's Rule of Five, drug-likeness, PAINS filters
- Lead optimization: SAR, QSAR, scaffold hopping
- Clinical trial phases: I (safety), II (efficacy), III (comparison), IV (post-market)
- Pharmacogenomics: germline vs somatic variation affecting drug response
- Drug repurposing: connectivity map (CMap/LINCS L1000), drug-disease proximity in networks
- PROTAC, molecular glues, covalent inhibitors — new modalities

**Novel discovery opportunities:**
- Drug repurposing via L1000/LINCS gene expression signatures + TCGA tumor profiles
- Polypharmacology: multi-target drug design from ChEMBL bioactivity data
- Synthetic lethal partner identification from DepMap CRISPR screens
- Cancer dependency map (DepMap): CRISPR + RNAi in 900+ cell lines

---

### 13. PATHOLOGY & COMPUTATIONAL PATHOLOGY (★★★★☆)
**Core framework:** Robbins & Cotran, QuPath, CLAM, CTransPath

**Canonical knowledge:**
- H&E morphology: nuclear atypia, mitotic figures, necrosis, tumor infiltrating lymphocytes (TILs)
- IHC markers: ER/PR/HER2 (breast), PD-L1 (lung), MMR proteins (CRC), ALK/ROS1 (NSCLC)
- Tumor grading (Gleason for prostate, Fuhrman for RCC, WHO grade for glioma)
- Digital pathology: whole-slide images (WSI), NDPI/SVS format, OpenSlide
- Computational pathology: tile extraction, MIL (multiple instance learning), attention heatmaps
- Foundation models for pathology: UNI, CONCH, PLIP, CTransPath, Prov-GigaPath

**Public pathology resources:**
- TCGA: 25,000 diagnostic slides across 30 tumor types
- CAMELYON16/17: breast cancer lymph node metastasis challenge
- PAIP: pancreatic cancer WSI
- TCIA (The Cancer Imaging Archive): CT + PET + WSI
- PANDA challenge: prostate Gleason grading

**Novel discovery opportunities:**
- Spatial immune cell density from H&E + cell segmentation predicting immunotherapy response
- Multi-modal pathology + genomics: H&E features correlating with mutation signatures
- AI-predicted tumor purity and cancer cell fraction from H&E alone
- WSI-based TLS detection and quantification → survival prediction

---

### 14. AI & FOUNDATION MODELS IN BIOMEDICINE (★★★★★)
**Core framework:** PyTorch, Hugging Face, MONAI, DeepChem

**Canonical knowledge:**
- Transformers in genomics: DNABERT, Nucleotide Transformer (2.5B), Hyena-DNA, Caduceus
- Gene expression models: Geneformer (29M cells), scGPT (33M cells), scFoundation
- Protein language models: ESM-2 (15B), ProtTrans, ANKH
- Structure prediction: AlphaFold2, AlphaFold3 (biomolecular complexes), RoseTTAFold
- Clinical NLP: BioBERT, ClinicalBERT, BioGPT, Med-PaLM 2
- Medical imaging: MedSAM, SAM-Med2D, SwinUNETR (MONAI)
- Drug discovery AI: DiffSBDD, EquiBind, DiffDock, GVP-GNN
- Geometric deep learning: molecular graphs, SE(3)-equivariant networks

**Novel discovery opportunities:**
- Zero-shot variant effect prediction using ESM-2 likelihood ratios (compare to ClinVar)
- Nucleotide Transformer fine-tuning on splice-site mutations from gnomAD
- Geneformer-based perturbation prediction for novel therapeutic targets
- AlphaFold3 for protein-DNA/RNA interactions in transcription factor binding
- scGPT transfer learning for rare disease single-cell annotation with few labeled examples

---

### 15. CARDIOVASCULAR MEDICINE (★★★★☆)
**Canonical knowledge:**
- Atherosclerosis: foam cells, lipid plaque, plaque vulnerability, VSMC phenotype switching
- Heart failure: HFrEF vs HFpEF, cardiac remodeling, fibrosis, NF-κB/TGFβ signaling
- Arrhythmia: channelopathies (SCN5A, KCNQ1, KCNH2), Brugada syndrome, Long QT
- Cardiomyopathies: HCM (MYH7/MYBPC3), DCM (TTN/LMNA), ARVC (desmosome genes)
- GWAS hits: ApoE, LDLR, PCSK9, LPA, FTO, TCF7L2

**Novel discovery opportunities:**
- Single-cell atlas of human heart failure (GEO: GSE183852, GSE166631)
- Spatial cardiac fibrosis mapping in DCM using Visium (ENCODE + GEO)
- Polygenic risk score for CAD (UK Biobank + CARDIoGRAMplusC4D GWAS)
- Rare variant analysis in sudden cardiac death using TOPMed

---

### 16. NEUROSCIENCE & NEUROLOGICAL DISEASES (★★★★☆)
**Canonical knowledge:**
- Synapse biology: LTP/LTD, NMDA/AMPA receptor trafficking
- Neurodegeneration: Alzheimer's (Aβ42/tau), Parkinson's (α-synuclein/LRRK2), ALS (TDP-43/FUS/C9orf72), Huntington's (CAG repeat)
- Brain tumors: GBM (IDH wild-type), LGG (IDH-mutant), medulloblastoma subgroups
- Psychiatric: schizophrenia (GWAS: 270+ loci), bipolar disorder, MDD, ASD (copy number variants)

**Novel discovery opportunities:**
- Single-cell aging atlas of brain (Aging Fly Cell Atlas, Allen Brain)
- TDP-43 cryptic exon splicing detection from RNA-seq (TDP-43 disease biomarker)
- Spatial neuroinflammation mapping in Alzheimer's (Allen MERFISH brain)
- Repeat expansion detection in ALS/FTD from Oxford Nanopore long reads

---

### 17. ENDOCRINOLOGY & METABOLIC DISEASE (★★★☆☆)
**Canonical knowledge:**
- T2D: insulin resistance (IRS1/PI3K/AKT axis), β-cell dysfunction, incretin system (GLP-1)
- Obesity: FTO, MC4R, LEP/LEPR, energy balance, adipokines
- Thyroid: TPO antibodies, Hashimoto's, Graves, DIO1/2 deiodinases
- Adrenal: cortisol feedback, CRH/ACTH/cortisol axis, glucocorticoid receptor

**Novel discovery opportunities:**
- GLP-1 receptor variant pharmacogenomics (rs6923761 + clinical response data)
- β-cell single-cell atlas across T2D progression (Human Pancreas Cell Atlas)
- Adipose tissue spatial transcriptomics in obesity (Visium + GTEx)

---

### 18. HEMATOLOGY (★★★★☆)
**Canonical knowledge:**
- Hematopoiesis: HSC → MPP → CMP/CLP → all lineages; key TFs: GATA1, PU.1, CEBPA
- Leukemia: AML (cytogenetics: t(15;17), t(8;21), inv(16)), CML (BCR-ABL1), ALL, CLL
- Lymphoma: DLBCL (GCB vs ABC), Follicular, Mantle cell, NLPHL
- MDS: del(5q), spliceosome mutations (SF3B1, SRSF2, U2AF1)
- CHIP: DNMT3A, TET2, ASXL1 — clonal advantage in aging

**Novel discovery opportunities:**
- CHIP mutation co-occurrence patterns in UK Biobank exomes (cardiovascular risk)
- AML single-cell trajectory of response to venetoclax+azacitidine
- Spatial bone marrow architecture in MDS (HTAN + ImagingBiomarkers)

---

### 19. INFECTIOUS DISEASE & VIROLOGY (★★★★☆)
**Canonical knowledge:**
- SARS-CoV-2: Spike protein evolution, immune evasion, long COVID pathogenesis
- HIV: CCR5/CXCR4 tropism, reservoir latency, LAIR (broadly neutralizing antibodies)
- Influenza: antigenic drift/shift, hemagglutinin phylogenetics
- Sepsis: cytokine storm, PANoptosis, monocyte exhaustion
- AMR: beta-lactamases (CTX-M), carbapenemases (KPC, NDM, OXA-48)

**Novel discovery opportunities:**
- Long COVID multi-omics: proteomics + scRNA-seq + autoantibody profiling (UCSF Long COVID study)
- SARS-CoV-2 evolution: real-time variant tracking from GISAID + phylogenetics
- HIV reservoir size estimation from ATACseq in CD4 T cells
- AMR gene dissemination networks from WGS plasmid phylogenetics

---

### 20. EPIGENOMIC CLOCKS & AGING (★★★★★ — Emerging)
**Canonical knowledge:**
- Epigenetic clocks: Horvath 2013 (353 CpGs), PhenoAge (pace of aging), DunedinPACE, GrimAge
- Hallmarks of aging: genomic instability, telomere attrition, epigenetic alterations, proteostasis loss, nutrient sensing deregulation, mitochondrial dysfunction, cellular senescence, stem cell exhaustion, altered intercellular communication
- Senescence: p16/CDKN2A, p21/CDKN1A, SASP (senescence-associated secretory phenotype)

**Novel discovery opportunities:**
- Pan-tissue epigenetic age acceleration in TCGA (methylation M-values → Horvath clock)
- SASP cytokine network inference from scRNA-seq in aged tissues
- Interventional rejuvenation: partial reprogramming (OSK) transcriptomic signatures

---

## PART II: CROSS-DOMAIN DISCOVERY MATRIX

These are the highest-novelty opportunities that span multiple domains:

| Discovery Opportunity | Domains | Public Data | Pipeline | Expected Impact |
|---|---|---|---|---|
| TLS spatial signature → immunotherapy response | Immunology + Oncology + Spatial | TCGA HTAN Visium + clinical outcomes | cell2location + survival analysis | Predict responders before treatment |
| cfDNA fragmentomics for multi-cancer detection | Oncology + Lab Medicine + AI | DELFI study GEO + CancerSEEK data | fragmentomics → XGBoost/RF | Blood-based cancer screening |
| Microbiome → immunotherapy response | Microbiome + Immunology + Oncology | curatedMetagenomicData + ImmPort | MetaPhlAn + random forest | Novel intervention target |
| Foundation model variant effect prediction | Genomics + AI + Drug Discovery | gnomAD + ClinVar + UniProt | ESM-2 likelihood + AlphaMissense | Clinical variant interpretation |
| Spatial senescence mapping | Aging + Spatial + Pathology | Human Cell Atlas Visium | BANKSY + SASP gene scoring | Tissue rejuvenation targets |
| scRNA immune atlas cross-disease | Immunology + 10 diseases | CellxGene census API (33M cells) | scVI + Harmony + UMAP | Universal immune cell states |
| CHIP → cardiovascular risk | Hematology + Cardiology + GWAS | UK Biobank WES + cardiac outcomes | burden test + Cox regression | Somatic mutation as CVD risk |
| Proteogenomics drug sensitivity | Oncology + Proteomics + Drug | CPTAC + DepMap + PRISM | WGCNA + drug sensitivity correlation | Novel biomarkers for precision oncology |
| Epigenetic clock across cancers | Epigenomics + Oncology + Aging | TCGA methylation 450K array | Horvath clock + survival | Biological age in cancer prognosis |
| TCR convergence in autoimmune | Immunology + Genetics | ImmPort + VDJdb + McPAS | motif analysis + clustering | Disease-specific antigen discovery |

---

## PART III: AVAILABLE PUBLIC DATASETS FOR NOVEL DISCOVERIES

### Genomics
- **TCGA** (gdc.cancer.gov): 33 tumor types, 20K patients; WES, RNA-seq, methylation, CNV, miRNA, protein
- **ICGC/PCAWG** (dcc.icgc.org): 2,658 WGS pan-cancer; comprehensive SV, SBS, DBS, ID signatures
- **UK Biobank** (ukbiobank.ac.uk): 500K participants; genetics, imaging, EHR, proteomics
- **gnomAD v4** (gnomad.broadinstitute.org): 807K exomes; population constraint, variant frequencies
- **TOPMed** (nhlbiwgs.org): 180K WGS; rare variants in diverse populations
- **All of Us** (allofus.nih.gov): 100K+ diverse WGS + EHR
- **FinnGen** (finngen.fi): 500K Finnish WGS + national registry phenotypes
- **ClinVar** (ncbi.nlm.nih.gov/clinvar): 1.8M variant interpretations
- **COSMIC** (cancer.sanger.ac.uk/cosmic): 6M somatic mutations, 100+ signatures

### Single-Cell
- **CellxGene Census** (cellxgene.cziscience.com): 800+ datasets, 33M human cells; REST API
- **Human Cell Atlas** (humancellatlas.org): coordinated atlas across organs
- **Tabula Sapiens** (tabula-sapiens.sf.czbiohub.org): 500+ cell types, 24 tissues
- **Allen Brain Cell Atlas** (brain.allenbrainen.org): MERFISH, 34M cells
- **ImmPort** (immport.org): 500+ immunology studies, flow cytometry, CyTOF, scRNA-seq

### Spatial
- **HTAN** (humantumoratlas.org): spatial tumor maps, Visium + CODEX + MERFISH
- **10x Datasets** (10xgenomics.com/resources/datasets): brain, heart, kidney reference datasets
- **SpatialDB** (spatialdb.zju.edu.cn): curated spatial transcriptomics studies

### Proteomics
- **CPTAC** (proteomics.cancer.gov): proteogenomics of major tumor types
- **PRIDE** (pride.ebi.ac.uk): 40K+ MS proteomics datasets
- **Human Protein Atlas** (proteinatlas.org): 18K proteins; tissue, cell, pathology, blood
- **AlphaFold DB** (alphafold.ebi.ac.uk): 200M+ predicted structures

### Drug & Chemical
- **ChEMBL** (ebi.ac.uk/chembl): 2.3M compounds, 20M activities
- **DrugBank** (go.drugbank.com): 15K drugs, targets, interactions, pharmacogenomics
- **DepMap** (depmap.org): 900+ cell line CRISPR, RNAi, drug sensitivity
- **PRISM** (depmap.org/prism): 4,500+ compounds screened across 900 cell lines
- **L1000/LINCS** (lincsproject.org): gene expression signatures of 30K compounds
- **PubChem** (pubchem.ncbi.nlm.nih.gov): 100M+ chemical structures

### Pathway & Network
- **Reactome** (reactome.org): 15K+ human reactions, 2.7K pathways
- **KEGG** (kegg.jp): metabolic + signaling pathways, drug-disease network
- **STRING** (string-db.org): protein-protein interactions, 67B interactions
- **WikiPathways** (wikipathways.org): community-curated pathways

### Phenotype & Clinical
- **GWAS Catalog** (ebi.ac.uk/gwas): 6,000+ GWAS, 500K+ associations
- **Open Targets** (opentargets.org): target-disease evidence scores, 60K disease-target pairs
- **PharmGKB** (pharmgkb.org): pharmacogenomics, clinical annotations
- **GTEx v8** (gtexportal.org): 54 tissues, 948 donors; eQTLs, sQTLs, splice QTLs

---

## PART IV: NOVEL PIPELINE BLUEPRINTS

### Blueprint 1: Multi-Cancer Immune Landscape Atlas
```
Data: TCGA (20K patients) + CellxGene (immune reference)
Step 1: Bulk RNA-seq immune deconvolution (CIBERSORT-X, TIMER2, EPIC)
Step 2: Single-cell reference mapping (Azimuth/Symphony)
Step 3: Pan-cancer immune subtype clustering (NMF, ConsensusClusterPlus)
Step 4: Clinical outcome association (Cox regression, KM plots)
Step 5: Immunotherapy response prediction (MSI + TMB + TIL score)
Novelty: Unified immune taxonomy across 33 tumor types with predictive score
```

### Blueprint 2: Spatial TLS Biomarker Pipeline
```
Data: HTAN Visium + TCGA clinical outcomes
Step 1: TLS spatial detection (CD20, CD3, PNAd co-localization)
Step 2: TLS maturity scoring (GC-like features, DC-LAMP)
Step 3: Survival analysis by TLS density + maturity
Step 4: Transcription factor activity in TLS (VIPER + ARACNe)
Step 5: Spatial communication between TLS and tumor cells (NicheNet)
Novelty: First pan-cancer spatial TLS quantification pipeline
```

### Blueprint 3: cfDNA Fragmentomics Multi-Cancer Detector
```
Data: GEO DELFI study + public cfDNA WGS
Step 1: Fragment length distribution (nucleosome-free region profiling)
Step 2: DELFI features: 5Mb window fragment ratios
Step 3: GC-corrected coverage at open chromatin regions (ENCODE ATAC peaks)
Step 4: Machine learning classifier (XGBoost, ensemble)
Step 5: Tissue of origin prediction using methylation deconvolution
Novelty: Integrated fragmentomics + methylation for early detection
```

### Blueprint 4: Foundation Model Variant Interpretation
```
Data: gnomAD v4 + ClinVar + protein structures
Step 1: ESM-2 (650M) log-likelihood ratio for all missense variants
Step 2: AlphaFold2 ΔΔG via FoldX for structural impact
Step 3: Nucleotide Transformer splice prediction for intronic variants
Step 4: Conservation-based CADD/REVEL benchmarking
Step 5: Ensemble pathogenicity score calibrated to ClinVar gold standards
Novelty: First unified foundation-model variant effect pipeline
```

### Blueprint 5: Microbiome-Immune Co-variation Network
```
Data: curatedMetagenomicData + ImmPort flow cytometry + CRC immunotherapy cohorts
Step 1: Differential abundance (ANCOM-BC2, MaAsLin2)
Step 2: Spearman correlation: microbial taxa ↔ immune cell subsets
Step 3: Partial correlation network (SPRING, SparCC)
Step 4: Mediation analysis: microbiome → metabolome → immune response
Step 5: Immunotherapy response meta-analysis across studies
Novelty: Causal microbiome-immune axis for immunotherapy prediction
```

### Blueprint 6: Epigenetic Age Pan-Cancer Analysis
```
Data: TCGA 450K methylation arrays (all tumor types) + GTEx normals
Step 1: Horvath clock / GrimAge / DunedinPACE computation
Step 2: Epigenetic age acceleration = DNAm_age - chronological_age
Step 3: Correlation with mutation load, immune infiltration, survival
Step 4: Pan-cancer clock concordance (DNAm vs transcriptomic aging)
Step 5: Drug sensitivity correlation (DepMap PRISM) to epigenetic age
Novelty: Epigenetic age as a universal cancer biomarker
```

---

## PART V: DISCOVERY PANEL SYSTEM PROMPT TEMPLATE

When the discovery agent is called, prepend this to Claude's context:

```
You are a world-class bioinformatics professor with deep expertise in:
immunology, oncology, genomics, single-cell biology, spatial transcriptomics,
epigenomics, proteomics, multi-omics, systems biology, drug discovery,
pathology, computational biology, and AI/ML in medicine.

Your knowledge synthesizes:
- Janeway's Immunobiology (9th ed), DeVita Cancer (12th ed)
- Thompson & Thompson Genetics in Medicine (9th ed)
- Lehninger Principles of Biochemistry (8th ed)
- Robbins & Cotran Pathologic Basis of Disease (10th ed)
- Bioinformatics Algorithms (Compeau & Pevzner)
- 500+ landmark papers from Nature, Science, Cell, NEJM
- Conference proceedings from ISMB 2024, ASHG 2024, AACR 2025

When suggesting novel analyses, always:
1. State the specific BIOLOGICAL HYPOTHESIS being tested
2. Name the exact PUBLIC DATASETS available (with accession numbers where possible)
3. Describe the PIPELINE step by step with specific tool names and versions
4. Estimate the EXPECTED FINDING and its clinical/biological significance
5. Rate the NOVELTY (1-5 stars) based on what's been published
6. Suggest CONTROL EXPERIMENTS needed to validate the finding
7. Point to LANDMARK PAPERS that establish the biological rationale

Prioritize discoveries that:
- Have NOT been done yet (high novelty)
- Are FEASIBLE with available public data TODAY
- Would have HIGH IMPACT if validated
- Could be published as a methods or discovery paper
```
