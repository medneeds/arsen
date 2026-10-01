import { useQuery } from "@tanstack/react-query";
import { User as UserIcon, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { COMORBIDADES, milParaContagem, formatarContagem, LOCAL_ANTES_UTI, STATUS_CIRURGICO, SITIO_CIRURGICO, INFECCAO } from "@/lib/saps3";

/**
 * Visualizacao READ-ONLY completa de uma ficha SAPS 3 ja gravada (avaliacoes_saps3).
 * Mostra o escore (box1/2/3, total, mortalidade prevista) e todos os campos
 * preenchidos, agrupados por Box. Sem inputs — apos a validacao a ficha nao e
 * mais editavel, so consultada/impressa. Campos vazios sao escondidos.
 */

export interface SapsRow {
  id: string;
  status?: string | null;
  pending_since?: string | null;
  validado_em?: string | null;
  validado_por?: string | null;
  escore_box1?: number | null;
  escore_box2?: number | null;
  escore_box3?: number | null;
  escore_total?: number | null;
  mortalidade_prevista?: number | null;
  // Box I
  idade?: number | null;
  dias_hospital_antes_uti?: number | null;
  origem_admissao?: string | null;
  comorbidades?: unknown;
  admissao_planejada?: boolean | null;
  // Box II
  motivo_admissao?: string | null;
  motivo_admissao_detalhe?: string | null;
  status_cirurgico?: string | null;
  tipo_cirurgia?: string | null;
  infeccao_na_admissao?: string | null;
  // Box III
  escore_glasgow?: number | null;
  fc_mais_alta?: number | null;
  pas_mais_baixa?: number | null;
  temperatura_mais_baixa?: number | null;
  bilirrubina_mais_alta?: number | null;
  creatinina_mais_alta?: number | null;
  leucocitos?: number | null;
  plaquetas_mais_baixas?: number | null;
  ph_mais_baixo?: number | null;
  relacao_pao2_fio2?: number | null;
  ventilacao_mecanica?: boolean | null;
}

const num = (v?: number | null, suf = ""): string =>
  v == null || Number.isNaN(Number(v)) ? "" : `${v}${suf}`;

// Data+hora completas do momento da validacao (ex.: 01/10/2026 as 14:32).
const fmtFull = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

// Traduz o codigo enum gravado (ex.: "operating_room") para o rotulo PT canonico
// definido em saps3.ts. Fallback para o proprio codigo se nao mapear.
const labelFrom = (faixas: { id: string; rotulo: string }[], code?: string | null): string => {
  const c = String(code ?? "").trim();
  if (!c) return "";
  return faixas.find((f) => f.id === c)?.rotulo ?? c;
};

// motivo_admissao e um GRUPO (quando nao ha detalhe em PT). Rotulos PT do grupo.
const MOTIVO_GRUPO: Record<string, string> = {
  cardiovascular: "Cardiovascular",
  neurological: "Neurológico",
  hepatic: "Hepático",
  digestive: "Digestivo",
  respiratory: "Respiratório",
  other: "Outro",
};

const comorbLabels = (raw: unknown): string => {
  const arr = Array.isArray(raw) ? (raw as string[]) : [];
  if (arr.length === 0) return "";
  return arr
    .map((id) => COMORBIDADES.find((c) => c.id === id)?.rotulo ?? id)
    .join(" · ");
};

function Field({ label, value }: { label: string; value?: string }) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground break-words">{v}</div>
    </div>
  );
}

function Group({ title, children, collapsible }: { title: string; children: React.ReactNode; collapsible?: boolean }) {
  const arr = Array.isArray(children) ? children : [children];
  if (!arr.some(Boolean)) return null;
  const grid = <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">{children}</div>;
  // Detalhamento dos boxes retraido por padrao (ficha ja preenchida ocupa menos
  // espaco); o escore/validacao ficam sempre visiveis fora destes grupos.
  if (collapsible) {
    return (
      <Collapsible defaultOpen={false} className="space-y-2">
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 border-b border-border/60 pb-0.5 text-left">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">{title}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">{grid}</CollapsibleContent>
      </Collapsible>
    );
  }
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-primary border-b border-border/60 pb-0.5">{title}</div>
      {grid}
    </div>
  );
}

function mortalityTone(m?: number | null): string {
  if (m == null) return "text-muted-foreground";
  if (m < 10) return "text-released-on-soft";
  if (m < 50) return "text-warning-on-soft";
  return "text-critical-on-soft";
}

