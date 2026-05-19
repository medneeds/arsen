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
          supa.from("patients").select("id", { count: "exact", head: true }).eq("is_vacant", false),
          supa.from("prescriptions").select("id", { count: "exact", head: true }).gte("created_at", since24h),
          supa.from("patient_encounters").select("id", { count: "exact", head: true }).gte("created_at", since24h),
          supa.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", since24h).eq("action", "DELETE"),
          supa.from("profiles").select("id", { count: "exact", head: true }),
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
        const { data, error } = await supa
          .from("audit_logs")
          .select("id, action, table_name, user_email, user_role, created_at, record_id, changed_fields")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return json({ error: error.message }, 500);
        return json({ logs: data ?? [] });
      }

      case "user_activity": {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supa
          .from("audit_logs")
          .select("user_email, action, created_at")
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
            supa.from("patient_encounters").select("created_at").gte("created_at", since),
            supa.from("prescriptions").select("created_at").gte("created_at", since),
            supa.from("clinical_evolutions").select("created_at").gte("created_at", since),
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
        // Recent Postgres errors / warnings via audit_logs as a proxy.
        // (pg_stat_statements isn't exposed; we surface the most-edited tables instead.)
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supa
          .from("audit_logs")
          .select("table_name, action")
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
          supa.from("exam_requests").select("id, patient_name, status, created_at").eq("status", "ERRO").gte("created_at", since).limit(20),
          supa.from("clinical_evolutions").select("id", { count: "exact", head: true }).is("patient_id", null),
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
        const newPassword = String(params.newPassword ?? "").trim();
        if (!targetEmail || newPassword.length < 8) return json({ error: "email and newPassword (min 8) required" }, 400);
        const { data, error } = await supa.rpc("admin_update_user_password", {
          p_email: targetEmail,
          p_new_password: newPassword,
        });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, result: data });
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
          supa.from("patient_movements")
            .select("patient_id, movement_type, created_at")
            .eq("release_status", "pending_release")
            .in("movement_type", SIGNAL_MOVS)
            .order("created_at", { ascending: false }),
          supa.from("discharge_documents")
            .select("patient_id, document_type, created_at")
            .in("document_type", ["alta_hospitalar", "obito"])
            .order("created_at", { ascending: false }),
          supa.from("patients")
            .select("id, name, bed_number, sector, admission_status")
            .in("admission_status", DISCHARGE_STATUSES),
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
        const { data: occupied, error: occErr } = await supa
          .from("patients")
          .select("id, name, bed_number, sector, hospital_unit_id")
          .eq("is_vacant", false)
          .not("bed_number", "is", null)
          .not("sector", "is", null);
        if (occErr) return json({ error: occErr.message }, 500);

        // 2) evoluções não arquivadas com bed/sector preenchidos
        const { data: evos, error: evoErr } = await supa
          .from("clinical_evolutions")
          .select("id, patient_id, patient_name, patient_bed, patient_sector, created_at, evolution_type, status")
          .is("archived_at", null)
          .not("patient_bed", "is", null)
          .not("patient_sector", "is", null)
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
          for (const t of eligible) {
            await supa
              .from("clinical_evolutions")
              .update({
                archived_at: nowIso,
                archived_from_patient_id: t.patient_id ?? null,
                archive_reason: reason,
              })
              .eq("id", t.id as string);
          }
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

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("[dev-console-ops]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
