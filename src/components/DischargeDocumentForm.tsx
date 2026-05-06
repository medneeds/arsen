import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Printer, Skull, Home, FileSignature } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type DischargeDocType,
  type DischargeDocPayload,
  DISCHARGE_DOC_LABELS,
  printDischargeDocument,
} from "@/lib/dischargeDocuments";

export interface DischargeDocFormProps {
  type: DischargeDocType;
  initial?: Partial<DischargeDocPayload>;
  onChange: (payload: DischargeDocPayload, isComplete: boolean) => void;
}

const REQUIRED_BY_TYPE: Record<DischargeDocType, (keyof DischargeDocPayload)[]> = {
  alta_hospitalar: ["final_diagnoses", "evolution_summary", "discharge_summary", "orientations", "signed_by_name", "signed_by_crm", "family_contact_name", "family_contact_relation", "family_contact_phone", "family_communication_mode", "family_satisfaction"],
  alta_pedido: ["final_diagnoses", "evolution_summary", "discharge_summary", "signed_by_name", "signed_by_crm", "family_contact_name", "family_contact_relation", "family_contact_phone", "family_communication_mode", "family_satisfaction"],
  obito: ["death_date_time", "death_summary", "signed_by_name", "signed_by_crm", "family_contact_name", "family_contact_relation", "family_contact_phone", "family_communication_mode", "family_satisfaction"],
};

const RELATION_OPTIONS = [
  "CÔNJUGE", "FILHO(A)", "PAI", "MÃE", "IRMÃO(Ã)", "AVÔ/AVÓ", "NETO(A)",
  "TIO(A)", "SOBRINHO(A)", "PRIMO(A)", "RESPONSÁVEL LEGAL", "OUTRO",
];

