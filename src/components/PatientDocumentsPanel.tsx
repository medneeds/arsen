import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, ChevronRight, Clock, Droplet, FileCheck, FileText,
  FlaskConical, Microscope, NotebookPen, Plus, Printer, Radar,
  ScanLine, Stethoscope, Syringe, TestTubes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_TYPE_META,
  STATUS_BADGE,
  type DocumentType,
  type PatientDocument,
} from "@/hooks/usePatientDocuments";

const TYPE_ICON: Record<DocumentType, React.ElementType> = {
  hemoderivado: Droplet,
  apac: FileCheck,
  sat: Syringe,
  aih: FileText,
  cultura: Microscope,
  lab: TestTubes,
  imagem: ScanLine,
  parecer: Stethoscope,
  evolucao: NotebookPen,
  round: Activity,
};

interface PatientDocumentsPanelProps {
  docs: PatientDocument[];
  loading?: boolean;
  /** Disparado ao clicar em "+ Nova" em um tipo. */
  onNewByType?: (type: DocumentType) => void;
  /** Disparado ao clicar em um documento específico. */
  onOpenDoc?: (doc: PatientDocument) => void;
  /** Disparado ao clicar em "Reimprimir" — opcional. */
  onPrintDoc?: (doc: PatientDocument) => void;
  /** Tipos a exibir como acordeão. Default: todos. */
  visibleTypes?: DocumentType[];
  /** Quantos itens da timeline geral mostrar no topo. Default 5. */
  timelineLimit?: number;
  /** Esconde a timeline do topo. */
  hideTimeline?: boolean;
}

const DEFAULT_ORDER: DocumentType[] = [
  "hemoderivado",
  "apac",
  "sat",
  "aih",
  "cultura",
  "lab",
  "imagem",
  "parecer",
  "evolucao",
  "round",
];

function formatDate(d: string) {
  try {
    return format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return d;
  }
}

export function PatientDocumentsPanel({
  docs,
  loading,
  onNewByType,
  onOpenDoc,
  onPrintDoc,
  visibleTypes = DEFAULT_ORDER,
  timelineLimit = 5,
  hideTimeline,
}: PatientDocumentsPanelProps) {
  const byType = useMemo(() => {
    const map: Partial<Record<DocumentType, PatientDocument[]>> = {};
    docs.forEach((d) => {
      if (!map[d.type]) map[d.type] = [];
      map[d.type]!.push(d);
    });
    return map;
  }, [docs]);

  const timeline = useMemo(() => docs.slice(0, timelineLimit), [docs, timelineLimit]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* TIMELINE GERAL (5 últimos) */}
      {!hideTimeline && timeline.length > 0 && (
        <section className="rounded-xl border border-border/60 bg-card/50">
          <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-xs font-semibold tracking-wide text-foreground/80">
                Últimos documentos
              </h3>
            </div>
            <span className="text-[10px] text-muted-foreground">{docs.length} no total</span>
          </header>
          <ul className="divide-y divide-border/40">
            {timeline.map((doc) => (
              <TimelineRow
                key={`${doc.source}-${doc.id}`}
                doc={doc}
                onOpen={onOpenDoc}
                onPrint={onPrintDoc}
              />
            ))}
          </ul>
        </section>
      )}

      {!hideTimeline && timeline.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
          <FileText className="h-7 w-7 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Nenhum documento clínico registrado ainda
          </p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Comece criando uma nova solicitação abaixo
          </p>
        </div>
      )}

      {/* ACORDEÕES POR TIPO */}
      <Accordion
        type="multiple"
        className="space-y-1.5"
        defaultValue={visibleTypes.filter((t) => (byType[t]?.length || 0) > 0).slice(0, 2)}
      >
        {visibleTypes.map((type) => {
          const items = byType[type] || [];
          const meta = DOCUMENT_TYPE_META[type];
          const Icon = TYPE_ICON[type];
          return (
            <AccordionItem
              key={type}
              value={type}
              className={cn(
                "border border-border/50 rounded-lg bg-card/40 px-0",
                items.length === 0 && "opacity-70"
              )}
            >
              <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/30 rounded-lg group">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className={cn("p-1.5 rounded-md shrink-0", meta.bg)}>
                    <Icon className={cn("h-3.5 w-3.5", meta.tone)} />
                  </div>
                  <span className="text-sm font-medium text-foreground/90 text-left">
                    {meta.label}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] h-4 px-1.5 ml-auto mr-2"
                  >
                    {items.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pt-0 pb-3 space-y-1.5">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic px-1 py-2">
                    Nenhuma solicitação registrada.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/30 -mx-1">
                    {items.map((doc) => (
                      <TimelineRow
                        key={`${doc.source}-${doc.id}`}
                        doc={doc}
                        onOpen={onOpenDoc}
                        onPrint={onPrintDoc}
                        compact
                      />
                    ))}
                  </ul>
                )}
                {onNewByType && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs gap-1.5 mt-2"
                    onClick={() => onNewByType(type)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nova solicitação de {meta.shortLabel.toLowerCase()}
                  </Button>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function TimelineRow({
  doc,
  onOpen,
  onPrint,
  compact,
}: {
  doc: PatientDocument;
  onOpen?: (d: PatientDocument) => void;
  onPrint?: (d: PatientDocument) => void;
  compact?: boolean;
}) {
  const meta = DOCUMENT_TYPE_META[doc.type];
  const Icon = TYPE_ICON[doc.type];
  const status = STATUS_BADGE[doc.status];
  return (
    <li className={cn("flex items-center gap-3 px-3 py-2 group transition-colors", onOpen && "hover:bg-muted/40 cursor-pointer")}>
      {!compact && (
        <div className={cn("p-1.5 rounded-md shrink-0", meta.bg)}>
          <Icon className={cn("h-3.5 w-3.5", meta.tone)} />
        </div>
      )}
      <button
        type="button"
        onClick={() => onOpen?.(doc)}
        className="flex-1 min-w-0 text-left"
      >
        <p className="text-xs font-medium text-foreground/90 truncate">{doc.label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {compact ? meta.shortLabel + " · " : ""}
          {formatDate(doc.createdAt)}
          {doc.authorName ? ` · ${doc.authorName}` : ""}
          {doc.patientBed ? ` · ${doc.patientBed}` : ""}
        </p>
      </button>
      <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5 shrink-0", status.cls)}>
        <span className={cn("h-1 w-1 rounded-full mr-1", status.dot)} />
        {status.label}
      </Badge>
      {onPrint && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onPrint(doc);
          }}
          title="Reimprimir"
        >
          <Printer className="h-3.5 w-3.5" />
        </Button>
      )}
    </li>
  );
}
