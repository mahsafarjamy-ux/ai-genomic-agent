"""Assemble a ranked scientist review packet from pVACseq's complete evidence table."""
import csv
import math
from pathlib import Path

predictions = Path(snakemake.input.predictions)
table = predictions / "MHC_Class_I/tumor.all_epitopes.tsv"
destination = Path(snakemake.output[0])

def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) and result >= 0 else math.inf
    except (ValueError, TypeError):
        return math.inf

rows = []
if not (predictions / "no_variants").exists():
    with table.open() as source:
        reader = csv.DictReader(source, delimiter="\t")
        required = {"MT Epitope Seq", "WT Epitope Seq", "HLA Allele", "Best MT IC50 Score"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError("Unexpected pVACseq evidence schema.")
        for row in reader:
            mutant = row["MT Epitope Seq"]
            if mutant and mutant != row["WT Epitope Seq"] and math.isfinite(number(row["Best MT IC50 Score"])):
                rows.append(row)
rows.sort(key=lambda row: (number(row["Best MT IC50 Score"]), -(number(row.get("Tumor DNA VAF")) if math.isfinite(number(row.get("Tumor DNA VAF"))) else -1)))

with destination.open("w") as report:
    report.write("# Canine neoantigen research review\n\n")
    report.write(f"Assembly: {snakemake.params.assembly}\n\nDLA: {', '.join(snakemake.params.alleles)}\n\n")
    report.write("Review status: pending. Predicted binding is one line of evidence. Review specimen identity, assay coverage, read support, normal evidence, expression availability and model limitations before interpreting candidates.\n\n")
    report.write("RNA expression was not measured in this DNA workflow. No clinical binding cutoff was applied.\n\n")
    report.write(f"Scored peptide rows: {len(rows)}. See MultiQC and the complete pVACseq TSV for supporting evidence.\n\n")
    if rows:
        fields = ["Gene Name", "HLA Allele", "MT Epitope Seq", "WT Epitope Seq",
                  "Best MT IC50 Score", "Corresponding WT IC50 Score", "Tumor DNA Depth",
                  "Tumor DNA VAF", "Normal Depth", "Normal VAF"]
        report.write("| Rank | " + " | ".join(fields) + " |\n")
        report.write("|" + " --- |" * (len(fields) + 1) + "\n")
        for index, row in enumerate(rows[:50], 1):
            values = [(row.get(field) or "—").replace("|", r"\|") for field in fields]
            report.write(f"| {index} | " + " | ".join(values) + " |\n")
