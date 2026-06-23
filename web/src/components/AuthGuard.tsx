"use client";
import { useAuth, AuthUser } from "@/hooks/useAuth";

interface Props {
  children: (user: AuthUser, signOut: () => void) => React.ReactNode;
}

export default function AuthGuard({ children }: Props) {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--canvas)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--flame)", borderTopColor: "transparent" }} />
          <span className="text-sm" style={{ color: "var(--muted)" }}>Authenticating…</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children(user, signOut)}</>;
}
