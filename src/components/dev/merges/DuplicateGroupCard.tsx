import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight, ExternalLink, Bed, AlertTriangle, BadgeCheck } from "lucide-react";
import { sectorLabelFromCode } from "@/lib/hospitalSectors";

export type ScanMember = {
  id: string;
  full_name: string | null;
  social_name: string | null;
  cpf: string | null;
  cns: string | null;
  birth_date: string | null;
  sex: string | null;
  mother_name: string | null;
  medical_record: string | null;
  bed_number: string | null;
  sector_code: string | null;
  created_at: string;
  updated_at: string;
  counts: {
    patients: number;
    evolutions: number;
    exams: number;
    encounters: number;
    medical_records: number;
  };
  non_null_fields: number;
};

export type ScanGroup = {
  rule: "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8";
  key: string;
  group_hash: string;
  members: ScanMember[];
  member_count: number;
  both_with_bed: boolean;
  sectors: string[] | null;
  requires_human_review?: boolean;
};

const RULE_LABEL: Record<ScanGroup["rule"], { text: string; tone: string }> = {
  R1: { text: "CPF idêntico (normalizado)", tone: "bg-emerald-600 text-white" },
  R2: { text: "CNS idêntico (normalizado)", tone: "bg-emerald-600 text-white" },
  R3: { text: "Nome + DOB + Mãe", tone: "bg-blue-600 text-white" },
  R4: { text: "Nome + DOB", tone: "bg-amber-600 text-white" },
  R5: { text: "Prontuário legado igual", tone: "bg-violet-600 text-white" },
  R6: { text: "Similaridade fonética", tone: "bg-slate-600 text-white" },
  R7: { text: "Prontuário (só dígitos) igual", tone: "bg-teal-600 text-white" },
  R8: { text: "Homônimo/familiar (sem DOB)", tone: "bg-orange-600 text-white" },
};

const COMPARE_FIELDS: { key: keyof ScanMember; label: string }[] = [
  { key: "full_name", label: "Nome" },
  { key: "social_name", label: "Nome social" },
  { key: "birth_date", label: "Nascimento" },
  { key: "sex", label: "Sexo" },
  { key: "mother_name", label: "Mãe" },
  { key: "cpf", label: "CPF" },
  { key: "cns", label: "CNS" },
  { key: "medical_record", label: "Prontuário" },
];

