"use client";

import { useRef, useEffect } from "react";

export default function Footer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const bases = ["A", "C", "G", "T"];
    // Pink / purple / fuchsia palette
    const baseColors: Record<string, string> = {
      A: "#c084fc",  // purple-400
      C: "#a855f7",  // purple-500
      G: "#e879f9",  // fuchsia-400
      T: "#d946ef",  // fuchsia-500
    };

    const fontSize = 13;
    let cols = Math.floor(canvas.width / fontSize);
    let drops: number[] = Array(cols).fill(1);

    let raf: number;
    const draw = () => {
      cols = Math.floor(canvas.width / fontSize);
      if (drops.length !== cols) drops = Array(cols).fill(1);

      // Dark navy fade — matches footer background
      ctx.fillStyle = "rgba(10, 15, 30, 0.06)";
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

  const colStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
  const heading: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(192,132,252,0.6)", marginBottom: 6 };
  const linkBase: React.CSSProperties = { fontSize: 13, color: "rgba(255,255,255,0.55)", textDecoration: "none", transition: "color 0.15s" };

  const hoverOrange = (e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = "#e879f9");
  const unhover     = (e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = "rgba(255,255,255,0.55)");

  return (
    <footer style={{ position: "relative", background: "#0a0f1e", borderTop: "1px solid rgba(192,132,252,0.12)", overflow: "hidden" }}>

      {/* Purple/pink ACGT matrix canvas */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.22, pointerEvents: "none" }} />

      {/* Logo blended — no box, mix-blend-mode:screen makes dark bg vanish */}
      <div style={{ position: "absolute", top: -30, right: 60, width: 320, height: 320, pointerEvents: "none", zIndex: 1 }}>
        <img
          src="/logo-original.png"
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            mixBlendMode: "screen",   // dark background of PNG disappears
            opacity: 0.35,
          }}
        />
      </div>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2, maxWidth: "72rem", margin: "0 auto", padding: "56px 48px 0" }}>

        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr", gap: 40, marginBottom: 48 }}>

          {/* Brand */}
          <div>
            {/* Logo inline — no container box */}
            <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 18 }}>
              <img
                src="/logo-original.png"
                alt=""
                style={{
                  width: 64, height: 64,
                  objectFit: "cover",
                  display: "block",
                  mixBlendMode: "screen",
                  opacity: 0.9,
                  marginRight: 12,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                AI Genomics<br />Agent
              </span>
            </div>

            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, maxWidth: 240 }}>
              Privacy-first AI platform for genomics, multi-omics, proteomics, and biomedical discovery. All computation runs locally.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <a href="mailto:contact@ai-genomics-agent.com"
                style={{ fontSize: 11, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(192,132,252,0.4)", color: "#c084fc", fontWeight: 600, textDecoration: "none", background: "rgba(192,132,252,0.08)" }}>
                Contact Us
              </a>
              <a href="/privacy"
                style={{ fontSize: 11, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", fontWeight: 600, textDecoration: "none" }}>
                Privacy
              </a>
            </div>
          </div>

          {/* Platform */}
          <div style={colStyle}>
            <div style={heading}>Platform</div>
            {[
              { href: "/science",    label: "Analysis Pipelines" },
              { href: "/launch",     label: "Launch Pipeline" },
              { href: "/data",       label: "Public Databases" },
              { href: "/multiomics", label: "Multi-omics" },
              { href: "/discovery",  label: "Discovery" },
            ].map(({ href, label }) => (
              <a key={href} href={href} style={linkBase} onMouseEnter={hoverOrange} onMouseLeave={unhover}>{label}</a>
            ))}
          </div>

          {/* Pipelines */}
          <div style={colStyle}>
            <div style={heading}>Pipelines</div>
            {[
              { href: "/launch?type=rnaseq",       label: "RNA-seq" },
              { href: "/launch?type=wgs",          label: "Whole Genome" },
              { href: "/launch?type=scrnaseq",     label: "Single-Cell" },
              { href: "/launch?type=multiomics",   label: "Multi-omics" },
              { href: "/launch?type=metabolomics", label: "Metabolomics" },
              { href: "/launch?type=spatial",      label: "Spatial" },
            ].map(({ href, label }) => (
              <a key={href} href={href} style={linkBase} onMouseEnter={hoverOrange} onMouseLeave={unhover}>{label}</a>
            ))}
          </div>

          {/* Resources */}
          <div style={colStyle}>
            <div style={heading}>Resources</div>
            {[
              { href: "/science#replicate", label: "Paper Replication" },
              { href: "/data",              label: "TCGA / GEO Data" },
              { href: "/connect",           label: "HPC / Cloud Setup" },
              { href: "/dashboard",         label: "Dashboard" },
              { href: "/flow",              label: "Workflow Builder" },
            ].map(({ href, label }) => (
              <a key={href} href={href} style={linkBase} onMouseEnter={hoverOrange} onMouseLeave={unhover}>{label}</a>
            ))}
          </div>

          {/* Info */}
          <div style={colStyle}>
            <div style={heading}>Info</div>
            {[
              { href: "/privacy", label: "Privacy Policy" },
              { href: "/account", label: "Account" },
              { href: "/login",   label: "Sign In" },
              { href: "/connect", label: "Connect Data" },
            ].map(({ href, label }) => (
              <a key={href} href={href} style={linkBase} onMouseEnter={hoverOrange} onMouseLeave={unhover}>{label}</a>
            ))}
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(192,132,252,0.06)", border: "1px solid rgba(192,132,252,0.15)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#c084fc", marginBottom: 4 }}>🔒 Privacy First</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.55 }}>Data never leaves<br />your machine</div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid rgba(192,132,252,0.08)", padding: "20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
            © {new Date().getFullYear()} AI Genomics Agent · All rights reserved
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            {["17 Pipelines", "150+ Tools", "18+ Databases", "100% Local"].map(tag => (
              <span key={tag} style={{ fontSize: 11, color: "rgba(192,132,252,0.35)", fontWeight: 500 }}>{tag}</span>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
}