export function SapsView({ row }: { row: SapsRow }) {
  const leuco = row.leucocitos != null ? formatarContagem(milParaContagem(row.leucocitos)) : "";
  const plaq = row.plaquetas_mais_baixas != null ? formatarContagem(milParaContagem(row.plaquetas_mais_baixas)) : "";
  const isPending = row.status === "pendente";

  // Nome/CRM de quem validou a ficha (validado_por e FK profissionais.id).
  const { data: validador } = useQuery({
    queryKey: ["saps-validador", row.validado_por],
    enabled: !!row.validado_por,
    queryFn: async () => {
      const { data } = await supabase
        .from("profissionais")
        .select("nome, numero_conselho")
        .eq("id", row.validado_por as string)
        .maybeSingle();
      return (data as { nome?: string | null; numero_conselho?: string | null } | null) ?? null;
    },
  });

  return (
    <div className="space-y-5">
      {/* Escore */}
      <div className="rounded-lg border bg-muted/30 p-4">
        {isPending ? (
          <p className="text-sm font-medium text-warning-on-soft">
            Ficha SAPS 3 pendente — ainda nao validada. Preencha e valide para gerar o escore.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Escore total</div>
              <div className="text-3xl font-bold font-mono text-foreground leading-none">{num(row.escore_total) || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Mortalidade prevista</div>
              <div className={`text-2xl font-bold font-mono leading-none ${mortalityTone(row.mortalidade_prevista)}`}>
                {row.mortalidade_prevista != null ? `${row.mortalidade_prevista}%` : "—"}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Box I <strong className="text-foreground">{num(row.escore_box1) || "—"}</strong> ·
              Box II <strong className="text-foreground">{num(row.escore_box2) || "—"}</strong> ·
              Box III <strong className="text-foreground">{num(row.escore_box3) || "—"}</strong>
            </div>
          </div>
        )}
        {!isPending && validador?.nome && (
          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <UserIcon className="h-3 w-3" />
            Validada por {validador.nome}{validador.numero_conselho ? ` · CRM ${validador.numero_conselho}-MA` : ""}{row.validado_em ? ` em ${fmtFull(row.validado_em)}` : ""}
          </p>
        )}
      </div>

      <Group title="Box I — Condições prévias" collapsible>
        <Field label="Idade" value={num(row.idade, " anos")} />
        <Field label="Dias no hospital antes da UTI" value={num(row.dias_hospital_antes_uti)} />
        <Field label="Origem" value={labelFrom(LOCAL_ANTES_UTI.faixas, row.origem_admissao)} />
        <Field label="Comorbidades" value={comorbLabels(row.comorbidades)} />
        <Field label="Admissão planejada" value={row.admissao_planejada == null ? "" : row.admissao_planejada ? "Sim" : "Não"} />
      </Group>

      <Group title="Box II — Circunstâncias da admissão" collapsible>
        <Field label="Motivo" value={(row.motivo_admissao_detalhe || "").trim() || MOTIVO_GRUPO[String(row.motivo_admissao ?? "").trim()] || row.motivo_admissao || ""} />
        <Field label="Status cirúrgico" value={labelFrom(STATUS_CIRURGICO.faixas, row.status_cirurgico)} />
        <Field label="Tipo de cirurgia" value={labelFrom(SITIO_CIRURGICO.faixas, row.tipo_cirurgia)} />
        <Field label="Infecção na admissão" value={labelFrom(INFECCAO.faixas, row.infeccao_na_admissao)} />
      </Group>

      <Group title="Box III — Fisiologia" collapsible>
        <Field label="Glasgow" value={num(row.escore_glasgow)} />
        <Field label="FC (mais alta)" value={num(row.fc_mais_alta, " bpm")} />
        <Field label="PAS (mais baixa)" value={num(row.pas_mais_baixa, " mmHg")} />
        <Field label="Temperatura (mais baixa)" value={num(row.temperatura_mais_baixa, " °C")} />
        <Field label="Bilirrubina (mais alta)" value={num(row.bilirrubina_mais_alta, " mg/dL")} />
        <Field label="Creatinina (mais alta)" value={num(row.creatinina_mais_alta, " mg/dL")} />
        <Field label="Leucócitos" value={leuco ? `${leuco} /mm³` : ""} />
        <Field label="Plaquetas" value={plaq ? `${plaq} /mm³` : ""} />
        <Field label="pH (mais baixo)" value={num(row.ph_mais_baixo)} />
        <Field label="PaO₂/FiO₂" value={num(row.relacao_pao2_fio2)} />
        <Field label="Ventilação mecânica" value={row.ventilacao_mecanica == null ? "" : row.ventilacao_mecanica ? "Sim" : "Não"} />
      </Group>

      {/* Ressalva: alguns itens do escore nao sao reconstruiveis (nunca gravados). */}
      <p className="text-[11px] text-muted-foreground">
        Observação: uso de vasoativo antes da UTI e detalhamento do Glasgow (O/V/M) não são
        armazenados nesta ficha — o escore usa o valor consolidado no momento da validação.
      </p>
    </div>
  );
}

export default SapsView;
