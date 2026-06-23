"use client";

import { AuthUser } from "@/hooks/useAuth";

const NAV_LINKS = [
  { href: "/dashboard",  label: "Dashboard"   },
  { href: "/data",       label: "Public Data"  },
  { href: "/discovery",  label: "Discovery"    },
];

interface NavBarProps {
  active?: string;
  user?: AuthUser | null;
  onSignOut?: () => void;
}

export default function NavBar({ active, user, onSignOut }: NavBarProps) {
  return (
    <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      className="sticky top-0 z-20 px-6 py-3 flex items-center gap-4 shadow-sm">

      {/* Logo — SVG with transparent bg, orange glow contrasts on cream */}
      <a href="/science" className="flex items-center gap-2 shrink-0">
        <img src="/logo.svg" alt="AI Genomics Agent"
          style={{ width: 52, height: 35, display: "block", filter: "drop-shadow(0 0 6px rgba(240,88,8,0.45))" }} />
        <span className="text-base font-semibold tracking-tight hidden sm:block" style={{ color: "var(--text)" }}>
          AI Genomics Agent
        </span>
      </a>

      {/* Main nav */}
      <nav className="flex gap-0.5 ml-4">
        {NAV_LINKS.map(({ href, label }) => (
          <a key={href} href={href}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={active === href
              ? { background: "var(--flame)", color: "#fff" }
              : { color: "var(--muted)" }}
            onMouseEnter={e => { if (active !== href) (e.target as HTMLElement).style.color = "var(--text)"; }}
            onMouseLeave={e => { if (active !== href) (e.target as HTMLElement).style.color = "var(--muted)"; }}>
            {label}
          </a>
        ))}
      </nav>

      {/* Privacy */}
      <a href="/privacy" className="ml-auto shrink-0 text-xs hidden lg:flex items-center gap-1 transition-colors"
        style={{ color: "var(--amber)" }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--flame)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--amber)")}>
        🔒 Privacy
      </a>

      {/* CTAs */}
      <div className="flex items-center gap-2 lg:ml-3 ml-auto">
        <a href="/connect"
          className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--flame)"; (e.currentTarget as HTMLElement).style.color = "var(--flame)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--muted)"; }}>
          Connect Data
        </a>
        <a href="/science#multiomics"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors whitespace-nowrap"
          style={{ background: "var(--flame)" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#d94e07"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--flame)"}>
          Multi-omics
        </a>

        {/* User indicator */}
        {user && (
          <div className="flex items-center gap-2 ml-1 pl-3" style={{ borderLeft: "1px solid var(--border)" }}>
            <a href="/account" className="flex items-center gap-1.5 group">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 transition-opacity group-hover:opacity-80"
                style={{ background: "var(--fuchsia)" }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-medium hidden lg:block" style={{ color: "var(--muted)" }}>
                {user.name.split(" ")[0]}
              </span>
            </a>
            {onSignOut && (
              <button onClick={onSignOut}
                className="text-xs px-2 py-1 rounded transition-colors whitespace-nowrap"
                style={{ color: "var(--dim)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--dim)"; }}>
                Sign out
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
