"use client";

import { useState, useEffect } from "react";
import NavBar from "@/components/NavBar";
import { useAuthOptional } from "@/hooks/useAuthOptional";
import { AuthForm, UserCard } from "@/components/AuthSidePanel";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ── Xena / PCAWG static cohort catalogue ──────────────────────────────── */
const XENA_COHORTS = [
  {
    id: "pcawg_donor",
    name: "PCAWG (donor centric)",
    tag: "PCAWG",
    tagColor: "#7c3aed",
    description: "Pan-Cancer Analysis of Whole Genomes — 2,800 donors across 38 tumor types. Somatic SNV/Indel, SV, CNV, RNA-seq, methylation, mutational signatures, and clinical data.",
    n: "2,800 donors · 38 tumor types",
    data: ["Somatic SNV/Indel", "SV", "Copy number", "RNA-seq", "Methylation", "Mut. signatures", "Clinical"],
    url: "https://xenabrowser.net/datapages/?cohort=PCAWG%20(donor%20centric)&removeHub=https%3A%2F%2Fxena.treehouse.gi.ucsc.edu%3A443",
  },
  {
    id: "pcawg_specimen",
    name: "PCAWG (specimen centric)",
    tag: "PCAWG",
    tagColor: "#7c3aed",
    description: "Same PCAWG cohort organized by tumor specimen (aliquot level). Use when you need per-sample data rather than per-donor.",
    n: "2,800 specimens",
    data: ["Somatic SNV/Indel", "SV", "Copy number", "RNA-seq"],
    url: "https://xenabrowser.net/datapages/?cohort=PCAWG%20(specimen%20centric)&removeHub=https%3A%2F%2Fxena.treehouse.gi.ucsc.edu%3A443",
  },
  {
    id: "tcga_pancan",
    name: "TCGA Pan-Cancer Atlas (PANCAN)",
    tag: "TCGA",
    tagColor: "#0891b2",
    description: "All 33 TCGA cancer types unified. 11,000+ patients. RNA-seq, DNA methylation, CNV, somatic mutations, clinical, protein (RPPA), miRNA.",
    n: "11,160 patients · 33 cancer types",
    data: ["RNA-seq", "DNA methylation", "CNV", "Somatic SNV", "Clinical", "RPPA protein", "miRNA"],
    url: "https://xenabrowser.net/datapages/?cohort=TCGA%20Pan-Cancer%20(PANCAN)",
  },
  {
    id: "gtex",
    name: "GTEx v8 (Normal tissue expression)",
    tag: "GTEx",
    tagColor: "#16a34a",
    description: "Genotype-Tissue Expression — RNA-seq from 17,382 samples across 54 non-diseased tissues from 948 donors. The gold-standard reference for normal tissue expression.",
    n: "17,382 samples · 54 tissues · 948 donors",
    data: ["RNA-seq (TPM)", "Splicing (sQTL)", "eQTLs", "Methylation"],
    url: "https://xenabrowser.net/datapages/?cohort=GTEx",
  },
  {
    id: "target",
    name: "TARGET (Pediatric Cancer)",
    tag: "TARGET",
    tagColor: "#dc2626",
    description: "Therapeutically Applicable Research to Generate Effective Treatments — pediatric ALL, AML, neuroblastoma, Wilms tumor, osteosarcoma. WGS, RNA-seq, methylation.",
    n: "~1,400 pediatric patients",
    data: ["RNA-seq", "WGS", "Methylation", "miRNA", "Clinical"],
    url: "https://xenabrowser.net/datapages/?cohort=TARGET%20(TARGET%20PANCAN)",
  },
  {
    id: "ccle",
    name: "CCLE — Cancer Cell Line Encyclopedia",
    tag: "Cell lines",
    tagColor: "#f05808",
    description: "RNA-seq, CNV, mutation, and drug sensitivity profiles of 1,019 cancer cell lines across 36 tumor types. Essential for in-vitro validation studies.",
    n: "1,019 cell lines · 36 tumor types",
    data: ["RNA-seq", "CNV", "Somatic SNV", "Drug sensitivity", "Protein (RPPA)"],
    url: "https://xenabrowser.net/datapages/?cohort=Cancer%20Cell%20Line%20Encyclopedia%20(CCLE%202019)",
  },
  {
    id: "hca_lung",
    name: "Human Cell Atlas — Lung (COVID-19 + normal)",
    tag: "HCA",
    tagColor: "#b46309",
    description: "scRNA-seq atlas of normal and COVID-19 lung tissue. Cell type reference for all human lung cell populations.",
    n: "~500,000 cells",
    data: ["scRNA-seq", "Cell type atlas", "COVID-19"],
    url: "https://xenabrowser.net/datapages/?cohort=HMLN%20-%20Human%20Lung%20Cell%20Atlas",
  },
];

const ANALYSIS_ICONS: Record<string, string> = {
  rnaseq: "🧬", wgs: "🔬", wes: "🎯", scrnaseq: "🔵", methylation: "🧪",
  chipseq: "📍", atacseq: "🌊", microbiome: "🦠", proteomics: "🔩",
  immune_profiling: "🛡", ctdna: "💧", riboseq: "⚙️", multiomics: "🔗",
};

