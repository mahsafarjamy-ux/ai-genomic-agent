"use client";

import NavBar from "@/components/NavBar";

const WHAT_CLAUDE_SEES = [
  { icon: "✅", item: "PDF article text (methods section, tool names)", safe: true },
  { icon: "✅", item: "Pipeline configuration (analysis type, tool list)", safe: true },
  { icon: "✅", item: "Public dataset accession numbers (GSE123456, SRR789)", safe: true },
  { icon: "✅", item: "Error messages from tool logs (no data, just tool output text)", safe: true },
  { icon: "❌", item: "Raw FASTQ reads, BAM files, VCF variants", safe: false },
  { icon: "❌", item: "Patient IDs, clinical metadata, or phenotype labels", safe: false },
  { icon: "❌", item: "Expression matrices, count tables, or processed results", safe: false },
  { icon: "❌", item: "Any file from your data directory", safe: false },
];

const DEPLOYMENT_CARDS = [
  {
    title: "Local Machine",
    icon: "💻",
    badge: "Fully offline",
    bullets: [
      "FASTQ / BAM / VCF files stay in the folder you specify",
      "Pipelines run with Docker/Singularity containers locally",
      "Nothing is stored in any external database",
    ],
  },
  {
    title: "HPC Server",
    icon: "🖥️",
    badge: "Data stays on HPC",
    bullets: [
      "Uses your existing VPN + SSH key connection",
      "Snakemake jobs submitted via your existing SLURM profile",
      "Results written to HPC scratch/home — never leave the cluster",
    ],
  },
  {
    title: "Cloud Burst",
    icon: "☁️",
    badge: "Optional, user-controlled",
    bullets: [
      "You choose this mode manually — never automatic",
      "Data goes to a private S3 bucket you own and control",
      "Compute instance terminated immediately after analysis",
    ],
  },
];

const COMPLIANCE = [
  { title: "GDPR / HIPAA", desc: "Patient data never leaves your infrastructure. Only de-identified article text and tool metadata are processed remotely." },
  { title: "IRB / Ethics", desc: "No patient-level data is transmitted to any third party. Analysis stays within your approved compute environment." },
  { title: "Institutional IT", desc: "No new network ports, VPNs, or credentials are required beyond your existing HPC access." },
  { title: "Audit trail", desc: "All pipeline executions are logged locally with timestamps, tools used, and parameters — full reproducibility." },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)", color: "var(--text)" }}>
      <NavBar active="/privacy" />

      <div className="max-w-4xl mx-auto px-8 py-10 space-y-12">
        <div>
          <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text)" }}>Privacy &amp; Data Safety</h1>
          <p className="text-sm leading-relaxed max-w-2xl" style={{ color: "var(--muted)" }}>
            Patient genomic data is the most sensitive data that exists.
            This platform is designed so that genomic data{" "}
            <strong style={{ color: "var(--text)" }}>never leaves the system it lives on</strong>{" "}
            — your laptop, your HPC, or your cloud account.
          </p>
        </div>

        {/* What's remote vs local */}
        <div>
          <h2 className="text-lg font-semibold mb-5" style={{ color: "var(--text)" }}>What's processed remotely vs. what stays local</h2>
          <div className="space-y-2">
            {WHAT_CLAUDE_SEES.map(item => (
              <div key={item.item}
                className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={
                  item.safe
                    ? { background: "#f0f4ff", border: "1px solid #d0dcff" }
                    : { background: "#fff0f0", border: "1px solid #f5c0c0" }
                }>
                <span className="text-lg shrink-0">{item.icon}</span>
                <span className="text-sm" style={{ color: item.safe ? "var(--text)" : "var(--muted)", textDecoration: item.safe ? "none" : "line-through" }}>
                  {item.item}
                </span>
                <span className="ml-auto text-xs shrink-0" style={{ color: item.safe ? "#3355cc" : "#c0392b" }}>
                  {item.safe ? "processed remotely" : "never sent"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Deployment cards */}
        <div>
          <h2 className="text-lg font-semibold mb-5" style={{ color: "var(--text)" }}>Deployment modes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {DEPLOYMENT_CARDS.map(card => (
              <div key={card.title} className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{card.icon}</span>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{card.title}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#f3f0e8", color: "var(--muted)" }}>{card.badge}</span>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {card.bullets.map(b => (
                    <li key={b} className="text-xs flex items-start gap-2" style={{ color: "var(--muted)" }}>
                      <span className="shrink-0 mt-0.5" style={{ color: "var(--flame)" }}>→</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance notes */}
        <div className="pt-8" style={{ borderTop: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text)" }}>Compliance notes</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-xs" style={{ color: "var(--muted)" }}>
            {COMPLIANCE.map(({ title, desc }) => (
              <div key={title} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="font-medium mb-1" style={{ color: "var(--text)" }}>{title}</p>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
