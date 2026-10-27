"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Booking, Consultant, CounsellingConfig, CounsellingError, CounsellingUser, Slot, counsellingRequest as request, localDay, money, providerUrl, sessionDate } from "@/lib/counselling";
import styles from "./counselling.module.css";

export default function CounsellingPage() {
  const [config, setConfig] = useState<CounsellingConfig | null>(null);
  const [user, setUser] = useState<CounsellingUser | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [register, setRegister] = useState(true);
  const [checked, setChecked] = useState(false);
  const [consultant, setConsultant] = useState<Consultant | null>(null);
  const [month, setMonth] = useState("");
  const [timezone, setTimezone] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [day, setDay] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [meeting, setMeeting] = useState("");
  const [referrals, setReferrals] = useState<Record<string, {referrer_name: string; referrer_email: string; reference: string}[]>>({});

  const refreshAccount = useCallback(async () => {
    if (!localStorage.getItem("genomics_token")) { setUser(null); setBookings([]); return; }
    try {
      const me = await request<CounsellingUser>("/counselling/me");
      setUser(me);
      setBookings(me.verified ? await request<Booking[]>("/counselling/bookings") : []);
    } catch (err) {
      if (err instanceof CounsellingError && err.status === 401) {
        localStorage.removeItem("genomics_token"); setUser(null); setBookings([]);
      } else throw err;
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const settings = await request<CounsellingConfig>("/counselling/config");
        if (!active) return;
        setConfig(settings);
        setMonth(localDay(new Date().toISOString()).slice(0, 7));
        setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
        await refreshAccount();
        if (new URLSearchParams(window.location.search).has("payment")) setNotice("Payment status is checked with our payment provider. If your appointment is still pending, use Refresh below.");
      } catch (err) { if (active) setError(err instanceof Error ? err.message : "We could not load counselling. Please retry."); }
      finally { if (active) setReady(true); }
    }
    void load();
    return () => { active = false; };
  }, [refreshAccount]);

  useEffect(() => {
    if (!consultant || !month) return;
    let active = true;
    async function load() {
      setSlotsLoading(true); setSlot(null); setDay(""); setSlots([]);
      try {
        // Include neighboring UTC months so local dates near month boundaries are not lost.
        const base = new Date(`${month}-15T12:00:00Z`);
        const months = [-1, 0, 1].map(offset => new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 15)).toISOString().slice(0, 7));
        const result = (await Promise.all(months.map(m => request<Slot[]>(`/counselling/consultants/${consultant!.id}/slots?month=${m}`)))).flat();
        if (active) setSlots(result.filter(s => localDay(s.starts_at).startsWith(month)).sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
      } catch (err) { if (active) setError(err instanceof Error ? err.message : "Could not load availability."); }
      finally { if (active) setSlotsLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [consultant, month]);

  async function action(work: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }

  function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void action(async () => {
      const result = await request<{ token: string }>(register ? "/counselling/register" : "/auth/login", {
        email: data.get("email"), password: data.get("password"), ...(register ? { name: data.get("name") } : {}),
      });
      localStorage.setItem("genomics_token", result.token);
      await refreshAccount();
      if (register) setNotice("Account created. Send a verification code to confirm your email below.");
    });
  }

  async function pay() {
    if (!slot) return;
    await action(async () => {
      const result = await request<{ id: string; checkout_url: string }>("/counselling/bookings", { slot_id: slot.id });
      window.location.assign(providerUrl(result.checkout_url, "stripe"));
    });
  }

  const first = month ? new Date(`${month}-01T12:00:00`) : null;
  const days = first ? new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate() : 0;
  const availableDays = new Set(slots.map(s => localDay(s.starts_at)));
  const canBook = !!user?.verified && !!user?.consented && !!config?.enabled;

  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>BioVerse</Link>
      <Link href="/personal">DNA analysis</Link>
      <a href="#appointments">My sessions</a>
      {user?.is_admin && <Link href="/counselling/manage">Manage consultants</Link>}
      {user && <button className={styles.secondary} disabled={busy} onClick={() => void action(async () => {
        await request("/auth/logout", {}); localStorage.removeItem("genomics_token"); setUser(null); setBookings([]); setMeeting(""); setReferrals({}); setChecked(false);
      })}>Sign out</button>}
    </header>
    <main className={styles.main}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Genetic counselling · Virtual appointments</p>
        <h1>Understand your results.<br />Talk through what comes next.</h1>
        <p>In addition to your DNA analysis with BioVerse, schedule a genetic counselling session with one of our consultants. Choose your consultant, find a time, and meet online.</p>
      </section>
      <ol className={styles.steps} aria-label="Booking steps">
        {[ ["1 · Register", !!user], ["2 · Verify email", user?.verified], ["3 · Consent", user?.consented], ["4 · Choose a session", !!slot], ["5 · Pay & confirm", false] ].map(([label, done]) => <li key={String(label)} className={done ? styles.complete : undefined}>{done ? "✓ " : ""}{label}</li>)}
      </ol>
      {!ready && <p role="status">Loading counselling…</p>}
      {error && <div role="alert" className={styles.error}>{error}{!config && <button className={styles.secondary} onClick={() => window.location.reload()}>Retry</button>}</div>}
      {notice && <div role="status" className={styles.success}>{notice}</div>}
      {config && !config.enabled && <div className={styles.notice}>Appointments are not open yet. You can explore this section; available consultants and booking will appear when the service opens.</div>}
      <div className={styles.grid}>
        <div>
          {ready && config && !user && <section className={styles.card}>
            <h2>{register ? "Create your BioVerse account" : "Welcome back"}</h2>
            <p className={styles.muted}>Already use BioVerse? Sign in with the same account.</p>
            <form className={styles.form} onSubmit={authenticate}>
              {register && <label>Full name<input name="name" autoComplete="name" maxLength={120} required /></label>}
              <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
              <label>Password<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={register ? 12 : 1} maxLength={128} required />{register && <span className={styles.muted}>Use at least 12 characters.</span>}</label>
              <button className={styles.primary} disabled={busy || !config}>{busy ? "Please wait…" : register ? "Create account" : "Sign in"}</button>
            </form>
            <button className={styles.secondary} style={{ marginTop: 16 }} disabled={busy} onClick={() => setRegister(!register)}>{register ? "I already have an account" : "Create a new account"}</button>
          </section>}
          {user && !user.verified && <section className={styles.card}>
            <h2>Confirm your email</h2>
            <p>We will send a one-time code to <strong>{user.email}</strong>.</p>
            <button className={styles.secondary} disabled={busy} onClick={() => void action(async () => { await request("/counselling/verification/send", {}); setNotice("Verification code sent. Check your inbox and spam folder."); })}>Send verification code</button>
            <form className={styles.form} style={{ marginTop: 20 }} onSubmit={event => {
              event.preventDefault(); const data = new FormData(event.currentTarget);
              void action(async () => { await request("/counselling/verification/confirm", { code: data.get("code") }); await refreshAccount(); setNotice("Email confirmed."); });
            }}>
              <label>Email verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" minLength={8} maxLength={8} required /></label>
              <button className={styles.primary} disabled={busy}>Verify email</button>
            </form>
          </section>}
          {user?.verified && config && !user.consented && <section className={styles.card}>
            <h2>Your data and consent</h2>
            <p className={styles.muted}>Please read the information below before booking. Consent version: {config.consent_version}</p>
            <div className={styles.consent}>{config.consent_text || "Consent information is being prepared. Booking will open once it is available."}</div>
            <label className={styles.check}><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I have read this information and consent to the described handling of my information for counselling and virtual care.</label>
            <p className={styles.muted}>This does not give permission for marketing, research, or automatic sharing of your raw DNA files.</p>
            <button className={styles.primary} disabled={busy || !checked || !config.consent_text} onClick={() => void action(async () => {
              await request("/counselling/consent", { version: config.consent_version, accepted: true }); await refreshAccount();
            })}>Save consent and continue</button>
          </section>}
          {user?.verified && user.consented && <details className={styles.card}>
            <summary>Referred by a healthcare provider? (Optional)</summary>
            <p className={styles.muted}>Add the referral contact or reference. Do not enter genetic results or medical history here.</p>
            <form className={styles.form} onSubmit={event => {
              event.preventDefault(); const data = new FormData(event.currentTarget);
              void action(async () => { await request("/counselling/referral", Object.fromEntries(data)); setNotice("Referral details saved."); });
            }}>
              <label>Referring provider<input name="referrer_name" maxLength={120} required /></label>
              <label>Provider email<input name="referrer_email" type="email" maxLength={254} required /></label>
              <label>Referral reference<input name="reference" maxLength={200} /></label>
              <button className={styles.secondary} disabled={busy}>Save referral</button>
            </form>
          </details>}
          <section className={styles.card} id="consultants">
            <h2>Choose your consultant</h2>
            <p className={styles.muted}>Each consultant has their own availability and session fee.</p>
            {ready && (!config || config.consultants.length === 0) && <p>No consultants are accepting bookings yet. Please check back for availability.</p>}
            <div className={styles.consultants}>{config?.consultants.map(person => <button key={person.id} aria-pressed={consultant?.id === person.id} className={`${styles.consultant} ${consultant?.id === person.id ? styles.selected : ""}`} onClick={() => { setConsultant(person); setSlot(null); setDay(""); }}>
              <h3>{person.name}</h3><p>{person.credentials}</p><p className={styles.muted}>{person.bio}</p>
              <p><strong>{money(person.price_cents, person.currency)}</strong> · {person.duration_minutes} minutes · Virtual</p>
            </button>)}</div>
            {consultant && <>
              <h3>Availability for {consultant.name}</h3>
              <p className={styles.muted}>Times shown in your timezone: {timezone}. Consultant timezone: {consultant.timezone}.</p>
              <label>Month<input aria-label="Appointment month" type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>
              {slotsLoading ? <p role="status">Loading available times…</p> : <>
                <div className={styles.calendar} aria-label="Available appointment dates">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <span key={d}>{d}</span>)}
                  {Array.from({ length: first?.getDay() || 0 }, (_, i) => <span key={`empty-${i}`} />)}
                  {Array.from({ length: days }, (_, i) => {
                    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
                    return <button key={date} aria-label={`${date}${availableDays.has(date) ? ", appointments available" : ", no appointments"}`} aria-pressed={day === date} disabled={!availableDays.has(date)} className={day === date ? styles.selected : undefined} onClick={() => { setDay(date); setSlot(null); }}>{i + 1}</button>;
                  })}
                </div>
                {slots.length === 0 && <p className={styles.muted}>No times available this month. Try another month or consultant.</p>}
                <div className={styles.times}>{slots.filter(s => localDay(s.starts_at) === day).map(s => <button className={`${styles.secondary} ${slot?.id === s.id ? styles.selected : ""}`} key={s.id} aria-pressed={slot?.id === s.id} onClick={() => setSlot(s)}>{new Date(s.starts_at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}</button>)}</div>
              </>}
              {slot && <div className={styles.consent}>
                <h3>Your session</h3>
                <p>{consultant.name}<br />{sessionDate(slot.starts_at)} ({timezone})<br />{consultant.duration_minutes} minutes · {money(consultant.price_cents, consultant.currency)}</p>
                <p>Payment is collected before your session. Your appointment is confirmed after payment is verified.</p>
                {!canBook && <p>Complete registration, email verification and consent before paying. Booking must also be open.</p>}
                <button className={styles.primary} disabled={busy || !canBook} onClick={() => void pay()}>{busy ? "Preparing checkout…" : `Continue to payment · ${money(consultant.price_cents, consultant.currency)}`}</button>
              </div>}
            </>}
          </section>
          <section className={styles.card} id="appointments">
            <div className={styles.row}><h2>{user?.is_consultant ? "Your scheduled sessions" : "My sessions"}</h2>{user && <button className={styles.secondary} disabled={busy} onClick={() => void action(refreshAccount)}>Refresh</button>}</div>
            {!user ? <p>Sign in to see your appointments.</p> : bookings.length === 0 ? <p>No sessions booked yet.</p> : bookings.map(booking => <article key={booking.id} className={styles.booking}>
              <h3>{booking.consultant_name}</h3>
              {booking.patient_name && <p>Patient: {booking.patient_name}</p>}
              <p>{sessionDate(booking.starts_at)} ({timezone})</p>
              <span className={styles.badge}>{booking.status.replaceAll("_", " ")}</span>
              <p>{money(booking.price_cents, booking.currency)}</p>
              <div className={styles.row}>
                {["confirmed", "cancellation_requested"].includes(booking.status) && <button className={styles.secondary} disabled={busy} onClick={() => void action(async () => {
                  const data = await request<{referrer_name: string; referrer_email: string; reference: string}[]>(`/counselling/bookings/${booking.id}/referral`);
                  setReferrals(previous => ({...previous, [booking.id]: data}));
                })}>View referral details</button>}
                {booking.status === "pending_payment" && !booking.patient_name && <button className={styles.primary} disabled={busy} onClick={() => void action(async () => { const result = await request<{checkout_url: string}>(`/counselling/bookings/${booking.id}/retry-payment`, {}); window.location.assign(providerUrl(result.checkout_url, "stripe")); })}>Complete payment</button>}
                {["confirmed", "cancellation_requested"].includes(booking.status) && <>
                  <button className={styles.primary} disabled={busy} onClick={() => void action(async () => { const result = await request<{ url: string }>(`/counselling/bookings/${booking.id}/join`, {}); setMeeting(providerUrl(result.url, "daily")); })}>Join virtual session</button>
                  <button className={styles.secondary} disabled={busy || booking.status === "cancellation_requested"} onClick={() => void action(async () => { await request(`/counselling/bookings/${booking.id}/cancel-request`, {}); await refreshAccount(); setNotice("Cancellation requested. Our team will review your request and any refund; it is not yet cancelled."); })}>Request cancellation</button>
                </>}
              </div>
              {referrals[booking.id] && <div className={styles.consent}>{referrals[booking.id].length === 0 ? "No referral details provided." : referrals[booking.id].map((referral, index) => <p key={index}>{referral.referrer_name} · {referral.referrer_email}<br />Reference: {referral.reference || "Not provided"}</p>)}</div>}
              {["confirmed", "cancellation_requested"].includes(booking.status) && <p className={styles.muted}>The private meeting opens 10 minutes before your appointment.</p>}
            </article>)}
            {meeting && <div>
              <div className={styles.row}><h3>Your private virtual session</h3><button className={styles.secondary} onClick={() => setMeeting("")}>Leave meeting</button><a className={styles.secondary} href={meeting} target="_blank" rel="noreferrer">Open in a new tab</a></div>
              <iframe className={styles.meeting} title="BioVerse private counselling session" src={meeting} allow="camera; microphone; fullscreen; display-capture" referrerPolicy="no-referrer" allowFullScreen />
            </div>}
          </section>
        </div>
        <aside className={styles.aside}>
          <section className={styles.card}><p className={styles.eyebrow}>Here to help</p><h2>A question before your visit?</h2><p>Our AI phone assistant can help with booking, preparing for your appointment, and general service questions.</p>
            {config?.support_phone ? <a className={styles.primary} href={`tel:${config.support_phone}`}>Call {config.support_phone}</a> : <p className={styles.muted}>Phone support will be listed here when available.</p>}
            <p className={styles.muted} style={{ marginTop: 18 }}>Tell the assistant if you need a human. Personal genetic results and medical questions are handled by your consultant. Please do not share DNA files, card numbers, or detailed medical history on the support line.</p>
          </section>
          <section className={styles.card}><h3>What to expect</h3><p>A one-to-one online conversation about your questions, the limitations of DNA results, and possible next steps.</p><p className={styles.muted}>Your DNA analysis is not automatically shared with a consultant. Ask your consultant how to share relevant reports securely.</p><Link href="/privacy">Read our privacy information →</Link></section>
        </aside>
      </div>
    </main>
  </div>;
}
