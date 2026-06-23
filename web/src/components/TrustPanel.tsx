"use client";

/* ── Types ─────────────────────────────────────────────────────────────── */
export interface ProvenanceData {
  pipelineName: string;
  toolVersion?: string;
  inputFile?: string;
  runDate: string;
  parameters?: Record<string, string>;
  referenceDb?: string;
  sampleId?: string;
  status: "complete" | "running" | "failed" | "warning";
  analysisMode?: string;
}

export interface QCCheck {
  name: string;
  status: "pass" | "warn" | "fail" | "pending";
  value?: string;
  detail?: string;
}

export interface EvidenceFinding {
  finding: string;
  supportingData: string;
  confidence: "high" | "moderate" | "low" | "speculative";
  source: string;
  isSpeculative?: boolean;
}

export interface TrustPanelProps {
  provenance: ProvenanceData;
  qcChecks: QCCheck[];
  findings: EvidenceFinding[];
  warnings?: string[];
  outputFiles?: string[];
  interpretationNotes?: string[];
  pipelineSteps?: string[];
}

/* ── Badge helpers ─────────────────────────────────────────────────────── */
const STATUS_STYLE: Record<string, { bg: string; color: string; label: string; dot: string }> = {
  pass:    { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e", label: "PASS" },
  warn:    { bg: "#fffbeb", color: "#92400e", dot: "#f59e0b", label: "WARN" },
  fail:    { bg: "#fff1f2", color: "#b91c1c", dot: "#ef4444", label: "FAIL" },
  pending: { bg: "#f8fafc", color: "#64748b", dot: "#94a3b8", label: "—"   },
};

const CONF_STYLE: Record<string, { bg: string; color: string }> = {
  high:        { bg: "#f0fdf4", color: "#15803d" },
  moderate:    { bg: "#fffbeb", color: "#92400e" },
  low:         { bg: "#fff1f2", color: "#b91c1c" },
  speculative: { bg: "#f5f3ff", color: "#6d28d9" },
};

const PROV_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  complete: { bg: "#f0fdf4", color: "#15803d", label: "✓ Complete" },
  running:  { bg: "#eff6ff", color: "#1d4ed8", label: "⟳ Running"  },
  failed:   { bg: "#fff1f2", color: "#b91c1c", label: "✗ Failed"   },
  warning:  { bg: "#fffbeb", color: "#92400e", label: "⚠ Warning"  },
};

function Badge({ s, text }: { s: typeof STATUS_STYLE[string]; text?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.color }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block", flexShrink: 0 }} />
      {text ?? s.label}
    </span>
  );
}

