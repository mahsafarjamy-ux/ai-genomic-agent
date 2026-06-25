# CONFERENCE HIGHLIGHTS & EMERGING RESEARCH DIRECTIONS 2024-2025
## ISMB 2024 | ASHG 2024 | AACR 2025 | Key 2025 Preprints
*Synthesized from conference proceedings and key publications*

---

## TOP 20 NOVEL OPPORTUNITIES (Ranked by novelty × feasibility)

---

### 1. Pan-Cancer cfDNA Methylome + Fragmentome Multi-Feature Integration
**Hypothesis:** Joint modeling of methylation + fragmentomics + protein biomarkers achieves >95% specificity multi-cancer early detection
**Why novel:** FDA approved Shield (colorectal) in 2024 — first liquid biopsy. Nature Cancer 2026 preprint analyzed 1,294 plasma samples across 14 cancer types; combinatorial multi-feature approach is underexplored computationally.
**Public datasets:**
- CCGA study (NCT02889978) — 15,000+ participants, cfDNA methylation + fragmentomics
- PATHFINDER (NCT04241796) — 35,000 participants, 2025 data expected
- GEO: GSE149438 (CCGA sub-study methylation)
- EGA: EGAD00001006267 (GRAIL plasma methylation)
**Tools:** DRAGEN ctDNA, cfSNV, DECODR, Griffin (nucleosome footprinting), ichorCNA, EPIC array pipeline
**Readiness:** High

---

### 2. Spatial Perturb-seq: CRISPR Screens Within Intact Tissue Architecture
**Hypothesis:** Gene perturbation effects depend on spatial microenvironment — cell-line perturbation screens miss neighborhood-context effects
**Why novel:** Nature Communications 2026 published first Spatial Perturb-seq in mouse brain. PerturBase released (122 datasets, 46 studies) — no spatial-aware perturbation pipeline exists.
**Public datasets:**
- PerturBase: https://perturbase.cn (122 perturbation datasets)
- GEO: GSE133344 (Norman et al. Perturb-seq genome-scale)
- GEO: GSE246532 (Replogle et al. K562 genome-scale)
- GEO: GSE271670 (Multiome Perturb-seq)
**Tools:** Seurat, Squidpy, PASTE, CellChat, scVI-tools, MIMOSA
**Readiness:** Medium

---

### 3. Evo 2 Foundation Model — 40B Parameters, Entire Genomic Loci
**Hypothesis:** Evo 2 (Arc Institute + NVIDIA, Feb 2025) can predict regulatory element disruption and generate de novo functional DNA sequences across all life
**Why novel:** 40B parameters, 1-megabase context, trained on 9 trillion nucleotides. Weights publicly available. Fine-tuning for disease-specific regulatory variants is completely unexplored.
**Public datasets:**
- OpenGenome (9T nucleotides, Arc Institute)
- ENCODE regulatory annotations v4: encodeproject.org
- gnomAD v4.1 (730,947 exomes + 76,215 genomes)
- ClinVar: 4M+ variant-disease associations
**Tools:** Evo 2 (github.com/ArcInstitute/evo2), NVIDIA BioNeMo, Enformer, Nucleotide Transformer v2.5B
**Readiness:** High

---

### 4. Human Pangenome Graph (HPRC Phase 2) + T2T for Structural Variant Discovery
**Hypothesis:** Pangenome graph alignment identifies 30+ diagnostic SVs in rare disease genes missed by short-read linear alignment
**Why novel:** HPRC Phase 2 launched December 2024 — 200 new haplotype assemblies. 119 Mb novel sequence added. 8% of genome inaccessible by short reads now callable.
**Public datasets:**
- HPRC Data Release 2: humanpangenome.org (AWS S3 + INSDC)
- T2T-CHM13 v2.0: NCBI GCA_009914755.4
- 1000 Genomes ONT consortium: s3://1000genomes-ont (250+ samples, ongoing)
- Genomic Answers for Kids (GA4K): dbGaP phs002206
**Tools:** Minigraph-Cactus, vg toolkit, PBSV, Sniffles2, Jasmine, TRUVARI
**Readiness:** High

---

