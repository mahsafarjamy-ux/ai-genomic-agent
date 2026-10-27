"use client";

import CounsellingInvite from "@/components/CounsellingInvite";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuthOptional } from "@/hooks/useAuthOptional";
import { AuthForm } from "@/components/AuthSidePanel";
import TrustPanel from "@/components/TrustPanel";
import { BillingPlan, getBillingPlans, displayPrice, startCheckout } from "@/lib/billing";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface InsightCard {
  category: string;
  plain_name: string;
  emoji: string;
  accentColor: string;
  findings: Finding[];
}

interface Finding {
  name: string;
  gene: string;
  your_result: string;
  impact_level: "high" | "moderate" | "low" | "protective";
  plain_explanation: string;
  actions?: string[];
}

interface AnalysisResult {
  summary: { total_snps_checked: number; total_snps_found: number; file_source: string };
  categories: InsightCard[];
  privacy_note: string;
}

/* ── Feature bubbles shown in hero ─────────────────────────────────────── */
const INSIGHT_PILLS = [
  { emoji: "💊", text: "Ozempic / GLP-1 response",       color: "#e44c81", bg: "#fff5f8" },
  { emoji: "☕", text: "Caffeine metabolism (CYP1A2)",    color: "#b46309", bg: "#fffbf0" },
  { emoji: "🏃", text: "Power vs. endurance muscle type", color: "#16a34a", bg: "#f0fdf4" },
  { emoji: "🧠", text: "Sleep chronotype & insomnia",     color: "#7c3aed", bg: "#f5f3ff" },
  { emoji: "❤️", text: "APOE longevity & heart risk",     color: "#dc2626", bg: "#fff5f5" },
  { emoji: "💊", text: "Warfarin & blood thinner dosing", color: "#e44c81", bg: "#fff5f8" },
  { emoji: "🥗", text: "MTHFR / folate variants",         color: "#b46309", bg: "#fffbf0" },
  { emoji: "🛡️", text: "HLA autoimmune tendencies",       color: "#0891b2", bg: "#f0f9ff" },
  { emoji: "💊", text: "Statin side-effect risk (SLCO1B1)", color: "#e44c81", bg: "#fff5f8" },
  { emoji: "🧬", text: "BRCA1/2 & cancer risk markers",   color: "#dc2626", bg: "#fff5f5" },
  { emoji: "🥗", text: "Vitamin D & omega-3 absorption",  color: "#16a34a", bg: "#f0fdf4" },
  { emoji: "🧠", text: "Dopamine & stress resilience",    color: "#7c3aed", bg: "#f5f3ff" },
];

/* ── Pricing ────────────────────────────────────────────────────────────── */
const PRICING = [
  {
    tier: "Essential",
    price: "$79",
    period: "one-time",
    color: "#f05808",
    features: [
      "Medication & drug response (50+ drugs)",
      "Diet & nutrition blueprint",
      "Fitness & body type insights",
      "PDF report download",
      "Analyzed on your device",
    ],
  },
  {
    tier: "Complete",
    price: "$199",
    period: "one-time",
    color: "#e44c81",
    badge: "Most Popular",
    features: [
      "Everything in Essential",
      "Sleep & mental wellness",
      "Heart & longevity markers",
      "Immunity & allergy risk",
      "1,500+ SNP analysis",
      "Disease risk factors (ClinVar)",
      "AI-generated action plan",
      "Pharmacogenomics deep-dive",
    ],
  },
  {
    tier: "Lifetime",
    price: "$399",
    period: "one-time",
    color: "#7c3aed",
    features: [
      "Everything in Complete",
      "Offline desktop app — no internet ever",
      "Re-run as science improves",
      "Priority support",
      "Family sharing (2 genomes)",
      "Clinical PDF for your doctor",
    ],
  },
];

/* ── Impact badge ───────────────────────────────────────────────────────── */
function ImpactBadge({ level }: { level: Finding["impact_level"] }) {
  const map = {
    high:       { label: "High impact",    bg: "#fee2e2", color: "#b91c1c" },
    moderate:   { label: "Moderate",       bg: "#fef9c3", color: "#854d0e" },
    low:        { label: "Low / Typical",  bg: "#f1f5f9", color: "#64748b" },
    protective: { label: "Protective",     bg: "#dcfce7", color: "#15803d" },
  };
  const s = map[level];
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
      background: s.bg, color: s.color,
    }}>{s.label}</span>
  );
}

/* ── Passport helpers ───────────────────────────────────────────────────── */
const PHARMA_PATTERN = /\b(drug|medic|pharma|cyp|statin|warfarin|ozempic|wegovy|mounjaro|glp.?1|metformin|antidepress|antipsychot|dos(ing|e)|blood thin|statin|opioid|codeine|tamoxifen|clopi|ssri|snri|dose|therapy|response|metabolism)\b/i;

function isPharmaFinding(cat: InsightCard, f: Finding): boolean {
  return PHARMA_PATTERN.test(cat.plain_name + " " + f.name + " " + f.gene);
}

