"use client";

import { useState, useEffect, useCallback } from "react";
import NavBar from "@/components/NavBar";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { BillingPlan, getBillingPlans, displayPrice, startCheckout } from "@/lib/billing";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("genomics_token") || "";
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
}

function getDeviceId(): string {
  let id = localStorage.getItem("genomics_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("genomics_device_id", id);
  }
  return id;
}

function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /Mac/i.test(ua) ? "macOS" : /Win/i.test(ua) ? "Windows" : /Linux/i.test(ua) ? "Linux" : "Unknown OS";
  const browser = /Chrome/i.test(ua) && !/Chromium|Edge/i.test(ua) ? "Chrome"
    : /Firefox/i.test(ua) ? "Firefox"
    : /Safari/i.test(ua) ? "Safari"
    : /Edge/i.test(ua) ? "Edge" : "Browser";
  return `${browser} on ${os}`;
}

const PLAN_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  free:       { bg: "#f5f5f2", border: "#ddd",     color: "#777" },
  trial:      { bg: "#f0f4ff", border: "#a0b4f0",  color: "#2244bb" },
  essential:  { bg: "#edf4fb", border: "#ffc4a0",  color: "var(--flame)" },
  complete:   { bg: "#f3fff0", border: "#90d080",  color: "#2a7d1a" },
  lifetime:   { bg: "#f8f0ff", border: "#c490f0",  color: "#7020c0" },
  enterprise: { bg: "#fffff0", border: "#d4c020",  color: "#806010" },
};

const PLANS = [
  {
    id: "essential",
    label: "Essential",
    price: "$29",
    devices: 1,
    color: "var(--flame)",
    features: ["1 activated device", "Full pipeline library", "AI-assisted analysis", "Priority processing"],
  },
  {
    id: "complete",
    label: "Complete",
    price: "$79",
    devices: 2,
    color: "#2a7d1a",
    features: ["2 activated devices", "Everything in Essential", "Multi-omics integration", "Team collaboration"],
  },
  {
    id: "lifetime",
    label: "Lifetime",
    price: "$199",
    devices: 3,
    color: "#7020c0",
    features: ["3 activated devices", "Lifetime access", "All future features", "Priority support"],
  },
];

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  pending:           { bg: "#fffbf0", border: "#f5d87a",  color: "#a07800" },
  running:           { bg: "#f0f4ff", border: "#a0b4f0",  color: "#2244bb" },
  awaiting_approval: { bg: "#fff5ee", border: "#f5b880",  color: "var(--amber)" },
  completed:         { bg: "#edf4fb", border: "#ffc4a0",  color: "var(--flame)" },
  failed:            { bg: "#fff0f0", border: "#f5b0b0",  color: "#c0392b" },
  cancelled:         { bg: "#f5f5f2", border: "var(--border)", color: "var(--muted)" },
};
const STATUS_ICONS: Record<string, string> = {
  pending: "⏳", running: "⚡", awaiting_approval: "🔧",
  completed: "✅", failed: "❌", cancelled: "⛔",
};

type Tab = "overview" | "running" | "history" | "datasets" | "papers" | "subscription";

type BillingStatus = {
  plan: string;
  plan_label: string;
  license_key: string | null;
  can_analyze: boolean;
  max_devices: number;
  devices_used: number;
  devices: { id: string; device_id: string; label: string; activated_at: string }[];
};

function JobCard({ job, onClick, active }: { job: any; onClick: () => void; active: boolean }) {
  const s = STATUS_STYLE[job.status] ?? STATUS_STYLE.cancelled;
  return (
    <button onClick={onClick}
      className="w-full text-left rounded-xl p-4 transition-all"
      style={{
        background: active ? "#edf4fb" : s.bg,
        border: active ? "1.5px solid var(--flame)" : `1px solid ${s.border}`,
      }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
            {STATUS_ICONS[job.status]} {job.pipeline_id ?? job.id?.slice(0, 8)}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--dim)" }}>
            {job.created_at ? new Date(job.created_at).toLocaleString() : "—"}
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium"
          style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
          {job.status}
        </span>
      </div>
      {job.data_dir && (
        <p className="text-xs mt-1.5 truncate" style={{ color: "var(--muted)" }}>📁 {job.data_dir}</p>
      )}
    </button>
  );
}