### 5. Tumor Microenvironment 4D Atlas (Spatial + Temporal + Single-Cell)
**Hypothesis:** Immune-striving TME states with peri-tumor lymphoid aggregates predict immunotherapy response beyond TIL density
**Why novel:** AACR 2025 plenary highlighted longitudinal TME dynamics. POSTN+ CAFs identified as immune suppressors. Integration of CITE-seq + PhenoCycler + spatial coordinates across time points not done at scale.
**Public datasets:**
- TISCH2 database: tisch.comp-genomics.org (233 tumor datasets, 2M cells)
- HTAN: htan-portal.broadinstitute.org
- CPTAC proteogenomics: GDC portal
- GEO: GSE200996 (NSCLC spatial + scRNA)
- GEO: GSE215120 (melanoma CITE-seq longitudinal)
- IMvigor210 bladder cancer immunotherapy cohort
**Tools:** Squidpy, COMMOT, CellPhoneDB v3, Liana, NicheNet, Misty, SpatialDE2
**Readiness:** High

---

### 6. Long-Read RNA-seq Isoform Atlas → Cancer Splicing Neoantigens
**Hypothesis:** 40%+ of tumor transcripts are unannotated isoforms creating novel peptide junctions detectable as neoantigens
**Why novel:** 40.2% of NSCLC transcripts and 62% of CRC transcripts are novel vs. annotations. Automated pipeline (long-read → isoform → peptide junction → MHC binding → neoantigen) has not been built.
**Public datasets:**
- ENCODE long-read RNA-seq: 50+ tissues, PacBio/ONT
- GTEx v10 long-read: dbGaP phs000424 (52 tissues)
- SRP151597 (PacBio Iso-Seq, 28 tissues)
- LRGASP benchmark: ENA PRJEB40711
**Tools:** IsoQuant, FLAMES, StringTie2, SQANTI3, Bambu, IsoPred, pVACtools
**Readiness:** Medium

---

### 7. Multimodal Foundation Models for Single-Cell Perturbation (Virtual Cell)
**Hypothesis:** Disease-specific fine-tuning of virtual cell models (scVI + PerturBase) enables in silico drug target validation before wet lab
**Why novel:** Arc Institute's first virtual cell (June 2025). Systematic benchmark showed PCA still outperforms most foundation models on held-out perturbations — large gap remains.
**Public datasets:**
- PerturBase: https://perturbase.cn (122 datasets, genetic + chemical)
- NeurIPS 2023 Perturbation Challenge: Replogle + Norman
- LINCS L1000: GEO GSE70138 (1.3M chemical perturbation profiles)
- scPerturb harmonized database: scperturb.org
**Tools:** scVI, scGEN, GEARS, CPA (Compositional Perturbation Autoencoder), Geneformer, CellProphet
**Readiness:** Medium

---

### 8. Subcellular-Resolution Spatial Transcriptomics for TME Drug Biomarkers
**Hypothesis:** Subcellular-resolution (Xenium 5K, CosMx 6K) reveals ligand-receptor interactions not visible in spot-based methods
**Why novel:** Nature Methods 2025 published Xenium best-practice workflows. Systematic cross-platform benchmarking just became available (2025). FFPE archival samples now accessible.
**Public datasets:**
- 10x Xenium public datasets: 10xgenomics.com/datasets (breast, brain, lung FFPE)
- MERFISH Mouse Primary Motor Cortex: brain-map.org (BICCN)
- Vizgen MERFISH Human Liver Cancer: vizgen.com/resources
- SpatialBenchVisium: PMC11954323 (multi-tissue, multi-platform)
**Tools:** Xenium Explorer, BayesSpace, BANKSY, STAGATE, GraphST, Tangram, RCTD, cell2location
**Readiness:** High

---

### 9. Cross-Ancestry Polygenic Risk Score Calibration
**Hypothesis:** Multi-ancestry PRS using ancestry-matched GWAS improves prediction 30-50% in African, Latino, South Asian populations
**Why novel:** ASHG 2024 emphasized 78% of GWAS are European ancestry. Cross-ancestry Alzheimer's PRS (medRxiv 2025) showed transfer learning works — framework not generalized.
**Public datasets:**
- TOPMed: dbGaP phs001974 (180,000+ diverse)
- PAGE Study: dbGaP phs001755 (50,000 non-European)
- MVP: dbGaP phs001672 (750,000+, 46% non-European)
- gnomAD v4.1 allele frequencies
**Tools:** PRSice-2, LDpred2, PRS-CSx (cross-ancestry), MUSSEL, AnnoPred, PLINK2
**Readiness:** High

---

