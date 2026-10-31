import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ page: z.number().int().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error: permissionError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (permissionError || !admin) throw new Error("Administrator access required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: accounts, error } = await supabaseAdmin.auth.admin.listUsers({ page: data.page, perPage: 50 });
    if (error) throw new Error("Could not load accounts");
    const ids = accounts.users.map((u) => u.id);
    if (!ids.length) return { accounts: [], hasMore: false };
    const [profiles, roles] = await Promise.all([
      context.supabase.from("profiles").select("id,full_name,organization,country,kyc_status").in("id", ids),
      context.supabase.from("user_roles").select("user_id,role").in("user_id", ids),
    ]);
    if (profiles.error || roles.error) throw new Error("Could not load account access");
    return {
      accounts: accounts.users.map((u) => ({
        id: u.id, email: u.email ?? "", confirmed: Boolean(u.email_confirmed_at),
        profile: profiles.data?.find((p) => p.id === u.id) ?? null,
        roles: roles.data?.filter((r) => r.user_id === u.id).map((r) => r.role) ?? [],
      })),
      hasMore: accounts.users.length === 50,
    };
  });

export const changeAccountRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    userId: z.string().uuid(), role: z.enum(["buyer", "rights_holder", "verifier", "admin"]), enabled: z.boolean(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("manage_account_role", { p_user_id: data.userId, p_role: data.role, p_enabled: data.enabled });
    if (error) throw new Error(error.message);
    return { saved: true };
  });