export function DischargeDocumentForm({ type, initial, onChange }: DischargeDocFormProps) {
  const [form, setForm] = useState<DischargeDocPayload>(() => ({
    patient_name: "",
    discharge_date: new Date().toISOString().slice(0, 16),
    death_date_time: new Date().toISOString().slice(0, 16),
    discharge_type: "melhorado",
    death_type: "natural",
    ...initial,
  }) as DischargeDocPayload);

  const setField = <K extends keyof DischargeDocPayload>(k: K, v: DischargeDocPayload[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isComplete = useMemo(() => {
    const req = REQUIRED_BY_TYPE[type];
    const minOne: (keyof DischargeDocPayload)[] = [
      "family_satisfaction", "family_communication_mode", "family_contact_relation",
    ];
    return req.every((k) => {
      const v = String((form as any)[k] ?? "").trim();
      return minOne.includes(k) ? v.length >= 1 : v.length > 2;
    });
  }, [form, type]);

  useEffect(() => {
    onChange(form, isComplete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, isComplete]);

  const isDeath = type === "obito";
  const Icon = isDeath ? Skull : Home;

  const upper = (v: string) => v.toUpperCase();

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Icon className={cn("h-4 w-4", isDeath ? "text-destructive" : "text-primary")} />
        <span className="text-xs uppercase tracking-wider font-semibold">
          {DISCHARGE_DOC_LABELS[type]} <span className="text-destructive">*</span>
        </span>
        <span className={cn("ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full",
          isComplete ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-warning/10 text-warning")}>
          {isComplete ? "Pronto" : "Preencher campos *"}
        </span>
      </div>

      {/* Common */}
      <div className="grid grid-cols-2 gap-2">
        <Field label={isDeath ? "Data/hora do óbito *" : "Data/hora da alta *"}>
          <Input
            type="datetime-local"
            className="h-8 text-xs"
            value={isDeath ? form.death_date_time || "" : form.discharge_date || ""}
            onChange={(e) => setField(isDeath ? "death_date_time" : "discharge_date", e.target.value)}
          />
        </Field>
        {isDeath ? (
          <Field label="Local do óbito">
            <Input
              className="h-8 text-xs uppercase"
              value={form.death_place || ""}
              onChange={(e) => setField("death_place", upper(e.target.value))}
              placeholder="LEITO / SETOR / CC"
            />
          </Field>
        ) : (
          <Field label="Tipo de alta">
            <Select value={form.discharge_type || "melhorado"} onValueChange={(v) => setField("discharge_type", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="melhorado">Melhorado</SelectItem>
                <SelectItem value="curado">Curado</SelectItem>
                <SelectItem value="inalterado">Inalterado</SelectItem>
                <SelectItem value="a_pedido">A pedido</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      <Field label="Diagnóstico de admissão">
        <Textarea rows={2} className="text-xs" value={form.admission_diagnosis || ""}
          onChange={(e) => setField("admission_diagnosis", upper(e.target.value))} />
      </Field>

      <Field label="Diagnósticos finais (CID + descrição) *">
        <Textarea rows={2} className="text-xs" value={form.final_diagnoses || ""}
          onChange={(e) => setField("final_diagnoses", upper(e.target.value))}
          placeholder="EX: I50.0 - INSUFICIÊNCIA CARDÍACA CONGESTIVA" />
      </Field>

      <Field label={isDeath ? "Resumo da evolução até o óbito *" : "Resumo da evolução / quadro clínico *"}>
        <Textarea rows={3} className="text-xs" value={form.evolution_summary || ""}
          onChange={(e) => setField("evolution_summary", upper(e.target.value))} />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Procedimentos realizados">
          <Textarea rows={2} className="text-xs" value={form.procedures || ""}
            onChange={(e) => setField("procedures", upper(e.target.value))} />
        </Field>
        <Field label="Intercorrências">
          <Textarea rows={2} className="text-xs" value={form.complications || ""}
            onChange={(e) => setField("complications", upper(e.target.value))} />
        </Field>
      </div>

      {isDeath ? (
        <>
          <Field label="Resumo do óbito / relatório livre *">
            <Textarea rows={8} className="text-xs" value={form.death_summary || ""}
              onChange={(e) => setField("death_summary", upper(e.target.value))}
              placeholder="DESCREVA LIVREMENTE O RELATÓRIO DO ÓBITO: HISTÓRICO CLÍNICO RELEVANTE, EVOLUÇÃO ATÉ O ÓBITO, MANOBRAS REALIZADAS, HORÁRIO DA CONSTATAÇÃO E DEMAIS OBSERVAÇÕES." />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Tipo de morte">
              <Select value={form.death_type || "natural"} onValueChange={(v) => setField("death_type", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural">Natural</SelectItem>
                  <SelectItem value="violenta">Violenta / Externa</SelectItem>
                  <SelectItem value="indeterminada">Indeterminada</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Necropsia">
              <Select value={form.necropsy || "nao_indicada"} onValueChange={(v) => setField("necropsy", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_indicada">Não indicada</SelectItem>
                  <SelectItem value="indicada">Indicada</SelectItem>
                  <SelectItem value="realizada">Realizada</SelectItem>
                  <SelectItem value="iml">Encaminhado IML</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nº Declaração de Óbito">
              <Input className="h-8 text-xs" value={form.do_number || ""}
                onChange={(e) => setField("do_number", e.target.value)} />
            </Field>
          </div>
          <Field label="Família notificada por">
            <Input className="h-8 text-xs uppercase" value={form.notified_family || ""}
              onChange={(e) => setField("notified_family", upper(e.target.value))}
              placeholder="NOME DO PROFISSIONAL E HORÁRIO" />
          </Field>
        </>
      ) : (
        <>
          <Field label="Sumário de alta * (síntese clínica do internamento — diferente das orientações ao paciente)">
            <Textarea rows={4} className="text-xs" value={form.discharge_summary || ""}
              onChange={(e) => setField("discharge_summary", upper(e.target.value))}
              placeholder="MOTIVO DA INTERNAÇÃO, EVOLUÇÃO, EXAMES RELEVANTES, TRATAMENTOS REALIZADOS, CONDIÇÃO CLÍNICA NA ALTA" />
          </Field>
          <Field label="Orientações ao paciente / cuidador na alta *">
            <Textarea rows={3} className="text-xs" value={form.orientations || ""}
              onChange={(e) => setField("orientations", upper(e.target.value))}
              placeholder="CUIDADOS DOMICILIARES, SINAIS DE ALERTA, USO DE MEDICAÇÕES, RETORNO" />
          </Field>
          <Field label="Prescrição de alta">
            <Textarea rows={3} className="text-xs" value={form.prescription || ""}
              onChange={(e) => setField("prescription", upper(e.target.value))}
              placeholder="MEDICAMENTOS, DOSES E DURAÇÃO" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Retorno (data)">
              <Input type="date" className="h-8 text-xs" value={form.return_date || ""}
                onChange={(e) => setField("return_date", e.target.value)} />
            </Field>
            <Field label="Especialidade do retorno">
              <Input className="h-8 text-xs uppercase" value={form.return_specialty || ""}
                onChange={(e) => setField("return_specialty", upper(e.target.value))} />
            </Field>
          </div>
          <Field label="Restrições / cuidados especiais">
            <Textarea rows={2} className="text-xs" value={form.restrictions || ""}
              onChange={(e) => setField("restrictions", upper(e.target.value))} />
          </Field>
        </>
      )}

      {/* Comunicação à família */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center gap-2">
          <FileSignature className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] uppercase tracking-wider font-semibold">
            Comunicação à família <span className="text-destructive">*</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Familiar comunicado *">
            <Input className="h-8 text-xs uppercase" value={form.family_contact_name || ""}
              onChange={(e) => setField("family_contact_name", upper(e.target.value))}
              placeholder="NOME COMPLETO" />
          </Field>
          <Field label="Grau de parentesco *">
            <Select value={form.family_contact_relation || ""} onValueChange={(v) => setField("family_contact_relation", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="SELECIONE" /></SelectTrigger>
              <SelectContent>
                {RELATION_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Telefone *">
            <Input className="h-8 text-xs" value={form.family_contact_phone || ""}
              onChange={(e) => setField("family_contact_phone", e.target.value)}
              placeholder="(00) 00000-0000" />
          </Field>
          <Field label="E-mail">
            <Input type="email" className="h-8 text-xs" value={form.family_contact_email || ""}
              onChange={(e) => setField("family_contact_email", e.target.value.toLowerCase())} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Modo *">
            <Select value={form.family_communication_mode || ""} onValueChange={(v) => setField("family_communication_mode", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="SELECIONE" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PRESENCIAL">Presencial</SelectItem>
                <SelectItem value="TELEFONE">Telefone</SelectItem>
                <SelectItem value="VIDEOCHAMADA">Videochamada</SelectItem>
                <SelectItem value="MENSAGEM">Mensagem / WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Comunicado por">
            <Input className="h-8 text-xs uppercase" value={form.family_communication_by || ""}
              onChange={(e) => setField("family_communication_by", upper(e.target.value))}
              placeholder="PROFISSIONAL" />
          </Field>
          <Field label="Data/hora">
            <Input type="datetime-local" className="h-8 text-xs"
              value={form.family_communication_at || ""}
              onChange={(e) => setField("family_communication_at", e.target.value)} />
          </Field>
        </div>
        <Field label="Grau de satisfação na comunicação médica *">
          <div className="flex gap-1">
            {[1,2,3,4,5].map((n) => {
              const selected = form.family_satisfaction === String(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setField("family_satisfaction", String(n))}
                  className={cn(
                    "flex-1 h-8 text-xs rounded-md border font-semibold transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border text-muted-foreground"
                  )}
                  aria-label={`Nota ${n}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
            <span>Muito insatisfeito</span>
            <span>Muito satisfeito</span>
          </div>
        </Field>
        <Field label="Observações da comunicação">
          <Textarea rows={2} className="text-xs" value={form.family_communication_notes || ""}
            onChange={(e) => setField("family_communication_notes", upper(e.target.value))}
            placeholder="REAÇÕES, DÚVIDAS, ENCAMINHAMENTOS" />
        </Field>
      </div>

      {/* Sign */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
        <Field label="Médico responsável *">
          <Input className="h-8 text-xs uppercase" value={form.signed_by_name || ""}
            onChange={(e) => setField("signed_by_name", upper(e.target.value))} />
        </Field>
        <Field label="CRM *">
          <Input className="h-8 text-xs" value={form.signed_by_crm || ""}
            onChange={(e) => setField("signed_by_crm", e.target.value)} />
        </Field>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full h-8 text-xs gap-1.5"
        onClick={() => printDischargeDocument(type, { ...form, signed_at: form.signed_at || new Date().toISOString() })}
      >
        <Printer className="h-3.5 w-3.5" /> Pré-visualizar / imprimir Norma Zero
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
