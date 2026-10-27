"""Cloud entrypoint must never persist accounts into ephemeral SQLite."""
from fastapi.testclient import TestClient
import app as cloud


def test_missing_database_exposes_empty_availability_and_blocks_mutations(monkeypatch):
    monkeypatch.delenv('DATABASE_URL', raising=False)
    with TestClient(cloud.app) as client:
        assert client.get('/api/health').json()['ready'] is False
        response=client.get('/api/counselling/config')
        assert response.json()['consultants'] == []
        assert response.json()['enabled'] is False
        assert response.headers['cache-control'] == 'no-store'
        for path in ['/api/auth/register','/api/counselling/register','/api/counselling/bookings','/api/billing/webhook']:
            assert client.post(path, json={}).status_code == 503


def test_cloud_rejects_sqlite_and_failed_database_initialization(monkeypatch):
    monkeypatch.setenv('DATABASE_URL','sqlite:////tmp/accounts.db')
    assert cloud.durable_database_configured() is False
    monkeypatch.setenv('DATABASE_URL','postgresql://configured-without-network')
    def fail(): raise RuntimeError('private connection details')
    monkeypatch.setattr(cloud,'init_db',fail)
    with TestClient(cloud.app) as client:
        assert client.get('/api/health').json()['database'] == 'unavailable'
        response=client.post('/api/auth/login',json={})
        assert response.status_code == 503
        assert 'private connection details' not in response.text
