import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ScanLine, Printer, RotateCcw, Plus, Trash2, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { usePatientIdentifiers } from "@/hooks/usePatientIdentifiers";
import { toast } from "sonner";
import { format } from "date-fns";

/* ── SUS procedure catalog ─────────────────────────────────────── */
interface Procedure {
  code: string;
  name: string;
  category: "TC" | "RM" | "USG" | "DOPPLER" | "RX" | "OUTRO";
}

const PROCEDURES: Procedure[] = [
  // Tomografias
  { code: "02.06.01.007-9", name: "TOMOGRAFIA COMPUTADORIZADA DO CRÂNIO", category: "TC" },
  { code: "02.06.01.008-7", name: "TOMOGRAFIA COMPUTADORIZADA DE FACE / SEIOS DA FACE", category: "TC" },
  { code: "02.06.01.009-5", name: "TOMOGRAFIA COMPUTADORIZADA DE SELA TÚRCICA", category: "TC" },
  { code: "02.06.02.003-5", name: "TOMOGRAFIA COMPUTADORIZADA DO PESCOÇO", category: "TC" },
  { code: "02.06.03.001-0", name: "TOMOGRAFIA COMPUTADORIZADA DO TÓRAX", category: "TC" },
  { code: "02.06.03.002-9", name: "TOMOGRAFIA COMPUTADORIZADA DE ABDOMEN SUPERIOR", category: "TC" },
  { code: "02.06.03.003-7", name: "TOMOGRAFIA COMPUTADORIZADA DE ABDOMEN INFERIOR", category: "TC" },
  { code: "02.06.03.004-5", name: "TOMOGRAFIA COMPUTADORIZADA DE ABDOMEN TOTAL", category: "TC" },
  { code: "02.06.03.005-3", name: "TOMOGRAFIA COMPUTADORIZADA DE PELVE / BACIA", category: "TC" },
  { code: "02.06.04.001-6", name: "TOMOGRAFIA COMPUTADORIZADA DE COLUNA CERVICAL", category: "TC" },
  { code: "02.06.04.002-4", name: "TOMOGRAFIA COMPUTADORIZADA DE COLUNA TORÁCICA", category: "TC" },
  { code: "02.06.04.003-2", name: "TOMOGRAFIA COMPUTADORIZADA DE COLUNA LOMBO-SACRA", category: "TC" },
  { code: "02.06.05.001-1", name: "TOMOGRAFIA COMPUTADORIZADA DE ARTICULAÇÕES", category: "TC" },
  { code: "02.06.05.002-0", name: "TOMOGRAFIA COMPUTADORIZADA DE SEGMENTOS APENDICULARES", category: "TC" },
  // Angiotomografias
  { code: "02.06.01.001-0", name: "ANGIOTOMOGRAFIA DE ARTÉRIAS CERVICO CEREBRAIS", category: "TC" },
  { code: "02.06.01.002-8", name: "ANGIOTOMOGRAFIA DE AORTA TORÁCICA", category: "TC" },
  { code: "02.06.01.003-6", name: "ANGIOTOMOGRAFIA DE AORTA ABDOMINAL", category: "TC" },
  { code: "02.06.01.004-4", name: "ANGIOTOMOGRAFIA CORONARIANA", category: "TC" },
  { code: "02.06.01.005-2", name: "ANGIOTOMOGRAFIA DE ARTÉRIAS PULMONARES (TEP)", category: "TC" },
  // Ressonâncias
  { code: "02.07.01.001-3", name: "RESSONÂNCIA MAGNÉTICA DE CRÂNIO", category: "RM" },
  { code: "02.07.01.002-1", name: "RESSONÂNCIA MAGNÉTICA DE SELA TÚRCICA", category: "RM" },
  { code: "02.07.02.001-9", name: "RESSONÂNCIA MAGNÉTICA DE COLUNA CERVICAL", category: "RM" },
  { code: "02.07.02.002-7", name: "RESSONÂNCIA MAGNÉTICA DE COLUNA TORÁCICA", category: "RM" },
  { code: "02.07.02.003-5", name: "RESSONÂNCIA MAGNÉTICA DE COLUNA LOMBO-SACRA", category: "RM" },
  { code: "02.07.03.001-4", name: "RESSONÂNCIA MAGNÉTICA DE TÓRAX", category: "RM" },
  { code: "02.07.03.002-2", name: "RESSONÂNCIA MAGNÉTICA DE ABDOMEN SUPERIOR", category: "RM" },
  { code: "02.07.03.003-0", name: "RESSONÂNCIA MAGNÉTICA DE PELVE", category: "RM" },
  { code: "02.07.04.001-0", name: "RESSONÂNCIA MAGNÉTICA DE ARTICULAÇÃO", category: "RM" },
  // Dopplers / USG
  { code: "02.05.02.001-7", name: "DOPPLER COLORIDO DE VASOS CERVICAIS (CARÓTIDAS E VERTEBRAIS)", category: "DOPPLER" },
  { code: "02.05.02.002-5", name: "DOPPLER COLORIDO VENOSO DE MEMBROS INFERIORES", category: "DOPPLER" },
  { code: "02.05.02.003-3", name: "DOPPLER COLORIDO ARTERIAL DE MEMBROS INFERIORES", category: "DOPPLER" },
  { code: "02.05.02.004-1", name: "DOPPLER COLORIDO VENOSO DE MEMBROS SUPERIORES", category: "DOPPLER" },
  { code: "02.05.02.005-0", name: "DOPPLER COLORIDO DE AORTA E ARTÉRIAS RENAIS", category: "DOPPLER" },
  { code: "02.05.01.003-0", name: "ULTRASSONOGRAFIA DE ABDOMEN TOTAL", category: "USG" },
  { code: "02.05.01.004-8", name: "ULTRASSONOGRAFIA DE TÓRAX", category: "USG" },
  { code: "02.05.01.005-6", name: "ECOCARDIOGRAMA TRANSTORÁCICO", category: "USG" },
];

