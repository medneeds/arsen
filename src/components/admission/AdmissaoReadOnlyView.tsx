import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User as UserIcon } from "lucide-react";
import { richHtmlToPlainText } from "@/components/ui/rich-text-editor";
import { formatDeviceLabel } from "@/lib/devicesCatalog";
import { parseMaybeJsonArray } from "@/lib/admissionSoapNormalizer";

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
  createdByName?: string | null;
  dataHora?: string | null;
}

/** Texto -> linhas: aceita array serializado (["a","b"]) ou texto com quebras de linha. */
function toLines(raw: unknown): string[] {
  const t = String(raw ?? "").trim();
  if (!t) return [];
  return parseMaybeJsonArray(t) ?? t.split("\n").map((l) => l.trim()).filter(Boolean);
}

function Field({ label, value, lines, hideLabel }: { label: string; value?: unknown; lines?: string[]; hideLabel?: boolean }) {
  const v = String(value ?? "").trim();
  if (lines ? lines.length === 0 : !v) return null;
  return (
    <div className="min-w-0">
      {!hideLabel && <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>}
      {lines ? (
        <div className="flex flex-col gap-y-0.5 text-sm text-foreground break-words">
          {lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      ) : (
        <div className="text-sm text-foreground whitespace-pre-wrap break-words">{v}</div>
      )}
    </div>
  );
}

/** Sinais vitais em UMA linha, so os preenchidos, separados por "|" — mais
 *  compacto que um campo por linha para numeros curtos (PA, FC, FR, SpO2...). */
function VitalsLine({ items }: { items: { label: string; value?: unknown }[] }) {
  const filled = items.filter((x) => String(x.value ?? "").trim());
  if (filled.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-primary border-b border-border/60 pb-0.5">Sinais vitais</div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
        {filled.map((x, i) => (
          <span key={x.label} className="inline-flex items-baseline gap-1">
            {i > 0 && <span className="mr-1 text-muted-foreground/40">|</span>}
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{x.label}</span>
            <span className="text-foreground">{String(x.value).trim()}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  if (!arr.some(Boolean)) return null;
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-primary border-b border-border/60 pb-0.5">{title}</div>
      {/* Um topico por LINHA (coluna unica): a quebra em 2 colunas picotava a
          leitura (ex.: HDA longa ao lado de um campo curto). Continuidade melhor. */}
      <div className="flex flex-col gap-y-2">{children}</div>
    </div>
  );
}

export function AdmissaoReadOnlyView({ internacaoId }: Props) {
  const [loading, setLoading] = useState(true);
  const [d0, setD0] = useState<D0 | null>(null);
  const [hist, setHist] = useState<{
    historia_clinica?: string | null; conduta_inicial?: string | null; hipotese_diagnostica?: string | null;
    exames_relevantes?: string | null; previsao_alta?: string | null; peso_kg?: number | null; alergias?: string | null;
  } | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const [{ data: evos }, { data: inter }] = await Promise.all([
        supabase
          .from("evolucoes")
          .select("status, soap, exame_fisico, data_hora")
          .eq("internacao_id", internacaoId)
          .order("data_hora", { ascending: false }),
        supabase
          .from("internacoes")
          .select("historia_clinica, conduta_inicial, hipotese_diagnostica, exames_relevantes, previsao_alta, peso_kg, paciente:pacientes(alergias)")
          .eq("id", internacaoId)
          .maybeSingle(),
      ]);
      if (cancel) return;
      const adm = ((evos ?? []) as { status?: string; soap?: Record<string, unknown>; exame_fisico?: Record<string, unknown>; data_hora?: string }[])
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
          // Exame fisico vive na COLUNA evolucoes.exame_fisico (nao em soap). Antes a
          // view lia soap.__physical_exam (inexistente) e o exame nunca aparecia.
          pe: (root.exame_fisico ?? soap.__physical_exam ?? {}) as Record<string, unknown>,
          validatedByName: (soap.__validated_by_name as string) ?? null,
          createdByName: (soap.__created_by_name as string) ?? null,
          dataHora: root.data_hora ?? null,
        });
      } else {
        setD0(null);
      }
      const interRow = inter as {
        historia_clinica?: string | null; conduta_inicial?: string | null; hipotese_diagnostica?: string | null;
        exames_relevantes?: string | null; previsao_alta?: string | null; peso_kg?: number | null;
        paciente?: { alergias?: string | null } | { alergias?: string | null }[] | null;
      } | null;
      const pacRel = Array.isArray(interRow?.paciente) ? interRow?.paciente[0] : interRow?.paciente;
      setHist(interRow ? {
        historia_clinica: interRow.historia_clinica ?? null,
        conduta_inicial: interRow.conduta_inicial ?? null,
        hipotese_diagnostica: interRow.hipotese_diagnostica ?? null,
        exames_relevantes: interRow.exames_relevantes ?? null,
        previsao_alta: interRow.previsao_alta ?? null,
        peso_kg: interRow.peso_kg ?? null,
        alergias: pacRel?.alergias ?? null,
      } : null);
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

  // Estrutura clinica (nao SOAP): usa as chaves estruturadas gravadas na admissao
  // (__cid_primary/secondary, __diagnostic_hypotheses, historia_clinica,
  // antecedentes, conduta_inicial) na ordem do impresso. Os blocos SOAP crus
  // (objective/assessment) eram concatenacoes que duplicavam antropometria/SSVV/CID
  // e foram removidos daqui — a estrutura segue a realidade dos campos do sistema.
  const cidPrimary = (soap.__cid_primary as string) || "";
  const cidSecondary = (soap.__cid_secondary as string) || "";
  // Hipotese diagnostica REAL = soap.__diagnostic_hypotheses. A coluna
  // internacoes.hipotese_diagnostica e poluida com o CID (seed) no salvamento
  // (hipotese_diagnostica = parsedDiagnoses/cidPrimary quando ha CID), entao NAO e
  // usada aqui — senao a Hipotese exibe o CID em vez da hipotese do medico.
  const hipoteses = (soap.__diagnostic_hypotheses as string) || "";
  const antecedentes = Array.isArray(soap.antecedentes)
    ? (soap.antecedentes as string[]).filter(Boolean).flatMap((a) => toLines(a))
    : [];

  return (
    <div className="space-y-8">
      {(cidPrimary || cidSecondary) && (
        <Group title="Diagnóstico (CID-10)">
          <Field label="CID primário" value={cidPrimary} />
          <Field label="CID secundário" value={cidSecondary} />
        </Group>
      )}

      {toLines(hipoteses).length > 0 && (
        <Group title="Hipóteses diagnósticas">
          <Field label="Hipóteses diagnósticas" hideLabel lines={toLines(hipoteses)} />
        </Group>
      )}

      {(hist?.historia_clinica || soap.subjective) && (
        <Group title="História admissional">
          <Field label="História da doença atual" hideLabel value={hist?.historia_clinica || soap.subjective} />
        </Group>
      )}

      {antecedentes.length > 0 && (
        <Group title="Antecedentes">
          <Field label="Antecedentes (AMP)" lines={antecedentes} />
        </Group>
      )}

      {toLines((soap.__muc as string) || "").length > 0 && (
        <Group title="Medicações de uso contínuo (MUC)">
          <Field label="MUC" hideLabel lines={toLines((soap.__muc as string) || "")} />
        </Group>
      )}

      {(hist?.alergias || soap.__allergies) && (
        <Group title="Alergias">
          <Field label="Alergias" hideLabel value={hist?.alergias || (soap.__allergies as string)} />
        </Group>
      )}

      <VitalsLine
        items={[
          { label: "PA", value: vs.pa },
          { label: "FC", value: vs.fc },
          { label: "FR", value: vs.fr },
          { label: "SpO₂", value: vs.spo2 },
          { label: "Temp", value: vs.temp },
          { label: "Dextro", value: vs.dx },
        ]}
      />

      {(() => {
        const a = (soap.__antropometria ?? {}) as { peso?: string; altura?: string; imc?: { value?: string; label?: string } | null };
        const peso = (a.peso || "").toString().trim() || (hist?.peso_kg != null ? String(hist.peso_kg) : "");
        const altura = (a.altura || "").toString().trim();
        const imc = a.imc && a.imc.value ? `${a.imc.value} (${a.imc.label ?? ""})`.replace(" ()", "") : "";
        const items = [peso && `Peso ${peso} kg`, altura && `Altura ${altura} m`, imc && `IMC ${imc}`].filter(Boolean) as string[];
        return items.length > 0 ? (
          <Group title="Antropometria">
            <Field label="Antropometria" hideLabel value={items.join(" · ")} />
          </Group>
        ) : null;
      })()}

      {(pe.general || pe.cardiovascular || pe.respiratory || pe.abdomen || pe.neurological || pe.extremities || pe.skin || pe.other) && (
        <Group title="Exame físico">
          <Field label="Geral" value={pe.general} />
          <Field label="Cardiovascular" value={pe.cardiovascular} />
          <Field label="Respiratório" value={pe.respiratory} />
          <Field label="Abdome" value={pe.abdomen} />
          <Field label="Neurológico" value={pe.neurological} />
          <Field label="Extremidades" value={pe.extremities} />
          <Field label="Pele / tegumentar" value={pe.skin} />
          <Field label="Outros" value={pe.other} />
        </Group>
      )}

      {(() => {
        // Escalas — Glasgow (+ O/V/M) e RASS (quando sob sedoanalgesia continua).
        // Secao propria, apos o exame fisico, como no formulario (nm-glasgow/nm-escores).
        const glasgow = String(vs.glasgow ?? "").trim();
        const ovm = (vs.glasgow_ovm ?? {}) as { ocular?: unknown; verbal?: unknown; motora?: unknown };
        const glasgowStr = glasgow
          ? `${glasgow}${(ovm.ocular || ovm.verbal || ovm.motora) ? ` (O${ovm.ocular ?? "-"} V${ovm.verbal ?? "-"} M${ovm.motora ?? "-"})` : ""}`
          : "";
        const rass = vs.sedoanalgesia && vs.rass ? String(vs.rass).trim() : "";
        if (!glasgowStr && !rass) return null;
        return (
          <Group title="Escalas">
            <Field label="Glasgow" value={glasgowStr} />
            <Field label="RASS (sedoanalgesia)" value={rass} />
          </Group>
        );
      })()}

      {hist?.exames_relevantes && (
        <Group title="Exames complementares">
          <Field label="Complementares" hideLabel lines={toLines(hist.exames_relevantes)} />
        </Group>
      )}

      {(() => {
        // Especialidades — campo livre no soap, exibido antes do Plano.
        const esp = richHtmlToPlainText(soap.especialidades as string | undefined).trim();
        return esp ? (
          <Group title="Especialidades">
            <Field label="Especialidades" hideLabel lines={toLines(esp)} />
          </Group>
        ) : null;
      })()}

      {(hist?.conduta_inicial || soap.plan) && (
        <Group title="Plano terapêutico">
          <Field label="Conduta inicial" hideLabel value={hist?.conduta_inicial || soap.plan} />
        </Group>
      )}

      {hist?.previsao_alta && (
        <Group title="Previsão de alta">
          <Field label="Previsão de alta" hideLabel value={hist.previsao_alta} />
        </Group>
      )}

      {(() => {
        // Cuidados intensivos (UTI) — campos ESTRUTURADOS da admissao de UTI/UCI2.
        const utiJust = (soap.__uti_justificativa ?? {}) as { codigo?: string; outro?: string };
        const justificativaUti = (utiJust.outro || "").trim() || (utiJust.codigo || "").trim();
        const vasoativo = typeof soap.__uti_vasoativo === "boolean" ? (soap.__uti_vasoativo ? "Sim" : "Não") : "";
        const devices = Array.isArray(soap.devices)
          ? (soap.devices as { label: string; detail?: string }[]).map(formatDeviceLabel).filter(Boolean).join("; ")
          : "";
        const culturas = richHtmlToPlainText(soap.culturesHtml as string | undefined);
        const antibioticos = richHtmlToPlainText(soap.antibioticos as string | undefined);
        const sofa = soap.__uti_sofa as { total?: unknown } | undefined;
        const sofaTotal = sofa && sofa.total != null ? String(sofa.total) : "";
        const origem = (soap.__uti_origem as string) || "";
        const hasUti = justificativaUti || vasoativo || devices || culturas || antibioticos || sofaTotal || origem;
        if (!hasUti) return null;
        return (
          <Group title="Cuidados intensivos (UTI)">
            <Field label="Justificativa de admissão UTI" value={justificativaUti} />
            <Field label="Droga vasoativa" value={vasoativo} />
            <Field label="Dispositivos invasivos" value={devices} />
            <Field label="Culturas" value={culturas} />
            <Field label="Antibióticos em curso" value={antibioticos} />
            <Field label="SOFA (total)" value={sofaTotal} />
            <Field label="Origem" value={origem} />
          </Group>
        );
      })()}

      {(() => {
        // Dados cirurgicos — so na admissao de enfermaria cirurgica (soap.__surgical).
        const s = (soap.__surgical ?? {}) as { procedimento?: string; especialidade?: string; cirurgiao?: string; dataHora?: string; anestesia?: string; carater?: string };
        const has = s.procedimento || s.especialidade || s.cirurgiao || s.dataHora || s.anestesia || s.carater;
        if (!has) return null;
        return (
          <Group title="Dados cirúrgicos">
            <Field label="Procedimento" value={s.procedimento} />
            <Field label="Especialidade" value={s.especialidade} />
            <Field label="Cirurgião" value={s.cirurgiao} />
            <Field label="Data / hora" value={s.dataHora} />
            <Field label="Anestesia" value={s.anestesia} />
            <Field label="Caráter" value={s.carater} />
          </Group>
        );
      })()}

      {d0?.createdByName && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <UserIcon className="h-3 w-3" />
          Admissão por {d0.createdByName}
        </p>
      )}

      {d0?.validatedByName && (
        <p className="text-[11px] text-muted-foreground">
          Admissão validada por {d0.validatedByName}.
        </p>
      )}
    </div>
  );
}

export default AdmissaoReadOnlyView;
