"""
File-type scanner for data connectors.
Reads ONLY file names, sizes, and extensions — never opens file content.
This is the privacy boundary: zero patient data reaches Claude or this server.
"""

import os
import re
from pathlib import Path
from typing import Optional
import paramiko

FILE_TYPE_MAP = {
    # Sequencing
    r"\.fastq(\.gz)?$":         ("FASTQ",             "Raw sequencing reads"),
    r"\.fq(\.gz)?$":            ("FASTQ",             "Raw sequencing reads"),
    r"\.bam$":                  ("BAM",               "Aligned reads"),
    r"\.cram$":                 ("CRAM",              "Compressed aligned reads"),
    r"\.bai$":                  ("BAM index",         "BAM index"),
    r"\.vcf(\.gz)?$":           ("VCF",               "Variant calls"),
    r"\.bcf$":                  ("BCF",               "Binary variant calls"),
    r"\.gvcf(\.gz)?$":          ("gVCF",              "Genomic VCF"),
    # Single-cell
    r"\.h5ad$":                 ("H5AD",              "AnnData (scRNA-seq)"),
    r"\.loom$":                 ("Loom",              "Single-cell matrix"),
    r"barcodes\.tsv(\.gz)?$":   ("10x Barcodes",      "10x Genomics cell barcodes"),
    r"features\.tsv(\.gz)?$":   ("10x Features",      "10x Genomics gene list"),
    r"matrix\.mtx(\.gz)?$":     ("10x Matrix",        "Sparse expression matrix"),
    r"\.h5$":                   ("HDF5",              "10x Genomics / HDF5 matrix"),
    # Methylation
    r"\.bismark\.cov(\.gz)?$":  ("Bismark coverage",  "Methylation coverage"),
    r"\.bedGraph(\.gz)?$":      ("BedGraph",          "Methylation bedGraph"),
    r"\.idat$":                 ("IDAT",              "Illumina array (EPIC/450k)"),
    # ChIP/ATAC
    r"\.narrowPeak$":           ("narrowPeak",        "MACS3 narrow peaks"),
    r"\.broadPeak$":            ("broadPeak",         "MACS3 broad peaks"),
    r"\.bw$":                   ("BigWig",            "Coverage track"),
    r"\.bigwig$":               ("BigWig",            "Coverage track"),
    # Proteomics
    r"\.mzML$":                 ("mzML",              "Mass spectrometry (open)"),
    r"\.mzXML$":                ("mzXML",             "Mass spectrometry (old)"),
    r"\.raw$":                  ("RAW",               "Thermo RAW file"),
    r"\.wiff$":                 ("WIFF",              "SCIEX mass spec"),
    r"\.dia$":                  ("DIA",               "DIA proteomics"),
    # Pathology / imaging
    r"\.svs$":                  ("SVS",               "Whole-slide image (Aperio)"),
    r"\.ndpi$":                 ("NDPI",              "Whole-slide (Hamamatsu)"),
    r"\.tiff?$":                ("TIFF",              "Image / spatial data"),
    r"\.dcm$":                  ("DICOM",             "Medical imaging"),
    # Flow cytometry
    r"\.fcs$":                  ("FCS",               "Flow cytometry"),
    # Microbiome
    r"\.biom$":                 ("BIOM",              "Microbiome OTU table"),
    r"\.qza$":                  ("QIIME2 artifact",   "QIIME2 output"),
    # Metadata / tabular
    r"\.(csv|tsv|txt|xlsx)$":   ("Tabular",           "Metadata / expression matrix"),
    r"\.rds$":                  ("R object",          "Seurat / DESeq2 R object"),
    r"\.rda(ta)?$":             ("R data",            "R data file"),
    # Reports
    r"\.pdf$":                  ("PDF",               "Article / report"),
    r"\.html$":                 ("HTML report",       "MultiQC / FastQC report"),
    r"\.(json|yaml|yml)$":      ("Config",            "Pipeline config"),
}

