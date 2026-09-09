from core.agents.cost_reuse_planner import CostReusePlanner


def test_exact_reproducible_artifact_is_reused_without_recompute():
    request = {
        'analysis_id': 'brain-rnaseq', 'dataset_accession': 'GSE123',
        'reference_version': 'GRCh38', 'preprocessing_fingerprint': 'prep-a',
        'tool_versions': {'salmon': '1.10.2'}, 'parameters': {'strandedness': 'auto'},
    }
    catalog = [{
        **request, 'artifact_id': 'artifact-1', 'artifact_uri': 's3://results/a',
        'reproducibility_score': 0.98, 'status': 'validated',
    }]
    result = CostReusePlanner().plan(request, catalog)
    assert result['decision'] == 'reuse_existing'
    assert result['selected_artifact_id'] == 'artifact-1'
    assert result['estimated_cost_usd'] == 0
    assert result['verification']['independent_replication_required'] is True


def test_partial_match_runs_only_missing_steps_and_is_cheaper():
    request = {
        'dataset_accession': 'GSE123', 'reference_version': 'GRCh38',
        'preprocessing_fingerprint': 'prep-b', 'tool_versions': {'salmon': '1.10.2'},
        'parameters': {'strandedness': 'auto'},
    }
    catalog = [{
        'artifact_id': 'artifact-2', 'dataset_accession': 'GSE123',
        'reference_version': 'GRCh38', 'preprocessing_fingerprint': 'prep-a',
        'tool_versions': {'salmon': '1.10.2'}, 'parameters': {'strandedness': 'auto'},
        'available_steps': ['quantification'], 'reproducibility_score': 0.95,
        'status': 'validated',
    }]
    result = CostReusePlanner().plan(request, catalog, compute_options={'cpu': {'hourly_rate_usd': 1, 'runtime_minutes': 30}})
    assert result['decision'] == 'partial_recompute'
    assert result['selected_artifact_id'] == 'artifact-2'
    assert result['estimated_cost_usd'] < 0.5
    assert 'preprocessing' in result['required_steps']


def test_planner_chooses_cheapest_valid_compute_path():
    request = {'dataset_accession': 'GSE999', 'required_steps': ['differential_expression']}
    options = {
        'cpu': {'hourly_rate_usd': 1.0, 'runtime_minutes': 60},
        'gpu': {'hourly_rate_usd': 3.0, 'runtime_minutes': 10},
        'spot_cpu': {'hourly_rate_usd': 0.3, 'runtime_minutes': 80},
    }
    result = CostReusePlanner().plan(request, [], compute_options=options)
    assert result['decision'] == 'recompute'
    assert result['compute_path'] == 'spot_cpu'
    assert result['estimated_cost_usd'] == 0.4
