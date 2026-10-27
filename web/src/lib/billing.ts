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
