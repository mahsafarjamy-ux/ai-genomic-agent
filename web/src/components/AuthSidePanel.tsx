"use client";
import { useState } from "react";
import { type AuthUser } from "@/hooks/useAuthOptional";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Sign-in / register form ──────────────────────────────────────────────────

interface AuthFormProps {
  onSuccess: () => void;
  benefits?: string[];
}

export function AuthForm({ onSuccess, benefits }: AuthFormProps) {
  const [mode, setMode]           = useState<"login" | "register">("login");
  const [email, setEmail]         = useState("");
  const [name, setName]           = useState("");
  const [password, setPassword]   = useState("");
  const [newsletter, setNewsletter] = useState(true);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  async function submit() {
    setLoading(true); setError("");
    try {
      const body = mode === "login"
        ? { email, password }
        : { email, name, password, newsletter };
      const res = await fetch(`${BASE}/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Authentication failed");
      localStorage.setItem("genomics_token", data.token);
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {/* Header */}
        <div className="px-5 pt-5 pb-4" style={{ background: "var(--surface)" }}>
          <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>
            {mode === "login" ? "Sign In" : "Create Account"}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            {mode === "login" ? "Sign in to run analyses" : "Free — all data stays on your machine"}
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          {(["login", "register"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              className="flex-1 py-2 text-xs font-semibold"
              style={mode === m
                ? { background: "var(--flame)", color: "#fff" }
                : { background: "var(--canvas)", color: "var(--muted)" }}>
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className="px-5 py-4 space-y-3" style={{ background: "var(--surface)" }}>
          {mode === "register" && (
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
          )}
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
            style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password"
            onKeyDown={e => e.key === "Enter" && submit()}
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
            style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }} />

          {/* Newsletter opt-in — shown on register and subtly on login */}
          {mode === "register" && (
            <label style={{
              display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer",
              padding: "8px 10px", borderRadius: 8,
              background: newsletter ? "#fff8f3" : "var(--canvas)",
              border: `1px solid ${newsletter ? "#ffd4bc" : "var(--border)"}`,
              transition: "all 0.18s",
            }}>
              <input
                type="checkbox"
                checked={newsletter}
                onChange={e => setNewsletter(e.target.checked)}
                style={{ marginTop: 2, accentColor: "var(--flame)", flexShrink: 0 }}
              />
              <span style={{ fontSize: 11, lineHeight: 1.55, color: "var(--text)" }}>
                <strong style={{ color: newsletter ? "var(--flame)" : "var(--text)" }}>
                  Keep me updated
                </strong>
                <br />
                <span style={{ color: "var(--muted)" }}>
                  New pipelines, AI features, and research highlights — no spam, unsubscribe any time.
                </span>
              </span>
            </label>
          )}

          {error && <p className="text-xs" style={{ color: "#dc2626" }}>{error}</p>}

          <button onClick={submit}
            disabled={loading || !email || !password || (mode === "register" && !name)}
            className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
            style={{ background: "var(--flame)", color: "#fff" }}>
            {loading
              ? (mode === "login" ? "Signing in…" : "Creating account…")
              : (mode === "login" ? "Sign In →" : "Create Account →")}
          </button>

          <p className="text-xs text-center pt-0.5" style={{ color: "var(--dim)" }}>
            🔒 All data stays on your machine
          </p>
        </div>
      </div>

      {/* Benefits */}
      {benefits && benefits.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold mb-2.5" style={{ color: "var(--muted)" }}>Why create an account?</p>
          <ul className="space-y-1.5">
            {benefits.map(b => (
              <li key={b} className="flex gap-1.5 text-xs" style={{ color: "var(--dim)" }}>
                <span style={{ color: "var(--flame)" }}>✓</span> {b}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Signed-in user card ───────────────────────────────────────────────────────

interface UserCardProps {
  user: AuthUser;
  onSignOut: () => void;
  links?: { href: string; label: string }[];
}

export function UserCard({ user, onSignOut, links }: UserCardProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
            style={{ background: "var(--flame)", color: "#fff" }}>
            {user.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{user.name}</p>
            <p className="text-xs truncate" style={{ color: "var(--dim)" }}>{user.email}</p>
          </div>
        </div>
        <button onClick={onSignOut} className="text-xs hover:underline" style={{ color: "var(--muted)" }}>
          Sign out
        </button>
      </div>

      {links && links.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted)" }}>
            Quick access
          </p>
          <div className="space-y-0.5">
            {links.map(l => (
              <a key={l.href} href={l.href}
                className="flex items-center justify-between px-2 py-1.5 rounded-lg text-sm"
                style={{ color: "var(--text)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--canvas)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <span>{l.label}</span>
                <span style={{ color: "var(--dim)" }}>→</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