# Map detected file types → suggested analysis type
FILETYPE_TO_ANALYSIS = {
    "FASTQ":              "rnaseq",
    "BAM":                "rnaseq",
    "CRAM":               "rnaseq",
    "VCF":                "wgs",
    "gVCF":               "wgs",
    "H5AD":               "scrnaseq",
    "10x Matrix":         "scrnaseq",
    "Bismark coverage":   "methylation",
    "IDAT":               "methylation",
    "narrowPeak":         "chipseq",
    "mzML":               "proteomics",
    "RAW":                "proteomics",
    "WIFF":               "proteomics",
    "SVS":                "spatial_transcriptomics",
    "DICOM":              "spatial_transcriptomics",
    "FCS":                "immune_profiling",
    "BIOM":               "microbiome",
}


def detect_file_type(filename: str) -> Optional[tuple[str, str]]:
    name_lower = filename.lower()
    for pattern, info in FILE_TYPE_MAP.items():
        if re.search(pattern, name_lower, re.IGNORECASE):
            return info
    return None


def scan_local_folder(folder_path: str, max_files: int = 5000) -> dict:
    """
    Scan a local folder for genomic file types.
    Only reads file names and sizes — never opens file content.
    """
    path = Path(folder_path).expanduser()
    if not path.exists():
        return {"error": f"Path not found: {folder_path}"}

    counts: dict[str, int]  = {}
    descs: dict[str, str]   = {}
    total_size_gb            = 0.0
    file_list: list[dict]   = []
    total_files              = 0

    for root, _, files in os.walk(path):
        for fname in files:
            if total_files >= max_files:
                break
            total_files += 1
            fpath = Path(root) / fname
            try:
                size_bytes = fpath.stat().st_size
            except OSError:
                size_bytes = 0
            total_size_gb += size_bytes / 1e9

            info = detect_file_type(fname)
            if info:
                ftype, fdesc = info
                counts[ftype] = counts.get(ftype, 0) + 1
                descs[ftype]  = fdesc
                if len(file_list) < 50:
                    file_list.append({
                        "name":      fname,
                        "type":      ftype,
                        "size_mb":   round(size_bytes / 1e6, 2),
                        "path":      str(fpath.relative_to(path)),
                    })

    detected = [{"type": t, "count": c, "description": descs[t]} for t, c in counts.items()]
    detected.sort(key=lambda x: x["count"], reverse=True)

    # Suggest analysis type
    suggested_analysis = _suggest_analysis(counts)

    return {
        "total_files_scanned": total_files,
        "total_size_gb":       round(total_size_gb, 2),
        "detected_types":      detected,
        "sample_files":        file_list[:20],
        "suggested_analysis":  suggested_analysis,
        "has_genomic_data":    len(detected) > 0,
    }


def scan_sftp_folder(host: str, username: str, port: int = 22,
                     password: Optional[str] = None,
                     key_path: Optional[str] = None,
                     remote_path: str = "~") -> dict:
    """
    Scan a remote HPC/SFTP folder for genomic files.
    Only file names and sizes are read over SSH — never file content.
    """
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        connect_kwargs: dict = {"hostname": host, "port": port, "username": username, "timeout": 15}
        if key_path:
            connect_kwargs["key_filename"] = os.path.expanduser(key_path)
        elif password:
            connect_kwargs["password"] = password
        ssh.connect(**connect_kwargs)
    except Exception as e:
        return {"error": f"SSH connection failed: {str(e)}"}

    try:
        sftp = ssh.open_sftp()
        remote_path = remote_path.replace("~", f"/home/{username}")
        counts: dict[str, int] = {}
        descs:  dict[str, str] = {}
        total_size_gb = 0.0
        file_list: list[dict] = []
        total_files = 0

        def _scan_dir(rpath: str, depth: int = 0):
            nonlocal total_files, total_size_gb
            if depth > 4 or total_files >= 2000:
                return
            try:
                entries = sftp.listdir_attr(rpath)
            except Exception:
                return
            for entry in entries:
                full = f"{rpath}/{entry.filename}"
                if entry.st_mode and (entry.st_mode & 0o40000):
                    _scan_dir(full, depth + 1)
                else:
                    total_files += 1
                    sz = entry.st_size or 0
                    total_size_gb += sz / 1e9
                    info = detect_file_type(entry.filename)
                    if info:
                        ft, fd = info
                        counts[ft] = counts.get(ft, 0) + 1
                        descs[ft]  = fd
                        if len(file_list) < 50:
                            file_list.append({
                                "name": entry.filename,
                                "type": ft,
                                "size_mb": round(sz / 1e6, 2),
                                "path": full.replace(remote_path + "/", ""),
                            })

        _scan_dir(remote_path)
        sftp.close()
        ssh.close()

        detected = [{"type": t, "count": c, "description": descs[t]} for t, c in counts.items()]
        detected.sort(key=lambda x: x["count"], reverse=True)

        return {
            "total_files_scanned": total_files,
            "total_size_gb":       round(total_size_gb, 2),
            "detected_types":      detected,
            "sample_files":        file_list[:20],
            "suggested_analysis":  _suggest_analysis(counts),
            "has_genomic_data":    len(detected) > 0,
        }
    except Exception as e:
        ssh.close()
        return {"error": str(e)}


