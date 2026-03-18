import { useState, useMemo } from "react";
import { usePatients } from "@/hooks/usePatients";
import { useDepartment } from "@/contexts/DepartmentContext";
import { Patient } from "@/types/patient";
import { differenceInDays, parseISO } from "date-fns";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Eye, Filter, FileText, Pill, Activity, ClipboardList, FolderOpen } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

// Helpers
const calcDaysInternment = (admissionDate: string): number | null => {
  if (!admissionDate) return null;
  try {
    const date = parseISO(admissionDate);
    if (isNaN(date.getTime())) return null;
    return differenceInDays(new Date(), date);
  } catch {
    return null;
  }
};

const getSectorLabel = (sector: string) => {
  const map: Record<string, string> = { red: "Vermelho", yellow: "Amarelo", blue: "Azul", outside: "Externo" };
  return map[sector] || sector;
};

const getSectorColor = (sector: string) => {
  const map: Record<string, string> = {
    red: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200",
    yellow: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200",
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200",
    outside: "bg-muted text-muted-foreground border-border",
  };
  return map[sector] || "";
};

const getResponsibleDoctor = (patient: Patient): string => {
  const mr = patient.medicalResponsibility;
  if (!mr) return "—";
  if (mr.leaderNames) return mr.leaderNames;
  if (mr.portaNames) return mr.portaNames;
  if (mr.type) {
    const types: Record<string, string> = {
      lider: "Líder", porta: "Porta", conjunto: "Conjunto",
      obstetra: "Obstetra", cirurgiao_geral: "Cirurgião Geral", traumatologista: "Traumatologista",
    };
    return types[mr.type] || mr.type;
  }
  return "—";
};

const getPrescriptionStatus = (patient: Patient): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } => {
  // Simple check: if patient has schedule items, consider it active
  if (patient.schedule && patient.schedule.length > 0) {
    return { label: "Ativa", variant: "default" };
  }
  return { label: "Pendente", variant: "secondary" };
};

const getDischargeText = (patient: Patient): string => {
  if (patient.utiDischargePrediction && patient.utiDischargePrediction.length > 0) {
    return patient.utiDischargePrediction[0];
  }
  return "Sem previsão";
};

// Documents list
const DOCUMENTS = [
  { group: "Hemoderivados", items: [
    { name: "Ato Transfusional", path: "/documents/hemoderivados/hemoc-ato-sadt.pdf" },
    { name: "Hemoconcentrados SADT", path: "/documents/hemoderivados/hemoc-concentrados-sadt.pdf" },
    { name: "Exames SADT", path: "/documents/hemoderivados/hemoc-exames-sadt.pdf" },
    { name: "Solicitação Hemoconcentrados", path: "/documents/hemoderivados/solicitacao-hemoconcentrados.pdf" },
    { name: "Termo Hemotransfusão", path: "/documents/hemoderivados/termo-esclarecimento-hemotransfusao.pdf" },
  ]},
  { group: "OPME", items: [
    { name: "Angiografia Cerebral", path: "/documents/opme/angiografia-cerebral.doc" },
    { name: "ATC/CATE", path: "/documents/opme/atc-cate.doc" },
    { name: "Cateterismo", path: "/documents/opme/cateterismo.doc" },
    { name: "Gastrostomia", path: "/documents/opme/gastrostomia-endoscopica.doc" },
    { name: "Implante Permcath", path: "/documents/opme/implante-permcath.odt" },
    { name: "Trombectomia Mecânica", path: "/documents/opme/trombectomia-mecanica.doc" },
  ]},
  { group: "SADT", items: [
    { name: "Guia SP/SADT", path: "/documents/sadt/hapvida-guia-sp-sadt.pdf" },
    { name: "Guia SP/SADT Paisagem", path: "/documents/sadt/hapvida-guia-sp-sadt-paisagem.pdf" },
  ]},
  { group: "Tomografias", items: [
    { name: "Ficha Acompanhamento TC", path: "/documents/tomografias/ficha-acompanhamento-tc.pdf" },
    { name: "Termo Consentimento TC", path: "/documents/tomografias/termo-consentimento-tc.pdf" },
    { name: "Termo Gestante", path: "/documents/tomografias/termo-consentimento-gestante.pdf" },
  ]},
  { group: "Protocolos", items: [
    { name: "Protocolo Sepse Adulto", path: "/documents/protocolo-sepse-adulto.pdf" },
    { name: "Controle Glicêmico", path: "/documents/protocolo-controle-glicemico.pdf" },
    { name: "Termo Cuidados Paliativos", path: "/documents/termo-cuidados-paliativos.docx" },
  ]},
  { group: "Regulações SUS", items: [
    { name: "Modelo Anamnese Regulação", path: "/documents/regulacoes-sus/modelo-anamnese-regulacao.pdf" },
  ]},
  { group: "Alto Custo", items: [
    { name: "Alteplase AVEI", path: "/documents/alto-custo/alteplase-avei.odt" },
    { name: "Ciclofosfamida", path: "/documents/alto-custo/ciclofosfamida.odt" },
    { name: "Ertapenem", path: "/documents/alto-custo/ertapenem.odt" },
    { name: "Imunoglobulina Humana", path: "/documents/alto-custo/imunoglobulina-humana.odt" },
    { name: "Teicoplanina", path: "/documents/alto-custo/teicoplanina.odt" },
  ]},
];

