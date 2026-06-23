"""
Pipeline Runner: launches Snakemake on local machine, SLURM, PBS/Torque, or LSF.
Auto-detects available scheduler. Streams logs back to the API.
"""

import os
import json
import asyncio
import subprocess
import shutil
from pathlib import Path
from typing import Optional, Callable
from enum import Enum
import yaml


class Scheduler(str, Enum):
    LOCAL  = "local"
    SLURM  = "slurm"
    PBS    = "pbs"
    LSF    = "lsf"
    SGE    = "sge"


PIPELINE_DIR = Path(__file__).parent.parent / "pipelines"
PROFILES_DIR = Path(__file__).parent / "profiles"


def detect_scheduler() -> Scheduler:
    """Auto-detect which job scheduler is available on this system."""
    checks = {
        Scheduler.SLURM: "sbatch",
        Scheduler.PBS:   "qsub",
        Scheduler.LSF:   "bsub",
        Scheduler.SGE:   "qsub",  # overlaps PBS; detect by version string
    }
    for scheduler, cmd in checks.items():
        if shutil.which(cmd):
            # Distinguish PBS vs SGE
            if cmd == "qsub":
                try:
                    out = subprocess.check_output(["qsub", "--version"], stderr=subprocess.STDOUT).decode()
                    if "PBS" in out or "TORQUE" in out:
                        return Scheduler.PBS
                    return Scheduler.SGE
                except Exception:
                    return Scheduler.PBS
            return scheduler
    return Scheduler.LOCAL


class PipelineRunner:
    def __init__(
        self,
        scheduler: Optional[Scheduler] = None,
        log_callback: Optional[Callable[[str], None]] = None,
    ):
        self.scheduler = scheduler or detect_scheduler()
        self.log_callback = log_callback or print

    def log(self, msg: str):
        self.log_callback(msg)

    async def run(
        self,
        analysis_type: str,
        config: dict,
        results_dir: Path,
        threads: int = 8,
        memory_gb: int = 32,
        dry_run: bool = False,
        use_singularity: bool = True,
        custom_snakefile: Optional[Path] = None,
    ) -> int:
        """
        Run a Snakemake pipeline. Returns exit code.
        config is written to results_dir/config.yaml before launch.
        """
        results_dir = Path(results_dir)
        results_dir.mkdir(parents=True, exist_ok=True)

        # Write config
        config_path = results_dir / "config.yaml"
        config_path.write_text(yaml.dump(config, default_flow_style=False))
        self.log(f"Config written to {config_path}")

        # Determine Snakefile
        snakefile = custom_snakefile or PIPELINE_DIR / analysis_type.lower() / "Snakefile"
        if not snakefile.exists():
            raise FileNotFoundError(f"No Snakefile for analysis type '{analysis_type}' at {snakefile}")

        # Build Snakemake command
        cmd = self._build_command(
            snakefile=snakefile,
            config_path=config_path,
            results_dir=results_dir,
            threads=threads,
            memory_gb=memory_gb,
            dry_run=dry_run,
            use_singularity=use_singularity,
        )

        self.log(f"Scheduler: {self.scheduler.value}")
        self.log(f"Command: {' '.join(cmd)}")
        self.log("─" * 60)

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=str(snakefile.parent),
        )

        async for line in proc.stdout:
            self.log(line.decode("utf-8", errors="replace").rstrip())

        await proc.wait()
        self.log(f"Pipeline exited with code {proc.returncode}")
        return proc.returncode

    def _build_command(
        self,
        snakefile: Path,
        config_path: Path,
        results_dir: Path,
        threads: int,
        memory_gb: int,
        dry_run: bool,
        use_singularity: bool,
    ) -> list[str]:
        cmd = [
            "snakemake",
            "--snakefile", str(snakefile),
            "--configfile", str(config_path),
            "--cores", str(threads),
            "--rerun-incomplete",
            "--printshellcmds",
            "--reason",
        ]

        if dry_run:
            cmd.append("--dry-run")

        if use_singularity and shutil.which("singularity"):
            cmd.append("--use-singularity")
        elif shutil.which("docker"):
            cmd.extend(["--use-conda"])  # fallback: conda envs via Docker

        # Add scheduler-specific profile
        profile_dir = PROFILES_DIR / self.scheduler.value
        if profile_dir.exists():
            cmd.extend(["--profile", str(profile_dir)])

        # Resource limits for SLURM/PBS/LSF
        if self.scheduler != Scheduler.LOCAL:
            cmd.extend([
                "--jobs", "100",    # max concurrent jobs
                "--latency-wait", "30",
            ])

        return cmd

    def generate_config(
        self,
        analysis_type: str,
        samples: list[str],
        data_dir: str,
        results_dir: str,
        threads: int,
        memory_gb: int,
        extra: dict,
    ) -> dict:
        """Generate a config.yaml dict for any analysis type."""
        config = {
            "samples": samples,
            "results_dir": results_dir,
            "threads": threads,
            "memory_gb": memory_gb,
        }

        # Auto-populate fastq paths by scanning data_dir
        data_path = Path(data_dir)
        fastq_map = {}
        for sample in samples:
            r1_candidates = list(data_path.rglob(f"{sample}*R1*.fastq.gz")) + \
                            list(data_path.rglob(f"{sample}*_1.fastq.gz"))
            r2_candidates = list(data_path.rglob(f"{sample}*R2*.fastq.gz")) + \
                            list(data_path.rglob(f"{sample}*_2.fastq.gz"))
            if r1_candidates:
                fastq_map[sample] = {
                    "R1": str(r1_candidates[0]),
                    "R2": str(r2_candidates[0]) if r2_candidates else "",
                }
        if fastq_map:
            config["fastq"] = fastq_map

        config.update(extra)
        return config


