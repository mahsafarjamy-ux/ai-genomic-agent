const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API error");
  }
  return res.json();
}

export const api = {
  // Articles
  ingestArticle: (pdf_path: string) =>
    req("/api/articles/ingest", { method: "POST", body: JSON.stringify({ pdf_path }) }),

  uploadArticle: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${BASE}/api/articles/upload`, { method: "POST", body: fd }).then(r => r.json());
  },

  listArticles: () => req<any[]>("/api/articles/"),
  getArticle: (id: string) => req<any>(`/api/articles/${id}`),

  // Pipelines
  listTemplates: () => req<any[]>("/api/pipelines/templates"),
  getConfigSchema: (type: string) => req<any>(`/api/pipelines/templates/${type}/config-schema`),

  // Data inspection
  inspectData: (pipeline_id: string, data_dir: string) =>
    req("/api/data/inspect", { method: "POST", body: JSON.stringify({ pipeline_id, data_dir }) }),

  browseDirectory: (path: string) => req<any>(`/api/data/browse?path=${encodeURIComponent(path)}`),

  // Jobs
  runJob: (payload: {
    pipeline_id: string;
    data_dir: string;
    results_dir: string;
    samples: string[];
    threads?: number;
    memory_gb?: number;
  }) => req("/api/jobs/run", { method: "POST", body: JSON.stringify(payload) }),

  getJob: (id: string) => req<any>(`/api/jobs/${id}`),
  listJobs: () => req<any[]>("/api/jobs/"),
  cancelJob: (id: string) => req(`/api/jobs/${id}/cancel`, { method: "DELETE" }),
  getFixProposal: (jobId: string) => req<any>(`/api/jobs/${jobId}/fix-proposal`),
  approveFix: (jobId: string, approved: boolean, comment?: string) =>
    req(`/api/jobs/${jobId}/approve-fix`, {
      method: "POST",
      body: JSON.stringify({ job_id: jobId, approved, comment }),
    }),

  // Reports
  generateReport: (job_id: string) =>
    req("/api/reports/generate", { method: "POST", body: JSON.stringify({ job_id }) }),

  reportHtmlUrl: (jobId: string) => `${BASE}/api/reports/${jobId}/html`,
  reportPdfUrl: (jobId: string) => `${BASE}/api/reports/${jobId}/pdf`,
  criticReviewJob: (jobId: string, claim?: string) =>
    req<any>(`/api/reports/${jobId}/critic-review${claim ? `?claim=${encodeURIComponent(claim)}` : ""}`, { method: "POST" }),

  // Tool Recommender
  recommendTools: (payload: {
    analysis_type: string;
    study_goal: string;
    organism?: string;
    platform?: string;
    read_length?: number;
    paired_end?: boolean;
    n_samples?: number;
    depth?: number;
    cpu_cores?: number;
    ram_gb?: number;
    has_gpu?: boolean;
    has_hpc?: boolean;
  }) => req("/api/tools/recommend", { method: "POST", body: JSON.stringify(payload) }),

  compareTools: (tool_a: string, tool_b: string, context?: string) =>
    req("/api/tools/compare", {
      method: "POST",
      body: JSON.stringify({ tool_a, tool_b, context: context || "general bioinformatics" }),
    }),

  getToolInfo: (tool_name: string) => req<any>(`/api/tools/tool/${encodeURIComponent(tool_name)}`),
  listAnalysisTypes: () => req<string[]>("/api/tools/analysis-types"),
  getToolRegistry: (analysis_type: string) => req<any>(`/api/tools/registry/${analysis_type}`),

  // Public Datasets
  recommendControls: (payload: {
    analysis_type: string;
    disease_context: string;
    organism?: string;
    n_samples?: number;
    tissue?: string;
  }) =>
    req("/api/public-data/recommend-controls", { method: "POST", body: JSON.stringify(payload) }),

  getAllDatabases: () => req<any[]>("/api/public-data/databases"),
  getDatabasesForType: (analysis_type: string) =>
    req<any>(`/api/public-data/databases/${analysis_type}`),

  searchGeo: (query: string, n = 20) =>
    req<any[]>(`/api/public-data/search/geo?query=${encodeURIComponent(query)}&n=${n}`),

  searchCellxgene: (tissue: string, disease: string) =>
    req<any[]>(
      `/api/public-data/search/cellxgene?tissue=${encodeURIComponent(tissue)}&disease=${encodeURIComponent(disease)}`
    ),

  getGtexExpression: (gene: string, tissue: string) =>
    req<any>(`/api/public-data/gtex/expression?gene=${encodeURIComponent(gene)}&tissue=${encodeURIComponent(tissue)}`),

  // Novel Discovery
  discoverGaps: (payload: {
    query: string;
    analysis_type?: string;
    disease?: string;
    max_results?: number;
  }) => req("/api/discovery/gaps", { method: "POST", body: JSON.stringify(payload) }),

  searchLiterature: (query: string, source?: string) =>
    req<any[]>(`/api/discovery/literature?query=${encodeURIComponent(query)}&source=${source || "all"}`),

  // Cost and reuse planner — call before submitting an analysis job
  planCostReuse: (payload: {
    request: Record<string, any>;
    catalog?: Array<Record<string, any>>;
    compute_options?: Record<string, Record<string, any>>;
  }) => req<any>("/api/discovery/cost-reuse-plan", { method: "POST", body: JSON.stringify(payload) }),

  // Evidence critic — deterministic statistical/reproducibility gate
  criticReview: (payload: {
    claim: string;
    analysis_id?: string;
    analysis_type?: string;
    metrics?: Record<string, any>;
    datasets?: Array<Record<string, any>>;
    methods?: Array<Record<string, any>>;
    results_artifacts?: string[];
    human_review_required?: boolean;
  }) => req<any>("/api/discovery/critic/review", { method: "POST", body: JSON.stringify(payload) }),

  answerCritic: (reviewId: string, evidence: Record<string, any>, comment?: string) =>
    req<any>(`/api/discovery/critic/${reviewId}/evidence`, {
      method: "POST",
      body: JSON.stringify({ evidence, comment: comment || "" }),
    }),
};