### 10. AlphaFold3 Cryptic Binding Site Discovery in the Dark Proteome
**Hypothesis:** AF3 + MD simulation + ML identifies druggable cryptic pockets in transcription factors and understudied RAS family proteins
**Why novel:** AlphaFold3 (May 2024) model weights released for academic use November 2024. Isomorphic Labs using internally — systematic cryptic pocket screen across dark proteome not published.
**Public datasets:**
- AlphaFold Protein Structure DB: alphafold.ebi.ac.uk (214M+ structures)
- PDB: rcsb.org (215,000+ experimental structures)
- ChEMBL v34: ebi.ac.uk/chembl (2.4M compounds)
- BindingDB: bindingdb.org
**Tools:** AlphaFold3 (github.com/google-deepmind/alphafold3), Boltz-1, RoseTTAFold All-Atom, AutoDock-GPU, DeepPocket, fpocket
**Readiness:** High

---

### 11. Clonal Hematopoiesis (CHIP) Longitudinal Somatic Evolution Atlas
**Hypothesis:** CHIP (DNMT3A, ASXL1, TET2) × lipid gene interactions amplify atherosclerosis risk — predictive deep learning model from serial blood draws
**Why novel:** AACR 2025 Discovery Science Plenary on somatic mosaicism. CHIP affects 10% of >65yo. Longitudinal transition probability model from CHIP → cancer not built.
**Public datasets:**
- UK Biobank WES: 200,000 samples
- TOPMed WGS: dbGaP phs001974
- GENIE project (AACR): synapse.org/genie (190,000+ tumor sequencing)
- BioMe Biobank: dbGaP phs000925
**Tools:** Mutect2 (CHIP mode), UMI-aware variant callers, MOBSTER, PyClone-VI, PAUP*
**Readiness:** High

---

### 12. Non-Coding Variant Effect Prediction (Enformer + Cross-Species + Hi-C)
**Hypothesis:** Combining Enformer regulatory scores + 241-mammal conservation + Hi-C TAD boundary disruption outperforms CADD/REVEL for non-coding GWAS variant interpretation
**Why novel:** ASHG 2024 featured multiple sessions on this. Nucleotide Transformer v2 (2.5B) strong on chromatin prediction. Integrated non-coding predictor calibrated on diverse GWAS not built.
**Public datasets:**
- ENCODE v4 cCREs: 2.3M regulatory elements
- 4D Nucleome Hi-C: 4dnucleome.org
- GTEx v10 eQTL: gtexportal.org
- UCSC 241-mammal alignment
**Tools:** Enformer, Nucleotide Transformer (HuggingFace: InstaDeepAI), Basenji2, DeepSEA, SuSiE-inf, PolyFun
**Readiness:** Medium

---

### 13. cfDNA Nucleosome Positioning + Epigenetic Clock for Biological Age Liquid Biopsy
**Hypothesis:** cfDNA nucleosome positioning captures cell-type-of-origin and aging signals simultaneously — outperforms methylation-only clocks for mortality prediction
**Why novel:** 2024 publication: first aging clock based on cfDNA nucleosome positioning (not CpG sites). Second-generation clocks incorporating lifestyle+clinical variables now outperform first-gen.
**Public datasets:**
- GEO: GSE40279, GSE55763, GSE87571 (EPIC array aging cohorts)
- InCHIANTI cohort (longitudinal): dbGaP phs000589
- GEO: GSE197693 (cfDNA nucleosome positioning atlas)
**Tools:** pyDeepMAge, methylCIPHER, ChAMP, minfi, Griffin (cfDNA nucleosome), LIQUORICE
**Readiness:** Medium

---

### 14. Multimodal scRNA + ATAC + Protein Cell Differentiation Atlas (hECA v2.0 Integration)
**Hypothesis:** Joint RNA+ATAC+protein latent space maps differentiation trajectories and TF regulatory logic across disease states
**Why novel:** hECA v2.0 integrates 10.8M scRNA + 1.45M scATAC cells across 42 organs (2025). ChromFound: first universal foundation model for scATAC. Multi-modal differentiation trajectory mapping at this scale not done.
**Public datasets:**
- hECA v2.0: figshare DOI 10.6084/m9.figshare.21193428
- Human Cell Atlas portal: data.humancellatlas.org (50M cells)
- scMMO-atlas: scmmo-atlas.com (8 omics, 125 tissues)
- PBMC multiome 10k (10X Genomics, public)
**Tools:** Seurat v5, Signac, WNN, ArchR, MOFA+, MultiVI, scBridge, ChromFound
**Readiness:** High

---