export default function PainelClinicoPage() {
  const { currentDepartment } = useDepartment();
  const { patients, isLoading } = usePatients(currentDepartment);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [sidebarTab, setSidebarTab] = useState("resumo");

  // Filter out vacant beds and apply search/sector filter
  const filteredPatients = useMemo(() => {
    return patients
      .filter(p => !p.isVacant && p.name && p.name.trim() !== "")
      .filter(p => sectorFilter === "all" || p.sector === sectorFilter)
      .filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.bedNumber.toLowerCase().includes(q) ||
          p.diagnoses.some(d => d.toLowerCase().includes(q))
        );
      });
  }, [patients, search, sectorFilter]);

  const openPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setSidebarTab("resumo");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Painel Clínico
            </h1>
            <p className="text-sm text-muted-foreground">Prontuário e gestão integrada de pacientes</p>
          </div>
          <Badge variant="outline" className="text-sm">
            {filteredPatients.length} paciente{filteredPatients.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, leito ou diagnóstico..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              <SelectItem value="red">Vermelho</SelectItem>
              <SelectItem value="yellow">Amarelo</SelectItem>
              <SelectItem value="blue">Azul</SelectItem>
              <SelectItem value="outside">Externo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              Carregando pacientes...
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
              <ClipboardList className="h-10 w-10 opacity-30" />
              <p>Nenhum paciente encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-24">Leito</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead className="w-48">Pendências</TableHead>
                  <TableHead className="w-28 text-center">Prescrição</TableHead>
                  <TableHead className="w-24 text-center">Dias Int.</TableHead>
                  <TableHead className="w-36">Previsão Alta</TableHead>
                  <TableHead className="w-40">Médico Resp.</TableHead>
                  <TableHead className="w-20 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map(patient => {
                  const days = calcDaysInternment(patient.admissionDate);
                  const prescStatus = getPrescriptionStatus(patient);
                  const pendencies = patient.pendencies.filter(p => p.trim());
                  
                  return (
                    <TableRow
                      key={patient.id}
                      className="cursor-pointer group hover:bg-accent/50 transition-colors"
                      onClick={() => openPatient(patient)}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-mono font-bold text-foreground">{patient.bedNumber}</span>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getSectorColor(patient.sector))}>
                            {getSectorLabel(patient.sector)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground leading-tight">{patient.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {patient.age ? `${patient.age} anos` : "—"}
                          </p>
                          {patient.diagnoses.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1 max-w-[200px]">
                              {patient.diagnoses[0]}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {pendencies.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {pendencies.slice(0, 2).map((p, i) => (
                              <span key={i} className="text-xs text-muted-foreground line-clamp-1">{p}</span>
                            ))}
                            {pendencies.length > 2 && (
                              <span className="text-[10px] text-primary">+{pendencies.length - 2} mais</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={prescStatus.variant} className="text-[11px]">
                          {prescStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn("font-mono font-bold text-sm", days !== null && days > 7 ? "text-destructive" : "text-foreground")}>
                          {days !== null ? days : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{getDischargeText(patient)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-foreground">{getResponsibleDoctor(patient)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); openPatient(patient); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </ScrollArea>

      {/* Patient Sidebar Sheet */}
      <Sheet open={!!selectedPatient} onOpenChange={(open) => !open && setSelectedPatient(null)}>
        <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col" side="right">
          {selectedPatient && (
            <>
              {/* Sidebar Header */}
              <div className="px-4 py-3 border-b bg-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-lg text-foreground leading-tight">{selectedPatient.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Leito {selectedPatient.bedNumber} • {selectedPatient.age ? `${selectedPatient.age} anos` : ""} • {getSectorLabel(selectedPatient.sector)}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("text-xs", getSectorColor(selectedPatient.sector))}>
                    {getSectorLabel(selectedPatient.sector)}
                  </Badge>
                </div>
                {selectedPatient.clinicalStatus && (
                  <Badge variant="secondary" className="mt-2 text-xs capitalize">
                    {selectedPatient.clinicalStatus.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>

              {/* Tabs */}
              <Tabs value={sidebarTab} onValueChange={setSidebarTab} className="flex-1 flex flex-col min-h-0">
                <div className="px-4 pt-2 border-b bg-card">
                  <TabsList className="w-full grid grid-cols-5 h-9">
                    <TabsTrigger value="resumo" className="text-xs px-1">
                      <Activity className="h-3 w-3 mr-1" /> Resumo
                    </TabsTrigger>
                    <TabsTrigger value="prescricao" className="text-xs px-1">
                      <Pill className="h-3 w-3 mr-1" /> Prescrição
                    </TabsTrigger>
                    <TabsTrigger value="evolucao" className="text-xs px-1">
                      <FileText className="h-3 w-3 mr-1" /> Evolução
                    </TabsTrigger>
                    <TabsTrigger value="requisicoes" className="text-xs px-1">
                      <ClipboardList className="h-3 w-3 mr-1" /> Exames
                    </TabsTrigger>
                    <TabsTrigger value="documentos" className="text-xs px-1">
                      <FolderOpen className="h-3 w-3 mr-1" /> Docs
                    </TabsTrigger>
                  </TabsList>
                </div>

                <ScrollArea className="flex-1">
                  {/* RESUMO */}
                  <TabsContent value="resumo" className="p-4 space-y-4 mt-0">
                    <Section title="Hipóteses / Diagnósticos">
                      {selectedPatient.diagnoses.length > 0
                        ? selectedPatient.diagnoses.map((d, i) => <li key={i} className="text-sm text-foreground">{d}</li>)
                        : <p className="text-sm text-muted-foreground italic">Nenhum diagnóstico registrado</p>
                      }
                    </Section>
                    <Section title="Antecedentes / Comorbidades">
                      {selectedPatient.medicalHistory.length > 0
                        ? selectedPatient.medicalHistory.map((h, i) => <li key={i} className="text-sm text-foreground">{h}</li>)
                        : <p className="text-sm text-muted-foreground italic">Nenhum antecedente registrado</p>
                      }
                    </Section>
                    <Section title="Exames Relevantes">
                      {selectedPatient.relevantExams.length > 0
                        ? selectedPatient.relevantExams.map((e, i) => <li key={i} className="text-sm text-foreground">{e}</li>)
                        : <p className="text-sm text-muted-foreground italic">Nenhum exame registrado</p>
                      }
                    </Section>
                    <Section title="Plano Terapêutico / Condutas">
                      {selectedPatient.schedule.length > 0
                        ? selectedPatient.schedule.map((s, i) => <li key={i} className="text-sm text-foreground">{s}</li>)
                        : <p className="text-sm text-muted-foreground italic">Nenhuma conduta registrada</p>
                      }
                    </Section>
                    <Section title="Programações / Pendências">
                      {selectedPatient.pendencies.length > 0
                        ? selectedPatient.pendencies.map((p, i) => <li key={i} className="text-sm text-foreground">{p}</li>)
                        : <p className="text-sm text-muted-foreground italic">Nenhuma pendência</p>
                      }
                    </Section>
                    {selectedPatient.admissionHistory && (
                      <Section title="História Admissional">
                        <p className="text-sm text-foreground whitespace-pre-wrap">{selectedPatient.admissionHistory}</p>
                      </Section>
                    )}
                  </TabsContent>

                  {/* PRESCRIÇÃO */}
                  <TabsContent value="prescricao" className="p-4 mt-0">
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Acesse o módulo de prescrição com os dados deste paciente pré-preenchidos.
                      </p>
                      <Button
                        className="w-full"
                        onClick={() => navigate(`/prescricao?patientId=${selectedPatient.id}&patientName=${encodeURIComponent(selectedPatient.name)}&patientBed=${encodeURIComponent(selectedPatient.bedNumber)}&patientSector=${encodeURIComponent(selectedPatient.sector)}`)}
                      >
                        <Pill className="h-4 w-4 mr-2" />
                        Abrir Prescrição
                      </Button>
                    </div>
                  </TabsContent>

                  {/* EVOLUÇÃO */}
                  <TabsContent value="evolucao" className="p-4 mt-0">
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Acesse o módulo de evolução clínica com os dados deste paciente pré-preenchidos.
                      </p>
                      <Button
                        className="w-full"
                        onClick={() => navigate(`/evolucao?patientId=${selectedPatient.id}&patientName=${encodeURIComponent(selectedPatient.name)}&patientBed=${encodeURIComponent(selectedPatient.bedNumber)}&patientSector=${encodeURIComponent(selectedPatient.sector)}`)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Abrir Evolução
                      </Button>
                    </div>
                  </TabsContent>

                  {/* REQUISIÇÕES */}
                  <TabsContent value="requisicoes" className="p-4 mt-0">
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Solicite exames laboratoriais, de imagem ou pareceres médicos vinculados a este paciente.
                      </p>
                      <Button
                        className="w-full"
                        onClick={() => navigate(`/requisicoes?patientId=${selectedPatient.id}&patientName=${encodeURIComponent(selectedPatient.name)}&patientBed=${encodeURIComponent(selectedPatient.bedNumber)}&patientSector=${encodeURIComponent(selectedPatient.sector)}`)}
                      >
                        <ClipboardList className="h-4 w-4 mr-2" />
                        Abrir Requisições
                      </Button>
                    </div>
                  </TabsContent>

                  {/* DOCUMENTOS */}
                  <TabsContent value="documentos" className="p-4 mt-0">
                    <p className="text-sm text-muted-foreground mb-4">
                      Documentos institucionais disponíveis para <strong>{selectedPatient.name}</strong> — Leito {selectedPatient.bedNumber}.
                    </p>
                    <div className="space-y-4">
                      {DOCUMENTS.map((group) => (
                        <div key={group.group}>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.group}</p>
                          <div className="space-y-1">
                            {group.items.map((doc) => (
                              <a
                                key={doc.path}
                                href={doc.path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent/50 text-sm text-foreground transition-colors"
                              >
                                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                {doc.name}
                              </a>
                            ))}
                          </div>
                          <Separator className="mt-3" />
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Helper component
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{title}</h3>
      <ul className="space-y-0.5 list-disc list-inside">{children}</ul>
    </div>
  );
}
