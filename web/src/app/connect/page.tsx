"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import NavBar from "@/components/NavBar";
import { useAuth } from "@/hooks/useAuth";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SOURCES = [
  { id: "local",    icon: "📁", label: "My Computer",              desc: "A folder on this machine" },
  { id: "sftp",     icon: "🖥️", label: "HPC / Institutional Server", desc: "Connect via SSH (MIT, Broad, etc.)" },
  { id: "public",   icon: "🌍", label: "Public Dataset",            desc: "GEO · SRA · TCGA · ArrayExpress" },
  { id: "gcs",      icon: "🟡",  label: "Google Cloud Storage",     desc: "GCS bucket — sign in with Gmail" },
  { id: "globus",   icon: "🔗",  label: "Globus",                   desc: "Academic transfer · MIT · Broad · NCBI" },
  { id: "s3",       icon: "☁️",  label: "Amazon S3",                desc: "AWS bucket" },
  { id: "gdrive",   icon: "🔵",  label: "Google Drive",             desc: "Google Drive folder" },
  { id: "dropbox",  icon: "📦",  label: "Dropbox",                  desc: "Dropbox account" },
  { id: "onedrive", icon: "🏢",  label: "Microsoft OneDrive",       desc: "OneDrive / SharePoint" },
];

const FILETYPE_ICONS: Record<string, string> = {
  "FASTQ": "📄", "BAM": "📊", "CRAM": "📊", "VCF": "🧬",
  "H5AD": "🔵", "10x Matrix": "🔵", "IDAT": "🧪", "Bismark coverage": "🧪",
  "mzML": "⚗️", "RAW": "⚗️", "SVS": "🩻", "FCS": "🔴", "BIOM": "🦠",
};
const GENOMIC_TYPES = new Set(Object.keys(FILETYPE_ICONS));

type Step = "source" | "connect" | "scan" | "done";

const S = {
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem" } as React.CSSProperties,
  input: {
    width: "100%", background: "var(--canvas)", border: "1px solid var(--border)",
    borderRadius: 10, padding: "0.65rem 0.9rem", fontSize: 14, color: "var(--text)", outline: "none",
  } as React.CSSProperties,
  btnPrimary: {
    background: "var(--flame)", color: "#fff", border: "none",
    borderRadius: 10, padding: "0.7rem 1.5rem", fontWeight: 600 as const,
    fontSize: 14, cursor: "pointer",
  } as React.CSSProperties,
  btnSecondary: {
    background: "var(--surface)", color: "var(--muted)",
    border: "1px solid var(--border)", borderRadius: 10,
    padding: "0.65rem 1.2rem", fontSize: 13, cursor: "pointer",
  } as React.CSSProperties,
  label: { fontSize: 12, color: "var(--muted)", marginBottom: 6, display: "block" } as React.CSSProperties,
};