### 15. KRAS G12D / RAS-ON Inhibitor Resistance Mechanism Discovery
**Hypothesis:** Single-cell trajectory analysis of pre/on/post-treatment biopsies maps resistance to secondary mutations vs. bypass signaling vs. EMT programs
**Why novel:** Zoldonrasib achieved 61% ORR in G12D NSCLC (AACR 2025) but 39% don't respond. RAS-ON class is new — resistance mechanisms completely uncharted computationally.
**Public datasets:**
- GENIE BPC (Biopharma Collaborative): synapse.org/genie (longitudinal clinical + genomic)
- CCLE / DepMap: depmap.org (drug response + genomics)
- GDSC: cancerrxgene.org
**Tools:** Monocle3, SCENIC+, PhyloWGS, REVOLVER, CNAqc
**Readiness:** Medium

---

### 16. 5hmC + 5mC Joint Profiling from ONT cfDNA for Cancer Detection
**Hypothesis:** 5hmC depletion in cancer provides orthogonal signal to 5mC methylation; joint ONT classifier achieves better tissue-of-origin than bisulfite-seq alone
**Why novel:** ASHG 2024 highlighted 5hmC profiling from low-nanogram cfDNA. ONT direct sequencing detects base modifications without bisulfite conversion — joint classifier not published.
**Public datasets:**
- GEO: GSE112679 (plasma 5hmC across cancer types)
- ENCODE 5hmC ChIP-seq tissue reference panel
- SRA: SRP200313 (plasma 5hmC cancer detection study)
**Tools:** modkit (ONT), f5c, deepsignal3, methylartist, CAMDAC
**Readiness:** Medium

---

### 17. TLS (Tertiary Lymphoid Structure) Spatial Niche Atlas Across Cancer Types
**Hypothesis:** TLS formation dynamics predicted by spatial multi-omics (TF activity + cell-communication) are the strongest spatial predictor of immunotherapy response
**Why novel:** AACR 2025: POSTN+ CAFs drive immune suppression spatially. Frontiers Immunology 2025: spatial + scRNA-seq dissects TME with unprecedented resolution. Systematic TLS atlas across cancer types not done.
**Public datasets:**
- HTAN spatial transcriptomics: htan-portal.broadinstitute.org
- GEO: GSE203612 (TLS spatial transcriptomics NSCLC)
- GEO: GSE199012 (spatial melanoma pre/post immunotherapy)
- Xenium FFPE public breast cancer (10x Genomics)
**Tools:** COMMOT, cell2location, NicheNet, RCTD, Giotto, BANKSY
**Readiness:** Medium

---

### 18. Tandem Repeat Expansion Catalog from ONT Data Mapped to T2T + Pangenome
**Hypothesis:** ONT ultra-long reads reveal pathogenic repeat expansions in rare neurological diseases that are invisible to short-read sequencing
**Why novel:** 1000G ONT consortium resequencing 3,300 samples. T2T-CHM13 makes repeat regions callable. Automated cross-reference with rare neurological disease phenotypes not built.
**Public datasets:**
- 1000G ONT consortium: s3://1000genomes-ont (~250 samples, ongoing)
- HPRC Data Release 2: humanpangenome.org
- gnomAD-SV v4: genome-wide SV frequencies
- ClinVar pathogenic repeat expansions
**Tools:** Sniffles2, PBSV, TRUVARI, GraphAligner, vg giraffe, ExpansionHunter Denovo, STRAGLR
**Readiness:** High

---

### 19. Proteogenomic GWAS→eQTL→pQTL Mendelian Randomization
**Hypothesis:** PTM-level evidence (not mRNA) identifies causal mechanisms at GWAS loci, nominating druggable targets missed by eQTL alone
**Why novel:** Mass Spectrometry Reviews 2026 review on next-gen precision oncology proteomics. UKBB pQTL atlas: 1,463 proteins × 500K individuals released. GWAS→eQTL→pQTL→structure MR pipeline not systematized.
**Public datasets:**
- CPTAC Data Portal: proteomics.cancer.gov (10 tumor types, matched WES+RNA+protein+phospho)
- UKBB pQTL atlas: ukbiobank.ac.uk (1,463 proteins × 500K)
- deCODE pQTL: 4,907 proteins (Nature 2023)
- cBioPortal CPTAC integration
**Tools:** StringTie2 + MSFragger, FragPipe, MOFA+, SMR (Summary MR), coloc, pTWAS
**Readiness:** High

---

