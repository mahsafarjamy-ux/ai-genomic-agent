"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type AuthUser = { email: string; name: string };

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("genomics_token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data) {
          localStorage.removeItem("genomics_token");
          router.push("/login");
        } else {
          setUser(data);
          setLoading(false);
        }
      })
      .catch(() => {
        localStorage.removeItem("genomics_token");
        router.push("/login");
      });
  }, [router]);

  function signOut() {
    const token = localStorage.getItem("genomics_token");
    if (token) {
      fetch(`${BASE}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem("genomics_token");
    router.push("/login");
  }

  return { user, loading, signOut };
}
