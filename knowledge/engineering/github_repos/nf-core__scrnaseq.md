# scrnaseq — nf-core single-cell RNA-seq

**GitHub:** https://github.com/nf-core/scrnaseq
**Category:** nfcore
**Language:** Nextflow
**Stars:** 337
**Topics:** 10x-genomics, 10xgenomics, alevin, bustools, cellranger, kallisto, nextflow, nf-core, pipeline, rna-seq, single-cell, star-solo, workflow
**Description:** Single-cell RNA-Seq pipeline for barcode-based protocols such as 10x, DropSeq or SmartSeq, offering a variety of aligners and empty-droplet detection


---

## README

<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/nf-core-scrnaseq_logo_dark.png">
    <img alt="nf-core/scrnaseq" src="docs/images/nf-core-scrnaseq_logo_light.png">
  </picture>
</h1>

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://github.com/codespaces/new/nf-core/scrnaseq)
[![GitHub Actions CI Status](https://github.com/nf-core/scrnaseq/actions/workflows/nf-test.yml/badge.svg)](https://github.com/nf-core/scrnaseq/actions/workflows/nf-test.yml)
[![GitHub Actions Linting Status](https://github.com/nf-core/scrnaseq/actions/workflows/linting.yml/badge.svg)](https://github.com/nf-core/scrnaseq/actions/workflows/linting.yml)
[![AWS CI](https://img.shields.io/badge/CI%20tests-full%20size-FF9900?labelColor=000000&logo=Amazon%20AWS)](https://nf-co.re/scrnaseq/results)
[![Cite with Zenodo](http://img.shields.io/badge/DOI-10.5281/zenodo.3568187-1073c8?labelColor=000000)](https://doi.org/10.5281/zenodo.3568187)
[![nf-test](https://img.shields.io/badge/unit_tests-nf--test-337ab7.svg)](https://www.nf-test.com)

[![Nextflow](https://img.shields.io/badge/version-%E2%89%A525.04.0-green?style=flat&logo=nextflow&logoColor=white&color=%230DC09D&link=https%3A%2F%2Fnextflow.io)](https://www.nextflow.io/)
[![nf-core template version](https://img.shields.io/badge/nf--core_template-3.4.1-green?style=flat&logo=nfcore&logoColor=white&color=%2324B064&link=https%3A%2F%2Fnf-co.re)](https://github.com/nf-core/tools/releases/tag/3.4.1)
[![run with conda](http://img.shields.io/badge/run%20with-conda-3EB049?labelColor=000000&logo=anaconda)](https://docs.conda.io/en/latest/)
[![run with docker](https://img.shields.io/badge/run%20with-docker-0db7ed?labelColor=000000&logo=docker)](https://www.docker.com/)
[![run with singularity](https://img.shields.io/badge/run%20with-singularity-1d355c.svg?labelColor=000000)](https://sylabs.io/docs/)
[![Launch on Seqera Platform](https://img.shields.io/badge/Launch%20%F0%9F%9A%80-Seqera%20Platform-%234256e7)](https://cloud.seqera.io/launch?pipeline=https://github.com/nf-core/scrnaseq)

[![Get help on Slack](http://img.shields.io/badge/slack-nf--core%20%23scrnaseq-4A154B?labelColor=000000&logo=slack)](https://nfcore.slack.com/channels/scrnaseq)[![Follow on Bluesky](https://img.shields.io/badge/bluesky-%40nf__core-1185fe?labelColor=000000&logo=bluesky)](https://bsky.app/profile/nf-co.re)[![Follow on Mastodon](https://img.shields.io/badge/mastodon-nf__core-6364ff?labelColor=FFFFFF&logo=mastodon)](https://mstdn.science/@nf_core)[![Watch on YouTube](http://img.shields.io/badge/youtube-nf--core-FF0000?labelColor=000000&logo=youtube)](https://www.youtube.com/c/nf-core)

## Introduction

**nf-core/scrnaseq** is a bioinformatics best-practice analysis pipeline for processing 10x Genomics single-cell RNA-seq data.

This is a community effort in building a pipeline capable to support:

- SimpleAF(Alevin-Fry) + AlevinQC
- STARSolo
- Kallisto + BUStools
- Cellranger

> [!IMPORTANT]
> Cellranger is a commercial tool from 10X Genomics Inc. and falls under the EULA from 10X Genomics Inc. The container provided for the CellRanger functionality in this pipeline has been built by the nf-core community and is therefore _not supported by 10X genomics_ directly. We are in discussions with 10X on how to improve the user experience and licence situation for both us as a community as well as 10X and end users and will update this statement here accordingly.

## Documentation

The nf-core/scrnaseq pipeline comes with documentation about the pipeline [usage](https://nf-co.re/scrnaseq/usage), [parameters](https://nf-co.re/scrnaseq/parameters) and [output](https://nf-co.re/scrnaseq/output).

![scrnaseq workflow](docs/images/scrnaseq_pipeline_V3.0-metro_clean.png)

## Usage

> [!NOTE]
> If you are new to Nextflow and nf-core, please refer to [this page](https://nf-co.re/docs/usage/installation) on how to set-up Nextflow. Make sure to [test your setup](https://nf-co.re/docs/usage/introdu
…[truncated]

---

## Key Files

### CHANGELOG.md

```
# nf-core/scrnaseq: Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## v4.1.0 - 2025-08-01

### Features

- Fix simpleaf protocol name for 10xv4 ([#452](https://github.com/nf-core/scrnaseq/pull/452))
- Fix the workflow for cellranger-arc alignment and add new test with 10x multiome dataset ([#441](https://github.com/nf-core/scrnaseq/pull/441))
- Update `nf-core/cellranger` modules to tool version `9.0.1` ([#467](https://github.com/nf-core/scrnaseq/pull/467))
- Fix igenomes usage to correctly handle fasta and gtf files ([#469](https://github.com/nf-core/scrnaseq/pull/469))
- Update `cellranger/multi` module to latest version with nf-core tools ([#482](https://github.com/nf-core/scrnaseq/pull/482))
- Adapt pipeline to also parse `OCM` barcodes for `cellranger/multi` and update its documentation ([#482](https://github.com/nf-core/scrnaseq/pull/482))
- Fix that skip_multiqc parameter did not work ([#479](https://github.com/nf-core/scrnaseq/pull/479))
- Add the `accelerator` process directive to the `process_gpu` label ([#477](https://github.com/nf-core/scrnaseq/pull/477))
- Refactor iGenomes handling to expose params object pipeline-wide ([#483](https://github.com/nf-core/scrnaseq/pull/483))

### Documentation

- Update nextflow_schema.json ([#453](https://github.com/nf-core/scrnaseq/pull/453))
- Update `--cellranger_index` docs to point out that the base index directory is needed ([#458](https://github.com/nf-core/scrnaseq/pull/458))
- Update protocol documentation ([#459](https://github.com/nf-core/scrnaseq/pull/459))

### Chore

- Add ruff pre-commit check as linter/autoformatter for python scripts ([#464](https://github.com/nf-core/scrnaseq/pull/464))
- Template update for nf-core/tools v3.2.1 ([#466](https://github.com/nf-core/scrnaseq/pull/466))
- Template update for nf-core/tools v3.3.2 ([#474](https://github.com/nf-core/scrnaseq/pul
…[truncated]
```

### docs/usage.md

```
# nf-core/scrnaseq: Usage

> _Documentation of pipeline parameters is generated automatically from the pipeline schema and can no longer be found in markdown files._

## Samplesheet input

You will need to create a samplesheet with information about the samples you would like to analyse before running the pipeline. Use this parameter to specify its location. It has to be a comma-separated file with at least 3 columns, and a header row as shown in the examples below.

```bash
--input '[path to samplesheet file]'
```

### Multiple runs of the same sample

The `sample` identifiers have to be the same when you have re-sequenced the same sample more than once e.g. to increase sequencing depth. The pipeline will concatenate the raw reads before performing any downstream analysis. Below is an example for the same sample sequenced across 3 lanes:

```csv title="samplesheet.csv"
sample,fastq_1,fastq_2
CONTROL_REP1,AEG588A1_S1_L002_R1_001.fastq.gz,AEG588A1_S1_L002_R2_001.fastq.gz
CONTROL_REP1,AEG588A1_S1_L003_R1_001.fastq.gz,AEG588A1_S1_L003_R2_001.fastq.gz
CONTROL_REP1,AEG588A1_S1_L004_R1_001.fastq.gz,AEG588A1_S1_L004_R2_001.fastq.gz
```

### Full samplesheet

There is a strict requirement for the first 3 columns to match those defined in the table below.

| Column           | Description                                                                                                                                                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sample`         | Required. Custom sample name. This en
…[truncated]
```

### docs/output.md

```
# nf-core/scrnaseq: Output

## Introduction

This document describes the output produced by the pipeline. Most of the plots are taken from the MultiQC report, which summarises results at the end of the pipeline.

## Pipeline overview

The pipeline is built using [Nextflow](https://www.nextflow.io/) and processes data using the following steps:

- [Pipeline information](#pipeline-information) - Report metrics generated during the workflow execution
- [nf-core/scrnaseq: Output](#nf-corescrnaseq-output)
- [Introduction](#introduction)
- [Pipeline overview](#pipeline-overview)
- [FastQC](#fastqc)
- [Kallisto \& Bustools Results](#kallisto--bustools-results)
- [STARsolo](#starsolo)
- [Simpleaf \& AlevinQC](#simpleaf--alevinqc)
- [Cellranger](#cellranger)
- [Cellranger ARC](#cellranger-arc)
- [Cellranger multi](#cellranger-multi)
- [Cellbender remove background filter](#cellbender-remove-background-filter)
- [Other output data](#other-output-data)
- [MultiQC](#multiqc)

## FastQC

See [FastQC](https://www.bioinformatics.babraham.ac.uk/projects/fastqc) for details about FastQC.

The pipeline analyzes the raw data and generates for each file a FastQC report. All report are collected in MultiQC.

**Output directory: `results/fastqc`**

- `.html`
  - Contains the FastQC report.
- `.zip`
  - Contains additional information, such as individual plots, and FastQC raw data.

:::note
The FastQC plots displayed in the MultiQC report shows the unprocessed reads. Depending on the protocol,
they may contain barcodes, UMIs and adapter sequences.
:::

## Kallisto & Bustools Results

See [Kallisto](https://pachterlab.github.io/kallisto/about) for details about Kallisto and [Bustools](https://bustools.github.io/) for more information on BusTools.

The pipeline can analyze data from single cell rnaseq experiments and generates a set of folders with respective outputs from various steps of the analysis. For a detailed summary what the pipeline does specifically, please follow the [excellent 
…[truncated]
```

---

## Common Issues & Discussions (top closed issues by comments)

- [22 comments] **Adding cellrangermulti subworkflow**
  Close #247
Close #313 

## PR checklist

- [ ] This comment contains a description of changes (with reason).
- [ ] If you've fixed a bug or added code that should be tested, add tests!
- [ ] If

- [10 comments] **update Simpleaf modules, subworkflow**
  Reopen #361 after updating simpleaf central modules. See this [PR](https://github.com/nf-core/modules/pull/7335). I have tested using a 10x 500 dataset. Once the modules' PR is merged, we can start me

- [22 comments] **Addition of `MTX_TO_H5AD` conversion modules**
  Hi all,
The reason of this PR is to try to address changes related to issue #68, where is added a conversion module right after execution to convert files to `AnnData` in `h5ad` format.

## PR chec

- [11 comments] **Standardize conversion workflow**
  # Summary

Hi,
This work relates to #310 and discussion that is happening [in slack](https://nfcore.slack.com/archives/CHN5BV5DW/p1723794361368459).

Currently, the implementation as been done **

- [39 comments] **Switch from alevin to alevin-fry (with simpleaf)**
  <!--
# nf-core/scrnaseq pull request

Many thanks for contributing to nf-core/scrnaseq!

Please fill in the appropriate checklist below (delete whatever is not relevant).
These are the most comm