"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  jobId: string | null;
}

export default function ReportViewer({ jobId }: Props) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.generateReport(jobId) as any;
      setReport(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const qcColors: Record<string, string> = {
    PASS: "text-emerald-400 bg-emerald-900/30 border-emerald-700",
    WARN: "text-yellow-400 bg-yellow-900/30 border-yellow-700",
    FAIL: "text-red-400 bg-red-900/30 border-red-700",
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-1">Analysis Report</h2>
        <p className="text-gray-400 text-sm">Generate a full scientific report card with QC metrics and results.</p>
      </div>

      {!report && (
        <div className="space-y-4">
          {error && <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-sm text-red-300">{error}</div>}
          <button
            onClick={handleGenerate}
            disabled={loading || !jobId}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? "Generating report..." : "Generate Report"}
          </button>
        </div>
      )}

      {report && (
        <div className="space-y-5">
          {/* QC status */}
          <div className={`border rounded-xl px-5 py-4 ${qcColors[report.qc_status] || qcColors.WARN}`}>
            <span className="font-semibold text-lg">QC: {report.qc_status}</span>
          </div>

          {/* Download links */}
          <div className="flex gap-3">
            <a
              href={api.reportHtmlUrl(jobId!)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              View HTML Report
            </a>
            {report.pdf_path && (
              <a
                href={api.reportPdfUrl(jobId!)}
                download="genomic_report.pdf"
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
              >
                Download PDF
              </a>
            )}
          </div>

          {/* Inline HTML preview */}
          <div className="border border-gray-800 rounded-xl overflow-hidden">
            <iframe
              src={api.reportHtmlUrl(jobId!)}
              className="w-full h-[600px] bg-white"
              title="Analysis Report"
            />
          </div>
        </div>
      )}
    </div>
  );
}
