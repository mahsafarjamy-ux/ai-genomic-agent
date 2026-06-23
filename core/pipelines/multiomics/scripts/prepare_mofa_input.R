library(MOFA2)
library(data.table)

log_file <- snakemake@log[[1]]
sink(log_file, append = FALSE, split = TRUE)

# Load each modality that was provided (non-empty paths)
data_list <- list()

load_matrix <- function(path, name) {
  if (is.null(path) || path == "" || !file.exists(path)) return(NULL)
  mat <- as.matrix(fread(path, header = TRUE), rownames = 1)
  cat(sprintf("Loaded %s: %d features x %d samples\n", name, nrow(mat), ncol(mat)))
  mat
}

rna  <- load_matrix(snakemake@input[["rna"]],         "RNA-seq")
atac <- load_matrix(snakemake@input[["atac"]],        "ATAC-seq")
meth <- load_matrix(snakemake@input[["methylation"]], "Methylation")
prot <- load_matrix(snakemake@input[["proteomics"]],  "Proteomics")
micr <- load_matrix(snakemake@input[["microbiome"]],  "Microbiome")

# Build named list of modalities (only non-NULL)
for (name in c("RNA", "ATAC", "Methylation", "Proteomics", "Microbiome")) {
  mat <- get(tolower(c(RNA=rna, ATAC=atac, Methylation=meth, Proteomics=prot, Microbiome=micr)[[name]]))
  if (!is.null(mat)) data_list[[name]] <- mat
}

data_list <- Filter(Negate(is.null), list(
  RNA = rna, ATAC = atac, Methylation = meth,
  Proteomics = prot, Microbiome = micr
))

# Find common samples across all modalities
common_samples <- Reduce(intersect, lapply(data_list, colnames))
cat(sprintf("\nCommon samples across %d modalities: %d\n", length(data_list), length(common_samples)))

data_list <- lapply(data_list, function(m) m[, common_samples, drop = FALSE])

# Feature selection per modality (top variable features)
data_list <- lapply(names(data_list), function(nm) {
  m <- data_list[[nm]]
  if (nrow(m) > 5000) {
    vars <- apply(m, 1, var, na.rm = TRUE)
    m <- m[order(vars, decreasing = TRUE)[1:5000], ]
    cat(sprintf("  %s: selected top 5000 variable features\n", nm))
  }
  m
}) |> setNames(names(data_list))

# Create MOFA object
mofa <- create_mofa(data_list)

# Summary table
summary_rows <- lapply(names(data_list), function(nm) {
  data.frame(modality = nm, n_features = nrow(data_list[[nm]]), n_samples = ncol(data_list[[nm]]))
})
summary_df <- do.call(rbind, summary_rows)
fwrite(summary_df, snakemake@output[["data_summary"]], sep = "\t")

saveRDS(mofa, snakemake@output[["mofa_input"]])
cat("MOFA input object saved.\n")
sink()
