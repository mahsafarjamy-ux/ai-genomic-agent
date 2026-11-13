import re
import subprocess
from pathlib import Path

algorithm = "NetMHCpan"
alleles = list(snakemake.params.alleles)
supported = subprocess.check_output(
    ["pvacseq", "valid_alleles", "-s", "dog", "-p", algorithm], text=True
)
supported = set(re.findall(r"DLA[-A-Za-z0-9*:_]+", supported))
if not alleles or any(allele not in supported for allele in alleles):
    raise ValueError("This case requires verified dog DLA alleles supported by NetMHCpan.")

output = Path(snakemake.output[0])
output.mkdir(parents=True, exist_ok=True)
with open(snakemake.input[0]) as vcf:
    has_variants = any(line.strip() and not line.startswith("#") for line in vcf)
if not has_variants:
    (output / "no_variants").touch()
else:
    subprocess.run(
        ["pvacseq", "run", snakemake.input[0], "tumor", ",".join(alleles),
         algorithm, str(output), "--normal-sample-name", "normal", "-e1", "8,9,10,11",
         "--iedb-install-directory", snakemake.params.iedb, "-t", str(snakemake.threads)],
        check=True,
    )
