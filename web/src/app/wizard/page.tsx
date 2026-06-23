"use client";

import { useState, useEffect } from "react";
import NavBar from "@/components/NavBar";
import { useAuth } from "@/hooks/useAuth";

/* ── Static data ─────────────────────────────────────────────────────────── */

const GOALS = [
  { id: "replicate-paper",       icon: "🔬", label: "Replicate a paper",         analysis: null,                       redirect: "/replicate" },
  { id: "analyze-sequencing",    icon: "🧬", label: "Analyze my sequencing data", analysis: "rnaseq",                  redirect: null },
  { id: "analyze-microbiome",    icon: "🦠", label: "Analyze microbiome",          analysis: "microbiome",              redirect: null },
  { id: "analyze-proteomics",    icon: "🧪", label: "Analyze proteomics",          analysis: "proteomics",              redirect: null },
  { id: "analyze-flow",          icon: "🧫", label: "Analyze flow cytometry",      analysis: null,                      redirect: null },
  { id: "analyze-pathology",     icon: "🩺", label: "Analyze pathology slides",    analysis: "spatial_transcriptomics", redirect: null },
  { id: "integrate-multiomics",  icon: "🧠", label: "Integrate multi-omics",       analysis: "multiomics",              redirect: "/multiomics" },
  { id: "discover-biomarkers",   icon: "🤖", label: "Discover biomarkers",         analysis: "wgs",                     redirect: null },
  { id: "discover-drug-targets", icon: "💊", label: "Discover drug targets",       analysis: "multiomics",              redirect: null },
];

/* Which data types are compatible with each goal */
const GOAL_DATA_MAP: Record<string, string[]> = {
  "analyze-sequencing":    ["fastq", "bam", "geo", "sra"],
  "analyze-microbiome":    ["fastq", "bam"],
  "analyze-proteomics":    ["mass-spec", "mass-spec-metabolomics"],
  "analyze-flow":          ["flow"],
  "analyze-pathology":     ["pathology", "fastq", "bam"],
  "integrate-multiomics":  ["multiomics", "fastq", "bam", "vcf", "scrnaseq", "mass-spec"],
  "discover-biomarkers":   ["vcf", "fastq", "bam", "tcga", "geo", "scrnaseq"],
  "discover-drug-targets": ["vcf", "tcga", "multiomics", "fastq", "bam", "mass-spec"],
};

const DATA_TYPES = [
  { id: "fastq",      icon: "📄", label: "FASTQ",                desc: "Raw sequencing reads",           analysis: "rnaseq" },
  { id: "bam",        icon: "📊", label: "BAM / CRAM",           desc: "Aligned reads",                  analysis: "rnaseq" },
  { id: "vcf",        icon: "🧬", label: "VCF",                  desc: "Variant calls",                  analysis: "wgs" },
  { id: "scrnaseq",   icon: "🔵", label: "scRNA-seq (10x / SS)", desc: "Single-cell matrix",             analysis: "scrnaseq" },
  { id: "mass-spec",  icon: "⚗️", label: "Mass Spectrometry",    desc: "RAW / mzML / wiff files",        analysis: "proteomics" },
  { id: "flow",       icon: "🔴", label: "Flow Cytometry",        desc: "FCS files",                     analysis: null },
  { id: "pathology",  icon: "🩻", label: "Pathology Slides",      desc: "SVS / NDPI / TIFF",             analysis: "spatial_transcriptomics" },
  { id: "mri",        icon: "🧠", label: "MRI / DICOM",           desc: "Radiology images",               analysis: null },
  { id: "mass-spec-metabolomics", icon: "⚗️", label: "Metabolomics", desc: "GC-MS / LC-MS files",        analysis: "proteomics" },
  { id: "geo",        icon: "🌐", label: "GEO Accession",         desc: "Public NCBI GEO data",           analysis: "rnaseq" },
  { id: "sra",        icon: "🔗", label: "SRA Accession",         desc: "Public sequencing reads",        analysis: "rnaseq" },
  { id: "tcga",       icon: "🏛️", label: "TCGA Data",             desc: "Cancer Genome Atlas",            analysis: "wgs" },
  { id: "multiomics", icon: "🔗", label: "Multiple data types",   desc: "RNA + ATAC + methylation + ...", analysis: "multiomics" },
  { id: "pdf",        icon: "📑", label: "PDF Paper",             desc: "Replicate a paper's pipeline",   analysis: null, redirect: "/replicate" },
];

