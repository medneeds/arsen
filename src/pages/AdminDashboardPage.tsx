import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  UserPlus,
  FileText,
  Play,
  ArrowRight,
  ClipboardList,
  User,
  Calendar,
  Phone,
  MapPin,
  Heart,
  AlertTriangle,
  Hash,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  Plus,
  Send,
  Clock,
  UserX,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

// Destination sectors for encounter routing
const DESTINATION_SECTORS = [
  { value: "triagem", label: "Triagem", available: true, color: "bg-emerald-500" },
  { value: "red", label: "UTI 1", available: true, color: "bg-red-500" },
  { value: "yellow", label: "UTI 2", available: true, color: "bg-yellow-500" },
  { value: "blue", label: "UCI 1", available: true, color: "bg-blue-500" },
  { value: "outside", label: "UCI 2", available: true, color: "bg-gray-500" },
  { value: "sala_vermelha", label: "Sala Vermelha", available: true, color: "bg-red-700" },
  { value: "sala_laranja", label: "Sala Laranja", available: true, color: "bg-orange-500" },
  { value: "ue_vertical", label: "Urgência e Emergência Vertical", available: true, color: "bg-purple-500" },
  { value: "ue_horizontal", label: "Urgência e Emergência Horizontal", available: true, color: "bg-indigo-500" },
];

interface PatientRegistry {
  id: string;
  medical_record: string;
  full_name: string;
  social_name?: string;
  cpf?: string;
  cns?: string;
  birth_date?: string;
  sex?: string;
  mother_name?: string;
  phone?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  blood_type?: string;
  allergies?: string;
  comorbidities?: string;
  created_at: string;
}

interface Encounter {
  id: string;
  encounter_code: string;
  patient_name: string;
  registry_id?: string;
  destination_sector?: string;
  triage_status?: string;
  status: string;
  created_at: string;
}

