const BASE = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

function requireBackend() {
  if (!BASE) throw new Error("Payments are not available yet. Please try again later.");
}

export type BillingPlan = { id: string; amount: number; currency: string };

export async function getBillingPlans(): Promise<BillingPlan[]> {
  requireBackend();
  const response = await fetch(`${BASE}/api/billing/plans`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Payments are temporarily unavailable. Please contact BioVerse support.");
  return data.plans;
}

export function displayPrice(plan: BillingPlan) {
  return `${new Intl.NumberFormat("en-CA", { style: "currency", currency: plan.currency.toUpperCase() }).format(plan.amount / 100)} ${plan.currency.toUpperCase()}`;
}

export async function startCheckout(planId: string, quotedPlan: BillingPlan | undefined): Promise<string> {
  const token = localStorage.getItem("genomics_token");
  if (!token) throw new Error("Please sign in to BioVerse before purchasing.");
  const plan = quotedPlan;
  if (!plan || plan.id !== planId) throw new Error("This plan is not available for purchase yet. Please contact BioVerse support.");
  const query = new URLSearchParams({ plan: planId, expected_amount: String(plan.amount), expected_currency: plan.currency });
  requireBackend();
  const response = await fetch(`${BASE}/api/billing/checkout?${query}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Checkout could not be opened. Please try again.");
  const url = new URL(data.checkout_url);
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" || url.username || url.password) throw new Error("The payment link could not be verified.");
  return url.href;
}

type Installer = { platform: string; label: string; filename: string };
export type PersonalAccess = { active: boolean; downloads: Installer[] };

async function personalRequest(path: string, init?: RequestInit) {
  requireBackend();
  const token = localStorage.getItem("genomics_token");
  if (!token) throw new Error("Sign in to BioVerse to continue.");
  const response = await fetch(`${BASE}${path}`, {
    ...init, cache: "no-store", headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 413) {
      throw new Error("The export is too large for online analysis. Try a compressed ZIP export or use the desktop app.");
    }
    throw new Error(typeof data.detail === "string" ? data.detail : "Personal DNA service is unavailable.");
  }
  return response;
}

export async function getPersonalAccess(signal: AbortSignal): Promise<PersonalAccess> {
  return (await personalRequest("/api/billing/personal-access", { signal })).json();
}

export async function downloadInstaller(installer: Installer) {
  const response = await personalRequest(`/api/billing/personal-download/${encodeURIComponent(installer.platform)}`);
  if (response.headers.get("Content-Type")?.includes("application/json")) {
    const { url } = await response.json();
    window.location.assign(url);
    return;
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = installer.filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function analyzePersonalFile(file: File, signal: AbortSignal) {
  const body = new FormData();
  if (file.size > 64 * 1024 * 1024) throw new Error("DNA export exceeds the 64 MiB limit.");
  let upload: Blob = file;
  let name = file.name;
  if (!/\.(zip|gz)$/i.test(name) && typeof CompressionStream !== "undefined") {
    upload = await new Response(file.stream().pipeThrough(new CompressionStream("gzip"))).blob();
    name += ".gz";
  }
  body.append("file", upload, name);
  return (await personalRequest("/api/genome-personal/analyze", { method: "POST", body, signal })).json();
}
