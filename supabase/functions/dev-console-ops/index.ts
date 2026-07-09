// Dev Console — operational endpoints (read metrics, list logs, run safe ops).
// All endpoints require the caller to have role 'dev' or 'admin' in user_roles.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);
    const jwt = authHeader.replace("Bearer ", "");
    const supaAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userErr } = await supaAuth.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    // 2. Check role: must be dev or admin
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roles } = await supa
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const allowed = (roles ?? []).some((r) =>
      ["dev", "admin"].includes(r.role as string),
    );
    if (!allowed) return json({ error: "Forbidden — dev role required" }, 403);

    // Filtro de hospital: dev só vê dados do hospital ao qual está vinculado.
    // Se hospital_unit_id for null (admin global sem hospital), sem filtro — backward compat.
    const { data: devProfile } = await supa
      .from("profiles")
      .select("hospital_unit_id")
      .eq("id", userId)
      .maybeSingle();
    const hospitalFilter: string | null = (devProfile as any)?.hospital_unit_id ?? null;

    // Helper: adiciona filtro de hospital a qualquer query quando aplicável
    const withHospital = <T extends { eq: (...args: any[]) => T }>(q: T): T =>
      hospitalFilter ? q.eq("hospital_unit_id", hospitalFilter) : q;

    // 3. Route by action
    const { action, params = {}, confirm = false } = await req.json();

    switch (action) {
      // ---- READ: metrics ----
      case "system_health": {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const [
          { count: activePatients },
          { count: prescriptions24h },
          { count: admissions24h },
          { count: errors24h },
          { count: usersTotal },
        ] = await Promise.all([
          withHospital(supa.from("patients").select("id", { count: "exact", head: true }).eq("is_vacant", false)),
          withHospital(supa.from("prescriptions").select("id", { count: "exact", head: true }).gte("created_at", since24h)),
          withHospital(supa.from("patient_encounters").select("id", { count: "exact", head: true }).gte("created_at", since24h)),
          withHospital(supa.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", since24h).eq("action", "DELETE")),
          supa.from("profiles").select("id", { count: "exact", head: true }), // gestão de usuários — sem filtro de hospital
        ]);
        return json({
          activePatients: activePatients ?? 0,
          prescriptions24h: prescriptions24h ?? 0,
          admissions24h: admissions24h ?? 0,
          deletes24h: errors24h ?? 0,
          usersTotal: usersTotal ?? 0,
          checkedAt: new Date().toISOString(),
        });
      }

      case "audit_recent": {
        const limit = Math.min(Number(params.limit ?? 50), 200);
        const { data, error } = await withHospital(supa
          .from("audit_logs")
          .select("id, action, table_name, user_email, user_role, created_at, record_id, changed_fields"))
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return json({ error: error.message }, 500);
        return json({ logs: data ?? [] });
      }

      case "user_activity": {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await withHospital(supa
          .from("audit_logs")
          .select("user_email, action, created_at"))
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) return json({ error: error.message }, 500);
        // Aggregate by user
        const byUser: Record<string, number> = {};
        for (const r of data ?? []) {
          if (!r.user_email) continue;
          byUser[r.user_email] = (byUser[r.user_email] ?? 0) + 1;
        }
        const top = Object.entries(byUser)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([email, count]) => ({ email, count }));
        return json({ topUsers: top, totalEvents: (data ?? []).length });
      }

      case "clinical_volume": {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const [{ data: encounters }, { data: prescriptions }, { data: evolutions }] =
          await Promise.all([
            withHospital(supa.from("patient_encounters").select("created_at")).gte("created_at", since),
            withHospital(supa.from("prescriptions").select("created_at")).gte("created_at", since),
            withHospital(supa.from("clinical_evolutions").select("created_at")).gte("created_at", since),
          ]);
        const buckets: Record<string, { encounters: number; prescriptions: number; evolutions: number }> = {};
        const day = (d: string) => d.substring(0, 10);
        for (let i = 0; i < 7; i++) {
          const k = new Date(Date.now() - i * 86400000).toISOString().substring(0, 10);
          buckets[k] = { encounters: 0, prescriptions: 0, evolutions: 0 };
        }
        (encounters ?? []).forEach((r) => buckets[day(r.created_at)] && (buckets[day(r.created_at)].encounters++));
        (prescriptions ?? []).forEach((r) => buckets[day(r.created_at)] && (buckets[day(r.created_at)].prescriptions++));
        (evolutions ?? []).forEach((r) => buckets[day(r.created_at)] && (buckets[day(r.created_at)].evolutions++));
        const series = Object.entries(buckets)
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([date, v]) => ({ date, ...v }));
        return json({ series });
      }

      case "list_users": {
        const { data, error } = await supa
          .from("profiles")
          .select("id, email, full_name, created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return json({ error: error.message }, 500);
        // Pull roles too
        const { data: rolesData } = await supa.from("user_roles").select("user_id, role");
        const rolesByUser: Record<string, string[]> = {};
        (rolesData ?? []).forEach((r) => {
          rolesByUser[r.user_id] = rolesByUser[r.user_id] ?? [];
          rolesByUser[r.user_id].push(r.role as string);
        });
        const users = (data ?? []).map((u) => ({ ...u, roles: rolesByUser[u.id] ?? [] }));
        return json({ users });
      }

      case "db_table_sizes": {
        // Query metadata only — counts of rows per business table.
        const tables = [
          "patients", "patient_registry", "patient_encounters",
          "prescriptions", "clinical_evolutions", "exam_requests",
          "culture_results", "audit_logs", "patient_movements",
        ];
        const results: Record<string, number> = {};
        await Promise.all(
          tables.map(async (t) => {
            const { count } = await supa.from(t).select("id", { count: "exact", head: true });
            results[t] = count ?? 0;
          }),
        );
        return json({ tables: results });
      }

      case "slow_queries": {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data } = await withHospital(supa
          .from("audit_logs")
          .select("table_name, action"))
          .gte("created_at", since)
          .limit(2000);
        const byTable: Record<string, { inserts: number; updates: number; deletes: number; total: number }> = {};
        for (const r of data ?? []) {
          const t = r.table_name as string;
          byTable[t] = byTable[t] ?? { inserts: 0, updates: 0, deletes: 0, total: 0 };
          byTable[t].total++;
          if (r.action === "INSERT") byTable[t].inserts++;
          else if (r.action === "UPDATE") byTable[t].updates++;
          else if (r.action === "DELETE") byTable[t].deletes++;
        }
        const top = Object.entries(byTable)
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 15)
          .map(([table, v]) => ({ table, ...v }));
        return json({ topMutatingTables: top });
      }

      case "edge_function_errors": {
        // Surfaces errors from audit_logs (action = DELETE outside business hours, etc.)
        // Real edge function logs require the analytics API — we list recent failed dispensations
        // and exam requests as a proxy operational signal.
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const [{ data: failedExams }, { count: orphanEvolutions }] = await Promise.all([
          withHospital(supa.from("exam_requests").select("id, patient_name, status, created_at").eq("status", "ERRO")).gte("created_at", since).limit(20),
          withHospital(supa.from("clinical_evolutions").select("id", { count: "exact", head: true }).is("patient_id", null)),
        ]);
        return json({
          failedExams: failedExams ?? [],
          orphanEvolutions: orphanEvolutions ?? 0,
        });
      }


      // ---- SENSITIVE: require confirm: true ----
      case "grant_dev_role": {
        if (!confirm) return json({ error: "Confirmation required", needsConfirm: true }, 400);
        const targetEmail = String(params.email ?? "").trim();
        if (!targetEmail) return json({ error: "email required" }, 400);
        const { data: target } = await supa.rpc("get_auth_user_id_by_email", { p_email: targetEmail });
        if (!target) return json({ error: "User not found" }, 404);
        const { error } = await supa.from("user_roles").insert({ user_id: target, role: "dev" });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, message: `Role 'dev' concedida a ${targetEmail}` });
      }

      case "revoke_dev_role": {
        if (!confirm) return json({ error: "Confirmation required", needsConfirm: true }, 400);
        const targetEmail = String(params.email ?? "").trim();
        if (!targetEmail) return json({ error: "email required" }, 400);
        const { data: target } = await supa.rpc("get_auth_user_id_by_email", { p_email: targetEmail });
        if (!target) return json({ error: "User not found" }, 404);
        const { error } = await supa.from("user_roles").delete().eq("user_id", target).eq("role", "dev");
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, message: `Role 'dev' revogada de ${targetEmail}` });
      }

      case "force_password_reset": {
        if (!confirm) return json({ error: "Confirmation required", needsConfirm: true }, 400);
        const targetEmail = String(params.email ?? "").trim();
        if (!targetEmail) return json({ error: "email required" }, 400);
        // Gera um link de reset em vez de receber a senha em texto claro no body.
        // O link é de uso único e expira automaticamente — a nova senha é definida
        // pelo próprio usuário ao clicar, nunca trafega pela API.
        const { data: linkData, error: linkErr } = await supa.auth.admin.generateLink({
          type: "recovery",
          email: targetEmail,
        });
        if (linkErr) return json({ error: linkErr.message }, 500);
        try {
          await supa.from("audit_logs").insert({
            action: "DEV_FORCE_PASSWORD_RESET",
            table_name: "auth.users",
            user_email: userData.user.email ?? null,
            user_role: "dev",
            record_id: targetEmail,
            changed_fields: ["recovery_link_generated"],
            new_values: { targetEmail },
          });
        } catch (e) {
          console.warn("[force_password_reset] audit insert falhou", e);
        }
        return json({
          ok: true,
          recoveryLink: linkData?.properties?.action_link ?? null,
          message: `Link de recuperação gerado para ${targetEmail}. Validade: único uso.`,
        });
      }

      // ---- READ: lista pacientes com sinalização de saída ativa ----
      case "list_patients_with_signaling": {
        const DISCHARGE_STATUSES = [
          "alta_dada", "obito", "transferido",
          "transferencia_interna_pendente", "transferencia_externa_pendente",
        ];
        const SIGNAL_MOVS = [
          "ALTA_HOSPITALAR", "OBITO", "TRANSFERENCIA_INTERNA", "TRANSFERENCIA_EXTERNA",
          "LIBERAÇÃO PÓS-ALTA/ÓBITO", "LIBERAÇÃO PRÉ-ADMISSÃO",
        ];

        const [{ data: movs }, { data: docs }, { data: byStatus }] = await Promise.all([
          withHospital(supa.from("patient_movements")
            .select("patient_id, movement_type, created_at")
            .eq("release_status", "pending_release")
            .in("movement_type", SIGNAL_MOVS))
            .order("created_at", { ascending: false }),
          withHospital(supa.from("discharge_documents")
            .select("patient_id, document_type, created_at")
            .in("document_type", ["alta_hospitalar", "obito"]))
            .order("created_at", { ascending: false }),
          withHospital(supa.from("patients")
            .select("id, name, bed_number, sector, admission_status")
            .in("admission_status", DISCHARGE_STATUSES)),
        ]);

        const agg: Record<string, {
          movementsCount: number;
          documentsCount: number;
          lastMovementType?: string;
          lastSignalAt?: string;
        }> = {};

        for (const m of movs ?? []) {
          const pid = m.patient_id as string;
          agg[pid] = agg[pid] ?? { movementsCount: 0, documentsCount: 0 };
          agg[pid].movementsCount++;
          if (!agg[pid].lastSignalAt || (m.created_at as string) > agg[pid].lastSignalAt!) {
            agg[pid].lastSignalAt = m.created_at as string;
            agg[pid].lastMovementType = m.movement_type as string;
          }
        }
        for (const d of docs ?? []) {
          const pid = d.patient_id as string;
          agg[pid] = agg[pid] ?? { movementsCount: 0, documentsCount: 0 };
          agg[pid].documentsCount++;
          if (!agg[pid].lastSignalAt || (d.created_at as string) > agg[pid].lastSignalAt!) {
            agg[pid].lastSignalAt = d.created_at as string;
            agg[pid].lastMovementType = (d.document_type as string).toUpperCase();
          }
        }
        for (const p of byStatus ?? []) {
          agg[p.id as string] = agg[p.id as string] ?? { movementsCount: 0, documentsCount: 0 };
        }

        const ids = Object.keys(agg);
        if (ids.length === 0) return json({ patients: [] });

        const { data: pats } = await supa
          .from("patients")
          .select("id, name, bed_number, sector, admission_status, updated_at")
          .in("id", ids);

        const patients = (pats ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          bed_number: p.bed_number,
          sector: p.sector,
          admission_status: p.admission_status,
          movementsCount: agg[p.id as string]?.movementsCount ?? 0,
          documentsCount: agg[p.id as string]?.documentsCount ?? 0,
          lastMovementType: agg[p.id as string]?.lastMovementType ?? null,
          lastSignalAt: agg[p.id as string]?.lastSignalAt ?? null,
          updated_at: p.updated_at,
        })).sort((a, b) =>
          (b.lastSignalAt ?? "").localeCompare(a.lastSignalAt ?? "")
        );

        return json({ patients });
      }

      // ---- SENSITIVE: limpa sinalizações de saída (movimentações + documentos) ----
      case "clear_patient_signaling": {
        const DISCHARGE_STATUSES = [
          "alta_dada", "obito", "transferido",
          "transferencia_interna_pendente", "transferencia_externa_pendente",
        ];
        const SIGNAL_MOVS = [
          "ALTA_HOSPITALAR", "OBITO", "TRANSFERENCIA_INTERNA", "TRANSFERENCIA_EXTERNA",
          "LIBERAÇÃO PÓS-ALTA/ÓBITO", "LIBERAÇÃO PRÉ-ADMISSÃO",
        ];

        const dryRun = Boolean(params.dryRun);
        const ids: string[] = Array.isArray(params.patientIds)
          ? (params.patientIds as string[])
          : params.patientId ? [String(params.patientId)] : [];

        if (ids.length === 0) return json({ error: "patientId ou patientIds requerido" }, 400);
        if (!dryRun && !confirm) return json({ error: "Confirmation required", needsConfirm: true }, 400);

        const { data: pats, error: patErr } = await supa
          .from("patients")
          .select("id, name, bed_number, sector, admission_status")
          .in("id", ids);
        if (patErr) return json({ error: patErr.message }, 500);

        const results: Array<{
          patientId: string; name: string; bed: string | null; sector: string | null;
          previousStatus: string | null;
          movementsToDelete: number; documentsToDelete: number;
          statusReset: boolean;
          executed: boolean;
        }> = [];

        let totalMovs = 0;
        let totalDocs = 0;

        for (const p of pats ?? []) {
          const pid = p.id as string;
          const { data: pendingMovs } = await supa
            .from("patient_movements")
            .select("id")
            .eq("patient_id", pid)
            .eq("release_status", "pending_release")
            .in("movement_type", SIGNAL_MOVS);
          const { data: pendingDocs } = await supa
            .from("discharge_documents")
            .select("id")
            .eq("patient_id", pid)
            .in("document_type", ["alta_hospitalar", "obito"]);

          const movsN = (pendingMovs ?? []).length;
          const docsN = (pendingDocs ?? []).length;
          const willReset = DISCHARGE_STATUSES.includes(p.admission_status as string);

          if (!dryRun) {
            if (movsN > 0) {
              await supa.from("patient_movements")
                .delete()
                .eq("patient_id", pid)
                .eq("release_status", "pending_release")
                .in("movement_type", SIGNAL_MOVS);
            }
            if (docsN > 0) {
              await supa.from("discharge_documents")
                .delete()
                .eq("patient_id", pid)
                .in("document_type", ["alta_hospitalar", "obito"]);
            }
            if (willReset) {
              await supa.from("patients")
                .update({ admission_status: "admitido", updated_at: new Date().toISOString() })
                .eq("id", pid);
            }
          }

          totalMovs += movsN;
          totalDocs += docsN;
          results.push({
            patientId: pid,
            name: p.name as string,
            bed: (p.bed_number as string) ?? null,
            sector: (p.sector as string) ?? null,
            previousStatus: (p.admission_status as string) ?? null,
            movementsToDelete: movsN,
            documentsToDelete: docsN,
            statusReset: willReset,
            executed: !dryRun,
          });
        }

        if (!dryRun) {
          try {
            await supa.from("audit_logs").insert({
              action: "DEV_CLEAR_SIGNALING",
              table_name: "patient_movements",
              user_email: userData.user.email ?? null,
              user_role: "dev",
              record_id: ids.join(","),
              changed_fields: ["pending_movements_deleted", "discharge_documents_deleted", "admission_status_reset"],
              new_values: { results, totals: { movementsDeleted: totalMovs, documentsDeleted: totalDocs, patientsAffected: results.length } },
            });
          } catch (e) {
            console.warn("[clear_patient_signaling] audit insert failed", e);
          }
        }

        return json({
          ok: true,
          dryRun,
          results,
          totals: {
            movementsDeleted: totalMovs,
            documentsDeleted: totalDocs,
            patientsAffected: results.length,
          },
        });
      }

      // ---- READ: lista evoluções residuais por leito ----
      // Detecta clinical_evolutions cujo (patient_bed, patient_sector) bate com um
      // leito ATUALMENTE ocupado por outro paciente (ou paciente NULL).
      // Não toca prescrições/admissões/movs — escopo cirúrgico em evoluções.
      case "list_bed_residual_history": {
        // 1) leitos atualmente ocupados
        const { data: occupied, error: occErr } = await withHospital(supa
          .from("patients")
          .select("id, name, bed_number, sector, hospital_unit_id")
          .eq("is_vacant", false)
          .not("bed_number", "is", null)
          .not("sector", "is", null));
        if (occErr) return json({ error: occErr.message }, 500);

        // 2) evoluções não arquivadas com bed/sector preenchidos
        const { data: evos, error: evoErr } = await withHospital(supa
          .from("clinical_evolutions")
          .select("id, patient_id, patient_name, patient_bed, patient_sector, created_at, evolution_type, status")
          .is("archived_at", null)
          .not("patient_bed", "is", null)
          .not("patient_sector", "is", null))
          .order("created_at", { ascending: false })
          .limit(5000);
        if (evoErr) return json({ error: evoErr.message }, 500);

        // 3) índice por (sector|bed) → paciente atual
        const key = (s: string | null, b: string | null) => `${(s ?? "").toLowerCase()}|${b ?? ""}`;
        const currentByBed = new Map<string, { id: string; name: string }>();
        for (const p of occupied ?? []) {
          currentByBed.set(key(p.sector as string, p.bed_number as string), {
            id: p.id as string,
            name: p.name as string,
          });
        }

        // 4) agrupar evoluções contaminadas por leito
        type ResidualBed = {
          sector: string; bed: string;
          currentPatientId: string | null; currentPatientName: string | null;
          contaminatedCount: number;
          originPatients: { name: string; patient_id: string | null; count: number }[];
          evolutionIds: string[];
        };
        const byBed = new Map<string, ResidualBed>();
        for (const e of evos ?? []) {
          const k = key(e.patient_sector as string, e.patient_bed as string);
          const current = currentByBed.get(k);
          if (!current) continue; // leito vazio agora — fora de escopo
          const evPid = (e.patient_id as string | null) ?? null;
          if (evPid === current.id) continue; // evolução pertence ao ocupante atual — OK
          let bucket = byBed.get(k);
          if (!bucket) {
            bucket = {
              sector: e.patient_sector as string,
              bed: e.patient_bed as string,
              currentPatientId: current.id,
              currentPatientName: current.name,
              contaminatedCount: 0,
              originPatients: [],
              evolutionIds: [],
            };
            byBed.set(k, bucket);
          }
          bucket.contaminatedCount++;
          bucket.evolutionIds.push(e.id as string);
          const originName = (e.patient_name as string) ?? "—";
          const origin = bucket.originPatients.find(
            (o) => o.name === originName && o.patient_id === evPid,
          );
          if (origin) origin.count++;
          else bucket.originPatients.push({ name: originName, patient_id: evPid, count: 1 });
        }

        const beds = Array.from(byBed.values()).sort(
          (a, b) => b.contaminatedCount - a.contaminatedCount,
        );
        return json({ beds, totalEvolutions: beds.reduce((s, b) => s + b.contaminatedCount, 0) });
      }

      // ---- SENSITIVE: arquiva evoluções residuais de um leito ----
      case "archive_bed_residual_history": {
        const dryRun = Boolean(params.dryRun);
        const evolutionIds: string[] = Array.isArray(params.evolutionIds)
          ? (params.evolutionIds as string[])
          : [];
        if (evolutionIds.length === 0) return json({ error: "evolutionIds requerido" }, 400);
        if (!dryRun && !confirm) return json({ error: "Confirmation required", needsConfirm: true }, 400);

        const { data: targets, error: tErr } = await supa
          .from("clinical_evolutions")
          .select("id, patient_id, patient_name, patient_bed, patient_sector, created_at, archived_at")
          .in("id", evolutionIds);
        if (tErr) return json({ error: tErr.message }, 500);

        const eligible = (targets ?? []).filter((t) => !t.archived_at);

        const results = eligible.map((t) => ({
          id: t.id as string,
          patient_name: t.patient_name as string,
          patient_bed: t.patient_bed as string,
          patient_sector: t.patient_sector as string,
          created_at: t.created_at as string,
          executed: !dryRun,
        }));

        if (!dryRun && eligible.length > 0) {
          const reason = String(params.reason ?? "dev_console_residual_cleanup");
          const nowIso = new Date().toISOString();
          // Executa todas as atualizações em paralelo em vez de sequencialmente,
          // reduzindo de N round-trips seriais para 1 batch de latência.
          // archived_from_patient_id varia por linha, por isso não é possível um único
          // UPDATE ... IN (...) — Promise.all paraleliza sem perder o valor por linha.
          await Promise.all(
            eligible.map((t) =>
              supa
                .from("clinical_evolutions")
                .update({
                  archived_at: nowIso,
                  archived_from_patient_id: t.patient_id ?? null,
                  archive_reason: reason,
                })
                .eq("id", t.id as string),
            ),
          );
          try {
            await supa.from("audit_logs").insert({
              action: "DEV_ARCHIVE_RESIDUAL_HISTORY",
              table_name: "clinical_evolutions",
              user_email: userData.user.email ?? null,
              user_role: "dev",
              record_id: eligible.map((t) => t.id).join(","),
              changed_fields: ["archived_at", "archived_from_patient_id", "archive_reason"],
              new_values: { results, reason, count: eligible.length },
            });
          } catch (e) {
            console.warn("[archive_bed_residual_history] audit insert failed", e);
          }
        }

        return json({
          ok: true,
          dryRun,
          results,
          totals: { evolutionsArchived: eligible.length, skipped: (targets ?? []).length - eligible.length },
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // PATIENT OPS — inspeção + correção de transferências travadas
      // Escopo cirúrgico: só toca camadas movimentação/leito/transfer_request.
      // NÃO toca prescriptions/evolutions/medical_records/exam_requests.
      // ═══════════════════════════════════════════════════════════════

      case "list_patients_for_dev": {
        const q = String(params.query ?? "").trim();
        const limit = Math.min(Number(params.limit ?? 30), 100);
        let query = withHospital(supa
          .from("patients")
          .select("id, name, bed_number, sector, admission_status, is_vacant, updated_at, medical_record, patient_registry_id"))
          .order("updated_at", { ascending: false })
          .limit(limit);

        if (q) {
          query = query.or(
            `name.ilike.%${q}%,bed_number.ilike.%${q}%,sector.ilike.%${q}%,medical_record.ilike.%${q}%`
          );
        } else {
          query = query.eq("is_vacant", false);
        }
        const { data, error } = await query;
        if (error) return json({ error: error.message }, 500);

        const ids = (data ?? []).map((p) => p.id as string);
        const pendingBySource: Record<string, boolean> = {};
        if (ids.length > 0) {
          const { data: pending } = await supa
            .from("internal_transfer_requests")
            .select("source_patient_id")
            .in("source_patient_id", ids)
            .eq("status", "pending");
          for (const r of pending ?? []) pendingBySource[r.source_patient_id as string] = true;
        }

        return json({
          patients: (data ?? []).map((p) => ({
            ...p,
            hasPendingTransfer: !!pendingBySource[p.id as string],
          })),
        });
      }

      case "inspect_patient": {
        const pid = String(params.patientId ?? "");
        if (!pid) return json({ error: "patientId requerido" }, 400);

        const [{ data: patient }, { data: encounters }, { data: transfers }, { data: movs }, { data: docs }] =
          await Promise.all([
            supa.from("patients").select("*").eq("id", pid).maybeSingle(),
            supa.from("patient_encounters")
              .select("id, encounter_code, started_at, ended_at, admission_sector, discharge_type")
              .eq("patient_id", pid)
              .order("started_at", { ascending: false })
              .limit(5),
            supa.from("internal_transfer_requests")
              .select("*")
              .eq("source_patient_id", pid)
              .order("signaled_at", { ascending: false })
              .limit(5),
            supa.from("patient_movements")
              .select("id, movement_type, destination, patient_sector, patient_bed, release_status, released_at, created_at, notes")
              .eq("patient_id", pid)
              .order("created_at", { ascending: false })
              .limit(10),
            supa.from("discharge_documents")
              .select("id, document_type, created_at, suspended_at")
              .eq("patient_id", pid)
              .order("created_at", { ascending: false })
              .limit(10),
          ]);

        return json({
          patient,
          encounters: encounters ?? [],
          transfers: transfers ?? [],
          movements: movs ?? [],
          documents: docs ?? [],
        });
      }

      case "fix_transfer_cancel_pending": {
        const requestId = String(params.requestId ?? "");
        const dryRun = Boolean(params.dryRun);
        if (!requestId) return json({ error: "requestId requerido" }, 400);
        if (!dryRun && !confirm) return json({ error: "Confirmation required", needsConfirm: true }, 400);

        const { data: req, error: rErr } = await supa
          .from("internal_transfer_requests")
          .select("*")
          .eq("id", requestId)
          .maybeSingle();
        if (rErr) return json({ error: rErr.message }, 500);
        if (!req) return json({ error: "Request não encontrado" }, 404);
        if (req.status !== "pending") return json({ error: `Request já está com status ${req.status}` }, 400);

        const snapshot: any = req.patient_snapshot ?? {};
        const sourceId = req.source_patient_id as string;

        const { data: sourcePatient } = await supa
          .from("patients")
          .select("id, is_vacant, name")
          .eq("id", sourceId)
          .maybeSingle();

        const canRestore = sourcePatient?.is_vacant === true;
        const plan = {
          requestId,
          sourcePatientId: sourceId,
          sourceBed: req.source_bed,
          sourceSector: req.source_sector,
          targetSector: req.target_sector_label ?? req.target_sector_code,
          patientName: req.patient_name,
          willRestore: canRestore,
          willCancelOnly: !canRestore,
          currentSourceBedOccupied: sourcePatient && !sourcePatient.is_vacant,
        };
        if (dryRun) return json({ ok: true, dryRun: true, plan });

        const nowIso = new Date().toISOString();
        const { error: cancelErr } = await supa
          .from("internal_transfer_requests")
          .update({ status: "cancelled", cancelled_at: nowIso } as any)
          .eq("id", requestId);
        if (cancelErr) return json({ error: `Falha ao cancelar request: ${cancelErr.message}` }, 500);

        if (canRestore) {
          const restorePayload: any = {
            name: snapshot.name ?? req.patient_name,
            age: snapshot.age ?? null,
            diagnoses: snapshot.diagnoses ?? null,
            medical_history: snapshot.medicalHistory ?? snapshot.medical_history ?? null,
            relevant_exams: snapshot.relevantExams ?? snapshot.relevant_exams ?? null,
            pendencies: snapshot.pendencies ?? null,
            schedule: snapshot.schedule ?? null,
            admission_history: snapshot._admissionHistory ?? snapshot.admissionHistory ?? null,
            admission_date: snapshot.admissionDate ?? snapshot.admission_date ?? null,
            admitted_at: snapshot._admittedAt ?? null,
            clinical_status: snapshot.clinicalStatus ?? snapshot.clinical_status ?? null,
            admission_status: "admitido",
            patient_registry_id: snapshot._registryId ?? snapshot.registryId ?? null,
            medical_record: snapshot._medicalRecord ?? snapshot.medicalRecord ?? null,
            is_vacant: false,
            updated_at: nowIso,
          };
          const { error: restoreErr } = await supa
            .from("patients")
            .update(restorePayload)
            .eq("id", sourceId);
          if (restoreErr) return json({ error: `Cancelado, mas falhou restauração: ${restoreErr.message}` }, 500);
        }

        try {
          await supa.from("audit_logs").insert({
            action: "DEV_FIX_TRANSFER",
            table_name: "internal_transfer_requests",
            user_email: userData.user.email ?? null,
            user_role: "dev",
            record_id: requestId,
            changed_fields: canRestore ? ["status", "source_bed_restored"] : ["status"],
            new_values: { step: "cancel_pending_transfer", plan },
          });
        } catch (e) { console.warn("[fix_transfer_cancel_pending] audit failed", e); }

        return json({ ok: true, executed: true, restored: canRestore, plan });
      }

      case "fix_transfer_reopen_encounter": {
        const encounterId = String(params.encounterId ?? "");
        const dryRun = Boolean(params.dryRun);
        if (!encounterId) return json({ error: "encounterId requerido" }, 400);
        if (!dryRun && !confirm) return json({ error: "Confirmation required", needsConfirm: true }, 400);

        const { data: enc } = await supa
          .from("patient_encounters")
          .select("id, patient_id, encounter_code, started_at, ended_at, discharge_type")
          .eq("id", encounterId)
          .maybeSingle();
        if (!enc) return json({ error: "Encounter não encontrado" }, 404);
        if (!enc.ended_at) return json({ error: "Encounter já está aberto" }, 400);

        const endedAt = new Date(enc.ended_at as string).getTime();
        const ageHours = (Date.now() - endedAt) / 3_600_000;
        if (ageHours > 24) return json({ error: `Encounter encerrado há ${ageHours.toFixed(1)}h — limite 24h para reabertura via Dev Console` }, 400);

        const plan = {
          encounterId, encounterCode: enc.encounter_code,
          patientId: enc.patient_id, endedAt: enc.ended_at,
          ageHours: Number(ageHours.toFixed(2)),
        };
        if (dryRun) return json({ ok: true, dryRun: true, plan });

        const { error: updErr } = await supa
          .from("patient_encounters")
          .update({ ended_at: null, discharge_type: null } as any)
          .eq("id", encounterId);
        if (updErr) return json({ error: updErr.message }, 500);

        try {
          await supa.from("audit_logs").insert({
            action: "DEV_FIX_TRANSFER",
            table_name: "patient_encounters",
            user_email: userData.user.email ?? null,
            user_role: "dev",
            record_id: encounterId,
            changed_fields: ["ended_at", "discharge_type"],
            new_values: { step: "reopen_encounter", plan },
          });
        } catch (e) { console.warn("[fix_transfer_reopen_encounter] audit failed", e); }

        return json({ ok: true, executed: true, plan });
      }

      case "fix_transfer_release_orphan_bed": {
        const patientId = String(params.patientId ?? "");
        const dryRun = Boolean(params.dryRun);
        if (!patientId) return json({ error: "patientId requerido" }, 400);
        if (!dryRun && !confirm) return json({ error: "Confirmation required", needsConfirm: true }, 400);

        const { data: p } = await supa
          .from("patients")
          .select("id, name, bed_number, sector, admission_status, is_vacant")
          .eq("id", patientId)
          .maybeSingle();
        if (!p) return json({ error: "Paciente não encontrado" }, 404);

        const plan = {
          patientId, name: p.name, bed: p.bed_number, sector: p.sector,
          currentStatus: p.admission_status, isVacant: p.is_vacant,
        };
        if (dryRun) return json({ ok: true, dryRun: true, plan });

        try {
          await supa.rpc("archive_patient_bed_data", { p_patient_id: patientId } as any);
        } catch (e) {
          console.warn("[fix_transfer_release_orphan_bed] archive_patient_bed_data falhou (não bloqueante)", e);
        }

        const { error: clearErr } = await supa
          .from("patients")
          .update({
            name: "", age: null, diagnoses: null, medical_history: null,
            relevant_exams: null, pendencies: null, schedule: null,
            admission_history: null, admission_date: null,
            highlighted_diagnoses: null, highlighted_medical_history: null,
            highlighted_pendencies: null, highlighted_conducts: null,
            uti_admission_date: null, uti_discharge_prediction: null,
            uti_allergies: null, uti_admission_reason: null,
            uti_current_status: null, uti_devices: null,
            uti_cultures_antibiotics: null, uti_specialties: null,
            uti_origin_sector: null, uti_daily_conducts: null,
            clinical_status: null, psm_status: null,
            admission_status: null, patient_registry_id: null,
            medical_record: null, is_vacant: true,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", patientId);
        if (clearErr) return json({ error: clearErr.message }, 500);

        try {
          await supa.from("audit_logs").insert({
            action: "DEV_FIX_TRANSFER",
            table_name: "patients",
            user_email: userData.user.email ?? null,
            user_role: "dev",
            record_id: patientId,
            changed_fields: ["bed_cleared", "archived"],
            new_values: { step: "release_orphan_bed", plan },
          });
        } catch (e) { console.warn("[fix_transfer_release_orphan_bed] audit failed", e); }

        return json({ ok: true, executed: true, plan });
      }

      case "list_vacant_beds": {
        const q = String(params.query ?? "").trim();
        const limit = Math.min(Number(params.limit ?? 60), 200);
        let query = withHospital(supa
          .from("patients")
          .select("id, bed_number, sector, is_vacant, updated_at"))
          .eq("is_vacant", true)
          .order("sector", { ascending: true })
          .order("bed_number", { ascending: true })
          .limit(limit);
        if (q) {
          query = query.or(`bed_number.ilike.%${q}%,sector.ilike.%${q}%`);
        }
        const { data, error } = await query;
        if (error) return json({ error: error.message }, 500);
        return json({ beds: data ?? [] });
      }

      case "fix_place_patient_in_bed": {
        const sourcePatientId = String(params.sourcePatientId ?? "");
        const targetPatientId = String(params.targetPatientId ?? "");
        const reason = String(params.reason ?? "").trim();
        const dryRun = Boolean(params.dryRun);
        if (!sourcePatientId || !targetPatientId) return json({ error: "sourcePatientId e targetPatientId requeridos" }, 400);
        if (sourcePatientId === targetPatientId) return json({ error: "Origem e destino iguais" }, 400);
        if (!dryRun && !confirm) return json({ error: "Confirmation required", needsConfirm: true }, 400);
        if (!dryRun && reason.length < 10) return json({ error: "Motivo requerido (mínimo 10 caracteres)" }, 400);

        const { data: src } = await supa
          .from("patients")
          .select("id, name, bed_number, sector, is_vacant, admission_status, medical_record")
          .eq("id", sourcePatientId)
          .maybeSingle();
        const { data: tgt } = await supa
          .from("patients")
          .select("id, name, bed_number, sector, is_vacant")
          .eq("id", targetPatientId)
          .maybeSingle();
        if (!src) return json({ error: "Paciente de origem não encontrado" }, 404);
        if (!tgt) return json({ error: "Leito de destino não encontrado" }, 404);
        if (!tgt.is_vacant) return json({ error: `Leito destino ${tgt.bed_number ?? ""} ${tgt.sector ?? ""} não está vago` }, 400);
        if (!src.name) return json({ error: "Paciente de origem sem dados (linha vazia)" }, 400);

        const plan = {
          source: { id: src.id, name: src.name, bed: src.bed_number, sector: src.sector, status: src.admission_status },
          target: { id: tgt.id, bed: tgt.bed_number, sector: tgt.sector },
          note: "Copia dados clínicos da origem para o leito destino, repoint do histórico (evoluções/prescrições/exames), arquiva e limpa a origem.",
        };
        if (dryRun) return json({ ok: true, dryRun: true, plan });

        const { data: rpcData, error: rpcErr } = await (supa as any).rpc(
          "execute_operational_relocation_atomic",
          {
            p_source_patient_id: sourcePatientId,
            p_target_patient_id: targetPatientId,
            p_reason: `[DEV_FIX_TRANSFER] ${reason}`,
            p_hospital_unit_id: null,
            p_state_id: null,
            p_department: null,
            p_created_by: userData.user.id,
          },
        );
        if (rpcErr) return json({ error: `Falha no reposicionamento: ${rpcErr.message}` }, 500);

        try {
          await supa.from("audit_logs").insert({
            action: "DEV_FIX_TRANSFER",
            table_name: "patients",
            user_email: userData.user.email ?? null,
            user_role: "dev",
            record_id: targetPatientId,
            changed_fields: ["bed_placed"],
            new_values: { step: "place_patient_in_bed", plan, reason, movement_id: (rpcData as any)?.movement_id ?? null },
          });
        } catch (e) { console.warn("[fix_place_patient_in_bed] audit failed", e); }

        return json({ ok: true, executed: true, plan, movementId: (rpcData as any)?.movement_id ?? null });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("[dev-console-ops]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