/* Analyses possible when combining public + user data */
const COMPARISON_ANALYSES = [
  { id: "deg",         icon: "📊", label: "Differential Expression",    desc: "Which genes change between your patients and public controls?" },
  { id: "pathway",     icon: "🗺️", label: "Pathway Enrichment",         desc: "Which biological pathways are dysregulated (GSEA, KEGG, GO)?" },
  { id: "survival",    icon: "⏳", label: "Survival Analysis",           desc: "Do expression patterns correlate with patient outcomes?" },
  { id: "batch",       icon: "🧹", label: "Batch Correction + QC",      desc: "Harmonize your data with public data before comparing (ComBat-seq)." },
  { id: "integration", icon: "🔗", label: "Dataset Integration",         desc: "Merge datasets into a unified atlas (Harmony, Seurat, scVI)." },
  { id: "deconvolution",icon: "🧬",label: "Cell Type Deconvolution",    desc: "Estimate cell proportions in bulk RNA-seq (CIBERSORTx, MuSiC)." },
  { id: "cnv",         icon: "📈", label: "Copy Number Comparison",     desc: "Compare CNV profiles between your cohort and TCGA." },
  { id: "biomarker",   icon: "🎯", label: "Biomarker Discovery",        desc: "Find genes/signatures that distinguish your patients from controls." },
];

