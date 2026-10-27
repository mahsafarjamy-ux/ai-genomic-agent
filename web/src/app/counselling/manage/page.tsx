"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Booking, Consultant, CounsellingUser, Slot, counsellingRequest as request, money, sessionDate } from "@/lib/counselling";
import styles from "../counselling.module.css";

export default function ManageCounsellingPage() {
  const [user, setUser] = useState<CounsellingUser | null>(null);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [consultantId, setConsultantId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
        const me = await request<CounsellingUser>("/counselling/me");
        setUser(me);
        if (me.is_admin && me.verified) {
          setConsultants(await request<Consultant[]>("/counselling/admin/consultants"));
          setBookings(await request<Booking[]>("/counselling/admin/bookings"));
        }
      } catch (err) { setError(err instanceof Error ? err.message : "Could not load management."); }
      finally { setReady(true); }
    }
    void load();
  }, []);

  useEffect(() => {
    if (!consultantId) return;
    let active = true;
    request<Slot[]>(`/counselling/admin/slots?consultant_id=${consultantId}`).then(result => { if (active) setSlots(result); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [consultantId]);

  async function action(work: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (err) { setError(err instanceof Error ? err.message : "Please try again."); }
    finally { setBusy(false); }
  }

  const consultant = consultants.find(c => c.id === consultantId);
  return <div className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.brand}>BioVerse</Link><Link href="/counselling">← Counselling & sessions</Link></header>
    <main className={styles.main}>
      <section className={styles.hero}><p className={styles.eyebrow}>Service management</p><h1>Consultants & availability</h1><p>Publish real consultant profiles and appointment times. Consultants sign in with their listed email to access assigned sessions.</p></section>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {notice && <div className={styles.success} role="status">{notice}</div>}
      {!ready ? <p>Checking access…</p> : !user?.is_admin || !user.verified ? <section className={styles.card}><h2>Administrator access required</h2><p>Sign in and confirm the email registered as the counselling administrator.</p><Link className={styles.primary} href="/counselling">Sign in / verify email</Link></section> : <>
        <div className={styles.adminGrid}>
          <section className={styles.card}><h2>Add a consultant</h2>
            <form className={styles.form} onSubmit={event => {
              event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
              void action(async () => {
                await request("/counselling/admin/consultants", {
                  name: data.get("name"), email: data.get("email"), credentials: data.get("credentials"), bio: data.get("bio"),
                  timezone: data.get("timezone"), duration_minutes: Number(data.get("duration")), price_cents: Math.round(Number(data.get("price")) * 100), currency: "cad",
                });
                setConsultants(await request<Consultant[]>("/counselling/admin/consultants"));
                form.reset(); setNotice("Consultant saved. Add appointment times to their calendar next.");
              });
            }}>
              <label>Full name<input name="name" required maxLength={120} /></label>
              <label>Account email<input name="email" required type="email" maxLength={254} /></label>
              <label>Verified professional credentials<input name="credentials" required maxLength={200} placeholder="Enter the consultant’s verified credentials" /></label>
              <label>Profile / areas of focus<textarea name="bio" required maxLength={2000} rows={3} /></label>
              <label>Consultant timezone<input name="timezone" defaultValue="America/Toronto" required /></label>
              <label>Session duration (minutes)<input name="duration" type="number" defaultValue={60} min={15} max={180} step={5} required /></label>
              <label>Total session fee (CAD)<input name="price" type="number" min="1" max="10000" step="0.01" required /></label>
              <p className={styles.muted}>Confirm the consultant’s credentials, service agreement, and total price before publishing.</p>
              <button className={styles.primary} disabled={busy}>Save consultant</button>
            </form>
          </section>
          <section className={styles.card}><h2>Publish available times</h2>
            <form className={styles.form} onSubmit={event => {
              event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
              void action(async () => {
                if (!consultant) throw new Error("Choose a consultant.");
                const start = new Date(String(data.get("starts_at")));
                if (!Number.isFinite(start.getTime())) throw new Error("Choose a valid start time.");
                await request("/counselling/admin/slots", { consultant_id: consultant.id, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + consultant.duration_minutes * 60000).toISOString() });
                setSlots(await request<Slot[]>(`/counselling/admin/slots?consultant_id=${consultant.id}`));
                setNotice("Appointment time published.");
              });
            }}>
              <label>Consultant<select value={consultantId} onChange={e => { setConsultantId(e.target.value); setSlots([]); }} required><option value="">Choose a consultant</option>{consultants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label>Start time in {timezone || "your local timezone"}<input name="starts_at" type="datetime-local" required /></label>
              {consultant && <p>{consultant.duration_minutes} minutes · {money(consultant.price_cents, consultant.currency)}<br /><span className={styles.muted}>Consultant timezone: {consultant.timezone}. The entered time uses your browser timezone ({timezone}) and is converted automatically.</span></p>}
              <button className={styles.primary} disabled={busy || !consultant}>Publish time</button>
            </form>
            <h3 style={{ marginTop: 28 }}>Published calendar</h3>
            {!consultantId ? <p>Choose a consultant to view their calendar.</p> : slots.length === 0 ? <p>No upcoming times published.</p> : slots.map(slot => <div key={slot.id} className={styles.booking}><p>{sessionDate(slot.starts_at)} ({timezone})</p><div className={styles.row}><span className={styles.badge}>{slot.booked ? "Reserved / booked" : "Available"}</span><button className={styles.secondary} disabled={busy || slot.booked} onClick={() => void action(async () => {
              await request(`/counselling/admin/slots/${slot.id}`, undefined, "DELETE"); setSlots(await request<Slot[]>(`/counselling/admin/slots?consultant_id=${consultantId}`)); setNotice("Availability removed.");
            })}>Remove availability</button></div></div>)}
          </section>
        </div>
        <section className={styles.card}>
          <div className={styles.row}><h2>Appointments and payment support</h2><button className={styles.secondary} disabled={busy} onClick={() => void action(async () => setBookings(await request<Booking[]>("/counselling/admin/bookings")))}>Refresh appointments</button></div>
          <p className={styles.muted}>Check uncertain payments with Stripe. To finish a cancellation, first issue the full refund in Stripe; BioVerse verifies it before releasing the time.</p>
          {bookings.length === 0 ? <p>No appointments yet.</p> : bookings.map(booking => <article className={styles.booking} key={booking.id}>
            <h3>{booking.patient_name} · {booking.consultant_name}</h3>
            <p>{sessionDate(booking.starts_at)} ({timezone}) · {money(booking.price_cents, booking.currency)}</p>
            <span className={styles.badge}>{booking.status.replaceAll("_", " ")}</span>
            <div className={styles.row}>
              {booking.status === "pending_payment" && <button className={styles.secondary} disabled={busy} onClick={() => void action(async () => {
                const result = await request<{message: string}>(`/counselling/admin/bookings/${booking.id}/reconcile`, {});
                setBookings(await request<Booking[]>("/counselling/admin/bookings")); setNotice(result.message);
              })}>Check payment with Stripe</button>}
              {["confirmed", "cancellation_requested"].includes(booking.status) && <button className={styles.secondary} disabled={busy} onClick={() => void action(async () => {
                const result = await request<{message: string}>(`/counselling/admin/bookings/${booking.id}/complete-cancellation`, {});
                setBookings(await request<Booking[]>("/counselling/admin/bookings")); setNotice(result.message);
                if (consultantId) setSlots(await request<Slot[]>(`/counselling/admin/slots?consultant_id=${consultantId}`));
              })}>Verify full refund & complete cancellation</button>}
            </div>
          </article>)}
        </section>
      </>}
    </main>
  </div>;
}
