"use client";

import { useState } from "react";
import NavBar from "@/components/NavBar";
import { useAuth } from "@/hooks/useAuth";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const OMICS_LAYERS = [
  { id: "rna",         icon: "🧬", label: "RNA-seq",           desc: "Gene expression matrix" },
  { id: "atac",        icon: "🌊", label: "ATAC-seq",          desc: "Chromatin accessibility" },
  { id: "methylation", icon: "🧪", label: "Methylation",       desc: "WGBS / RRBS / EPIC array" },
  { id: "proteomics",  icon: "🔩", label: "Proteomics",        desc: "Mass spec protein quant" },
  { id: "microbiome",  icon: "🦠", label: "Microbiome",        desc: "16S / shotgun abundance" },
  { id: "chipseq",     icon: "📍", label: "ChIP-seq / Cut&Tag", desc: "Histone mark profiles" },
  { id: "scrnaseq",    icon: "🔵", label: "scRNA-seq",         desc: "Single-cell transcriptome" },
  { id: "metabolomics",icon: "⚗️", label: "Metabolomics",      desc: "GC-MS / LC-MS peaks" },
];

const INTEGRATION_METHODS = [
  { id: "mofa",   label: "MOFA+",          tag: "Unsupervised",  best: "Discovery — no outcome needed", min_layers: 2 },
  { id: "diablo", label: "DIABLO",         tag: "Supervised",    best: "Predicting groups or outcomes",  min_layers: 2 },
  { id: "wgcna",  label: "WGCNA",          tag: "Co-expression", best: "Gene modules across omics",      min_layers: 1 },
  { id: "infer",  label: "Let AI decide",     tag: "AI",         best: "Best method for your data",      min_layers: 2 },
];

const PRIVACY_ITEMS = [
  "Your data files are never uploaded — only matrix shapes and column names are read",
  "Only statistical summaries and article text are processed remotely, not patient values",
  "All computation runs on your local machine or HPC cluster",
  "No data is cached, logged, or sent to any database by this platform",
];

