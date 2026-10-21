import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "rights_holder" | "buyer" | "verifier";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (r: AppRole) => boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  syncSession: (session: Session | null) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const sessionVersion = useRef(0);

  const syncSession = useCallback(async (next: Session | null) => {
    const version = ++sessionVersion.current;
    setSession(next);
    setUser(next?.user ?? null);
    setRoles([]);
    if (!next?.user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", next.user.id);
      if (version === sessionVersion.current) setRoles((data ?? []).map((r) => r.role as AppRole));
    } finally {
      if (version === sessionVersion.current) setLoading(false);
    }
  }, []);

  const value: AuthCtx = {
    user,
    session,
    roles,
    loading,
    hasRole: (r) => roles.includes(r),
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    refreshRoles: async () => { await syncSession(session); },
    syncSession,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
