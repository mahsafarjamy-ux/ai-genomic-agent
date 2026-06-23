"use client";

import { useState } from "react";

export default function GatewayPage() {
  const [hovered, setHovered] = useState<"science" | "personal" | null>(null);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#ffffff",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      {/* Top bar */}
      <header style={{
        borderBottom: "1px solid #e8e8e8",
        padding: "1.1rem 2rem",
        display: "flex",
        alignItems: "center",
        gap: "0.7rem",
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "linear-gradient(135deg, #f05808, #e44c81)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 800, fontSize: 15,
        }}>G</div>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#1c1a16" }}>
          Genomics Platform
        </span>
        <div style={{ marginLeft: "auto" }}>
          <span style={{ fontSize: 11, color: "#9c9892", background: "#f3f3f3", borderRadius: 20, padding: "3px 10px" }}>
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
              border: `2px solid ${hovered === "science" ? "#f05808" : "#eaeaea"}`,
              padding: "2.5rem 2.25rem",
              display: "flex", flexDirection: "column", gap: "1.1rem",
              textDecoration: "none", cursor: "pointer",
              transition: "all 0.18s ease",
              background: hovered === "science" ? "#fff8f3" : "#fafafa",
              boxShadow: hovered === "science"
                ? "0 12px 40px rgba(240,88,8,0.12)"
                : "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: hovered === "science" ? "#fff0e8" : "#f0f0f0",
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
              borderTop: `1px solid ${hovered === "science" ? "#ffd4bc" : "#e8e8e8"}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              transition: "border-color 0.18s",
            }}>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: hovered === "science" ? "#f05808" : "#9c9892",
                transition: "color 0.18s",
              }}>Open Pipeline Platform</span>
              <span style={{ fontSize: 18, color: hovered === "science" ? "#f05808" : "#c0c0c0", transition: "color 0.18s" }}>→</span>
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
                ? "0 12px 40px rgba(228,76,129,0.12)"
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
      </main>
    </div>
  );
}