/* Quick-access buttons */
const QUICK_ACCESS = [
  { code: "02.06.01.007-9", label: "TC Crânio", color: "bg-blue-600 hover:bg-blue-700 text-white" },
  { code: "02.06.03.001-0", label: "TC Tórax", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  { code: "02.06.03.002-9", label: "TC Abdome Sup", color: "bg-amber-600 hover:bg-amber-700 text-white" },
  { code: "02.06.03.003-7", label: "TC Abdome Inf", color: "bg-orange-600 hover:bg-orange-700 text-white" },
  { code: "02.06.03.004-5", label: "TC Abdome Total", color: "bg-red-600 hover:bg-red-700 text-white" },
  { code: "02.06.01.005-2", label: "AngioTC Pulmonar", color: "bg-purple-600 hover:bg-purple-700 text-white" },
  { code: "02.06.01.001-0", label: "AngioTC Cervical", color: "bg-indigo-600 hover:bg-indigo-700 text-white" },
  { code: "02.06.03.005-3", label: "TC Pelve", color: "bg-pink-600 hover:bg-pink-700 text-white" },
];

/* ── Fixed institution data ────────────────────────────────────── */
const INSTITUTION = {
  name: "HOSPITAL MUNICIPAL DJALMA MARQUES",
  cnes: "2308762",
};

/** Formata CPF como 000.000.000-00 (aceita 11 dígitos crus ou já formatado) */
const formatCPF = (raw: string): string => {
  const d = (raw || "").replace(/\D/g, "").slice(0, 11);
  if (d.length !== 11) return raw || "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

interface SelectedProcedure {
  code: string;
  name: string;
  qty: number;
}

const RequisicaoImagensPage = () => {
  const { user } = useAuth();
  const { currentHospital } = useHospital();
  const [searchParams] = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);

  // Identidade canônica + realtime (refaz quando o prontuário/paciente muda)
  const urlPatientId = searchParams.get("patientId");
  const urlPatientName = searchParams.get("patientName");
  const identifiers = usePatientIdentifiers(
    urlPatientId,
    urlPatientName,
    currentHospital?.id || null,
  );

  // Doctor data from profile
  const [doctorName, setDoctorName] = useState("");
  const [doctorCRM, setDoctorCRM] = useState("");
  const [doctorCPF, setDoctorCPF] = useState("");

  // Patient data
  const [patientName, setPatientName] = useState("");
  const [patientRecord, setPatientRecord] = useState("");
  const [patientCNS, setPatientCNS] = useState("");
  const [patientCPF, setPatientCPF] = useState("");
  const [patientDOB, setPatientDOB] = useState("");
  const [patientSex, setPatientSex] = useState("");
  const [patientMotherName, setPatientMotherName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientAddress, setPatientAddress] = useState("");
  const [patientCity, setPatientCity] = useState("São Luís");
  const [patientUF, setPatientUF] = useState("MA");

  // Procedures
  const [selectedProcedures, setSelectedProcedures] = useState<SelectedProcedure[]>([]);
  const [searchProcedure, setSearchProcedure] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Justification
  const [diagnosis, setDiagnosis] = useState("");
  const [cidPrimary, setCidPrimary] = useState("");
  const [cidSecondary, setCidSecondary] = useState("");
  const [cidAssociated, setCidAssociated] = useState("");
  const [observations, setObservations] = useState("");

  // Load doctor profile (incl. CPF for SUS APAC field 41)
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, crm, cpf")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setDoctorName(data.full_name || "");
        setDoctorCRM(data.crm || "");
        if (data.cpf) setDoctorCPF(formatCPF(data.cpf));
      }
    };
    load();
  }, [user]);

  // Pre-fill name from URL even before identifiers resolve (instant UX)
  useEffect(() => {
    const urlName = searchParams.get("patientName");
    if (urlName && !patientName) setPatientName(urlName.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 🔄 Sincroniza cabeçalho a partir do prontuário canônico (com realtime).
  // Sempre que `identifiers.registry` ou `prontuario` mudam, atualiza os campos
  // do laudo APAC — sem trava once-only — para refletir edição/transferência.
  useEffect(() => {
    if (identifiers.loading) return;
    const reg = identifiers.registry;
    const fullName = reg?.socialName?.trim() || reg?.fullName?.trim() || urlPatientName || "";
    if (fullName) setPatientName(fullName.toUpperCase());

    const mr = identifiers.prontuario || reg?.medicalRecord || "";
    if (mr) setPatientRecord(mr);

    if (reg?.cns) setPatientCNS(reg.cns);
    if (reg?.cpf) setPatientCPF(formatCPF(reg.cpf));
    if (reg?.birthDate) setPatientDOB(reg.birthDate);
    if (reg?.sex) {
      const s = String(reg.sex).toUpperCase().trim();
      if (s.startsWith("M")) setPatientSex("M");
      else if (s.startsWith("F")) setPatientSex("F");
    }
    if (reg?.motherName) setPatientMotherName(reg.motherName.toUpperCase());
    if (reg?.phone) setPatientPhone(reg.phone);

    const addrParts = [reg?.address, reg?.neighborhood].filter(Boolean) as string[];
    if (addrParts.length) setPatientAddress(addrParts.join(", ").toUpperCase());
    if (reg?.city) setPatientCity(String(reg.city));
    if (reg?.state) setPatientUF(String(reg.state).toUpperCase().slice(0, 2));
  }, [
    identifiers.loading,
    identifiers.prontuario,
    identifiers.registry?.id,
    identifiers.registry?.fullName,
    identifiers.registry?.socialName,
    identifiers.registry?.cns,
    identifiers.registry?.birthDate,
    identifiers.registry?.sex,
    identifiers.registry?.motherName,
    identifiers.registry?.phone,
    identifiers.registry?.address,
    identifiers.registry?.neighborhood,
    identifiers.registry?.city,
    identifiers.registry?.state,
    urlPatientName,
  ]);

  // Hidrata CID-10 + diagnóstico a partir da admissão validada — uma única vez
  const [admissionHydrated, setAdmissionHydrated] = useState(false);
  useEffect(() => {
    const patientId = searchParams.get("patientId");
    if (!patientId || admissionHydrated) return;
    (async () => {
      try {
        const { data: ah } = await supabase
          .from("admission_histories")
          .select("cid_primary, cid_secondary, diagnostic_hypothesis, macro_diagnosis, chief_complaint")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ah) {
          setCidPrimary((prev) => prev || (ah.cid_primary || ""));
          setCidSecondary((prev) => prev || (ah.cid_secondary || ""));
          setDiagnosis((prev) =>
            prev ||
            ah.diagnostic_hypothesis ||
            ah.macro_diagnosis ||
            ah.chief_complaint ||
            ""
          );
        }
        setAdmissionHydrated(true);
      } catch (err) {
        console.error("[APAC] admission hydrate error", err);
      }
    })();
  }, [searchParams, admissionHydrated]);

  // Aviso CNS ausente após resolução
  useEffect(() => {
    if (identifiers.loading) return;
    if (identifiers.registry && !identifiers.registry.cns) {
      toast.warning("CNS ausente no prontuário", {
        description: "Preencha manualmente ou atualize o cadastro do paciente para impressão APAC válida.",
      });
    }
  }, [identifiers.loading, identifiers.registry?.id, identifiers.registry?.cns]);

  const addProcedure = (proc: Procedure) => {
    if (selectedProcedures.find((p) => p.code === proc.code)) {
      toast.info("Procedimento já adicionado");
      return;
    }
    if (selectedProcedures.length >= 6) {
      toast.error("Máximo de 6 procedimentos por laudo");
      return;
    }
    setSelectedProcedures((prev) => [...prev, { code: proc.code, name: proc.name, qty: 1 }]);
    toast.success("Procedimento adicionado");
  };

  const removeProcedure = (code: string) => {
    setSelectedProcedures((prev) => prev.filter((p) => p.code !== code));
  };

  const resetForm = () => {
    setPatientName(""); setPatientRecord(""); setPatientCNS("");
    setPatientDOB(""); setPatientSex(""); setPatientMotherName("");
    setPatientPhone(""); setPatientAddress("");
    setSelectedProcedures([]);
    setDiagnosis(""); setCidPrimary(""); setCidSecondary(""); setCidAssociated("");
    setObservations("");
    toast.info("Formulário limpo");
  };

  const handlePrint = () => {
    if (selectedProcedures.length === 0) {
      toast.error("Adicione ao menos um procedimento");
      return;
    }
    if (!patientName.trim()) {
      toast.error("Informe o nome do paciente");
      return;
    }
    window.print();
  };

  const filteredProcedures = PROCEDURES.filter((p) => {
    const matchSearch = searchProcedure === "" ||
      p.name.toLowerCase().includes(searchProcedure.toLowerCase()) ||
      p.code.includes(searchProcedure);
    const matchCategory = categoryFilter === "all" || p.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const todayFormatted = format(new Date(), "dd/MM/yyyy");

  return (
    <>
      {/* ── Screen UI ─────────────────────────────────────────── */}
      <div className="p-4 md:p-6 space-y-6 max-w-7xl print:hidden">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <ScanLine className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">APAC — Solicitação de Alta Complexidade</h1>
              <p className="text-sm text-muted-foreground">Laudo para Solicitação/Autorização de Procedimento Ambulatorial</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetForm}>
              <RotateCcw className="h-4 w-4 mr-1" /> Limpar
            </Button>
            <Button size="sm" onClick={handlePrint} className="bg-primary">
              <Printer className="h-4 w-4 mr-1" /> Imprimir APAC
            </Button>
          </div>
        </div>

        {/* Quick access buttons */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Acesso Rápido — Tomografias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACCESS.map((qa) => {
                const proc = PROCEDURES.find((p) => p.code === qa.code);
                const isSelected = selectedProcedures.some((p) => p.code === qa.code);
                return (
                  <Button
                    key={qa.code}
                    size="sm"
                    className={`${isSelected ? "ring-2 ring-offset-2 ring-primary opacity-60" : qa.color} transition-all font-semibold`}
                    onClick={() => proc && addProcedure(proc)}
                    disabled={isSelected}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    {qa.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Patient + procedures */}
          <div className="space-y-4">
            {/* Institution (read-only) */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Estabelecimento Solicitante</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Nome</Label>
                    <Input value={INSTITUTION.name} readOnly className="bg-muted/50 font-medium text-sm" />
                  </div>
                  <div className="w-28">
                    <Label className="text-xs text-muted-foreground">CNES</Label>
                    <Input value={INSTITUTION.cnes} readOnly className="bg-muted/50 font-mono font-bold text-sm text-center" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Patient identification */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Identificação do Paciente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Nome do Paciente *</Label>
                    <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Nº Prontuário</Label>
                    <Input value={patientRecord} onChange={(e) => setPatientRecord(e.target.value)} placeholder="000000" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">CNS</Label>
                    <Input value={patientCNS} onChange={(e) => setPatientCNS(e.target.value)} placeholder="Cartão Nacional de Saúde" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Data Nasc.</Label>
                    <Input type="date" value={patientDOB} onChange={(e) => setPatientDOB(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Sexo</Label>
                    <Select value={patientSex} onValueChange={setPatientSex}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Feminino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Nome da Mãe</Label>
                    <Input value={patientMotherName} onChange={(e) => setPatientMotherName(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Telefone</Label>
                    <Input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Endereço</Label>
                    <Input value={patientAddress} onChange={(e) => setPatientAddress(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Município</Label>
                    <Input value={patientCity} onChange={(e) => setPatientCity(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">UF</Label>
                    <Input value={patientUF} onChange={(e) => setPatientUF(e.target.value)} maxLength={2} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Justification */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Justificativa Clínica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Diagnóstico Inicial</Label>
                  <Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Descreva o diagnóstico" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">CID-10 Principal</Label>
                    <Input value={cidPrimary} onChange={(e) => setCidPrimary(e.target.value)} placeholder="Ex: I63.9" className="font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">CID-10 Secundário</Label>
                    <Input value={cidSecondary} onChange={(e) => setCidSecondary(e.target.value)} className="font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">CID-10 Associado</Label>
                    <Input value={cidAssociated} onChange={(e) => setCidAssociated(e.target.value)} className="font-mono" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Observações</Label>
                  <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Informações clínicas relevantes..." rows={3} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column: Search + selected */}
          <div className="space-y-4">
            {/* Procedure search */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Catálogo de Procedimentos SIGTAP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchProcedure}
                      onChange={(e) => setSearchProcedure(e.target.value)}
                      placeholder="Buscar por nome ou código..."
                      className="pl-9"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="TC">TC</SelectItem>
                      <SelectItem value="RM">RM</SelectItem>
                      <SelectItem value="DOPPLER">Doppler</SelectItem>
                      <SelectItem value="USG">USG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                  {filteredProcedures.map((proc) => {
                    const isSelected = selectedProcedures.some((p) => p.code === proc.code);
                    return (
                      <button
                        key={proc.code}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 ${isSelected ? "bg-primary/5 opacity-60" : ""}`}
                        onClick={() => addProcedure(proc)}
                        disabled={isSelected}
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-xs text-muted-foreground mr-2">{proc.code}</span>
                          <span className="text-foreground">{proc.name}</span>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs">{proc.category}</Badge>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Selected procedures */}
            <Card className={selectedProcedures.length > 0 ? "border-primary/30" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Procedimentos Selecionados ({selectedProcedures.length}/6)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {selectedProcedures.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Use os botões de acesso rápido ou busque no catálogo acima
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedProcedures.map((proc, idx) => (
                      <div key={proc.code} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                        <Badge variant="secondary" className="shrink-0 font-mono text-xs">{idx === 0 ? "Principal" : `Sec. ${idx}`}</Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{proc.name}</p>
                          <p className="text-xs font-mono text-muted-foreground">{proc.code}</p>
                        </div>
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          value={proc.qty}
                          onChange={(e) => {
                            const qty = parseInt(e.target.value) || 1;
                            setSelectedProcedures((prev) => prev.map((p) => (p.code === proc.code ? { ...p, qty } : p)));
                          }}
                          className="w-14 text-center text-sm"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeProcedure(proc.code)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Doctor info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Profissional Solicitante</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome do Profissional</Label>
                  <Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className="bg-muted/30 font-medium" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">CRM</Label>
                    <Input value={doctorCRM} onChange={(e) => setDoctorCRM(e.target.value)} className="bg-muted/30 font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">CPF</Label>
                    <Input value={doctorCPF} onChange={(e) => setDoctorCPF(e.target.value)} placeholder="000.000.000-00" className="font-mono" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Data da Solicitação: <strong>{todayFormatted}</strong></p>
              </CardContent>
            </Card>

            <Button className="w-full" size="lg" onClick={handlePrint}>
              <Printer className="h-5 w-5 mr-2" /> Gerar e Imprimir Laudo APAC
            </Button>
          </div>
        </div>
      </div>

      {/* ── Print Layout ──────────────────────────────────────── */}
      <div ref={printRef} className="hidden print:block">
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 10mm 12mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print\\:block { display: block !important; }
            .print\\:hidden { display: none !important; }
          }
          .apac-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
          .apac-table th, .apac-table td { border: 1px solid #000; padding: 2px 4px; text-align: left; vertical-align: top; }
          .apac-table th { background: #e5e7eb; font-weight: bold; font-size: 7pt; text-transform: uppercase; }
          .apac-section-title { background: #1e293b; color: white; font-weight: bold; font-size: 8pt; padding: 3px 6px; text-transform: uppercase; letter-spacing: 0.5px; }
          .apac-header { text-align: center; margin-bottom: 6px; }
          .apac-header h1 { font-size: 11pt; font-weight: bold; margin: 0; }
          .apac-header p { font-size: 7pt; margin: 0; color: #666; }
          .apac-field-label { font-size: 6.5pt; color: #666; display: block; }
          .apac-field-value { font-size: 9pt; font-weight: 500; min-height: 14px; }
          .apac-signature-area { height: 40px; border-bottom: 1px solid #000; margin-top: 20px; }
        `}</style>

        <div style={{ fontFamily: "'Arial', sans-serif", color: "#000" }}>
          {/* Header */}
          <div className="apac-header" style={{ borderBottom: "2px solid #000", paddingBottom: "4px", marginBottom: "8px" }}>
            <p style={{ fontSize: "7pt", margin: 0 }}>Sistema Único de Saúde — Ministério da Saúde</p>
            <h1 style={{ fontSize: "11pt", fontWeight: "bold", margin: "2px 0" }}>LAUDO PARA SOLICITAÇÃO / AUTORIZAÇÃO DE PROCEDIMENTO AMBULATORIAL</h1>
          </div>

          {/* Institution */}
          <table className="apac-table">
            <tbody>
              <tr><td colSpan={2} className="apac-section-title">IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (SOLICITANTE)</td></tr>
              <tr>
                <td style={{ width: "75%" }}>
                  <span className="apac-field-label">1 — NOME DO ESTABELECIMENTO DE SAÚDE SOLICITANTE</span>
                  <div className="apac-field-value">{INSTITUTION.name}</div>
                </td>
                <td>
                  <span className="apac-field-label">2 — CNES</span>
                  <div className="apac-field-value" style={{ fontFamily: "monospace", fontWeight: "bold", fontSize: "10pt" }}>{INSTITUTION.cnes}</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Patient */}
          <table className="apac-table" style={{ marginTop: "4px" }}>
            <tbody>
              <tr><td colSpan={5} className="apac-section-title">IDENTIFICAÇÃO DO PACIENTE</td></tr>
              <tr>
                <td colSpan={3}>
                  <span className="apac-field-label">3 — NOME DO PACIENTE</span>
                  <div className="apac-field-value">{patientName.toUpperCase()}</div>
                </td>
                <td colSpan={2}>
                  <span className="apac-field-label">4 — Nº DO PRONTUÁRIO</span>
                  <div className="apac-field-value">{patientRecord}</div>
                </td>
              </tr>
              <tr>
                <td colSpan={2}>
                  <span className="apac-field-label">5 — CARTÃO NACIONAL DE SAÚDE</span>
                  <div className="apac-field-value">{patientCNS}</div>
                </td>
                <td>
                  <span className="apac-field-label">6 — DATA DE NASCIMENTO</span>
                  <div className="apac-field-value">{patientDOB ? format(new Date(patientDOB + "T12:00:00"), "dd/MM/yyyy") : ""}</div>
                </td>
                <td colSpan={2}>
                  <span className="apac-field-label">7 — SEXO</span>
                  <div className="apac-field-value">{patientSex === "M" ? "MASCULINO" : patientSex === "F" ? "FEMININO" : ""}</div>
                </td>
              </tr>
              <tr>
                <td colSpan={3}>
                  <span className="apac-field-label">8 — NOME DA MÃE OU RESPONSÁVEL</span>
                  <div className="apac-field-value">{patientMotherName.toUpperCase()}</div>
                </td>
                <td colSpan={2}>
                  <span className="apac-field-label">9 — TELEFONE DE CONTATO</span>
                  <div className="apac-field-value">{patientPhone}</div>
                </td>
              </tr>
              <tr>
                <td colSpan={2}>
                  <span className="apac-field-label">10 — ENDEREÇO (RUA, Nº, BAIRRO)</span>
                  <div className="apac-field-value">{patientAddress.toUpperCase()}</div>
                </td>
                <td>
                  <span className="apac-field-label">11 — MUNICÍPIO</span>
                  <div className="apac-field-value">{patientCity.toUpperCase()}</div>
                </td>
                <td>
                  <span className="apac-field-label">13 — UF</span>
                  <div className="apac-field-value">{patientUF}</div>
                </td>
                <td>
                  <span className="apac-field-label">14 — CEP</span>
                  <div className="apac-field-value"></div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Primary procedure */}
          <table className="apac-table" style={{ marginTop: "4px" }}>
            <tbody>
              <tr><td colSpan={3} className="apac-section-title">PROCEDIMENTO SOLICITADO</td></tr>
              <tr>
                <td style={{ width: "25%" }}>
                  <span className="apac-field-label">15 — CÓDIGO DO PROCEDIMENTO</span>
                  <div className="apac-field-value" style={{ fontFamily: "monospace" }}>{selectedProcedures[0]?.code || ""}</div>
                </td>
                <td style={{ width: "60%" }}>
                  <span className="apac-field-label">16 — NOME DO PROCEDIMENTO PRINCIPAL</span>
                  <div className="apac-field-value">{selectedProcedures[0]?.name || ""}</div>
                </td>
                <td>
                  <span className="apac-field-label">17 — QTDE</span>
                  <div className="apac-field-value" style={{ textAlign: "center" }}>{selectedProcedures[0]?.qty || ""}</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Secondary procedures */}
          <table className="apac-table" style={{ marginTop: "4px" }}>
            <tbody>
              <tr><td colSpan={3} className="apac-section-title">PROCEDIMENTO(S) SECUNDÁRIO(S)</td></tr>
              {[1, 2, 3, 4, 5].map((idx) => {
                const proc = selectedProcedures[idx];
                const fieldNum = 18 + (idx - 1) * 3;
                return (
                  <tr key={idx}>
                    <td style={{ width: "25%" }}>
                      <span className="apac-field-label">{fieldNum} — CÓDIGO</span>
                      <div className="apac-field-value" style={{ fontFamily: "monospace" }}>{proc?.code || ""}</div>
                    </td>
                    <td style={{ width: "60%" }}>
                      <span className="apac-field-label">{fieldNum + 1} — NOME DO PROCEDIMENTO</span>
                      <div className="apac-field-value">{proc?.name || ""}</div>
                    </td>
                    <td>
                      <span className="apac-field-label">{fieldNum + 2} — QTDE</span>
                      <div className="apac-field-value" style={{ textAlign: "center" }}>{proc?.qty || ""}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Justification */}
          <table className="apac-table" style={{ marginTop: "4px" }}>
            <tbody>
              <tr><td colSpan={4} className="apac-section-title">JUSTIFICATIVA DO(S) PROCEDIMENTO(S) SOLICITADO(S)</td></tr>
              <tr>
                <td>
                  <span className="apac-field-label">33 — DIAGNÓSTICO INICIAL</span>
                  <div className="apac-field-value">{diagnosis.toUpperCase()}</div>
                </td>
                <td>
                  <span className="apac-field-label">34 — CID-10 PRINCIPAL</span>
                  <div className="apac-field-value" style={{ fontFamily: "monospace" }}>{cidPrimary.toUpperCase()}</div>
                </td>
                <td>
                  <span className="apac-field-label">35 — CID-10 SECUNDÁRIO</span>
                  <div className="apac-field-value" style={{ fontFamily: "monospace" }}>{cidSecondary.toUpperCase()}</div>
                </td>
                <td>
                  <span className="apac-field-label">36 — CID-10 CAUSAS ASSOC.</span>
                  <div className="apac-field-value" style={{ fontFamily: "monospace" }}>{cidAssociated.toUpperCase()}</div>
                </td>
              </tr>
              <tr>
                <td colSpan={4}>
                  <span className="apac-field-label">37 — OBSERVAÇÕES</span>
                  <div className="apac-field-value" style={{ minHeight: "30px", whiteSpace: "pre-wrap" }}>{observations}</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Solicitation */}
          <table className="apac-table" style={{ marginTop: "4px" }}>
            <tbody>
              <tr><td colSpan={4} className="apac-section-title">SOLICITAÇÃO</td></tr>
              <tr>
                <td colSpan={2}>
                  <span className="apac-field-label">38 — NOME DO PROFISSIONAL SOLICITANTE</span>
                  <div className="apac-field-value">{doctorName.toUpperCase()}</div>
                </td>
                <td>
                  <span className="apac-field-label">39 — DATA DA SOLICITAÇÃO</span>
                  <div className="apac-field-value">{todayFormatted}</div>
                </td>
                <td>
                  <span className="apac-field-label">42 — ASSINATURA E CARIMBO</span>
                  <div style={{ height: "30px" }}></div>
                </td>
              </tr>
              <tr>
                <td>
                  <span className="apac-field-label">40 — DOCUMENTO</span>
                  <div className="apac-field-value">(X) CPF &nbsp;&nbsp; ( ) CNS</div>
                </td>
                <td colSpan={3}>
                  <span className="apac-field-label">41 — Nº DOCUMENTO DO PROFISSIONAL SOLICITANTE</span>
                  <div className="apac-field-value" style={{ fontFamily: "monospace" }}>{doctorCPF} {doctorCRM ? `| CRM: ${doctorCRM}` : ""}</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Authorization (blank) */}
          <table className="apac-table" style={{ marginTop: "4px" }}>
            <tbody>
              <tr><td colSpan={4} className="apac-section-title">AUTORIZAÇÃO (PREENCHIMENTO PELO AUTORIZADOR)</td></tr>
              <tr>
                <td colSpan={2}>
                  <span className="apac-field-label">43 — NOME DO PROFISSIONAL AUTORIZADOR</span>
                  <div style={{ height: "16px" }}></div>
                </td>
                <td>
                  <span className="apac-field-label">44 — CÓD. ÓRGÃO EMISSOR</span>
                  <div style={{ height: "16px" }}></div>
                </td>
                <td>
                  <span className="apac-field-label">49 — Nº DA AUTORIZAÇÃO APAC</span>
                  <div style={{ height: "16px" }}></div>
                </td>
              </tr>
              <tr>
                <td>
                  <span className="apac-field-label">45 — DOCUMENTO</span>
                  <div className="apac-field-value">( ) CPF &nbsp;&nbsp; ( ) CNS</div>
                </td>
                <td>
                  <span className="apac-field-label">46 — Nº DOCUMENTO</span>
                  <div style={{ height: "16px" }}></div>
                </td>
                <td>
                  <span className="apac-field-label">47 — DATA DA AUTORIZAÇÃO</span>
                  <div style={{ height: "16px" }}></div>
                </td>
                <td>
                  <span className="apac-field-label">48 — ASSINATURA E CARIMBO</span>
                  <div style={{ height: "30px" }}></div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default RequisicaoImagensPage;
