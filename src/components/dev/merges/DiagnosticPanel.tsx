import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Loader2, Play, AlertTriangle, Layers } from "lucide-react";
import { toast } from "sonner";
import { HOSPITAL_SECTOR_GROUPS, sectorLabelFromCode } from "@/lib/hospitalSectors";
import { DuplicateGroupCard, type ScanGroup } from "./DuplicateGroupCard";
import { BulkMergeReviewDialog, type BulkPair } from "./BulkMergeReviewDialog";

const ALL_RULES = ["R1", "R2", "R3", "R4", "R5"] as const;
type Rule = typeof ALL_RULES[number] | "R6";

const RULE_LABEL: Record<Rule, string> = {
  R1: "R1 CPF",
  R2: "R2 CNS",
  R3: "R3 Nome+DOB+Mãe",
  R4: "R4 Nome+DOB",
  R5: "R5 Prontuário legado",
  R6: "R6 Similaridade",
};

// Bulk só para R1 e R2 (matches cirurgicamente claros)
const BULK_ELIGIBLE_RULES = new Set<Rule>(["R1", "R2"]);

function pickSuggestedWinner(members: ScanGroup["members"]) {
  const ranked = [...members].sort((a, b) => {
    const ab = a.bed_number ? 1 : 0;
    const bb = b.bed_number ? 1 : 0;
    if (ab !== bb) return bb - ab;
    if (b.non_null_fields !== a.non_null_fields) return b.non_null_fields - a.non_null_fields;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  return ranked[0];
}

export function DiagnosticPanel() {
  const navigate = useNavigate();
  const [sectorCode, setSectorCode] = useState<string>("__all__");
  const [rules, setRules] = useState<Set<Rule>>(new Set(ALL_RULES));
  const [includeSimilarity, setIncludeSimilarity] = useState(false);
  const [textFilter, setTextFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<ScanGroup[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  // Lote
  const [batchHashes, setBatchHashes] = useState<Set<string>>(new Set());
  const [reviewOpen, setReviewOpen] = useState(false);

  const toggleRule = (r: Rule) => {
    setRules((prev) => {
      const next = new Set(prev);
      next.has(r) ? next.delete(r) : next.add(r);
      return next;
    });
  };

  const runScan = async () => {
    setLoading(true);
    setBatchHashes(new Set());
    try {
      const activeRules = Array.from(rules);
      if (includeSimilarity) activeRules.push("R6");
      const { data, error } = await (supabase as any).rpc("scan_duplicate_registries", {
        p_sector_code: sectorCode,
        p_rules: activeRules,
        p_include_similarity: includeSimilarity,
        p_similarity_threshold: 0.85,
        p_limit_groups: 300,
      });
      if (error) throw error;
      const gs = (data?.groups || []) as ScanGroup[];
      setGroups(gs);
      setGeneratedAt(data?.generated_at || new Date().toISOString());
      toast.success(`${gs.length} grupos encontrados`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao rodar varredura");
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = useMemo(() => {
    const t = textFilter.trim().toLowerCase();
    if (!t) return groups;
    return groups.filter((g) =>
      g.members.some((m) =>
        (m.full_name || "").toLowerCase().includes(t) ||
        (m.cpf || "").includes(t) ||
        (m.cns || "").includes(t) ||
        (m.medical_record || "").toLowerCase().includes(t),
      ),
    );
  }, [groups, textFilter]);

  const kpis = useMemo(() => {
    const totalRegs = groups.reduce((acc, g) => acc + g.member_count, 0);
    const withBed = groups.filter((g) => g.members.some((m) => m.bed_number)).length;
    const critical = groups.filter((g) => g.both_with_bed).length;
    return { groups: groups.length, totalRegs, withBed, critical };
  }, [groups]);

  const isBulkEligible = (g: ScanGroup) =>
    BULK_ELIGIBLE_RULES.has(g.rule as Rule) && g.member_count === 2 && !g.both_with_bed;

  const toggleBatch = (hash: string) => {
    setBatchHashes((prev) => {
      const next = new Set(prev);
      next.has(hash) ? next.delete(hash) : next.add(hash);
      return next;
    });
  };

  const handleMergeNow = (a: string, b: string) => {
    navigate(`/mesclar-prontuarios?a=${a}&b=${b}`);
  };

  const bulkPairs: BulkPair[] = useMemo(() => {
    return Array.from(batchHashes)
      .map((h) => groups.find((g) => g.group_hash === h))
      .filter((g): g is ScanGroup => !!g && isBulkEligible(g))
      .map((g) => {
        const winner = pickSuggestedWinner(g.members);
        const loser = g.members.find((m) => m.id !== winner.id)!;
        return {
          group_hash: g.group_hash,
          rule: g.rule,
          winnerId: winner.id,
          loserId: loser.id,
          winnerLabel: `${winner.full_name || "—"} · ${winner.medical_record || winner.id.slice(0, 8)}`,
          loserLabel: `${loser.full_name || "—"} · ${loser.medical_record || loser.id.slice(0, 8)}`,
          predominantMrId: null,
        };
      });
  }, [batchHashes, groups]);

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <Card className="p-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 min-w-[220px]">
            <Label className="text-[10px] uppercase text-muted-foreground">Setor</Label>
            <Select value={sectorCode} onValueChange={setSectorCode}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectGroup>
                  <SelectLabel>Escopo</SelectLabel>
                  <SelectItem value="__all__">Todos os setores</SelectItem>
                  <SelectItem value="__no_bed__">Sem leito ativo</SelectItem>
                  <SelectItem value="__with_bed__">Apenas com leito ativo</SelectItem>
                </SelectGroup>
                {HOSPITAL_SECTOR_GROUPS.map((grp) => (
                  <SelectGroup key={grp.title}>
                    <SelectLabel>{grp.title}</SelectLabel>
                    {grp.items.map((it) => (
                      <SelectItem key={it.key} value={it.key}>{it.label}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Regras de match</Label>
            <div className="flex flex-wrap gap-1">
              {ALL_RULES.map((r) => {
                const on = rules.has(r);
                return (
                  <button
                    key={r}
                    onClick={() => toggleRule(r)}
                    className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                      on ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {RULE_LABEL[r]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="sim" checked={includeSimilarity} onCheckedChange={setIncludeSimilarity} />
            <Label htmlFor="sim" className="text-xs">Incluir R6 similaridade fonética (≥ 0.85 + DOB)</Label>
          </div>

          <div className="ml-auto">
            <Button onClick={runScan} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
              Rodar varredura
            </Button>
          </div>
        </div>

        <Input
          placeholder="Filtrar resultados por nome, CPF, CNS ou prontuário…"
          value={textFilter}
          onChange={(e) => setTextFilter(e.target.value)}
          className="h-8 text-xs max-w-md"
        />
      </Card>

      {/* KPIs */}
      {generatedAt && (
        <Card className="p-3 flex flex-wrap items-center gap-4 text-xs">
          <div><b>{kpis.groups}</b> grupos</div>
          <div><b>{kpis.totalRegs}</b> registros</div>
          <div><b>{kpis.withBed}</b> com leito ativo</div>
          <div className="flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3 w-3" /> <b>{kpis.critical}</b> críticos (ambos em leito)
          </div>
          <div className="ml-auto text-muted-foreground">
            Atualizado {new Date(generatedAt).toLocaleString("pt-BR")}
          </div>
        </Card>
      )}

      {/* Lista de grupos */}
      <div className="space-y-2">
        {!generatedAt && !loading && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            <Layers className="h-6 w-6 mx-auto mb-2 opacity-50" />
            Configure os filtros e clique em <b>Rodar varredura</b> para iniciar o diagnóstico.
          </Card>
        )}
        {generatedAt && filteredGroups.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma duplicata encontrada com os filtros atuais.
          </Card>
        )}
        {filteredGroups.map((g) => (
          <DuplicateGroupCard
            key={g.group_hash}
            group={g}
            selectedPair={null}
            onSelectPair={() => {}}
            onMergeNow={handleMergeNow}
            bulkEligible={isBulkEligible(g)}
            inBatch={batchHashes.has(g.group_hash)}
            onToggleBatch={() => toggleBatch(g.group_hash)}
          />
        ))}
      </div>

      {/* Barra fixa do lote */}
      {batchHashes.size > 0 && (
        <div className="fixed bottom-5 right-5 z-40 bg-card border border-border shadow-lg rounded-lg p-3 flex items-center gap-3">
          <Badge>{batchHashes.size} no lote</Badge>
          <Button size="sm" variant="ghost" onClick={() => setBatchHashes(new Set())}>Limpar</Button>
          <Button size="sm" onClick={() => setReviewOpen(true)}>Revisar e executar</Button>
        </div>
      )}

      <BulkMergeReviewDialog
        open={reviewOpen}
        pairs={bulkPairs}
        onClose={() => setReviewOpen(false)}
        onCompleted={() => {
          setReviewOpen(false);
          setBatchHashes(new Set());
          runScan();
        }}
      />
    </div>
  );
}
