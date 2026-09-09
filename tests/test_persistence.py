import os
from pathlib import Path


def test_job_repository_round_trips_job_metadata(tmp_path, monkeypatch):
    db_url = f"sqlite:///{tmp_path / 'jobs.db'}"
    monkeypatch.setenv('DATABASE_URL', db_url)
    from core import persistence
    persistence.reset_for_tests()
    repo = persistence.JobRepository()
    job = {'job_id': 'job-1', 'status': 'pending', 'pipeline_id': 'rnaseq', 'logs': []}
    repo.create(job)
    repo.update('job-1', status='running', progress_percent=42.5)
    loaded = repo.get('job-1')
    assert loaded['status'] == 'running'
    assert loaded['progress_percent'] == 42.5
    assert repo.list()[0]['job_id'] == 'job-1'


def test_artifact_store_uses_local_object_storage(tmp_path, monkeypatch):
    monkeypatch.setenv('ARTIFACT_STORAGE_PATH', str(tmp_path))
    from core.persistence import ArtifactStore
    store = ArtifactStore()
    uri = store.put_bytes('job-1/result.txt', b'hello')
    assert uri.startswith('file://')
    assert store.get_bytes(uri) == b'hello'


def test_reproducibility_manifest_records_inputs_and_environment(tmp_path):
    from core.provenance import write_manifest
    path = write_manifest(tmp_path, {'pipeline_id': 'rnaseq', 'samples': ['s1']}, command=['snakemake', '--cores', '2'])
    data = __import__('json').loads(path.read_text())
    assert data['request']['pipeline_id'] == 'rnaseq'
    assert data['command'] == ['snakemake', '--cores', '2']
    assert 'python' in data['environment']
