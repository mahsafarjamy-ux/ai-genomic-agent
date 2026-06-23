"use client";
import { useEffect, useState, useCallback } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type AuthUser = { email: string; name: string };

/** Like useAuth but never redirects — for pages that are partially public. */
export function useAuthOptional() {
  const [user, setUser]     = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(() => {
    setLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("genomics_token") : null;
    if (!token) { setLoading(false); setUser(null); return; }
    fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        setUser(data ?? null);
        if (!data) localStorage.removeItem("genomics_token");
      })
      .catch(() => { setUser(null); localStorage.removeItem("genomics_token"); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { check(); }, [check]);

  function signOut() {
    const token = typeof window !== "undefined" ? localStorage.getItem("genomics_token") : null;
    if (token) {
      fetch(`${BASE}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem("genomics_token");
    setUser(null);
  }

  return { user, loading, signOut, refresh: check };
}
