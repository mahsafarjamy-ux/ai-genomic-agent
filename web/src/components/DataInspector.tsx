"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  articleId: string | null;
  selectedAnalysis?: any;
  onComplete: () => void;
}

export default function DataInspector({ articleId, selectedAnalysis, onComplete }: Props) {
  const [dataDir, setDataDir] = useState("");
  const [report, setReport]   = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleInspect() {
    if (!dataDir.trim() || !articleId) return;
    setLoading(true); setError(null);
    try {
      const result = await api.inspectData(articleId, dataDir.trim());
      setReport(result);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-1" style={{ color: "var(--text)" }}>Check Your Data</h2>
        {selectedAnalysis && (
          <p className="text-sm font-medium mb-0.5" style={{ color: "var(--flame)" }}>
            For: {selectedAnalysis.name}
          </p>
        )}
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Point to your data folder. Only file names and sizes are read — content is never accessed.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block text-sm" style={{ color: "var(--muted)" }}>
          Path to your data directory
        </label>
        <div className="flex gap-2">
          <input type="text" value={dataDir} onChange={(e) => setDataDir(e.target.value)}
            placeholder="/Users/you/data/patient_cohort/"
            className="flex-1 rounded-lg px-4 py-3 text-sm focus:outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
          <button onClick={handleInspect} disabled={loading || !dataDir.trim()}
            className="px-6 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
            style={{ background: "var(--flame)", color: "#fff" }}>
            {loading ? "Scanning..." : "Inspect"}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2"
          style={{ background: "#f0f4ff", border: "1px solid #d0dcff", color: "#3355cc" }}>
          🔒 Privacy: reads file names and sizes only. No genomic data is read, moved, or uploaded.
        </div>
      </div>

      {error && (
        <div className="rounded-lg p-4 text-sm"
          style={{ background: "#fff0f0", border: "1px solid #f5b0b0", color: "#c0392b" }}>
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-5">
          {/* Status banner */}
          <div className="flex items-center gap-3 p-4 rounded-xl"
            style={
              report.ready_to_run
                ? { background: "#f0fff4", border: "1px solid #a0d8b0" }
                : { background: "#fff0f0", border: "1px solid #f5b0b0" }
            }>
            <span className="text-2xl">{report.ready_to_run ? "✅" : "❌"}</span>
            <div>
              <p className="font-medium text-sm" style={{ color: "var(--text)" }}>
                {report.ready_to_run ? "Ready to run" : "Missing required files"}
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {report.files_found} files found · {report.samples_detected?.length || 0} samples detected
              </p>
            </div>
          </div>

          {/* Samples */}
          {report.samples_detected?.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <h3 className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>DETECTED SAMPLES</h3>
              <div className="flex flex-wrap gap-2">
                {report.samples_detected.map((s: string) => (
                  <span key={s} className="text-xs px-2 py-1 rounded"
                    style={{ background: "#f0f4ff", color: "#3355cc", border: "1px solid #d0dcff" }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Satisfied requirements */}
          {report.satisfied_requirements?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>FOUND</h3>
              {report.satisfied_requirements.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2"
                  style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--flame)" }}>✓</span>
                  <span className="text-sm" style={{ color: "var(--text)" }}>{r.name}</span>
                  <span className="text-xs ml-auto" style={{ color: "var(--dim)" }}>{r.found?.length} file(s)</span>
                </div>
              ))}
            </div>
          )}

          {/* Missing requirements */}
          {report.missing_requirements?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold mb-2" style={{ color: "#c0392b" }}>MISSING</h3>
              {report.missing_requirements.map((r: any, i: number) => (
                <div key={i} className="flex items-start gap-3 py-2"
                  style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-sm" style={{ color: "#c0392b" }}>✗</span>
                  <div>
                    <p className="text-sm" style={{ color: "var(--text)" }}>{r.name}</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>{r.description}</p>
                    {r.note && <p className="text-xs" style={{ color: "var(--amber)" }}>{r.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {report.warnings?.length > 0 && (
            <div className="rounded-xl p-4 space-y-1"
              style={{ background: "#fffbf0", border: "1px solid #f5e0a0" }}>
              {report.warnings.map((w: string, i: number) => (
                <p key={i} className="text-xs" style={{ color: "var(--amber)" }}>⚠ {w}</p>
              ))}
            </div>
          )}

          {/* Suggested structure */}
          {report.suggested_folder_structure?.recommended_layout && (
            <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <h3 className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>RECOMMENDED FOLDER STRUCTURE</h3>
              <pre className="text-xs overflow-x-auto" style={{ color: "var(--muted)" }}>
                {JSON.stringify(report.suggested_folder_structure.recommended_layout, null, 2)}
              </pre>
            </div>
          )}

          {report.ready_to_run && (
            <button onClick={onComplete}
              className="px-6 py-3 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "var(--flame)", color: "#fff" }}>
              Ready — Launch Pipeline →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
