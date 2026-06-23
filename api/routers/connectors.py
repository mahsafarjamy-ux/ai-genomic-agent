"""
Data Connectors API
Manages connections to local folders, HPC/SFTP, and public datasets.
Privacy: raw genomic data is NEVER read or transmitted. Only file names, types, and sizes.
"""

import os
import json
import uuid
import urllib.parse
import hashlib
from datetime import datetime
from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import requests as http_requests
from core.connectors.scanner import (
    scan_local_folder, scan_sftp_folder, scan_public_accession
)

router = APIRouter()

# In-memory store (upgrade to PostgreSQL with SQLAlchemy for production)
_connectors: dict[str, dict] = {}
_datasets:   dict[str, dict] = {}
_audit_log:  list[dict]      = []


def _log(connector_id: str, action: str, detail: str = ""):
    _audit_log.append({
        "id":           str(uuid.uuid4()),
        "connector_id": connector_id,
        "action":       action,
        "detail":       detail,
        "timestamp":    datetime.utcnow().isoformat(),
    })


# ── Pydantic models ────────────────────────────────────────────────────────

class LocalConnector(BaseModel):
    type: Literal["local"] = "local"
    name: str
    folder_path: str

class SftpConnector(BaseModel):
    type: Literal["sftp"] = "sftp"
    name: str
    host: str
    port: int = 22
    username: str
    password: Optional[str] = None
    key_path: Optional[str] = None
    remote_path: str = "~"

class S3Connector(BaseModel):
    type: Literal["s3"] = "s3"
    name: str
    bucket: str
    prefix: str = ""
    aws_access_key: str
    aws_secret_key: str
    region: str = "us-east-1"

class GDriveConnector(BaseModel):
    type: Literal["gdrive"] = "gdrive"
    name: str
    oauth_token: str
    folder_id: Optional[str] = None

class PublicAccessionConnector(BaseModel):
    type: Literal["public"] = "public"
    name: str
    accession_id: str

ConnectorCreate = LocalConnector | SftpConnector | S3Connector | GDriveConnector | PublicAccessionConnector

class TestRequest(BaseModel):
    type: str
    folder_path: Optional[str] = None
    host:        Optional[str] = None
    port:        int = 22
    username:    Optional[str] = None
    password:    Optional[str] = None
    key_path:    Optional[str] = None
    remote_path: str = "~"
    accession_id:Optional[str] = None
    bucket:      Optional[str] = None

class ScanRequest(BaseModel):
    connector_id: str

class DatasetCreate(BaseModel):
    connector_id: str
    name: str
    description: str = ""
    selected_types: list[str] = []
    phi_confirmed: bool = False

class DisconnectRequest(BaseModel):
    connector_id: str


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/")
async def list_connectors():
    """List all registered data connectors."""
    return list(_connectors.values())


@router.post("/test")
async def test_connection(req: TestRequest):
    """
    Test a connection before saving it.
    For local: checks path exists.
    For SFTP: attempts SSH handshake (does NOT read file content).
    For public: validates accession format.
    """
    try:
        if req.type == "local":
            if not req.folder_path:
                return {"ok": False, "message": "Folder path is required"}
            import os
            exists = os.path.exists(os.path.expanduser(req.folder_path))
            return {"ok": exists, "message": "Folder found" if exists else "Folder not found"}

        elif req.type == "sftp":
            if not req.host or not req.username:
                return {"ok": False, "message": "Host and username are required"}
            import paramiko
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            try:
                kw: dict = {"hostname": req.host, "port": req.port, "username": req.username, "timeout": 10}
                if req.key_path:   kw["key_filename"] = os.path.expanduser(req.key_path)
                if req.password:   kw["password"]     = req.password
                ssh.connect(**kw)
                ssh.close()
                return {"ok": True, "message": f"Connected to {req.host} as {req.username}"}
            except Exception as e:
                return {"ok": False, "message": str(e)}

        elif req.type == "public":
            if not req.accession_id:
                return {"ok": False, "message": "Accession ID is required"}
            res = scan_public_accession(req.accession_id)
            return {"ok": "error" not in res, "message": f"Recognised as {res.get('source','unknown')} accession"}

        elif req.type in ("s3", "gdrive", "dropbox", "onedrive", "azure"):
            return {"ok": True, "message": f"{req.type.upper()} connection (OAuth required — credentials will be validated on first scan)"}

        return {"ok": False, "message": "Unknown connector type"}

    except Exception as e:
        return {"ok": False, "message": str(e)}


