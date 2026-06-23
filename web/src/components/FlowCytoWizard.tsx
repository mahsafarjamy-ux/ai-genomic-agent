"use client";
import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import LocalFileBrowser from "@/components/LocalFileBrowser";

const Plot = dynamic(() => import("@/components/PlotlyChart"), { ssr: false });

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Types ───────────────────────────────────────────────────────────────────

type Channel = {
  pnn: string; pns: string; index: number;
  is_scatter: boolean; is_time: boolean;
};
type Meta = {
  event_count: number; channel_count: number; cytometer: string;
  acquisition_date: string; channels: Channel[];
};
type SavedGate = {
  gate_id: string; name: string; gate_type: string;
  count: number; percent_of_parent: number; percent_of_total: number;
};
type Pending =
  | { type: "rectangle"; x_min: number; x_max: number; y_min: number; y_max: number }
  | { type: "polygon"; vertices: [number, number][] };

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: "Load File", icon: "📁" },
  { num: 2, label: "Select Channels", icon: "🎚️" },
  { num: 3, label: "Set Transform", icon: "🔄" },
  { num: 4, label: "Gate & Analyze", icon: "⬜" },
  { num: 5, label: "Export Results", icon: "📊" },
];

const TRANSFORMS = [
  {
    value: "linear",
    label: "Linear",
    tag: "For scatter channels",
    desc: "No scaling. Best for FSC-A and SSC-A which measure cell size and granularity — these have meaningful zero points and don't need log scaling.",
  },
  {
    value: "logicle",
    label: "Logicle",
    tag: "Recommended",
    recommended: true,
    desc: "The gold standard for fluorescence channels. Handles negative values gracefully, spreads dim populations apart, and compresses bright ones. Choose this if you're unsure.",
  },
  {
    value: "biexponential",
    label: "Biexponential",
    tag: "Like logicle",
    desc: "Very similar to logicle. Useful when you want both positive and negative cell populations to be clearly visible side by side.",
  },
  {
    value: "arcsinh",
    label: "ArcSinh",
    tag: "CyTOF / spectral",
    desc: "Common in mass cytometry (CyTOF) and spectral flow data. Handles an extremely wide dynamic range without losing signal at either end.",
  },
  {
    value: "log10",
    label: "Log₁₀",
    tag: "Classic log",
    desc: "Traditional logarithmic scale. Simple and familiar, but cells with zero or negative fluorescence will be removed from the plot — only use if your data has no negatives.",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isScatter(ch: Channel) {
  return ch.is_scatter || /^(FSC|SSC)/i.test(ch.pnn);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FlowCytoWizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [projectName, setProjectName] = useState("My Project");
  const [sampleName, setSampleName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileMode, setFileMode] = useState<"upload" | "local">("upload");
  const [showBrowser, setShowBrowser] = useState(false);
  const [localPath, setLocalPath] = useState("");
  const [localName, setLocalName] = useState("");

  // Step 2+
  const [fileId, setFileId] = useState("");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [xChannel, setXChannel] = useState("");
  const [yChannel, setYChannel] = useState("");

  // Step 3
  const [transform, setTransform] = useState("logicle");

  // Step 4
  const [plotX, setPlotX] = useState<number[]>([]);
  const [plotY, setPlotY] = useState<number[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [pendingGate, setPendingGate] = useState<Pending | null>(null);
  const [gateName, setGateName] = useState("Gate 1");
  const [gates, setGates] = useState<SavedGate[]>([]);
  const [savingGate, setSavingGate] = useState(false);

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".fcs")) {
      setError("Please upload a .fcs file");
      return;
    }
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("project_name", projectName || "My Project");
    fd.append("sample_name", sampleName || file.name.replace(/\.fcs$/i, ""));
    try {
      const res = await fetch(`${BASE}/api/flow/upload`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Upload failed");
      }
      const data = await res.json();
      setFileId(data.file_id);
      setMeta(data.metadata);
      const chs: Channel[] = data.metadata.channels;
      // Auto-pick FSC-A / SSC-A as defaults
      const defaultX = chs.find(c => c.pnn.toUpperCase() === "FSC-A") ?? chs[0];
      const defaultY = chs.find(c => c.pnn.toUpperCase() === "SSC-A") ?? chs[1] ?? chs[0];
      setXChannel(defaultX?.pnn ?? "");
      setYChannel(defaultY?.pnn ?? "");
      setGates([]);
      setStep(2);
    } catch (e: any) {
      setError(e.message ?? "Upload failed");
    } finally {
      setLoading(false);
    }
  }, [projectName, sampleName]);

  // ── Register local path ─────────────────────────────────────────────────────

  const handleLocalPath = useCallback(async (path: string, name: string) => {
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("file_path", path);
    fd.append("project_name", projectName || "My Project");
    fd.append("sample_name", sampleName || name.replace(/\.fcs$/i, ""));
    try {
      const res = await fetch(`${BASE}/api/flow/register-path`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Registration failed");
      }
      const data = await res.json();
      setFileId(data.file_id);
      setMeta(data.metadata);
      const chs: Channel[] = data.metadata.channels;
      const defaultX = chs.find(c => c.pnn.toUpperCase() === "FSC-A") ?? chs[0];
      const defaultY = chs.find(c => c.pnn.toUpperCase() === "SSC-A") ?? chs[1] ?? chs[0];
      setXChannel(defaultX?.pnn ?? "");
      setYChannel(defaultY?.pnn ?? "");
      setGates([]);
      setStep(2);
    } catch (e: any) {
      setError(e.message ?? "Could not open file");
    } finally {
      setLoading(false);
    }
  }, [projectName, sampleName]);

  // ── Load plot ───────────────────────────────────────────────────────────────

  async function loadPlot() {
    if (!fileId || !xChannel || !yChannel) return;
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ x_channel: xChannel, y_channel: yChannel, transform, max_points: "8000" });
      const res = await fetch(`${BASE}/api/flow/files/${fileId}/events?${q}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPlotX(data.x);
      setPlotY(data.y);
      setTotalEvents(data.total_events);
      setPendingGate(null);
      setGateName(`Gate ${gates.length + 1}`);
      setStep(4);
    } catch (e: any) {
      setError(e.message ?? "Failed to load plot");
    } finally {
      setLoading(false);
    }
  }

  // ── Save gate ───────────────────────────────────────────────────────────────

  async function saveGate() {
    if (!pendingGate || !gateName.trim()) return;
    setSavingGate(true);
    setError("");
    try {
      const body = {
        name: gateName.trim(),
        gate_type: pendingGate.type,
        x_channel: xChannel,
        y_channel: yChannel,
        transform: { type: transform },
        definition:
          pendingGate.type === "rectangle"
            ? { x_min: pendingGate.x_min, x_max: pendingGate.x_max, y_min: pendingGate.y_min, y_max: pendingGate.y_max }
            : { vertices: pendingGate.vertices },
      };
      const res = await fetch(`${BASE}/api/flow/files/${fileId}/gates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const gate = await res.json();
      setGates(prev => [...prev, gate]);
      setPendingGate(null);
      setGateName(`Gate ${gates.length + 2}`);
    } catch (e: any) {
      setError(e.message ?? "Failed to save gate");
    } finally {
      setSavingGate(false);
    }
  }

  function handlePlotSelected(event: any) {
    if (!event) return;
    if (event.range) {
      const [x1, x2] = event.range.x;
      const [y1, y2] = event.range.y;
      setPendingGate({ type: "rectangle", x_min: Math.min(x1, x2), x_max: Math.max(x1, x2), y_min: Math.min(y1, y2), y_max: Math.max(y1, y2) });
    } else if (event.lassoPoints) {
      const verts: [number, number][] = event.lassoPoints.x.map((x: number, i: number) => [x, event.lassoPoints.y[i]]);
      setPendingGate({ type: "polygon", vertices: verts });
    }
  }

  function resetWizard() {
    setStep(1); setFileId(""); setMeta(null); setPlotX([]); setPlotY([]);
    setGates([]); setPendingGate(null); setError(""); setLoading(false);
    setTransform("logicle"); setSampleName("");
  }

  // ─── Shared styles ──────────────────────────────────────────────────────────

  const card = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
  } as const;

  const inputStyle = {
    background: "var(--canvas)", border: "1px solid var(--border)",
    color: "var(--text)", borderRadius: "8px", padding: "8px 12px", fontSize: "14px",
    width: "100%", outline: "none",
  } as const;

  const primaryBtn = {
    background: "var(--flame)", color: "#fff",
    borderRadius: "8px", padding: "9px 20px", fontSize: "14px", fontWeight: 600,
    border: "none", cursor: loading || savingGate ? "not-allowed" : "pointer",
    opacity: loading || savingGate ? 0.7 : 1,
  } as const;

  const ghostBtn = {
    background: "var(--surface)", border: "1px solid var(--border)",
    color: "var(--muted)", borderRadius: "8px", padding: "9px 16px", fontSize: "14px",
    cursor: "pointer",
  } as const;

  // ─── Step progress bar ──────────────────────────────────────────────────────

  function StepBar() {
    return (
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? "1" : "none" }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={step === s.num
                  ? { background: "var(--flame)", color: "#fff" }
                  : step > s.num
                    ? { background: "#10b981", color: "#fff" }
                    : { background: "var(--canvas)", color: "var(--dim)", border: "1px solid var(--border)" }}>
                {step > s.num ? "✓" : s.num}
              </div>
              <span className="text-xs whitespace-nowrap hidden sm:block"
                style={{ color: step === s.num ? "var(--text)" : "var(--dim)", fontWeight: step === s.num ? 600 : 400 }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-px mx-3" style={{ background: step > s.num ? "#10b981" : "var(--border)" }} />
            )}
          </div>
        ))}
      </div>
    );
  }

  // ─── Step 1: File source ────────────────────────────────────────────────────

  function Step1() {
    return (
      <>
        {showBrowser && (
          <LocalFileBrowser
            allowedExt=".fcs"
            onCancel={() => setShowBrowser(false)}
            onSelect={(path, name) => {
              setLocalPath(path);
              setLocalName(name);
              setShowBrowser(false);
            }}
          />
        )}

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>
              Load your FCS file
            </h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              FCS 2.0, 3.0, and 3.1 are supported. Nothing leaves your machine — all processing runs locally.
            </p>
          </div>

          {/* Project / sample names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
                Project name
              </label>
              <input value={projectName} onChange={e => setProjectName(e.target.value)}
                style={inputStyle} placeholder="My Experiment" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
                Sample name <span style={{ color: "var(--dim)" }}>(optional)</span>
              </label>
              <input value={sampleName} onChange={e => setSampleName(e.target.value)}
                style={inputStyle} placeholder="e.g. Patient A – Day 0" />
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            {(["upload", "local"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setFileMode(mode)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                style={
                  fileMode === mode
                    ? { background: "#fff8f3", border: "2px solid var(--flame)", color: "var(--flame)" }
                    : { background: "var(--canvas)", border: "2px solid var(--border)", color: "var(--muted)" }
                }
              >
                {mode === "upload" ? "⬆️  Upload file" : "📂  Use file from my computer"}
              </button>
            ))}
          </div>

          {/* Hint under toggle */}
          <p className="text-xs -mt-3" style={{ color: "var(--dim)" }}>
            {fileMode === "upload"
              ? "Good for files up to a few hundred MB. The file is copied to the local server."
              : "Ideal for large files (1 GB+). The server reads the file in-place — nothing is copied or moved."}
          </p>

          {/* Upload mode */}
          {fileMode === "upload" && (
            <div
              className="flex flex-col items-center justify-center gap-3 py-14 rounded-xl cursor-pointer transition-colors"
              style={{
                border: `2px dashed ${dragOver ? "var(--flame)" : "var(--border)"}`,
                background: dragOver ? "#fff8f3" : "var(--canvas)",
              }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault(); setDragOver(false);
                const f = e.dataTransfer.files[0]; if (f) handleFile(f);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="text-3xl">📁</span>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  Drop your .fcs file here
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>or click to browse</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".fcs" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}

          {/* Local path mode */}
          {fileMode === "local" && (
            <div className="space-y-4">
              <div
                className="flex flex-col items-center justify-center gap-3 py-10 rounded-xl cursor-pointer transition-colors"
                style={{ border: `2px dashed ${localPath ? "var(--flame)" : "var(--border)"}`,
                         background: localPath ? "#fff8f3" : "var(--canvas)" }}
                onClick={() => setShowBrowser(true)}
              >
                <span className="text-3xl">📂</span>
                {localPath ? (
                  <div className="text-center px-4">
                    <p className="text-sm font-semibold" style={{ color: "var(--flame)" }}>{localName}</p>
                    <p className="text-xs mt-1 font-mono break-all" style={{ color: "var(--muted)" }}>{localPath}</p>
                    <p className="text-xs mt-2" style={{ color: "var(--dim)" }}>Click to change</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                      Click to browse your filesystem
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                      Navigate to your .fcs file — it stays in place
                    </p>
                  </div>
                )}
              </div>

              {/* Manual path fallback */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
                  Or paste the full file path directly
                </label>
                <div className="flex gap-2">
                  <input
                    value={localPath}
                    onChange={e => { setLocalPath(e.target.value); setLocalName(e.target.value.split("/").pop() ?? ""); }}
                    placeholder="/Users/you/data/sample.fcs"
                    spellCheck={false}
                    className="flex-1 font-mono text-xs focus:outline-none"
                    style={{ ...inputStyle, fontSize: "12px" }}
                  />
                  <button
                    disabled={!localPath || loading}
                    onClick={() => localPath && handleLocalPath(localPath, localName)}
                    style={{ ...primaryBtn, opacity: (!localPath || loading) ? 0.4 : 1 }}
                  >
                    Load →
                  </button>
                </div>
              </div>

              {localPath && (
                <button
                  disabled={loading}
                  onClick={() => handleLocalPath(localPath, localName)}
                  style={{ ...primaryBtn, width: "100%" }}
                >
                  {loading ? "Opening file…" : "Open & analyse →"}
                </button>
              )}
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg"
              style={{ background: "#fff8f3", border: "1px solid var(--flame)" }}>
              <div className="w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: "var(--flame)", borderTopColor: "transparent" }} />
              <span className="text-sm" style={{ color: "var(--flame)" }}>
                {fileMode === "upload" ? "Parsing FCS file…" : "Reading file from disk…"}
              </span>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-lg text-sm"
              style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
              {error}
            </div>
          )}
        </div>
      </>
    );
  }

  // ─── Step 2: Channels ───────────────────────────────────────────────────────

  function Step2() {
    if (!meta) return null;
    const scatters = meta.channels.filter(isScatter);
    const fluors = meta.channels.filter(c => !isScatter(c) && !c.is_time);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Review your data and select channels</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Choose which measurements to plot on each axis.
          </p>
        </div>

        {/* Metadata card */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Cytometer", value: meta.cytometer || "Unknown" },
            { label: "Date", value: meta.acquisition_date || "—" },
            { label: "Total events", value: meta.event_count.toLocaleString() },
            { label: "Channels", value: String(meta.channel_count) },
          ].map(item => (
            <div key={item.label} className="p-3 rounded-xl" style={card}>
              <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>{item.label}</p>
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Channel legend */}
        <div className="p-4 rounded-xl" style={card}>
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Channels in this file
          </p>
          <div className="flex flex-wrap gap-1.5">
            {meta.channels.filter(c => !c.is_time).map(ch => (
              <span key={ch.pnn} className="px-2 py-0.5 rounded text-xs font-medium"
                style={isScatter(ch)
                  ? { background: "#f0f9ff", color: "#0369a1", border: "1px solid #bae6fd" }
                  : { background: "#fff8f3", color: "var(--flame)", border: "1px solid #fed7aa" }}>
                {ch.pnn}
                {ch.pns && ch.pns !== ch.pnn ? ` (${ch.pns})` : ""}
              </span>
            ))}
          </div>
          <div className="flex gap-4 mt-3">
            <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted)" }}>
              <span className="px-1.5 rounded text-xs" style={{ background: "#f0f9ff", color: "#0369a1" }}>FSC/SSC</span>
              Scatter — measures cell size &amp; granularity
            </span>
            <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted)" }}>
              <span className="px-1.5 rounded text-xs" style={{ background: "#fff8f3", color: "var(--flame)" }}>Others</span>
              Fluorescence markers
            </span>
          </div>
        </div>

        {/* Channel pickers */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { axis: "X axis", val: xChannel, set: setXChannel },
            { axis: "Y axis", val: yChannel, set: setYChannel },
          ].map(({ axis, val, set }) => (
            <div key={axis}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>{axis}</label>
              <select value={val} onChange={e => set(e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}>
                {scatters.length > 0 && (
                  <optgroup label="Scatter">
                    {scatters.map(c => <option key={c.pnn} value={c.pnn}>{c.pnn}{c.pns && c.pns !== c.pnn ? ` — ${c.pns}` : ""}</option>)}
                  </optgroup>
                )}
                {fluors.length > 0 && (
                  <optgroup label="Fluorescence">
                    {fluors.map(c => <option key={c.pnn} value={c.pnn}>{c.pnn}{c.pns && c.pns !== c.pnn ? ` — ${c.pns}` : ""}</option>)}
                  </optgroup>
                )}
              </select>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button style={ghostBtn} onClick={() => setStep(1)}>← Back</button>
          <button style={primaryBtn} onClick={() => setStep(3)}>
            Continue to transform settings →
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 3: Transform ──────────────────────────────────────────────────────

  function Step3() {
    const selectedCh = meta?.channels.find(c => c.pnn === xChannel);
    const isScatterSelected = selectedCh ? isScatter(selectedCh) : false;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>How should fluorescence values be scaled?</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Transformations change how the data is displayed on the plot — they don't alter the underlying measurements.
            {isScatterSelected && " Since you selected scatter channels, Linear is usually best."}
          </p>
        </div>

        <div className="space-y-2.5">
          {TRANSFORMS.map(t => (
            <label key={t.value} className="flex gap-3 p-4 rounded-xl cursor-pointer transition-colors"
              style={transform === t.value
                ? { border: "1.5px solid var(--flame)", background: "#fff8f3" }
                : { ...card, cursor: "pointer" }}>
              <input type="radio" name="transform" value={t.value}
                checked={transform === t.value} onChange={() => setTransform(t.value)}
                className="mt-0.5 shrink-0" style={{ accentColor: "var(--flame)" }} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{t.label}</span>
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                    style={t.recommended
                      ? { background: "var(--flame)", color: "#fff" }
                      : { background: "var(--canvas)", color: "var(--dim)", border: "1px solid var(--border)" }}>
                    {t.tag}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{t.desc}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <button style={ghostBtn} onClick={() => setStep(2)}>← Back</button>
          <button style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }} onClick={loadPlot} disabled={loading}>
            {loading ? "Loading plot…" : "Generate plot →"}
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg text-sm"
            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // ─── Step 4: Gate ───────────────────────────────────────────────────────────

  function Step4() {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>
            {xChannel} vs {yChannel} — {totalEvents.toLocaleString()} events
          </h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            <strong>To draw a gate:</strong> use the box-select tool (rectangle) or lasso tool (polygon) in the plot toolbar, then click and drag over the cells you want to gate.
          </p>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <Plot
            data={[{
              x: plotX, y: plotY,
              mode: "markers" as const,
              type: "scattergl" as any,
              marker: { size: 2, color: "var(--flame)", opacity: 0.5 },
            }]}
            layout={{
              autosize: true,
              height: 420,
              paper_bgcolor: "transparent",
              plot_bgcolor: "var(--canvas)",
              xaxis: { title: { text: xChannel }, gridcolor: "var(--border)", zerolinecolor: "var(--border)" },
              yaxis: { title: { text: yChannel }, gridcolor: "var(--border)", zerolinecolor: "var(--border)" },
              margin: { t: 16, r: 16, b: 48, l: 56 },
              font: { color: "var(--muted)", size: 11 },
              dragmode: "select" as const,
            }}
            config={{ displaylogo: false, scrollZoom: true }}
            style={{ width: "100%" }}
            useResizeHandler
            onSelected={handlePlotSelected}
            onDeselect={() => setPendingGate(null)}
          />
        </div>

        {/* Pending gate */}
        {pendingGate && (
          <div className="p-4 rounded-xl flex items-center gap-3"
            style={{ background: "#fff8f3", border: "1px solid var(--flame)" }}>
            <span className="text-sm font-medium" style={{ color: "var(--flame)" }}>
              {pendingGate.type === "rectangle" ? "Rectangle gate" : "Polygon gate"} drawn
            </span>
            <input value={gateName} onChange={e => setGateName(e.target.value)}
              className="flex-1 px-2 py-1 rounded text-sm"
              style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--text)" }}
              placeholder="Gate name" />
            <button onClick={saveGate} disabled={savingGate}
              style={{ ...primaryBtn, padding: "6px 16px", opacity: savingGate ? 0.7 : 1 }}>
              {savingGate ? "Saving…" : "Save gate"}
            </button>
            <button onClick={() => setPendingGate(null)}
              className="text-xs px-3 py-1.5 rounded"
              style={{ background: "var(--canvas)", color: "var(--muted)", border: "1px solid var(--border)" }}>
              Discard
            </button>
          </div>
        )}

        {/* Saved gates */}
        {gates.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={card}>
            <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Saved gates
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {gates.map(g => (
                <div key={g.gate_id} className="px-4 py-3 flex items-center gap-4">
                  <div className="flex-1">
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{g.name}</span>
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded capitalize"
                      style={{ background: "var(--canvas)", color: "var(--dim)", border: "1px solid var(--border)" }}>
                      {g.gate_type}
                    </span>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div className="text-center">
                      <div className="font-semibold" style={{ color: "var(--text)" }}>
                        {g.count.toLocaleString()}
                      </div>
                      <div className="text-xs" style={{ color: "var(--dim)" }}>cells</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold" style={{ color: "var(--flame)" }}>
                        {g.percent_of_total.toFixed(1)}%
                      </div>
                      <div className="text-xs" style={{ color: "var(--dim)" }}>of total</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <button style={ghostBtn} onClick={() => setStep(3)}>← Change transform</button>
          <button style={primaryBtn} onClick={() => setStep(5)} disabled={gates.length === 0}>
            Export results →
          </button>
          {gates.length === 0 && (
            <span className="text-xs self-center" style={{ color: "var(--dim)" }}>
              Draw and save at least one gate to export
            </span>
          )}
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg text-sm"
            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // ─── Step 5: Export ─────────────────────────────────────────────────────────

  function Step5() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>Analysis complete</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Review your gate statistics below and download the results as CSV.
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total events", value: totalEvents.toLocaleString() },
            { label: "Gates created", value: String(gates.length) },
            { label: "Transform", value: TRANSFORMS.find(t => t.value === transform)?.label ?? transform },
          ].map(item => (
            <div key={item.label} className="p-4 rounded-xl text-center" style={card}>
              <p className="text-xl font-bold mb-0.5" style={{ color: "var(--flame)" }}>{item.value}</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>{item.label}</p>
            </div>
          ))}
        </div>

        {/* Gate stats table */}
        <div className="rounded-xl overflow-hidden" style={card}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--canvas)" }}>
                {["Gate", "Type", "Events", "% of Total", "X Channel", "Y Channel"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gates.map((g, i) => (
                <tr key={g.gate_id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--text)" }}>{g.name}</td>
                  <td className="px-4 py-3 capitalize" style={{ color: "var(--muted)" }}>{g.gate_type}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--text)" }}>{g.count.toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--flame)" }}>{g.percent_of_total.toFixed(2)}%</td>
                  <td className="px-4 py-3" style={{ color: "var(--muted)" }}>{xChannel}</td>
                  <td className="px-4 py-3" style={{ color: "var(--muted)" }}>{yChannel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button style={primaryBtn}
            onClick={() => window.open(`${BASE}/api/flow/files/${fileId}/export`, "_blank")}>
            Download CSV
          </button>
          <button style={ghostBtn} onClick={() => setStep(4)}>← Back to gating</button>
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}
            onClick={resetWizard}>
            Analyze another file
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      <StepBar />
      {step === 1 && <Step1 />}
      {step === 2 && <Step2 />}
      {step === 3 && <Step3 />}
      {step === 4 && <Step4 />}
      {step === 5 && <Step5 />}
    </div>
  );
}
