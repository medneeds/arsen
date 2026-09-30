import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Visao READ-ONLY inline da admissao (D0) ja registrada — mostrada na aba
 * Admissao quando o paciente JA foi admitido (a admissao nao pode mais ser
 * reeditada aqui; consulta). Fonte: a evolucao de admissao
 * (soap.__evolution_type='admission') + internacoes (historia/conduta/hipotese),
 * mesma origem do AdmissionConsultDialog.
 */

interface Props {
  internacaoId: string;
}

interface D0 {
  soap: Record<string, unknown>;
  vs: Record<string, unknown>;
  pe: Record<string, unknown>;
  validatedByName?: string | null;
  dataHora?: string | null;
}

function Field({ label, value }: { label: string; value?: unknown }) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground whitespace-pre-wrap break-words">{v}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  if (!arr.some(Boolean)) return null;
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-primary border-b border-border/60 pb-0.5">{title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">{children}</div>
    </div>
  );
}

export function AdmissaoReadOnlyView({ internacaoId }: Props) {
  const [loading, setLoading] = useState(true);
  const [d0, setD0] = useState<D0 | null>(null);
  const [hist, setHist] = useState<{ historia_clinica?: string | null; conduta_inicial?: string | null; hipotese_diagnostica?: string | null } | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const [{ data: evos }, { data: inter }] = await Promise.all([
        supabase
          .from("evolucoes")
          .select("status, soap, data_hora")
          .eq("internacao_id", internacaoId)
          .order("data_hora", { ascending: false }),
        supabase
          .from("internacoes")
          .select("historia_clinica, conduta_inicial, hipotese_diagnostica")
          .eq("id", internacaoId)
          .maybeSingle(),
      ]);
      if (cancel) return;
      const adm = ((evos ?? []) as { status?: string; soap?: Record<string, unknown>; data_hora?: string }[])
        .filter((e) => (e.soap as { __evolution_type?: string })?.__evolution_type === "admission");
      const root =
        adm.find((e) => e.status === "validated" && !(e.soap as { parent_id?: string })?.parent_id) ||
        adm.find((e) => !(e.soap as { parent_id?: string })?.parent_id) ||
        adm[0];
      if (root) {
        const soap = (root.soap ?? {}) as Record<string, unknown>;
        setD0({
          soap,
          vs: (soap.__vital_signs ?? {}) as Record<string, unknown>,
          pe: (soap.__physical_exam ?? {}) as Record<string, unknown>,
          validatedByName: (soap.__validated_by_name as string) ?? null,
          dataHora: root.data_hora ?? null,
        });
      } else {
        setD0(null);
      }
      setHist((inter as typeof hist) ?? null);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [internacaoId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando admissão...
      </div>
    );
  }

  if (!d0 && !hist?.hipotese_diagnostica) {
    return <p className="text-sm text-muted-foreground">Admissão (D0) ainda não registrada.</p>;
  }

  const soap = d0?.soap ?? {};
  const vs = d0?.vs ?? {};
  const pe = d0?.pe ?? {};

  return (
    <div className="space-y-5">
      <Group title="História / Subjetivo">
        <Field label="História da doença atual" value={hist?.historia_clinica || soap.subjective} />
        <Field label="Objetivo" value={soap.objective} />
      </Group>

      <Group title="Sinais vitais">
        <Field label="PA" value={vs.pa} />
        <Field label="FC" value={vs.fc} />
        <Field label="FR" value={vs.fr} />
        <Field label="SpO₂" value={vs.spo2} />
        <Field label="Temperatura" value={vs.temp} />
        <Field label="Dextro" value={vs.dx} />
      </Group>

      <Group title="Exame físico">
        <Field label="Geral" value={pe.general} />
        <Field label="Cardiovascular" value={pe.cardiovascular} />
        <Field label="Respiratório" value={pe.respiratory} />
        <Field label="Abdome" value={pe.abdomen} />
        <Field label="Extremidades" value={pe.extremities} />
      </Group>

      <Group title="Diagnóstico / Avaliação">
        <Field label="Hipótese diagnóstica" value={hist?.hipotese_diagnostica} />
        <Field label="Avaliação" value={soap.assessment} />
      </Group>

      <Group title="Plano terapêutico">
        <Field label="Conduta inicial" value={soap.plan || hist?.conduta_inicial} />
      </Group>

      {d0?.validatedByName && (
        <p className="text-[11px] text-muted-foreground">
          Admissão validada por {d0.validatedByName}.
        </p>
      )}
    </div>
  );
}

export default AdmissaoReadOnlyView;
