import { Check, Square, User as UserIcon } from "lucide-react";
import { richHtmlToPlainText, sanitizeRichHtml, toRichHtml } from "@/components/ui/rich-text-editor";
import { deviceAlertTone, formatDeviceLabel, type EvolutionDevice } from "@/lib/devicesCatalog";
import { EXAM_FIELDS, type PhysicalExam } from "@/lib/examFields";
import { parsePendency } from "@/lib/pendencyMarker";
import { cn } from "@/lib/utils";

/**
 * Visualizacao SOMENTE LEITURA da evolucao (validada ou de outro autor), no mesmo
 * formato da tela de admissao ja registrada (AdmissaoReadOnlyView): titulo de secao
 * azul em caixa-alta com linha, um topico por linha, rotulos pequenos, sinais vitais
 * em uma linha separados por "|". Nao edita nada.
 */

interface SoapLike {
  subjective?: string;
  assessment?: string;
  objective?: string;
  __cid_primary?: unknown;
  __cid_secondary?: unknown;
}

interface Props {
  soap: SoapLike;
  vitals: Partial<Record<"pa" | "fc" | "fr" | "temp" | "spo2" | "glasgow" | "diurese" | "dor", string>>;
  physicalExam: PhysicalExam;
  devices?: EvolutionDevice[];
  culturesHtml?: string;
  antibioticosHtml?: string;
  planItems?: string[];
  planText?: string;
  pendenciasItems?: string[];
  diagnosticHypotheses?: string | string[] | null;
  antecedentes?: string[];
  createdByName?: string | null;
  validatedByName?: string | null;
  validatedAt?: string | null;
  isValidated?: boolean;
}

const rich = (h?: string): string => sanitizeRichHtml(toRichHtml(h || ""));

/** Texto, array ou array serializado -> linhas. */
function toList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  const t = String(raw ?? "").trim();
  return t ? t.split("\n").map((l) => l.trim()).filter(Boolean) : [];
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

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-primary border-b border-border/60 pb-0.5">{title}</div>
      <div className="flex flex-col gap-y-2">{children}</div>
    </div>
  );
}

