export default function Footer() {
  const col: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
  const heading: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 6 };
  const link: React.CSSProperties = { fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "none", transition: "color 0.15s" };

  return (
    <footer style={{ background: "#0a0f1e", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "56px 0 0" }}>
      <div style={{ maxWidth: "72rem", margin: "0 auto", padding: "0 48px" }}>

        {/* Top: logo + columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr", gap: 40, marginBottom: 48 }}>

          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, overflow: "hidden", background: "#060d18", boxShadow: "0 0 0 1px rgba(240,88,8,0.3)", flexShrink: 0 }}>
                <img src="/logo-original.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "hue-rotate(170deg) saturate(1.35) brightness(1.08)" }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>AI Genomics Agent</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, maxWidth: 260 }}>
              Privacy-first AI platform for genomics, multi-omics, proteomics, and biomedical discovery. All computation runs locally on your machine.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <a href="mailto:contact@ai-genomics-agent.com"
                style={{ fontSize: 11, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(240,88,8,0.35)", color: "#f97316", fontWeight: 600, textDecoration: "none", background: "rgba(240,88,8,0.08)" }}>
                Contact Us
              </a>
              <a href="/privacy"
                style={{ fontSize: 11, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontWeight: 600, textDecoration: "none" }}>
                Privacy Policy
              </a>
            </div>
          </div>

          {/* Platform */}
          <div style={col}>
            <div style={heading}>Platform</div>
            {[
              { href: "/science",   label: "Analysis Pipelines" },
              { href: "/launch",    label: "Launch Pipeline" },
              { href: "/data",      label: "Public Databases" },
              { href: "/multiomics",label: "Multi-omics" },
              { href: "/discovery", label: "Discovery" },
            ].map(({ href, label }) => (
              <a key={href} href={href} style={link}
                onMouseEnter={e => (e.currentTarget.style.color = "#f97316")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}>
                {label}
              </a>
            ))}
          </div>

          {/* Pipelines */}
          <div style={col}>
            <div style={heading}>Pipelines</div>
            {[
              { href: "/launch?type=rnaseq",      label: "RNA-seq" },
              { href: "/launch?type=wgs",         label: "Whole Genome" },
              { href: "/launch?type=scrnaseq",    label: "Single-Cell" },
              { href: "/launch?type=multiomics",  label: "Multi-omics" },
              { href: "/launch?type=metabolomics",label: "Metabolomics" },
              { href: "/launch?type=spatial",     label: "Spatial" },
            ].map(({ href, label }) => (
              <a key={href} href={href} style={link}
                onMouseEnter={e => (e.currentTarget.style.color = "#f97316")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}>
                {label}
              </a>
            ))}
          </div>

          {/* Resources */}
          <div style={col}>
            <div style={heading}>Resources</div>
            {[
              { href: "/science#replicate", label: "Paper Replication" },
              { href: "/data",              label: "TCGA / GEO Data" },
              { href: "/connect",           label: "HPC / Cloud Setup" },
              { href: "/dashboard",         label: "Dashboard" },
              { href: "/flow",              label: "Workflow Builder" },
            ].map(({ href, label }) => (
              <a key={href} href={href} style={link}
                onMouseEnter={e => (e.currentTarget.style.color = "#f97316")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}>
                {label}
              </a>
            ))}
          </div>

          {/* Info */}
          <div style={col}>
            <div style={heading}>Info</div>
            {[
              { href: "/privacy",  label: "Privacy Policy" },
              { href: "/account",  label: "Account" },
              { href: "/login",    label: "Sign In" },
              { href: "/connect",  label: "Connect Data" },
            ].map(({ href, label }) => (
              <a key={href} href={href} style={link}
                onMouseEnter={e => (e.currentTarget.style.color = "#f97316")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}>
                {label}
              </a>
            ))}

            <div style={{ marginTop: 16 }}>
              <div style={heading}>Privacy</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.55 }}>
                🔒 Data never leaves<br />your machine
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
            © {new Date().getFullYear()} AI Genomics Agent. All rights reserved.
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            {["17 Pipelines", "150+ Tools", "18+ Public Databases", "100% Local"].map(tag => (
              <span key={tag} style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 500 }}>{tag}</span>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
}
