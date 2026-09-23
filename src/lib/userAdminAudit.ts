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
    // MIGRAÇÃO: user_admin_audit não existe mais; auditoria agora vai para logs_auditoria.
    // profiles → profissionais (nome vem de profissionais.nome, ligado por user_id).
    const { data: auth } = await supabase.auth.getUser();
    const actor = auth.user;
    let actorName: string | null = null;
    if (actor) {
      const { data: prof } = await supabase
        .from("profissionais")
        .select("nome")
        .eq("user_id", actor.id)
        .maybeSingle();
      actorName = (prof as { nome?: string } | null)?.nome ?? null;
    }

    // MIGRAÇÃO: campos que não têm coluna própria em logs_auditoria são
    // preservados dentro de dados_novos (JSON) para não perder informação.
    const dadosNovos: Record<string, unknown> = {
      ...(params.newData ?? {}),
      target_email: params.targetEmail ?? null,
      target_name: params.targetName ?? null,
      actor_name: actorName,
      access_profile: params.accessProfile ?? null,
      app_role: params.appRole ?? null,
      departments: params.departments ?? null,
      metadata: { ...(params.metadata ?? {}), source: "client" },
    };

    const { error: erroAuditoria } = await supabase.from("logs_auditoria").insert([{
      tipo_evento: params.action,          // action → tipo_evento (REQUIRED)
      nome_tabela: "profissionais",        // gestão de usuários afeta profissionais (REQUIRED)
      acao: null,                          // enum acao_auditoria restrito: não adivinhar
      registro_id: params.targetUserId ?? null,
      ator_user_id: actor?.id ?? null,
      email_ator: actor?.email ?? null,
      papel_ator: params.appRole ?? null,
      dados_antigos: (params.oldData ?? null) as any,
      dados_novos: dadosNovos as any,
      hospital_id: params.hospitalUnitId ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    }]);
    if (erroAuditoria) {
      console.warn("userAdminAudit: registro NAO gravado (trilha incompleta):", erroAuditoria);
    }
  } catch (e) {
    // Auditoria não deve quebrar fluxo do usuário
    console.warn("userAdminAudit: falha ao registrar", e);
  }
}
