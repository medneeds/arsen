import { useState, useEffect } from "react";
import { Plus, FileText, Database, Import, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatAge } from "@/lib/patientAge";
import { useNavigate, useSearchParams } from "react-router-dom";
import NotesTab from "@/components/resources/NotesTab";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface Patient {
  id: string;
  name: string;
  bed_number: string;
  sector: string;
  age: string | null;
  admission_history: string | null;
  diagnoses: string | null;
}

const ResourcesPage = () => {
  const { user } = useAuth();
  const { currentDepartment } = useDepartment();
  const { currentHospital } = useHospital();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);
  const [savedRequestInfo, setSavedRequestInfo] = useState<{
    patientName: string;
    destination: string;
  } | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");

  // Form state
  const [formData, setFormData] = useState({
    content: "",
    destination: "",
  });

  useEffect(() => {
    loadPatients();
  }, [currentHospital]);

  useEffect(() => {
    const patientId = searchParams.get('patientId');
    if (patientId && patients.length > 0 && !selectedPatient) {
      const patient = patients.find(p => p.id === patientId);
      if (patient) {
        setSelectedPatient(patientId);
        setIsSaveDialogOpen(true);
      }
    }
  }, [searchParams, patients, selectedPatient]);

  // MIGRAÇÃO: patients→internacoes(+pacientes,+leitos,+setores). internacoes não
  // tem coluna `department` → o filtro por departamento foi REMOVIDO; o escopo
  // passa a ser por hospital via leito→setor→ala.hospital_id (padrão usePatients).
  // Internação ativa = data_alta IS NULL. Colunas: name←paciente.nome_social||
  // nome_completo, bed_number←leito.numero, sector←setor.tipo (código),
  // age←formatAge(paciente.data_nascimento) (patient_registry morto),
  // admission_history←historia_clinica (anamnese), diagnoses←hipotese_diagnostica.
  const loadPatients = async () => {
    if (!currentHospital) return;
    const { data, error } = await (supabase
      .from("internacoes")
      .select(`
        id, historia_clinica, hipotese_diagnostica, data_alta,
        paciente:pacientes ( nome_completo, nome_social, data_nascimento ),
        leito:leitos!inner ( numero, setor:setores!inner ( tipo, ala:alas!inner ( hospital_id ) ) )
      `) as any)
      .is("data_alta", null)
      .eq("leito.setor.ala.hospital_id", currentHospital.id);

    if (error) {
      if (import.meta.env.DEV) {
        console.error("Erro ao carregar pacientes:", error);
      }
      return;
    }

    const rows = (data || []) as any[];
    const mapped: Patient[] = rows.map((r) => ({
      id: r.id,
      name: (r.paciente?.nome_social || r.paciente?.nome_completo || "").toString(),
      bed_number: (r.leito?.numero ?? "").toString(),
      sector: r.leito?.setor?.tipo ?? "",
      age: formatAge(r.paciente?.data_nascimento) || null,
      admission_history: r.historia_clinica ?? null,
      diagnoses: r.hipotese_diagnostica ?? null,
    }));
    mapped.sort(
      (a, b) =>
        (a.sector || "").localeCompare(b.sector || "") ||
        (a.bed_number || "").localeCompare(b.bed_number || "", undefined, { numeric: true }),
    );
    setPatients(mapped);
  };

  const handleImportDiagnoses = () => {
    if (!selectedPatient) {
      toast({
        title: "ERRO",
        description: "SELECIONE UM PACIENTE PRIMEIRO",
        variant: "destructive",
      });
      return;
    }

    const patient = patients.find(p => p.id === selectedPatient);
    if (!patient) {
      toast({
        title: "ERRO",
        description: "PACIENTE NÃO ENCONTRADO",
        variant: "destructive",
      });
      return;
    }

    if (!patient.diagnoses || patient.diagnoses.trim() === "") {
      toast({
        title: "AVISO",
        description: "ESTE PACIENTE NÃO POSSUI HIPÓTESES/DIAGNÓSTICOS REGISTRADOS",
        variant: "destructive",
      });
      return;
    }

    // Parse diagnoses array and join with " | "
    try {
      const diagnosesArray = JSON.parse(patient.diagnoses);
      const diagnosesText = Array.isArray(diagnosesArray) 
        ? diagnosesArray.join(" | ").toUpperCase()
        : patient.diagnoses.toUpperCase();
      
      setFormData({ ...formData, content: diagnosesText + "\n\n" + formData.content });
      toast({
        title: "IMPORTADO",
        description: "HIPÓTESES/DIAGNÓSTICOS IMPORTADOS COM SUCESSO",
      });
    } catch {
      // Se não for JSON válido, usar o texto direto
      setFormData({ ...formData, content: patient.diagnoses.toUpperCase() + "\n\n" + formData.content });
      toast({
        title: "IMPORTADO",
        description: "HIPÓTESES/DIAGNÓSTICOS IMPORTADOS COM SUCESSO",
      });
    }
  };

  const handleImportAdmissionHistory = () => {
    if (!selectedPatient) {
      toast({
        title: "ERRO",
        description: "SELECIONE UM PACIENTE PRIMEIRO",
        variant: "destructive",
      });
      return;
    }

    const patient = patients.find(p => p.id === selectedPatient);
    if (!patient) {
      toast({
        title: "ERRO",
        description: "PACIENTE NÃO ENCONTRADO",
        variant: "destructive",
      });
      return;
    }

    if (!patient.admission_history || patient.admission_history.trim() === "") {
      toast({
        title: "AVISO",
        description: "ESTE PACIENTE NÃO POSSUI HISTÓRIA ADMISSIONAL REGISTRADA",
        variant: "destructive",
      });
      return;
    }

    setFormData({ ...formData, content: patient.admission_history.toUpperCase() });
    toast({
      title: "IMPORTADO",
      description: "HISTÓRIA ADMISSIONAL IMPORTADA COM SUCESSO",
    });
  };

  const handleOpenSaveDialog = () => {
    setSelectedPatient("");
    setFormData({
      content: "",
      destination: "",
    });
    setIsSaveDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedPatient) {
      toast({
        title: "ERRO",
        description: "SELECIONE UM PACIENTE DO MAPA",
        variant: "destructive",
      });
      return;
    }

    if (!formData.destination) {
      toast({
        title: "ERRO",
        description: "SELECIONE O DESTINO DA INTERNAÇÃO",
        variant: "destructive",
      });
      return;
    }

    if (!formData.content.trim()) {
      toast({
        title: "ERRO",
        description: "CONTEÚDO DA SOLICITAÇÃO É OBRIGATÓRIO",
        variant: "destructive",
      });
      return;
    }

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (!currentUser) {
      toast({
        title: "ERRO",
        description: "USUÁRIO NÃO AUTENTICADO",
        variant: "destructive",
      });
      return;
    }

    const patient = patients.find(p => p.id === selectedPatient);
    
    if (!patient) {
      toast({
        title: "ERRO",
        description: "PACIENTE NÃO ENCONTRADO",
        variant: "destructive",
      });
      return;
    }

    if (!currentHospital) {
      toast({
        title: "ERRO",
        description: "UNIDADE HOSPITALAR NÃO SELECIONADA",
        variant: "destructive",
      });
      return;
    }

    // MIGRAÇÃO: internment_requests NÃO existe no schema novo. O alvo do de-para
    // (internacoes) exige leito_id NOT NULL e não tem colunas para os campos
    // livres desta "solicitação" (patient_name/age/sex/record/destination/content/
    // department). Seguindo o padrão do projeto para escritas sem tabela-destino
    // (patient_movements/patient_versions → logs_auditoria), gravamos a solicitação
    // em logs_auditoria (tipo_evento='solicitacao_internacao'); os dados ricos
    // ficam em `dados_novos`. DEGRADADO: patient_sex/patient_record (sempre null),
    // state_id (sem estado no schema novo). registro_id/internacao_id = a
    // internação selecionada (patient.id já é internacoes.id).
    const { error } = await supabase
      .from("logs_auditoria")
      .insert({
        tipo_evento: "solicitacao_internacao",
        nome_tabela: "internacoes",
        registro_id: patient.id,
        internacao_id: patient.id,
        ator_user_id: currentUser.id,
        email_ator: currentUser.email ?? null,
        hospital_id: currentHospital.id,
        dados_novos: {
          patient_name: patient.name.toUpperCase(),
          patient_age: patient.age ? parseInt(patient.age) : null,
          destination: formData.destination,
          content: formData.content.toUpperCase(),
          department: currentDepartment,
        },
      } as any);

    if (error) {
      console.error("Erro ao salvar solicitação:", error);
      toast({
        title: "ERRO",
        description: "NÃO FOI POSSÍVEL SALVAR A SOLICITAÇÃO",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "SUCESSO",
      description: "SOLICITAÇÃO SALVA COM SUCESSO",
    });

    setSavedRequestInfo({
      patientName: patient.name.toUpperCase(),
      destination: formData.destination,
    });

    setIsSaveDialogOpen(false);
    setIsConfirmationDialogOpen(true);
  };

  const getSectorLabel = (sector: string) => {
    switch (sector) {
      case 'red': return 'UTI 1';
      case 'yellow': return 'UTI 2';
      case 'blue': return 'UCI 1';
      case 'outside': return 'UCI 2';
      case 'ucc': return 'UCC';
      default: return sector;
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight uppercase">
                Solicitações de Internação
              </h1>
              <p className="text-muted-foreground uppercase tracking-wider text-sm">
                {currentDepartment} • Criar e gerenciar solicitações
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/internment-history')}
            variant="outline"
            className="gap-2 uppercase tracking-wider"
          >
            <History className="h-4 w-4" />
            Histórico
          </Button>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Nueva Solicitação Section */}
      <Card className="border-primary/20 shadow-md hover:shadow-md transition-all duration-300">
        <CardHeader className="bg-primary/5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                <CardTitle className="uppercase tracking-wider text-xl">Nova Solicitação</CardTitle>
              </div>
              <CardDescription className="uppercase tracking-wider text-xs">
                Selecione um paciente do mapa atual e crie a solicitação de internação
              </CardDescription>
            </div>
            <Button
              onClick={handleOpenSaveDialog}
              size="lg"
              className="gap-2 uppercase tracking-wider shadow-md hover:shadow-md transition-all"
            >
              <Plus className="h-4 w-4" />
              Criar Solicitação
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wider">Pacientes Disponíveis</p>
                <p className="text-2xl font-semibold text-primary">{patients.filter(p => {
                  const bed = (p.bed_number || '').toString().toUpperCase();
                  return !bed.startsWith('EXTRA');
                }).length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wider">Banco de Dados</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Solicitações Salvas</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-warning-on-soft" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wider">Templates</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Modelos Personalizados</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Notes Section */}
      <Card className="shadow-md">
        <CardHeader className="bg-muted/50">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="uppercase tracking-wider text-xl">Bloco de Notas & Templates</CardTitle>
          </div>
          <CardDescription className="uppercase tracking-wider text-xs">
            Utilize templates padrão ou crie modelos personalizados para suas solicitações
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <NotesTab />
        </CardContent>
      </Card>

      {/* Save Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Nova Solicitação de Internação
            </DialogTitle>
            <DialogDescription className="uppercase tracking-wider">
              Selecione o paciente e preencha os dados da solicitação
            </DialogDescription>
          </DialogHeader>
          <Separator className="my-4" />
          <div className="grid gap-6 py-4">
            <div className="grid gap-3">
              <Label htmlFor="patient" className="uppercase tracking-wider font-medium text-sm">
                Paciente do Mapa *
              </Label>
              <Select
                value={selectedPatient}
                onValueChange={setSelectedPatient}
              >
                <SelectTrigger className="uppercase tracking-wider h-12">
                  <SelectValue placeholder="Selecione um paciente" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id} className="uppercase tracking-wider">
                      Leito {patient.bed_number} - {patient.name} ({getSectorLabel(patient.sector)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3">
              <Label htmlFor="destination" className="uppercase tracking-wider font-medium text-sm">
                Destino da Internação *
              </Label>
              <Select
                value={formData.destination}
                onValueChange={(value) => setFormData({ ...formData, destination: value })}
              >
                <SelectTrigger className="uppercase tracking-wider h-12">
                  <SelectValue placeholder="Selecione o destino" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTI" className="uppercase tracking-wider">UTI - Unidade de Terapia Intensiva</SelectItem>
                  <SelectItem value="ENFERMARIA" className="uppercase tracking-wider">Enfermaria</SelectItem>
                  <SelectItem value="POSTO INTERNAÇÃO" className="uppercase tracking-wider">Posto Internação</SelectItem>
                  <SelectItem value="CIRURGIA" className="uppercase tracking-wider">Centro Cirúrgico</SelectItem>
                  <SelectItem value="HEMODINÂMICA" className="uppercase tracking-wider">Hemodinâmica</SelectItem>
                  <SelectItem value="PSIQUIATRIA (INSTITUTO VOLTA VIDA)" className="uppercase tracking-wider">
                    Psiquiatria (Instituto Volta Vida)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="content" className="uppercase tracking-wider font-medium text-sm">
                  Conteúdo da Solicitação *
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleImportDiagnoses}
                    className="uppercase tracking-wider gap-2 h-8 text-xs"
                    disabled={!selectedPatient}
                  >
                    <Import className="h-3.5 w-3.5" />
                    Importar Hipóteses
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleImportAdmissionHistory}
                    className="uppercase tracking-wider gap-2 h-8 text-xs"
                    disabled={!selectedPatient}
                  >
                    <Import className="h-3.5 w-3.5" />
                    Importar Anamnese
                  </Button>
                </div>
              </div>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value.toUpperCase() })}
                placeholder="Digite o conteúdo detalhado da solicitação..."
                className="min-h-[300px] font-mono text-sm uppercase tracking-wider resize-none"
                required
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSaveDialogOpen(false)}
              className="uppercase tracking-wider"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="uppercase tracking-wider gap-2"
            >
              <Database className="h-4 w-4" />
              Salvar no Banco
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={isConfirmationDialogOpen} onOpenChange={setIsConfirmationDialogOpen}>
        <AlertDialogContent className="sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase tracking-wider flex items-center gap-2 text-released-on-soft">
              <Database className="h-6 w-6" />
              Solicitação Registrada com Sucesso
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="grid gap-2">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-medium uppercase tracking-wider text-foreground">Paciente:</span>
                    <span className="text-sm font-semibold text-foreground text-right">{savedRequestInfo?.patientName}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-medium uppercase tracking-wider text-foreground">Destino:</span>
                    <span className="text-sm font-semibold text-primary text-right">{savedRequestInfo?.destination}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted border border-border rounded-lg p-4">
                <p className="text-sm text-foreground font-medium uppercase tracking-wider">
                  Informação Importante
                </p>
                <p className="text-xs text-foreground mt-2 uppercase tracking-wider leading-relaxed">
                  A solicitação foi salva com sucesso no banco de dados. Você pode visualizar, editar ou imprimir a solicitação completa a qualquer momento acessando o <strong>Histórico de Solicitações</strong>.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="uppercase tracking-wider">
              Fechar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setIsConfirmationDialogOpen(false);
                navigate('/internment-history');
              }}
              className="uppercase tracking-wider gap-2"
            >
              <History className="h-4 w-4" />
              Ver Histórico
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ResourcesPage;