const AdminDashboardPage = () => {
  const { user } = useAuth();
  const { currentHospital } = useHospital();
  const selectedHospitalId = currentHospital?.id;
  const { currentDepartment } = useDepartment();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PatientRegistry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Registration dialog
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    full_name: "",
    social_name: "",
    cpf: "",
    cns: "",
    birth_date: "",
    sex: "",
    mother_name: "",
    phone: "",
    address: "",
    neighborhood: "",
    city: "",
    blood_type: "",
    allergies: "",
    comorbidities: "",
    is_unidentified: false,
    ni_estimated_age: "",
    ni_apparent_sex: "",
    ni_skin_color: "",
    ni_distinctive_marks: "",
    ni_arrival_circumstance: "",
  });
  const [isRegistering, setIsRegistering] = useState(false);

  const toggleUnidentified = (checked: boolean) => {
    setRegisterForm(prev => ({
      ...prev,
      is_unidentified: checked,
      // Limpa campos sensíveis quando ativa NI
      full_name: checked ? "" : prev.full_name,
      social_name: checked ? "" : prev.social_name,
      mother_name: checked ? "" : prev.mother_name,
      cpf: checked ? "" : prev.cpf,
      cns: checked ? "" : prev.cns,
      birth_date: checked ? "" : prev.birth_date,
      sex: checked ? "I" : prev.sex,
      phone: checked ? "" : prev.phone,
      address: checked ? "" : prev.address,
      neighborhood: checked ? "" : prev.neighborhood,
      city: checked ? "" : prev.city,
    }));
  };

  // Selected patient & encounter
  const [selectedPatient, setSelectedPatient] = useState<PatientRegistry | null>(null);
  const [showPatientDetail, setShowPatientDetail] = useState(false);
  const [showNewEncounter, setShowNewEncounter] = useState(false);
  const [destinationSector, setDestinationSector] = useState("");
  const [isCreatingEncounter, setIsCreatingEncounter] = useState(false);

  // Recent encounters
  const [recentEncounters, setRecentEncounters] = useState<Encounter[]>([]);
  const [isLoadingEncounters, setIsLoadingEncounters] = useState(false);

  // Load recent encounters
  useEffect(() => {
    if (selectedHospitalId) {
      loadRecentEncounters();
    }
  }, [selectedHospitalId]);

  const loadRecentEncounters = async () => {
    if (!selectedHospitalId) return;
    setIsLoadingEncounters(true);
    try {
      const { data, error } = await supabase
        .from("patient_encounters")
        .select("id, encounter_code, patient_name, registry_id, destination_sector, triage_status, status, created_at")
        .eq("hospital_unit_id", selectedHospitalId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setRecentEncounters((data as any[]) || []);
    } catch (err) {
      console.error("Error loading encounters:", err);
    } finally {
      setIsLoadingEncounters(false);
    }
  };

  // Search patients
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const query = searchQuery.trim().toLowerCase();
      const { data, error } = await supabase
        .from("patient_registry")
        .select("*")
        .or(`full_name.ilike.%${query}%,cpf.ilike.%${query}%,cns.ilike.%${query}%,medical_record.ilike.%${query}%`)
        .order("full_name")
        .limit(20);

      if (error) throw error;
      setSearchResults((data as any[]) || []);
    } catch (err) {
      console.error("Error searching:", err);
      toast.error("Erro ao buscar pacientes");
    } finally {
      setIsSearching(false);
    }
  };

  // Register new patient
  const handleRegister = async () => {
    if (!registerForm.full_name.trim()) {
      toast.error("Nome completo é obrigatório");
      return;
    }
    if (!selectedHospitalId) {
      toast.error("Unidade hospitalar não selecionada");
      return;
    }

    setIsRegistering(true);
    try {
      const stateId = localStorage.getItem("selected_state_id");
      const { data, error } = await supabase
        .from("patient_registry")
        .insert({
          full_name: registerForm.full_name.trim().toUpperCase(),
          social_name: registerForm.social_name.trim() || null,
          cpf: registerForm.cpf.trim() || null,
          cns: registerForm.cns.trim() || null,
          birth_date: registerForm.birth_date || null,
          sex: registerForm.sex || null,
          mother_name: registerForm.mother_name.trim() || null,
          phone: registerForm.phone.trim() || null,
          address: registerForm.address.trim() || null,
          neighborhood: registerForm.neighborhood.trim() || null,
          city: registerForm.city.trim() || null,
          blood_type: registerForm.blood_type || null,
          allergies: registerForm.allergies.trim() || null,
          comorbidities: registerForm.comorbidities.trim() || null,
          created_by: user?.id,
          hospital_unit_id: selectedHospitalId,
          state_id: stateId,
        } as any)
        .select()
        .single();

      if (error) {
        if (error.message.includes("duplicate key") && error.message.includes("cpf")) {
          toast.error("CPF já cadastrado no sistema");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Prontuário criado com sucesso!", {
        description: `Nº ${(data as any).medical_record}`,
      });
      setShowRegisterDialog(false);
      setRegisterForm({
        full_name: "", social_name: "", cpf: "", cns: "", birth_date: "",
        sex: "", mother_name: "", phone: "", address: "", neighborhood: "",
        city: "", blood_type: "", allergies: "", comorbidities: "",
      });
      setSelectedPatient(data as any);
      setShowPatientDetail(true);
    } catch (err: any) {
      console.error("Error registering:", err);
      toast.error("Erro ao cadastrar paciente");
    } finally {
      setIsRegistering(false);
    }
  };

  // Create new encounter
  const handleCreateEncounter = async () => {
    if (!selectedPatient || !destinationSector) {
      toast.error("Selecione o setor de destino");
      return;
    }
    if (!selectedHospitalId) return;

    setIsCreatingEncounter(true);
    try {
      const stateId = localStorage.getItem("selected_state_id");
      const { data, error } = await supabase
        .from("patient_encounters")
        .insert({
          patient_name: selectedPatient.full_name,
          registry_id: selectedPatient.id,
          hospital_unit_id: selectedHospitalId,
          state_id: stateId,
          department: currentDepartment,
          destination_sector: destinationSector,
          triage_status: destinationSector === "triagem" ? "aguardando_chamada" : "encaminhado",
          status: "active",
        } as any)
        .select()
        .single();

      if (error) throw error;

      const sectorLabel = DESTINATION_SECTORS.find(s => s.value === destinationSector)?.label || destinationSector;
      toast.success("Atendimento iniciado!", {
        description: `Código: ${(data as any).encounter_code} → ${sectorLabel}`,
      });
      setShowNewEncounter(false);
      setDestinationSector("");
      loadRecentEncounters();
    } catch (err) {
      console.error("Error creating encounter:", err);
      toast.error("Erro ao criar atendimento");
    } finally {
      setIsCreatingEncounter(false);
    }
  };

  const getTriageStatusBadge = (status?: string) => {
    switch (status) {
      case "aguardando_chamada":
        return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">Aguardando chamada</Badge>;
      case "chamado":
        return <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/30">Chamado</Badge>;
      case "em_triagem":
        return <Badge variant="outline" className="text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-950/30">Em triagem</Badge>;
      case "triado":
        return <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">Triado</Badge>;
      case "encaminhado":
        return <Badge variant="outline" className="text-sky-600 border-sky-300 bg-sky-50 dark:bg-sky-950/30">Encaminhado direto</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  const getSectorBadge = (sector?: string) => {
    const s = DESTINATION_SECTORS.find(d => d.value === sector);
    if (!s) return null;
    return (
      <Badge className={cn("text-white text-xs", s.color)}>
        {s.label}
      </Badge>
    );
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Recepção / Administrativo</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {recentEncounters.filter(e => e.status === "active").length} atendimentos ativos
            </Badge>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Search & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Search Card */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    Consultar Prontuário
                  </CardTitle>
                  <CardDescription>
                    Busque por nome, CPF, CNS ou número do prontuário
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Digite o nome, CPF, CNS ou nº do prontuário..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="flex-1"
                    />
                    <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
                      {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      <span className="ml-2 hidden sm:inline">Buscar</span>
                    </Button>
                  </div>

                  {/* Search Results */}
                  <AnimatePresence>
                    {hasSearched && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4"
                      >
                        {searchResults.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <XCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">Nenhum prontuário encontrado</p>
                            <Button
                              variant="link"
                              size="sm"
                              className="mt-1"
                              onClick={() => {
                                setRegisterForm(prev => ({ ...prev, full_name: searchQuery.trim() }));
                                setShowRegisterDialog(true);
                              }}
                            >
                              <UserPlus className="h-3 w-3 mr-1" />
                              Cadastrar novo paciente
                            </Button>
                          </div>
                        ) : (
                          <ScrollArea className="max-h-[320px]">
                            <div className="space-y-2">
                              {searchResults.map((patient) => (
                                <motion.div
                                  key={patient.id}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                                  onClick={() => {
                                    setSelectedPatient(patient);
                                    setShowPatientDetail(true);
                                  }}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                      <User className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-sm truncate">{patient.full_name}</p>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <Hash className="h-3 w-3" />
                                          {patient.medical_record}
                                        </span>
                                        {patient.cpf && <span>CPF: {patient.cpf}</span>}
                                        {patient.birth_date && (
                                          <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(patient.birth_date + 'T00:00:00'), "dd/MM/yyyy")}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPatient(patient);
                                        setShowNewEncounter(true);
                                      }}
                                    >
                                      <Play className="h-3 w-3 mr-1" />
                                      Novo Atendimento
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPatient(patient);
                                        setShowPatientDetail(true);
                                      }}
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                    Ações Rápidas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => setShowRegisterDialog(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2 text-emerald-500" />
                    Novo Prontuário
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    disabled={!selectedPatient}
                    onClick={() => selectedPatient && setShowNewEncounter(true)}
                  >
                    <Play className="h-4 w-4 mr-2 text-blue-500" />
                    Iniciar Atendimento
                  </Button>
                  {selectedPatient && (
                    <div className="p-2 rounded-md bg-primary/5 border border-primary/10">
                      <p className="text-xs text-muted-foreground">Paciente selecionado:</p>
                      <p className="text-sm font-medium truncate">{selectedPatient.full_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedPatient.medical_record}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Encounters */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Atendimentos Recentes
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={loadRecentEncounters}>
                    <Loader2 className={cn("h-3 w-3", isLoadingEncounters && "animate-spin")} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recentEncounters.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhum atendimento registrado</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-2">
                      {recentEncounters.map((enc) => (
                        <div
                          key={enc.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                              <FileText className="h-4 w-4 text-blue-500" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">{enc.patient_name}</p>
                                <Badge variant="outline" className="text-xs font-mono">
                                  {enc.encounter_code}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span>{format(new Date(enc.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {getSectorBadge(enc.destination_sector)}
                            {enc.destination_sector === "triagem" && getTriageStatusBadge(enc.triage_status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Registration Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Novo Prontuário
            </DialogTitle>
            <DialogDescription>
              Cadastre um novo paciente no sistema. O número do prontuário será gerado automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="md:col-span-2">
              <Label>Nome Completo *</Label>
              <Input
                placeholder="Nome completo do paciente"
                value={registerForm.full_name}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Nome Social</Label>
              <Input
                placeholder="Nome social (se aplicável)"
                value={registerForm.social_name}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, social_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>CPF</Label>
              <Input
                placeholder="000.000.000-00"
                value={registerForm.cpf}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, cpf: e.target.value }))}
              />
            </div>
            <div>
              <Label>CNS (Cartão SUS)</Label>
              <Input
                placeholder="Número do cartão SUS"
                value={registerForm.cns}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, cns: e.target.value }))}
              />
            </div>
            <div>
              <Label>Data de Nascimento</Label>
              <Input
                type="date"
                value={registerForm.birth_date}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, birth_date: e.target.value }))}
              />
            </div>
            <div>
              <Label>Sexo</Label>
              <Select value={registerForm.sex} onValueChange={(v) => setRegisterForm(prev => ({ ...prev, sex: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                  <SelectItem value="I">Indeterminado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome da Mãe</Label>
              <Input
                placeholder="Nome da mãe"
                value={registerForm.mother_name}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, mother_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                placeholder="(00) 00000-0000"
                value={registerForm.phone}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Endereço</Label>
              <Input
                placeholder="Rua, número"
                value={registerForm.address}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input
                placeholder="Bairro"
                value={registerForm.neighborhood}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, neighborhood: e.target.value }))}
              />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input
                placeholder="Cidade"
                value={registerForm.city}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, city: e.target.value }))}
              />
            </div>

            <Separator className="md:col-span-2" />

            <div>
              <Label>Tipo Sanguíneo</Label>
              <Select value={registerForm.blood_type} onValueChange={(v) => setRegisterForm(prev => ({ ...prev, blood_type: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bt => (
                    <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Alergias</Label>
              <Input
                placeholder="Alergias conhecidas"
                value={registerForm.allergies}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, allergies: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Comorbidades</Label>
              <Input
                placeholder="Comorbidades conhecidas"
                value={registerForm.comorbidities}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, comorbidities: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRegister} disabled={isRegistering || !registerForm.full_name.trim()}>
              {isRegistering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Criar Prontuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Patient Detail Dialog */}
      <Dialog open={showPatientDetail} onOpenChange={setShowPatientDetail}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Prontuário do Paciente
            </DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-bold">{selectedPatient.full_name}</p>
                  {selectedPatient.social_name && (
                    <p className="text-sm text-muted-foreground">Nome social: {selectedPatient.social_name}</p>
                  )}
                  <Badge variant="outline" className="font-mono mt-1">{selectedPatient.medical_record}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedPatient.cpf && (
                  <div>
                    <span className="text-muted-foreground">CPF:</span>
                    <p className="font-medium">{selectedPatient.cpf}</p>
                  </div>
                )}
                {selectedPatient.cns && (
                  <div>
                    <span className="text-muted-foreground">CNS:</span>
                    <p className="font-medium">{selectedPatient.cns}</p>
                  </div>
                )}
                {selectedPatient.birth_date && (
                  <div>
                    <span className="text-muted-foreground">Nascimento:</span>
                    <p className="font-medium">{format(new Date(selectedPatient.birth_date + 'T00:00:00'), "dd/MM/yyyy")}</p>
                  </div>
                )}
                {selectedPatient.sex && (
                  <div>
                    <span className="text-muted-foreground">Sexo:</span>
                    <p className="font-medium">{selectedPatient.sex === "M" ? "Masculino" : selectedPatient.sex === "F" ? "Feminino" : "Indeterminado"}</p>
                  </div>
                )}
                {selectedPatient.blood_type && (
                  <div>
                    <span className="text-muted-foreground">Tipo Sanguíneo:</span>
                    <p className="font-medium">{selectedPatient.blood_type}</p>
                  </div>
                )}
                {selectedPatient.phone && (
                  <div>
                    <span className="text-muted-foreground">Telefone:</span>
                    <p className="font-medium">{selectedPatient.phone}</p>
                  </div>
                )}
              </div>

              {selectedPatient.allergies && (
                <div className="p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                  <p className="text-xs font-medium text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Alergias
                  </p>
                  <p className="text-sm">{selectedPatient.allergies}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPatientDetail(false)}>
              Fechar
            </Button>
            <Button onClick={() => {
              setShowPatientDetail(false);
              setShowNewEncounter(true);
            }}>
              <Play className="h-4 w-4 mr-2" />
              Novo Atendimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Encounter Dialog */}
      <Dialog open={showNewEncounter} onOpenChange={setShowNewEncounter}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Novo Atendimento
            </DialogTitle>
            <DialogDescription>
              Inicie um novo atendimento e direcione para o setor de destino.
            </DialogDescription>
          </DialogHeader>

          {selectedPatient && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{selectedPatient.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedPatient.medical_record}</p>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Setor de Destino *</Label>
                <div className="grid grid-cols-1 gap-2">
                  {DESTINATION_SECTORS.map((sector) => (
                    <button
                      key={sector.value}
                      disabled={!sector.available}
                      onClick={() => setDestinationSector(sector.value)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                        sector.available ? "hover:bg-accent/50 cursor-pointer" : "opacity-40 cursor-not-allowed",
                        destinationSector === sector.value && "ring-2 ring-primary bg-primary/5 border-primary/30"
                      )}
                    >
                      <div className={cn("h-3 w-3 rounded-full shrink-0", sector.color)} />
                      <span className="text-sm font-medium">{sector.label}</span>
                      {!sector.available && (
                        <Badge variant="outline" className="ml-auto text-[10px]">Em breve</Badge>
                      )}
                      {sector.value === "triagem" && destinationSector === "triagem" && (
                        <Badge className="ml-auto bg-emerald-500 text-white text-[10px]">Recomendado</Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewEncounter(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateEncounter}
              disabled={isCreatingEncounter || !destinationSector}
            >
              {isCreatingEncounter ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Iniciar Atendimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default AdminDashboardPage;