@router.post("/create")
async def create_connector(payload: dict):
    """Save a connector. Tokens are stored in memory; use encryption in production."""
    connector_id = str(uuid.uuid4())
    ctype = payload.get("type", "local")

    # Mask sensitive fields before storing (never log raw credentials)
    safe = {k: ("***" if k in ("password", "aws_secret_key", "oauth_token") else v)
            for k, v in payload.items()}
    safe["id"]         = connector_id
    safe["created_at"] = datetime.utcnow().isoformat()
    safe["status"]     = "connected"
    safe["scan"]       = None

    _connectors[connector_id] = safe
    _log(connector_id, "create", f"type={ctype} name={payload.get('name','')}")
    return safe


@router.post("/scan")
async def scan_connector(req: ScanRequest):
    """
    Scan a connector's storage for genomic file types.
    ONLY reads file names and sizes — never opens file content.
    """
    conn = _connectors.get(req.connector_id)
    if not conn:
        raise HTTPException(404, "Connector not found")

    ctype = conn.get("type")
    scan_result: dict = {}

    if ctype == "local":
        scan_result = scan_local_folder(conn.get("folder_path", ""))

    elif ctype == "sftp":
        scan_result = scan_sftp_folder(
            host=conn["host"], username=conn["username"],
            port=conn.get("port", 22),
            remote_path=conn.get("remote_path", "~"),
        )

    elif ctype == "public":
        scan_result = scan_public_accession(conn.get("accession_id", ""))

    else:
        # Cloud connectors return a placeholder until OAuth is implemented
        scan_result = {
            "total_files_scanned": 0,
            "total_size_gb": 0,
            "detected_types": [],
            "sample_files":   [],
            "suggested_analysis": "rnaseq",
            "note": f"{ctype.upper()} scanning requires OAuth — coming soon. You can still proceed by specifying the analysis type manually.",
        }

    _connectors[req.connector_id]["scan"] = scan_result
    _log(req.connector_id, "scan", f"files={scan_result.get('total_files_scanned',0)}")
    return scan_result


@router.post("/disconnect")
async def disconnect_connector(req: DisconnectRequest):
    """Remove a connector and revoke stored credentials."""
    conn = _connectors.pop(req.connector_id, None)
    if not conn:
        raise HTTPException(404, "Connector not found")
    _log(req.connector_id, "disconnect")
    return {"ok": True, "message": "Connector removed and credentials cleared"}


@router.get("/audit")
async def get_audit_log():
    """Return the connection audit log (who connected what, when, what was accessed)."""
    return list(reversed(_audit_log))


# ── OAuth ─────────────────────────────────────────────────────────────────────

_OAUTH_CFG = {
    "gdrive": {
        "client_id_env":     "GOOGLE_CLIENT_ID",
        "client_secret_env": "GOOGLE_CLIENT_SECRET",
        "auth_url":          "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url":         "https://oauth2.googleapis.com/token",
        "scope":             "https://www.googleapis.com/auth/drive.readonly",
        "extra_auth_params": {"access_type": "offline", "prompt": "consent"},
    },
    # Google Cloud Storage — same Google OAuth app, different scope
    "gcs": {
        "client_id_env":     "GOOGLE_CLIENT_ID",
        "client_secret_env": "GOOGLE_CLIENT_SECRET",
        "auth_url":          "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url":         "https://oauth2.googleapis.com/token",
        "scope":             "https://www.googleapis.com/auth/devstorage.read_only",
        "extra_auth_params": {"access_type": "offline", "prompt": "consent"},
    },
    # Globus — supports institutional logins (MIT Touchstone, etc.) + Google
    "globus": {
        "client_id_env":     "GLOBUS_CLIENT_ID",
        "client_secret_env": "GLOBUS_CLIENT_SECRET",
        "auth_url":          "https://auth.globus.org/v2/oauth2/authorize",
        "token_url":         "https://auth.globus.org/v2/oauth2/token",
        "scope":             "urn:globus:auth:scope:transfer.api.globus.org:all openid email profile",
        "extra_auth_params": {},
    },
    "dropbox": {
        "client_id_env":     "DROPBOX_APP_KEY",
        "client_secret_env": "DROPBOX_APP_SECRET",
        "auth_url":          "https://www.dropbox.com/oauth2/authorize",
        "token_url":         "https://api.dropboxapi.com/oauth2/token",
        "scope":             "",
        "extra_auth_params": {"token_access_type": "offline"},
    },
    "onedrive": {
        "client_id_env":     "MICROSOFT_CLIENT_ID",
        "client_secret_env": "MICROSOFT_CLIENT_SECRET",
        "auth_url":          "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "token_url":         "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "scope":             "Files.Read offline_access",
        "extra_auth_params": {},
    },
}


def _backend_callback_uri(provider: str, request: Request) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/connectors/oauth/{provider}/callback"


