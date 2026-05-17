import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, GitMerge, Search, AlertTriangle, ShieldCheck } from "lucide-react";
import { MovementConfirmDialog } from "@/components/MovementConfirmDialog";

interface RegistryRow {
  id: string;
  full_name: string | null;
  social_name: string | null;
  birth_date: string | null;
  sex: string | null;
  mother_name: string | null;
  cpf: string | null;
  cns: string | null;
  phone: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  medical_record: string | null;
  is_unidentified: boolean;
  merged_into_registry_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MedicalRecordRow {
  id: string;
  numero_prontuario: string | null;
  is_primary: boolean | null;
  created_at: string;
  patient_registry_id: string;
}

interface CountsRow {
  patients: number;
  evolutions: number;
  prescriptions: number;
  exams: number;
  encounters: number;
  active_bed: string | null;
}

const COMPARABLE_FIELDS: { key: keyof RegistryRow; label: string }[] = [
  { key: "full_name", label: "Nome completo" },
  { key: "social_name", label: "Nome social" },
  { key: "birth_date", label: "Data de nascimento" },
  { key: "sex", label: "Sexo" },
  { key: "mother_name", label: "Nome da mãe" },
  { key: "cpf", label: "CPF" },
  { key: "cns", label: "CNS" },
  { key: "phone", label: "Telefone" },
  { key: "address", label: "Endereço" },
  { key: "neighborhood", label: "Bairro" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "UF" },
];

type Choice = "winner" | "loser" | "empty";

function fmtVal(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

async function fetchCounts(registryId: string): Promise<CountsRow> {
  const [pats, evos, prescs, exams, encs] = await Promise.all([
    supabase.from("patients").select("id, bed_number, sector", { count: "exact" }).eq("patient_registry_id", registryId),
    supabase.from("clinical_evolutions").select("id", { count: "exact", head: true }).eq("patient_registry_id", registryId),
    supabase.from("prescriptions").select("id", { count: "exact", head: true }).filter("patient_data->>id", "in", `(${(await supabase.from("patients").select("id").eq("patient_registry_id", registryId)).data?.map((p: any) => `"${p.id}"`).join(",") || '""'})`),
    supabase.from("exam_requests").select("id", { count: "exact", head: true }).eq("patient_registry_id", registryId),
    supabase.from("patient_encounters").select("id", { count: "exact", head: true }).eq("registry_id", registryId),
  ]);
  const activeBed = (pats.data || []).find((p: any) => p.bed_number)?.bed_number || null;
  return {
    patients: pats.count || 0,
    evolutions: evos.count || 0,
    prescriptions: prescs.count || 0,
    exams: exams.count || 0,
    encounters: encs.count || 0,
    active_bed: activeBed,
  };
}

export default function MergeRegistriesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Authorization gate
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  useEffect(() => {
    (async () => {
      if (!user) { setAuthorized(false); return; }
      const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      const { data: prof } = await supabase.from("profiles").select("access_profile").eq("id", user.id).maybeSingle();
      const role = (roleRow as any)?.role;
      const ap = (prof as any)?.access_profile;
      setAuthorized(role === "admin" || ["gestor", "recepcao", "recepcionista", "administrativo"].includes(ap || ""));
    })();
  }, [user]);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<RegistryRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [pair, setPair] = useState<{ a: RegistryRow; b: RegistryRow } | null>(null);
  const [aCounts, setACounts] = useState<CountsRow | null>(null);
  const [bCounts, setBCounts] = useState<CountsRow | null>(null);
  const [aRecords, setARecords] = useState<MedicalRecordRow[]>([]);
  const [bRecords, setBRecords] = useState<MedicalRecordRow[]>([]);

  const [winner, setWinner] = useState<"a" | "b" | null>(null);
  const [predominantMrId, setPredominantMrId] = useState<string | null>(null);
  const [fieldChoices, setFieldChoices] = useState<Record<string, Choice>>({});
  const [reason, setReason] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [executing, setExecuting] = useState(false);

  const doSearch = async () => {
    setSearching(true);
    try {
      const q = search.trim();
      const digits = q.replace(/\D/g, "");
      let query = supabase
        .from("patient_registry")
        .select("*")
        .is("merged_into_registry_id", null)
        .order("created_at", { ascending: false })
        .limit(20);

      if (digits.length >= 11) {
        query = query.or(`cpf.eq.${digits},cns.eq.${digits}`);
      } else if (q) {
        // nome ou prontuário
        query = query.or(
          `full_name.ilike.%${q}%,medical_record.ilike.%${q}%,social_name.ilike.%${q}%`
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      setResults((data || []) as RegistryRow[]);
    } catch (e: any) {
      toast({ title: "Erro na busca", description: e.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const loadPair = async () => {
    if (selectedIds.length !== 2) return;
    const a = results.find((r) => r.id === selectedIds[0])!;
    const b = results.find((r) => r.id === selectedIds[1])!;
    setPair({ a, b });
    const [ca, cb, mra, mrb] = await Promise.all([
      fetchCounts(a.id),
      fetchCounts(b.id),
      supabase.from("medical_records").select("id, numero_prontuario, is_primary, created_at, patient_registry_id").eq("patient_registry_id", a.id),
      supabase.from("medical_records").select("id, numero_prontuario, is_primary, created_at, patient_registry_id").eq("patient_registry_id", b.id),
    ]);
    setACounts(ca);
    setBCounts(cb);
    setARecords((mra.data || []) as MedicalRecordRow[]);
    setBRecords((mrb.data || []) as MedicalRecordRow[]);

    // Sugestão: vencedor = quem tem leito ativo, ou quem tem mais histórico
    let suggested: "a" | "b" = "a";
    if (cb.active_bed && !ca.active_bed) suggested = "b";
    else if (!cb.active_bed && ca.active_bed) suggested = "a";
    else if ((cb.evolutions + cb.prescriptions) > (ca.evolutions + ca.prescriptions)) suggested = "b";
    setWinner(suggested);

    // Default field choices = manter do vencedor; se vazio, pegar do perdedor
    const init: Record<string, Choice> = {};
    const winRow = suggested === "a" ? a : b;
    const loseRow = suggested === "a" ? b : a;
    for (const f of COMPARABLE_FIELDS) {
      const wv = (winRow as any)[f.key];
      const lv = (loseRow as any)[f.key];
      if (wv && lv && wv !== lv) init[f.key as string] = "winner";
      else if (!wv && lv) init[f.key as string] = "loser";
      else init[f.key as string] = "winner";
    }
    setFieldChoices(init);

    // Predominant MR: o do vencedor primary, senão o primeiro
    const winMrs = suggested === "a" ? (mra.data || []) : (mrb.data || []);
    const primary = (winMrs as any[]).find((m) => m.is_primary) || (winMrs as any[])[0];
    setPredominantMrId(primary?.id || null);
  };

  useEffect(() => {
    if (selectedIds.length === 2) loadPair();
    else { setPair(null); setACounts(null); setBCounts(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  const winnerRow = pair && winner ? (winner === "a" ? pair.a : pair.b) : null;
  const loserRow = pair && winner ? (winner === "a" ? pair.b : pair.a) : null;
  const winnerCounts = winner === "a" ? aCounts : bCounts;
  const loserCounts = winner === "a" ? bCounts : aCounts;

  const blockingReason = useMemo(() => {
    if (!pair) return null;
    if (pair.a.merged_into_registry_id || pair.b.merged_into_registry_id)
      return "Um dos cadastros já foi mesclado anteriormente.";
    if (aCounts?.active_bed && bCounts?.active_bed)
      return `Ambos têm paciente em leito ativo (${aCounts.active_bed} e ${bCounts.active_bed}). Libere um leito antes de mesclar.`;
    return null;
  }, [pair, aCounts, bCounts]);

  const allMedicalRecords = [...aRecords, ...bRecords];

  const executeMerge = async () => {
    if (!winnerRow || !loserRow || !predominantMrId) return;
    setExecuting(true);
    try {
      const { data, error } = await (supabase as any).rpc("merge_patient_registries", {
        p_winner_id: winnerRow.id,
        p_loser_id: loserRow.id,
        p_predominant_medical_record_id: predominantMrId,
        p_field_choices: fieldChoices,
        p_reason: reason.trim(),
      });
      if (error) throw error;
      toast({
        title: "Mesclagem concluída",
        description: `Cadastro arquivado. ${Object.entries((data?.counts as any) || {}).map(([k, v]) => `${k}: ${v}`).join(" · ")}`,
      });
      // Reset
      setPair(null); setSelectedIds([]); setResults([]); setSearch("");
      setWinner(null); setReason(""); setFieldChoices({});
      setConfirmOpen(false);
    } catch (e: any) {
      toast({ title: "Erro ao mesclar", description: e.message, variant: "destructive" });
    } finally {
      setExecuting(false);
    }
  };

  if (authorized === null) return <div className="p-8 text-sm text-muted-foreground">Verificando permissões…</div>;
  if (!authorized) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Alert variant="destructive">
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>Acesso restrito a admin, gestor ou recepção.</AlertDescription>
        </Alert>
        <Button variant="ghost" className="mt-4" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
        <div className="flex items-center gap-2">
          <GitMerge className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold uppercase">Mesclar prontuários duplicados</h1>
        </div>
      </div>

      {/* Etapa 1 — Buscar */}
      <Card className="p-5 space-y-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Etapa 1 — Buscar candidatos</div>
        <div className="flex gap-2">
          <Input
            placeholder="CPF, CNS, nome ou nº de prontuário"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
          />
          <Button onClick={doSearch} disabled={searching}>
            <Search className="h-4 w-4 mr-2" />Buscar
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Selecione exatamente <b>2 registros</b> para comparar ({selectedIds.length}/2 selecionados).
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {results.map((r) => {
                const selected = selectedIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => toggleSelect(r.id)}
                    className={`w-full text-left p-3 border rounded-md flex items-center justify-between gap-3 transition-colors ${
                      selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate uppercase">{r.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        Prontuário: <span className="font-mono">{r.medical_record || "—"}</span> · CPF:{" "}
                        <span className="font-mono">{r.cpf || "—"}</span> · CNS:{" "}
                        <span className="font-mono">{r.cns || "—"}</span> · DOB: {r.birth_date || "—"}
                      </div>
                    </div>
                    {r.is_unidentified && <Badge variant="outline">NI</Badge>}
                    {selected && <Badge>Selecionado</Badge>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Etapa 2-3 — Comparar e decidir */}
      {pair && winnerRow && loserRow && (
        <>
          {blockingReason && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{blockingReason}</AlertDescription>
            </Alert>
          )}

          <Card className="p-5 space-y-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Etapa 2 — Escolher o vencedor</div>
            <RadioGroup value={winner || ""} onValueChange={(v) => setWinner(v as "a" | "b")} className="grid grid-cols-2 gap-3">
              {(["a", "b"] as const).map((side) => {
                const row = side === "a" ? pair.a : pair.b;
                const counts = side === "a" ? aCounts : bCounts;
                const isWin = winner === side;
                return (
                  <Label
                    key={side}
                    className={`border rounded-md p-3 cursor-pointer flex items-start gap-3 ${
                      isWin ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <RadioGroupItem value={side} className="mt-1" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium uppercase truncate">{row.full_name || "—"}</span>
                        {counts?.active_bed && <Badge variant="default">Leito {counts.active_bed}</Badge>}
                        {isWin && <Badge variant="secondary">VENCEDOR</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        Prontuário: {row.medical_record || "—"} · CPF: {row.cpf || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Pacientes: {counts?.patients ?? 0} · Evoluções: {counts?.evolutions ?? 0} · Prescrições:{" "}
                        {counts?.prescriptions ?? 0} · Exames: {counts?.exams ?? 0} · Atendimentos: {counts?.encounters ?? 0}
                      </div>
                    </div>
                  </Label>
                );
              })}
            </RadioGroup>
          </Card>

          {/* Prontuário predominante */}
          <Card className="p-5 space-y-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Etapa 3a — Prontuário predominante
            </div>
            <div className="text-sm text-muted-foreground">
              Após a mesclagem todos os prontuários ficam vinculados ao vencedor. Escolha qual número será o{" "}
              <b>principal</b> (os demais ficam arquivados e consultáveis pelo desenvolvedor).
            </div>
            <RadioGroup value={predominantMrId || ""} onValueChange={setPredominantMrId} className="space-y-2">
              {allMedicalRecords.length === 0 && (
                <div className="text-xs text-muted-foreground italic">Nenhum prontuário formal — apenas o legado de patient_registry.medical_record será mantido.</div>
              )}
              {allMedicalRecords.map((mr) => {
                const fromWinner = mr.patient_registry_id === winnerRow.id;
                return (
                  <Label key={mr.id} className="flex items-center gap-2 border rounded-md p-2 cursor-pointer">
                    <RadioGroupItem value={mr.id} />
                    <span className="font-mono text-sm">{mr.numero_prontuario || "—"}</span>
                    <Badge variant="outline">{fromWinner ? "Vencedor" : "Perdedor"}</Badge>
                    {mr.is_primary && <Badge variant="secondary">Atual primário</Badge>}
                  </Label>
                );
              })}
            </RadioGroup>
          </Card>

          {/* Campos divergentes */}
          <Card className="p-5 space-y-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Etapa 3b — Resolver campos divergentes
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3 w-40">Campo</th>
                    <th className="py-2 pr-3">Vencedor</th>
                    <th className="py-2 pr-3">Perdedor</th>
                    <th className="py-2 pr-3 w-64">Manter</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARABLE_FIELDS.map((f) => {
                    const wv = (winnerRow as any)[f.key];
                    const lv = (loserRow as any)[f.key];
                    const divergent = (wv || "") !== (lv || "");
                    const choice = fieldChoices[f.key as string] || "winner";
                    return (
                      <tr key={f.key as string} className={`border-b ${divergent ? "bg-amber-50/40 dark:bg-amber-900/10" : ""}`}>
                        <td className="py-2 pr-3 text-muted-foreground">{f.label}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{fmtVal(wv)}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{fmtVal(lv)}</td>
                        <td className="py-2 pr-3">
                          {divergent ? (
                            <RadioGroup
                              value={choice}
                              onValueChange={(v) =>
                                setFieldChoices((p) => ({ ...p, [f.key as string]: v as Choice }))
                              }
                              className="flex gap-3"
                            >
                              <Label className="flex items-center gap-1 text-xs cursor-pointer">
                                <RadioGroupItem value="winner" />V
                              </Label>
                              <Label className="flex items-center gap-1 text-xs cursor-pointer">
                                <RadioGroupItem value="loser" />P
                              </Label>
                              <Label className="flex items-center gap-1 text-xs cursor-pointer">
                                <RadioGroupItem value="empty" />Vazio
                              </Label>
                            </RadioGroup>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">igual</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Motivo */}
          <Card className="p-5 space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Etapa 3c — Motivo (obrigatório)</div>
            <Textarea
              placeholder="Ex.: Duplicidade identificada pela recepção após reabertura de atendimento. CPF idêntico, mesma data de nascimento."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <div className="text-xs text-muted-foreground">Mínimo de 10 caracteres ({reason.trim().length}/10).</div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setPair(null); setSelectedIds([]); }}>Cancelar</Button>
            <Button
              disabled={!!blockingReason || reason.trim().length < 10 || !predominantMrId}
              onClick={() => setConfirmOpen(true)}
            >
              <GitMerge className="h-4 w-4 mr-2" />Revisar e mesclar
            </Button>
          </div>
        </>
      )}

      {pair && winnerRow && loserRow && (
        <MovementConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Confirmar mesclagem de prontuários"
          confirmLabel={executing ? "Mesclando..." : "Confirmar mesclagem"}
          onConfirm={executeMerge}
          summary={[
            { label: "Cadastro ATIVO (vencedor)", value: `${winnerRow.full_name} — ${winnerRow.medical_record || "sem prontuário legado"}` },
            { label: "Cadastro ARQUIVADO (perdedor)", value: `${loserRow.full_name} — ${loserRow.medical_record || "sem prontuário legado"}` },
            { label: "Prontuário predominante", value: allMedicalRecords.find((m) => m.id === predominantMrId)?.numero_prontuario || "—" },
            { label: "Histórico clínico migrado", value: `${(loserCounts?.evolutions ?? 0)} evoluções · ${(loserCounts?.prescriptions ?? 0)} prescrições · ${(loserCounts?.exams ?? 0)} exames · ${(loserCounts?.encounters ?? 0)} atendimentos` },
          ]}
          warnings={[
            { label: "O cadastro perdedor NÃO será apagado — fica arquivado e consultável pelo desenvolvedor." },
            { label: "CPF e CNS do perdedor serão liberados e preservados na auditoria." },
            { label: "Esta ação é registrada na auditoria imutável de mesclagens." },
          ]}
        />
      )}
    </div>
  );
}
