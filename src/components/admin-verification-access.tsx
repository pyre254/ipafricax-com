import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Check membership before displaying the MFA gate; privileged reads remain server-authorized at aal2.
export async function requireVerificationAdministrator() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw redirect({ to: "/auth", search: { mode: "signin", next: "admin-verification" } });
  const { data: roles, error } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
  if (error || !roles?.some(row => row.role === "admin")) throw redirect({ to: "/dashboard" });
}