# ─── Snakemake profiles ───────────────────────────────────────────────────────

def write_slurm_profile(profile_dir: Path, partition: str = "compute", account: str = ""):
    profile_dir.mkdir(parents=True, exist_ok=True)
    config = {
        "executor": "slurm",
        "jobs": 100,
        "latency-wait": 30,
        "rerun-incomplete": True,
        "default-resources": [
            f"slurm_partition={partition}",
            "mem_mb=attempt * 8192",
            "runtime=240",
        ],
        "set-resources": {
            "star_align":       {"mem_mb": 65536, "runtime": 180},
            "bismark_align":    {"mem_mb": 65536, "runtime": 360},
            "gatk_haplotypecaller": {"mem_mb": 32768, "runtime": 480},
            "kraken2":          {"mem_mb": 131072, "runtime": 120},
            "megahit_assembly": {"mem_mb": 131072, "runtime": 480},
            "run_mofa":         {"mem_mb": 32768, "runtime": 120},
        },
    }
    if account:
        config["default-resources"].append(f"slurm_account={account}")
    (profile_dir / "config.yaml").write_text(yaml.dump(config, default_flow_style=False))


def write_pbs_profile(profile_dir: Path, queue: str = "normal"):
    profile_dir.mkdir(parents=True, exist_ok=True)
    config = {
        "executor": "cluster-generic",
        "cluster-generic-submit-cmd": f"qsub -q {queue} -l select=1:ncpus={{threads}}:mem={{resources.mem_mb}}mb -l walltime=04:00:00",
        "cluster-generic-status-cmd": "qstat -f {jobid} | grep 'job_state' | awk '{{print $3}}'",
        "cluster-generic-cancel-cmd": "qdel {jobid}",
        "jobs": 100,
        "latency-wait": 30,
    }
    (profile_dir / "config.yaml").write_text(yaml.dump(config, default_flow_style=False))


def write_lsf_profile(profile_dir: Path, queue: str = "normal"):
    profile_dir.mkdir(parents=True, exist_ok=True)
    config = {
        "executor": "cluster-generic",
        "cluster-generic-submit-cmd": f"bsub -q {queue} -n {{threads}} -M {{resources.mem_mb}} -R 'rusage[mem={{resources.mem_mb}}]'",
        "cluster-generic-status-cmd": "bjobs -noheader -o 'stat' {jobid} 2>/dev/null",
        "cluster-generic-cancel-cmd": "bkill {jobid}",
        "jobs": 100,
        "latency-wait": 30,
    }
    (profile_dir / "config.yaml").write_text(yaml.dump(config, default_flow_style=False))


def write_local_profile(profile_dir: Path):
    profile_dir.mkdir(parents=True, exist_ok=True)
    config = {
        "cores": "all",
        "use-singularity": True,
        "rerun-incomplete": True,
        "printshellcmds": True,
    }
    (profile_dir / "config.yaml").write_text(yaml.dump(config, default_flow_style=False))


# Write all profiles on import
for _sched, _fn, _kwargs in [
    (Scheduler.LOCAL, write_local_profile, {}),
    (Scheduler.SLURM, write_slurm_profile, {}),
    (Scheduler.PBS,   write_pbs_profile,   {}),
    (Scheduler.LSF,   write_lsf_profile,   {}),
]:
    write_dir = PROFILES_DIR / _sched.value
    if not (write_dir / "config.yaml").exists():
        _fn(write_dir, **_kwargs)
