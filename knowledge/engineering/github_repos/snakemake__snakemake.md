# snakemake — Snakemake Python-based workflow system

**GitHub:** https://github.com/snakemake/snakemake
**Category:** workflow
**Language:** Python
**Stars:** 2,818
**Topics:** reproducibility, snakemake, workflow-management
**Description:** This is the development home of the workflow management system Snakemake. For general information, see


---

## README

[![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/snakemake/snakemake)
[![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/snakemake/snakemake/main.yml?label=tests)](https://github.com/snakemake/snakemake/actions?query=branch%3Amain++)
[![Sonarcloud Status](https://sonarcloud.io/api/project_badges/measure?project=snakemake_snakemake&metric=alert_status)](https://sonarcloud.io/dashboard?id=snakemake_snakemake)
[![Conda Version](https://img.shields.io/conda/vn/bioconda/snakemake)](https://anaconda.org/bioconda/snakemake)
[![Bioconda](https://img.shields.io/conda/dn/bioconda/snakemake.svg?label=Bioconda)](https://bioconda.github.io/recipes/snakemake/README.html)
[![Pypi](https://img.shields.io/pypi/pyversions/snakemake.svg)](https://pypi.org/project/snakemake)
[![docker container status](https://img.shields.io/github/actions/workflow/status/snakemake/snakemake/docker-publish.yml?color=blue&label=docker%20container)](https://hub.docker.com/r/snakemake/snakemake)
[![Stack Overflow](https://img.shields.io/badge/stack-overflow-orange.svg)](https://stackoverflow.com/questions/tagged/snakemake)
[![Twitter](https://img.shields.io/twitter/follow/johanneskoester.svg?style=social&label=Follow)](https://twitter.com/search?l=&q=%23snakemake%20from%3Ajohanneskoester)
![Mastodon Follow](https://img.shields.io/mastodon/follow/109308140471392959?domain=https%3A%2F%2Ffosstodon.org&label=Follow)
[![Discord](https://img.shields.io/discord/753690260830945390?label=discord%20chat)](https://discord.gg/NUdMtmr)
[![Github stars](https://img.shields.io/github/stars/snakemake/snakemake?style=social)](https://github.com/snakemake/snakemake/stargazers)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v2.0%20adopted-ff69b4.svg)](CODE_OF_CONDUCT.md) 

# Snakemake

The Snakemake workflow management system is a tool to create **reproducible and scalable** data analyses.
Snakemake is highly popular, with on average more than 7 new citations per week in 2021, and almost 400k downloads.
Workflows are described via a human readable, Python based language.
They can be seamlessly scaled to server, cluster, grid and cloud environments without the need to modify the workflow definition.
Finally, Snakemake workflows can entail a description of required software, which will be automatically deployed to any execution environment.

**Homepage: https://snakemake.github.io**

Copyright (c) 2012-2022 Johannes Köster <johannes.koester@uni-due.com> (see LICENSE)


---

## Key Files

### CHANGELOG.md

```
# Changelog


## [9.23.1](https://github.com/snakemake/snakemake/compare/v9.23.0...v9.23.1) (2026-06-17)


### Bug Fixes

* LoggerManager.shutdown() error handling, flush all loggers ([#4196](https://github.com/snakemake/snakemake/issues/4196)) ([5bcdbf3](https://github.com/snakemake/snakemake/commit/5bcdbf3c65dff84e55616c3f14316a17c66cdcd3))
* temp files not deleted when using remote storage plugins ([#4232](https://github.com/snakemake/snakemake/issues/4232)) ([7c58f53](https://github.com/snakemake/snakemake/commit/7c58f531ee1583ad59c190253301baa2814e313a))


### Documentation

* mention sponsoring in docs ([c659d62](https://github.com/snakemake/snakemake/commit/c659d62015bd7b354367e34a77490d762cf6029d))

## [9.23.0](https://github.com/snakemake/snakemake/compare/v9.22.0...v9.23.0) (2026-06-11)


### Features

* support remote snakefile via gh/gl shorthand ([#4161](https://github.com/snakemake/snakemake/issues/4161)) ([ec2f12a](https://github.com/snakemake/snakemake/commit/ec2f12a909e47ae6c2b503ef93de090cea1f09c3))


### Bug Fixes

* remove leaked secrets in input source file display and ensure that wrapper scripts are properly fetched as GithubFile (including caching) ([#4225](https://github.com/snakemake/snakemake/issues/4225)) ([6b06433](https://github.com/snakemake/snakemake/commit/6b0643378050cac6e8252781787cdb48f457079d))
* set log level accordingly when debug dag is set ([#3778](https://github.com/snakemake/snakemake/issues/3778)) ([eea0f41](https://github.com/snakemake/snakemake/commit/eea0f410376bda298482c5fc0d326a1e517ce13d))


### Documentation

* add post-deploy example that ensures `.Renviron` is ignored for R package installations ([#4140](https://github.com/snakemake/snakemake/issues/4140)) ([b64c39e](https://github.com/snakemake/snakemake/commit/b64c39ee5f412024bda48f34133f190e6b7d4dfb))
* note about quoting dynamic resource statements with python code, quotes in example ([#4214](https://github.com/snakemake/snakemake/issues/4214)) ([66503de](https
…[truncated]
```

---

## Common Issues & Discussions (top closed issues by comments)

- [46 comments] **[WIP] Adding Cloud Pipelines**
  **do not merge** this is a draft pull request!

This PR will encompass early work to add Google Cloud Pipelines to Snakemake. Specifically this means that:

 - the user selects --google-life-scien

- [29 comments] **feat!: Logging refactor & add LoggerPluginInterface**
  Followup to #2830.

This PR attempts to make Snakemake's logging more modular to make room for a potential logging plugin interface, or other logging/monitoring additions, as well as make logging in

- [15 comments] **feat: seperate namespase of module from influence of `use` modification**
  <!--Add a description of your PR here-->
Related to #2838 and related to #2843, object `rules` and `checkpoints` will leak from outside and cause unexpected failure. 

This PR will try to fix it.


- [22 comments] **feat: adding flux executor**
  Signed-off-by: vsoch <vsoch@users.noreply.github.com>

### Description

This will add the Flux Executor to snakemake. Flux is a very programmatic job manager (maybe that's too limited a term) but 

- [33 comments] **feat: SLURM executor**
  ### Description

This PR by @cmeesters adds a dedicated backend for slurm.

### QC
<!-- Make sure that you can tick the boxes below. -->

* [x] The PR contains a test case for the changes or th