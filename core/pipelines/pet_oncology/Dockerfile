# Use a reviewed image with Parabricks, GATK, samtools, bcftools, BWA, FastQC,
# MultiQC, VEP with its plugins, Snakemake, pVACtools and licensed local IEDB.
ARG GENOMICS_BASE_IMAGE
FROM ${GENOMICS_BASE_IMAGE}
RUN python -m pip install --no-cache-dir 'runpod==1.7.13' 'PyYAML==6.0.2'
COPY . /opt/bioverse/pet_oncology/
ENTRYPOINT ["python", "-u", "/opt/bioverse/pet_oncology/worker.py"]