def scan_public_accession(accession_id: str) -> dict:
    """
    For public datasets, we just validate the accession format and return metadata.
    No data is downloaded during scanning.
    """
    acc = accession_id.strip().upper()
    if acc.startswith("GSE") or acc.startswith("GSM"):
        return {"accession": acc, "source": "GEO", "suggested_analysis": "rnaseq",
                "detected_types": [{"type": "GEO dataset", "count": 1, "description": "NCBI GEO accession"}]}
    if acc.startswith("SRR") or acc.startswith("SRP") or acc.startswith("SRA"):
        return {"accession": acc, "source": "SRA", "suggested_analysis": "rnaseq",
                "detected_types": [{"type": "SRA run", "count": 1, "description": "NCBI SRA sequencing run"}]}
    if acc.startswith("TCGA") or acc.startswith("TARGET"):
        return {"accession": acc, "source": "GDC/TCGA", "suggested_analysis": "wgs",
                "detected_types": [{"type": "TCGA dataset", "count": 1, "description": "GDC/TCGA cancer data"}]}
    if acc.startswith("PRJNA") or acc.startswith("PRJEB"):
        return {"accession": acc, "source": "BioProject", "suggested_analysis": "rnaseq",
                "detected_types": [{"type": "BioProject", "count": 1, "description": "NCBI BioProject"}]}
    if re.match(r"^E-[A-Z]+-\d+$", acc):
        return {"accession": acc, "source": "ArrayExpress", "suggested_analysis": "rnaseq",
                "detected_types": [{"type": "ArrayExpress", "count": 1, "description": "EMBL-EBI ArrayExpress"}]}
    return {"accession": acc, "source": "Unknown", "suggested_analysis": "rnaseq",
            "detected_types": [], "warning": "Accession format not recognised"}


def _suggest_analysis(counts: dict[str, int]) -> str:
    priority = [
        ("FASTQ", "rnaseq"), ("BAM", "rnaseq"), ("CRAM", "rnaseq"),
        ("10x Matrix", "scrnaseq"), ("H5AD", "scrnaseq"),
        ("VCF", "wgs"), ("gVCF", "wgs"),
        ("IDAT", "methylation"), ("Bismark coverage", "methylation"),
        ("narrowPeak", "chipseq"), ("broadPeak", "atacseq"),
        ("mzML", "proteomics"), ("RAW", "proteomics"), ("WIFF", "proteomics"),
        ("SVS", "spatial_transcriptomics"), ("DICOM", "spatial_transcriptomics"),
        ("FCS", "immune_profiling"),
        ("BIOM", "microbiome"),
    ]
    for ftype, analysis in priority:
        if counts.get(ftype, 0) > 0:
            return analysis
    return "rnaseq"
