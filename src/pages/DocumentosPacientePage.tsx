import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ClinicalHeader } from "@/components/ClinicalHeader";

import { PatientCockpit } from "@/components/PatientCockpit";
import { useCockpitPatient } from "@/hooks/useCockpitPatient";
import {
  FolderOpen, ClipboardList, Droplet, FileCheck, Radar,
  DollarSign, Scissors, ScanLine, NotebookPen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getSectorDisplayLabel } from "@/utils/bedNaming";

interface DocModule {
  id: string;
  label: string;
  description: string;
  icon: typeof FolderOpen;
  status: "disponivel" | "em-breve";
}

const DOC_MODULES: DocModule[] = [
  { id: "round", label: "Round multiprofissional", description: "Checklist diário por equipe multidisciplinar", icon: ClipboardList, status: "disponivel" },
  { id: "hemoderivados", label: "Hemoderivados", description: "Solicitação de hemocomponentes e hemoderivados", icon: Droplet, status: "em-breve" },
  { id: "regulacoes", label: "Regulações", description: "Solicitação de vagas e regulação de leitos", icon: Radar, status: "em-breve" },
  { id: "opme", label: "OPME", description: "Órteses, próteses e materiais especiais", icon: Scissors, status: "em-breve" },
  { id: "alto-custo", label: "Alto custo", description: "Medicamentos e procedimentos de alto custo", icon: DollarSign, status: "em-breve" },
  { id: "sadt", label: "SADT", description: "Serviço auxiliar de diagnóstico e terapia", icon: ScanLine, status: "em-breve" },
  { id: "guias", label: "Guias especiais", description: "AIH, APAC e guias de autorização", icon: FileCheck, status: "em-breve" },
  { id: "evolucao-multi", label: "Evolução multiprofissional", description: "Registro de evolução por categoria profissional", icon: NotebookPen, status: "em-breve" },
];

const DocumentosPacientePage = () => {
  const [searchParams] = useSearchParams();
  const patientName = searchParams.get("patientName") || "";
  const patientBed = searchParams.get("patientBed") || "";
  const patientSector = searchParams.get("patientSector") || "";
  const hasPatient = !!patientName;

  const sectorLabel = getSectorDisplayLabel(patientSector);

  const cockpitPatient = useCockpitPatient();
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  if (!hasPatient) {
    return (
      <div>
        <ClinicalHeader moduleLabel="Documentos" />
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
              <FolderOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground leading-tight">Documentos</h1>
              <p className="text-xs text-muted-foreground">Selecione um paciente pelo mapa de leitos ou painel clínico</p>
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium text-muted-foreground">Nenhum paciente selecionado</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Acesse pela sidebar do paciente ou painel clínico</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ClinicalHeader moduleLabel="Documentos" />
      <div className="flex print:block">
        <div className="flex-1 min-w-0 p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
              <FolderOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground leading-tight">Documentos</h1>
              <p className="text-xs text-muted-foreground">Documentos clínicos vinculados ao paciente</p>
            </div>
          </div>

          {/* Identificação completa do paciente vive no cockpit à direita.
              Prontuário e Atendimento aparecem direto, com "Ver mais" para o registro completo. */}

          {/* Document Modules Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DOC_MODULES.map(mod => {
              const Icon = mod.icon;
              const isAvailable = mod.status === "disponivel";
              const isSelected = selectedModule === mod.id;
              return (
                <button
                  key={mod.id}
                  onClick={() => isAvailable && setSelectedModule(isSelected ? null : mod.id)}
                  disabled={!isAvailable}
                  className={cn(
                    "text-left p-4 rounded-xl border transition-all duration-200",
                    isAvailable
                      ? isSelected
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                        : "border-border hover:bg-muted/50 hover:border-border hover:shadow-sm cursor-pointer"
                      : "border-border/50 opacity-60 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-lg shrink-0",
                      isSelected ? "bg-primary/15" : "bg-muted"
                    )}>
                      <Icon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm font-semibold", isSelected ? "text-foreground" : "text-foreground/80")}>{mod.label}</p>
                        {!isAvailable && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-muted-foreground border-border">
                            Em breve
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{mod.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Module Placeholder */}
          {selectedModule && (
            <div className="rounded-xl border border-primary/20 bg-card p-6">
              <p className="text-sm text-muted-foreground text-center">
                Módulo <span className="font-semibold text-foreground">{DOC_MODULES.find(m => m.id === selectedModule)?.label}</span> será implementado em breve.
              </p>
            </div>
          )}
        </div>

        {/* Patient Cockpit — fixed right sidebar */}
        <PatientCockpit patient={cockpitPatient} />
      </div>
    </div>
  );
};

export default DocumentosPacientePage;
