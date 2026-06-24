"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const ANALYSIS_ICONS: Record<string, string> = {
  rnaseq: "🧬", wgs: "🔬", wes: "🎯", scrnaseq: "🔵",
  methylation: "🧪", chipseq: "📍", atacseq: "🌊",
  proteomics: "🔩", microbiome: "🦠", multiomics: "🔗",
  survival: "📊", other: "🔬",
};

interface DetectedAnalysis {
  id: string;
  name: string;
  type: string;
  description: string;
  figure_refs?: string[];
  n_samples?: string;
  key_tools?: string[];
  is_primary?: boolean;
}

interface Props {
  articleId: string | null;
  subStep: "pick" | "review";
  selectedAnalysis: DetectedAnalysis | null;
  onAnalysisPicked: (analysis: DetectedAnalysis) => void;
  onComplete: () => void;
}

export default function AnalysisSelector({ articleId, subStep, selectedAnalysis, onAnalysisPicked, onComplete }: Props) {
  const [pipeline, setPipeline] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [hovered, setHovered]   = useState<string | null>(null);

  useEffect(() => {
    if (!articleId) return;
    if (articleId.startsWith("template_")) {
      const type = articleId.replace("template_", "");
      api.getConfigSchema(type).then(schema => {
        setPipeline({
          analysis_type: type.toUpperCase(),
          steps: [],
          _schema: schema,
          detected_analyses: [{
            id: type,
            name: type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            type,
            description: `Standard ${type} pipeline following nf-core best practices`,
            key_tools: [],
            is_primary: true,
          }],
        });
        setLoading(false);
      }).catch(e => { setError(e.message); setLoading(false); });
    } else {
      api.getArticle(articleId).then(p => { setPipeline(p); setLoading(false); })
        .catch(e => { setError(e.message); setLoading(false); });
    }
  }, [articleId]);

  if (loading) return <LoadingState text="Reading the article and detecting all analyses..." />;
  if (error)   return <ErrorState message={error} />;
  if (!pipeline) return null;

  /* ── Derive analyses list ─────────────────────────────────────── */
  const analyses: DetectedAnalysis[] = pipeline.detected_analyses?.length
    ? pipeline.detected_analyses
    : [{
        id: pipeline.analysis_type?.toLowerCase() || "main",
        name: pipeline.title ? `Main analysis: ${pipeline.analysis_type}` : pipeline.analysis_type || "Analysis",
        type: pipeline.analysis_type?.toLowerCase() || "other",
        description: `${pipeline.analysis_type} pipeline with ${pipeline.steps?.length || 0} steps extracted from the paper`,
        key_tools: pipeline.steps?.slice(0, 4).map((s: any) => s.tool).filter(Boolean) || [],
        is_primary: true,
      }];

  /* ── PICK sub-step ─────────────────────────────────────────────── */
  if (subStep === "pick") {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-semibold mb-1" style={{ color: "var(--text)" }}>
            Analyses Found in This Paper
          </h2>
          {pipeline.title && (
            <p className="text-sm font-medium mb-0.5" style={{ color: "var(--text)" }}>{pipeline.title}</p>
          )}
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Found {analyses.length} analysis{analyses.length > 1 ? "es" : ""} in this article.
            Select the one you want to replicate.
          </p>
          {pipeline.doi && (
            <p className="text-xs mt-1 font-mono" style={{ color: "var(--dim)" }}>DOI: {pipeline.doi}</p>
          )}
        </div>

        {/* Missing info warning */}
        {pipeline.missing_info?.length > 0 && (
          <div className="rounded-xl p-4" style={{ background: "#fffbf0", border: "1px solid #f5e0a0" }}>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--amber)" }}>
              ⚠ Some details not specified in the paper
            </p>
            <ul className="space-y-0.5">
              {pipeline.missing_info.map((m: string, i: number) => (
                <li key={i} className="text-xs" style={{ color: "var(--muted)" }}>• {m}</li>
              ))}
            </ul>
            <p className="text-xs mt-1.5" style={{ color: "var(--dim)" }}>
              Defaults will be used. You can override them after selecting an analysis.
            </p>
          </div>
        )}

        {/* Analysis cards */}
        <div className="space-y-3">
          {analyses.map((a) => {
            const icon = ANALYSIS_ICONS[a.type] || "🔬";
            const isHovered = hovered === a.id;
            return (
              <button
                key={a.id}
                onClick={() => onAnalysisPicked(a)}
                onMouseEnter={() => setHovered(a.id)}
                onMouseLeave={() => setHovered(null)}
                className="w-full text-left rounded-2xl p-5 transition-all"
                style={{
                  background: isHovered ? "#fff8f3" : "var(--surface)",
                  border: isHovered ? "1px solid var(--flame)" : "1px solid var(--border)",
                  boxShadow: isHovered ? "0 2px 12px rgba(29,111,164,0.08)" : "none",
                }}>
                <div className="flex items-start gap-4">
                  <span className="text-3xl shrink-0 mt-0.5">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{a.name}</span>
                      {a.is_primary && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: "#fff8f3", color: "var(--flame)", border: "1px solid #ffd4bc" }}>
                          Primary
                        </span>
                      )}
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: "#f3f0e8", color: "var(--muted)" }}>
                        {a.type.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm mb-2" style={{ color: "var(--muted)" }}>{a.description}</p>
                    <div className="flex flex-wrap gap-3 text-xs" style={{ color: "var(--dim)" }}>
                      {a.n_samples && <span>👥 {a.n_samples}</span>}
                      {a.figure_refs?.length ? <span>📊 {a.figure_refs.join(", ")}</span> : null}
                    </div>
                    {a.key_tools?.length ? (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {a.key_tools.map(t => (
                          <span key={t} className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: "#fff8f3", color: "var(--flame)", border: "1px solid #ffe4d0" }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-lg shrink-0 transition-transform"
                    style={{ color: "var(--flame)", transform: isHovered ? "translateX(3px)" : "none" }}>
                    →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── REVIEW sub-step ────────────────────────────────────────────── */
  const steps = pipeline.steps || [];
  const confidence = pipeline.confidence_score;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 flex-wrap mb-1">
          <h2 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>Pipeline Steps</h2>
          {selectedAnalysis && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "#fff8f3", color: "var(--flame)", border: "1px solid #ffd4bc" }}>
              {ANALYSIS_ICONS[selectedAnalysis.type] || "🔬"} {selectedAnalysis.name}
            </span>
          )}
          {confidence !== undefined && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: confidence > 0.8 ? "#f0fff4" : "#fffbf0",
                color: confidence > 0.8 ? "#2a7a4a" : "var(--amber)",
                border: `1px solid ${confidence > 0.8 ? "#a0d8b0" : "#f5e0a0"}`,
              }}>
              {Math.round(confidence * 100)}% confidence
            </span>
          )}
        </div>
        {pipeline.title && <p className="text-sm" style={{ color: "var(--muted)" }}>{pipeline.title}</p>}
        {pipeline.doi && <p className="text-xs mt-1 font-mono" style={{ color: "var(--dim)" }}>DOI: {pipeline.doi}</p>}
      </div>

      {/* Reference genome */}
      {pipeline.reference_genome && (
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--muted)" }}>REFERENCE GENOME</h3>
          <div className="flex flex-wrap gap-6 text-sm">
            {(Object.entries(pipeline.reference_genome) as [string, unknown][])
              .filter(([, v]) => Boolean(v))
              .map(([k, v]) => (
                <div key={k}>
                  <span style={{ color: "var(--dim)" }}>{k}: </span>
                  <span style={{ color: "var(--text)" }}>{String(v)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Pipeline steps */}
      {steps.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold mb-4" style={{ color: "var(--muted)" }}>
            PIPELINE STEPS ({steps.length})
          </h3>
          <div className="space-y-2">
            {steps.map((step: any, i: number) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "#fff8f3", color: "var(--flame)", border: "1px solid var(--flame)" }}>
                  {step.step_number || i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{step.name}</span>
                    <span className="text-xs" style={{ color: "var(--flame)" }}>{step.tool} {step.version}</span>
                    {step.docker_image && (
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: "#f0f4ff", color: "#3355cc", border: "1px solid #d0dcff" }}>
                        {step.docker_image.split(":")[0].split("/").pop()}
                      </span>
                    )}
                  </div>
                  {step.command_template && (
                    <code className="block mt-1 text-xs rounded px-2 py-1 overflow-x-auto"
                      style={{ background: "var(--canvas)", color: "var(--muted)" }}>
                      {step.command_template}
                    </code>
                  )}
                  {step.notes && (
                    <p className="text-xs mt-1" style={{ color: "var(--dim)" }}>{step.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-5 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Pipeline steps will be generated when the analysis runs.
          </p>
        </div>
      )}

      {/* Missing info */}
      {pipeline.missing_info?.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "#fffbf0", border: "1px solid #f5e0a0" }}>
          <h3 className="text-xs font-semibold mb-2" style={{ color: "var(--amber)" }}>
            ⚠ Information not found in paper
          </h3>
          <ul className="space-y-1">
            {pipeline.missing_info.map((m: string, i: number) => (
              <li key={i} className="text-xs" style={{ color: "var(--muted)" }}>• {m}</li>
            ))}
          </ul>
          <p className="text-xs mt-2" style={{ color: "var(--dim)" }}>
            Default values will be used — you can override them in the config.
          </p>
        </div>
      )}

      <button onClick={onComplete}
        className="px-6 py-3 rounded-lg text-sm font-medium transition-colors"
        style={{ background: "var(--flame)", color: "#fff" }}>
        Looks good — Check my data →
      </button>
    </div>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 py-12">
      <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: "var(--flame)", borderTopColor: "transparent" }} />
      <span className="text-sm" style={{ color: "var(--muted)" }}>{text}</span>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg p-4 text-sm"
      style={{ background: "#fff0f0", border: "1px solid #f5b0b0", color: "#c0392b" }}>
      {message}
    </div>
  );
}
