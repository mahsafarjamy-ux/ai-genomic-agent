"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FlowRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/tools"); }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--canvas)" }}>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Flow Cytometry has moved to Tools — redirecting…
      </p>
    </div>
  );
}
