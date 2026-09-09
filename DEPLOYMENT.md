# Deployment plan

The website can remain on Vercel. The API and analysis workers belong on a
private container host because Snakemake, Docker/Apptainer, large references,
long-running jobs and persistent files are not browser workloads.

## Cheapest useful MVP

Use one small Linux VM (4 vCPU, 16 GB RAM, 100–200 GB attached disk) with
Docker Compose, Postgres, Redis, the API and one worker. Put large inputs and
results in an S3-compatible bucket and keep the VM disk for temporary files.
This is usually the least expensive shape: roughly **US$25–80/month before
storage, data transfer and LLM usage**, depending on provider and region. It is
appropriate for public datasets and a small number of queued jobs, not for
untrusted arbitrary code or clinical workloads.

## More reliable option

Run the API as a managed container service and submit worker containers to a
managed batch service. Cloud Run Jobs can run parallel container tasks and
retry failed tasks; AWS Batch adds no separate Batch fee and charges for the
compute and storage resources used. Expect a small always-on control plane to
cost roughly **US$20–100/month**, with analysis compute billed by runtime. Large
FASTQ, BAM and single-cell jobs can dominate the bill, so enforce quotas and
automatic cleanup.

## Required production settings

1. Set `NEXT_PUBLIC_API_URL` in Vercel to the API's HTTPS URL.
2. Set `CORS_ORIGINS` to the exact Vercel origin.
3. Use managed Postgres and Redis or private containers with backups.
4. Set `JOB_EXECUTION_MODE=celery` and run the worker profile:
   `docker compose -f docker/docker-compose.yml --profile worker up -d`.
5. Replace the local artifact adapter with an S3-compatible implementation
   before accepting large uploads.
6. Keep personal genomes local by default; upload only with explicit consent.
7. Add a reverse proxy, TLS, rate limits, per-user ownership checks and audit
   logs before opening analysis jobs to the public internet.

The repository now persists job and critic records, exposes a queue boundary,
supports configurable CORS, writes reproducibility manifests, and includes a
worker container definition. Cloud account provisioning still requires your
provider account, billing limit and secrets.