function pickSuggestedWinner(members: ScanMember[]): string {
  // 1) leito ativo, 2) mais campos preenchidos, 3) mais antigo
  const ranked = [...members].sort((a, b) => {
    const ab = a.bed_number ? 1 : 0;
    const bb = b.bed_number ? 1 : 0;
    if (ab !== bb) return bb - ab;
    if (b.non_null_fields !== a.non_null_fields) return b.non_null_fields - a.non_null_fields;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  return ranked[0].id;
}

interface Props {
  group: ScanGroup;
  selectedPair: [string, string] | null;
  onSelectPair: (pair: [string, string] | null) => void;
  onMergeNow: (a: string, b: string) => void;
  bulkEligible: boolean;
  inBatch: boolean;
  onToggleBatch: () => void;
}

export function DuplicateGroupCard({ group, selectedPair, onSelectPair, onMergeNow, bulkEligible, inBatch, onToggleBatch }: Props) {
  const [open, setOpen] = useState(false);
  const suggestedWinnerId = useMemo(() => pickSuggestedWinner(group.members), [group]);
  const winner = group.members.find((m) => m.id === suggestedWinnerId)!;
  const loser = group.members.find((m) => m.id !== suggestedWinnerId)!;
  const ruleInfo = RULE_LABEL[group.rule];
  const firstName = group.members[0].full_name || "—";

  const handleMerge = () => {
    if (group.members.length === 2) {
      onMergeNow(suggestedWinnerId, loser.id);
    } else if (selectedPair && selectedPair[0] !== selectedPair[1]) {
      onMergeNow(selectedPair[0], selectedPair[1]);
    }
  };

  const needsPairPick = group.members.length > 2;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 p-3 hover:bg-muted/40 text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <Badge className={`${ruleInfo.tone} text-[10px]`}>{group.rule} · {ruleInfo.text}</Badge>
        <span className="font-medium uppercase truncate">{firstName}</span>
        <Badge variant="outline" className="text-[10px]">{group.member_count} registros</Badge>
        {group.sectors && group.sectors.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {group.sectors.map((s) => sectorLabelFromCode(s)).filter(Boolean).join(" · ") || "Sem leito"}
          </Badge>
        )}
        {group.both_with_bed && (
          <Badge variant="destructive" className="text-[10px] gap-1">
            <AlertTriangle className="h-3 w-3" /> Ambos com leito
          </Badge>
        )}
      </button>

      {open && (
        <div className="border-t border-border p-3 space-y-3 bg-muted/10">
          {/* Tabela comparativa */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left p-1.5 w-32">Campo</th>
                  {group.members.map((m) => (
                    <th key={m.id} className="text-left p-1.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-mono">{m.id.slice(0, 8)}</span>
                        {m.id === suggestedWinnerId && (
                          <Badge className="bg-primary text-primary-foreground text-[9px]">SUG. VENCEDOR</Badge>
                        )}
                        {m.bed_number && (
                          <Badge variant="default" className="text-[9px] gap-0.5">
                            <Bed className="h-2.5 w-2.5" />
                            {m.bed_number}
                          </Badge>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_FIELDS.map((f) => {
                  const vals = group.members.map((m) => (m as any)[f.key] || "—");
                  const allSame = vals.every((v) => v === vals[0]);
                  return (
                    <tr key={f.key as string} className={`border-b border-border/40 ${!allSame ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}>
                      <td className="p-1.5 text-muted-foreground">{f.label}</td>
                      {group.members.map((m) => (
                        <td key={m.id} className="p-1.5 font-mono">{(m as any)[f.key] || "—"}</td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="border-b border-border/40">
                  <td className="p-1.5 text-muted-foreground">Histórico</td>
                  {group.members.map((m) => (
                    <td key={m.id} className="p-1.5 text-[11px]">
                      Evo: {m.counts.evolutions} · Exa: {m.counts.exams} · Atd: {m.counts.encounters} · MR: {m.counts.medical_records}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-1.5 text-muted-foreground">Setor</td>
                  {group.members.map((m) => (
                    <td key={m.id} className="p-1.5">
                      {m.sector_code ? sectorLabelFromCode(m.sector_code) : <span className="text-muted-foreground">sem leito</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Sugestão didática */}
          <div className="text-xs bg-primary/5 border border-primary/20 rounded p-2 flex items-start gap-2">
            <BadgeCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <b>Sugestão:</b> manter <span className="font-mono">{winner.id.slice(0, 8)}</span>
              {winner.bed_number ? ` (em leito ${winner.bed_number})` : ""} · arquivar{" "}
              <span className="font-mono">{loser.id.slice(0, 8)}</span>. Critério: leito ativo &gt; campos preenchidos &gt; mais antigo.
            </div>
          </div>

          {needsPairPick && (
            <div className="text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-300/40 rounded p-2">
              Este grupo tem {group.member_count} registros. A mesclagem é feita 2 a 2 — escolha o par no botão abaixo ou abra um par específico.
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`batch-${group.group_hash}`}
                checked={inBatch}
                onCheckedChange={onToggleBatch}
                disabled={!bulkEligible}
              />
              <label htmlFor={`batch-${group.group_hash}`} className={`text-xs ${!bulkEligible ? "text-muted-foreground" : ""}`}>
                Adicionar ao lote {!bulkEligible && "(indisponível — exige decisão manual)"}
              </label>
            </div>
            <Button size="sm" onClick={handleMerge} disabled={needsPairPick}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Mesclar este par no wizard
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
