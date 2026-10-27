export type Consultant = {
  id: string; name: string; email?: string; credentials: string; bio: string;
  timezone: string; duration_minutes: number; price_cents: number; currency: string;
};
export type CounsellingConfig = {
  enabled: boolean; support_phone: string; consent_version: string;
  consent_text: string; consultants: Consultant[]; video_provider: string;
};
export type CounsellingUser = {
  name: string; email: string; verified: boolean; consented: boolean;
  is_admin: boolean; is_consultant: boolean;
};
export type Slot = { id: string; starts_at: string; ends_at: string; booked?: boolean };
export type Booking = Slot & {
  consultant_name: string; patient_name?: string; status: string;
  price_cents: number; currency: string; checkout_url?: string;
};
const BASE = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

export class CounsellingError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function counsellingRequest<T>(path: string, body?: unknown, method?: string): Promise<T> {
  if (!BASE) throw new CounsellingError("Appointments are not open yet. Please check back for consultant availability.", 503);
  const token = typeof window !== "undefined" ? localStorage.getItem("genomics_token") : null;
  const response = await fetch(`${BASE}/api${path}`, {
    method: method || (body === undefined ? "GET" : "POST"),
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data.detail === "string" ? data.detail : "Please check the form and try again.";
    throw new CounsellingError(detail, response.status);
  }
  return data as T;
}

export function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(cents / 100);
}

export function localDay(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function sessionDate(value: string) {
  return new Date(value).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

// Only server-issued URLs on the selected providers may leave the app.
export function providerUrl(value: string, provider: "stripe" | "daily") {
  const url = new URL(value);
  const valid = provider === "stripe" ? url.hostname === "checkout.stripe.com" : url.hostname.endsWith(".daily.co");
  if (url.protocol !== "https:" || !valid || url.username || url.password) throw new Error("The session link could not be verified. Please contact support.");
  return url.href;
}
