import pytest

from core.agents.critic_agent import CriticAgent


def test_critic_requests_independent_replication_and_fdr_when_missing():
    review = CriticAgent().review({
        "claim": "A pathway is associated with pediatric brain tumor progression",
        "analysis_type": "rnaseq",
        "metrics": {"n_samples": 18, "fdr_significant_features": 12},
        "datasets": [{"accession": "GSE123", "cohort": "discovery", "n_samples": 18}],
        "methods": [{"tool": "DESeq2", "version": "1.42"}],
    })

    request_types = {request["type"] for request in review["requests"]}
    assert "repeat_analysis" in request_types
    assert "independent_cohort" in request_types
    assert review["status"] == "needs_more_analysis"


def test_critic_passes_complete_reproducible_evidence_package():
    review = CriticAgent().review({
        "claim": "A pathway is associated with pediatric brain tumor progression",
        "analysis_type": "rnaseq",
        "metrics": {
            "n_samples": 96,
            "fdr_method": "BH",
            "fdr_threshold": 0.05,
            "effect_size": 1.4,
            "confidence_interval": [1.1, 1.8],
            "batch_confounding": False,
            "qc_pass_rate": 0.98,
            "leakage_check": "passed",
        },
        "datasets": [
            {"accession": "GSE123", "cohort": "discovery", "n_samples": 64},
            {"accession": "GSE456", "cohort": "replication", "n_samples": 32},
        ],
        "methods": [
            {"tool": "DESeq2", "version": "1.42", "parameters": {"design": "~ batch + group"}}
        ],
        "results_artifacts": ["results/multiqc/multiqc_report.html", "results/statistics.tsv"],
        "human_review_required": True,
    })

    assert review["status"] == "ready_for_human_review"
    assert review["overall_score"] >= 80
    assert not any(r["priority"] == "blocking" for r in review["requests"])


def test_critic_rejects_missing_claim_and_dataset_provenance():
    with pytest.raises(ValueError):
        CriticAgent().review({"metrics": {}})
