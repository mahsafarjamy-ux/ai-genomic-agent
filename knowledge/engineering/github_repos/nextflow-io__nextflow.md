# nextflow — Nextflow DSL2 workflow system

**GitHub:** https://github.com/nextflow-io/nextflow
**Category:** workflow
**Language:** Groovy
**Stars:** 3,420
**Topics:** aws, bioinformatics, cloud, dataflow, docker, groovy, hello, hpc, nextflow, pipeline, pipeline-framework, reproducible-research, reproducible-science, sge, singularity, singularity-containers, slurm, workflow-engine
**Description:** A DSL for data-driven computational pipelines


---

## README

<h1 align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/_static/nextflow-logo-bg-dark.png">
        <source media="(prefers-color-scheme: light)" srcset="docs/_static/nextflow-logo-bg-light.png">
        <img width="500" alt="Nextflow" src="docs/_static/nextflow-logo-bg-light.png">
    </picture>
</h1>

_"Dataflow variables are spectacularly expressive in concurrent programming"_
<br>[Henri E. Bal , Jennifer G. Steiner , Andrew S. Tanenbaum](https://dl.acm.org/doi/abs/10.1145/72551.72552)

[![Nextflow CI](https://github.com/nextflow-io/nextflow/workflows/Nextflow%20CI/badge.svg)](https://github.com/nextflow-io/nextflow/actions/workflows/build.yml?query=branch%3Amaster+event%3Apush)
[![Nextflow version](https://img.shields.io/github/release/nextflow-io/nextflow.svg?colorB=58bd9f&style=popout)](https://github.com/nextflow-io/nextflow/releases/latest)
[![Nextflow Twitter](https://img.shields.io/twitter/url/https/nextflowio.svg?colorB=58bd9f&&label=%40nextflow&style=popout)](https://twitter.com/nextflowio)
[![Nextflow Publication](https://img.shields.io/badge/Published-Nature%20Biotechnology-26af64.svg?colorB=58bd9f&style=popout)](https://www.nature.com/articles/nbt.3820)
[![install with bioconda](https://img.shields.io/badge/install%20with-bioconda-brightgreen.svg?colorB=58bd9f&style=popout)](http://bioconda.github.io/recipes/nextflow/README.html)
[![Nextflow license](https://img.shields.io/github/license/nextflow-io/nextflow.svg?colorB=58bd9f&style=popout)](https://github.com/nextflow-io/nextflow/blob/master/COPYING)

Nextflow is a workflow system for creating scalable, portable, and reproducible workflows. It is based on the dataflow programming model, which greatly simplifies the writing of parallel and distributed pipelines, allowing you to focus on the flow of data and computation. Nextflow can deploy workflows on a variety of execution platforms, including your local machine, HPC schedulers, AWS Batch, Azure Batch, Google Cloud Batch, and Kubernetes. Additionally, it supports many ways to manage your software dependencies, including Conda, Spack, Docker, Podman, Singularity, and more.

Nextflow is built with ❤️ by [Seqera](https://seqera.io/), the best place to run Nextflow.

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/_static/seqera-logo-light.svg">
        <source media="(prefers-color-scheme: light)" srcset="docs/_static/seqera-logo-dark.svg">
        <img width="200" alt="Seqera" src="docs/_static/seqera-logo-dark.svg">
    </picture>
</p>

## Quick start

Install Nextflow with a single command:

```bash
curl -fsSL https://get.nextflow.io | bash
```

It creates the `nextflow` executable file in the current directory. You can then move it to a directory in your `$PATH` to run it from anywhere.

Nextflow can also be installed from Bioconda:

```bash
conda install -c bioconda nextflow
```

## Documentation

The Nextflow documentation is available for the latest [stable](https://docs.seqera.io/nextflow/) and [edge](https://docs.seqera.io/nextflow/) releases.

## Community

You can post questions and get help in the [Nextflow community forum](https://community.seqera.io) or the [Nextflow Slack](https://www.nextflow.io/slack-invite.html). Bugs and feature requests should be reported as [GitHub issues](https://github.com/nextflow-io/nextflow/issues/new/choose).

The Nextflow community is highly active with regular community meetings, events, a podcast and more. You can view much of this material on the [Nextflow](https://www.youtube.com/@Nextflow) and [nf-core](https://www.youtube.com/@nf-core) YouTube channels.

The [nf-core](https://nf-co.re/) project is a community effort aggregating high quality Nextflow workflows which can be used by everyone.

## Contributing

Contributions are more than welcome. See the [CONTRIBUTING](CONTRIBUTING.md) file for details.

## License

Nextflow is released under the Apache 2.0 license. Nextflo
…[truncated]

---

## Key Files

### CHANGELOG.md

```
# Nextflow change-log

## [Version 26.05.0-edge](https://github.com/nextflow-io/nextflow/releases/tag/v26.05.0-edge) - 19 Jun 2026

- Add -help as alias for -h in top-level CLI options (#7238) [ea3f2aad4]
- Add GPU metrics to workflow-level execution summary (#7229) [43da3f178]
- Add hidden plural/singular aliases for noun subcommands (#7239) [fe3da84fd]
- Add Nextflow module info to lineage TaskRun entry (#7160) [1be056177]
- Add seqera:// data-links support to nf-tower filesystem (#7070) [7d6f8c494]
- Add shellEnabled option and per-task prediction model to Seqera executor (#7204) [810fd1654]
- Add workflow DAG reporting to nf-tower plugin (#7218) [3041af858]
- Add `nextflow logfile` command (#7177) [c689c25ee]
- ADR: data lineage (#7187) [ae58c915a]
- Allow plugin version to be specified when running a plugin command (#7113) [7eeeb77bd]
- Change `stdout` outputs to `stderr`, to not break piped output (#7121) [dd9c2eb82]
- docs: Clarify distinction between modules and script inclusion (#7217) [2294ab1ad]
- docs: Migrate docs to new build (#7119) [93b244449]
- Fix "No such variable" in typed output block with job arrays (#7221) [064404b3e]
- Fix cast and instanceof with record types (#7185) [0834c8360]
- Fix issue with workflow completion handler being called twice (#7191) [93c2122ee]
- Fix lineage records for stub-run and eval outputs (#7211) [52d62a781]
- Fix netty CVE-2026-44249 via AWS SDK bump and azure-core-http-netty pin (#7223) [ab6a6e65e]
- Fix nxf_date for uutils coreutils (Ubuntu 26.04+) (#7118) [5504f64b6]
- Fix staging of Path fields of included record types (#7226) [72ab74963]
- Improve Azure Batch VM image diagnostics and fix stale 24.04 docs (#7200) [8e5e61143]
- Improve Tower telemetry error handling on transient gateway failures (#7190) [b0d7e335a]
- Mirror test containers to public.cr.seqera.io to harden CI against quay.io outages (#7195) [539081bca]
- Preserve order of plugin declarations in config (#7227) [3fa70ed65]
- Promote 'latest' stable c
…[truncated]
```

### docs/README.md

```
# Nextflow documentation

This directory holds the Nextflow documentation content as `.mdx` files. The site is built with [Docusaurus](https://docusaurus.io/) and deployed to [docs.seqera.io/nextflow](https://docs.seqera.io/nextflow/) via Netlify.

## Editing docs

- Edit the `.mdx` files in this directory.
- Use relative links for internal references, e.g. `[link text](./other-page.mdx)`.
- Images and other assets live in `_static/`.
- Code snippets under `snippets/` are runnable and covered by the docs tests.

## Building and previewing locally

The Docusaurus project lives in [`.docusaurus_site/`](../.docusaurus_site) at the repository root (this directory is symlinked into it as `docs/`):

```bash
cd .docusaurus_site
npm install
npm start
```

See [`.docusaurus_site/README.md`](../.docusaurus_site/README.md) for the full build, configuration, and authoring guide.

```

---

## Common Issues & Discussions (top closed issues by comments)

- [7 comments] **Document formal script syntax**
  Now that the docs are in better shape, we can begin work towards a formal description of the Nextflow language, as well as prepare the docs and tests for the strict syntax that will be introduced by #

- [95 comments] **Job arrays**
  Closes #1477 (and possibly #1427)

Summary of changes:

- Adds `array` directive to submit tasks as array jobs of a given size

- `TaskArrayCollector` collects tasks into arrays and submits each

- [58 comments] **Workflow output definition**
  Close #4670 

This PR adds a DSL for defining workflow outputs. It is meant to completely replace the publishDir directive, and centralize the definition of published outputs into one location.

T

- [9 comments] **Module system**
  ## Summary

Full implementation of the Nextflow Module System, enabling first-class support for installing, managing, publishing, and running modules from a centralized registry.

## Main capabilities

- [6 comments] **Development environment guide**
  Added a new guide for creating development environment page. Added tabs to help split Windows/macOS/Linux.

Development environment
- VS Code
- Extensions
    - Nextflow
    - nf-core
    - Rem