import { supabase } from "@/integrations/supabase/client";

/** Insere um registro de auditoria de gestão de usuários (best-effort, não bloqueante). */
export async function logUserAdminAction(params: {
  action: string;
  targetUserId?: string | null;
  targetEmail?: string | null;
  targetName?: string | null;
  hospitalUnitId?: string | null;
  accessProfile?: string | null;
  appRole?: string | null;
  departments?: string[] | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const actor = auth.user;
    let actorName: string | null = null;
    if (actor) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", actor.id)
        .maybeSingle();
      actorName = (prof as { full_name?: string } | null)?.full_name ?? null;
    }
    await supabase.from("user_admin_audit").insert([{
      actor_id: actor?.id ?? null,
      actor_email: actor?.email ?? null,
      actor_name: actorName,
      target_user_id: params.targetUserId ?? null,
      target_email: params.targetEmail ?? null,
      target_name: params.targetName ?? null,
      action: params.action,
      hospital_unit_id: params.hospitalUnitId ?? null,
      access_profile: params.accessProfile ?? null,
      app_role: params.appRole ?? null,
      departments: params.departments ?? null,
      old_data: (params.oldData ?? null) as any,
      new_data: (params.newData ?? null) as any,
      metadata: { ...(params.metadata ?? {}), source: "client" } as any,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    }]);
  } catch (e) {
    // Auditoria não deve quebrar fluxo do usuário
    console.warn("userAdminAudit: falha ao registrar", e);
  }
}
