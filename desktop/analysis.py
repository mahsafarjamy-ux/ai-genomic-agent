"""Offline reader for forward-strand consumer SNP exports."""

import csv
import gzip
import re
import zipfile
from pathlib import Path

MAX_BYTES = 128 * 1024 * 1024
TEXT_FORMATS = {".txt", ".csv", ".tsv"}

# Marker IDs and gene names are shared with the BioVerse Personal DNA report.
MARKERS = {
    "rs762551": {
        "gene": "CYP1A2",
        "title": "Caffeine metabolism",
        "calls": {
            "AA": "Two A alleles were observed.",
            "AC": "One A allele was observed.",
            "CC": "Two C alleles were observed.",
        },
        "context": (
            "Studies associate the A allele with higher CYP1A2 activity under some "
            "conditions. The association varies with factors such as smoking. "
            "This marker alone cannot predict your caffeine sensitivity."
        ),
        "source": "Systematic review and meta-analysis, PMID 29282363",
    },
    "rs1815739": {
        "gene": "ACTN3",
        "title": "Fast-twitch muscle protein",
        "calls": {
            "CC": "Two copies of the allele that encodes full-length alpha-actinin-3.",
            "CT": "One copy of the R577X stop variant.",
            "TT": "Two copies of R577X, associated with absence of alpha-actinin-3.",
        },
        "context": (
            "Alpha-actinin-3 is found primarily in fast-twitch muscle fibers. "
            "This marker alone cannot predict athletic performance."
        ),
        "source": "MedlinePlus Genetics, Is athletic performance determined by genetics?",
    },
}


def read_export(path: Path) -> str:
    if path.suffix.lower() not in TEXT_FORMATS | {".zip", ".gz"}:
        raise ValueError("Choose a raw DNA export in TXT, CSV, TSV, ZIP, or GZ format.")
    if path.stat().st_size > MAX_BYTES:
        raise ValueError("The selected file exceeds the 128 MiB limit.")

    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as archive:
            entries = [
                entry for entry in archive.infolist()
                if not entry.is_dir()
                and "__MACOSX" not in Path(entry.filename).parts
                and Path(entry.filename).suffix.lower() in TEXT_FORMATS
            ]
            if len(entries) != 1:
                raise ValueError("The ZIP must contain one TXT, CSV, or TSV DNA export.")
            with archive.open(entries[0]) as stream:
                raw = stream.read(MAX_BYTES + 1)
    else:
        opener = gzip.open if path.suffix.lower() == ".gz" else open
        with opener(path, "rb") as stream:
            raw = stream.read(MAX_BYTES + 1)

    if len(raw) > MAX_BYTES:
        raise ValueError("The unpacked DNA export exceeds the 128 MiB limit.")
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("latin-1")


def analyze(path: Path) -> str:
    observed: dict[str, set[str]] = {}
    variant_rows = 0

    for line in read_export(path).splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        delimiter = "\t" if "\t" in line else ","
        row = next(csv.reader([line], delimiter=delimiter))
        if len(row) not in (4, 5):
            continue
        rsid, chromosome, position = (field.strip() for field in row[:3])
        if not re.fullmatch(r"rs\d+", rsid) or not chromosome or not position.isdecimal():
            continue
        variant_rows += 1
        if rsid in MARKERS:
            genotype = "".join(field.strip().upper() for field in row[3:])
            if re.fullmatch(r"[ACGT]{2}", genotype):
                observed.setdefault(rsid, set()).add("".join(sorted(genotype)))

    if not variant_rows:
        raise ValueError("No variant rows found. Select the raw genotype export from your DNA provider.")

    sections = [
        "BioVerse Personal DNA\nEducational report · Marker panel 0.1",
        f"{variant_rows:,} variant rows read · {len(MARKERS)} markers assessed",
        "Interpretations assume a forward-strand genotype export. "
        "This limited panel is for education and should not guide medical decisions.",
    ]
    for rsid, marker in MARKERS.items():
        calls = observed.get(rsid, set())
        genotype = next(iter(calls)) if len(calls) == 1 else ""
        interpretation = marker["calls"].get(genotype)
        if interpretation:
            finding = f"Genotype {genotype}\n{interpretation}\n{marker['context']}"
        elif len(calls) > 1:
            finding = "Conflicting genotype calls in this file."
        elif genotype:
            finding = "Genotype outside the supported forward-strand allele set."
        else:
            finding = "No usable genotype in this file."
        sections.append(
            f"{marker['title']} · {marker['gene']} ({rsid})\n"
            f"{finding}\nSource: {marker['source']}."
        )
    return "\n\n".join(sections) + "\n"