/* ── Download helper ───────────────────────────────────────────────────── */
function downloadReport(props: TrustPanelProps) {
  const report = {
    generated: new Date().toISOString(),
    disclaimer: "Research use only. AI interpretation requires validation by expert bioinformaticians.",
    provenance: props.provenance,
    qcResults: props.qcChecks,
    pipelineSteps: props.pipelineSteps ?? [],
    outputFiles: props.outputFiles ?? [],
    warnings: props.warnings ?? [],
    findings: props.findings.map(f => ({ ...f, note: f.isSpeculative ? "Speculative — requires experimental validation" : undefined })),
    interpretationNotes: props.interpretationNotes ?? [],
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `genomics-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Main component ────────────────────────────────────────────────────── */
export default function TrustPanel(props: TrustPanelProps) {
  const { provenance, qcChecks, findings, warnings = [], outputFiles = [], interpretationNotes = [], pipelineSteps = [] } = props;
  const provSt = PROV_STATUS[provenance.status];

  const card: React.CSSProperties = { borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "16px 18px", marginBottom: 12 };
  const sectionLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 };
  const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 11, background: "var(--canvas)", padding: "2px 7px", borderRadius: 4, border: "1px solid var(--border)", color: "var(--text)" };

  return (
    <div style={{ marginTop: 20 }}>

      {/* ── AI Safety Label (always top) ─────────────────────────────── */}
      <div style={{
        padding: "10px 14px", borderRadius: 10, marginBottom: 16,
        background: "#fffbeb", border: "1px solid #fde68a",
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠️</span>
        <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
          <strong>Research support only.</strong> AI interpretation identifies candidate findings based on available uploaded data.
          All results require validation with validated bioinformatics workflows and expert review before any scientific or clinical use.
          Confidence levels are estimates — not statistical guarantees.
        </div>
      </div>

      {/* ── Top summary cards ─────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { icon: "🔬", label: "Pipeline", value: provenance.pipelineName, sub: provenance.analysisMode ?? "" },
          { icon: "📅", label: "Run date",  value: new Date(provenance.runDate).toLocaleDateString(), sub: new Date(provenance.runDate).toLocaleTimeString() },
          { icon: "📁", label: "Input",     value: provenance.inputFile ?? "Pasted text", sub: provenance.sampleId ? `Sample: ${provenance.sampleId}` : "" },
          { icon: "🗄️", label: "Reference", value: provenance.referenceDb ?? "Auto-detected", sub: "" },
        ].map(({ icon, label, value, sub }) => (
          <div key={label} style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "12px 14px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 6 }}>{icon} {label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>{value}</div>
            {sub && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
          </div>
        ))}
        <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "12px 14px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 6 }}>⚡ Status</div>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: provSt.bg, color: provSt.color }}>{provSt.label}</span>
          </div>
          {provenance.toolVersion && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>v{provenance.toolVersion}</div>}
        </div>
      </div>

      {/* ── QC Panel ──────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ ...sectionLabel, color: "#15803d" }}>🧪 Quality Control Checks</div>
        {qcChecks.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>No QC data available for this analysis.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
            {qcChecks.map((q, i) => {
              const s = STATUS_STYLE[q.status];
              return (
                <div key={i} style={{ borderRadius: 10, border: `1px solid ${s.dot}33`, background: s.bg, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{q.name}</span>
                    <Badge s={s} />
                  </div>
                  {q.value && <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{q.value}</div>}
                  {q.detail && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }}>{q.detail}</div>}
                </div>
              );
            })}
          </div>
        )}
        {warnings.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            {warnings.map((w, i) => (
              <div key={i} style={{ fontSize: 11, color: "#92400e", padding: "6px 10px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", display: "flex", gap: 6 }}>
                <span style={{ flexShrink: 0 }}>⚠</span>{w}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Evidence Table ────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ ...sectionLabel, color: "var(--flame)" }}>📋 Evidence & Interpretation Table</div>
        <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
          Each finding below is a candidate result based on pattern recognition. Confidence reflects signal strength — not clinical certainty.
        </p>
        {findings.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>No structured findings extracted.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "var(--canvas)" }}>
                  {["Finding", "Supporting data", "Confidence", "Source / file", ""].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {findings.map((f, i) => {
                  const cs = CONF_STYLE[f.confidence];
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "9px 10px", fontWeight: 600, color: "var(--text)", maxWidth: 180 }}>{f.finding}</td>
                      <td style={{ padding: "9px 10px", color: "var(--muted)", maxWidth: 220, lineHeight: 1.4 }}>{f.supportingData}</td>
                      <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: cs.bg, color: cs.color }}>
                          {f.confidence.charAt(0).toUpperCase() + f.confidence.slice(1)}
                        </span>
                      </td>
                      <td style={{ padding: "9px 10px", ...mono, border: "none", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.source}</td>
                      <td style={{ padding: "9px 6px" }}>
                        {f.isSpeculative && (
                          <span title="Speculative — requires validation" style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 6, background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ddd6fe", whiteSpace: "nowrap" }}>
                            ⚠ Speculative
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Provenance Details ────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ ...sectionLabel, color: "#7c3aed" }}>🔍 Analysis Provenance</div>
        <div style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "6px 16px", fontSize: 11, alignItems: "start" }}>
          {[
            ["Pipeline",    provenance.pipelineName],
            ["Tool version", provenance.toolVersion ?? "not recorded"],
            ["Analysis mode", provenance.analysisMode ?? "standard"],
            ["Input file",  provenance.inputFile ?? "pasted text"],
            ["Sample ID",   provenance.sampleId   ?? "not specified"],
            ["Reference DB", provenance.referenceDb ?? "auto-detected"],
            ["Run timestamp", provenance.runDate],
            ["Status",      provSt.label],
          ].map(([k, v]) => (
            [
              <span key={`k-${k}`} style={{ color: "var(--muted)", fontWeight: 600, whiteSpace: "nowrap" }}>{k}</span>,
              <span key={`v-${k}`} style={{ ...mono }}>{v}</span>
            ]
          )).flat()}
        </div>

        {provenance.parameters && Object.keys(provenance.parameters).length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 8 }}>Parameters used</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {Object.entries(provenance.parameters).map(([k, v]) => (
                <span key={k} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "monospace" }}>
                  {k}={v}
                </span>
              ))}
            </div>
          </div>
        )}

        {pipelineSteps.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 8 }}>Pipeline steps</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {pipelineSteps.map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, color: "var(--text)" }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--canvas)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, flexShrink: 0, color: "var(--muted)" }}>{i + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Reproducibility Report ────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, background: "var(--canvas)", border: "1px solid var(--border)", marginBottom: 4 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>📄 Reproducibility Report</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Download a full JSON report with all provenance, QC results, parameters, and findings — for sharing with collaborators or attaching to publications.</div>
        </div>
        <button onClick={() => downloadReport(props)}
          style={{ padding: "9px 18px", borderRadius: 10, background: "var(--flame)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", boxShadow: "0 3px 10px rgba(240,88,8,0.25)", flexShrink: 0 }}>
          ⬇ Download JSON
        </button>
      </div>

      {interpretationNotes.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "var(--canvas)", borderLeft: "3px solid var(--muted)" }}>
          <strong>Interpretation notes:</strong> {interpretationNotes.join(" · ")}
        </div>
      )}

    </div>
  );
}
