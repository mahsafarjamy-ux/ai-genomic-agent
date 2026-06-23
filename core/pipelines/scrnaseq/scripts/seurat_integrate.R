library(Seurat)
library(ggplot2)
library(patchwork)

log_file <- snakemake@log[[1]]
sink(log_file, append = FALSE, split = TRUE)

rds_files <- snakemake@input[["rds"]]
resolution <- snakemake@config[["clustering_resolution"]]

# Load all samples
seurat_list <- lapply(rds_files, readRDS)
names(seurat_list) <- sapply(seurat_list, function(x) x@project.name)

# Integration using Harmony (fast, memory-efficient)
library(harmony)
merged <- merge(seurat_list[[1]], y = seurat_list[-1], add.cell.ids = names(seurat_list))
merged <- FindVariableFeatures(merged, selection.method = "vst", nfeatures = 2000)
merged <- ScaleData(merged)
merged <- RunPCA(merged, npcs = 30)
merged <- RunHarmony(merged, group.by.vars = "orig.ident")
merged <- FindNeighbors(merged, reduction = "harmony", dims = 1:20)
merged <- FindClusters(merged, resolution = resolution)
merged <- RunUMAP(merged, reduction = "harmony", dims = 1:20)

# Find cluster markers
markers <- FindAllMarkers(
  merged,
  only.pos = TRUE,
  min.pct = 0.25,
  logfc.threshold = 0.25
)

# Save outputs
pdf(snakemake@output[["umap"]])
print(DimPlot(merged, reduction = "umap", group.by = "seurat_clusters", label = TRUE) +
      DimPlot(merged, reduction = "umap", group.by = "orig.ident"))
dev.off()

write.csv(markers, snakemake@output[["markers"]], row.names = FALSE)
saveRDS(merged, file = snakemake@output[["integrated"]])

cat(sprintf("Integration complete: %d cells, %d clusters\n",
            ncol(merged), length(unique(Idents(merged)))))
sink()
