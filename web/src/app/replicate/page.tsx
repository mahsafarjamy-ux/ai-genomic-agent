"use client";

import { useState } from "react";
import NavBar from "@/components/NavBar";
import { useAuth } from "@/hooks/useAuth";
import ArticleUploader from "@/components/ArticleUploader";
import AnalysisSelector from "@/components/AnalysisSelector";
import DataInspector from "@/components/DataInspector";
import JobMonitor from "@/components/JobMonitor";
import ReportViewer from "@/components/ReportViewer";

type Step = "upload" | "choose" | "review" | "inspect" | "run" | "report";

const STEPS: { id: Step; label: string }[] = [
  { id: "upload",  label: "Upload Article" },
  { id: "choose",  label: "Choose Analysis" },
  { id: "review",  label: "Review Pipeline" },
  { id: "inspect", label: "Check Data" },
  { id: "run",     label: "Run" },
  { id: "report",  label: "Report" },
];

const STEP_ORDER: Step[] = ["upload", "choose", "review", "inspect", "run", "report"];

export default function ReplicatePage() {
  const { user, loading, signOut } = useAuth();
  const [step, setStep]               = useState<Step>("upload");
  const [articleId, setArticleId]     = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [jobId, setJobId]             = useState<string | null>(null);

  const currentIdx = STEP_ORDER.indexOf(step);

  return loading || !user ? null : (
    <div className="min-h-screen" style={{ background: "var(--canvas)", color: "var(--text)" }}>
      <NavBar active="/replicate" user={user} onSignOut={signOut} />

      {/* Page header */}
      <div className="px-8 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>Replicate an Article</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          Upload a paper PDF — the platform reads the methods, finds all analyses, and runs the one you choose on your data.
        </p>
      </div>

      {/* Step tabs */}
      <nav className="flex px-8 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
        {STEPS.map((s, i) => {
          const done = STEP_ORDER.indexOf(s.id) < currentIdx;
          const active = step === s.id;
          return (
            <button key={s.id}
              onClick={() => done && setStep(s.id)}
              className="px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors"
              style={{
                borderBottom: active ? "2px solid var(--flame)" : "2px solid transparent",
                color: active ? "var(--flame)" : done ? "var(--amber)" : "var(--dim)",
                cursor: done ? "pointer" : "default",
              }}>
              {done ? "✓ " : `${i + 1}. `}{s.label}
            </button>
          );
        })}
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-10">
        {step === "upload" && (
          <ArticleUploader
            onComplete={(id) => { setArticleId(id); setStep("choose"); }}
          />
        )}
        {(step === "choose" || step === "review") && (
          <AnalysisSelector
            articleId={articleId}
            subStep={step === "choose" ? "pick" : "review"}
            selectedAnalysis={selectedAnalysis}
            onAnalysisPicked={(a) => { setSelectedAnalysis(a); setStep("review"); }}
            onComplete={() => setStep("inspect")}
          />
        )}
        {step === "inspect" && (
          <DataInspector
            articleId={articleId}
            selectedAnalysis={selectedAnalysis}
            onComplete={() => setStep("run")}
          />
        )}
        {step === "run" && (
          <JobMonitor
            articleId={articleId}
            onComplete={(id) => { setJobId(id); setStep("report"); }}
          />
        )}
        {step === "report" && (
          <ReportViewer jobId={jobId} />
        )}
      </div>
    </div>
  );
}
