"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("genomics_token");
    if (token) router.push("/dashboard");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body = mode === "login" ? { email, password } : { email, name, password };
    try {
      const res = await fetch(`${BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Authentication failed");
      }
      const data = await res.json();
      localStorage.setItem("genomics_token", data.token);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "var(--canvas)", border: "1px solid var(--border)",
    color: "var(--text)", borderRadius: "8px", padding: "10px 12px",
    fontSize: "14px", width: "100%", outline: "none",
  } as const;

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--canvas)" }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-base"
            style={{ background: "var(--flame)" }}>G</div>
          <span className="text-xl font-semibold" style={{ color: "var(--text)" }}>
            AI Genomics Agent
          </span>
        </div>

        <div className="rounded-2xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text)" }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
            {mode === "login"
              ? "Sign in to access your analyses and data"
              : "Join the platform to start your genomic analyses"}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
                  Full name
                </label>
                <input value={name} onChange={e => setName(e.target.value)}
                  style={inputStyle} placeholder="Dr. Jane Smith" required />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
                Email address
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                style={inputStyle} placeholder="researcher@university.edu" required />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
                Password
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                style={inputStyle} placeholder="••••••••" required minLength={6} />
            </div>

            {error && (
              <div className="px-3 py-2.5 rounded-lg text-sm"
                style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity"
              style={{ background: "var(--flame)", opacity: loading ? 0.7 : 1 }}>
              {loading
                ? "Please wait..."
                : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="text-xs text-center mt-5" style={{ color: "var(--muted)" }}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="font-semibold"
              style={{ color: "var(--flame)" }}>
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>

        <p className="text-xs text-center mt-4" style={{ color: "var(--dim)" }}>
          🔒 Your genomic data never leaves your machine
        </p>
      </div>
    </div>
  );
}