export default function PublicDataPage() {
  const { user, loading: authLoading, signOut, refresh } = useAuthOptional();
  const [disease, setDisease]     = useState("");
  const [tissue, setTissue]       = useState("");
  const [analysisType, setAnalysisType] = useState("rnaseq");
  const [geoQuery, setGeoQuery]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [geoResults, setGeoResults] = useState<any[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [databases, setDatabases] = useState<any[]>([]);
  const [error, setError]         = useState<string | null>(null);

  /* Multi-database search state */
  type DbTab = "geo" | "tcga" | "cbioportal" | "xena";
  const [activeDb, setActiveDb]         = useState<DbTab>("geo");
  const [gdcQuery, setGdcQuery]         = useState("");
  const [gdcResults, setGdcResults]     = useState<any[]>([]);
  const [gdcLoading, setGdcLoading]     = useState(false);
  const [cbiQuery, setCbiQuery]         = useState("");
  const [cbiResults, setCbiResults]     = useState<any[]>([]);
  const [cbiLoading, setCbiLoading]     = useState(false);
  const [xenaFilter, setXenaFilter]     = useState("");

  /* Comparison flow state */
  const [selectedDatasets, setSelectedDatasets] = useState<any[]>([]);
  const [showCompare, setShowCompare]   = useState(false);
  const [compareAnalyses, setCompareAnalyses] = useState<string[]>([]);
  const [localDataPath, setLocalDataPath] = useState("");
  const [permissionGiven, setPermissionGiven] = useState(false);
  const [planLoading, setPlanLoading]   = useState(false);
  const [comparisonPlan, setComparisonPlan] = useState<any>(null);
  const [planError, setPlanError]       = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/public-data/databases`)
      .then(r => r.json()).then(setDatabases).catch(() => {});
  }, []);

  async function handleRecommend() {
    if (!disease) return;
    setLoading(true); setError(null); setRecommendations(null);
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 30000);
      const r = await fetch(`${BASE}/api/public-data/recommend-controls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis_type: analysisType, disease_context: disease, tissue }),
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      setRecommendations(await r.json());
    } catch (e: any) {
      if (e.name === "AbortError") {
        setError("AI recommendation timed out. Try the GEO search below — it queries NCBI directly.");
      } else {
        setError(`Could not reach backend: ${e.message}. Try the GEO search below instead.`);
      }
    }
    finally { setLoading(false); }
  }

  async function handleGeoSearch() {
    if (!geoQuery) return;
    setGeoLoading(true);
    setGeoResults([]);
    try {
      // Call NCBI eutils directly from the browser — no backend needed, CORS-enabled
      const searchRes = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=gds&term=${encodeURIComponent(geoQuery)}&retmax=20&retmode=json&sort=relevance`
      );
      const searchData = await searchRes.json();
      const ids: string[] = searchData.esearchresult?.idlist ?? [];
      if (ids.length === 0) { setGeoResults([]); return; }

      const summaryRes = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gds&id=${ids.slice(0, 12).join(",")}&retmode=json`
      );
      const summaryData = await summaryRes.json();
      const r = summaryData.result ?? {};

      setGeoResults(
        ids.slice(0, 12)
          .filter(id => r[id] && !r[id].error)
          .map(id => {
            const s = r[id];
            const acc = s.accession ?? "";
            return {
              accession: acc,
              title: s.title ?? "Untitled dataset",
              summary: (s.summary ?? "").slice(0, 400),
              n_samples: s.n_samples,
              pdat: s.pdat,
              url: acc
                ? `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${acc}`
                : `https://www.ncbi.nlm.nih.gov/gds/?term=${id}[uid]`,
            };
          })
      );
    } catch {
      setGeoResults([]);
      setError("NCBI search failed. Check your internet connection.");
    }
    finally { setGeoLoading(false); }
  }

  /* GDC / TCGA API search ─────────────────────────────────────────────── */
  async function handleGdcSearch() {
    if (!gdcQuery.trim()) return;
    setGdcLoading(true); setGdcResults([]);
    try {
      const res = await fetch(
        `https://api.gdc.cancer.gov/projects?from=0&size=200&format=json` +
        `&fields=project_id,name,disease_type,primary_site,dbgap_accession_number,summary.case_count,summary.file_count,summary.data_categories`
      );
      const data = await res.json();
      const hits: any[] = data?.data?.hits ?? [];

      // Token-based matching: "breast cancer" → strip generic words → ["breast"]
      // so it matches "Breast Invasive Carcinoma", "Breast" primary site, etc.
      const STOP = new Set(["cancer","tumor","tumour","disease","syndrome","the","a","an","and","or","with","of","in","for","type","study","human","primary","malignant","benign","invasive","carcinoma","adenocarcinoma","sarcoma","lymphoma","leukemia"]);
      const rawTokens = gdcQuery.toLowerCase().split(/[\s,\-]+/).filter(t => t.length > 1);
      const tokens = rawTokens.filter(t => !STOP.has(t));
      const searchTokens = tokens.length > 0 ? tokens : rawTokens;

      const filtered = hits.filter(p => {
        const searchable = [
          p.name ?? "",
          p.project_id ?? "",
          ...(p.disease_type ?? []),
          ...(p.primary_site ?? []),
        ].join(" ").toLowerCase();
        return searchTokens.some(t => searchable.includes(t));
      });

      setGdcResults(filtered.slice(0, 30).map(p => ({
        id: p.project_id,
        title: p.name,
        project_id: p.project_id,
        disease_type: p.disease_type ?? [],
        primary_site: p.primary_site ?? [],
        n_cases: p.summary?.case_count,
        n_files: p.summary?.file_count,
        data_categories: p.summary?.data_categories?.map((c: any) => c.data_category) ?? [],
        dbgap: p.dbgap_accession_number,
        url: `https://portal.gdc.cancer.gov/projects/${p.project_id}`,
      })));
    } catch (e: any) {
      setGdcResults([]);
    } finally { setGdcLoading(false); }
  }

  /* cBioPortal API search ──────────────────────────────────────────────── */
  async function handleCbiSearch() {
    if (!cbiQuery.trim()) return;
    setCbiLoading(true); setCbiResults([]);
    try {
      const res = await fetch(
        `https://www.cbioportal.org/api/studies?keyword=${encodeURIComponent(cbiQuery)}&pageSize=20&sortBy=studyId&direction=ASC`,
        { headers: { Accept: "application/json" } }
      );
      const studies: any[] = await res.json();
      setCbiResults(studies.map(s => ({
        id: s.studyId,
        title: s.name,
        description: s.description,
        cancer_type: s.cancerTypeId,
        n_cases: s.allSampleCount,
        citation: s.citation,
        pmid: s.pmid,
        url: `https://www.cbioportal.org/study/summary?id=${s.studyId}`,
        groups: s.groups,
      })));
    } catch { setCbiResults([]); }
    finally { setCbiLoading(false); }
  }

  function toggleDataset(dataset: any) {
    setSelectedDatasets(prev => {
      const exists = prev.some(d => d.accession === dataset.accession || d.id === dataset.id);
      return exists ? prev.filter(d => (d.accession || d.id) !== (dataset.accession || dataset.id)) : [...prev, dataset];
    });
  }

  function isSelected(dataset: any) {
    return selectedDatasets.some(d => (d.accession || d.id) === (dataset.accession || dataset.id));
  }

  async function handleGeneratePlan() {
    if (!permissionGiven || selectedDatasets.length === 0 || compareAnalyses.length === 0) return;
    setPlanLoading(true); setPlanError(null); setComparisonPlan(null);
    try {
      const r = await fetch(`${BASE}/api/public-data/comparison-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_dataset: selectedDatasets[0],
          user_analysis_type: analysisType,
          user_disease: disease,
          selected_analyses: compareAnalyses,
          local_data_path: localDataPath,
        }),
      });
      setComparisonPlan(await r.json());
    } catch (e: any) { setPlanError(e.message); }
    finally { setPlanLoading(false); }
  }

  /* Reusable result card with "Add to comparison" button */
  function DatasetCard({ dataset, label }: { dataset: any; label?: string }) {
    const sel = isSelected(dataset);
    return (
      <div className="rounded-xl p-4 transition-all"
        style={{
          background: sel ? "#fff8f3" : "var(--surface)",
          border: sel ? "1px solid var(--flame)" : "1px solid var(--border)",
        }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {dataset.accession && (
                <a href={dataset.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-mono hover:underline" style={{ color: "#3355cc" }}>
                  {dataset.accession}
                </a>
              )}
              {dataset.project && (
                <a href={dataset.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-mono hover:underline" style={{ color: "#3355cc" }}>
                  {dataset.project}
                </a>
              )}
              {dataset.n_samples && <span className="text-xs" style={{ color: "var(--dim)" }}>n={dataset.n_samples}</span>}
              {dataset.n_cases && <span className="text-xs" style={{ color: "var(--dim)" }}>n={dataset.n_cases} cases</span>}
              {dataset.n_cells && <span className="text-xs" style={{ color: "var(--dim)" }}>{dataset.n_cells?.toLocaleString()} cells</span>}
              {dataset.pdat && <span className="text-xs ml-auto" style={{ color: "var(--dim)" }}>{dataset.pdat}</span>}
              {label && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#f3f0e8", color: "var(--muted)" }}>{label}</span>}
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
              {dataset.title || dataset.name || dataset.project}
            </p>
            {dataset.summary && (
              <p className="text-xs line-clamp-2" style={{ color: "var(--muted)" }}>{dataset.summary}</p>
            )}
            {dataset.disease_type?.length > 0 && (
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{dataset.disease_type.join(", ")}</p>
            )}
          </div>
          <button
            onClick={() => toggleDataset(dataset)}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={
              sel
                ? { background: "var(--flame)", color: "#fff" }
                : { background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--muted)" }
            }>
            {sel ? "✓ Selected" : "+ Compare"}
          </button>
        </div>
      </div>
    );
  }

  const QUICK_LINKS = [
    { href: "/tools",      label: "🔬 Tool Finder" },
    { href: "/discovery",  label: "🔭 AI Discovery" },
    { href: "/multiomics", label: "🔗 Multi-Omics" },
    { href: "/replicate",  label: "🧪 Replicate Check" },
  ];

  const DATA_BENEFITS = [
    "Save dataset comparisons across sessions",
    "Generate AI-powered comparison plans",
    "Track download and pipeline history",
    "Access 15+ public genomic databases",
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)", color: "var(--text)" }}>
      <NavBar active="/data" user={user} onSignOut={signOut} />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-8 items-start">

        {/* ── Left column ────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-10">
        <div>
          <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text)" }}>Public Control Datasets</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Find matching public controls from GEO, TCGA, GTEx, HCA, and 15+ databases.
            Select any dataset to compare with your patient data — all analysis runs locally.
          </p>
        </div>

        {/* ── Selected datasets bar ── */}
        {selectedDatasets.length > 0 && !showCompare && (
          <div className="rounded-2xl p-4 flex items-center justify-between gap-4"
            style={{ background: "#fff8f3", border: "1px solid var(--flame)" }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--flame)" }}>
                {selectedDatasets.length} dataset{selectedDatasets.length > 1 ? "s" : ""} selected for comparison
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                {selectedDatasets.map(d => d.accession || d.project || d.id).join(", ")}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedDatasets([])}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                Clear
              </button>
              {user ? (
                <button onClick={() => setShowCompare(true)}
                  className="text-xs px-4 py-1.5 rounded-lg font-semibold"
                  style={{ background: "var(--flame)", color: "#fff" }}>
                  Compare with my data →
                </button>
              ) : (
                <span className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: "#fff8f3", border: "1px dashed var(--flame)", color: "var(--flame)" }}>
                  Sign in to compare →
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Comparison wizard ── */}
        {showCompare && (
          <div className="rounded-2xl p-6 space-y-6"
            style={{ background: "var(--surface)", border: "2px solid var(--flame)" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg" style={{ color: "var(--text)" }}>
                Compare Public Data with My Patient Data
              </h2>
              <button onClick={() => { setShowCompare(false); setComparisonPlan(null); }}
                className="text-xs" style={{ color: "var(--muted)" }}>✕ Close</button>
            </div>

            {/* Selected datasets summary */}
            <div className="space-y-2">
              <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>PUBLIC DATASETS TO DOWNLOAD</p>
              {selectedDatasets.map(d => (
                <div key={d.accession || d.id} className="flex items-center gap-3 text-sm rounded-lg px-3 py-2"
                  style={{ background: "var(--canvas)", border: "1px solid var(--border)" }}>
                  <span className="font-mono text-xs" style={{ color: "#3355cc" }}>
                    {d.accession || d.project || d.id}
                  </span>
                  <span style={{ color: "var(--text)" }}>{d.title || d.name}</span>
                </div>
              ))}
              <div className="rounded-lg px-3 py-2 text-xs"
                style={{ background: "#f0f4ff", border: "1px solid #d0dcff", color: "#3355cc" }}>
                🔒 These datasets will be <strong>downloaded to your local machine</strong>.
                Your patient data is never uploaded — all comparison analysis runs locally.
              </div>
            </div>

            {/* What analyses do you want? */}
            <div>
              <p className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>
                What analyses would you like to run?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COMPARISON_ANALYSES.map(a => {
                  const sel = compareAnalyses.includes(a.id);
                  return (
                    <button key={a.id}
                      onClick={() => setCompareAnalyses(prev => sel ? prev.filter(x => x !== a.id) : [...prev, a.id])}
                      className="text-left p-3 rounded-xl transition-all"
                      style={
                        sel
                          ? { background: "#fff8f3", border: "1px solid var(--flame)" }
                          : { background: "var(--canvas)", border: "1px solid var(--border)" }
                      }>
                      <div className="flex items-start gap-2">
                        <span>{a.icon}</span>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: sel ? "var(--flame)" : "var(--text)" }}>
                            {a.label}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{a.desc}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Context */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>
                  Your local data folder (optional)
                </label>
                <input value={localDataPath} onChange={e => setLocalDataPath(e.target.value)}
                  placeholder="/Users/you/data/patients/"
                  className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Disease / phenotype</label>
                <input value={disease} onChange={e => setDisease(e.target.value)}
                  placeholder="e.g. breast cancer"
                  className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
              </div>
            </div>

            {/* Permission checkbox */}
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl"
              style={{ background: "#fffbf0", border: "1px solid #f5e0a0" }}>
              <input type="checkbox" checked={permissionGiven} onChange={e => setPermissionGiven(e.target.checked)}
                className="mt-0.5 w-4 h-4" style={{ accentColor: "var(--flame)" }} />
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                <strong style={{ color: "var(--text)" }}>I confirm:</strong> The public datasets listed above
                will be downloaded to <em>my local machine only</em>. I will use them solely for academic
                research and comply with the data use terms of each repository (GEO: unrestricted;
                TCGA open-access: unrestricted; TCGA controlled-access: requires dbGaP approval).
                No patient data will be transferred to any external server.
              </div>
            </label>

            <button onClick={handleGeneratePlan}
              disabled={planLoading || !permissionGiven || compareAnalyses.length === 0}
              className="px-6 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
              style={{ background: "var(--flame)", color: "#fff" }}>
              {planLoading ? "Building comparison plan..." : "Generate Download + Analysis Plan →"}
            </button>

            {planError && (
              <div className="rounded-lg p-3 text-sm"
                style={{ background: "#fff0f0", border: "1px solid #f5b0b0", color: "#c0392b" }}>
                {planError}
              </div>
            )}

            {/* Comparison plan output */}
            {comparisonPlan && (
              <div className="space-y-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <h3 className="font-semibold" style={{ color: "var(--text)" }}>Your Comparison Plan</h3>

                {comparisonPlan.dataset_summary && (
                  <div className="rounded-xl p-3 text-sm" style={{ background: "#f0f4ff", border: "1px solid #d0dcff" }}>
                    {comparisonPlan.dataset_summary}
                  </div>
                )}

                {/* Download instructions */}
                {comparisonPlan.download_instructions?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>
                      STEP 1 — DOWNLOAD TO YOUR MACHINE
                    </p>
                    <div className="space-y-3">
                      {comparisonPlan.download_instructions.map((step: any, i: number) => (
                        <div key={i} className="rounded-xl p-4"
                          style={{ background: "var(--canvas)", border: "1px solid var(--border)" }}>
                          <div className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold shrink-0 mt-0.5"
                              style={{ background: "var(--flame)", color: "#fff" }}>{step.step}</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>{step.description}</p>
                              <code className="block text-xs rounded px-3 py-2 overflow-x-auto"
                                style={{ background: "#1c1a16", color: "#c8c4b8" }}>
                                {step.command}
                              </code>
                              {step.estimated_size_gb && (
                                <p className="text-xs mt-1" style={{ color: "var(--dim)" }}>
                                  ~{step.estimated_size_gb} GB download
                                </p>
                              )}
                              {step.install_command && (
                                <details className="mt-1">
                                  <summary className="text-xs cursor-pointer" style={{ color: "var(--amber)" }}>
                                    Install {step.tool_required}
                                  </summary>
                                  <code className="block text-xs rounded px-2 py-1 mt-1"
                                    style={{ background: "#1c1a16", color: "#c8c4b8" }}>
                                    {step.install_command}
                                  </code>
                                </details>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Analysis plans */}
                {comparisonPlan.analyses?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>
                      STEP 2 — ANALYSIS PIPELINES
                    </p>
                    <div className="space-y-3">
                      {comparisonPlan.analyses.map((a: any, i: number) => (
                        <div key={i} className="rounded-xl p-4"
                          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{a.name}</p>
                            {a.estimated_time && (
                              <span className="text-xs shrink-0" style={{ color: "var(--dim)" }}>⏱ {a.estimated_time}</span>
                            )}
                          </div>
                          <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>{a.question}</p>
                          {a.steps?.length > 0 && (
                            <ol className="space-y-1 mb-2">
                              {a.steps.map((s: string, j: number) => (
                                <li key={j} className="text-xs flex gap-2" style={{ color: "var(--muted)" }}>
                                  <span style={{ color: "var(--flame)" }}>{j + 1}.</span> {s}
                                </li>
                              ))}
                            </ol>
                          )}
                          {a.tools?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {a.tools.map((t: string) => (
                                <span key={t} className="text-xs px-1.5 py-0.5 rounded"
                                  style={{ background: "#fff8f3", color: "var(--flame)", border: "1px solid #ffe4d0" }}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          {a.batch_correction_needed && (
                            <p className="text-xs mt-2" style={{ color: "var(--amber)" }}>
                              ⚠ Batch correction required — use {a.batch_correction_tool}
                            </p>
                          )}
                          {a.key_output && (
                            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                              📤 Output: {a.key_output}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {comparisonPlan.statistical_notes && (
                  <div className="rounded-xl p-4 text-sm"
                    style={{ background: "#fffbf0", border: "1px solid #f5e0a0" }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: "var(--amber)" }}>Statistical notes</p>
                    <p style={{ color: "var(--text)" }}>{comparisonPlan.statistical_notes}</p>
                  </div>
                )}

                <button onClick={() => window.location.href = "/replicate"}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium"
                  style={{ background: "var(--flame)", color: "#fff" }}>
                  Run this comparison pipeline →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Control recommender ── */}
        <div className="rounded-2xl p-6 space-y-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="font-semibold" style={{ color: "var(--text)" }}>Find Controls for My Study</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Disease / phenotype</label>
              <input value={disease} onChange={e => setDisease(e.target.value)}
                placeholder="e.g. breast cancer, Alzheimer, IBD"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Tissue (optional)</label>
              <input value={tissue} onChange={e => setTissue(e.target.value)}
                placeholder="e.g. lung, blood, colon"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Analysis type</label>
              <select value={analysisType} onChange={e => setAnalysisType(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }}>
                {Object.entries(ANALYSIS_ICONS).map(([k]) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>
          <button onClick={handleRecommend} disabled={loading || !disease}
            className="px-6 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
            style={{ background: "var(--flame)", color: "#fff" }}>
            {loading ? "Searching databases..." : "Find Public Controls"}
          </button>
        </div>

        {error && (
          <div className="rounded-lg p-4 text-sm"
            style={{ background: "#fff0f0", border: "1px solid #f5c0c0", color: "#c0392b" }}>
            {error}
          </div>
        )}

        {/* Recommendations */}
        {recommendations && (
          <div className="space-y-5">
            {recommendations.primary_controls?.length > 0 && (
              <div>
                <h2 className="font-semibold text-lg mb-3" style={{ color: "var(--text)" }}>
                  Recommended Controls
                  <span className="text-sm font-normal ml-2" style={{ color: "var(--muted)" }}>
                    — click "+ Compare" to add any to your comparison
                  </span>
                </h2>
                <div className="space-y-3">
                  {recommendations.primary_controls.map((c: any, i: number) => (
                    <div key={i} className="rounded-xl p-4"
                      style={{
                        background: isSelected(c) ? "#fff8f3" : "var(--surface)",
                        border: isSelected(c) ? "1px solid var(--flame)" : "1px solid var(--border)",
                      }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{c.database}</span>
                            {c.accession && (
                              <span className="text-xs font-mono" style={{ color: "#3355cc" }}>{c.accession}</span>
                            )}
                            {c.n_samples && <span className="text-xs" style={{ color: "var(--dim)" }}>n={c.n_samples}</span>}
                            {c.tissue && (
                              <span className="text-xs px-1.5 py-0.5 rounded"
                                style={{ background: "#f3f0e8", color: "var(--muted)" }}>{c.tissue}</span>
                            )}
                            <span className="text-xs ml-auto" style={{ color: "var(--dim)" }}>Priority {c.priority}</span>
                          </div>
                          <p className="text-sm" style={{ color: "var(--text)" }}>{c.why_recommended}</p>
                          {c.limitations && (
                            <p className="text-xs mt-1" style={{ color: "var(--amber)" }}>⚠ {c.limitations}</p>
                          )}
                          {c.download_command && (
                            <code className="block text-xs rounded px-2 py-1 mt-2 overflow-x-auto"
                              style={{ background: "#1c1a16", color: "#c8c4b8" }}>
                              {c.download_command}
                            </code>
                          )}
                        </div>
                        <button onClick={() => toggleDataset({ ...c, title: c.database, accession: c.accession || c.database })}
                          className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                          style={
                            isSelected({ accession: c.accession || c.database })
                              ? { background: "var(--flame)", color: "#fff" }
                              : { background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--muted)" }
                          }>
                          {isSelected({ accession: c.accession || c.database }) ? "✓ Selected" : "+ Compare"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TCGA cohorts */}
            {recommendations.tcga_cohorts?.length > 0 && (
              <div>
                <h2 className="font-semibold mb-3" style={{ color: "var(--text)" }}>TCGA Cohorts (open-access)</h2>
                <div className="space-y-2">
                  {recommendations.tcga_cohorts.filter((r: any) => !r.error).map((r: any, i: number) => (
                    <DatasetCard key={i} dataset={r} label="TCGA" />
                  ))}
                </div>
              </div>
            )}

            {/* Live GEO results */}
            {recommendations.live_geo_search?.length > 0 && (
              <div>
                <h2 className="font-semibold mb-3" style={{ color: "var(--text)" }}>Live GEO Results</h2>
                <div className="space-y-2">
                  {recommendations.live_geo_search.filter((r: any) => !r.error).map((r: any, i: number) => (
                    <DatasetCard key={i} dataset={r} />
                  ))}
                </div>
              </div>
            )}

            {recommendations.gap_in_available_data && (
              <div className="rounded-xl p-4"
                style={{ background: "#f0f4ff", border: "1px solid #d0dcff" }}>
                <p className="text-xs font-medium mb-1" style={{ color: "#3355cc" }}>Gap in Available Public Data</p>
                <p className="text-sm" style={{ color: "var(--text)" }}>{recommendations.gap_in_available_data}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Multi-database direct search ── */}
        <div className="pt-8" style={{ borderTop: "1px solid var(--border)" }}>
          <h2 className="font-semibold mb-1" style={{ color: "var(--text)" }}>Search Public Databases</h2>
          <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
            Query GEO, TCGA/GDC, cBioPortal, or browse curated Xena/PCAWG cohorts — all from the browser, no login required.
          </p>

          {/* Tab bar */}
          <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {([ ["geo", "GEO", "4M+ samples"], ["tcga", "TCGA / GDC", "33 cancer types"], ["cbioportal", "cBioPortal", "350+ studies"], ["xena", "Xena / PCAWG", "Curated cohorts"] ] as const).map(
              ([id, label, sub]) => (
                <button key={id} onClick={() => setActiveDb(id as DbTab)}
                  className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
                  style={activeDb === id
                    ? { background: "var(--flame)", color: "#fff" }
                    : { color: "var(--muted)" }}>
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-[10px] opacity-70">{sub}</span>
                </button>
              )
            )}
          </div>

          {/* GEO tab */}
          {activeDb === "geo" && (
            <div>
              <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
                NCBI Gene Expression Omnibus — the world's largest public genomics repository. Results link directly to GEO.
              </p>
              <div className="flex gap-2">
                <input value={geoQuery} onChange={e => setGeoQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleGeoSearch()}
                  placeholder="e.g. single cell lung cancer 10x, breast cancer RNA-seq normal"
                  className="flex-1 rounded-lg px-4 py-3 text-sm focus:outline-none"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
                <button onClick={handleGeoSearch} disabled={geoLoading || !geoQuery}
                  className="px-5 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                  style={{ background: "var(--flame)", color: "#fff" }}>
                  {geoLoading ? "Searching..." : "Search"}
                </button>
              </div>
              {geoResults.length > 0 && (
                <div className="mt-4 space-y-2">
                  {geoResults.filter((r: any) => !r.error).map((r: any, i: number) => (
                    <DatasetCard key={i} dataset={r} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TCGA / GDC tab */}
          {activeDb === "tcga" && (
            <div>
              <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
                Search all GDC/TCGA projects by cancer type, primary site, or project ID (e.g. "lung", "TCGA-BRCA", "kidney").
                Processed data is open access; raw WGS/WES requires dbGaP approval.
              </p>
              <div className="flex gap-2">
                <input value={gdcQuery} onChange={e => setGdcQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleGdcSearch()}
                  placeholder="e.g. breast, lung, TCGA-BLCA, glioblastoma"
                  className="flex-1 rounded-lg px-4 py-3 text-sm focus:outline-none"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
                <button onClick={handleGdcSearch} disabled={gdcLoading || !gdcQuery.trim()}
                  className="px-5 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                  style={{ background: "var(--flame)", color: "#fff" }}>
                  {gdcLoading ? "Searching..." : "Search"}
                </button>
              </div>
              {gdcResults.length > 0 && (
                <div className="mt-4 space-y-2">
                  {gdcResults.map((p, i) => (
                    <div key={i} className="rounded-xl p-4 transition-all"
                      style={{
                        background: isSelected(p) ? "#fff8f3" : "var(--surface)",
                        border: isSelected(p) ? "1px solid var(--flame)" : "1px solid var(--border)",
                      }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <a href={p.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs font-mono font-semibold hover:underline" style={{ color: "#3355cc" }}>
                              {p.project_id}
                            </a>
                            {p.n_cases && <span className="text-xs" style={{ color: "var(--dim)" }}>{p.n_cases.toLocaleString()} cases</span>}
                            {p.n_files && <span className="text-xs" style={{ color: "var(--dim)" }}>{p.n_files.toLocaleString()} files</span>}
                            {p.dbgap && <span className="text-xs font-mono" style={{ color: "var(--dim)" }}>{p.dbgap}</span>}
                          </div>
                          <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>{p.title}</p>
                          {p.primary_site.length > 0 && (
                            <p className="text-xs" style={{ color: "var(--muted)" }}>
                              Primary site: {p.primary_site.join(", ")}
                            </p>
                          )}
                          {p.data_categories.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {p.data_categories.map((c: string) => (
                                <span key={c} className="text-xs px-1.5 py-0.5 rounded"
                                  style={{ background: "#f0f4ff", color: "#3355cc", border: "1px solid #d0dcff" }}>
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button onClick={() => toggleDataset(p)}
                          className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                          style={isSelected(p)
                            ? { background: "var(--flame)", color: "#fff" }
                            : { background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                          {isSelected(p) ? "✓ Selected" : "+ Compare"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {gdcLoading === false && gdcQuery && gdcResults.length === 0 && (
                <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>No GDC projects matched. Try a broader term.</p>
              )}
            </div>
          )}

          {/* cBioPortal tab */}
          {activeDb === "cbioportal" && (
            <div>
              <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
                cBioPortal hosts 350+ curated cancer genomics studies with mutation, CNA, expression, and clinical data.
                All data is open-access.
              </p>
              <div className="flex gap-2">
                <input value={cbiQuery} onChange={e => setCbiQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCbiSearch()}
                  placeholder="e.g. breast invasive, msk impact, prostate, glioblastoma"
                  className="flex-1 rounded-lg px-4 py-3 text-sm focus:outline-none"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
                <button onClick={handleCbiSearch} disabled={cbiLoading || !cbiQuery.trim()}
                  className="px-5 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                  style={{ background: "var(--flame)", color: "#fff" }}>
                  {cbiLoading ? "Searching..." : "Search"}
                </button>
              </div>
              {cbiResults.length > 0 && (
                <div className="mt-4 space-y-2">
                  {cbiResults.map((s, i) => (
                    <div key={i} className="rounded-xl p-4 transition-all"
                      style={{
                        background: isSelected(s) ? "#fff8f3" : "var(--surface)",
                        border: isSelected(s) ? "1px solid var(--flame)" : "1px solid var(--border)",
                      }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <a href={s.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs font-mono hover:underline" style={{ color: "#3355cc" }}>
                              {s.id}
                            </a>
                            {s.cancer_type && (
                              <span className="text-xs px-1.5 py-0.5 rounded"
                                style={{ background: "#fff0f8", color: "#8b1a5e", border: "1px solid #f0c0e0" }}>
                                {s.cancer_type}
                              </span>
                            )}
                            {s.n_cases && <span className="text-xs" style={{ color: "var(--dim)" }}>n={s.n_cases.toLocaleString()}</span>}
                          </div>
                          <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>{s.title}</p>
                          {s.description && (
                            <p className="text-xs line-clamp-2" style={{ color: "var(--muted)" }}>{s.description}</p>
                          )}
                          {s.citation && (
                            <p className="text-xs mt-1" style={{ color: "var(--dim)" }}>
                              {s.citation}
                              {s.pmid && (
                                <a href={`https://pubmed.ncbi.nlm.nih.gov/${s.pmid}`} target="_blank" rel="noopener noreferrer"
                                  className="ml-2 hover:underline" style={{ color: "#3355cc" }}>
                                  PMID:{s.pmid}
                                </a>
                              )}
                            </p>
                          )}
                        </div>
                        <button onClick={() => toggleDataset(s)}
                          className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                          style={isSelected(s)
                            ? { background: "var(--flame)", color: "#fff" }
                            : { background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                          {isSelected(s) ? "✓ Selected" : "+ Compare"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!cbiLoading && cbiQuery && cbiResults.length === 0 && (
                <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>No studies found. Try broader keywords.</p>
              )}
            </div>
          )}

          {/* Xena / PCAWG tab */}
          {activeDb === "xena" && (
            <div>
              <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
                Curated landmark cohorts available on UCSC Xena Browser — including PCAWG (Pan-Cancer Whole Genome), TCGA Pan-Cancer Atlas, GTEx, and more.
                Click a cohort to open it directly in Xena.
              </p>
              <input value={xenaFilter} onChange={e => setXenaFilter(e.target.value)}
                placeholder="Filter cohorts (e.g. TCGA, PCAWG, single cell, GTEx)..."
                className="w-full rounded-lg px-4 py-3 text-sm mb-4 focus:outline-none"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
              <div className="space-y-3">
                {XENA_COHORTS
                  .filter(c => !xenaFilter || c.name.toLowerCase().includes(xenaFilter.toLowerCase()) || c.description.toLowerCase().includes(xenaFilter.toLowerCase()) || c.tag.toLowerCase().includes(xenaFilter.toLowerCase()))
                  .map(c => (
                  <div key={c.id} className="rounded-xl p-4 transition-all"
                    style={{
                      background: isSelected(c) ? "#fff8f3" : "var(--surface)",
                      border: isSelected(c) ? "1px solid var(--flame)" : "1px solid var(--border)",
                    }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs px-2 py-0.5 rounded font-semibold"
                            style={{ background: c.tagColor + "20", color: c.tagColor, border: `1px solid ${c.tagColor}50` }}>
                            {c.tag}
                          </span>
                          <span className="text-xs" style={{ color: "var(--dim)" }}>{c.n}</span>
                        </div>
                        <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>{c.name}</p>
                        <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>{c.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {c.data.map(d => (
                            <span key={d} className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: "#f3f0e8", color: "var(--muted)" }}>{d}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <a href={c.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 rounded-lg font-medium text-center"
                          style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "#3355cc" }}>
                          Open in Xena →
                        </a>
                        <button onClick={() => toggleDataset(c)}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={isSelected(c)
                            ? { background: "var(--flame)", color: "#fff" }
                            : { background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                          {isSelected(c) ? "✓ Selected" : "+ Compare"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Database directory ── */}
        <div className="pt-8" style={{ borderTop: "1px solid var(--border)" }}>
          <h2 className="font-semibold mb-1" style={{ color: "var(--text)" }}>All Supported Databases</h2>
          <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
            All are publicly accessible for academic research. GEO, GTEx, HCA, ENCODE, Expression Atlas are fully open.
            TCGA requires dbGaP approval only for raw sequencing files — processed data is open.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {databases.map((db: any) => (
              <div key={db.id} className="rounded-xl p-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between">
                  <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{db.name}</span>
                  <div className="flex gap-1">
                    {db.free && (
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: "#fff8f3", color: "var(--flame)" }}>Free</span>
                    )}
                    {db.registration_required && (
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: "#fffbf0", color: "var(--amber)" }}>Reg. required</span>
                    )}
                  </div>
                </div>
                <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--muted)" }}>{db.description}</p>
                {db.best_for && (
                  <p className="text-xs mt-1" style={{ color: "#3355cc" }}>{db.best_for}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {db.analysis_types?.map((t: string) => (
                    <span key={t} className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "#f3f0e8", color: "var(--muted)" }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
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
              <AuthForm onSuccess={refresh} benefits={DATA_BENEFITS} />
            )}
          </div>
        </div>

        </div>{/* end flex row */}
      </div>
    </div>
  );
}