function daysSince(s: string): number | null {
  if (!s) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  const d = m ? new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function EvolutionReadOnlyView({
  soap, vitals, physicalExam, devices = [], culturesHtml, antibioticosHtml,
  planItems = [], planText, pendenciasItems = [], diagnosticHypotheses, antecedentes = [],
  createdByName, validatedByName, validatedAt, isValidated,
}: Props) {
  const cid1 = toList(soap.__cid_primary);
  const cid2 = toList(soap.__cid_secondary);
  const hypotheses = toList(diagnosticHypotheses);
  const ante = antecedentes.map((a) => String(a ?? "").trim()).filter(Boolean);
  const vitalsItems = [
    { label: "PA", value: vitals.pa }, { label: "FC", value: vitals.fc }, { label: "FR", value: vitals.fr },
    { label: "SpO₂", value: vitals.spo2 }, { label: "Temp", value: vitals.temp }, { label: "Glasgow", value: vitals.glasgow },
    { label: "Diurese", value: vitals.diurese }, { label: "Dor", value: vitals.dor },
  ].filter((x) => String(x.value ?? "").trim());
  const examFields = EXAM_FIELDS.filter((f) => String(physicalExam[f.key] ?? "").trim());
  const plan = planItems.map((p) => String(p ?? "").trim()).filter(Boolean);
  const pend = pendenciasItems.map((p) => String(p ?? "")).filter((p) => p.trim());
  const evoHtml = [soap.subjective, soap.assessment].map(rich).filter(Boolean).join("");
  const validatedLabel = fmtDateTime(validatedAt);

  return (
    <div className="space-y-8">
      {(cid1.length > 0 || cid2.length > 0) && (
        <Group title="Diagnóstico (CID-10)">
          <Field label="CID primário" lines={cid1} />
          <Field label="CID secundário" lines={cid2} />
        </Group>
      )}

      {hypotheses.length > 0 && (
        <Group title="Hipóteses diagnósticas">
          <Field label="Hipóteses diagnósticas" hideLabel lines={hypotheses} />
        </Group>
      )}

      {ante.length > 0 && (
        <Group title="Antecedentes">
          <Field label="Antecedentes" hideLabel lines={ante} />
        </Group>
      )}

      {vitalsItems.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-primary border-b border-border/60 pb-0.5">Sinais vitais</div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            {vitalsItems.map((x, i) => (
              <span key={x.label} className="inline-flex items-baseline gap-1">
                {i > 0 && <span className="mr-1 text-muted-foreground/40">|</span>}
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{x.label}</span>
                <span className="text-foreground">{String(x.value).trim()}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {examFields.length > 0 && (
        <Group title="Exame físico">
          {examFields.map((f) => <Field key={f.key} label={f.label} value={physicalExam[f.key]} />)}
        </Group>
      )}

      {richHtmlToPlainText(soap.objective) && (
        <Group title="Exames complementares">
          <div className="text-sm text-foreground [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5" dangerouslySetInnerHTML={{ __html: rich(soap.objective) }} />
        </Group>
      )}

      {devices.length > 0 && (
        <Group title="Dispositivos invasivos">
          <div className="flex flex-col gap-y-0.5 text-sm text-foreground">
            {devices.map((d, i) => {
              const days = daysSince(d.insertedAt);
              const tone = deviceAlertTone(days);
              return (
                <div key={`${d.id}-${i}`}>
                  {formatDeviceLabel(d)}
                  {d.insertedAt && <span className="text-muted-foreground"> · inserido em {d.insertedAt}</span>}
                  {days !== null && (
                    <span className={cn("ml-1.5 font-medium", tone === "red" ? "text-critical-on-soft" : tone === "amber" ? "text-warning-on-soft" : "text-released-on-soft")}>
                      D{days}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Group>
      )}

      {richHtmlToPlainText(culturesHtml) && (
        <Group title="Culturas">
          <div className="text-sm text-foreground [&_p]:my-0.5" dangerouslySetInnerHTML={{ __html: rich(culturesHtml) }} />
        </Group>
      )}

      {richHtmlToPlainText(antibioticosHtml) && (
        <Group title="Antibióticos em curso">
          <div className="text-sm text-foreground [&_p]:my-0.5" dangerouslySetInnerHTML={{ __html: rich(antibioticosHtml) }} />
        </Group>
      )}

      {evoHtml && (
        <Group title="Evolução">
          <div className="text-sm text-foreground [&_p]:my-1 [&_p:first-child]:mt-0 [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5" dangerouslySetInnerHTML={{ __html: evoHtml }} />
        </Group>
      )}

      {/* Especialidades — campo livre, lido direto do soap jsonb (sem prop
          dedicada): a timeline e o modo read-only ja passam o soap completo. */}
      {(() => {
        const esp = (soap as { especialidades?: string }).especialidades;
        return richHtmlToPlainText(esp) ? (
          <Group title="Especialidades">
            <div className="text-sm text-foreground [&_p]:my-0.5" dangerouslySetInnerHTML={{ __html: rich(esp) }} />
          </Group>
        ) : null;
      })()}

      {plan.length > 0 ? (
        <Group title="Plano terapêutico">
          <Field label="Plano" hideLabel lines={plan} />
        </Group>
      ) : (
        richHtmlToPlainText(planText) && (
          <Group title="Plano terapêutico">
            <div className="text-sm text-foreground [&_p]:my-1 [&_p:first-child]:mt-0" dangerouslySetInnerHTML={{ __html: rich(planText) }} />
          </Group>
        )
      )}

      {pend.length > 0 && (
        <Group title="Programações e pendências">
          <div className="flex flex-col gap-y-0.5 text-sm text-foreground">
            {pend.map((raw, i) => {
              const { done, text } = parsePendency(raw);
              return (
                <div key={i} className="flex items-center gap-2">
                  {done
                    ? <Check className="h-3.5 w-3.5 shrink-0 text-released-on-soft" aria-label="Concluída" />
                    : <Square className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-label="Em aberto" />}
                  <span className={cn(done && "line-through text-muted-foreground")}>{text}</span>
                </div>
              );
            })}
          </div>
        </Group>
      )}

      {createdByName && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <UserIcon className="h-3 w-3" />
          {isValidated ? "Evolução" : "Rascunho"} por {createdByName}
        </p>
      )}

      {isValidated && validatedByName && (
        <p className="text-[11px] text-muted-foreground">
          Evolução validada por {validatedByName}{validatedLabel ? ` em ${validatedLabel}` : ""}.
        </p>
      )}
    </div>
  );
}

export default EvolutionReadOnlyView;
