import type { DischargeDocType, DischargeDocPayload } from "@/lib/dischargeDocuments";

/**
 * Visao READ-ONLY, inline e persistida de um documento de desfecho (alta/obito):
 * mostra TODOS os campos preenchidos, sem edicao. A unica acao possivel sobre o
 * documento e a suspensao (fora deste componente). Substitui o "so ver/imprimir":
 * o conteudo fica visivel de fato no ambiente de sinalizacao.
 */

interface Props {
  type: DischargeDocType;
  payload: DischargeDocPayload;
}

const fmt = (s?: string | null): string => {
  const v = String(s ?? "").trim();
  if (!v) return "";
  const d = new Date(v);
  if (!isNaN(d.getTime()) && /\d{4}-\d{2}-\d{2}/.test(v)) {
    return d.toLocaleString("pt-BR", { dateStyle: "short", ...(v.includes("T") ? { timeStyle: "short" } : {}) });
  }
  return v;
};

function Field({ label, value }: { label: string; value?: string }) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xs text-foreground whitespace-pre-wrap break-words">{v}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  // Esconde o grupo inteiro se nao tiver nenhum campo preenchido.
  const arr = Array.isArray(children) ? children : [children];
  const hasAny = arr.some((c) => c);
  if (!hasAny) return null;
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-primary border-b border-border/60 pb-0.5">{title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">{children}</div>
    </div>
  );
}

export function DischargeDocInlineView({ type, payload: p }: Props) {
  const isDeath = type === "obito";
  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-3">
      <Group title="Identificação">
        <Field label="Paciente" value={p.patient_name} />
        <Field label="Prontuário" value={p.patient_record} />
        <Field label="Atendimento" value={p.encounter_code} />
        <Field label="Leito" value={p.patient_bed} />
        <Field label="Setor" value={p.patient_sector} />
        <Field label="Nascimento" value={fmt(p.patient_birth_date)} />
        <Field label="Admissão" value={fmt(p.admission_date)} />
        <Field label={isDeath ? "Data do óbito" : "Alta"} value={fmt(p.discharge_date)} />
      </Group>

      <Group title="Quadro clínico">
        <Field label="Diagnóstico de admissão" value={p.admission_diagnosis} />
        <Field label="Diagnósticos finais" value={p.final_diagnoses} />
        <Field label="Resumo da evolução" value={p.evolution_summary} />
        <Field label="Procedimentos" value={p.procedures} />
        <Field label="Complicações" value={p.complications} />
      </Group>

      {!isDeath && (
        <Group title="Alta">
          <Field label="Tipo de alta" value={p.discharge_type} />
          <Field label="Sumário de alta" value={p.discharge_summary} />
          <Field label="Orientações" value={p.orientations} />
          <Field label="Retorno" value={fmt(p.return_date)} />
          <Field label="Especialidade de retorno" value={p.return_specialty} />
          <Field label="Restrições" value={p.restrictions} />
          <Field label="Prescrição de alta" value={p.prescription} />
          <Field label="Encaminhamento" value={p.referral} />
        </Group>
      )}

      {isDeath && (
        <Group title="Óbito">
          <Field label="Data/hora do óbito" value={fmt(p.death_date_time)} />
          <Field label="Local" value={p.death_place} />
          <Field label="Resumo do óbito" value={p.death_summary} />
          <Field label="Causa imediata" value={p.immediate_cause} />
          <Field label="Causas intermediárias" value={p.intermediate_causes} />
          <Field label="Causa básica" value={p.basic_cause} />
          <Field label="Causas contribuintes" value={p.contributing_causes} />
          <Field label="Tipo de óbito" value={p.death_type} />
          <Field label="Necropsia" value={p.necropsy} />
          <Field label="Nº da DO" value={p.do_number} />
          <Field label="Família notificada" value={p.notified_family} />
        </Group>
      )}

      <Group title="Comunicação à família">
        <Field label="Familiar" value={p.family_contact_name} />
        <Field label="Parentesco" value={p.family_contact_relation} />
        <Field label="Telefone" value={p.family_contact_phone} />
        <Field label="E-mail" value={p.family_contact_email} />
        <Field label="Modo de comunicação" value={p.family_communication_mode} />
        <Field label="Comunicado em" value={fmt(p.family_communication_at)} />
        <Field label="Comunicado por" value={p.family_communication_by} />
        <Field label="Satisfação" value={p.family_satisfaction} />
        <Field label="Observações" value={p.family_communication_notes} />
      </Group>

      <Group title="Assinatura">
        <Field label="Médico" value={p.signed_by_name} />
        <Field label="CRM" value={p.signed_by_crm} />
        <Field label="Assinado em" value={fmt(p.signed_at)} />
      </Group>
    </div>
  );
}

export default DischargeDocInlineView;