@router.get("/oauth/{provider}/start")
async def oauth_start(provider: str, request: Request, redirect_uri: str = "http://localhost:3002/connect"):
    """Redirect the browser to the provider's authorization page."""
    cfg = _OAUTH_CFG.get(provider)
    if not cfg:
        raise HTTPException(400, f"Unknown OAuth provider: {provider}. Supported: gdrive, dropbox, onedrive")

    client_id = os.environ.get(cfg["client_id_env"])
    if not client_id:
        env_var = cfg["client_id_env"]
        raise HTTPException(400, (
            f"{env_var} is not set. "
            f"Add it to your .env file to enable {provider} OAuth. "
            f"See your provider's developer console to create OAuth credentials."
        ))

    callback_uri = _backend_callback_uri(provider, request)
    params: dict = {
        "client_id":     client_id,
        "redirect_uri":  callback_uri,
        "response_type": "code",
        "state":         redirect_uri,  # carry frontend URL through OAuth round-trip
    }
    if cfg["scope"]:
        params["scope"] = cfg["scope"]
    params.update(cfg["extra_auth_params"])

    auth_url = cfg["auth_url"] + "?" + urllib.parse.urlencode(params)
    return RedirectResponse(auth_url)


@router.get("/oauth/{provider}/callback")
async def oauth_callback(provider: str, request: Request, code: str = "", state: str = "http://localhost:3002/connect", error: str = ""):
    """Exchange authorization code for access token, create connector, redirect to frontend."""
    if error:
        frontend_url = f"{state}?oauth_error={urllib.parse.quote(error)}&source={provider}"
        return RedirectResponse(frontend_url)

    cfg = _OAUTH_CFG.get(provider)
    if not cfg:
        raise HTTPException(400, f"Unknown provider: {provider}")

    client_id     = os.environ.get(cfg["client_id_env"], "")
    client_secret = os.environ.get(cfg["client_secret_env"], "")
    callback_uri  = _backend_callback_uri(provider, request)

    try:
        resp = http_requests.post(cfg["token_url"], data={
            "client_id":     client_id,
            "client_secret": client_secret,
            "code":          code,
            "grant_type":    "authorization_code",
            "redirect_uri":  callback_uri,
        }, timeout=15)
        token_data = resp.json()
    except Exception as e:
        frontend_url = f"{state}?oauth_error={urllib.parse.quote(str(e))}&source={provider}"
        return RedirectResponse(frontend_url)

    if "error" in token_data:
        msg = token_data.get("error_description", token_data["error"])
        frontend_url = f"{state}?oauth_error={urllib.parse.quote(msg)}&source={provider}"
        return RedirectResponse(frontend_url)

    access_token  = token_data.get("access_token", "")
    refresh_token = token_data.get("refresh_token", "")

    connector_id = str(uuid.uuid4())
    _connectors[connector_id] = {
        "id":            connector_id,
        "type":          provider,
        "name":          f"My {provider.replace('gdrive','Google Drive').replace('gcs','Google Cloud Storage').replace('globus','Globus').replace('onedrive','OneDrive').replace('dropbox','Dropbox')}",
        "oauth_token":   "***",
        "_oauth_token":  access_token,   # kept in memory, never returned to client
        "refresh_token": "***",
        "created_at":    datetime.utcnow().isoformat(),
        "status":        "connected",
        "scan":          None,
    }
    _log(connector_id, "oauth_connect", f"provider={provider}")

    frontend_url = f"{state}?connector_id={connector_id}&source={provider}"
    return RedirectResponse(frontend_url)


# ── Datasets ───────────────────────────────────────────────────────────────

@router.get("/datasets")
async def list_datasets():
    return list(_datasets.values())


@router.post("/datasets/create")
async def create_dataset(payload: DatasetCreate):
    """Create a dataset record from a scanned connector."""
    conn = _connectors.get(payload.connector_id)
    if not conn:
        raise HTTPException(404, "Connector not found")

    scan = conn.get("scan") or {}
    dataset_id = str(uuid.uuid4())
    dataset = {
        "id":                dataset_id,
        "connector_id":      payload.connector_id,
        "connector_name":    conn.get("name", ""),
        "connector_type":    conn.get("type", ""),
        "name":              payload.name,
        "description":       payload.description,
        "total_files":       scan.get("total_files_scanned", 0),
        "total_size_gb":     scan.get("total_size_gb", 0),
        "detected_types":    scan.get("detected_types", []),
        "suggested_analysis":scan.get("suggested_analysis", "rnaseq"),
        "selected_types":    payload.selected_types,
        "phi_confirmed":     payload.phi_confirmed,
        "created_at":        datetime.utcnow().isoformat(),
    }
    _datasets[dataset_id] = dataset
    _log(payload.connector_id, "dataset_created", f"dataset_id={dataset_id} name={payload.name}")
    return dataset
