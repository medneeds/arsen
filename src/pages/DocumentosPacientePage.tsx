import React, { useState, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClinicalHeader } from "@/components/ClinicalHeader";
import { PatientIdentityBar } from "@/components/PatientIdentityBar";
import { PatientCockpit } from "@/components/PatientCockpit";
import { useCockpitPatient } from "@/hooks/useCockpitPatient";
import { useHospital } from "@/contexts/HospitalContext";
import {
  FolderOpen, Droplet, FileCheck, Syringe, FileText,
  Microscope, Plus, FileSignature, Scissors,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { HemocomponentRequestDialog } from "@/components/HemocomponentRequestDialog";
import { SatRequestDialog } from "@/components/SatRequestDialog";
import { CultureRequestDialog } from "@/components/CultureRequestDialog";
import { MedicalDocumentDialog } from "@/components/MedicalDocumentDialog";
import { BoletimCirurgicoDialog } from "@/components/BoletimCirurgicoDialog";
import {
  PatientDocumentsPanel,
} from "@/components/PatientDocumentsPanel";
import {
  usePatientDocuments,
  type DocumentType,
  type PatientDocument,
} from "@/hooks/usePatientDocuments";
import { printReceituario, type ReceituarioData } from "@/lib/receituario";
import { printDocumentoMedico } from "@/lib/documentoMedico";
import type { DocumentoMedicoData } from "@/hooks/useDocumentoMedico";
import { printBoletimCirurgico } from "@/lib/boletimCirurgico";

// AUTORIA: linha minima de profissionais (id -> nome/CRM), sem `any`. CRM vive
// em numero_conselho; o alias PostgREST (crm:numero_conselho) mantem o campo
// `crm` no view-model.
interface ProfissionalLite {
  id: string;
  nome: string | null;
  crm: string | null;
}

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

  // ── AUTORIA: resolve o assinante dos documentos sem nome embutido ──
  // Documentos medicos (altas) guardam o assinante em assinado_por (FK
  // profissionais). Quando o nome nao vem embutido no conteudo (signed_by_name),
  // resolvemos id -> nome/CRM em lote. Receituarios ja trazem nome/CRM embutidos.
  const assinanteIds = useMemo(() => {
    const s = new Set<string>();
    docs.forEach((d) => {
      if (d.authorName) return; // ja tem nome embutido — nao precisa resolver
      const assinadoPor = (d.raw as { assinado_por?: string | null } | null)?.assinado_por;
      if (assinadoPor) s.add(assinadoPor);
    });
    return [...s];
  }, [docs]);

  const { data: assinantesMap = new Map<string, ProfissionalLite>() } = useQuery({
    queryKey: ["documentos-assinantes", assinanteIds],
    enabled: assinanteIds.length > 0,
    queryFn: async (): Promise<Map<string, ProfissionalLite>> => {
      const { data } = await supabase
        .from("profissionais")
        .select("id, nome, crm:numero_conselho")
        .in("id", assinanteIds);
      const m = new Map<string, ProfissionalLite>();
      ((data ?? []) as unknown as ProfissionalLite[]).forEach((r) => m.set(r.id, r));
      return m;
    },
  });

  // Injeta authorName/authorCrm resolvidos nos documentos sem nome embutido,
  // preservando o nome/CRM embutido quando houver. So apresentacao.
  const docsComAssinante = useMemo(() => {
    if (assinantesMap.size === 0) return docs;
    return docs.map((d) => {
      if (d.authorName) return d;
      const assinadoPor = (d.raw as { assinado_por?: string | null } | null)?.assinado_por;
      const prof = assinadoPor ? assinantesMap.get(assinadoPor) : undefined;
      if (!prof) return d;
      return { ...d, authorName: prof.nome ?? null, authorCrm: d.authorCrm ?? prof.crm ?? null };
    });
  }, [docs, assinantesMap]);

  const [hemoOpen, setHemoOpen] = useState(false);
  const [satOpen, setSatOpen] = useState(false);
  const [cultureOpen, setCultureOpen] = useState(false);
  const [medDocOpen, setMedDocOpen] = useState(false);
  const [boletimOpen, setBoletimOpen] = useState(false);

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
        case "receituario":
          setMedDocOpen(true);
          break;
        case "documento_medico":
          setMedDocOpen(true);
          break;
        case "boletim_cirurgico":
          setBoletimOpen(true);
          break;
      }
    },
    [navigate, searchParams]
  );

  const handlePrintDoc = useCallback(async (doc: PatientDocument) => {
    if (doc.source === "receituarios") {
      await printReceituario(doc.raw as ReceituarioData, currentHospital?.name);
    } else if (doc.source === "documentos_medicos") {
      await printDocumentoMedico(doc.raw as DocumentoMedicoData, { hospitalName: currentHospital?.name });
    } else if (doc.source === "boletim_cirurgico") {
      // raw e a linha crua de altas — printBoletimCirurgico mapeia internamente.
      await printBoletimCirurgico(doc.raw, { hospitalName: currentHospital?.name });
    }
  }, [currentHospital]);

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
    } else if (doc.source === "receituarios") {
      // Receituário não tem tela de detalhe própria — abrir = reimprimir,
      // já que o documento em si é a única representação que existe.
      printReceituario(doc.raw as ReceituarioData, currentHospital?.name);
    } else if (doc.source === "documentos_medicos") {
      printDocumentoMedico(doc.raw as DocumentoMedicoData, { hospitalName: currentHospital?.name });
    } else if (doc.source === "boletim_cirurgico") {
      // Boletim nao tem tela de detalhe propria — abrir = reimprimir.
      printBoletimCirurgico(doc.raw, { hospitalName: currentHospital?.name });
    }
  }, [navigate, searchParams, currentHospital]);

  if (!hasPatient) {
    return (
      <div>
        <ClinicalHeader moduleLabel="Documentos" />
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/15 border border-primary/10">
              <FolderOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-medium text-foreground leading-tight">Documentos</h1>
              <p className="text-xs text-muted-foreground">Selecione um paciente pelo mapa de leitos ou painel clínico</p>
            </div>
          </div>
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
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
          {/* Title — sub-cabecalho padrao de identidade (setor resolvido via
              usePatientLive) + acoes do modulo a direita. */}
          <div className="flex items-center justify-between gap-3">
            <PatientIdentityBar
              patientId={patientId}
              className="print:hidden rounded-lg border border-border bg-card/60 px-3 py-3 flex-1"
              rightSlot={
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground leading-tight">DOCUMENTOS DO PACIENTE</p>
                  <p className="text-xs text-muted-foreground mt-1">Documentos clínicos vinculados</p>
                </>
              }
            />
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs">
                {docs.length} no total
              </Badge>
              <Button
                type="button"
                size="sm"
                onClick={() => setMedDocOpen(true)}
                className="gap-2 bg-primary hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-sm normal-case"
              >
                <FileSignature className="h-4 w-4" />
                Emitir documento médico
              </Button>
            </div>
          </div>

          {/* Quick CTAs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <QuickCta
              icon={Droplet}
              label="Hemocomponentes"
              tone="text-critical-on-soft"
              bg="bg-critical/10"
              onClick={() => setHemoOpen(true)}
            />
            <QuickCta
              icon={Microscope}
              label="Cultura"
              tone="text-released-on-soft"
              bg="bg-released/10"
              onClick={() => handleNewByType("cultura")}
            />
            <QuickCta
              icon={FileCheck}
              label="APAC"
              tone="text-warning-on-soft"
              bg="bg-warning/10"
              onClick={() => handleNewByType("apac")}
            />
            <QuickCta
              icon={Syringe}
              label="SAT"
              tone="text-warning-on-soft"
              bg="bg-warning/10"
              onClick={() => setSatOpen(true)}
            />
            <QuickCta
              icon={FileText}
              label="AIH"
              tone="text-foreground"
              bg="bg-primary/10"
              badge="via internação"
              onClick={() => handleNewByType("aih")}
            />
            <QuickCta
              icon={Scissors}
              label="Boletim cirúrgico"
              tone="text-fuchsia-600 dark:text-fuchsia-400"
              bg="bg-fuchsia-500/10"
              onClick={() => setBoletimOpen(true)}
            />
          </div>

          {/* Painel unificado: timeline + acordeões */}
          <PatientDocumentsPanel
            docs={docsComAssinante}
            loading={loading}
            onNewByType={handleNewByType}
            onOpenDoc={handleOpenDoc}
            onPrintDoc={handlePrintDoc}
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

      {/* Dialog: Emissão de documentos médicos (atestado, relatório, termo, receituário) */}
      <MedicalDocumentDialog
        open={medDocOpen}
        onOpenChange={setMedDocOpen}
        patientId={patientId || null}
        patientName={patientName}
        patientBed={patientBed}
        patientSector={patientSector}
        hospitalName={currentHospital?.name}
      />

      {/* Dialog: Boletim Cirúrgico (documento médico em altas, tipo boletim_cirurgico) */}
      <BoletimCirurgicoDialog
        open={boletimOpen}
        onOpenChange={setBoletimOpen}
        patientId={patientId || null}
        patientName={patientName}
        patientBed={patientBed}
        patientSector={patientSector}
        hospitalName={currentHospital?.name}
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
      className="group relative flex items-center gap-2 p-3 rounded-lg border border-border/60 bg-card/50 hover:bg-muted/50 hover:border-border transition-all text-left"
    >
      <div className={`p-2 rounded-md ${bg}`}>
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground/90 truncate">{label}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Plus className="h-2.5 w-2.5" /> Nova solicitação
        </p>
      </div>
      {badge && (
        <Badge variant="outline" className="text-xs h-4 px-2 text-muted-foreground border-border">
          {badge}
        </Badge>
      )}
    </button>
  );
}

export default DocumentosPacientePage;
