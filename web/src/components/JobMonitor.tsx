"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";

interface Props {
  articleId: string | null;
  onComplete: (jobId: string) => void;
}

export default function JobMonitor({ articleId, onComplete }: Props) {
  const [dataDir, setDataDir] = useState("");
  const [resultsDir, setResultsDir] = useState("");
  const [threads, setThreads] = useState(8);
  const [memGb, setMemGb] = useState(32);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [fixProposal, setFixProposal] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logsRef = useRef<HTMLDivElement>(null);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      const j = await api.getJob(jobId).catch(() => null);
      if (!j) return;
      setJob(j);
      if (j.status === "awaiting_approval") {
        api.getFixProposal(jobId).then(setFixProposal).catch(() => {});
      }
      if (j.status === "completed") {
        clearInterval(interval);
        onComplete(jobId);
      }
      if (j.status === "failed") {
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [jobId]);

  // Auto-scroll logs
  useEffect(() => {
    logsRef.current?.scrollTo(0, logsRef.current.scrollHeight);
  }, [logs]);

  // Stream logs via SSE
  useEffect(() => {
    if (!jobId) return;
    const es = new EventSource(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/jobs/${jobId}/logs`);
    es.onmessage = (e) => setLogs(prev => [...prev, e.data]);
    return () => es.close();
  }, [jobId]);

  async function handleStart() {
    if (!dataDir || !resultsDir || !articleId) return;
    setLoading(true);
    setError(null);
    try {
      const result: any = await api.runJob({
        pipeline_id: articleId,
        data_dir: dataDir,
        results_dir: resultsDir,
        samples: [],
        threads,
        memory_gb: memGb,
      });
      setJobId(result.job_id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(approved: boolean) {
    if (!jobId) return;
    await api.approveFix(jobId, approved, approved ? "Approved" : "Rejected");
    setFixProposal(null);
  }

  const statusColor: Record<string, string> = {
    pending: "text-yellow-400",
    running: "text-blue-400",
    awaiting_approval: "text-orange-400",
    completed: "text-emerald-400",
    failed: "text-red-400",
    cancelled: "text-gray-400",
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-1">Run Pipeline</h2>
        <p className="text-gray-400 text-sm">Data is read in-place. Nothing is copied or uploaded.</p>
      </div>

      {!jobId && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Data directory (your files, untouched)</label>
              <input
                type="text"
                value={dataDir}
                onChange={(e) => setDataDir(e.target.value)}
                placeholder="/Users/you/data/"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Results directory (will be created)</label>
              <input
                type="text"
                value={resultsDir}
                onChange={(e) => setResultsDir(e.target.value)}
                placeholder="/Users/you/results/analysis_01/"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">CPU threads</label>
              <input type="number" value={threads} min={1} max={128} onChange={(e) => setThreads(+e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Memory (GB)</label>
              <input type="number" value={memGb} min={4} max={1024} onChange={(e) => setMemGb(+e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-emerald-500" />
            </div>
          </div>

          {error && <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-sm text-red-300">{error}</div>}

          <button
            onClick={handleStart}
            disabled={loading || !dataDir || !resultsDir}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? "Launching..." : "Launch Pipeline"}
          </button>
        </div>
      )}

      {job && (
        <div className="space-y-4">
          {/* Status bar */}
          <div className="bg-gray-900 rounded-xl p-4 flex items-center gap-4">
            <div>
              <p className={`font-medium ${statusColor[job.status] || "text-gray-300"}`}>
                {job.status.replace("_", " ").toUpperCase()}
              </p>
              {job.current_step && <p className="text-sm text-gray-400">{job.current_step}</p>}
            </div>
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${job.progress_percent}%` }}
              />
            </div>
            <span className="text-sm text-gray-400 w-10 text-right">{job.progress_percent.toFixed(0)}%</span>
          </div>

          {/* Fix proposal (human approval checkpoint) */}
          {fixProposal && (
            <div className="bg-orange-900/30 border border-orange-600 rounded-xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔧</span>
                <div>
                  <h3 className="font-semibold text-orange-300">Pipeline Error — Human Approval Required</h3>
                  <p className="text-sm text-gray-300 mt-1"><strong>Root cause:</strong> {fixProposal.root_cause}</p>
                  <p className="text-sm text-gray-400 mt-1">{fixProposal.explanation}</p>
                </div>
              </div>
              {fixProposal.proposed_fix && (
                <div className="bg-gray-950 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-gray-500">Proposed fix ({fixProposal.proposed_fix.type})</p>
                  <p className="text-sm text-gray-200">{fixProposal.proposed_fix.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-red-400">Before:</span><pre className="mt-1 text-gray-400">{fixProposal.proposed_fix.before}</pre></div>
                    <div><span className="text-emerald-400">After:</span><pre className="mt-1 text-gray-300">{fixProposal.proposed_fix.after}</pre></div>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => handleApprove(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium">
                  ✓ Apply Fix & Retry
                </button>
                <button onClick={() => handleApprove(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium">
                  ✗ Reject & Stop
                </button>
              </div>
            </div>
          )}

          {/* Logs */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Live logs</p>
            <div
              ref={logsRef}
              className="bg-gray-950 rounded-xl p-4 h-64 overflow-y-auto font-mono text-xs text-gray-300 space-y-0.5"
            >
              {logs.length === 0 && <span className="text-gray-600">Waiting for output...</span>}
              {logs.map((line, i) => (
                <div key={i} className={line.includes("Error") || line.includes("error") ? "text-red-400" : ""}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
