"use client";
import { useState, useEffect, useCallback } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type FsItem = {
  name: string;
  path: string;
  is_dir: boolean;
  size: number | null;
  ext: string | null;
};

type DirListing = {
  path: string;
  parent: string | null;
  items: FsItem[];
};

interface Props {
  allowedExt?: string; // e.g. ".fcs"
  onSelect: (path: string, name: string) => void;
  onCancel: () => void;
}

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default function LocalFileBrowser({ allowedExt = ".fcs", onSelect, onCancel }: Props) {
  const [listing, setListing] = useState<DirListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pathInput, setPathInput] = useState("~");
  const [selected, setSelected] = useState<FsItem | null>(null);

  const browse = useCallback(async (path: string) => {
    setLoading(true);
    setError("");
    setSelected(null);
    try {
      const res = await fetch(`${BASE}/api/fs/browse?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || `Error ${res.status}`);
      }
      const data: DirListing = await res.json();
      setListing(data);
      setPathInput(data.path);
    } catch (e: any) {
      setError(e.message ?? "Could not read directory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { browse("~"); }, [browse]);

  function handlePathKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") browse(pathInput);
  }

  const files = listing?.items.filter(i => !i.is_dir) ?? [];
  const dirs = listing?.items.filter(i => i.is_dir) ?? [];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "85vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Browse your computer</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              Navigate to your {allowedExt.toUpperCase()} file — it stays on your machine, no upload.
            </p>
          </div>
          <button onClick={onCancel} className="text-lg" style={{ color: "var(--muted)" }}>✕</button>
        </div>

        {/* Path bar */}
        <div className="px-5 py-3 flex gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
          {listing?.parent && (
            <button
              onClick={() => browse(listing.parent!)}
              className="px-2 py-1.5 rounded text-xs"
              style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              ← Up
            </button>
          )}
          <input
            value={pathInput}
            onChange={e => setPathInput(e.target.value)}
            onKeyDown={handlePathKey}
            spellCheck={false}
            className="flex-1 px-3 py-1.5 rounded text-xs font-mono focus:outline-none"
            style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
          <button
            onClick={() => browse(pathInput)}
            className="px-3 py-1.5 rounded text-xs"
            style={{ background: "var(--flame)", color: "#fff" }}
          >
            Go
          </button>
        </div>

        {/* File listing */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading && (
            <p className="text-xs text-center py-6" style={{ color: "var(--muted)" }}>Loading…</p>
          )}
          {error && (
            <p className="text-xs text-center py-4" style={{ color: "#c0392b" }}>{error}</p>
          )}
          {!loading && !error && listing && (
            <div className="space-y-0.5">
              {dirs.length === 0 && files.length === 0 && (
                <p className="text-xs text-center py-6" style={{ color: "var(--muted)" }}>
                  No {allowedExt} files or accessible folders here.
                </p>
              )}
              {dirs.map(item => (
                <button
                  key={item.path}
                  onClick={() => browse(item.path)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ color: "var(--text)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--canvas)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ color: "var(--muted)" }}>📁</span>
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="text-xs shrink-0" style={{ color: "var(--dim)" }}>→</span>
                </button>
              ))}
              {files.map(item => {
                const isSel = selected?.path === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => setSelected(isSel ? null : item)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all"
                    style={{
                      background: isSel ? "#fff8f3" : "transparent",
                      border: isSel ? "1px solid var(--flame)" : "1px solid transparent",
                      color: "var(--text)",
                    }}
                  >
                    <span>🧬</span>
                    <span className="flex-1 truncate font-medium">{item.name}</span>
                    {item.size != null && (
                      <span className="text-xs shrink-0" style={{ color: "var(--muted)" }}>{fmt(item.size)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 flex items-center justify-between gap-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="flex-1 min-w-0">
            {selected ? (
              <p className="text-xs truncate font-mono" style={{ color: "var(--flame)" }}>
                {selected.path}
              </p>
            ) : (
              <p className="text-xs" style={{ color: "var(--dim)" }}>
                Click a file to select it
              </p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-xs"
              style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              Cancel
            </button>
            <button
              disabled={!selected}
              onClick={() => selected && onSelect(selected.path, selected.name)}
              className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ background: "var(--flame)", color: "#fff" }}
            >
              Use this file
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
