"""Evidence critic for analysis results.

The critic is deliberately deterministic.  It is a safety and reproducibility
gate that can be used before an LLM explains a result or a researcher sees it
as a discovery.  It never declares a clinical finding; it returns checks,
questions, and concrete requests for more work.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Check:
    key: str
    label: str
    status: str
    evidence: str
    request: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": self.label,
            "status": self.status,
            "evidence": self.evidence,
            "request": self.request,
        }


class CriticAgent:
    """Review a claimed result against a small, explicit evidence standard."""

    MIN_DISCOVERY_SAMPLES = 30
    MIN_REPLICATION_SAMPLES = 10

    def review(self, analysis: dict[str, Any]) -> dict[str, Any]:
        self._validate(analysis)
        metrics = analysis.get("metrics") or {}
        datasets = analysis.get("datasets") or []
        methods = analysis.get("methods") or []
        checks: list[Check] = []

        n_samples = self._number(metrics.get("n_samples"))
        checks.append(Check(
            "sample_size", "Sample size", "pass" if n_samples >= self.MIN_DISCOVERY_SAMPLES else "warn",
            f"{n_samples:g} samples reported; target is at least {self.MIN_DISCOVERY_SAMPLES} for discovery.",
            None if n_samples >= self.MIN_DISCOVERY_SAMPLES else "Report a power analysis or add samples.",
        ))

        fdr_method = metrics.get("fdr_method")
        fdr_threshold = self._number(metrics.get("fdr_threshold"))
        fdr_ok = bool(fdr_method) and 0 < fdr_threshold <= 0.1
        checks.append(Check(
            "multiple_testing", "Multiple-testing control", "pass" if fdr_ok else "fail",
            f"Method: {fdr_method or 'not reported'}; threshold: {fdr_threshold:g}.",
            None if fdr_ok else "Repeat the analysis with a prespecified FDR procedure and report the tested feature universe.",
        ))

        effect = metrics.get("effect_size")
        ci = metrics.get("confidence_interval")
        effect_ok = effect is not None and isinstance(ci, list) and len(ci) == 2
        checks.append(Check(
            "effect_uncertainty", "Effect size and uncertainty", "pass" if effect_ok else "warn",
            "Effect size and confidence interval are reported." if effect_ok else "Effect size or confidence interval is missing.",
            None if effect_ok else "Report an effect size with a confidence interval, not only a p-value.",
        ))

        batch_ok = metrics.get("batch_confounding") is False
        checks.append(Check(
            "batch_confounding", "Batch and confounding", "pass" if batch_ok else "fail",
            "Batch confounding is reported as absent." if batch_ok else "Batch confounding is unknown or present.",
            None if batch_ok else "Add batch/covariate diagnostics and rerun with a prespecified design.",
        ))

        leakage_ok = str(metrics.get("leakage_check", "")).lower() in {"passed", "pass", "none_detected"}
        checks.append(Check(
            "data_leakage", "Data leakage", "pass" if leakage_ok else "fail",
            "Train/test or discovery/replication separation was checked." if leakage_ok else "No passing leakage check was supplied.",
            None if leakage_ok else "Repeat the analysis with preprocessing and feature selection isolated to the discovery cohort.",
        ))

        qc_rate = self._number(metrics.get("qc_pass_rate"))
        qc_ok = qc_rate >= 0.9
        checks.append(Check(
            "quality_control", "Input quality", "pass" if qc_ok else "warn",
            f"QC pass rate: {qc_rate:.1%}." if qc_rate else "QC pass rate was not reported.",
            None if qc_ok else "Provide per-sample QC metrics and rerun after excluding failed samples.",
        ))

        provenance_ok = bool(datasets) and all(d.get("accession") or d.get("uri") for d in datasets)
        checks.append(Check(
            "provenance", "Dataset provenance", "pass" if provenance_ok else "fail",
            f"{len(datasets)} dataset(s) supplied with accession/URI." if provenance_ok else "At least one dataset lacks a public accession or URI.",
            None if provenance_ok else "Add accession, release/version, cohort label, sample counts, and inclusion criteria.",
        ))

        methods_ok = bool(methods) and all(m.get("tool") and m.get("version") for m in methods)
        checks.append(Check(
            "reproducibility", "Method reproducibility", "pass" if methods_ok else "warn",
            f"{len(methods)} versioned method(s) supplied." if methods_ok else "Tool versions or methods are incomplete.",
            None if methods_ok else "Attach the exact workflow, container/lockfile, parameters, and reference files.",
        ))

        replication = self._replication_dataset(datasets)
        replication_ok = replication is not None and self._number(replication.get("n_samples")) >= self.MIN_REPLICATION_SAMPLES
        checks.append(Check(
            "independent_replication", "Independent cohort", "pass" if replication_ok else "fail",
            (f"Independent cohort {replication.get('accession')} with {self._number(replication.get('n_samples')):g} samples." if replication else "No independent cohort supplied."),
            None if replication_ok else "Run the locked analysis on an independent cohort with no feature-selection reuse.",
        ))

        artifacts_ok = bool(analysis.get("results_artifacts"))
        checks.append(Check(
            "artifacts", "Reviewable artifacts", "pass" if artifacts_ok else "warn",
            "Results artifacts were supplied." if artifacts_ok else "No result files or provenance manifest was supplied.",
            None if artifacts_ok else "Attach QC, statistics, figures, logs, and a manifest with checksums.",
        ))

        requests = self._requests(checks, datasets, n_samples)
        blocking = any(c.status == "fail" for c in checks)
        status = "needs_more_analysis" if blocking or requests else "ready_for_human_review"
        score = max(0, min(100, round(100 - sum(20 if c.status == "fail" else 7 if c.status == "warn" else 0 for c in checks))))

        return {
            "status": status,
            "overall_score": score,
            "decision": "Do not treat as a discovery until blocking requests are resolved." if blocking else "Suitable for human scientific review; this is not clinical validation.",
            "claim": analysis["claim"],
            "checks": [c.as_dict() for c in checks],
            "requests": requests,
            "critic_questions": self._questions(analysis, checks),
            "next_actions": [r["acceptance_criteria"] for r in requests] or ["Have a qualified researcher review the evidence package."],
            "human_review_required": True,
        }

    def _requests(self, checks: list[Check], datasets: list[dict[str, Any]], n_samples: float) -> list[dict[str, Any]]:
        requests: list[dict[str, Any]] = []
        for check in checks:
            if check.status == "pass":
                continue
            request_type = {
                "multiple_testing": "repeat_analysis",
                "effect_uncertainty": "repeat_analysis",
                "batch_confounding": "more_data",
                "data_leakage": "repeat_analysis",
                "quality_control": "more_data",
                "provenance": "more_data",
                "reproducibility": "repeat_analysis",
                "independent_replication": "independent_cohort",
                "artifacts": "more_data",
                "sample_size": "more_data",
            }.get(check.key, "human_review")
            requests.append({
                "type": request_type,
                "priority": "blocking" if check.status == "fail" else "recommended",
                "check": check.key,
                "reason": check.evidence,
                "question": check.request,
                "acceptance_criteria": check.request or "Provide the missing evidence and rerun the critic.",
                "can_be_satisfied_by": "analysis_section",
            })
        return requests

    @staticmethod
    def _questions(analysis: dict[str, Any], checks: list[Check]) -> list[str]:
        questions = [
            "Was the claim written before looking at the validation cohort?",
            "What result would falsify this claim?",
            "Could sample composition, treatment, age, sex, tissue, or sequencing batch explain the signal?",
            "Does an independent analysis support the same direction and effect size?",
        ]
        if analysis.get("analysis_type") in {"rnaseq", "scrnaseq", "multiomics"}:
            questions.append("Were normalization, feature filtering, and batch correction performed separately within each cohort?")
        if any(c.key == "multiple_testing" and c.status != "pass" for c in checks):
            questions.append("How many hypotheses were tested before selecting this result?")
        return questions

    @staticmethod
    def _replication_dataset(datasets: list[dict[str, Any]]) -> dict[str, Any] | None:
        for dataset in datasets:
            label = str(dataset.get("cohort", "")).lower()
            if dataset.get("independent") is True or label in {"replication", "validation", "holdout"}:
                return dataset
        return None

    @staticmethod
    def _number(value: Any) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _validate(analysis: dict[str, Any]) -> None:
        if not isinstance(analysis, dict) or not str(analysis.get("claim", "")).strip():
            raise ValueError("analysis.claim is required")