export default function AccountPage() {
  const { user, loading: authLoading, signOut } = useAuth();

  const [tab, setTab]           = useState<Tab>("overview");
  const [jobs, setJobs]         = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  const [savedDatasets, setSavedDatasets] = useState<any[]>([]);
  const [savedPapers, setSavedPapers]     = useState<any[]>([]);

  // Billing state
  const [billing, setBilling]           = useState<BillingStatus | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);
  useEffect(() => {
    getBillingPlans().then(setBillingPlans).catch(() => setBillingError("Plan pricing is temporarily unavailable."));
  }, []);
  function planPrice(id: string) {
    const plan = billingPlans.find(p => p.id === id);
    return plan ? displayPrice(plan) : "Price unavailable";
  }

  const [activateMsg, setActivateMsg]   = useState("");
  const [thisDeviceId]                  = useState(() => typeof window !== "undefined" ? getDeviceId() : "");
  const [thisDeviceLabel]               = useState(() => typeof window !== "undefined" ? getDeviceLabel() : "");

  useEffect(() => {
    const poll = async () => {
      const j = await api.listJobs().catch(() => []) as any[];
      setJobs(j);
      setJobsLoading(false);
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const ds = localStorage.getItem("genomics_saved_datasets");
    const pp = localStorage.getItem("genomics_saved_papers");
    if (ds) setSavedDatasets(JSON.parse(ds));
    if (pp) setSavedPapers(JSON.parse(pp));
  }, []);

  // Check URL params for tab redirect after Stripe success
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "subscription") setTab("subscription");
  }, []);

  const fetchBilling = useCallback(async () => {
    setBillingLoading(true);
    setBillingError("");
    try {
      const res = await authFetch("/api/billing/status");
      if (!res.ok) { setBillingError("Could not load billing info"); return; }
      setBilling(await res.json());
    } catch {
      setBillingError("Could not connect to billing API");
    } finally {
      setBillingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "subscription") fetchBilling();
  }, [tab, fetchBilling]);

  async function handleCheckout(plan: string) {
    setCheckoutLoading(plan);
    try {
      window.location.assign(await startCheckout(plan, billingPlans.find(p => p.id === plan)));
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Could not start checkout. Please try again.");
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleActivate() {
    setActivateMsg("");
    try {
      const res = await authFetch("/api/billing/activate", {
        method: "POST",
        body: JSON.stringify({ device_id: thisDeviceId, device_label: thisDeviceLabel }),
      });
      const data = await res.json();
      if (!res.ok) { setActivateMsg(data.detail || "Activation failed"); return; }
      setActivateMsg(data.already_active ? "This device is already activated." : "Device activated!");
      fetchBilling();
    } catch {
      setActivateMsg("Activation failed. Check that the backend is running.");
    }
  }

  async function handleDeactivate(activationId: string) {
    try {
      await authFetch(`/api/billing/device/${activationId}`, { method: "DELETE" });
      fetchBilling();
    } catch {
      alert("Deactivation failed");
    }
  }

  const runningJobs   = jobs.filter(j => ["running", "pending", "awaiting_approval"].includes(j.status));
  const completedJobs = jobs.filter(j => j.status === "completed");
  const failedJobs    = jobs.filter(j => j.status === "failed");

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "overview",      label: "Overview" },
    { id: "subscription",  label: "Subscription" },
    { id: "running",       label: "Running Jobs",    count: runningJobs.length },
    { id: "history",       label: "Previous Jobs",   count: completedJobs.length + failedJobs.length },
    { id: "datasets",      label: "Saved Datasets",  count: savedDatasets.length },
    { id: "papers",        label: "Saved Papers",    count: savedPapers.length },
  ];

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)", color: "var(--text)" }}>
      <NavBar active="/account" user={user} onSignOut={signOut} />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ── Profile header ── */}
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0"
            style={{ background: "var(--flame)" }}>
            {user.name[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>{user.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>{user.email}</p>
          </div>
          <button onClick={signOut}
            className="ml-auto px-4 py-2 rounded-lg text-sm border"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            Sign out
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5"
              style={tab === t.id
                ? { background: "var(--flame)", color: "#fff" }
                : { color: "var(--muted)" }}>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                  style={tab === t.id
                    ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                    : { background: "var(--canvas)", color: "var(--flame)" }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Running",          value: runningJobs.length,   color: "#2244bb", bg: "#f0f4ff" },
                { label: "Completed",        value: completedJobs.length, color: "var(--flame)", bg: "#edf4fb" },
                { label: "Failed",           value: failedJobs.length,    color: "#c0392b", bg: "#fff0f0" },
                { label: "Saved Datasets",   value: savedDatasets.length, color: "var(--text)", bg: "var(--surface)" },
              ].map(stat => (
                <div key={stat.label} className="rounded-2xl p-5 text-center"
                  style={{ background: stat.bg, border: "1px solid var(--border)" }}>
                  <p className="text-3xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Quick links */}
            <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--muted)" }}>Quick access</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { href: "/tools",      icon: "🔬", label: "Start new analysis" },
                  { href: "/data",       icon: "🗂",  label: "Find public controls" },
                  { href: "/discovery",  icon: "🔭", label: "AI discovery" },
                  { href: "/wizard",     icon: "🧙", label: "Tool selection wizard" },
                  { href: "/multiomics", icon: "🔗", label: "Multi-omics" },
                  { href: "/connect",    icon: "🔌", label: "Connect my data" },
                ].map(l => (
                  <a key={l.href} href={l.href}
                    className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm transition-colors"
                    style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--flame)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                    <span>{l.icon}</span>
                    <span>{l.label}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Recent jobs preview */}
            {jobs.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Recent jobs</p>
                  <button onClick={() => setTab("history")} className="text-xs" style={{ color: "var(--flame)" }}>See all →</button>
                </div>
                <div className="space-y-2">
                  {jobs.slice(0, 4).map(j => (
                    <JobCard key={j.id} job={j} onClick={() => { setTab("history"); setSelectedJob(j); }} active={false} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Running Jobs ── */}
        {tab === "running" && (
          <div className="space-y-4">
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>Running Jobs</h2>
            {jobsLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => (
                <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--surface)" }} />
              ))}</div>
            ) : runningJobs.length === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-sm" style={{ color: "var(--muted)" }}>No jobs currently running.</p>
                <a href="/tools" className="inline-block mt-3 text-sm font-medium" style={{ color: "var(--flame)" }}>Start an analysis →</a>
              </div>
            ) : (
              <div className="space-y-3">
                {runningJobs.map(j => (
                  <div key={j.id} className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm" style={{ color: "var(--text)" }}>
                          {STATUS_ICONS[j.status]} {j.pipeline_id ?? j.id?.slice(0, 12)}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "var(--dim)" }}>
                          Started: {j.created_at ? new Date(j.created_at).toLocaleString() : "—"}
                        </p>
                        {j.data_dir && <p className="text-xs mt-0.5 font-mono truncate" style={{ color: "var(--muted)" }}>📁 {j.data_dir}</p>}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                        style={{ background: STATUS_STYLE[j.status]?.bg, border: `1px solid ${STATUS_STYLE[j.status]?.border}`, color: STATUS_STYLE[j.status]?.color }}>
                        {j.status}
                      </span>
                    </div>
                    {j.status === "running" && (
                      <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--canvas)" }}>
                        <div className="h-full rounded-full animate-pulse" style={{ background: "var(--flame)", width: "60%" }} />
                      </div>
                    )}
                    {j.log && (
                      <pre className="mt-3 text-xs rounded-lg p-3 overflow-x-auto max-h-32"
                        style={{ background: "#1c1a16", color: "#c8c4b8" }}>
                        {j.log.slice(-500)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Previous Jobs ── */}
        {tab === "history" && (
          <div className="space-y-4">
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>Previous Jobs</h2>
            {jobsLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => (
                <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--surface)" }} />
              ))}</div>
            ) : (completedJobs.length + failedJobs.length) === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-sm" style={{ color: "var(--muted)" }}>No completed jobs yet.</p>
                <a href="/tools" className="inline-block mt-3 text-sm font-medium" style={{ color: "var(--flame)" }}>Start an analysis →</a>
              </div>
            ) : (
              <div className="flex gap-6 items-start">
                {/* Job list */}
                <div className="w-72 shrink-0 space-y-2">
                  {[...completedJobs, ...failedJobs].map(j => (
                    <JobCard key={j.id} job={j}
                      onClick={() => setSelectedJob(j)}
                      active={selectedJob?.id === j.id} />
                  ))}
                </div>

                {/* Job detail */}
                {selectedJob ? (
                  <div className="flex-1 rounded-2xl p-6 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold" style={{ color: "var(--text)" }}>
                          {STATUS_ICONS[selectedJob.status]} {selectedJob.pipeline_id ?? selectedJob.id?.slice(0, 12)}
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: "var(--dim)" }}>
                          ID: {selectedJob.id} · {selectedJob.created_at ? new Date(selectedJob.created_at).toLocaleString() : "—"}
                        </p>
                      </div>
                      {selectedJob.status === "completed" && (
                        <div className="flex gap-2">
                          <a href={`/api/reports/${selectedJob.id}/html`} target="_blank" rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{ background: "var(--flame)", color: "#fff" }}>
                            View report
                          </a>
                        </div>
                      )}
                    </div>

                    {selectedJob.data_dir && (
                      <div className="rounded-lg p-3" style={{ background: "var(--canvas)", border: "1px solid var(--border)" }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Input</p>
                        <p className="text-xs font-mono" style={{ color: "var(--text)" }}>📁 {selectedJob.data_dir}</p>
                      </div>
                    )}
                    {selectedJob.results_dir && (
                      <div className="rounded-lg p-3" style={{ background: "var(--canvas)", border: "1px solid var(--border)" }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Results</p>
                        <p className="text-xs font-mono" style={{ color: "var(--text)" }}>📤 {selectedJob.results_dir}</p>
                      </div>
                    )}
                    {selectedJob.error && (
                      <div className="rounded-lg p-3" style={{ background: "#fff0f0", border: "1px solid #f5b0b0" }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: "#c0392b" }}>Error</p>
                        <pre className="text-xs overflow-x-auto whitespace-pre-wrap" style={{ color: "#c0392b" }}>{selectedJob.error}</pre>
                      </div>
                    )}
                    {selectedJob.log && (
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>Log (last 1000 chars)</p>
                        <pre className="text-xs rounded-lg p-3 overflow-x-auto max-h-60 whitespace-pre-wrap"
                          style={{ background: "#1c1a16", color: "#c8c4b8" }}>
                          {selectedJob.log.slice(-1000)}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 rounded-2xl p-10 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>Select a job from the list to see details</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Saved Datasets ── */}
        {tab === "datasets" && (
          <div className="space-y-4">
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>Saved Public Datasets</h2>
            {savedDatasets.length === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-sm" style={{ color: "var(--muted)" }}>No saved datasets yet.</p>
                <p className="text-xs mt-2" style={{ color: "var(--dim)" }}>
                  Browse <a href="/data" style={{ color: "var(--flame)" }}>Public Data</a> and click "+ Compare" to save datasets here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedDatasets.map((ds: any, i: number) => (
                  <div key={i} className="rounded-xl p-4 flex items-start justify-between gap-4"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div>
                      <p className="font-medium text-sm" style={{ color: "var(--text)" }}>
                        {ds.title ?? ds.database ?? ds.accession ?? `Dataset ${i + 1}`}
                      </p>
                      {ds.accession && (
                        <p className="text-xs mt-0.5 font-mono" style={{ color: "#3355cc" }}>{ds.accession}</p>
                      )}
                      {ds.description && (
                        <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--muted)" }}>{ds.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <a href="/data"
                        className="text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: "var(--flame)", color: "#fff" }}>
                        Use in comparison →
                      </a>
                      <button
                        onClick={() => {
                          const updated = savedDatasets.filter((_, idx) => idx !== i);
                          setSavedDatasets(updated);
                          localStorage.setItem("genomics_saved_datasets", JSON.stringify(updated));
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Subscription ── */}
        {tab === "subscription" && (
          <div className="space-y-6">
            {/* Success banner */}
            {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("success") === "1" && (
              <div className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background: "#f3fff0", border: "1px solid #90d080" }}>
                <span style={{ fontSize: 20 }}>✅</span>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "#2a7d1a" }}>Payment successful!</p>
                  <p className="text-xs" style={{ color: "#2a7d1a" }}>Your plan has been activated. Activate this device below to start running analyses.</p>
                </div>
              </div>
            )}

            {/* Current plan card */}
            {billingLoading ? (
              <div className="h-28 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
            ) : billingError ? (
              <div className="rounded-2xl p-5 text-sm" style={{ background: "#fff0f0", border: "1px solid #f5b0b0", color: "#c0392b" }}>
                {billingError}
              </div>
            ) : billing && (
              <>
                <div className="rounded-2xl p-6 flex items-center gap-5"
                  style={{
                    background: PLAN_COLORS[billing.plan]?.bg ?? "#f5f5f2",
                    border: `2px solid ${PLAN_COLORS[billing.plan]?.border ?? "#ddd"}`,
                  }}>
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: "var(--muted)" }}>Current plan</p>
                    <p className="text-3xl font-black" style={{ color: PLAN_COLORS[billing.plan]?.color ?? "#777" }}>
                      {billing.plan_label}
                    </p>
                    <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                      {billing.max_devices === 0
                        ? "No analysis — upgrade to run pipelines"
                        : `${billing.devices_used} / ${billing.max_devices} device${billing.max_devices !== 1 ? "s" : ""} activated`}
                    </p>
                    {billing.license_key && (
                      <p className="text-xs mt-2 font-mono" style={{ color: "var(--dim)" }}>
                        License: <span className="select-all">{billing.license_key}</span>
                      </p>
                    )}
                  </div>
                  {billing.plan !== "free" && (
                    <button
                      onClick={async () => {
                        const res = await authFetch("/api/billing/portal", { method: "POST" });
                        const d = await res.json();
                        if (d.portal_url) window.location.href = d.portal_url;
                      }}
                      className="text-xs px-4 py-2 rounded-xl font-medium border"
                      style={{ borderColor: PLAN_COLORS[billing.plan]?.border, color: PLAN_COLORS[billing.plan]?.color }}>
                      Manage billing →
                    </button>
                  )}
                </div>

                {/* Device list */}
                <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Activated devices</p>
                    {billing.can_analyze && billing.devices_used < billing.max_devices && (
                      <button onClick={handleActivate}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium"
                        style={{ background: "var(--flame)", color: "#fff" }}>
                        + Activate this device
                      </button>
                    )}
                  </div>

                  {activateMsg && (
                    <p className="text-xs px-3 py-2 rounded-lg"
                      style={{ background: activateMsg.includes("!") && !activateMsg.includes("failed") ? "#f3fff0" : "#fff0f0",
                               color: activateMsg.includes("!") && !activateMsg.includes("failed") ? "#2a7d1a" : "#c0392b" }}>
                      {activateMsg}
                    </p>
                  )}

                  {billing.devices.length === 0 ? (
                    <p className="text-sm text-center py-6" style={{ color: "var(--muted)" }}>
                      {billing.can_analyze
                        ? 'No devices activated yet. Click "+ Activate this device" above.'
                        : "Upgrade your plan to activate a device and run analyses."}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {billing.devices.map(d => {
                        const isCurrent = d.device_id === thisDeviceId;
                        return (
                          <div key={d.id} className="flex items-center justify-between rounded-xl px-4 py-3"
                            style={{
                              background: isCurrent ? "#edf4fb" : "var(--canvas)",
                              border: `1px solid ${isCurrent ? "var(--flame)" : "var(--border)"}`,
                            }}>
                            <div>
                              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                                {d.label || "Unknown device"}
                                {isCurrent && <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
                                  style={{ background: "var(--flame)", color: "#fff" }}>this device</span>}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: "var(--dim)" }}>
                                Activated {new Date(d.activated_at).toLocaleDateString()}
                              </p>
                            </div>
                            <button onClick={() => handleDeactivate(d.id)}
                              className="text-xs px-3 py-1.5 rounded-lg"
                              style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                              Deactivate
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Upgrade plans */}
            {billing && billing.plan === "free" && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted)" }}>Upgrade your plan</p>
                <div className="grid sm:grid-cols-3 gap-4">
                  {PLANS.map(p => (
                    <div key={p.id} className="rounded-2xl p-5 flex flex-col gap-3"
                      style={{ border: `2px solid ${p.color}22`, background: `${p.color}08` }}>
                      <div>
                        <p className="font-black text-xl" style={{ color: p.color }}>{p.label}</p>
                        <p className="text-2xl font-bold mt-0.5" style={{ color: "var(--text)" }}>{planPrice(p.id)} <span className="text-sm font-normal" style={{ color: "var(--muted)" }}>one-time</span></p>
                        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{p.devices} device{p.devices > 1 ? "s" : ""}</p>
                      </div>
                      <ul className="space-y-1">
                        {p.features.map(f => (
                          <li key={f} className="text-xs flex items-start gap-1.5" style={{ color: "var(--text)" }}>
                            <span style={{ color: p.color }}>✓</span> {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => handleCheckout(p.id)}
                        disabled={checkoutLoading === p.id}
                        className="mt-auto w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
                        style={{ background: p.color, color: "#fff", opacity: checkoutLoading === p.id ? 0.6 : 1 }}>
                        {checkoutLoading === p.id ? "Redirecting…" : `Get ${p.label} →`}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-center mt-4" style={{ color: "var(--dim)" }}>
                  Need more devices? <a href="mailto:support@genomics.local" style={{ color: "var(--flame)" }}>Contact us for Enterprise pricing</a>
                </p>
              </div>
            )}

            {/* Upgrade button for paid users who want more devices */}
            {billing && billing.plan !== "free" && billing.plan !== "enterprise" && (
              <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted)" }}>Need more devices?</p>
                <div className="flex gap-3 flex-wrap">
                  {PLANS.filter(p => {
                    const order = ["essential", "complete", "lifetime"];
                    return order.indexOf(p.id) > order.indexOf(billing.plan);
                  }).map(p => (
                    <button key={p.id}
                      onClick={() => handleCheckout(p.id)}
                      disabled={checkoutLoading === p.id}
                      className="px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: p.color, color: "#fff", opacity: checkoutLoading === p.id ? 0.6 : 1 }}>
                      {checkoutLoading === p.id ? "…" : `Upgrade to ${p.label} (${planPrice(p.id)})`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Saved Papers ── */}
        {tab === "papers" && (
          <div className="space-y-4">
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>Saved Papers</h2>
            {savedPapers.length === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-sm" style={{ color: "var(--muted)" }}>No saved papers yet.</p>
                <p className="text-xs mt-2" style={{ color: "var(--dim)" }}>
                  Use the <a href="/discovery" style={{ color: "var(--flame)" }}>AI Discovery</a> page to find and save relevant literature.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedPapers.map((p: any, i: number) => (
                  <div key={i} className="rounded-xl p-4 flex items-start justify-between gap-4"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="min-w-0">
                      <a href={p.url} target="_blank" rel="noreferrer"
                        className="font-medium text-sm hover:underline leading-snug"
                        style={{ color: "var(--text)" }}>
                        {p.title}
                      </a>
                      <p className="text-xs mt-0.5" style={{ color: "var(--dim)" }}>
                        {p.authors} · {p.year}
                        {p.journal && <span> · {p.journal}</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const updated = savedPapers.filter((_, idx) => idx !== i);
                        setSavedPapers(updated);
                        localStorage.setItem("genomics_saved_papers", JSON.stringify(updated));
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg shrink-0"
                      style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
