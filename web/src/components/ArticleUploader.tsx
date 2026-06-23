"use client";

import { useState, useRef } from "react";
import { api } from "@/lib/api";

interface Props {
  onComplete: (articleId: string) => void;
}

const QUICK_TEMPLATES = [
  { label: "RNA-seq",    icon: "🧬", type: "rnaseq" },
  { label: "WGS",        icon: "🔬", type: "wgs" },
  { label: "WES",        icon: "🎯", type: "wes" },
  { label: "scRNA-seq",  icon: "🔵", type: "scrnaseq" },
  { label: "Methylation",icon: "🧪", type: "methylation" },
  { label: "ChIP-seq",   icon: "📍", type: "chipseq" },
  { label: "ATAC-seq",   icon: "🌊", type: "atacseq" },
];

export default function ArticleUploader({ onComplete }: Props) {
  const [mode, setMode]       = useState<"upload" | "path" | "template">("upload");
  const [localPath, setLocalPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setLoading(true); setError(null);
    setProgress("Uploading PDF...");
    try {
      const uploaded = await api.uploadArticle(file);
      setProgress("Reading the paper and detecting analyses...");
      const result: any = await api.ingestArticle(uploaded.uploaded_path);
      onComplete(result.article_id);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); setProgress(null); }
  }

  async function handlePath() {
    if (!localPath.trim()) return;
    setLoading(true); setError(null);
    setProgress("Reading PDF and extracting analyses...");
    try {
      const result: any = await api.ingestArticle(localPath.trim());
      onComplete(result.article_id);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); setProgress(null); }
  }

  async function handleTemplate(type: string) {
    setLoading(true); setError(null);
    setProgress("Loading built-in template...");
    try { onComplete(`template_${type}`); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); setProgress(null); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-1" style={{ color: "var(--text)" }}>Start Your Analysis</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Upload a paper to detect and replicate its pipeline, or pick a standard template.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 rounded-lg w-fit"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {([["upload", "Upload PDF"], ["path", "Local Path"], ["template", "Standard Template"]] as const).map(
          ([m, label]) => (
            <button key={m} onClick={() => setMode(m)}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all"
              style={
                mode === m
                  ? { background: "var(--flame)", color: "#fff" }
                  : { color: "var(--muted)" }
              }>
              {label}
            </button>
          )
        )}
      </div>

      {mode === "upload" && (
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          className="rounded-2xl p-12 text-center cursor-pointer transition-all"
          style={{
            border: `2px dashed ${dragging ? "var(--flame)" : "var(--border)"}`,
            background: dragging ? "#fff8f3" : "var(--surface)",
          }}>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
          <p className="text-5xl mb-3">📄</p>
          <p className="font-medium mb-1" style={{ color: "var(--text)" }}>
            Drop a paper PDF here or click to browse
          </p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            The platform will find all analyses in the paper including supplementary methods and GitHub repos
          </p>
        </div>
      )}

      {mode === "path" && (
        <div className="space-y-3">
          <label className="block text-sm" style={{ color: "var(--muted)" }}>
            Absolute path to PDF on your machine
          </label>
          <div className="flex gap-2">
            <input type="text" value={localPath} onChange={(e) => setLocalPath(e.target.value)}
              placeholder="/Users/you/papers/my_paper.pdf"
              className="flex-1 rounded-lg px-4 py-3 text-sm focus:outline-none"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
            <button onClick={handlePath} disabled={loading || !localPath.trim()}
              className="px-6 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
              style={{ background: "var(--flame)", color: "#fff" }}>
              Extract Pipeline
            </button>
          </div>
          <p className="text-xs" style={{ color: "var(--dim)" }}>
            Privacy: only the article text is processed remotely — never your genomic data.
          </p>
        </div>
      )}

      {mode === "template" && (
        <div>
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            Standard pipelines following nf-core best practices
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {QUICK_TEMPLATES.map((t) => (
              <button key={t.type} onClick={() => handleTemplate(t.type)} disabled={loading}
                className="flex flex-col items-center gap-2 p-5 rounded-xl transition-all disabled:opacity-40"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--flame)"; (e.currentTarget as HTMLElement).style.background = "#fff8f3"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "var(--surface)"; }}>
                <span className="text-3xl">{t.icon}</span>
                <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "var(--flame)", borderTopColor: "transparent" }} />
          <span className="text-sm" style={{ color: "var(--flame)" }}>{progress}</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg p-4 text-sm"
          style={{ background: "#fff0f0", border: "1px solid #f5b0b0", color: "#c0392b" }}>
          {error}
        </div>
      )}
    </div>
  );
}