/* Realistic speed benchmarks (RNA-seq full pipeline, single sample) */
const RESOURCE_TIERS = [
  { label: "Laptop",        cpu: 8,  ram: 16,  examples: "FastQC, featureCounts, small Seurat",    speed: "2–8 h / sample",     cost: "Your hardware",  flag: "⚠️ limited" },
  { label: "Workstation",   cpu: 16, ram: 64,  examples: "STAR, BWA-MEM2, DESeq2, 10–50 samples", speed: "45 min–2 h / sample", cost: "Your hardware",  flag: "✅ recommended" },
  { label: "Power station", cpu: 32, ram: 128, examples: "GATK, Mutect2, scRNA-seq, MOFA+",        speed: "20–45 min / sample",  cost: "Your hardware",  flag: "✅ best for WGS" },
  { label: "HPC node",      cpu: 48, ram: 256, examples: "WGS cohort, Bismark WGBS, Kraken2",      speed: "10–20 min / sample",  cost: "HPC credits",    flag: "🚀 large cohorts" },
  { label: "Cloud burst",   cpu: 64, ram: 512, examples: "100+ samples, scRNA-seq atlas, MOFA+",   speed: "5–15 min / sample",   cost: "~$2–8 / h",      flag: "☁️ on demand" },
];

/* Static analysis recommendations — no backend needed */
const STATIC_PIPELINES: Record<string, { steps: { tool: string; role: string }[]; time: string; dest: string }> = {
  rnaseq:       { steps: [{ tool: "FastQC", role: "QC" }, { tool: "STAR", role: "Alignment" }, { tool: "featureCounts", role: "Quantification" }, { tool: "DESeq2", role: "Differential expression" }, { tool: "GSEA", role: "Pathway analysis" }], time: "2–8 h / sample (laptop) · 45 min (workstation)", dest: "/launch?type=rnaseq" },
  wgs:          { steps: [{ tool: "BWA-MEM2", role: "Alignment" }, { tool: "GATK HaplotypeCaller", role: "Germline variants" }, { tool: "Mutect2", role: "Somatic variants" }, { tool: "ANNOVAR", role: "Annotation" }, { tool: "CNVkit", role: "CNV" }], time: "10–45 min / sample (workstation+)", dest: "/launch?type=wgs" },
  wes:          { steps: [{ tool: "BWA-MEM", role: "Alignment" }, { tool: "GATK", role: "Variant calling" }, { tool: "VEP", role: "Annotation" }, { tool: "OpenCRAVAT", role: "Clinical annotation" }], time: "30–90 min / sample", dest: "/launch?type=wes" },
  scrnaseq:     { steps: [{ tool: "STARsolo / cellranger", role: "Demux + alignment" }, { tool: "Seurat / Scanpy", role: "QC + normalization" }, { tool: "Leiden", role: "Clustering" }, { tool: "SingleR", role: "Cell type annotation" }, { tool: "scVelo", role: "Trajectory" }], time: "2–6 h / dataset", dest: "/launch?type=scrnaseq" },
  methylation:  { steps: [{ tool: "Bismark", role: "Bisulfite alignment" }, { tool: "MethylDackel", role: "CpG extraction" }, { tool: "DSS", role: "Differential methylation" }], time: "3–10 h / sample", dest: "/launch?type=methylation" },
  chipseq:      { steps: [{ tool: "Bowtie2", role: "Alignment" }, { tool: "MACS3", role: "Peak calling" }, { tool: "DiffBind", role: "Differential binding" }, { tool: "HOMER", role: "Motif analysis" }], time: "1–3 h / sample", dest: "/launch?type=chipseq" },
  atacseq:      { steps: [{ tool: "Bowtie2", role: "Alignment" }, { tool: "MACS3", role: "Peak calling" }, { tool: "TOBIAS", role: "TF footprinting" }, { tool: "ArchR", role: "Full pipeline (scATAC)" }], time: "1–4 h / sample", dest: "/launch?type=atacseq" },
  proteomics:   { steps: [{ tool: "MaxQuant", role: "Peptide identification + quantification" }, { tool: "Perseus", role: "Statistical analysis" }, { tool: "STRING", role: "Pathway / network" }], time: "2–8 h / run", dest: "/launch?type=proteomics" },
  microbiome:   { steps: [{ tool: "DADA2", role: "ASV denoising" }, { tool: "QIIME2", role: "Full pipeline" }, { tool: "phyloseq", role: "Diversity analysis" }, { tool: "ANCOM-BC", role: "Differential abundance" }], time: "1–4 h / batch", dest: "/launch?type=microbiome" },
  multiomics:   { steps: [{ tool: "ComBat-seq", role: "Batch correction" }, { tool: "MOFA+", role: "Multi-omics factor analysis" }, { tool: "WNN (Seurat)", role: "Weighted nearest neighbor" }], time: "Varies by data types", dest: "/launch?type=multiomics" },
  spatial_transcriptomics: { steps: [{ tool: "Space Ranger", role: "Visium alignment" }, { tool: "Seurat", role: "Spatial DE" }, { tool: "RCTD", role: "Cell type deconvolution" }], time: "2–6 h / slide", dest: "/launch?type=rnaseq" },
  phylogenetics: { steps: [{ tool: "MAFFT", role: "Multiple sequence alignment" }, { tool: "MEGA", role: "Phylogenetic inference" }, { tool: "BEAST", role: "Bayesian MCMC phylogenetics" }, { tool: "DnaSP", role: "Population genetics" }], time: "Varies by tree size", dest: "/launch" },
  null:         { steps: [{ tool: "FastQC", role: "QC" }, { tool: "STAR", role: "Alignment" }, { tool: "DESeq2", role: "Analysis" }], time: "Depends on data type", dest: "/launch" },
};

