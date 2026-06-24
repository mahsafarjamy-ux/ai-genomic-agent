"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import NavBar from "@/components/NavBar";
import { useAuth } from "@/hooks/useAuth";

/* Light-theme status styles */
const STATUS_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  pending:           { bg: "#fffbf0", border: "#f5d87a", color: "#a07800" },
  running:           { bg: "#f0f4ff", border: "#a0b4f0", color: "#2244bb" },
  awaiting_approval: { bg: "#fff5ee", border: "#f5b880", color: "var(--amber)" },
  completed:         { bg: "#edf4fb", border: "#9ecde8", color: "var(--flame)" },
  failed:            { bg: "#fff0f0", border: "#f5b0b0", color: "#c0392b" },
  cancelled:         { bg: "#f5f5f2", border: "var(--border)", color: "var(--muted)" },
};

const STATUS_ICONS: Record<string, string> = {
  pending: "⏳", running: "⚡", awaiting_approval: "🔧",
  completed: "✅", failed: "❌", cancelled: "⛔",
};

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [fixProposal, setFixProposal] = useState<any>(null);
  const [approvalComment, setApprovalComment] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const poll = async () => {
      const j = await api.listJobs().catch(() => []) as any[];
      setJobs(j);
      setLoading(false);
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const poll = async () => {
      const j = await api.getJob(selected).catch(() => null);
      if (j) setSelectedJob(j);
      if (j?.status === "awaiting_approval") {
        const fix = await api.getFixProposal(selected).catch(() => null);
        if (fix) setFixProposal(fix);
      }
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [selected]);

  const handleApprove = async (approved: boolean) => {
    if (!selected) return;
    await api.approveFix(selected, approved, approvalComment);
    setFixProposal(null);
    setApprovalComment("");
  };

  const stats = {
    running:   jobs.filter(j => j.status === "running").length,
    completed: jobs.filter(j => j.status === "completed").length,
    failed:    jobs.filter(j => j.status === "failed").length,
    awaiting:  jobs.filter(j => j.status === "awaiting_approval").length,
  };

  return authLoading || !user ? null : (
    <div className="min-h-screen" style={{ background: "var(--canvas)", color: "var(--text)" }}>
      <NavBar active="/dashboard" user={user} onSignOut={signOut} />

      <div className="flex" style={{ height: "calc(100vh - 65px)" }}>

        {/* ── Left sidebar: job list ── */}
        <div className="w-80 flex flex-col" style={{ borderRight: "1px solid var(--border)", background: "var(--surface)" }}>

          <div className="p-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="font-semibold mb-3" style={{ color: "var(--text)" }}>Jobs</h2>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              {([
                ["Running",  stats.running,   "var(--fuchsia)"],
                ["Done",     stats.completed, "var(--flame)"],
                ["Failed",   stats.failed,    "#c0392b"],
              ] as [string, number, string][]).map(([label, count, color]) => (
                <div key={label} className="rounded-lg p-2 text-center"
                  style={{ background: "var(--canvas)", border: "1px solid var(--border)" }}>
                  <div className="text-xl font-bold" style={{ color }}>{count}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div>
                </div>
              ))}
            </div>

            {stats.awaiting > 0 && (
              <div className="mt-2 rounded-lg p-2 text-center text-sm"
                style={{ background: "#fff5ee", border: "1px solid #f5b880", color: "var(--amber)" }}>
                ⚠ {stats.awaiting} job{stats.awaiting > 1 ? "s" : ""} need{stats.awaiting === 1 ? "s" : ""} approval
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="p-4 text-sm" style={{ color: "var(--muted)" }}>Loading...</div>
            )}
            {!loading && jobs.length === 0 && (
              <div className="p-4 text-center text-sm" style={{ color: "var(--dim)" }}>
                No jobs yet.<br />
                <a href="/" style={{ color: "var(--flame)" }} className="hover:underline">Start an analysis →</a>
              </div>
            )}
            {jobs.map(job => {
              const s = STATUS_STYLE[job.status] || STATUS_STYLE.cancelled;
              const isActive = selected === job.job_id;
              return (
                <button key={job.job_id} onClick={() => setSelected(job.job_id)}
                  className="w-full text-left px-4 py-3 transition-colors"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    borderLeft: isActive ? "3px solid var(--flame)" : "3px solid transparent",
                    background: isActive ? "var(--canvas)" : "transparent",
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono" style={{ color: "var(--dim)" }}>
                      {job.job_id.slice(0, 8)}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
                      {STATUS_ICONS[job.status]} {job.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                    {job.pipeline_id}
                  </div>
                  <div className="mt-1 h-1 rounded-full" style={{ background: "var(--border)" }}>
                    <div className="h-1 rounded-full transition-all duration-500"
                      style={{ width: `${job.progress_percent}%`, background: "var(--flame)" }} />
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--dim)" }}>
                    {new Date(job.started_at).toLocaleTimeString()}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: job detail ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selected && (
            <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--dim)" }}>
              Select a job to view details
            </div>
          )}

          {selected && selectedJob && (
            <div className="space-y-5 max-w-3xl">

              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
                    {selectedJob.pipeline_id}
                  </h2>
                  <p className="text-sm font-mono" style={{ color: "var(--muted)" }}>{selected}</p>
                </div>
                {(() => {
                  const s = STATUS_STYLE[selectedJob.status] || STATUS_STYLE.cancelled;
                  return (
                    <span className="px-3 py-1 rounded-lg text-sm font-medium"
                      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
                      {STATUS_ICONS[selectedJob.status]} {selectedJob.status.replace("_", " ").toUpperCase()}
                    </span>
                  );
                })()}
              </div>

              {/* Progress */}
              <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: "var(--muted)" }}>
                    {selectedJob.current_step || "Waiting..."}
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {selectedJob.progress_percent?.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 rounded-full" style={{ background: "var(--border)" }}>
                  <div className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${selectedJob.progress_percent}%`, background: "var(--flame)" }} />
                </div>
              </div>

              {/* Fix proposal */}
              {fixProposal && (
                <div className="rounded-xl p-5 space-y-4"
                  style={{ background: "#fff5ee", border: "1px solid #f5b880" }}>
                  <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--amber)" }}>
                    🔧 Human Approval Required
                  </h3>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span style={{ color: "var(--muted)" }}>Root cause: </span>
                      <span style={{ color: "var(--text)" }}>{fixProposal.root_cause}</span>
                    </p>
                    <p className="text-sm" style={{ color: "var(--text)" }}>{fixProposal.explanation}</p>
                  </div>
                  {fixProposal.proposed_fix && (
                    <div className="rounded-lg p-3 space-y-2"
                      style={{ background: "var(--canvas)", border: "1px solid var(--border)" }}>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>
                        Proposed fix ({fixProposal.proposed_fix.type})
                      </p>
                      <p className="text-sm" style={{ color: "var(--text)" }}>
                        {fixProposal.proposed_fix.description}
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                        <div className="rounded p-2" style={{ background: "#fff0f0", border: "1px solid #f5c0c0" }}>
                          <div className="mb-1" style={{ color: "#c0392b" }}>Before</div>
                          <pre className="whitespace-pre-wrap" style={{ color: "var(--text)" }}>
                            {fixProposal.proposed_fix.before}
                          </pre>
                        </div>
                        <div className="rounded p-2" style={{ background: "#edf4fb", border: "1px solid #9ecde8" }}>
                          <div className="mb-1" style={{ color: "var(--flame)" }}>After</div>
                          <pre className="whitespace-pre-wrap" style={{ color: "var(--text)" }}>
                            {fixProposal.proposed_fix.after}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                  <input type="text" value={approvalComment}
                    onChange={e => setApprovalComment(e.target.value)}
                    placeholder="Optional comment..."
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
                  <div className="flex gap-3">
                    <button onClick={() => handleApprove(true)}
                      className="px-5 py-2 rounded-lg text-sm font-medium"
                      style={{ background: "var(--flame)", color: "#fff" }}>
                      ✓ Approve &amp; Retry
                    </button>
                    <button onClick={() => handleApprove(false)}
                      className="px-5 py-2 rounded-lg text-sm font-medium"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                      ✗ Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Error */}
              {selectedJob.error_message && !fixProposal && (
                <div className="rounded-xl p-4 text-sm"
                  style={{ background: "#fff0f0", border: "1px solid #f5b0b0", color: "#c0392b" }}>
                  {selectedJob.error_message}
                </div>
              )}

              {/* Paths */}
              <div className="rounded-xl p-4 space-y-2 text-sm"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div>
                  <span style={{ color: "var(--muted)" }}>Data: </span>
                  <span className="font-mono" style={{ color: "var(--text)" }}>{selectedJob.data_dir}</span>
                </div>
                <div>
                  <span style={{ color: "var(--muted)" }}>Results: </span>
                  <span className="font-mono" style={{ color: "var(--text)" }}>{selectedJob.results_dir}</span>
                </div>
                <div>
                  <span style={{ color: "var(--muted)" }}>Started: </span>
                  <span style={{ color: "var(--text)" }}>{new Date(selectedJob.started_at).toLocaleString()}</span>
                </div>
                {selectedJob.completed_at && (
                  <div>
                    <span style={{ color: "var(--muted)" }}>Completed: </span>
                    <span style={{ color: "var(--text)" }}>{new Date(selectedJob.completed_at).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Report button */}
              {selectedJob.status === "completed" && (
                <a href="/" className="inline-block px-5 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "var(--flame)", color: "#fff" }}>
                  Generate Report →
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
