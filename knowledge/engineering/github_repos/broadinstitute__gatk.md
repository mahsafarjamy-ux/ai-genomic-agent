# gatk — GATK4 variant calling toolkit

**GitHub:** https://github.com/broadinstitute/gatk
**Category:** variant
**Language:** Java
**Stars:** 1,968
**Topics:** bioinformatics, dna, gatk, genome, genomics, ngs, science, sequencing, spark
**Description:** Official code repository for GATK versions 4 and up


---

## README

[![Build Status](https://github.com/broadinstitute/gatk/actions/workflows/gatk-tests.yml/badge.svg?branch=master)](https://github.com/broadinstitute/gatk/actions/workflows/gatk-tests.yml)
[![Maven Central](https://img.shields.io/maven-central/v/org.broadinstitute/gatk.svg)](https://maven-badges.herokuapp.com/maven-central/org.broadinstitute/gatk)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

***Please see the [GATK website](http://www.broadinstitute.org/gatk), where you can download a precompiled executable, read documentation, ask questions, and receive technical support. For GitHub basics, see [here](https://software.broadinstitute.org/gatk/documentation/article?id=23405).***

### GATK 4

This repository contains the next generation of the Genome Analysis Toolkit (GATK). The contents
of this repository are 100% open source and released under the Apache 2.0 license (see [LICENSE.TXT](https://github.com/broadinstitute/gatk/blob/master/LICENSE.TXT)).

GATK4 aims to bring together well-established tools from the [GATK](http://www.broadinstitute.org/gatk) and
[Picard](http://broadinstitute.github.io/picard/) codebases under a streamlined framework,
and to enable selected tools to be run in a massively parallel way on local clusters or in the cloud using
[Apache Spark](http://spark.apache.org/). It also contains many newly developed tools not present in earlier
releases of the toolkit.

## Table of Contents
* [Requirements](#requirements)
* [Quick Start Guide](#quickstart)
* [Downloading GATK4](#downloading)
  * [Tools Included in Docker Image](#dockerSoftware)
* [Building GATK4](#building)
* [Running GATK4](#running)
    * [Passing JVM options to gatk](#jvmoptions)
    * [Passing a configuration file to gatk](#configFileOptions)
    * [Running GATK4 with inputs on Google Cloud Storage](#gcs)
    * [Running GATK4 Spark tools locally](#sparklocal)
    * [Running GATK4 Spark tools on a Spark cluster](#sparkcluster)
    * [Running GATK4 Spark tools on Google Cloud Dataproc](#dataproc)
    * [Using R to generate plots](#R)
    * [GATK Tab Completion for Bash](#tab_completion)
* [For GATK Developers](#developers)
    * [General guidelines for GATK4 developers](#dev_guidelines)
    * [Testing GATK4](#testing)
    * [Using Git LFS to download and track large test data](#lfs)
    * [Creating a GATK project in the IntelliJ IDE](#intellij)
    * [Setting up debugging in IntelliJ](#debugging)
    * [Updating the Intellij project when dependencies change](#intellij_gradle_refresh)
    * [Setting up profiling using JProfiler](#jprofiler)
    * [Uploading Archives to Sonatype](#sonatype)
    * [Building GATK4 Docker images](#docker_building)
    * [Releasing GATK4](#releasing_gatk)
    * [Generating GATK4 documentation](#gatkdocs)
    * [Generating GATK4 WDL Wrappers](#gatkwdlgen)
    * [Using Zenhub to track github issues](#zenhub)
* [Further Reading on Spark](#spark_further_reading)
* [How to contribute to GATK](#contribute)
* [Discussions](#discussions)
* [Authors](#authors)
* [Citing GATK](#citing)
* [License](#license)

## <a name="requirements">Requirements</a>
* To run GATK:
    * Java 17 is needed to run or build GATK. 
    We recommend one of the following:
        * Download the Eclipse Foundation's distribution of OpenJDK 17 from [adoptium.net](https://adoptium.net/). Navigate to the [release archive](https://adoptium.net/temurin/archive/?version=17) to find downloads for Java 17.
        * On Mac OS, you can install the [Homebrew package manager](https://brew.sh/) and run `brew install temurin@17` to install the Eclipse Foundation's OpenJDK 17.
    * Python 3.10.13, along with a set of additional Python packages, is required to run some tools and workflows (also required to run the `gatk` frontend script).
      See [Python Dependencies](#python) for more information.
    * R 4.3.1 (needed for producing plots in certain tools)
* To build GATK:
    * A Java 17 JD
…[truncated]

---

## Common Issues & Discussions (top closed issues by comments)

- [23 comments] **HaplotypeCaller DRAGEN Genotyper Improvements.**
  In this branch are a number of improvements and changes that form the baseline for the current ongoing evaluation of the DRAGEN/GATK pipeline. This represents the joint work of both msyelf and @vruano

- [3 comments] **Added in Owner style configuration file with some basic hooks.**
  Added in code to pull config elements from the Owner configuration.
Hooked the configuration into the classes where it is necessary.
Added in a config file with defaults.
Added in utilities and con

- [11 comments] **Add BreakpointEvidence filter based on classifier**
  Added XGBoostEvidenceFilter, an alternative BreakpointEvidence filter
based on XGBoost classifier.
 - Default is still BreakpointDensityFilter. Switch by passing
   "--sv-evidence-filter-type XGBOO

- [9 comments] **Port of GATK3 Variant Annotator Tool**
  Resolves #2493
Resolves #51

- [2 comments] **Update SV clustering classes**
  Reworks classes used by `JointGermlineCNVSegmentationIntegration` for SV clustering and defragmentation. The design of `SVClusterEngine` has been overhauled to enable the implementation of `CNVDefragm