/* Infer analysis type from goal + data selection */
function inferAnalysis(goalId: string | null, dataIds: string[]): string {
  const goal = GOALS.find(g => g.id === goalId);
  if (goal?.analysis) return goal.analysis;
  for (const d of dataIds) {
    const dt = DATA_TYPES.find(x => x.id === d);
    if (dt?.analysis) return dt.analysis;
  }
  return "rnaseq";
}

/* ── Component ───────────────────────────────────────────────────────────── */

export default function WizardPage() {
  const { user, loading, signOut } = useAuth();
  const [step, setStep]             = useState<1 | 2 | 3>(1);
  const [goalId, setGoalId]         = useState<string | null>(null);
  const [dataIds, setDataIds]       = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [disease, setDisease]       = useState("");
  const [nSamples, setNSamples]     = useState(20);
  const [ramGb, setRamGb]           = useState(64);
  const [cpuCores, setCpuCores]     = useState(16);
  const [recommendation, setRecommendation] = useState<{ analysisType: string; pipeline: typeof STATIC_PIPELINES[string] } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get("goal");
    const a = params.get("analysis");
    if (g) {
      const found = GOALS.find(x => x.id === g);
      if (found?.redirect) { window.location.href = found.redirect; return; }
      setGoalId(g);
      setStep(2);
    }
    if (a) {
      setStep(3);
      setGoalId(`direct-${a}`);
    }
  }, []);

  function toggleData(id: string) {
    const dt = DATA_TYPES.find(x => x.id === id);
    if ((dt as any)?.redirect) { window.location.href = (dt as any).redirect; return; }
    setDataIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function selectRamTier(tier: typeof RESOURCE_TIERS[0]) {
    setRamGb(tier.ram);
    setCpuCores(tier.cpu);
  }

  function handleGetRecommendation() {
    const params = new URLSearchParams(window.location.search);
    const directAnalysis = params.get("analysis");
    const analysisType = directAnalysis || inferAnalysis(goalId, dataIds);
    const pipeline = STATIC_PIPELINES[analysisType] || STATIC_PIPELINES["null"];
    setRecommendation({ analysisType, pipeline });
  }

  const selectedGoal = GOALS.find(g => g.id === goalId);

  /* Filter data types to those compatible with selected goal */
  const compatibleIds = goalId ? (GOAL_DATA_MAP[goalId] ?? null) : null;
  const visibleDataTypes = compatibleIds
    ? DATA_TYPES.filter(d => compatibleIds.includes(d.id))
    : DATA_TYPES;

  return loading || !user ? null : (
    <div className="min-h-screen" style={{ background: "var(--canvas)", color: "var(--text)" }}>
      <NavBar active="/wizard" user={user} onSignOut={signOut} />

      <div className="max-w-4xl mx-auto px-8 py-10 space-y-10">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text)" }}>Analysis Wizard</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Answer two simple questions:
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-3 text-xs">
          {([1, 2, 3] as const).map(n => (
            <div key={n} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold transition-colors"
                style={
                  step === n
                    ? { background: "var(--flame)", color: "#fff" }
                    : step > n
                    ? { background: "#fff8f3", color: "var(--flame)", border: "1px solid var(--flame)" }
                    : { background: "var(--border)", color: "var(--muted)" }
                }>{n}</div>
              <span style={{ color: step >= n ? "var(--text)" : "var(--dim)" }}>
                {["Your goal", "Your data", "Analysis path"][n - 1]}
              </span>
              {n < 3 && <div className="w-8 h-px" style={{ background: "var(--border)" }} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Goal ── */}
        {step === 1 && (
          <div>
            <h2 className="font-semibold text-lg mb-5" style={{ color: "var(--text)" }}>
              What do you want to achieve?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {GOALS.map(g => (
                <button key={g.id} onClick={() => {
                  if (g.redirect) { window.location.href = g.redirect; return; }
                  setGoalId(g.id); setDataIds([]); setStep(2);
                }}
                  className="flex gap-3 items-start text-left rounded-2xl p-4 transition-all"
                  style={
                    goalId === g.id
                      ? { background: "#fff8f3", border: "1px solid var(--flame)" }
                      : { background: "var(--surface)", border: "1px solid var(--border)" }
                  }>
                  <span className="text-2xl shrink-0">{g.icon}</span>
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{g.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Data types (filtered to goal) ── */}
        {step === 2 && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              {selectedGoal && (
                <span className="text-sm px-2 py-1 rounded-lg" style={{ background: "#f3f0e8", color: "var(--muted)" }}>
                  {selectedGoal.icon} {selectedGoal.label}
                </span>
              )}
              <button onClick={() => { setGoalId(null); setStep(1); }} className="text-xs" style={{ color: "var(--muted)" }}>
                ← Change goal
              </button>
            </div>

            <h2 className="font-semibold text-lg mb-2" style={{ color: "var(--text)" }}>What data do you have?</h2>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
              Select all that apply — you can choose more than one.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
              {visibleDataTypes.map(d => (
                <button key={d.id} onClick={() => toggleData(d.id)}
                  className="flex flex-col items-center gap-1.5 text-center p-4 rounded-2xl transition-all"
                  style={
                    dataIds.includes(d.id)
                      ? { border: "1px solid var(--flame)", background: "#fff8f3" }
                      : { border: "1px solid var(--border)", background: "var(--surface)" }
                  }>
                  <span className="text-2xl">{d.icon}</span>
                  <span className="text-xs font-medium leading-tight" style={{ color: "var(--text)" }}>{d.label}</span>
                  <span className="text-xs leading-tight" style={{ color: "var(--dim)" }}>{d.desc}</span>
                </button>
              ))}
            </div>

            <button onClick={() => setStep(3)} disabled={dataIds.length === 0}
              className="px-6 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
              style={{ background: "var(--flame)", color: "#fff" }}>
              Next: Set up analysis →
            </button>
          </div>
        )}

        {/* ── Step 3: Context + analysis path ── */}
        {step === 3 && (
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              {selectedGoal && (
                <span className="text-sm px-2 py-1 rounded-lg" style={{ background: "#f3f0e8", color: "var(--muted)" }}>
                  {selectedGoal.icon} {selectedGoal.label}
                </span>
              )}
              {dataIds.length > 0 && (
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  {dataIds.length} data type{dataIds.length > 1 ? "s" : ""} selected
                </span>
              )}
              <button onClick={() => setStep(2)} className="text-xs" style={{ color: "var(--muted)" }}>← Back</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text)" }}>
                  Describe your study goal{" "}
                  <span className="font-normal" style={{ color: "var(--muted)" }}>(optional)</span>
                </label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  placeholder="e.g. I have 30 breast cancer FFPE samples and 10 matched normals. I want to find somatic variants and differentially expressed genes, and identify pathways driving drug resistance."
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                  style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "var(--muted)" }}>Disease / phenotype</label>
                  <input value={disease} onChange={e => setDisease(e.target.value)}
                    placeholder="e.g. breast cancer, Alzheimer, IBD"
                    className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                    style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "var(--muted)" }}>Number of samples</label>
                  <input type="number" value={nSamples} onChange={e => setNSamples(+e.target.value)} min={1}
                    className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                    style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>
              </div>
            </div>

            {/* Resource / speed table — no System column */}
            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: "var(--text)" }}>
                How much compute do you have?
                <span className="font-normal ml-2" style={{ color: "var(--muted)" }}>— determines analysis speed</span>
              </label>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ color: "var(--muted)" }}>
                      <th className="text-left py-2 pr-4 font-medium">CPU cores</th>
                      <th className="text-left py-2 pr-4 font-medium">RAM</th>
                      <th className="text-left py-2 pr-4 font-medium">Best for</th>
                      <th className="text-left py-2 pr-4 font-medium">Speed (RNA-seq)</th>
                      <th className="text-left py-2 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RESOURCE_TIERS.map(tier => {
                      const selected = ramGb === tier.ram && cpuCores === tier.cpu;
                      return (
                        <tr key={tier.label} onClick={() => selectRamTier(tier)}
                          className="cursor-pointer transition-colors"
                          style={
                            selected
                              ? { borderTop: "1px solid var(--border)", background: "#fff8f3" }
                              : { borderTop: "1px solid var(--border)" }
                          }>
                          <td className="py-2.5 pr-4">
                            <span className="font-medium" style={{ color: selected ? "var(--flame)" : "var(--text)" }}>
                              {tier.cpu}
                            </span>
                            <span className="ml-1.5 text-xs" style={{ color: "var(--dim)" }}>{tier.flag}</span>
                          </td>
                          <td className="py-2.5 pr-4" style={{ color: "var(--muted)" }}>{tier.ram} GB</td>
                          <td className="py-2.5 pr-4 max-w-[180px]" style={{ color: "var(--dim)" }}>{tier.examples}</td>
                          <td className="py-2.5 pr-4 font-medium" style={{ color: "var(--flame)" }}>{tier.speed}</td>
                          <td className="py-2.5" style={{ color: "var(--muted)" }}>{tier.cost}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--dim)" }}>
                Selected: {cpuCores} cores / {ramGb} GB RAM
              </p>
            </div>

            <button onClick={handleGetRecommendation}
              className="px-7 py-3.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: "var(--flame)", color: "#fff" }}>
              Find My Analysis Path →
            </button>

            {/* Recommendation output — computed locally, no backend needed */}
            {recommendation && (
              <div className="space-y-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Recommended Analysis Path</h2>
                  <span className="text-xs px-2 py-1 rounded font-mono"
                    style={{ background: "#fff8f3", color: "var(--flame)", border: "1px solid #ffd4bc" }}>
                    {recommendation.analysisType.toUpperCase()}
                  </span>
                  <span className="text-xs px-2 py-1 rounded" style={{ background: "#f3f0e8", color: "var(--muted)" }}>
                    ⏱ {recommendation.pipeline.time}
                  </span>
                </div>

                <div className="space-y-2">
                  {recommendation.pipeline.steps.map((s, i) => (
                    <div key={i} className="rounded-xl p-4 flex gap-3"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <div className="w-6 h-6 rounded-full text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold"
                        style={{ background: "#fff8f3", color: "var(--flame)", border: "1px solid var(--flame)" }}>
                        {i + 1}
                      </div>
                      <div>
                        <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{s.tool}</span>
                        <span className="text-xs ml-2" style={{ color: "var(--muted)" }}>— {s.role}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-2 flex-wrap">
                  <a href={recommendation.pipeline.dest}
                    className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    style={{ background: "var(--flame)", color: "#fff" }}>
                    🚀 Launch Pipeline →
                  </a>
                  <a href="/connect"
                    className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                    Connect my data →
                  </a>
                  <a href="/tools"
                    className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                    Browse all tools
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