export default function MultiOmicsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [selected, setSelected]     = useState<string[]>([]);
  const [method, setMethod]         = useState("infer");
  const [disease, setDisease]       = useState("");
  const [tissue, setTissue]         = useState("");
  const [nFactors, setNFactors]     = useState(10);
  const [loading, setLoading]       = useState(false);
  const [strategy, setStrategy]     = useState<any>(null);
  const [error, setError]           = useState<string | null>(null);

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function getStrategy() {
    if (selected.length < 2) return;
    setLoading(true); setError(null); setStrategy(null);
    try {
      const res = await fetch(`${BASE}/api/discovery/multi-omics-strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ omics_layers: selected, disease: disease || "unknown disease" }),
      });
      setStrategy(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function launchPipeline() {
    const res = await fetch(`${BASE}/api/jobs/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pipeline_id: "multiomics",
        config: {
          omics_layers: selected,
          integration_method: method,
          disease,
          tissue,
          n_mofa_factors: nFactors,
        },
      }),
    });
    const job = await res.json();
    if (job.job_id) window.location.href = `/dashboard`;
  }

  return authLoading || !user ? null : (
    <div className="min-h-screen" style={{ background: "var(--canvas)", color: "var(--text)" }}>
      <NavBar active="/multiomics" user={user} onSignOut={signOut} />

      <div className="max-w-4xl mx-auto px-8 py-10 space-y-10">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text)" }}>Multi-omics Integration</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Fuse RNA-seq, ATAC-seq, methylation, proteomics and more. MOFA+ for discovery,
            DIABLO for group prediction, WGCNA for co-expression networks.
          </p>
        </div>

        {/* Privacy banner */}
        <div className="rounded-2xl p-5" style={{ background: "#f0f4ff", border: "1px solid #d0dcff" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold" style={{ color: "#3355cc" }}>🔒 Privacy guarantee</span>
          </div>
          <ul className="space-y-1.5">
            {PRIVACY_ITEMS.map(item => (
              <li key={item} className="text-xs flex items-start gap-2" style={{ color: "var(--muted)" }}>
                <span className="mt-0.5 shrink-0" style={{ color: "var(--flame)" }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Step 1: Choose omics layers */}
        <div>
          <h2 className="font-semibold mb-1" style={{ color: "var(--text)" }}>1. Which omics layers do you have?</h2>
          <p className="text-xs mb-5" style={{ color: "var(--muted)" }}>Select at least two for integration.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {OMICS_LAYERS.map(o => (
              <button key={o.id} onClick={() => toggle(o.id)}
                className="flex flex-col items-center gap-1.5 p-4 rounded-2xl text-center transition-all"
                style={
                  selected.includes(o.id)
                    ? { border: "1px solid var(--flame)", background: "#fff8f3", color: "var(--flame)" }
                    : { border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)" }
                }>
                <span className="text-2xl">{o.icon}</span>
                <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{o.label}</span>
                <span className="text-xs" style={{ color: "var(--dim)" }}>{o.desc}</span>
              </button>
            ))}
          </div>
          {selected.length > 0 && (
            <p className="text-xs mt-3" style={{ color: "var(--flame)" }}>
              Selected: {selected.map(id => OMICS_LAYERS.find(o => o.id === id)?.label).join(" + ")}
            </p>
          )}
        </div>

        {/* Step 2: Integration method */}
        <div>
          <h2 className="font-semibold mb-1" style={{ color: "var(--text)" }}>2. Integration method</h2>
          <p className="text-xs mb-5" style={{ color: "var(--muted)" }}>Not sure? Choose "Let AI decide" and describe your goal below.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {INTEGRATION_METHODS.map(m => (
              <button key={m.id} onClick={() => setMethod(m.id)}
                className="text-left p-4 rounded-xl transition-all"
                style={
                  method === m.id
                    ? { border: "1px solid var(--flame)", background: "#fff8f3" }
                    : { border: "1px solid var(--border)", background: "var(--surface)" }
                }>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{m.label}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#f3f0e8", color: "var(--muted)" }}>{m.tag}</span>
                </div>
                <p className="text-xs" style={{ color: "var(--muted)" }}>{m.best}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: Context */}
        <div>
          <h2 className="font-semibold mb-5" style={{ color: "var(--text)" }}>3. Study context</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--muted)" }}>Disease / phenotype</label>
              <input value={disease} onChange={e => setDisease(e.target.value)}
                placeholder="e.g. breast cancer, IBD"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--muted)" }}>Tissue (optional)</label>
              <input value={tissue} onChange={e => setTissue(e.target.value)}
                placeholder="e.g. lung, blood, colon"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--muted)" }}>MOFA+ factors (default 10)</label>
              <input type="number" value={nFactors} onChange={e => setNFactors(+e.target.value)} min={2} max={50}
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={getStrategy} disabled={loading || selected.length < 2}
            className="px-6 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
            {loading ? "Analyzing..." : "Get Integration Strategy"}
          </button>
          <button onClick={launchPipeline} disabled={selected.length < 2}
            className="px-6 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
            style={{ background: "var(--flame)", color: "#fff" }}>
            Launch MOFA+ Pipeline →
          </button>
        </div>

        {error && (
          <div className="rounded-xl p-4 text-sm" style={{ background: "#fff0f0", border: "1px solid #f5c0c0", color: "#c0392b" }}>{error}</div>
        )}

        {/* Strategy output */}
        {strategy && (
          <div className="space-y-5 pt-8" style={{ borderTop: "1px solid var(--border)" }}>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Integration Strategy</h2>

            {strategy.executive_summary && (
              <div className="rounded-xl p-4" style={{ background: "#f0f4ff", border: "1px solid #d0dcff" }}>
                <p className="text-sm" style={{ color: "var(--text)" }}>{strategy.executive_summary}</p>
              </div>
            )}

            {strategy.suggested_experiments?.map((exp: any, i: number) => (
              <div key={i} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{exp.title}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ background: "#f3f0e8", color: "var(--muted)" }}>{exp.analysis_type}</span>
                </div>
                {exp.tools?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {exp.tools.map((t: string) => (
                      <span key={t} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#fff8f3", color: "var(--flame)", border: "1px solid #ffd4bc" }}>{t}</span>
                    ))}
                  </div>
                )}
                {exp.expected_finding && (
                  <p className="text-xs" style={{ color: "var(--muted)" }}>{exp.expected_finding}</p>
                )}
              </div>
            ))}

            {strategy.recommended_tool_combinations?.map((combo: any, i: number) => (
              <div key={i} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex flex-wrap gap-1 mb-2">
                  {combo.tools?.map((t: string) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#f5f0ff", color: "#7c3aed" }}>{t}</span>
                  ))}
                </div>
                <p className="text-xs" style={{ color: "var(--muted)" }}>{combo.rationale}</p>
                {combo.novelty && <p className="text-xs mt-1" style={{ color: "var(--amber)" }}>✨ {combo.novelty}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
