"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AuthForm } from "@/components/AuthSidePanel";
import { useAuthOptional } from "@/hooks/useAuthOptional";
import styles from "./oncology.module.css";

const base = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");
type Case = { id: string; pet_name: string; pathway: string; status: string };
const statusLabel: Record<string, string> = {
  submitted: "Awaiting intake review",
  staging: "Preparing samples",
  dispatching: "Submitting analysis",
  queued: "Analysis queued",
  review: "Scientist review",
  failed: "Analysis needs attention",
};

async function request(path: string, init?: RequestInit) {
  if (!base) throw new Error("Pet oncology intake is temporarily unavailable.");
  const response = await fetch(`${base}/api/pet-oncology${path}`, {
    ...init,
    cache: "no-store",
    headers: { Authorization: `Bearer ${localStorage.getItem("genomics_token")}`, "Content-Type": "application/json" },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Check your request and try again.");
  return data;
}

export default function PetOncology() {
  const { user, loading, refresh } = useAuthOptional();
  const [pathway, setPathway] = useState("existing");
  const [cases, setCases] = useState<Case[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [insurance, setInsurance] = useState("unsure");

  useEffect(() => {
    if (!user || loading) return;
    let current = true;
    request("/cases").then(value => { if (current) setCases(value); })
      .catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [user, loading]);

  useEffect(() => {
    const queued = cases.filter(item => item.status === "queued");
    if (!user || loading || !queued.length) return;
    let current = true;
    const timer = window.setTimeout(async () => {
      const updates = await Promise.all(queued.map(item =>
        request(`/cases/${item.id}/sync`, { method: "POST" }).catch(() => item)
      ));
      if (current) setCases(previous => previous.map(item => updates.find(update => update.id === item.id) ?? item));
    }, 15_000);
    return () => { current = false; window.clearTimeout(timer); };
  }, [cases, user, loading]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (name: string) => String(data.get(name) ?? "").trim();
    setError("");
    setSaving(true);
    try {
      const created = await request("/cases", { method: "POST", body: JSON.stringify({
        pet_name: value("pet_name"), pathway, consent: data.has("consent"),
        owner: {
          name: value("owner_name"), email: value("email"), phone: value("phone"),
          city: value("city"), region: value("region"), country: value("country"),
          postal_code: value("postal_code"),
        },
        pet: {
          breed: value("breed"), age_years: Number(value("age_years")), sex: value("sex"),
          weight_kg: value("weight_kg") ? Number(value("weight_kg")) : null,
          clinic: value("clinic"), veterinarian: value("veterinarian"),
          clinic_email: value("clinic_email") || null, diagnosis: value("diagnosis"),
          tumor_site: value("tumor_site"), history: value("history"),
        },
        insurance: {
          status: insurance, provider: value("provider"),
          policy_number: value("policy_number"), claim_number: value("claim_number"),
        },
      }) });
      setCases(previous => [created, ...previous]);
      form.reset();
      setInsurance("unsure");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save your request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.canvas}>
      <header className={styles.bar}><Link href="/">← BioVerse</Link><Link href="/account">My account ↗</Link></header>
      <div className={styles.shell}>
        <p className={styles.eyebrow}>Veterinary oncology · Dog pilot</p>
        <h1>Start with your<br />dog’s tumor.</h1>
        <p className={styles.note}>Request a research analysis that compares tumor DNA with matched normal DNA and prioritizes candidate neoantigens for scientist review.</p>
        <div className={styles.panel}>
          <h2>How would you like to start?</h2>
          <div className={styles.options}>
            <button type="button" aria-pressed={pathway === "existing"} onClick={() => setPathway("existing")}>I have sequencing files</button>
            <button type="button" aria-pressed={pathway === "sequencing"} onClick={() => setPathway("sequencing")}>I need biopsy and sequencing coordination</button>
          </div>
          <p className={styles.note}>{pathway === "existing"
            ? "Have paired-end tumor and matched normal FASTQ files from the same dog ready. After intake review, BioVerse will confirm eligibility and arrange private file transfer."
            : "Start with an intake request. A veterinary partner would assess biopsy suitability and coordinate samples for DNA extraction and sequencing."}</p>
          <p className={styles.note}>This pilot provides research intake. Vaccine ordering, biopsy booking, and report checkout are currently unavailable.</p>
          {loading && <p role="status">Checking your account…</p>}
          {!loading && !user && <AuthForm onSuccess={refresh} />}
          {user && <form onSubmit={submit}>
            <fieldset className={styles.fields}>
              <legend>Your contact details</legend>
              <label>Full name<input name="owner_name" autoComplete="name" defaultValue={user.name} required maxLength={120} /></label>
              <label>Email<input name="email" type="email" autoComplete="email" defaultValue={user.email} required /></label>
              <label>Phone<input name="phone" type="tel" autoComplete="tel" required minLength={7} maxLength={40} /></label>
              <label>City<input name="city" autoComplete="address-level2" required maxLength={100} /></label>
              <label>Province or state<input name="region" autoComplete="address-level1" required maxLength={100} /></label>
              <label>Country<input name="country" autoComplete="country-name" required maxLength={100} /></label>
              <label>Postal or ZIP code<input name="postal_code" autoComplete="postal-code" required maxLength={20} /></label>
            </fieldset>
            <fieldset className={styles.fields}>
              <legend>Your dog</legend>
              <label>Name<input name="pet_name" required maxLength={80} /></label>
              <label>Breed<input name="breed" placeholder="Enter mixed or unknown if applicable" required maxLength={100} /></label>
              <label>Age in years<input name="age_years" type="number" min={0} max={35} step="any" required /></label>
              <label>Sex<select name="sex"><option value="unknown">Unknown</option><option value="female">Female</option><option value="male">Male</option></select></label>
              <label>Weight in kg (optional)<input name="weight_kg" type="number" min="0.01" max={150} step="any" /></label>
            </fieldset>
            <fieldset className={styles.fields}>
              <legend>Veterinary history</legend>
              <label>Veterinary clinic<input name="clinic" required maxLength={160} /></label>
              <label>Veterinarian (optional)<input name="veterinarian" maxLength={120} /></label>
              <label>Clinic email (optional)<input name="clinic_email" type="email" /></label>
              <label>Tumor site (optional)<input name="tumor_site" maxLength={120} /></label>
              <label className={styles.full}>Diagnosis or reason for referral<textarea name="diagnosis" rows={2} required maxLength={500} /></label>
              <label className={styles.full}>Biopsy, pathology, and treatment history (optional)<textarea name="history" rows={4} maxLength={2000} /></label>
            </fieldset>
            <fieldset className={styles.fields}>
              <legend>Pet insurance</legend>
              <label>Coverage status<select value={insurance} onChange={event => setInsurance(event.target.value)}>
                <option value="unsure">Unsure</option><option value="insured">Insured</option><option value="uninsured">Uninsured</option>
              </select></label>
              {insurance === "insured" && <>
                <label>Insurer<input name="provider" required maxLength={120} /></label>
                <label>Policy number<input name="policy_number" required maxLength={120} /></label>
                <label>Claim number (optional)<input name="claim_number" maxLength={120} /></label>
              </>}
            </fieldset>
            <label><input type="checkbox" name="consent" required /> I authorize BioVerse to store my contact details, pet information, and insurance details for intake review and to contact me about this request.</label>
            <button className={styles.button} disabled={saving}>{saving ? "Submitting…" : "Submit intake request"}</button>
          </form>}
          {error && <p role="alert">{error}</p>}
        </div>
        {cases.length > 0 && <section className={styles.panel}><h2>Your requests</h2>
          <ul>{cases.map(item => <li key={item.id}><strong>{item.pet_name}</strong> · {statusLabel[item.status] || item.status}<br /><small>Case {item.id}</small></li>)}</ul>
        </section>}
      </div>
    </main>
  );
}