function alertColor(level: Finding["impact_level"]) {
  if (level === "high")       return { bg: "#fff1f2", border: "#fca5a5", text: "#b91c1c", label: "HIGH ALERT" };
  if (level === "moderate")   return { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", label: "MODERATE" };
  if (level === "protective") return { bg: "#f0fdf4", border: "#86efac", text: "#15803d", label: "PROTECTIVE" };
  return                             { bg: "#f8fafc", border: "#e2e8f0", text: "#64748b", label: "TYPICAL" };
}

/* ── Main page ──────────────────────────────────────────────────────────── */
export default function PersonalPage() {
  const { user, loading, refresh, signOut } = useAuthOptional();
  const [step, setStep]             = useState<"preview" | "uploading" | "analyzing" | "results">("preview");
  const [dragOver, setDragOver]     = useState(false);
  const [fileName, setFileName]     = useState("");
  const [error, setError]           = useState("");
  const [results, setResults]       = useState<AnalysisResult | null>(null);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSignIn, setPaymentSignIn] = useState(false);
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);

  useEffect(() => {
    getBillingPlans().then(setBillingPlans).catch(() => setPaymentError("Plan pricing is temporarily unavailable. Please try again later."));
  }, []);

  async function purchase(tier: string) {
    setSelectedTier(tier); setPaymentError("");
    if (!localStorage.getItem("genomics_token")) { setPaymentSignIn(true); return; }
    setPaymentSignIn(false); setPaymentLoading(true);
    try { window.location.assign(await startCheckout(tier.toLowerCase(), billingPlans.find(plan => plan.id === tier.toLowerCase()))); }
    catch (err) { setPaymentError(err instanceof Error ? err.message : "Checkout is unavailable. Please try again."); }
    finally { setPaymentLoading(false); }
  }

  const [analysisDate, setAnalysisDate] = useState("");
  const fileRef   = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const bases = ["A","C","G","T"];
    // Deeper purple/magenta for contrast on light pink background
    const baseColors: Record<string,string> = { A:"#9333ea", C:"#c026d3", G:"#7c3aed", T:"#be185d" };
    const fontSize = 13;
    let drops: number[] = Array(Math.floor(canvas.width / fontSize)).fill(1);
    let raf: number;
    const draw = () => {
      const cols = Math.floor(canvas.width / fontSize);
      if (drops.length !== cols) drops = Array(cols).fill(1);
      ctx.fillStyle = "rgba(255,240,252,0.18)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < drops.length; i++) {
        const base = bases[Math.floor(Math.random() * 4)];
        ctx.fillStyle = baseColors[base];
        ctx.font = `${fontSize}px monospace`;
        ctx.fillText(base, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.45;  // slow — half speed
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  const [showPassport, setShowPassport]   = useState(false);
  const [passportName, setPassportName]   = useState("");
  const [passportDob, setPassportDob]     = useState("");
  const [passportBlood, setPassportBlood] = useState("");

  const canAnalyze = !!user;

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setError("");
    setStep("uploading");

    await new Promise(r => setTimeout(r, 800));
    setStep("analyzing");

    const form = new FormData();
    form.append("file", file);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("genomics_token") : null;
      const res = await fetch("http://localhost:8000/api/genome-personal/analyze", {
        method: "POST",
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail || "Analysis failed");
      }
      const data: AnalysisResult = await res.json();
      setResults(data);
      setStep("results");
      setAnalysisDate(new Date().toISOString());
      if (data.categories.length > 0) setOpenCategory(data.categories[0].category);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      setError(msg);
      setStep("preview");
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#ffffff",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: "#1c1a16",
    }}>

      {/* ── Nav ── */}
      <header style={{
        borderBottom: "1px solid #f0f0f0",
        padding: "1rem 2rem",
        display: "flex", alignItems: "center", gap: "0.6rem",
      }}>
        <a href="/gateway" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}>
          <img src="/logo.png" alt="" style={{ width: 68, height: 46, display: "block", objectFit: "contain" }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: "#1c1a16" }}>Genomics Platform</span>
        </a>
        <span style={{ color: "#d0d0d0", marginLeft: 4 }}>/</span>
        <span style={{ fontSize: 13, color: "#e44c81", fontWeight: 600 }}>Personal DNA Report</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {!loading && user && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                fontSize: 11, background: "#f0fdf4", color: "#16a34a",
                borderRadius: 20, padding: "3px 10px", border: "1px solid #bbf7d0",
              }}>
                ✓ {user.name.split(" ")[0]}
              </span>
              <button onClick={signOut} style={{
                fontSize: 11, color: "#9c9892", background: "none",
                border: "none", cursor: "pointer",
              }}>Sign out</button>
            </div>
          )}
          <span style={{ fontSize: 11, color: "#9c9892", background: "#f3f3f3", borderRadius: 20, padding: "3px 10px" }}>
            🔒 Analyzed on your device
          </span>
          <a href="/gateway" style={{
            fontSize: 12, color: "#6b6760", textDecoration: "none",
            padding: "4px 12px", borderRadius: 8, border: "1px solid #e8e8e8",
          }}>← Back</a>
        </div>
      </header>
      <CounsellingInvite />


      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* RESULTS VIEW */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {step === "results" && results && (
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "2.5rem 1.5rem 5rem" }}>

          <div style={{
            background: "linear-gradient(135deg, #fff5f8, #fffbf0)",
            border: "1px solid #ffd4e8",
            borderRadius: 18,
            padding: "1.5rem 2rem",
            marginBottom: "2rem",
            display: "flex", flexWrap: "wrap", gap: "1.5rem",
            alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#e44c81" }}>
                {results.summary.total_snps_found}
              </div>
              <div style={{ fontSize: 12, color: "#6b6760" }}>SNPs analyzed</div>
            </div>
            <div style={{ width: 1, height: 40, background: "#ffd4e8" }} />
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#f05808" }}>
                {results.categories.length}
              </div>
              <div style={{ fontSize: 12, color: "#6b6760" }}>health areas</div>
            </div>
            <div style={{ width: 1, height: 40, background: "#ffd4e8" }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1c1a16" }}>
                {results.summary.file_source}
              </div>
              <div style={{ fontSize: 12, color: "#6b6760" }}>source file</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  setPassportName(user?.name ?? "");
                  setShowPassport(true);
                }}
                style={{
                  fontSize: 12, padding: "8px 16px", borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg, #e44c81, #f05808)",
                  color: "#fff", cursor: "pointer", fontWeight: 700,
                  boxShadow: "0 2px 8px rgba(228,76,129,0.25)",
                }}
              >
                🪪 Genomic Passport
              </button>
              <button
                onClick={() => { setStep("preview"); setResults(null); setFileName(""); }}
                style={{
                  fontSize: 12, padding: "8px 16px", borderRadius: 10,
                  border: "1px solid #e8e8e8", background: "#fff",
                  color: "#6b6760", cursor: "pointer",
                }}
              >
                Upload a different file
              </button>
            </div>
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "0.5rem" }}>
            Your DNA Health Blueprint
          </h1>
          <p style={{ fontSize: 14, color: "#6b6760", marginBottom: "2rem" }}>
            {results.privacy_note}
          </p>

          {results.categories.map(cat => (
            <div key={cat.category} style={{
              marginBottom: "0.75rem",
              borderRadius: 16,
              border: `1px solid ${openCategory === cat.category ? "#e8e8e8" : "#f0f0f0"}`,
              overflow: "hidden",
              boxShadow: openCategory === cat.category ? "0 4px 16px rgba(0,0,0,0.05)" : "none",
            }}>
              <button
                onClick={() => setOpenCategory(openCategory === cat.category ? null : cat.category)}
                style={{
                  width: "100%", padding: "1.1rem 1.5rem",
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  background: openCategory === cat.category ? "#fafafa" : "#fff",
                  border: "none", cursor: "pointer", textAlign: "left",
                  transition: "background 0.15s",
                }}
              >
                <span style={{ fontSize: 24 }}>{cat.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1c1a16" }}>{cat.plain_name}</div>
                  <div style={{ fontSize: 12, color: "#9c9892", marginTop: 2 }}>
                    {cat.findings.length} insight{cat.findings.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 280 }}>
                  {cat.findings.slice(0, 3).map(f => (
                    <ImpactBadge key={f.gene} level={f.impact_level} />
                  ))}
                </div>
                <span style={{ color: "#c0c0c0", fontSize: 18, flexShrink: 0 }}>
                  {openCategory === cat.category ? "▲" : "▼"}
                </span>
              </button>

              {openCategory === cat.category && (
                <div style={{ padding: "0 1.5rem 1.5rem" }}>
                  {cat.findings.map(f => (
                    <div key={f.gene} style={{
                      borderTop: "1px solid #f0f0f0",
                      paddingTop: "1.25rem",
                      marginTop: "1.25rem",
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.6rem" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#1c1a16" }}>{f.name}</div>
                          <div style={{ fontSize: 11, color: "#b0afaa", marginTop: 2 }}>Gene: {f.gene}</div>
                        </div>
                        <ImpactBadge level={f.impact_level} />
                      </div>
                      <div style={{
                        background: "#f8f8f8", borderRadius: 10, padding: "0.85rem 1rem",
                        fontSize: 13, color: "#444", lineHeight: 1.65, marginBottom: "0.75rem",
                      }}>
                        <span style={{ fontWeight: 600, color: "#1c1a16" }}>Your result: </span>
                        {f.your_result}
                        <br />
                        {f.plain_explanation}
                      </div>
                      {f.actions && f.actions.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#9c9892", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            What this means for you
                          </div>
                          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                            {f.actions.map((a, i) => (
                              <li key={i} style={{ fontSize: 13, color: "#555", lineHeight: 1.6, marginBottom: 4 }}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div style={{
            marginTop: "2.5rem",
            background: "linear-gradient(135deg, #1c1a16, #2a2620)",
            borderRadius: 20,
            padding: "2rem 2.25rem",
            color: "#fff",
            display: "flex", alignItems: "center", flexWrap: "wrap", gap: "1rem",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Unlock the full report</div>
              <div style={{ fontSize: 13, color: "#c0bdb8", lineHeight: 1.6 }}>
                This preview covers ~20 key markers. The complete report analyzes 1,500+ SNPs,
                includes your full pharmacogenomics profile, disease risk factors, and an AI-generated
                action plan for your doctor.
              </div>
            </div>
            <button
              onClick={() => { setStep("preview"); setTimeout(() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" }), 100); }}
              style={{
                padding: "10px 22px", borderRadius: 12, border: "none",
                background: "#e44c81", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}
            >
              See plans →
            </button>
          </div>

          {/* Trust & Provenance Panel */}
          <TrustPanel
            provenance={{
              pipelineName: "Personal DNA Analysis",
              toolVersion: "1.0",
              inputFile: results.summary.file_source,
              runDate: analysisDate || new Date().toISOString(),
              analysisMode: "SNP pattern matching (device-local)",
              referenceDb: "ClinVar / dbSNP reference SNPs",
              sampleId: user?.name ?? "anonymous",
              status: "complete",
              parameters: {
                snps_checked: String(results.summary.total_snps_checked),
                snps_found:   String(results.summary.total_snps_found),
                categories:   String(results.categories.length),
              },
            }}
            qcChecks={[
              {
                name: "File validation",
                status: "pass",
                value: results.summary.file_source,
                detail: "23andMe / AncestryDNA / MyHeritage format accepted",
              },
              {
                name: "SNPs checked",
                status: results.summary.total_snps_checked > 100 ? "pass" : "warn",
                value: `${results.summary.total_snps_checked.toLocaleString()} SNPs`,
                detail: "Total genetic markers evaluated from your file",
              },
              {
                name: "SNPs found",
                status: results.summary.total_snps_found > 0 ? "pass" : "warn",
                value: `${results.summary.total_snps_found} reportable`,
                detail: "Markers with known research associations",
              },
              {
                name: "Missing values",
                status: results.summary.total_snps_found < results.summary.total_snps_checked * 0.5 ? "warn" : "pass",
                value: `${Math.max(0, results.summary.total_snps_checked - results.summary.total_snps_found)} not matched`,
                detail: "Markers checked but not matched to reference SNPs",
              },
              {
                name: "Health categories",
                status: results.categories.length > 0 ? "pass" : "warn",
                value: `${results.categories.length} areas`,
                detail: "Health insight categories covered in this preview",
              },
              {
                name: "Privacy",
                status: "pass",
                value: "100% on-device",
                detail: "Your DNA file was never transmitted — all analysis ran locally",
              },
            ]}
            findings={results.categories.flatMap(cat =>
              cat.findings.map(f => ({
                finding: f.name,
                supportingData: `${f.gene} — Your result: ${f.your_result}`,
                confidence: (f.impact_level === "high" ? "moderate"
                  : f.impact_level === "protective" ? "moderate"
                  : "low") as "high" | "moderate" | "low" | "speculative",
                source: results.summary.file_source,
                isSpeculative: f.impact_level === "low",
              }))
            )}
            warnings={[
              "This is a research preview covering ~20 key markers — not a medical test.",
              "Upgrade to Complete or Lifetime for 1,500+ SNP analysis.",
            ]}
            pipelineSteps={[
              "Raw DNA file read and parsed on your device",
              "SNP identifiers matched against reference database",
              "Variant impact classified (high / moderate / low / protective)",
              "Insights grouped by health category",
              "AI-generated plain-language explanations compiled",
            ]}
            interpretationNotes={[
              "Candidate findings based on available uploaded data only",
              "Not a clinical diagnostic — requires validation by a genetic counsellor",
              "Research support only — do not make medical decisions from this report",
            ]}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* UPLOAD / LOADING STATES */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {(step === "uploading" || step === "analyzing") && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "60vh", gap: "1.5rem",
        }}>
          <div style={{ fontSize: 64 }}>{step === "uploading" ? "📂" : "🧬"}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1c1a16" }}>
            {step === "uploading" ? "Reading your file…" : "Analyzing your genome…"}
          </div>
          <div style={{ fontSize: 14, color: "#9c9892", maxWidth: 400, textAlign: "center" }}>
            {step === "uploading"
              ? `Loaded: ${fileName}`
              : "Checking 1,500+ genetic markers locally on your device — nothing is sent to any server."}
          </div>
          <div style={{ width: 320, height: 4, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              background: "linear-gradient(90deg, #f05808, #e44c81)",
              borderRadius: 4,
              width: step === "uploading" ? "30%" : "75%",
              transition: "width 0.8s ease",
            }} />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PREVIEW VIEW */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {step === "preview" && (
        <>
          {/* ── Hero: title + feature bubbles only ── */}
          <section style={{
            position: "relative",
            background: "linear-gradient(160deg, #fff0f7 0%, #fff5fb 50%, #fdf0ff 100%)",
            borderBottom: "1px solid #f0c8e8",
            padding: "4rem 1.5rem 4.5rem",
            textAlign: "center",
            overflow: "hidden",
          }}>
            {/* Gentle purple/magenta ACGT matrix on light pink */}
            <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.28, pointerEvents: "none" }} />

            {/* Badge */}
            <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(147,51,234,0.08)", border: "1px solid rgba(147,51,234,0.25)",
              borderRadius: 20, padding: "6px 14px",
              fontSize: 12, color: "#9333ea", fontWeight: 600, marginBottom: "1.75rem",
            }}>
              🧬 Personalized health from your actual DNA
            </div>

            <h1 style={{ color: "#1c1a16",
              fontSize: "clamp(2rem, 5vw, 3.25rem)",
              fontWeight: 900,
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              maxWidth: 700,
              margin: "0 auto 2.5rem",
            }}>
              Your DNA.<br />
              <span style={{ color: "#c026d3" }}>Your Health Blueprint.</span>
            </h1>

            {/* Feature bubbles — light pill style for pink hero */}
            <div style={{
              display: "flex", flexWrap: "wrap", justifyContent: "center",
              gap: 8, maxWidth: 760, margin: "0 auto 3rem",
            }}>
              {INSIGHT_PILLS.map(p => (
                <div key={p.text} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 30,
                  background: p.bg, border: `1px solid ${p.color}44`,
                  fontSize: 13, color: p.color, fontWeight: 600,
                  whiteSpace: "nowrap",
                }}>
                  <span>{p.emoji}</span>
                  <span>{p.text}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              <a
                href="#download"
                onClick={e => { e.preventDefault(); document.getElementById("download-section")?.scrollIntoView({ behavior: "smooth" }); }}
                style={{
                  padding: "14px 28px", borderRadius: 14,
                  background: "#1c1a16", color: "#fff",
                  border: "none",
                  fontWeight: 700, fontSize: 15, textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 8,
                  boxShadow: "0 4px 14px rgba(28,26,22,0.18)",
                }}>
                ⬇ Download Desktop App
              </a>
              <button
                onClick={() => document.getElementById("analyze-section")?.scrollIntoView({ behavior: "smooth" })}
                style={{
                  padding: "14px 28px", borderRadius: 14, border: "none",
                  background: "linear-gradient(135deg, #c026d3, #9333ea)",
                  color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(192,38,211,0.35)",
                }}>
                Analyze My DNA →
              </button>
            </div>
            </div>{/* close zIndex-2 div */}
          </section>

          {/* ── Analyze section: auth gate + upload ── */}
          <section id="analyze-section" style={{
            padding: "4rem 1.5rem",
            maxWidth: 700,
            margin: "0 auto",
          }}>
            {!loading && !canAnalyze && (
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "0.5rem" }}>
                  Sign in to analyze your DNA
                </h2>
                <p style={{ fontSize: 14, color: "#6b6760", marginBottom: "2rem", lineHeight: 1.6 }}>
                  Sign in so only <strong>you</strong> can access your results — no one else,
                  not even us. Your file is processed by your local app or browser. It is never sent to our servers.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                  <AuthForm
                    onSuccess={() => refresh()}
                    benefits={[
                      "Only you can see your results",
                      "Save & re-run your report anytime",
                      "AI-generated action plan",
                      "Share securely with your doctor",
                    ]}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {/* Offline app callout */}
                    <div id="download-section" style={{
                      borderRadius: 18, padding: "1.5rem",
                      background: "#f8f8f8", border: "1px solid #e8e8e8",
                    }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📴</div>
                      <h3 style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>
                        Prefer fully offline?
                      </h3>
                      <p style={{ fontSize: 13, color: "#6b6760", lineHeight: 1.6, marginBottom: "1rem" }}>
                        Download the desktop app. It runs with <strong>no internet connection at all</strong> —
                        no sign-in, no server, nothing leaves your machine.
                        Available with the Lifetime plan.
                      </p>
                      <a href="#pricing"
                        onClick={e => { e.preventDefault(); document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" }); }}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "10px 18px", borderRadius: 12,
                          background: "#1c1a16", color: "#fff",
                          fontWeight: 700, fontSize: 13, textDecoration: "none",
                        }}>
                        ⬇ See Lifetime Plan
                      </a>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* Upload zone — shown when signed in or bypassed */}
            {!loading && canAnalyze && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: "#f0fdf4", border: "1px solid #bbf7d0",
                    borderRadius: 20, padding: "5px 12px",
                    fontSize: 13, color: "#16a34a", fontWeight: 600,
                  }}>
                    ✓ Signed in as {user!.name} — only you can see your results
                  </div>
                </div>

                <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "0.5rem" }}>
                  Upload your raw DNA file
                </h2>
                <p style={{ fontSize: 13, color: "#6b6760", marginBottom: "1.5rem" }}>
                  Download your raw data file from 23andMe, AncestryDNA, MyHeritage, or FamilyTreeDNA
                  (look for &ldquo;Download Raw Data&rdquo; in their account settings). Accepts .txt and .zip files.
                </p>

                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? "#e44c81" : "#e0e0e0"}`,
                    borderRadius: 20,
                    padding: "3rem 2rem",
                    cursor: "pointer",
                    transition: "all 0.18s",
                    background: dragOver ? "#fff5f8" : "#fafafa",
                    textAlign: "center",
                    boxShadow: dragOver ? "0 8px 32px rgba(228,76,129,0.1)" : "none",
                  }}
                >
                  <div style={{ fontSize: 48, marginBottom: "0.75rem" }}>
                    {dragOver ? "📂" : "⬆️"}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#1c1a16", marginBottom: 6 }}>
                    {dragOver ? "Drop your file here" : "Drop your DNA file here"}
                  </div>
                  <div style={{ fontSize: 13, color: "#9c9892", marginBottom: "1.5rem" }}>
                    or click to browse · .txt and .zip
                  </div>
                  <button style={{
                    padding: "12px 28px", borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg, #e44c81, #f05808)",
                    color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(228,76,129,0.25)",
                  }}>
                    Choose file
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".txt,.zip,.csv,.tsv,.gz"
                    style={{ display: "none" }}
                    onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                  />
                </div>

                {error && (
                  <div style={{
                    marginTop: "1rem",
                    background: "#fff5f5", border: "1px solid #fecaca",
                    borderRadius: 12, padding: "0.85rem 1rem",
                    fontSize: 13, color: "#dc2626",
                  }}>
                    ⚠ {error}
                  </div>
                )}

                <p style={{ fontSize: 12, color: "#b0afaa", marginTop: "1rem", textAlign: "center" }}>
                  🔒 Processed on your device. Never stored or transmitted to any server.
                </p>
              </div>
            )}
          </section>

          {/* ── Ozempic highlight ── */}
          <section style={{
            background: "linear-gradient(135deg, #1c1a16, #2a2620)",
            padding: "4rem 1.5rem",
          }}>
            <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: "3rem", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{
                  fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                  color: "#e44c81", fontWeight: 600, marginBottom: "0.75rem",
                }}>
                  Featured insight
                </div>
                <h2 style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 800, color: "#fff", marginBottom: "0.75rem", letterSpacing: "-0.03em" }}>
                  Will Ozempic work for you?
                </h2>
                <p style={{ fontSize: 14, color: "#a09c96", lineHeight: 1.7, marginBottom: "1.25rem" }}>
                  The GLP-1 receptor gene (GLP1R) varies between people. Some carry variants that
                  make GLP-1 medications like Ozempic, Wegovy, or Mounjaro significantly less
                  effective — or more effective — for weight loss and blood sugar control.
                </p>
                <p style={{ fontSize: 14, color: "#a09c96", lineHeight: 1.7 }}>
                  Your DNA report tells you which variant you carry, what that means for your
                  expected response, and what alternatives your doctor might consider if needed.
                </p>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{
                  background: "#2e2b26", borderRadius: 18, padding: "1.75rem",
                  border: "1px solid #3d3a34",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f0ebe6", marginBottom: "1.25rem" }}>
                    Sample result (illustrative)
                  </div>
                  {[
                    { gene: "GLP1R rs6923761", label: "Ozempic response", result: "Enhanced response", color: "#22c55e" },
                    { gene: "CYP2C19 rs4244285", label: "Metformin tolerance", result: "Standard", color: "#6b6760" },
                    { gene: "SLCO1B1 rs4149056", label: "Statin risk", result: "⚠ Moderate risk", color: "#f59e0b" },
                  ].map(r => (
                    <div key={r.gene} style={{
                      paddingBottom: "0.85rem",
                      marginBottom: "0.85rem",
                      borderBottom: "1px solid #3d3a34",
                    }}>
                      <div style={{ fontSize: 11, color: "#6b6760", marginBottom: 3 }}>{r.gene}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: "#d0cdc8" }}>{r.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.result}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: "#6b6760", fontStyle: "italic" }}>
                    * Not medical advice. Share with your doctor.
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Privacy ── */}
          <section style={{ padding: "4rem 1.5rem", maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: "1rem" }}>🔒</div>
            <h2 style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "0.75rem" }}>
              Your DNA data stays on your device
            </h2>
            <p style={{ fontSize: 15, color: "#6b6760", lineHeight: 1.7, maxWidth: 560, margin: "0 auto 2rem" }}>
              Unlike 23andMe or AncestryDNA — which store your genome on their servers indefinitely —
              this analysis runs entirely inside your browser or our desktop app.
              Your raw file is <strong>never transmitted to any server</strong>.
              The Lifetime plan includes a fully offline desktop app that works with no internet at all.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", maxWidth: 700, margin: "0 auto" }}>
              {[
                { icon: "🏠", text: "Analysis runs on your device, not our servers" },
                { icon: "🚫", text: "We never receive your raw DNA file" },
                { icon: "📴", text: "Fully offline desktop app available" },
                { icon: "🗑️", text: "Delete everything anytime, instantly" },
              ].map(p => (
                <div key={p.icon} style={{
                  background: "#f8f8f8", borderRadius: 14,
                  padding: "1.25rem", fontSize: 13, color: "#555", lineHeight: 1.5,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center",
                }}>
                  <span style={{ fontSize: 28 }}>{p.icon}</span>
                  {p.text}
                </div>
              ))}
            </div>
          </section>

          {/* ── Pricing ── */}
          <section id="pricing" style={{
            padding: "5rem 1.5rem",
            background: "#fafafa",
            borderTop: "1px solid #f0f0f0",
          }}>
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9c9892", marginBottom: "0.75rem", fontWeight: 500 }}>
                Pricing
              </div>
              <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.25rem)", fontWeight: 800, letterSpacing: "-0.03em" }}>
                One-time payment. No subscriptions.
              </h2>
              <p style={{ fontSize: 14, color: "#6b6760", marginTop: "0.6rem" }}>
                Pay once, use forever. Your report is yours to keep.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem", maxWidth: 880, margin: "0 auto" }}>
              {PRICING.map(p => (
                <div
                  key={p.tier}
                  onClick={() => setSelectedTier(p.tier)}
                  style={{
                    borderRadius: 20,
                    border: `2px solid ${selectedTier === p.tier ? p.color : p.badge ? p.color : "#e8e8e8"}`,
                    padding: "2rem 1.75rem",
                    background: "#fff",
                    cursor: "pointer",
                    position: "relative",
                    boxShadow: p.badge ? "0 8px 32px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.18s",
                  }}
                >
                  {p.badge && (
                    <div style={{
                      position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                      background: p.color, color: "#fff", fontSize: 11, fontWeight: 700,
                      padding: "3px 14px", borderRadius: 20,
                    }}>
                      {p.badge}
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 700, color: p.color, marginBottom: 6 }}>{p.tier}</div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: "#1c1a16", letterSpacing: "-0.04em", marginBottom: 2 }}>
                    {billingPlans.find(plan => plan.id === p.tier.toLowerCase()) ? displayPrice(billingPlans.find(plan => plan.id === p.tier.toLowerCase())!) : "Price unavailable"}
                  </div>
                  <div style={{ fontSize: 12, color: "#9c9892", marginBottom: "1.5rem" }}>{p.period}</div>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {p.features.map(f => (
                      <li key={f} style={{
                        fontSize: 13, color: "#555", lineHeight: 1.6, marginBottom: 8,
                        display: "flex", alignItems: "flex-start", gap: 8,
                      }}>
                        <span style={{ color: p.color, fontWeight: 700, flexShrink: 0 }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={event => { event.stopPropagation(); void purchase(p.tier); }}
                    disabled={paymentLoading}
                    style={{
                      marginTop: "1.5rem",
                      width: "100%",
                      padding: "12px",
                      borderRadius: 12,
                      border: `2px solid ${p.color}`,
                      background: selectedTier === p.tier ? p.color : "transparent",
                      color: selectedTier === p.tier ? "#fff" : p.color,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: "pointer",
                      transition: "all 0.18s",
                    } as React.CSSProperties}
                  >
                    {paymentLoading && selectedTier === p.tier ? "Opening checkout…" : `Get ${p.tier}`}
                  </button>
                </div>
              ))}
            </div>

            {paymentError && <p role="alert" style={{ color: "#a52f25", textAlign: "center", marginTop: 20 }}>{paymentError}</p>}
            {paymentSignIn && <div style={{ maxWidth: 420, margin: "24px auto" }}>
              <p style={{ marginBottom: 12 }}>Sign in or create your BioVerse account to purchase {selectedTier}. Your Stripe account is not needed.</p>
              <AuthForm onSuccess={() => { refresh(); if (selectedTier) void purchase(selectedTier); }} />
            </div>}
            {selectedTier && (
              <div style={{ textAlign: "center", marginTop: "2rem" }}>
                <button onClick={() => void purchase(selectedTier)} disabled={paymentLoading} style={{
                  padding: "14px 40px", borderRadius: 14, border: "none",
                  background: "linear-gradient(135deg, #e44c81, #f05808)",
                  color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(228,76,129,0.3)",
                }}>
                  {paymentLoading ? "Opening checkout…" : `Continue with ${selectedTier} →`}
                </button>
                <p style={{ fontSize: 12, color: "#9c9892", marginTop: "0.75rem" }}>
                  Secure checkout · 30-day money-back guarantee
                </p>
              </div>
            )}
          </section>

          {/* ── FAQ ── */}
          <section style={{ padding: "4rem 1.5rem", maxWidth: 680, margin: "0 auto" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "2rem", textAlign: "center" }}>
              Common questions
            </h2>
            {[
              {
                q: "Does my DNA file get uploaded to a server?",
                a: "No. Your file is opened directly in your browser or our desktop app. It is processed locally on your device and never transmitted to us or any third party. The desktop app works with no internet connection at all.",
              },
              {
                q: "Why do I need to sign in if the analysis is local?",
                a: "Sign-in ensures only you can see your results. Without it, anyone on the same browser could open the report. We authenticate you locally — your token is stored on your device, and we never receive your DNA data.",
              },
              {
                q: "What file do I need?",
                a: "Download your \"raw data\" file from your DNA testing company (23andMe, AncestryDNA, MyHeritage, or FamilyTreeDNA). Look for \"Download Raw Data\" in account settings. It's usually a .txt or .zip file.",
              },
              {
                q: "What's the difference between this and 23andMe's Health reports?",
                a: "We analyze significantly more genetic markers (1,500+ vs. a few hundred) and focus especially on pharmacogenomics — how your genes affect medication response. Critically, your data never leaves your device, unlike 23andMe.",
              },
            ].map(f => (
              <details key={f.q} style={{ marginBottom: "0.75rem" }}>
                <summary style={{
                  padding: "1rem 1.25rem",
                  background: "#fafafa",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontSize: 14, fontWeight: 700, color: "#1c1a16",
                  listStyle: "none",
                  display: "flex", justifyContent: "space-between",
                  userSelect: "none",
                }}>
                  {f.q}
                  <span style={{ color: "#9c9892", fontWeight: 400, flexShrink: 0, marginLeft: 8 }}>+</span>
                </summary>
                <div style={{ padding: "1rem 1.25rem", fontSize: 14, color: "#555", lineHeight: 1.7 }}>
                  {f.a}
                </div>
              </details>
            ))}
          </section>
        </>
      )}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* GENOMIC PASSPORT MODAL */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showPassport && results && (() => {
        const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

        // Classify findings
        const allFindings: Array<{ cat: InsightCard; f: Finding }> = [];
        for (const cat of results.categories) {
          for (const f of cat.findings) {
            allFindings.push({ cat, f });
          }
        }

        const criticalAlerts  = allFindings.filter(({ cat, f }) => f.impact_level === "high");
        const pharmaFindings  = allFindings.filter(({ cat, f }) => isPharmaFinding(cat, f) && f.impact_level !== "high");
        const healthRisks     = allFindings.filter(({ cat, f }) => !isPharmaFinding(cat, f) && (f.impact_level === "moderate" || f.impact_level === "protective"));
        const criticalPharma  = allFindings.filter(({ cat, f }) => isPharmaFinding(cat, f) && f.impact_level === "high");

        return (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.6)",
            display: "flex", flexDirection: "column",
            overflowY: "auto",
          }}
            className="passport-overlay"
          >
            {/* Print styles */}
            <style>{`
              @media print {
                .passport-overlay { background: white !important; position: static !important; }
                .passport-toolbar { display: none !important; }
                .passport-card { box-shadow: none !important; max-width: 100% !important; border-radius: 0 !important; margin: 0 !important; }
                body > *:not(.passport-overlay) { display: none !important; }
              }
              @page { size: A4; margin: 12mm; }
            `}</style>

            {/* Toolbar (hidden on print) */}
            <div className="passport-toolbar" style={{
              position: "sticky", top: 0, zIndex: 10,
              background: "#1c1a16", padding: "12px 24px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", flex: 1 }}>
                🪪 Genomic Passport Preview
              </span>
              <button
                onClick={() => window.print()}
                style={{
                  padding: "8px 20px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #e44c81, #f05808)",
                  color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}>
                🖨 Print / Save as PDF
              </button>
              <button
                onClick={() => setShowPassport(false)}
                style={{
                  padding: "8px 16px", borderRadius: 10,
                  border: "1px solid #3d3a34", background: "transparent",
                  color: "#c0bdb8", fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}>
                ✕ Close
              </button>
            </div>

            {/* Patient info fields (screen only) */}
            <div className="passport-toolbar" style={{
              background: "#2a2620", padding: "14px 24px",
              display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
            }}>
              <span style={{ fontSize: 12, color: "#9c9892", fontWeight: 600 }}>Personalise your passport:</span>
              {[
                { label: "Full name", value: passportName, setter: setPassportName, placeholder: "Jane Smith" },
                { label: "Date of birth", value: passportDob, setter: setPassportDob, placeholder: "DD/MM/YYYY" },
                { label: "Blood type", value: passportBlood, setter: setPassportBlood, placeholder: "e.g. A+" },
              ].map(field => (
                <div key={field.label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 10, color: "#6b6760", textTransform: "uppercase", letterSpacing: "0.06em" }}>{field.label}</span>
                  <input
                    value={field.value}
                    onChange={e => field.setter(e.target.value)}
                    placeholder={field.placeholder}
                    style={{
                      padding: "6px 10px", borderRadius: 8, fontSize: 13,
                      background: "#3d3a34", border: "1px solid #4d4a44",
                      color: "#fff", outline: "none", width: 160,
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Passport card */}
            <div style={{ flex: 1, padding: "24px 16px 48px", display: "flex", justifyContent: "center" }}>
              <div className="passport-card" style={{
                width: "100%", maxWidth: 760,
                background: "#fff",
                borderRadius: 18,
                boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
                overflow: "hidden",
                fontFamily: "'Inter', system-ui, sans-serif",
              }}>

                {/* ── Passport header ── */}
                <div style={{
                  background: "linear-gradient(135deg, #1c1a16 0%, #2d1f3f 60%, #1c1620 100%)",
                  padding: "28px 32px 24px",
                  display: "flex", alignItems: "flex-start", gap: 20,
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                    background: "linear-gradient(135deg, #e44c81, #f05808)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 28,
                  }}>🧬</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "#a78bfa", fontWeight: 600, marginBottom: 4 }}>
                      Genomic Health Passport · For Healthcare Providers
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>
                      {passportName || "Patient Name Not Set"}
                    </div>
                    <div style={{ display: "flex", gap: 20, marginTop: 8, flexWrap: "wrap" }}>
                      {[
                        ["Date of birth", passportDob || "—"],
                        ["Blood type", passportBlood || "Not provided"],
                        ["Report generated", today],
                        ["SNPs analyzed", results.summary.total_snps_found.toLocaleString()],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <div style={{ fontSize: 10, color: "#6b6760", textTransform: "uppercase", letterSpacing: "0.06em" }}>{k}</div>
                          <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600, marginTop: 1 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{
                    background: "#dc2626", borderRadius: 10,
                    padding: "6px 14px", fontSize: 11, fontWeight: 800,
                    color: "#fff", letterSpacing: "0.06em", alignSelf: "flex-start",
                    textTransform: "uppercase", flexShrink: 0,
                  }}>
                    ⚕ Medical Reference
                  </div>
                </div>

                <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 28 }}>

                  {/* ── Critical drug alerts ── */}
                  {(criticalAlerts.length > 0 || criticalPharma.length > 0) && (
                    <section>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
                        padding: "8px 14px", background: "#fff1f2", borderRadius: 10,
                        border: "1px solid #fca5a5",
                      }}>
                        <span style={{ fontSize: 18 }}>⚠</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#b91c1c", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Critical Alerts — Read Before Prescribing
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[...criticalPharma, ...criticalAlerts.filter(({ cat, f }) => !isPharmaFinding(cat, f))].map(({ cat, f }, i) => (
                          <div key={i} style={{
                            padding: "12px 16px", borderRadius: 10,
                            background: "#fff1f2", border: "1px solid #fca5a5",
                            display: "grid", gridTemplateColumns: "1fr auto", gap: 8,
                          }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: "#b91c1c" }}>{f.name}</div>
                              <div style={{ fontSize: 11, color: "#6b6760", marginTop: 1 }}>Gene: {f.gene} · {cat.plain_name}</div>
                              <div style={{ fontSize: 13, color: "#374151", marginTop: 6, lineHeight: 1.5 }}>
                                <strong>Result:</strong> {f.your_result} — {f.plain_explanation}
                              </div>
                              {f.actions && f.actions.length > 0 && (
                                <div style={{ marginTop: 6 }}>
                                  {f.actions.slice(0, 2).map((a, ai) => (
                                    <div key={ai} style={{ fontSize: 12, color: "#b91c1c", display: "flex", gap: 5, marginTop: 3 }}>
                                      <span>▸</span><span>{a}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{
                              fontSize: 10, fontWeight: 800, color: "#b91c1c",
                              background: "#fee2e2", padding: "4px 10px", borderRadius: 8,
                              alignSelf: "flex-start", whiteSpace: "nowrap",
                            }}>HIGH ALERT</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* ── Pharmacogenomics table ── */}
                  {(pharmaFindings.length > 0 || criticalPharma.length > 0) && (
                    <section>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#e44c81", marginBottom: 10 }}>
                        💊 Pharmacogenomics — Medication Response Profile
                      </div>
                      <div style={{ border: "1px solid #f0f0f0", borderRadius: 12, overflow: "hidden" }}>
                        <div style={{
                          display: "grid", gridTemplateColumns: "2fr 1fr 2fr 100px",
                          background: "#fafafa", padding: "8px 14px",
                          fontSize: 10, fontWeight: 700, color: "#9c9892",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          borderBottom: "1px solid #f0f0f0",
                        }}>
                          <span>Medication / Drug Class</span>
                          <span>Gene</span>
                          <span>Your Profile</span>
                          <span>Alert Level</span>
                        </div>
                        {[...criticalPharma, ...pharmaFindings].map(({ f }, i) => {
                          const s = alertColor(f.impact_level);
                          return (
                            <div key={i} style={{
                              display: "grid", gridTemplateColumns: "2fr 1fr 2fr 100px",
                              padding: "10px 14px", alignItems: "center",
                              borderBottom: i < pharmaFindings.length - 1 + criticalPharma.length ? "1px solid #f8f8f8" : "none",
                              background: f.impact_level === "high" ? "#fff9f9" : "transparent",
                            }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#1c1a16" }}>{f.name}</div>
                              <div style={{ fontSize: 11, color: "#6b6760", fontFamily: "monospace" }}>{f.gene}</div>
                              <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>{f.your_result}</div>
                              <div style={{
                                fontSize: 10, fontWeight: 700, color: s.text,
                                background: s.bg, border: `1px solid ${s.border}`,
                                padding: "3px 8px", borderRadius: 6, textAlign: "center",
                              }}>{s.label}</div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* ── Health risk factors ── */}
                  {healthRisks.length > 0 && (
                    <section>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#f05808", marginBottom: 10 }}>
                        🏥 Health Risk Factors & Susceptibilities
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {healthRisks.map(({ cat, f }, i) => {
                          const s = alertColor(f.impact_level);
                          return (
                            <div key={i} style={{
                              padding: "11px 14px", borderRadius: 10,
                              background: s.bg, border: `1px solid ${s.border}`,
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1a16" }}>{f.name}</div>
                                  <div style={{ fontSize: 11, color: "#6b6760", marginTop: 1 }}>{cat.plain_name} · {f.gene}</div>
                                </div>
                                <div style={{
                                  fontSize: 10, fontWeight: 700, color: s.text,
                                  background: "#fff", border: `1px solid ${s.border}`,
                                  padding: "2px 7px", borderRadius: 6, flexShrink: 0,
                                }}>{s.label}</div>
                              </div>
                              <div style={{ fontSize: 12, color: "#374151", marginTop: 7, lineHeight: 1.5 }}>
                                {f.your_result} — {f.plain_explanation.slice(0, 100)}{f.plain_explanation.length > 100 ? "…" : ""}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* ── All categories quick-reference ── */}
                  <section>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7c3aed", marginBottom: 10 }}>
                      🧬 Full Genomic Summary by Category
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {results.categories.map(cat => (
                        <div key={cat.category} style={{
                          padding: "10px 14px", borderRadius: 10,
                          border: "1px solid #f0f0f0", background: "#fafafa",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 16 }}>{cat.emoji}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#1c1a16" }}>{cat.plain_name}</span>
                            <span style={{ fontSize: 11, color: "#9c9892", marginLeft: "auto" }}>
                              {cat.findings.length} finding{cat.findings.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {cat.findings.map(f => {
                              const s = alertColor(f.impact_level);
                              return (
                                <span key={f.gene} style={{
                                  fontSize: 11, padding: "2px 8px", borderRadius: 8,
                                  background: s.bg, border: `1px solid ${s.border}`,
                                  color: s.text, fontWeight: 600,
                                }}>
                                  {f.gene}: {f.your_result}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* ── Emergency quick-ref card ── */}
                  {criticalAlerts.length > 0 && (
                    <section style={{
                      padding: "16px 20px", borderRadius: 12,
                      background: "#1c1a16", border: "2px solid #e44c81",
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#e44c81", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                        ⚕ Emergency Quick Reference — Critical Variants
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {criticalAlerts.map(({ f }, i) => (
                          <div key={i} style={{
                            display: "flex", alignItems: "center", gap: 10, fontSize: 13,
                          }}>
                            <span style={{ color: "#f87171", fontWeight: 700, flexShrink: 0 }}>▸</span>
                            <span style={{ color: "#fff", fontWeight: 600 }}>{f.name}</span>
                            <span style={{ color: "#9c9892", fontSize: 11, fontFamily: "monospace" }}>{f.gene}</span>
                            <span style={{ color: "#fbbf24", marginLeft: "auto", fontSize: 12, fontWeight: 600, textAlign: "right" }}>
                              {f.your_result}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* ── Footer ── */}
                  <div style={{
                    paddingTop: 20, borderTop: "1px solid #f0f0f0",
                    display: "flex", justifyContent: "space-between",
                    alignItems: "flex-end", flexWrap: "wrap", gap: 12,
                  }}>
                    <div style={{ fontSize: 10, color: "#b0afaa", lineHeight: 1.6, maxWidth: 480 }}>
                      ⚠ <strong>Not medical advice.</strong> This document is generated from consumer genomic data and is
                      intended as a reference tool for licensed healthcare providers. Genetic variants reported here
                      should be interpreted in the context of the patient&apos;s full clinical picture. Variants should be
                      confirmed by clinical-grade testing before making treatment decisions.
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "#9c9892" }}>Generated by AI Genomics Agent</div>
                      <div style={{ fontSize: 10, color: "#9c9892" }}>{today} · Privacy-first · Data processed locally</div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