### 20. Genomics Foundation Model Fine-Tuning for Clinical Report Generation
**Hypothesis:** Fine-tuned Nucleotide Transformer + clinical LLM on ClinVar + OMIM generates structured clinical genomics reports from raw variant calls
**Why novel:** GenomeQA (arXiv 2025) benchmarked general LLMs on genome sequence understanding — significant gaps. Cell2Text (arXiv 2025) generates text from scRNA-seq. Multimodal genomics + clinical report generation not done.
**Public datasets:**
- ClinVar: 4M+ variant-disease associations
- OMIM: 25,000+ gene-phenotype relationships
- ClinGen free tier
**Tools:** Nucleotide Transformer v2 (HuggingFace: InstaDeepAI/nucleotide-transformer-v2-500m-multi-species), Llama 3.1 fine-tuning, BioLinkBERT, PubMedBERT
**Readiness:** High

---

## KEY CROSS-CUTTING THEMES FROM 2024-2025

### 1. Multi-modal Integration is the Dominant Frontier
Every high-impact opportunity requires combining 2+ data types (DNA + RNA + protein + spatial + clinical).
Key platforms: CITE-seq, 10x Multiome, Xenium, CosMx, PacBio MAS-seq, ONT

### 2. Foundation Models Need Disease-Specific Fine-Tuning
Evo 2, Nucleotide Transformer, Geneformer are publicly available but undertapped on clinical phenotypes.
Gap: perturbation response prediction, regulatory element design, clinical report generation

### 3. The "Dark Genome" is Opening
T2T + pangenome + long-read sequencing makes previously inaccessible biology computable:
- 8% of the genome now callable with T2T vs GRCh38
- 119 Mb novel sequence in HPRC pangenome
- Tandem repeats, structural variants, non-coding regulatory elements

### 4. Spatial Context is the Missing Layer
Most existing single-cell atlases lack spatial coordinates.
Integrating them creates massive new biology: TLS, CAF-immune interactions, TME niches

### 5. Equity Gap = Research Opportunity
Non-European genomics datasets severely underrepresented.
MVP (750K, 46% non-European), TOPMed (180K diverse), PAGE (50K non-European) are underused.

---

## DATASET QUICK REFERENCE (2024-2025 additions)

| Dataset | Access | Size | Focus |
|---------|--------|------|-------|
| HPRC Phase 2 | humanpangenome.org | 200+ assemblies | Pangenome graph |
| T2T-CHM13 v2.0 | NCBI GCA_009914755.4 | 1 genome | Complete reference |
| 1000G ONT | s3://1000genomes-ont | 250+ ongoing | Long-read SV |
| PerturBase | perturbase.cn | 122 datasets | Perturbation |
| hECA v2.0 | figshare 10.6084/... | 10.8M cells | Single-cell multi-omic |
| GENIE BPC | synapse.org/genie | 190K+ | Longitudinal cancer |
| TISCH2 | tisch.comp-genomics.org | 233 datasets | Tumor TME |
| Xenium public | 10xgenomics.com/datasets | Growing | Subcellular spatial |
| TOPMed | dbGaP phs001974 | 180K+ | Diverse WGS |
| MVP | dbGaP phs001672 | 750K+ | Diverse, 46% non-Eur |
| UKBB pQTL | ukbiobank.ac.uk | 1,463 proteins × 500K | Proteogenomics |
| AlphaFold DB | alphafold.ebi.ac.uk | 214M structures | Protein structure |
| OpenGenome | Arc Institute | 9T nucleotides | Evo 2 pretraining |
| EGA EGAD00001006267 | EGA portal | GRAIL plasma | cfDNA methylation |

---

## KEY 2024-2025 PUBLICATIONS TO CITE

- **Evo 2** (Arc Institute + NVIDIA, Feb 2025): 40B param DNA FM, github.com/ArcInstitute/evo2
- **AlphaFold3** (DeepMind, Nature May 2024): protein-ligand-nucleic complex prediction
- **Spatial Perturb-seq** (Nature Communications 2026): in vivo CRISPR + spatial transcriptomics
- **Pan-cancer cfDNA methylomes** (Nature Cancer 2026): 1,294 plasma samples, 14 cancer types
- **hECA v2.0** (Scientific Data 2025): 10.8M scRNA + 1.45M scATAC, 42 organs
- **scMMO-atlas** (Nucleic Acids Research 2025): 8 omics types, 125 tissues
- **Zoldonrasib KRAS G12D** (AACR 2025): 61% ORR, new RAS-ON class
- **Xenium best practices** (Nature Methods 2025): subcellular-resolution spatial
- **Cross-ancestry PRS** (medRxiv 2025): transfer learning for Alzheimer's in multi-ethnic cohorts
- **HPRC Phase 2** (Dec 2024): 200+ new haplotype assemblies, 119 Mb novel sequence
