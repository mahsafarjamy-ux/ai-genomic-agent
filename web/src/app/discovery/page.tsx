"use client";

import { useState } from "react";
import NavBar from "@/components/NavBar";
import { useAuthOptional } from "@/hooks/useAuthOptional";
import { AuthForm, UserCard } from "@/components/AuthSidePanel";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const ANALYSIS_TYPES = [
  "rnaseq","wgs","wes","scrnaseq","methylation","chipseq","atacseq",
  "immune_profiling","ctdna","microbiome","riboseq","proteomics",
  "multiomics","spatial_transcriptomics","dark_genome",
];

const SOURCE_LABELS: Record<string, string> = {
  pubmed:  "PubMed",
  biorxiv: "bioRxiv",
  scholar: "Google Scholar",
};

export default function DiscoveryPage() {
  const { user, loading: authLoading, signOut, refresh } = useAuthOptional();
  const [query, setQuery] = useState("");
  const [disease, setDisease] = useState("");
  const [analysisType, setAnalysisType] = useState("");
  const [maxResults, setMaxResults] = useState(25);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [litQuery, setLitQuery] = useState("");
  const [litSource, setLitSource] = useState("all");
  const [litLoading, setLitLoading] = useState(false);
  const [litResults, setLitResults] = useState<any[]>([]);

  const [multiOmicsLayers, setMultiOmicsLayers] = useState("");
  const [multiOmicsDisease, setMultiOmicsDisease] = useState("");
  const [moLoading, setMoLoading] = useState(false);
  const [moResult, setMoResult] = useState<any>(null);

  async function handleDiscover() {
    if (!query) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${BASE}/api/discovery/gaps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          disease: disease || undefined,
          analysis_type: analysisType || undefined,
          max_results: maxResults,
        }),
      });
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      setResult(await res.json());
    } catch (e: any) {
      setError(`Analysis failed: ${e.message}. Make sure the backend is running at ${BASE}.`);
    }
    finally { setLoading(false); }
  }

  async function handleLitSearch() {
    if (!litQuery) return;
    setLitLoading(true);
    setLitResults([]);
    try {
      if (litSource === "scholar") {
        // No public API — open directly in a new tab
        window.open(
          `https://scholar.google.com/scholar?q=${encodeURIComponent(litQuery)}`,
          "_blank"
        );
        setLitLoading(false);
        return;
      }

      if (litSource === "biorxiv") {
        window.open(
          `https://www.biorxiv.org/search/${encodeURIComponent(litQuery)}`,
          "_blank"
        );
        setLitLoading(false);
        return;
      }

      // PubMed: call NCBI eutils directly from the browser — no backend needed
      const searchRes = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(litQuery)}&retmax=20&retmode=json&sort=relevance`
      );
      const searchData = await searchRes.json();
      const ids: string[] = searchData.esearchresult?.idlist ?? [];

      if (ids.length === 0) { setLitResults([]); return; }

      const summaryRes = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.slice(0, 15).join(",")}&retmode=json`
      );
      const summaryData = await summaryRes.json();
      const result = summaryData.result ?? {};

      setLitResults(
        ids.slice(0, 15)
          .filter(id => result[id] && !result[id].error)
          .map(id => {
            const a = result[id];
            return {
              source: "PubMed",
              pmid: a.uid,
              title: a.title ?? "Untitled",
              authors: (a.authors ?? []).map((au: { name: string }) => au.name),
              journal: a.source ?? "",
              year: (a.pubdate ?? "").split(" ")[0],
              url: `https://pubmed.ncbi.nlm.nih.gov/${a.uid}/`,
              abstract: a.abstracttext ?? "",
            };
          })
      );
    } catch {
      // Hard fallback: just show search links
      setLitResults([
        { source: "PubMed",  title: `Open "${litQuery}" on PubMed`,          url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(litQuery)}`,       year: "", authors: [], journal: "" },
        { source: "bioRxiv", title: `Open "${litQuery}" on bioRxiv`,          url: `https://www.biorxiv.org/search/${encodeURIComponent(litQuery)}`,             year: "", authors: [], journal: "" },
        { source: "Scholar", title: `Open "${litQuery}" on Google Scholar`,   url: `https://scholar.google.com/scholar?q=${encodeURIComponent(litQuery)}`,       year: "", authors: [], journal: "" },
      ]);
    }
    finally { setLitLoading(false); }
  }

  function buildMultiOmicsStrategy(layers: string[], disease: string) {
    const n = (x: string) => x.toLowerCase();
    const has = (...keys: string[]) => keys.some(k => layers.some(l => n(l).includes(k)));
    const hasSC = has("scrnaseq", "scrna", "single");
    const hasRNA = has("rnaseq", "rna") || !hasSC;
    const hasATAC = has("atac");
    const hasMethyl = has("methyl", "wgbs", "rrbs", "epic");
    const hasProtein = has("proteom", "ms", "mass");
    const hasChIP = has("chip", "histone");
    const hasSpatial = has("spatial", "visium");

    let method = "MOFA+ factor analysis";
    let methodDetail = `MOFA+ decomposes variation across all ${layers.length} data types into shared latent factors. Each factor represents a coordinated biological program. Identify which factors correlate with clinical variables like ${disease} severity or treatment response.`;
    const methodTools = ["MOFA+", "mofapy2"];

    if (hasSC && hasATAC) {
      method = "WNN (single-cell RNA + ATAC)";
      methodDetail = "Seurat v5 Weighted Nearest Neighbors creates a joint RNA+ATAC embedding. WNN weights each modality by its local informativeness — giving more accurate cell type calls than either alone.";
      methodTools.length = 0; methodTools.push("Seurat WNN", "ArchR", "SnapATAC2");
    } else if (hasSpatial) {
      method = "Spatial multi-omics deconvolution";
      methodDetail = "Map cell-type proportions from scRNA-seq onto spatial spots using RCTD or cell2location. Overlay ATAC/proteomics signals if co-registered.";
      methodTools.length = 0; methodTools.push("cell2location", "RCTD", "BayesSpace");
    } else if (hasRNA && hasProtein && !hasATAC && !hasMethyl) {
      method = "Transcriptome–proteome correlation (DIABLO)";
      methodDetail = "mixOmics DIABLO builds a multi-block PLS model to find molecules jointly associated with your outcome. Prioritize genes with concordant mRNA↑ and protein↑ changes.";
      methodTools.length = 0; methodTools.push("mixOmics DIABLO", "UpSetR", "corrplot");
    } else if (hasRNA && hasMethyl && !hasATAC) {
      method = "Transcriptome–methylome regulatory linkage";
      methodDetail = "Correlate DMRs with differential expression. Identify genes silenced by promoter hypermethylation. Test CpG island methylation at TSS of DEGs.";
      methodTools.length = 0; methodTools.push("minfi", "DMRcate", "limma");
    } else if ((hasRNA || hasSC) && hasATAC && !hasProtein) {
      method = "Peak-to-gene regulatory linkage";
      methodDetail = "Link ATAC-seq peaks to nearby differentially expressed genes. Test whether open chromatin regions upstream of DEGs contain TF motifs driving the expression change — reveals enhancer-gene regulatory pairs.";
      methodTools.length = 0; methodTools.push("Signac", "ArchR", "GREAT", "TOBIAS");
    }

    const steps = [
      { n: 1, title: "Individual layer QC and normalization", detail: `Process each of the ${layers.length} data types through its own standard pipeline first. Normalize independently: DESeq2 VST for RNA; CPM/TMM for ATAC; intensity normalization for proteomics. Ensure all layers pass QC before integration.`, tools: ["DESeq2", "edgeR", "Seurat"] },
      { n: 2, title: "Batch correction", detail: "Apply ComBat-seq (count data) or Harmony (single-cell) if samples were processed in different batches. Verify that PCA on each layer no longer separates by batch.", tools: ["ComBat-seq", "Harmony", "limma removeBatchEffect"] },
      { n: 3, title: method, detail: methodDetail, tools: methodTools },
      { n: 4, title: "Cross-layer pathway enrichment", detail: "Run pathway analysis on the integrated output. Prioritize pathways supported by ≥2 data types. Use ORA or GSEA with MSigDB Hallmark gene sets.", tools: ["clusterProfiler", "GSEA", "decoupleR"] },
      { n: 5, title: "Publication-ready visualization", detail: "Multi-omics heatmap (ComplexHeatmap), factor weight plots, integrated UMAP embeddings. Report variance explained per factor.", tools: ["ComplexHeatmap", "ggplot2", "plotly"] },
    ];

    return {
      executive_summary: `Integration strategy for ${layers.join(" + ")} in ${disease}. Core approach: ${method}. ${steps.length}-step workflow from QC to figures.`,
      integration_method: method,
      steps,
      recommended_tools: [...new Set(steps.flatMap(s => s.tools))],
    };
  }

  async function handleMultiOmics() {
    if (!multiOmicsLayers) return;
    setMoLoading(true); setMoResult(null);
    await new Promise(r => setTimeout(r, 500)); // brief thinking delay
    const layers = multiOmicsLayers.split(",").map(s => s.trim()).filter(Boolean);
    setMoResult(buildMultiOmicsStrategy(layers, multiOmicsDisease || "your disease"));
    setMoLoading(false);
  }

  const QUICK_LINKS = [
    { href: "/tools",      label: "🔬 Tool Finder" },
    { href: "/data",       label: "🗂 Public Datasets" },
    { href: "/multiomics", label: "🔗 Multi-Omics" },
    { href: "/replicate",  label: "🧪 Replicate Check" },
  ];

  const DISC_BENEFITS = [
    "AI gap analysis across PubMed + bioRxiv",
    "Novel hypothesis generation for your field",
    "Multi-omics integration strategy builder",
    "Save and revisit discovery sessions",
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)", color: "var(--text)" }}>
      <NavBar active="/discovery" user={user} onSignOut={signOut} />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-8 items-start">

        {/* ── Left column ────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-12">
        <div>
          <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text)" }}>Novel Discovery Engine</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Scans recent PubMed + bioRxiv literature and identifies methodological gaps,
            under-explored hypotheses, and novel experiments you can run today.
            No patient data is involved — only article abstracts are processed.
          </p>
        </div>

        {/* Gap Discovery */}
        <section className="rounded-2xl p-6 space-y-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="font-semibold text-lg" style={{ color: "var(--text)" }}>Literature Gap Analysis</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Research query *</label>
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="e.g. single cell RNA-seq tumor microenvironment breast cancer"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Disease / phenotype (optional)</label>
              <input value={disease} onChange={e => setDisease(e.target.value)}
                placeholder="e.g. breast cancer, LUAD, IBD"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Analysis type (optional)</label>
              <select value={analysisType} onChange={e => setAnalysisType(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }}>
                <option value="">Any</option>
                {ANALYSIS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Max articles to scan</label>
              <input type="number" value={maxResults} onChange={e => setMaxResults(+e.target.value)}
                min={5} max={50}
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
          </div>
          <button onClick={handleDiscover} disabled={loading || !query}
            className="px-6 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
            style={{ background: "var(--flame)", color: "#fff" }}>
            {loading ? "Professor AI scanning literature + building plans…" : "Discover Novel Opportunities"}
          </button>
        </section>

        {error && (
          <div className="rounded-lg p-4 text-sm" style={{ background: "#fff0f0", border: "1px solid #f5c0c0", color: "#c0392b" }}>{error}</div>
        )}

        {/* Gap Analysis Results */}
        {result && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Gap Analysis Results</h2>
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#f3f0e8", color: "var(--muted)" }}>
                {result.articles_found} articles scanned
              </span>
            </div>

            {result.executive_summary && (
              <div className="rounded-xl p-4" style={{ background: "#edf4fb", border: "1px solid var(--flame)" }}>
                <p className="text-xs font-medium mb-1" style={{ color: "var(--flame)" }}>Executive Summary</p>
                <p className="text-sm" style={{ color: "var(--text)" }}>{result.executive_summary}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.known_work?.length > 0 && (
                <ResultCard title="What Has Been Done" items={result.known_work} color="gray" />
              )}
              {result.methodological_gaps?.length > 0 && (
                <ResultCard title="Methodological Gaps" items={result.methodological_gaps} color="yellow" />
              )}
              {result.data_gaps?.length > 0 && (
                <ResultCard title="Data Gaps" items={result.data_gaps} color="orange" />
              )}
            </div>

            {result.novel_hypotheses?.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3" style={{ color: "var(--text)" }}>Novel Hypotheses</h3>
                <div className="space-y-3">
                  {result.novel_hypotheses.map((h: any, i: number) => (
                    <div key={i} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{h.hypothesis}</p>
                        <span className="text-xs px-2 py-0.5 rounded flex-shrink-0"
                          style={
                            h.feasibility === "high"
                              ? { background: "#edf4fb", color: "var(--flame)" }
                              : h.feasibility === "medium"
                              ? { background: "#fffbf0", color: "var(--amber)" }
                              : { background: "#fff0f0", color: "#c0392b" }
                          }>{h.feasibility}</span>
                      </div>
                      {h.rationale && <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>{h.rationale}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.suggested_experiments?.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3" style={{ color: "var(--text)" }}>Suggested Experiments</h3>
                <div className="space-y-3">
                  {result.suggested_experiments.map((exp: any, i: number) => (
                    <div key={i} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <p className="font-medium text-sm" style={{ color: "var(--text)" }}>{exp.title}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {exp.analysis_type && (
                          <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#f0f4ff", color: "#3355cc" }}>{exp.analysis_type}</span>
                        )}
                        {exp.tools?.map((t: string) => (
                          <span key={t} className="text-xs px-2 py-0.5 rounded" style={{ background: "#f3f0e8", color: "var(--muted)" }}>{t}</span>
                        ))}
                      </div>
                      {exp.dataset && <p className="text-xs mt-1" style={{ color: "var(--dim)" }}>Dataset: {exp.dataset}</p>}
                      {exp.expected_finding && (
                        <p className="text-xs mt-1" style={{ color: "var(--flame)" }}>Expected: {exp.expected_finding}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.recommended_tool_combinations?.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3" style={{ color: "var(--text)" }}>Novel Tool Combinations</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.recommended_tool_combinations.map((tc: any, i: number) => (
                    <div key={i} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {tc.tools?.map((t: string) => (
                          <span key={t} className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "#f3f0e8", color: "var(--flame)" }}>{t}</span>
                        ))}
                      </div>
                      {tc.rationale && <p className="text-xs" style={{ color: "var(--muted)" }}>{tc.rationale}</p>}
                      {tc.novelty && <p className="text-xs mt-1" style={{ color: "var(--amber)" }}>Novelty: {tc.novelty}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Analysis Plans — AI-generated with public datasets + pipeline steps */}
            {result.analysis_plans?.length > 0 && (
              <div>
                <h3 className="font-semibold mb-1" style={{ color: "var(--text)" }}>Detailed Analysis Plans</h3>
                <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
                  Step-by-step execution plans for the top novel opportunities, including exact public datasets and pipelines.
                </p>
                <div className="space-y-5">
                  {result.analysis_plans.map((plan: any, i: number) => (
                    <div key={i} className="rounded-2xl p-5 space-y-4"
                      style={{ background: "var(--surface)", border: "2px solid var(--flame)" }}>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold px-2 py-0.5 rounded"
                              style={{ background: "#edf4fb", color: "var(--flame)" }}>
                              PLAN {i + 1}
                            </span>
                            {plan.novelty_score && (
                              <span className="text-xs" style={{ color: "#f59e0b" }}>
                                {"⭐".repeat(Math.min(plan.novelty_score, 5))}
                              </span>
                            )}
                          </div>
                          <h4 className="font-semibold text-sm" style={{ color: "var(--text)" }}>{plan.title}</h4>
                        </div>
                        {plan.publication_target && (
                          <span className="text-xs px-2 py-1 rounded shrink-0"
                            style={{ background: "#f3f0e8", color: "var(--muted)", border: "1px solid var(--border)" }}>
                            {plan.publication_target}
                          </span>
                        )}
                      </div>

                      {/* Hypothesis */}
                      {plan.hypothesis && (
                        <div className="rounded-lg px-4 py-3" style={{ background: "#edf4fb", border: "1px solid #c7dff5" }}>
                          <p className="text-xs font-semibold mb-1" style={{ color: "var(--flame)" }}>Hypothesis</p>
                          <p className="text-sm" style={{ color: "var(--text)" }}>{plan.hypothesis}</p>
                          {plan.novelty_explanation && (
                            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{plan.novelty_explanation}</p>
                          )}
                        </div>
                      )}

                      {/* Datasets */}
                      {plan.datasets?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text)" }}>Required Datasets</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {plan.datasets.map((ds: any, j: number) => (
                              <div key={j} className="rounded-lg p-3" style={{ background: "var(--canvas)", border: "1px solid var(--border)" }}>
                                <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>{ds.name}</p>
                                {ds.accession && (
                                  <p className="text-xs font-mono mt-0.5" style={{ color: "var(--flame)" }}>{ds.accession}</p>
                                )}
                                {ds.size && <p className="text-xs" style={{ color: "var(--muted)" }}>{ds.size}</p>}
                                {ds.url && (
                                  <a href={ds.url} target="_blank" rel="noopener noreferrer"
                                    className="text-xs underline mt-0.5 block" style={{ color: "var(--flame)" }}>
                                    Open portal →
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pipeline steps */}
                      {plan.pipeline_steps?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text)" }}>Pipeline Steps</p>
                          <div className="space-y-2">
                            {plan.pipeline_steps.map((step: any, j: number) => (
                              <div key={j} className="flex gap-3 items-start">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                                  style={{ background: "var(--flame)", color: "#fff" }}>
                                  {step.step ?? j + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-semibold font-mono mr-2"
                                    style={{ color: "var(--flame)" }}>{step.tool}</span>
                                  <span className="text-xs" style={{ color: "var(--text)" }}>{step.action}</span>
                                  {step.parameters && (
                                    <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--muted)" }}>{step.parameters}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Expected outputs + validation */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {plan.expected_outputs?.length > 0 && (
                          <div className="rounded-lg p-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                            <p className="text-xs font-semibold mb-1" style={{ color: "#166534" }}>Expected Outputs</p>
                            <ul className="space-y-1">
                              {plan.expected_outputs.map((o: string, j: number) => (
                                <li key={j} className="text-xs" style={{ color: "#166534" }}>• {o}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {plan.validation_strategy && (
                          <div className="rounded-lg p-3" style={{ background: "#fffbf0", border: "1px solid #fde68a" }}>
                            <p className="text-xs font-semibold mb-1" style={{ color: "#92400e" }}>Validation</p>
                            {plan.validation_strategy.independent_cohort && (
                              <p className="text-xs" style={{ color: "#92400e" }}>Cohort: {plan.validation_strategy.independent_cohort}</p>
                            )}
                            {plan.validation_strategy.statistical_approach && (
                              <p className="text-xs mt-0.5" style={{ color: "#92400e" }}>Stats: {plan.validation_strategy.statistical_approach}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Footer meta */}
                      {(plan.compute_requirements || plan.estimated_time || plan.impact) && (
                        <div className="flex flex-wrap gap-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                          {plan.estimated_time && (
                            <span className="text-xs" style={{ color: "var(--muted)" }}>Time: {plan.estimated_time}</span>
                          )}
                          {plan.compute_requirements && (
                            <span className="text-xs" style={{ color: "var(--muted)" }}>Compute: {plan.compute_requirements}</span>
                          )}
                          {plan.impact && (
                            <span className="text-xs flex-1" style={{ color: "var(--flame)" }}>Impact: {plan.impact}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Supporting articles */}
            {result.articles?.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 text-sm" style={{ color: "var(--muted)" }}>Articles Scanned (top 10)</h3>
                <div className="space-y-1.5">
                  {result.articles.map((a: any, i: number) => (
                    <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                      className="block rounded-lg px-3 py-2 transition-colors"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={a.source === "PubMed"
                            ? { background: "#f0f4ff", color: "#3355cc" }
                            : { background: "#edf4fb", color: "#c05800" }}>
                          {a.source}
                        </span>
                        <span className="text-xs" style={{ color: "var(--dim)" }}>{a.year}</span>
                        {a.journal && <span className="text-xs italic" style={{ color: "var(--dim)" }}>{a.journal}</span>}
                      </div>
                      <p className="text-sm mt-0.5" style={{ color: "var(--text)" }}>{a.title}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Literature Search */}
        <section className="pt-8" style={{ borderTop: "1px solid var(--border)" }}>
          <h2 className="font-semibold text-lg mb-1" style={{ color: "var(--text)" }}>Search Literature Directly</h2>
          <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
            PubMed results load inline with real links. Google Scholar and bioRxiv open in a new tab.
          </p>
          <div className="flex gap-2 flex-wrap">
            <input value={litQuery} onChange={e => setLitQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLitSearch()}
              placeholder="e.g. ATAC-seq tumor microenvironment breast cancer"
              className="flex-1 rounded-lg px-4 py-3 text-sm focus:outline-none"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", minWidth: 200 }} />
            <select value={litSource} onChange={e => setLitSource(e.target.value)}
              className="rounded-lg px-3 py-3 text-sm focus:outline-none"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
              {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={handleLitSearch} disabled={litLoading || !litQuery}
              className="px-5 py-3 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40"
              style={{ background: "var(--flame)", color: "#fff" }}>
              {litLoading ? "Searching…" : "Search →"}
            </button>
          </div>
          {litResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {litResults.map((a: any, i: number) => (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                  className="block rounded-xl p-3 transition-colors"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={a.source === "PubMed"
                        ? { background: "#f0f4ff", color: "#3355cc" }
                        : { background: "#edf4fb", color: "#c05800" }}>
                      {a.source}
                    </span>
                    <span className="text-xs" style={{ color: "var(--dim)" }}>{a.year}</span>
                    {a.journal && <span className="text-xs italic truncate max-w-48" style={{ color: "var(--dim)" }}>{a.journal}</span>}
                    {a.pmid && <span className="text-xs font-mono ml-auto" style={{ color: "var(--dim)" }}>PMID:{a.pmid}</span>}
                  </div>
                  <p className="text-sm mt-1" style={{ color: "var(--text)" }}>{a.title}</p>
                  {a.authors?.length > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{a.authors.slice(0, 3).join(", ")}{a.authors.length > 3 ? " et al." : ""}</p>
                  )}
                  {a.abstract && <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--dim)" }}>{a.abstract}</p>}
                </a>
              ))}
            </div>
          )}
        </section>

        {/* Multi-omics Integration Strategy */}
        <section className="pt-8" style={{ borderTop: "1px solid var(--border)" }}>
          <h2 className="font-semibold text-lg mb-2" style={{ color: "var(--text)" }}>Multi-omics Integration Strategy</h2>
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            Describe your available data layers and disease to get an AI-powered strategy for novel integration.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Omics layers (comma-separated)</label>
              <input value={multiOmicsLayers} onChange={e => setMultiOmicsLayers(e.target.value)}
                placeholder="e.g. rnaseq, methylation, proteomics, atac"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Disease</label>
              <input value={multiOmicsDisease} onChange={e => setMultiOmicsDisease(e.target.value)}
                placeholder="e.g. colorectal cancer"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
          </div>
          {user ? (
            <button onClick={handleMultiOmics}
              disabled={moLoading || !multiOmicsLayers}
              className="px-6 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
              style={{ background: "#f5f0ff", color: "#7c3aed", border: "1px solid #ddd0ff" }}>
              {moLoading ? "Building strategy…" : "Get Integration Strategy"}
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm"
              style={{ background: "#f5f0ff", border: "1.5px dashed #7c3aed", color: "#7c3aed" }}>
              Sign in to get integration strategy →
            </div>
          )}

          {moResult && (
            <div className="mt-6 space-y-4">
              {/* Summary badge */}
              <div className="rounded-xl p-4" style={{ background: "#f5f0ff", border: "1px solid #ddd0ff" }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#7c3aed" }}>
                  {moResult.integration_method}
                </p>
                <p className="text-sm" style={{ color: "var(--text)" }}>{moResult.executive_summary}</p>
              </div>

              {/* Step-by-step workflow */}
              {moResult.steps?.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Step-by-step workflow</h3>
                  {moResult.steps.map((s: any) => (
                    <div key={s.n} className="rounded-xl p-4 flex gap-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                        style={{ background: "#7c3aed", color: "#fff" }}>{s.n}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{s.title}</p>
                        <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>{s.detail}</p>
                        {s.tools?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {s.tools.map((t: string) => (
                              <span key={t} className="text-xs px-2 py-0.5 rounded font-mono"
                                style={{ background: "#f0ecff", color: "#6020b0" }}>{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Launch button */}
              <a href="/launch?type=multiomics"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "#7c3aed", color: "#fff" }}>
                Launch Multi-omics Pipeline →
              </a>
            </div>
          )}
        </section>
        </div>{/* end left column */}

        {/* ── Right column: auth panel ──────────────────────────────────── */}
        <div className="w-72 shrink-0">
          <div className="sticky top-6">
            {authLoading ? (
              <div className="rounded-2xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto"
                  style={{ borderColor: "var(--flame)", borderTopColor: "transparent" }} />
              </div>
            ) : user ? (
              <UserCard user={user} onSignOut={signOut} links={QUICK_LINKS} />
            ) : (
              <AuthForm onSuccess={refresh} benefits={DISC_BENEFITS} />
            )}
          </div>
        </div>

        </div>{/* end flex row */}
      </div>
    </div>
  );
}

function ResultCard({ title, items, color }: { title: string; items: string[]; color: "gray" | "yellow" | "orange" }) {
  const styleMap = {
    gray:   { border: "1px solid var(--border)", background: "var(--surface)" },
    yellow: { border: "1px solid #f5e0a0", background: "#fffbf0" },
    orange: { border: "1px solid #bee3f8", background: "#edf4fb" },
  };
  const dotMap = {
    gray: "var(--muted)", yellow: "var(--amber)", orange: "#c05800",
  };
  return (
    <div className="rounded-xl p-4" style={styleMap[color]}>
      <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text)" }}>
            <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: dotMap[color] }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
