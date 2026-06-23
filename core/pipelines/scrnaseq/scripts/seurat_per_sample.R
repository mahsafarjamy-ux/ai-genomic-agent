library(Seurat)
library(ggplot2)

log_file <- snakemake@log[[1]]
sink(log_file, append = FALSE, split = TRUE)

matrix_dir <- snakemake@input[["matrix"]]
sample_name <- snakemake@wildcards[["sample"]]
min_cells <- snakemake@config[["min_cells"]]
min_features <- snakemake@config[["min_features"]]
max_mt_pct <- snakemake@config[["max_mt_percent"]]

counts <- Read10X(data.dir = matrix_dir)
seurat <- CreateSeuratObject(
  counts = counts,
  project = sample_name,
  min.cells = min_cells,
  min.features = min_features
)

# Mitochondrial QC
seurat[["percent.mt"]] <- PercentageFeatureSet(seurat, pattern = "^MT-")

pdf(snakemake@output[["qc_plot"]])
VlnPlot(seurat, features = c("nFeature_RNA", "nCount_RNA", "percent.mt"), ncol = 3)
dev.off()

# Filter cells
seurat <- subset(seurat,
  subset = nFeature_RNA > min_features &
           nFeature_RNA < 6000 &
           percent.mt < max_mt_pct
)

cat(sprintf("Sample %s: %d cells after QC filtering\n", sample_name, ncol(seurat)))

# Normalize and find variable features
seurat <- NormalizeData(seurat, normalization.method = "LogNormalize", scale.factor = 10000)
seurat <- FindVariableFeatures(seurat, selection.method = "vst", nfeatures = 2000)
seurat <- ScaleData(seurat)
seurat <- RunPCA(seurat, npcs = 30)

saveRDS(seurat, file = snakemake@output[["rds"]])
sink()
