"use client";

import CounsellingInvite from "@/components/CounsellingInvite";

import { useState, useRef, useEffect } from "react";

export default function GatewayPage() {
  const [hovered, setHovered] = useState<"science" | "personal" | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const bases = ["A", "C", "G", "T"];
    // Silky silver palette — steel-blue tones
    const baseColors: Record<string, string> = {
      A: "#b0bcd4",  // silver-blue
      C: "#94a3c0",  // steel
      G: "#d0d8ec",  // light silver
      T: "#a8b4cc",  // mid silver
    };
    const fontSize = 11;
    let drops: number[] = Array(Math.floor(canvas.width / fontSize)).fill(1);
    let raf: number;
    const draw = () => {
      const cols = Math.floor(canvas.width / fontSize);
      if (drops.length !== cols) drops = Array(cols).fill(1);
      ctx.fillStyle = "rgba(255,255,255,0.13)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < drops.length; i++) {
        const base = bases[Math.floor(Math.random() * 4)];
        ctx.fillStyle = baseColors[base];
        ctx.font = `${fontSize}px monospace`;
        ctx.fillText(base, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#ffffff",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Silky silver ACGT matrix — full-page background */}
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", opacity: 0.45, pointerEvents: "none", zIndex: 0 }} />

      {/* Top bar */}
      <header style={{
        borderBottom: "1px solid #e8e8e8",
        padding: "1.1rem 2rem",
        display: "flex",
        alignItems: "center",
        gap: "0.7rem",
        position: "relative",
        zIndex: 2,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(8px)",
      }}>
        <img src="/logo.png" alt="" style={{
          width: 72, height: 50, display: "block", flexShrink: 0, objectFit: "contain",
        }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: "#1c1a16" }}>
          Genomics Platform
        </span>
        <div style={{ marginLeft: "auto" }}>
          <span style={{ fontSize: 11, color: "#9c9892", background: "rgba(243,243,243,0.9)", borderRadius: 20, padding: "3px 10px" }}>
            🔒 Privacy-first · all analysis runs locally
          </span>
        </div>
      </header>

      {/* Main */}
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "4rem 1.5rem 3rem",
        position: "relative",
        zIndex: 2,
      }}>
        <div style={{
          fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#9c9892", marginBottom: "1.25rem", fontWeight: 500,
        }}>
          Select your experience
        </div>

        <h1 style={{
          fontSize: "clamp(1.9rem, 5vw, 3rem)",
          fontWeight: 800,
          textAlign: "center",
          color: "#1c1a16",
          letterSpacing: "-0.04em",
          lineHeight: 1.15,
          marginBottom: "3rem",
        }}>
          Who are you here for?
        </h1>

        {/* Two cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.5rem",
          width: "100%",
          maxWidth: 780,
        }}>

          {/* ── Scientist card ── */}
          <a
            href="/science"
            onMouseEnter={() => setHovered("science")}
            onMouseLeave={() => setHovered(null)}
            style={{
              borderRadius: 22,
              border: `2px solid ${hovered === "science" ? "#1d6fa4" : "#eaeaea"}`,
              padding: "2.5rem 2.25rem",
              display: "flex", flexDirection: "column", gap: "1.1rem",
              textDecoration: "none", cursor: "pointer",
              transition: "all 0.18s ease",
              background: hovered === "science" ? "#edf4fb" : "#fafafa",
              boxShadow: hovered === "science"
                ? "0 12px 40px rgba(29,111,164,0.12)"
                : "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: hovered === "science" ? "#e8f3fa" : "#f0f0f0",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, transition: "background 0.18s",
            }}>🔬</div>

            <h2 style={{
              fontSize: 22, fontWeight: 800, color: "#1c1a16",
              marginBottom: 0, letterSpacing: "-0.03em", lineHeight: 1.2,
            }}>
              I&apos;m a researcher<br />or scientist
            </h2>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["RNA-seq", "WGS / WES", "scRNA-seq", "ATAC-seq", "Proteomics", "Multi-omics"].map(t => (
                <span key={t} style={{
                  fontSize: 11, padding: "3px 9px", borderRadius: 20,
                  background: hovered === "science" ? "#ffe8d4" : "#efefef",
                  color: hovered === "science" ? "#c04a00" : "#6b6760",
                  fontWeight: 500, transition: "all 0.18s",
                }}>{t}</span>
              ))}
            </div>

            <div style={{
              marginTop: "auto", paddingTop: "0.75rem",
              borderTop: `1px solid ${hovered === "science" ? "#bee3f8" : "#e8e8e8"}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              transition: "border-color 0.18s",
            }}>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: hovered === "science" ? "#1d6fa4" : "#9c9892",
                transition: "color 0.18s",
              }}>Open Pipeline Platform</span>
              <span style={{ fontSize: 18, color: hovered === "science" ? "#1d6fa4" : "#c0c0c0", transition: "color 0.18s" }}>→</span>
            </div>
          </a>

          {/* ── Personal card ── */}
          <a
            href="/personal"
            onMouseEnter={() => setHovered("personal")}
            onMouseLeave={() => setHovered(null)}
            style={{
              borderRadius: 22,
              border: `2px solid ${hovered === "personal" ? "#e44c81" : "#eaeaea"}`,
              padding: "2.5rem 2.25rem",
              display: "flex", flexDirection: "column", gap: "1.1rem",
              textDecoration: "none", cursor: "pointer",
              transition: "all 0.18s ease",
              background: hovered === "personal" ? "#fff5f8" : "#fafafa",
              boxShadow: hovered === "personal"
                ? "0 12px 40px rgba(29,111,164,0.12)"
                : "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: hovered === "personal" ? "#ffeaf2" : "#f0f0f0",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, transition: "background 0.18s",
            }}>🧬</div>

            <h2 style={{
              fontSize: 22, fontWeight: 800, color: "#1c1a16",
              marginBottom: 0, letterSpacing: "-0.03em", lineHeight: 1.2,
            }}>
              I want to understand<br />my DNA
            </h2>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["Ozempic response", "Diet", "Fitness", "Sleep", "Heart health", "Allergies"].map(t => (
                <span key={t} style={{
                  fontSize: 11, padding: "3px 9px", borderRadius: 20,
                  background: hovered === "personal" ? "#ffe0ec" : "#efefef",
                  color: hovered === "personal" ? "#b0275e" : "#6b6760",
                  fontWeight: 500, transition: "all 0.18s",
                }}>{t}</span>
              ))}
            </div>

            <div style={{
              marginTop: "auto", paddingTop: "0.75rem",
              borderTop: `1px solid ${hovered === "personal" ? "#ffc4d8" : "#e8e8e8"}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              transition: "border-color 0.18s",
            }}>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: hovered === "personal" ? "#e44c81" : "#9c9892",
                transition: "color 0.18s",
              }}>Test My DNA →</span>
              <span style={{ fontSize: 18, color: hovered === "personal" ? "#e44c81" : "#c0c0c0", transition: "color 0.18s" }}>→</span>
            </div>
          </a>
        </div>

        <p style={{
          marginTop: "3.5rem", fontSize: 12, color: "#b0afaa",
          textAlign: "center", lineHeight: 1.6,
        }}>
          🔒 All computation runs locally on your machine · No data transmitted anywhere<br />
          Compatible with macOS, Windows, and Linux
        </p>
        <CounsellingInvite />
      </main>
    </div>
  );
}
