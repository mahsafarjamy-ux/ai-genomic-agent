# BioVerse canine neoantigen research pilot

The website records signed-in requests for analysis of existing sequence
data or veterinary sample collection coordination. Intake does not take
payments or collect FASTQs. A scientist works from an approved staged case.
Veterinary care, specimen transfer, and any vaccine manufacturing require
separate arrangements and review.

## Prepare a case

Use paired-end DNA sequencing from tumor and matched normal tissue from
the same dog. Record specimen identity, pathology, assay, sequencing platform,
and expected coverage before dispatch. Keep reference FASTA, BWA index, FASTA
index, GATK dictionary, and the VEP cache on the same canine assembly. Install
the pVACseq Wildtype and Frameshift VEP plugins and a licensed local IEDB
NetMHCpan installation. Confirm the dog's DLA typing and predictor support.
The pipeline does not infer DLA types. No tumor RNA is assumed.

Copy the example YAML and configure references and DLA alleles. Stage the
configuration as `approved.yaml` and the four compressed FASTQs as
`tumor_1.fastq.gz`, `tumor_2.fastq.gz`, `normal_1.fastq.gz`, and
`normal_2.fastq.gz` under the private volume's `cases/<case-id>/`.
Use the UUID from intake and keep case files inaccessible to other users.

The pipeline runs FastQC, BWA or Parabricks alignment, duplicate handling,
MultiQC, paired Mutect2 with orientation bias filtering, VEP, local pVACseq
and review report generation. This pilot produces QC evidence for human
review. Assay-specific coverage, contamination and sample-identity gates,
canine germline resources, and GPU/CPU concordance require validation before
accepting paid cases. The report preserves raw evidence files and ranks
scored peptides by predicted binding and read support. A scientist reviews
the report and QC before any external release.

## Rent an on-demand GPU

1. In [Runpod Console](https://console.runpod.io/), start with Serverless and
   create a queue-based endpoint in a region with an available private network
   volume. Confirm that your selected GPU and host RAM satisfy the requirements
   of the pinned Parabricks image. Use a single GPU for the first benchmark.
2. Build and publish the worker container from the pipeline directory with
   `docker build --build-arg GENOMICS_BASE_IMAGE=<reviewed-toolchain-image> -t <registry>/bioverse-pet-worker .`.
   The base image must supply the tools listed in the Dockerfile, including
   licensed software. Mount the volume on the endpoint and stage references
   and a synthetic or authorized validation case. Start with zero idle workers
   and one maximum worker. Set the execution timeout based on your benchmark.
3. Configure the BioVerse backend's `PET_RUNPOD_ENDPOINT` and
   `PET_RUNPOD_API_KEY` as server settings and `PET_ONCOLOGY_STAFF` as a
   comma-separated list of approved account emails. Dispatch the approved
   case through `POST /api/pet-oncology/staff/cases/{id}/dispatch` with a staff
   session. Requests carry the case ID only. If submission is ambiguous,
   reconcile in the Runpod dashboard before retrying.
4. The customer page polls queued jobs while open. Completion moves the
   case to scientist review. Retrieve `review.md`, MultiQC, and the evidence
   TSV from the private worker volume. Report release remains a staff step.

To run the CPU baseline from a case directory, run
`snakemake -s <repo>/core/pipelines/pet_oncology/Snakefile --configfile approved.yaml --cores 8`
with the reads and references declared in the config. Compare this result
with the GPU run using the same validated sample and reference. Measure file
staging, queue delay, execution, and review separately before quoting a
turnaround. GPU accelerates alignment in this implementation, with Mutect2,
VEP, and local binding prediction using the CPU.

[Runpod pricing](https://www.runpod.io/pricing) lists worker rates. The case
cost depends on billed runtime, GPU type, volume and transfer costs.
