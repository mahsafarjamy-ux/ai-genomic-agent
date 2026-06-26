# rnaseq — nf-core RNA-seq pipeline

**GitHub:** https://github.com/nf-core/rnaseq
**Category:** nfcore
**Language:** Nextflow
**Stars:** 1,322
**Topics:** nextflow, nf-core, pipeline, rna, rna-seq, workflow
**Description:** RNA sequencing analysis pipeline using STAR, RSEM, HISAT2 or Salmon with gene/isoform counts and extensive quality control.


---

## README

<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/nf-core-rnaseq_logo_dark.png">
    <img alt="nf-core/rnaseq" src="docs/images/nf-core-rnaseq_logo_light.png">
  </picture>
</h1>

[![Open in GitHub Codespaces](https://img.shields.io/badge/Open_In_GitHub_Codespaces-black?labelColor=grey&logo=github)](https://github.com/codespaces/new/nf-core/rnaseq)
[![GitHub Actions CI Status](https://github.com/nf-core/rnaseq/actions/workflows/nf-test.yml/badge.svg)](https://github.com/nf-core/rnaseq/actions/workflows/nf-test.yml)
[![GitHub Actions Linting Status](https://github.com/nf-core/rnaseq/actions/workflows/linting.yml/badge.svg)](https://github.com/nf-core/rnaseq/actions/workflows/linting.yml)[![AWS CI](https://img.shields.io/badge/CI%20tests-full%20size-FF9900?labelColor=000000&logo=Amazon%20AWS)](https://nf-co.re/rnaseq/results)[![Cite with Zenodo](http://img.shields.io/badge/DOI-10.5281/zenodo.1400710-1073c8?labelColor=000000)](https://doi.org/10.5281/zenodo.1400710)
[![nf-test](https://img.shields.io/badge/unit_tests-nf--test-337ab7.svg)](https://www.nf-test.com)

[![Nextflow](https://img.shields.io/badge/version-%E2%89%A525.04.3-green?style=flat&logo=nextflow&logoColor=white&color=%230DC09D&link=https%3A%2F%2Fnextflow.io)](https://www.nextflow.io/)
[![nf-core template version](https://img.shields.io/badge/nf--core_template-4.0.2-green?style=flat&logo=nfcore&logoColor=white&color=%2324B064&link=https%3A%2F%2Fnf-co.re)](https://github.com/nf-core/tools/releases/tag/4.0.2)
[![run with conda](http://img.shields.io/badge/run%20with-conda-3EB049?labelColor=000000&logo=anaconda)](https://docs.conda.io/en/latest/)
[![run with docker](https://img.shields.io/badge/run%20with-docker-0db7ed?labelColor=000000&logo=docker)](https://www.docker.com/)
[![run with singularity](https://img.shields.io/badge/run%20with-singularity-1d355c.svg?labelColor=000000)](https://sylabs.io/docs/)
[![Launch on Seqera Platform](https://img.shields.io/badge/Launch%20%F0%9F%9A%80-Seqera%20Platform-%234256e7)](https://cloud.seqera.io/launch?pipeline=https://github.com/nf-core/rnaseq)

[![Get help on Slack](http://img.shields.io/badge/slack-nf--core%20%23rnaseq-4A154B?labelColor=000000&logo=slack)](https://nfcore.slack.com/channels/rnaseq)[![Follow on Bluesky](https://img.shields.io/badge/bluesky-%40nf__core-1185fe?labelColor=000000&logo=bluesky)](https://bsky.app/profile/nf-co.re)[![Follow on Mastodon](https://img.shields.io/badge/mastodon-nf__core-6364ff?labelColor=FFFFFF&logo=mastodon)](https://mstdn.science/@nf_core)[![Watch on YouTube](http://img.shields.io/badge/youtube-nf--core-FF0000?labelColor=000000&logo=youtube)](https://www.youtube.com/c/nf-core)

## Introduction

**nf-core/rnaseq** is a bioinformatics pipeline that can be used to analyse RNA sequencing data obtained from organisms with a reference genome and annotation. It takes a samplesheet with FASTQ files or pre-aligned BAM files as input, performs quality control (QC), trimming and (pseudo-)alignment, and produces a gene expression matrix and extensive QC report.

![nf-core/rnaseq metro map](docs/images/nf-core-rnaseq_metro_map_grey_animated.svg)

> In case the image above is not loading, please have a look at the [static version](docs/images/nf-core-rnaseq_metro_map_grey.png).

1. Merge re-sequenced FastQ files ([`cat`](http://www.linfo.org/cat.html))
2. Auto-infer strandedness by subsampling and pseudoalignment ([`fq`](https://github.com/stjude-rust-labs/fq), [`Salmon`](https://combine-lab.github.io/salmon/))
3. Read QC ([`FastQC`](https://www.bioinformatics.babraham.ac.uk/projects/fastqc/))
4. UMI extraction ([`UMI-tools`](https://github.com/CGATOxford/UMI-tools))
5. Adapter and quality trimming ([`Trim Galore!`](https://www.bioinformatics.babraham.ac.uk/projects/trim_galore/))
6. Removal of genome contaminants ([`BBSplit`](http://seqanswers.com/forums/showthread.php?t=41288))
7. Removal of ribosomal RNA ([`SortMeRNA`](https://github.com/biocore/sortmerna))
8.
…[truncated]

---

## Key Files

### CHANGELOG.md

```
# nf-core/rnaseq: Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [[3.26.0](https://github.com/nf-core/rnaseq/releases/tag/3.26.0)] - 2026-05-07

### Credits

Special thanks to the following for their contributions to the release:

- [Daniel Lundin](https://github.com/erikrikarddaniel)
- [Edmund Miller](https://github.com/edmundmiller)
- [Felix Krueger](https://github.com/FelixKrueger)
- [Friederike Hanssen](https://github.com/FriederikeHanssen)
- [James A. Fellows Yates](https://github.com/jfy133)
- [Long Pan](https://github.com/LongpanICR)
- [Luisa Santus](https://github.com/luisas)
- [Matthias Hörtenhuber](https://github.com/mashehu)
- [Maxime U Garcia](https://github.com/maxulysse)
- [Phil Ewels](https://github.com/ewels)
- [Simon Pearce](https://github.com/SPPearce)
- [Thomas Danhorn](https://github.com/tdanhorn)

### Enhancements and fixes

- [PR #1789](https://github.com/nf-core/rnaseq/pull/1789) - Bump `trimgalore` module to 2.1.0 ([nf-core/modules#11524](https://github.com/nf-core/modules/pull/11524)); add ARM Wave container for the new pin in `conf/arm.config`
- [PR #1821](https://github.com/nf-core/rnaseq/pull/1821) - Bump version to 3.26.0dev after release 3.25.0; flip the MultiQC report links and RO-Crate URL/version back to dev
- [PR #1823](https://github.com/nf-core/rnaseq/pull/1823) - Reinstall `trimgalore` module to pull in [nf-core/modules#11308](https://github.com/nf-core/modules/pull/11308), which removes orphan `*_trimmed.fq.gz` outputs left in the workdir by an interrupted previous trim_galore attempt (e.g. AWS Batch retry after a Spot reclaim) that were breaking `FQ_LINT_AFTER_TRIMMING` ([#1807](https://github.com/nf-core/rnaseq/issues/1807))
- [PR #1824](https://github.com/nf-core/rnaseq/pull/1824) - Restore the #1821 entry to the changelog after it was dropped during 3.25.1 prep
- [PR #1826](https://github.co
…[truncated]
```

### docs/usage.md

```
# nf-core/rnaseq: Usage

## :warning: Please read this documentation on the nf-core website: [https://nf-co.re/rnaseq/usage](https://nf-co.re/rnaseq/usage)

> _Documentation of pipeline parameters is generated automatically from the pipeline schema and can no longer be found in markdown files._

## Pipeline parameters

Please provide pipeline parameters via the CLI or Nextflow `-params-file` option. Custom config files including those provided by the `-c` Nextflow option can be used to provide any configuration except for parameters; see [docs](https://nf-co.re/usage/configuration#custom-configuration-files).

## Samplesheet input

You will need to create a samplesheet with information about the samples you would like to analyse before running the pipeline. Use this parameter to specify its location. It has to be a comma-separated file with the 4 required columns: `sample`, `fastq_1`, `fastq_2`, and `strandedness`. If samples were sequenced on different platforms or at different centers, you can specify per-sample values via optional `seq_platform` and `seq_center` columns (used in BAM read group tags). For uniform values across all samples, the `--seq_platform` and `--seq_center` parameters are simpler. Please refer to the example below.

```bash
--input '[path to samplesheet file]'
```

### Multiple runs of the same sample

The `sample` identifiers have to be the same when you have re-sequenced the same sample more than once e.g. to increase sequencing depth. The pipeline will concatenate the raw reads before performing any downstream analysis. Below is an example for the same sample sequenced across 3 lanes.

```csv title="samplesheet.csv"
sample,fastq_1,fastq_2,strandedness,seq_platform
CONTROL_REP1,AEG588A1_S1_L002_R1_001.fastq.gz,AEG588A1_S1_L002_R2_001.fastq.gz,auto,ILLUMINA
CONTROL_REP1,AEG588A1_S1_L003_R1_001.fastq.gz,AEG588A1_S1_L003_R2_001.fastq.gz,auto,ILLUMINA
CONTROL_REP1,AEG588A1_S1_L004_R1_001.fastq.gz,AEG588A1_S1_L004_R2_001.fastq.gz,auto,ILLUMINA
`
…[truncated]
```

### docs/output.md

```
# nf-core/rnaseq: Output

## Introduction

This document describes the output produced by the pipeline. Most of the plots are taken from the MultiQC report generated from the [full-sized test dataset](https://github.com/nf-core/test-datasets/tree/rnaseq#full-test-dataset-origin) for the pipeline using a command similar to the one below:

```bash
nextflow run nf-core/rnaseq -profile test_full,<docker/singularity/institute>
```

The directories listed below will be created in the results directory after the pipeline has finished. All paths are relative to the top-level results directory.

:::tip
Many of the BAM files produced by this pipeline can be reused as input for future runs with `--skip_alignment`. This is particularly useful for reprocessing data or running downstream analysis steps without repeating computationally expensive alignment. See the [usage documentation](https://nf-co.re/rnaseq/usage#bam-input-for-reprocessing-workflow) for details on using BAM files as input.
:::

:::note
When running with `--skip_quantification_merge`, the output directory structure changes from tool-centric (e.g. `results/fastqc/`, `results/salmon/`) to sample-centric (e.g. `results/SAMPLE_A/fastqc/`, `results/SAMPLE_A/salmon/`). Shared outputs like reference genome files and pipeline metadata remain at the top level. See the [usage documentation](https://nf-co.re/rnaseq/usage#per-sample-quantification---skip_quantification_merge) for details.
:::

## Pipeline overview

The pipeline is built using [Nextflow](https://www.nextflow.io/) and processes data using the following steps:

- [nf-core/rnaseq: Output](#nf-corernaseq-output)
  - [Introduction](#introduction)
  - [Pipeline overview](#pipeline-overview)
  - [Preprocessing](#preprocessing)
    - [cat](#cat)
      [fq lint](#fq-lint)
    - [FastQC](#fastqc)
    - [UMI-tools extract](#umi-tools-extract)
    - [TrimGalore](#trimgalore)
    - [fastp](#fastp)
    - [BBSplit](#bbsplit)
    - [rRNA removal](#rrna-removal)
    - [FastQ
…[truncated]
```

---

## Common Issues & Discussions (top closed issues by comments)

- [10 comments] **PR for Release 1.4**
  This is the `dev` to `master` PR for making a release 1.4 for nf-core/rnaseq. Lots of changes, so please have a look and review 👍 

## PR checklist
 - [x] This comment contains a description of cha

- [3 comments] **Dev -> master for nf-core/rnaseq 3.23.0**
  ## Release 3.23.0

**330 commits, 546 files changed** since 3.22.2.

This is a major feature release with new alignment/quantification pathways, prokaryotic support, improved preprocessing options, an

- [16 comments] **Prototype implementation for new Nextflow native DSL2 syntax on nf-core**
  ## Suggestion

Swap from the current method of publishing to the using publishDir directly in configs. 

Benefits:
- Separate configuration from workflow.
- Configuration is in one file. Current

- [17 comments] **[Feature Addition: Salmon]**
  This is basically @olgabot @lpantano and partially (I Think) @kerimoff 's work. 



## PR checklist
 - [x] This comment contains a description of changes (with reason)
 - [ ] If you've fixed a b

- [22 comments] **Workflow output definition**
  This PR adds a workflow output definition based on https://github.com/nextflow-io/nextflow/pull/4784. I'm still working through the pipeline, but once I'm done, I will have completely replaced publish