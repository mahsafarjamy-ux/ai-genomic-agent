"""Choose reuse, partial recomputation or new compute before a job starts.

This agent is deliberately deterministic. It does not claim that a paper's
result is equivalent merely because the title or dataset name matches.
"""
from __future__ import annotations

from typing import Any


class CostReusePlanner:
    MIN_VALIDATED_SCORE = 0.90

    def plan(
        self,
        request: dict[str, Any],
        catalog: list[dict[str, Any]],
        compute_options: dict[str, dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        exact = [c for c in catalog if self._exact_match(request, c) and self._validated(c)]
        if exact:
            chosen = max(exact, key=lambda c: float(c.get("reproducibility_score", 0)))
            return self._result(
                request,
                decision="reuse_existing",
                artifact=chosen,
                estimated_cost=0.0,
                compute_path="none",
                required_steps=[],
                rationale="A validated artifact matches the dataset, reference, preprocessing, tools and parameters.",
            )

        partial = sorted(
            (c for c in catalog if self._same_dataset_and_reference(request, c) and self._validated(c)),
            key=lambda c: self._match_count(request, c),
            reverse=True,
        )
        if partial:
            chosen = partial[0]
            missing = self._missing_dimensions(request, chosen)
            if missing:
                cost, path = self._cheapest_compute(compute_options or {}, multiplier=0.75)
                return self._result(
                    request,
                    decision="partial_recompute",
                    artifact=chosen,
                    estimated_cost=cost,
                    compute_path=path,
                    required_steps=missing,
                    rationale="A validated artifact can be reused, but its provenance differs in required dimensions.",
                )

        cost, path = self._cheapest_compute(compute_options or {}, multiplier=1.0)
        return self._result(
            request,
            decision="recompute",
            artifact=None,
            estimated_cost=cost,
            compute_path=path,
            required_steps=list(request.get("required_steps", [])),
            rationale="No validated equivalent artifact was found in the catalog.",
        )

    def _result(self, request, *, decision, artifact, estimated_cost, compute_path, required_steps, rationale):
        return {
            "decision": decision,
            "selected_artifact_id": artifact.get("artifact_id") if artifact else None,
            "estimated_cost_usd": round(float(estimated_cost), 2),
            "compute_path": compute_path,
            "required_steps": required_steps,
            "rationale": rationale,
            "verification": {
                "independent_replication_required": True,
                "human_review_required": True,
                "do_not_call_clinical": True,
                "catalog_match_dimensions": [
                    "dataset_accession", "reference_version", "preprocessing_fingerprint",
                    "tool_versions", "parameters",
                ],
            },
        }

    @staticmethod
    def _validated(candidate: dict[str, Any]) -> bool:
        return candidate.get("status") in {"validated", "replicated"} and float(candidate.get("reproducibility_score", 0)) >= CostReusePlanner.MIN_VALIDATED_SCORE

    @staticmethod
    def _same_dataset_and_reference(request, candidate) -> bool:
        return request.get("dataset_accession") == candidate.get("dataset_accession") and request.get("reference_version") == candidate.get("reference_version")

    @staticmethod
    def _exact_match(request, candidate) -> bool:
        if not CostReusePlanner._same_dataset_and_reference(request, candidate):
            return False
        return all(request.get(key) == candidate.get(key) for key in ("preprocessing_fingerprint", "tool_versions", "parameters"))

    @staticmethod
    def _missing_dimensions(request, candidate) -> list[str]:
        labels = {
            "preprocessing_fingerprint": "preprocessing",
            "tool_versions": "tool_versions",
            "parameters": "parameters",
        }
        return [label for key, label in labels.items() if request.get(key) is not None and request.get(key) != candidate.get(key)]

    @staticmethod
    def _match_count(request, candidate) -> int:
        keys = ("dataset_accession", "reference_version", "preprocessing_fingerprint", "tool_versions", "parameters")
        return sum(request.get(k) is not None and request.get(k) == candidate.get(k) for k in keys)

    @staticmethod
    def _cheapest_compute(options: dict[str, dict[str, Any]], multiplier: float) -> tuple[float, str]:
        if not options:
            return 0.0, "unspecified"
        costs = {
            name: float(spec.get("hourly_rate_usd", 0)) * float(spec.get("runtime_minutes", 0)) / 60 * multiplier
            for name, spec in options.items()
        }
        path = min(costs, key=costs.get)
        return costs[path], path