export default function ConnectPage() {
  const { user, loading: authLoading, signOut } = useAuth();

  const [step, setStep]     = useState<Step>("source");
  const [source, setSource] = useState<string | null>(null);
  const [name, setName]     = useState("");

  // Local
  const [folderPath, setFolderPath] = useState("");
  // SFTP (no port — always 22)
  const [host, setHost]         = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [keyPath, setKeyPath]   = useState("");
  const [remotePath, setRemotePath] = useState("~");
  // Public
  const [accessionId, setAccessionId] = useState("");
  // S3 / GCS key-based
  const [bucketName, setBucketName] = useState("");
  const [apiKey, setApiKey]         = useState("");
  const [secret, setSecret]         = useState("");
  // GCS bucket path (entered before OAuth redirect, stored in sessionStorage)
  const [gcsBucket, setGcsBucket]   = useState("");
  // Globus endpoint
  const [globusEndpoint, setGlobusEndpoint] = useState("");
  // Cloud OAuth token fallback
  const [oauthToken, setOauthToken] = useState("");

  const [connectorId, setConnectorId] = useState<string | null>(null);
  const [testResult, setTestResult]   = useState<{ ok: boolean; message: string } | null>(null);
  const [scanResult, setScanResult]   = useState<any>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [dataset, setDataset]         = useState<any>(null);
  const [phiConfirmed, setPhiConfirmed] = useState(false);

  const selectedSource = SOURCES.find(s => s.id === source);
  const isOAuth        = ["gdrive", "dropbox", "onedrive", "gcs", "globus"].includes(source || "");
  const isKeyCloud     = ["s3"].includes(source || "");

  // ── Handle OAuth callback redirect (?connector_id=...&source=...) ──────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("connector_id");
    const src = params.get("source");
    if (cid && src) {
      setConnectorId(cid);
      setSource(src);
      setStep("scan");
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  function buildPayload() {
    const base = { type: source, name: name || `My ${selectedSource?.label}` };
    if (source === "local")  return { ...base, folder_path: folderPath };
    if (source === "sftp")   return { ...base, host, port: 22, username, password, key_path: keyPath, remote_path: remotePath };
    if (source === "public") return { ...base, accession_id: accessionId };
    if (source === "s3")     return { ...base, bucket: bucketName, aws_access_key: apiKey, aws_secret_key: secret };
    if (isOAuth)             return { ...base, oauth_token: oauthToken };
    return base;
  }

  async function handleTest() {
    setLoading(true); setError(null); setTestResult(null);
    try {
      const res = await fetch(`${BASE}/api/connectors/test`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: source, folder_path: folderPath, host, port: 22, username,
          password, key_path: keyPath, remote_path: remotePath, accession_id: accessionId,
          bucket: bucketName,
        }),
      });
      const r = await res.json();
      setTestResult(r);
      if (r.ok) {
        const cr = await fetch(`${BASE}/api/connectors/create`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        const conn = await cr.json();
        setConnectorId(conn.id);
        setStep("scan");
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleOAuthToken() {
    if (!oauthToken.trim()) return;
    setLoading(true); setError(null);
    try {
      const cr = await fetch(`${BASE}/api/connectors/create`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const conn = await cr.json();
      setConnectorId(conn.id);
      setStep("scan");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleScan() {
    if (!connectorId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${BASE}/api/connectors/scan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connector_id: connectorId }),
      });
      const result = await res.json();
      setScanResult(result);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleCreate() {
    if (!connectorId || !phiConfirmed) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${BASE}/api/connectors/datasets/create`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connector_id: connectorId,
          name: name || selectedSource?.label || "My Dataset",
          phi_confirmed: phiConfirmed,
          selected_types: scanResult?.detected_types?.map((d: any) => d.type) || [],
        }),
      });
      setDataset(await res.json());
      setStep("done");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  const hasGenomicFiles = scanResult?.detected_types?.some((d: any) => GENOMIC_TYPES.has(d.type));
  const analysisTarget  = scanResult?.suggested_analysis ?? "rnaseq";

  if (authLoading || !user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--canvas)" }}>
      <NavBar active="/connect" user={user} onSignOut={signOut} />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "2.5rem 2rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Connect Your Data</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
            Point the platform to where your files live. Raw data stays exactly where it is —
            we only read file names and types to launch the right pipeline.
          </p>
          <div style={{ marginTop: 12, padding: "0.6rem 1rem", background: "#edf4fb",
            border: "1px solid #c8dfe8", borderRadius: 10, fontSize: 12, color: "#1d6fa4",
            display: "flex", alignItems: "flex-start", gap: 8 }}>
            🔒 <span><strong>Privacy:</strong> Your raw genomic data never moves. The AI only sees file names, sizes, and types.</span>
          </div>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: 4, marginBottom: 32, alignItems: "center" }}>
          {(["source", "connect", "scan", "done"] as Step[]).map((s, i) => {
            const labels: Record<Step, string> = { source: "Source", connect: "Connect", scan: "Scan", done: "Done" };
            const idx   = ["source","connect","scan","done"].indexOf(step);
            const mine  = ["source","connect","scan","done"].indexOf(s);
            const done  = mine < idx;
            const active= mine === idx;
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                  background: (done || active) ? "var(--flame)" : "var(--border)",
                  color: (done || active) ? "#fff" : "var(--muted)",
                }}>
                  {done ? "✓" : mine + 1}
                </div>
                <span style={{ fontSize: 11, color: active ? "var(--flame)" : done ? "var(--amber)" : "var(--dim)" }}>
                  {labels[s]}
                </span>
                {i < 3 && <div style={{ width: 24, height: 1, background: "var(--border)", marginLeft: 4 }} />}
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{ background: "#fff0f0", border: "1px solid #fcc", borderRadius: 10,
            padding: "0.8rem 1rem", fontSize: 13, color: "#c00", marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* ── Step 1: Choose source ───────────────────────────────────────── */}
        {step === "source" && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14, color: "var(--text)" }}>
              Where is your data?
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 10 }}>
              {SOURCES.map(src => (
                <button key={src.id} onClick={() => { setSource(src.id); setStep("connect"); }}
                  style={{
                    background: "var(--surface)", border: "1.5px solid var(--border)",
                    borderRadius: 14, padding: "1rem 0.8rem", cursor: "pointer", textAlign: "center",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--flame)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                  <div style={{ fontSize: 26, marginBottom: 6 }}>{src.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{src.label}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{src.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Connect ─────────────────────────────────────────────── */}
        {step === "connect" && selectedSource && (
          <div>
            <button onClick={() => setStep("source")} style={{ ...S.btnSecondary, marginBottom: 20, fontSize: 12 }}>
              ← Back
            </button>

            <div style={S.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
                <span style={{ fontSize: 24 }}>{selectedSource.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>{selectedSource.label}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Fill in the details below to connect</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={S.label}>Connection name (optional)</label>
                  <input style={S.input} value={name} onChange={e => setName(e.target.value)}
                    placeholder={`e.g. My ${selectedSource.label}`} />
                </div>

                {/* ── Local folder ── */}
                {source === "local" && (
                  <div>
                    <label style={S.label}>Folder path on your computer</label>
                    <input style={S.input} value={folderPath} onChange={e => setFolderPath(e.target.value)}
                      placeholder="/Users/you/data/project1  or  ~/genomics/samples" />
                    <p style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
                      Mac: right-click folder in Finder → Get Info → copy the "Where:" field
                    </p>
                  </div>
                )}

                {/* ── HPC / SFTP (no port — always 22) ── */}
                {source === "sftp" && (
                  <>
                    <div>
                      <label style={S.label}>Hostname</label>
                      <input style={S.input} value={host} onChange={e => setHost(e.target.value)}
                        placeholder="hpc.university.edu" />
                    </div>
                    <div>
                      <label style={S.label}>Username</label>
                      <input style={S.input} value={username} onChange={e => setUsername(e.target.value)}
                        placeholder="your HPC username" />
                    </div>
                    <div style={{ background: "#f9f8f4", border: "1px solid var(--border)", borderRadius: 10, padding: "0.8rem 1rem" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>Authentication — use one of:</p>
                      <div>
                        <label style={S.label}>SSH key path (recommended)</label>
                        <input style={S.input} value={keyPath} onChange={e => setKeyPath(e.target.value)}
                          placeholder="~/.ssh/id_rsa  (leave blank to use password)" />
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <label style={S.label}>Password (if no key)</label>
                        <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label style={S.label}>Remote data folder</label>
                      <input style={S.input} value={remotePath} onChange={e => setRemotePath(e.target.value)}
                        placeholder="~ or /scratch/your-username/data" />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--dim)", background: "#f0f8ff",
                      border: "1px solid #d0e8ff", borderRadius: 8, padding: "0.5rem 0.8rem" }}>
                      Same connection details you use in VS Code Remote SSH. VPN must be active if your institution requires it.
                    </div>
                  </>
                )}

                {/* ── Public accession ── */}
                {source === "public" && (
                  <div>
                    <label style={S.label}>Accession ID</label>
                    <input style={S.input} value={accessionId} onChange={e => setAccessionId(e.target.value)}
                      placeholder="GSE123456  or  SRR7890123  or  TCGA-BRCA  or  E-MTAB-1234" />
                    <p style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
                      Supported: GEO (GSE/GSM), SRA (SRR/SRP), TCGA, ArrayExpress (E-XXXX), ENA, BioProject
                    </p>
                  </div>
                )}

                {/* ── S3 ── */}
                {source === "s3" && (
                  <>
                    <div>
                      <label style={S.label}>S3 bucket name</label>
                      <input style={S.input} value={bucketName} onChange={e => setBucketName(e.target.value)}
                        placeholder="my-genomics-bucket" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={S.label}>Access Key ID</label>
                        <input style={S.input} value={apiKey} onChange={e => setApiKey(e.target.value)} />
                      </div>
                      <div>
                        <label style={S.label}>Secret Access Key</label>
                        <input style={S.input} type="password" value={secret} onChange={e => setSecret(e.target.value)} />
                      </div>
                    </div>
                  </>
                )}

                {/* ── Google Cloud Storage ── */}
                {source === "gcs" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label style={S.label}>GCS bucket name</label>
                      <input style={S.input} value={gcsBucket} onChange={e => setGcsBucket(e.target.value)}
                        placeholder="my-genomics-bucket  (without gs://)" />
                      <p style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
                        The part after <code>gs://</code> in your bucket URL
                      </p>
                    </div>
                    <div style={{ textAlign: "center", padding: "1.2rem",
                      background: "#fffbf0", border: "1px solid #fde68a", borderRadius: 12 }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🟡</div>
                      <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 4, fontWeight: 600 }}>
                        Sign in with your Gmail / Google Workspace account
                      </p>
                      <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
                        Works with personal Gmail and institutional Google accounts (e.g. MIT Google Workspace).
                        Read-only access to the bucket above.
                      </p>
                      <button style={{ ...S.btnPrimary }}
                        onClick={() => {
                          if (gcsBucket) sessionStorage.setItem("gcs_bucket", gcsBucket);
                          window.location.href = `${BASE}/api/connectors/oauth/gcs/start?redirect_uri=${encodeURIComponent(window.location.href.split("?")[0])}`;
                        }}>
                        Sign in with Google →
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Globus ── */}
                {source === "globus" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label style={S.label}>Globus endpoint UUID or display name (optional)</label>
                      <input style={S.input} value={globusEndpoint} onChange={e => setGlobusEndpoint(e.target.value)}
                        placeholder="e.g.  mit#tier1-xfer  or  a UUID" />
                      <p style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
                        Leave blank to browse your endpoints after connecting
                      </p>
                    </div>
                    <div style={{ textAlign: "center", padding: "1.2rem",
                      background: "#f0f8ff", border: "1px solid #bcd8f5", borderRadius: 12 }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🔗</div>
                      <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 4, fontWeight: 600 }}>
                        Sign in with Globus
                      </p>
                      <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
                        Choose "MIT Touchstone" or your institution from the identity provider list.
                        You can also log in with Google (Gmail) if your Globus account is linked to it.
                        Access to NCBI, Broad, and TCGA endpoints is included.
                      </p>
                      <button style={{ ...S.btnPrimary }}
                        onClick={() => {
                          if (globusEndpoint) sessionStorage.setItem("globus_endpoint", globusEndpoint);
                          window.location.href = `${BASE}/api/connectors/oauth/globus/start?redirect_uri=${encodeURIComponent(window.location.href.split("?")[0])}`;
                        }}>
                        Sign in with Globus →
                      </button>
                    </div>
                  </div>
                )}

                {/* ── OAuth providers (Google Drive, Dropbox, OneDrive) ── */}
                {["gdrive", "dropbox", "onedrive"].includes(source || "") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ textAlign: "center", padding: "1.2rem",
                      background: "#f0f4ff", border: "1px solid #c0d0f0", borderRadius: 12 }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>{selectedSource!.icon}</div>
                      <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 12, fontWeight: 600 }}>
                        Sign in with {selectedSource!.label}
                      </p>
                      <button style={{ ...S.btnPrimary }}
                        onClick={() => {
                          window.location.href = `${BASE}/api/connectors/oauth/${source}/start?redirect_uri=${encodeURIComponent(window.location.href.split("?")[0])}`;
                        }}>
                        Sign in with {selectedSource!.label} →
                      </button>
                      <p style={{ fontSize: 11, color: "var(--dim)", marginTop: 8 }}>
                        Read-only access · we never see your login credentials
                      </p>
                    </div>

                    <details style={{ borderRadius: 10, border: "1px solid var(--border)" }}>
                      <summary style={{ padding: "0.75rem 1rem", fontSize: 12, color: "var(--muted)", cursor: "pointer", fontWeight: 600 }}>
                        Or use a personal access token instead
                      </summary>
                      <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
                        <p style={{ fontSize: 11, color: "var(--dim)", lineHeight: 1.5 }}>
                          {source === "gdrive" && (
                            <>Go to <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer"
                              style={{ color: "var(--flame)" }}>OAuth 2.0 Playground</a> → select "Drive API v3 → drive.readonly"
                              → click "Authorize APIs" → Exchange code → copy the Access token.</>
                          )}
                          {source === "dropbox" && (
                            <>Go to <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noreferrer"
                              style={{ color: "var(--flame)" }}>Dropbox App Console</a> → create an app → Settings → generate an access token.</>
                          )}
                          {source === "onedrive" && (
                            <>Go to <a href="https://developer.microsoft.com/en-us/graph/graph-explorer" target="_blank" rel="noreferrer"
                              style={{ color: "var(--flame)" }}>Microsoft Graph Explorer</a> → sign in → copy the Access token from the header.</>
                          )}
                        </p>
                        <label style={S.label}>Paste your access token</label>
                        <input style={S.input} type="password" value={oauthToken}
                          onChange={e => setOauthToken(e.target.value)} placeholder="ya29.a0..." />
                        <button onClick={handleOAuthToken} disabled={!oauthToken.trim() || loading}
                          style={{ ...S.btnPrimary, opacity: !oauthToken.trim() ? 0.5 : 1, alignSelf: "flex-start" }}>
                          {loading ? "Connecting..." : "Connect →"}
                        </button>
                      </div>
                    </details>
                  </div>
                )}
              </div>

              {/* Test & Connect button (non-OAuth) */}
              {!isOAuth && (
                <button onClick={handleTest} disabled={loading}
                  style={{ ...S.btnPrimary, marginTop: 20, opacity: loading ? 0.5 : 1 }}>
                  {loading ? "Testing connection..." : "Test & Connect →"}
                </button>
              )}

              {testResult && (
                <div style={{
                  marginTop: 12, padding: "0.8rem 1rem", borderRadius: 10, fontSize: 13,
                  background: testResult.ok ? "#f0fff4" : "#fff0f0",
                  border: `1px solid ${testResult.ok ? "#b2f5c8" : "#fcc"}`,
                  color: testResult.ok ? "#2a7d4f" : "#c00",
                }}>
                  {testResult.ok ? "✅" : "❌"} {testResult.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Scan ────────────────────────────────────────────────── */}
        {step === "scan" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Scan trigger */}
            {!scanResult && (
              <div style={{ ...S.card, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                  Connected! Scan for your data
                </h2>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
                  We'll look at file names and sizes only — no data is read or uploaded.
                </p>
                <button onClick={handleScan} disabled={loading}
                  style={{ ...S.btnPrimary, opacity: loading ? 0.5 : 1 }}>
                  {loading ? "Scanning files..." : "Scan for Genomic Files →"}
                </button>
              </div>
            )}

            {/* Scan results */}
            {scanResult && (
              <>
                <div style={S.card}>
                  <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
                    <span>📂 {scanResult.total_files_scanned} files scanned</span>
                    <span>💾 {scanResult.total_size_gb} GB total</span>
                  </div>

                  {/* No genomic files */}
                  {!hasGenomicFiles ? (
                    <div style={{ background: "#fff8e6", border: "1px solid #f5c842",
                      borderRadius: 10, padding: "1rem 1.2rem" }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#9a6e00", marginBottom: 6 }}>
                        ⚠ No genomic files found in this folder
                      </p>
                      <p style={{ fontSize: 12, color: "#7a5800", marginBottom: 12 }}>
                        We found {scanResult.total_files_scanned} file(s) but none are genomic data
                        (FASTQ, BAM, VCF, FCS, etc.). Make sure you pointed to the folder that
                        contains your actual sequencing or flow cytometry files, not a project root
                        with PDFs or documents.
                      </p>
                      {source === "local" && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input style={{ ...S.input, flex: 1 }} value={folderPath}
                            onChange={e => setFolderPath(e.target.value)}
                            placeholder="/path/to/your/fastq/files" />
                          <button onClick={async () => {
                            setScanResult(null);
                            // Re-create connector with new path
                            const cr = await fetch(`${BASE}/api/connectors/create`, {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ type: "local", name: name || "My Data", folder_path: folderPath }),
                            });
                            const conn = await cr.json();
                            setConnectorId(conn.id);
                          }} style={S.btnPrimary}>Try again</button>
                        </div>
                      )}
                      {source !== "local" && (
                        <button onClick={() => { setScanResult(null); setStep("connect"); }}
                          style={S.btnSecondary}>
                          ← Change connection
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>
                        Genomic files detected
                      </h3>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px,1fr))", gap: 8, marginBottom: 16 }}>
                        {scanResult.detected_types.filter((d: any) => GENOMIC_TYPES.has(d.type)).map((dt: any) => (
                          <div key={dt.type} style={{ background: "var(--canvas)", border: "1px solid var(--border)",
                            borderRadius: 10, padding: "0.8rem", textAlign: "center" }}>
                            <div style={{ fontSize: 22, marginBottom: 4 }}>{FILETYPE_ICONS[dt.type] || "📁"}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{dt.type}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>{dt.count} file{dt.count !== 1 ? "s" : ""}</div>
                          </div>
                        ))}
                      </div>

                      {scanResult.suggested_analysis && (
                        <div style={{ background: "#edf4fb", border: "1px solid #c8dfe8",
                          borderRadius: 8, padding: "0.6rem 0.9rem", fontSize: 12, color: "var(--amber)", marginBottom: 14 }}>
                          Detected pipeline: <strong style={{ color: "var(--flame)" }}>{scanResult.suggested_analysis}</strong>
                        </div>
                      )}

                      {scanResult.note && (
                        <div style={{ background: "#fffbf0", border: "1px solid #f5e0a0",
                          borderRadius: 8, padding: "0.6rem 0.9rem", fontSize: 12, color: "var(--amber)" }}>
                          ℹ {scanResult.note}
                        </div>
                      )}

                      {/* Privacy confirmation inline */}
                      <div style={{ marginTop: 16, display: "flex", alignItems: "flex-start", gap: 10,
                        background: "#edf4fb", border: "1px solid #c8dfe8", borderRadius: 10, padding: "0.8rem 1rem" }}>
                        <input type="checkbox" id="phi" checked={phiConfirmed}
                          onChange={e => setPhiConfirmed(e.target.checked)}
                          style={{ marginTop: 3, accentColor: "var(--flame)", width: 16, height: 16, cursor: "pointer" }} />
                        <label htmlFor="phi" style={{ fontSize: 12, color: "var(--text)", cursor: "pointer", lineHeight: 1.5 }}>
                          I confirm I have appropriate institutional access and ethics approval to analyze this data,
                          and understand it stays on my machine / in its current location.
                        </label>
                      </div>

                      <button onClick={handleCreate} disabled={!phiConfirmed || loading}
                        style={{ ...S.btnPrimary, marginTop: 14, opacity: (!phiConfirmed || loading) ? 0.5 : 1 }}>
                        {loading ? "Saving..." : "Connect & Go to Analysis →"}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 4: Done ────────────────────────────────────────────────── */}
        {step === "done" && dataset && (
          <div style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
              Data connected!
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted)", maxWidth: 360, margin: "0 auto 20px" }}>
              <strong style={{ color: "var(--text)" }}>{dataset.name}</strong> is ready.
              {dataset.total_files > 0 && ` Found ${dataset.total_files} genomic files.`}
            </p>

            {dataset.suggested_analysis && (
              <div style={{ background: "#edf4fb", border: "1px solid #c8dfe8", borderRadius: 10,
                padding: "0.8rem 1rem", display: "inline-block", marginBottom: 24 }}>
                <p style={{ fontSize: 11, color: "var(--amber)", marginBottom: 2 }}>Detected pipeline</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: "var(--flame)" }}>{dataset.suggested_analysis}</p>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              <a href={`/wizard?analysis=${dataset.suggested_analysis || "rnaseq"}`}
                style={{ ...S.btnPrimary, textDecoration: "none" }}>
                Start Analysis →
              </a>
              <a href="/tools"
                style={{ ...S.btnSecondary, textDecoration: "none" }}>
                Browse all tools
              </a>
              <a href="/dashboard"
                style={{ ...S.btnSecondary, textDecoration: "none" }}>
                Dashboard
              </a>
            </div>

            <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
              <button onClick={() => { setStep("source"); setSource(null); setConnectorId(null); setScanResult(null); setDataset(null); setPhiConfirmed(false); }}
                style={{ fontSize: 12, color: "var(--dim)", background: "none", border: "none", cursor: "pointer" }}>
                + Connect another data source
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
