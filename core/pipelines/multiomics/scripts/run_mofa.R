library(MOFA2)
library(ggplot2)
library(data.table)

log_file <- snakemake@log[[1]]
sink(log_file, append = FALSE, split = TRUE)

mofa <- readRDS(snakemake@input[[1]])
n_factors      <- snakemake@config[["mofa_n_factors"]]
conv_tol       <- snakemake@config[["mofa_convergence_tol"]]
sample_metadata <- snakemake@config[["sample_metadata"]]

# Set training options
data_opts <- get_default_data_options(mofa)
data_opts$scale_views <- TRUE

model_opts <- get_default_model_options(mofa)
model_opts$num_factors <- n_factors

train_opts <- get_default_training_options(mofa)
train_opts$convergence_mode <- "slow"
train_opts$seed <- 42
train_opts$maxiter <- 1000

mofa <- prepare_mofa(
  object = mofa,
  data_options = data_opts,
  model_options = model_opts,
  training_options = train_opts
)

# Train model
mofa <- run_mofa(mofa, outfile = snakemake@output[["model"]], use_basilisk = TRUE)

# Load sample metadata if available
if (!is.null(sample_metadata) && file.exists(sample_metadata)) {
  meta <- fread(sample_metadata)
  samples_metadata(mofa) <- as.data.frame(meta)
}

# ── Plots ────────────────────────────────────────────────────────────────────

pdf(snakemake@output[["variance"]], width = 10, height = 5)
p1 <- plot_variance_explained(mofa, max_r2 = 15)
p2 <- plot_variance_explained(mofa, plot_total = TRUE)[[2]]
print(p1)
print(p2)
dev.off()

pdf(snakemake@output[["factors"]], width = 12, height = 8)
for (i in seq_len(min(n_factors, 5))) {
  p <- plot_factor(mofa, factor = i, color_by = "group", shape_by = "group") +
    ggtitle(paste("Factor", i))
  print(p)
}
# Top weights per factor per view
for (view in views_names(mofa)) {
  p <- plot_top_weights(mofa, view = view, factor = 1, nfeatures = 20) +
    ggtitle(paste("Top weights —", view, "— Factor 1"))
  print(p)
}
dev.off()

# ── Feature enrichment ───────────────────────────────────────────────────────
enrichment_rows <- list()
for (view in views_names(mofa)) {
  for (f in seq_len(n_factors)) {
    w <- get_weights(mofa, views = view, factors = f)[[1]][, 1]
    top_pos <- names(sort(w, decreasing = TRUE)[1:50])
    top_neg <- names(sort(w)[1:50])
    enrichment_rows[[length(enrichment_rows) + 1]] <- data.frame(
      view = view, factor = f,
      top_positive_features = paste(top_pos, collapse = ";"),
      top_negative_features = paste(top_neg, collapse = ";")
    )
  }
}
fwrite(do.call(rbind, enrichment_rows), snakemake@output[["enrichment"]], sep = "\t")

cat("MOFA+ analysis complete.\n")
sink()
