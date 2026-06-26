# sarek — nf-core WGS/WES somatic + germline variant calling

**GitHub:** https://github.com/nf-core/sarek
**Category:** nfcore
**Language:** Nextflow
**Stars:** 578
**Topics:** annotation, bioinformatics, cancer, conda, containers, gatk4, genomics, germline, next-generation-sequencing, nextflow, nf-core, pipeline, pre-processing, reproducible-research, somatic, target-panels, variant-calling, whole-exome-sequencing, whole-genome-sequencing, workflow
**Description:** Analysis pipeline to detect germline or somatic variants (pre-processing, variant calling and annotation) from WGS / targeted sequencing


---

## README

<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/nf-core-sarek_logo_dark.png">
    <img alt="nf-core/sarek" src="docs/images/nf-core-sarek_logo_light.png">
  </picture>
</h1>

[![Open in GitHub Codespaces](https://img.shields.io/badge/Open_In_GitHub_Codespaces-black?labelColor=grey&logo=github)](https://github.com/codespaces/new/nf-core/sarek)
[![GitHub Actions CI Status](https://github.com/nf-core/sarek/actions/workflows/nf-test.yml/badge.svg)](https://github.com/nf-core/sarek/actions/workflows/nf-test.yml)
[![GitHub Actions Linting Status](https://github.com/nf-core/sarek/actions/workflows/linting.yml/badge.svg)](https://github.com/nf-core/sarek/actions/workflows/linting.yml)
[![AWS CI](https://img.shields.io/badge/CI%20tests-full%20size-FF9900?labelColor=000000&logo=Amazon%20AWS)](https://nf-co.re/sarek/results)
[![Cite with Zenodo](http://img.shields.io/badge/DOI-10.5281/zenodo.3476425-1073c8?labelColor=000000)](https://doi.org/10.5281/zenodo.3476425)
[![nf-test](https://img.shields.io/badge/unit_tests-nf--test-337ab7.svg)](https://www.nf-test.com)

[![Nextflow](https://img.shields.io/badge/version-%E2%89%A525.10.2-green?style=flat&logo=nextflow&logoColor=white&color=%230DC09D&link=https%3A%2F%2Fnextflow.io)](https://www.nextflow.io/)
[![nf-core template version](https://img.shields.io/badge/nf--core_template-3.5.1-green?style=flat&logo=nfcore&logoColor=white&color=%2324B064&link=https%3A%2F%2Fnf-co.re)](https://github.com/nf-core/tools/releases/tag/3.5.1)
[![run with conda](http://img.shields.io/badge/run%20with-conda-3EB049?labelColor=000000&logo=anaconda)](https://docs.conda.io/en/latest/)
[![run with docker](https://img.shields.io/badge/run%20with-docker-0db7ed?labelColor=000000&logo=docker)](https://www.docker.com/)
[![run with singularity](https://img.shields.io/badge/run%20with-singularity-1d355c.svg?labelColor=000000)](https://sylabs.io/docs/)
[![Launch on Seqera Platform](https://img.shields.io/badge/Launch%20%F0%9F%9A%80-Seqera%20Platform-%234256e7)](https://cloud.seqera.io/launch?pipeline=https://github.com/nf-core/sarek)

[![Get help on Slack](http://img.shields.io/badge/slack-nf--core%20%23sarek-4A154B?labelColor=000000&logo=slack)](https://nfcore.slack.com/channels/sarek)
[![Follow on Bluesky](https://img.shields.io/badge/bluesky-%40nf__core-1185fe?labelColor=000000&logo=bluesky)](https://bsky.app/profile/nf-co.re)
[![Follow on Mastodon](https://img.shields.io/badge/mastodon-nf__core-6364ff?labelColor=FFFFFF&logo=mastodon)](https://mstdn.science/@nf_core)
[![Watch on YouTube](http://img.shields.io/badge/youtube-nf--core-FF0000?labelColor=000000&logo=youtube)](https://www.youtube.com/c/nf-core)

## Introduction

**nf-core/sarek** is a workflow designed to detect variants on whole genome or targeted sequencing data. Initially designed for Human, and Mouse, it can work on any species with a reference genome. Sarek can also handle tumour / normal pairs and could include additional relapses.

The pipeline is built using [Nextflow](https://www.nextflow.io), a workflow tool to run tasks across multiple compute infrastructures in a very portable manner. It uses Docker/Singularity containers making installation trivial and results highly reproducible. The [Nextflow DSL2](https://www.nextflow.io/docs/latest/dsl2.html) implementation of this pipeline uses one container per process which makes it much easier to maintain and update software dependencies. Where possible, these processes have been submitted to and installed from [nf-core/modules](https://github.com/nf-core/modules) in order to make them available to all nf-core pipelines, and to everyone within the Nextflow community!

On release, automated continuous integration tests run the pipeline on a full-sized dataset on the AWS cloud infrastructure. This ensures that the pipeline runs on AWS, has sensible resource allocation defaults set to run on real-world datasets, and permits the persistent storage of results to benchmark be
…[truncated]

---

## Key Files

### CHANGELOG.md

```
# nf-core/sarek: Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.8.1](https://github.com/nf-core/sarek/releases/tag/3.8.1) - Laitaure

### Added

### Changed

### Fixed

- [#2128](https://github.com/nf-core/sarek/pull/2128) - Fix `bcftools concat` failing on Strelka somatic VCFs with non-contiguous chromosome blocks by adding `--allow-overlaps`

### Removed

### Dependencies

| Dependency | Old version | New version |
| ---------- | ----------- | ----------- |

### Parameters

| Params | status |
| ------ | ------ |

### Developer section

#### Added

#### Changed

- [#2134](https://github.com/nf-core/sarek/pull/2134) - Back to dev (3.9.0dev)

#### Fixed

#### Removed

## [3.8.0](https://github.com/nf-core/sarek/releases/tag/3.8.0) - Sitojaure

A mountain cabin near the Sami settlement between Saltoluokta and Kvikkjokk.

### Added

- [#2092](https://github.com/nf-core/sarek/pull/2092) - Add support for VEP Condel plugin to calculate Consensus Deleteriousness scores for missense mutations
- [#2093](https://github.com/nf-core/sarek/pull/2093) - Add support for VEP Mastermind plugin to retrieve citation counts from Mastermind Genomic Search Engine
- [#2094](https://github.com/nf-core/sarek/pull/2094) - Add support for VEP Phenotypes plugin to retrieve overlapping phenotype information from Ensembl databases
- [#2103](https://github.com/nf-core/sarek/pull/2103) - Documentation update about new VEP plugins
- [#2111](https://github.com/nf-core/sarek/pull/2111) - Add SnpSift annotation support using `--tools snpsift` with `--snpsift_databases` CSV configuration

### Changed

- [#2119](https://github.com/nf-core/sarek/pull/2119) - Update VEP version from 111.0-0 to 115.0-0 and VEP cache version from 114 to 115; update ensemblvep module to include `perl-math-cdf` depende
…[truncated]
```

### docs/usage.md

```
# nf-core/sarek: Usage

## :warning: Please read this documentation on the nf-core website: [https://nf-co.re/sarek/usage](https://nf-co.re/sarek/usage)

> _Documentation of pipeline parameters is generated automatically from the pipeline schema and can no longer be found in markdown files._

# Introduction

Sarek is a workflow designed to detect germline and somatic variants on whole genome, whole exome, or targeted sequencing data.

Initially designed for human and mouse, it can work on any species if a reference genome is available.
Sarek is designed to handle single samples, such as single-normal or single-tumor samples, and tumor-normal pairs including additional relapses.

# Running the pipeline

## Quickstart

The typical command for running the pipeline is as follows:

```bash
nextflow run nf-core/sarek -r <VERSION> -profile <PROFILE> --input ./samplesheet.csv --outdir ./results --genome GATK.GRCh38 --tools <TOOLS>
```

`-r <VERSION>` is optional but strongly recommended for reproducibility and should match the latest version.

`-profile <PROFILE>` is mandatory and should reflect either your own institutional profile or any pipeline profile specified in the [profile section](##-profile).

This documentation imply that any `nextflow run nf-core/sarek` command is run with the appropriate `-r` and `-profile` commands.

This will launch the pipeline and perform variant calling with the tools specified in `--tools`, see the [parameter section](https://nf-co.re/sarek/latest/parameters#tools) for details on variant calling tools.
In the above example the pipeline runs with the `docker` configuration profile. See below for more information about profiles.

Note that the pipeline will create the following files in your working directory:

```bash
work                # Directory containing the nextflow working files
<OUTDIR>            # Finished results in specified location (defined with --outdir)
.nextflow_log       # Log file from Nextflow
# Other nextflow hidden 
…[truncated]
```

### docs/output.md

```
# nf-core/sarek: Output <!-- omit in toc -->

## Introduction <!-- omit in toc -->

This document describes the output produced by the pipeline. Most of the plots are taken from the MultiQC report, which summarises results at the end of the pipeline.

The directories listed below will be created in the results directory after the pipeline has finished. All paths are relative to the top-level results directory.

## Pipeline overview <!-- omit in toc -->

The pipeline is built using [Nextflow](https://www.nextflow.io/) and processes data using the following steps:

- [Directory Structure](#directory-structure)
- [Preprocessing](#preprocessing)
  - [Preparation of input files (FastQ or (u)BAM)](#preparation-of-input-files-fastq-or-ubam)
    - [Clip and filter read length](#clip-and-filter-read-length)
    - [Trim adapters](#trim-adapters)
    - [Split FastQ files](#split-fastq-files)
    - [UMI consensus](#umi-consensus)
    - [BBSplit contamination removal](#bbsplit-contamination-removal)
  - [Map to Reference](#map-to-reference)
    - [BWA](#bwa)
    - [BWA-mem2](#bwa-mem2)
    - [DragMap](#dragmap)
    - [Sentieon BWA mem](#sentieon-bwa-mem)
  - [Mark Duplicates](#mark-duplicates)
    - [GATK MarkDuplicates (Spark)](#gatk-markduplicates-spark)
  - [Sentieon LocusCollector and Dedup](#sentieon-locuscollector-and-dedup)
  - [Base Quality Score Recalibration](#base-quality-score-recalibration)
    - [GATK BaseRecalibrator (Spark)](#gatk-baserecalibrator-spark)
    - [GATK ApplyBQSR (Spark)](#gatk-applybqsr-spark)
  - [Parabricks FQ2BAM](#parabricks-fq2bam)
  - [CSV files](#csv-files)
- [Variant Calling](#variant-calling)
  - [SNVs and small indels](#snvs-and-small-indels)
    - [bcftools](#bcftools)
    - [DeepVariant](#deepvariant)
    - [FreeBayes](#freebayes)
    - [GATK HaplotypeCaller](#gatk-haplotypecaller)
      - [GATK Germline Single Sample Variant Calling](#gatk-germline-single-sample-variant-calling)
      - [GATK Joint Germline Variant Calling](#gatk-joint-
…[truncated]
```

---

## Common Issues & Discussions (top closed issues by comments)

- [18 comments] **Sentieon DNAseq flow**
  *Questions*
1. We have a test-config for sentieon-dedup, but not the other tests of sentieon; should we also have a test-config for, say, sentieon-haplotyper?
2. We have the `tools`-options `haploty

- [23 comments] **Documentation**
  Close #504 #291 #402 #415
 
<!--
# nf-core/sarek pull request

Many thanks for contributing to nf-core/sarek!

Please fill in the appropriate checklist below (delete whatever is not relevant).

- [6 comments] **2.6**
  # nf-core/sarek pull request

Many thanks for contributing to nf-core/sarek!

Please fill in the appropriate checklist below (delete whatever is not relevant).
These are the most common things re

- [3 comments] **Prepare 3.0 release**
  <!--
# nf-core/sarek pull request

Many thanks for contributing to nf-core/sarek!

Please fill in the appropriate checklist below (delete whatever is not relevant).
These are the most common thi

- [2 comments] **Joint Germline subworkflow haplotypecaller -> Vqsr**
  <!--
# nf-core/sarek pull request

Many thanks for contributing to nf-core/sarek!

Please fill in the appropriate checklist below (delete whatever is not relevant).
These are the most common thi