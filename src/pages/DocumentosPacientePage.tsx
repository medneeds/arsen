import React, { useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ClinicalHeader } from "@/components/ClinicalHeader";
import { PatientCockpit } from "@/components/PatientCockpit";
import { useCockpitPatient } from "@/hooks/useCockpitPatient";
import { useHospital } from "@/contexts/HospitalContext";
import {
  FolderOpen, Droplet, FileCheck, Syringe, FileText,
  Microscope, Plus, FileSignature,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { HemocomponentRequestDialog } from "@/components/HemocomponentRequestDialog";
import { SatRequestDialog } from "@/components/SatRequestDialog";
import { CultureRequestDialog } from "@/components/CultureRequestDialog";
import {
  PatientDocumentsPanel,
} from "@/components/PatientDocumentsPanel";
import {
  usePatientDocuments,
  type DocumentType,
  type PatientDocument,
} from "@/hooks/usePatientDocuments";

const DocumentosPacientePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentHospital, currentState } = useHospital();

  const patientId = searchParams.get("patientId") || "";
  const patientName = searchParams.get("patientName") || "";
  const patientBed = searchParams.get("patientBed") || "";
  const patientSector = searchParams.get("patientSector") || "";
  const hasPatient = !!patientName;

  const cockpitPatient = useCockpitPatient();
  const { docs, loading } = usePatientDocuments({
    patientId,
    patientName,
    hospitalUnitId: currentHospital?.id,
    stateId: currentState?.id,
    realtime: true,
  });

  const [hemoOpen, setHemoOpen] = useState(false);
  const [satOpen, setSatOpen] = useState(false);
  const [cultureOpen, setCultureOpen] = useState(false);

  const handleNewByType = useCallback(
    (type: DocumentType) => {
      const params = new URLSearchParams(searchParams);
      switch (type) {
        case "hemoderivado":
          setHemoOpen(true);
          break;
        case "sat":
          setSatOpen(true);
          break;
        case "cultura":
          setCultureOpen(true);
          break;
        case "apac":
          navigate(`/requisicoes?${params.toString()}&especial=apac`);
          break;
        case "lab":
        case "imagem":
        case "parecer":
          navigate(`/requisicoes?${params.toString()}&categoria=${type === "lab" ? "laboratorio" : type}`);
          break;
        case "evolucao":
          navigate(`/evolucao?${params.toString()}`);
          break;
        case "round":
          navigate(`/round?${params.toString()}`);
          break;
        case "aih":
          // AIH é gerada no fluxo de internação, não como requisição avulsa
          toast.info("Laudo de AIH é gerado no fluxo de internação — abra o status da admissão do paciente");
          break;
      }
    },
    [navigate, searchParams]
  );

  const handleOpenDoc = useCallback((doc: PatientDocument) => {
    // Roteia para a página apropriada com base na origem
    if (doc.source === "exam_requests") {
      const params = new URLSearchParams(searchParams);
      navigate(`/requisicoes?${params.toString()}`);
    } else if (doc.source === "culture_results") {
      const params = new URLSearchParams(searchParams);
      navigate(`/requisicoes?${params.toString()}&especial=cultura`);
    } else if (doc.source === "clinical_evolutions") {
      const params = new URLSearchParams(searchParams);
      navigate(`/evolucao?${params.toString()}`);
    }
  }, [navigate, searchParams]);

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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                <FolderOpen className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground leading-tight">Documentos do paciente</h1>
                <p className="text-xs text-muted-foreground">
                  Solicitações, requisições e documentos clínicos vinculados
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[11px]">
              {docs.length} no total
            </Badge>
          </div>

          {/* Quick CTAs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <QuickCta
              icon={Droplet}
              label="Hemocomponentes"
              tone="text-rose-600 dark:text-rose-400"
              bg="bg-rose-500/10"
              onClick={() => setHemoOpen(true)}
            />
            <QuickCta
              icon={Microscope}
              label="Cultura"
              tone="text-emerald-600 dark:text-emerald-400"
              bg="bg-emerald-500/10"
              onClick={() => handleNewByType("cultura")}
            />
            <QuickCta
              icon={FileCheck}
              label="APAC"
              tone="text-orange-600 dark:text-orange-400"
              bg="bg-orange-500/10"
              onClick={() => handleNewByType("apac")}
            />
            <QuickCta
              icon={Syringe}
              label="SAT"
              tone="text-amber-600 dark:text-amber-400"
              bg="bg-amber-500/10"
              onClick={() => setSatOpen(true)}
            />
            <QuickCta
              icon={FileText}
              label="AIH"
              tone="text-indigo-600 dark:text-indigo-400"
              bg="bg-indigo-500/10"
              badge="via internação"
              onClick={() => handleNewByType("aih")}
            />
          </div>

          {/* Painel unificado: timeline + acordeões */}
          <PatientDocumentsPanel
            docs={docs}
            loading={loading}
            onNewByType={handleNewByType}
            onOpenDoc={handleOpenDoc}
          />
        </div>

        {/* Patient Cockpit — fixed right sidebar */}
        <PatientCockpit patient={cockpitPatient} />
      </div>

      {/* Dialog: Solicitação de Hemocomponentes */}
      <HemocomponentRequestDialog
        open={hemoOpen}
        onOpenChange={setHemoOpen}
        patientId={patientId || null}
        patientName={patientName}
        patientBed={patientBed}
        patientSector={patientSector}
      />

      {/* Dialog: Solicitação de SAT / IGHAT */}
      <SatRequestDialog
        open={satOpen}
        onOpenChange={setSatOpen}
        patientId={patientId || null}
        patientName={patientName}
        patientBed={patientBed}
        patientSector={patientSector}
      />

      {/* Dialog: Solicitação de Cultura (microbiológica) */}
      <CultureRequestDialog
        open={cultureOpen}
        onOpenChange={setCultureOpen}
        patientId={patientId || null}
        patientName={patientName}
        patientBed={patientBed}
        patientSector={patientSector}
      />
    </div>
  );
};

function QuickCta({
  icon: Icon,
  label,
  tone,
  bg,
  badge,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  tone: string;
  bg: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex items-center gap-2 p-2.5 rounded-lg border border-border/60 bg-card/50 hover:bg-muted/50 hover:border-border transition-all text-left"
    >
      <div className={`p-1.5 rounded-md ${bg}`}>
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground/90 truncate">{label}</p>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Plus className="h-2.5 w-2.5" /> Nova solicitação
        </p>
      </div>
      {badge && (
        <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-muted-foreground border-border">
          {badge}
        </Badge>
      )}
    </button>
  );
}

export default DocumentosPacientePage;
