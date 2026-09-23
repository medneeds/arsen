import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Clock, X, User, Bed, FileText, Stethoscope, Building, Activity, ClipboardList, FlaskConical, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useBedAllocationRequests, BedAllocationRequest } from "@/hooks/useBedAllocationRequests";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SlaBadge } from "@/components/sla/SlaBadge";

// Animation variants for staggered grid items
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      type: "spring" as const, 
      stiffness: 300, 
      damping: 24 
    }
  }
};

const admissionVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      type: "spring" as const, 
      stiffness: 400, 
      damping: 25 
    }
  }
};

// Inline clinical list display for read-only view (optimized for leader review)
interface InlineClinicalListProps {
  title: string;
  icon: React.ReactNode;
  content: string | null | undefined;
  accentColor: string;
}

function InlineClinicalList({ title, icon, content, accentColor }: InlineClinicalListProps) {
  if (!content) return null;
  
  const lines = content.split('\n').filter(Boolean);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className={`text-xs font-medium uppercase tracking-wide text-${accentColor}`}>{title}</span>
        <Badge variant="secondary" className="text-xs h-3.5 px-1">
          {lines.length}
        </Badge>
      </div>
      <div className="space-y-1">
        {lines.map((line, index) => (
          <div key={index} className="flex items-start gap-2 text-sm">
            <span className="text-muted-foreground text-xs font-mono">{index + 1}.</span>
            <span className="leading-snug">{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Inline admission history for read-only view
interface InlineAdmissionHistoryProps {
  content: string | null | undefined;
}

function InlineAdmissionHistory({ content }: InlineAdmissionHistoryProps) {
  if (!content) return null;
  
  return (
    <div className="rounded-lg border border-primary/30 overflow-hidden">
      <div className="p-3 bg-primary/10 flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium uppercase tracking-wide text-primary">História Admissional</span>
      </div>
      <div className="p-3 bg-primary/5">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {content}
        </p>
      </div>
    </div>
  );
}

export function BedAllocationNotifications() {
  const { role } = useAuth();
  const { currentHospital } = useHospital();
  const { requests, pendingCount, approveRequest, setDiscussing, rejectRequest, refetch } = useBedAllocationRequests();
  const { playNotificationSound } = useNotificationSound();
  const navigate = useNavigate();
  const [selectedRequest, setSelectedRequest] = useState<BedAllocationRequest | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [lastNotifiedId, setLastNotifiedId] = useState<string | null>(null);

  // Realtime pop-up notification for new requests
  useEffect(() => {
    if (!currentHospital?.id || role === "porta") return;

    const channel = supabase
      .channel("new-allocation-popup")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bed_allocation_requests",
          filter: `hospital_unit_id=eq.${currentHospital.id}`,
        },
        (payload) => {
          console.log("New allocation request"); // auditoria 18/09: payload continha dados do paciente
          if (payload.new.id !== lastNotifiedId) {
            setLastNotifiedId(payload.new.id as string);
            setShowPopup(true);
            playNotificationSound();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentHospital?.id, lastNotifiedId, playNotificationSound, role]);

  // Apenas LIDER e COORDENADOR veem as notificações
  if (role === "porta") return null;

  const pendingRequests = requests.filter(r => r.status === "pending");
  const discussingRequests = requests.filter(r => r.status === "discussing");

  // SAPS 3 só é exigido em UTI 1, UTI 2 e UCI 2 (setores monitorizados).
  const isUtiSector = (sector: string) => {
    const sapsRequiredSectors = ["UTI 1", "UTI 2", "UCI 2", "red", "yellow", "outside"];
    return sapsRequiredSectors.includes(sector);
  };

  const handleApprove = async (request: BedAllocationRequest) => {
    const isUti = isUtiSector(request.requested_sector);

    if (isUti && request.patient) {
      const params = new URLSearchParams({
        fromAllocation: "true",
        allocationRequestId: request.id,
        patientId: request.patient.id,
        patientName: request.patient.name || "",
        patientAge: String(request.patient.age ?? ""),
        destinationSector: request.requested_sector || "",
      });

      setSelectedRequest(null);
      navigate(`/saps3?${params.toString()}`);
      return;
    }

    const success = await approveRequest(request.id);
    if (success) {
      setSelectedRequest(null);
      await refetch();
    }
  };

  const handleDiscussing = async (request: BedAllocationRequest) => {
    const success = await setDiscussing(request.id);
    if (success) {
      setSelectedRequest(null);
      await refetch();
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    const success = await rejectRequest(selectedRequest.id, rejectReason);
    if (success) {
      setSelectedRequest(null);
      setShowRejectDialog(false);
      setRejectReason("");
      await refetch();
    }
  };

  const getSectorColor = (sector: string) => {
    switch (sector) {
      case "Cuidados Especiais":
        return "bg-critical/20 text-critical border-critical/30";
      case "Observação Amarela":
        return "bg-warning/20 text-warning border-warning/30";
      case "Observação Azul":
        return "bg-primary/20 text-muted-foreground border-border/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getSectorBorderColor = (sector: string) => {
    switch (sector) {
      case "Cuidados Especiais": return "border-l-red-500";
      case "Observação Amarela": return "border-l-yellow-500";
      case "Observação Azul": return "border-l-blue-500";
      default: return "border-l-muted";
    }
  };

  // Check if patient has any clinical data
  const hasAnyClinicalData = (patient: BedAllocationRequest['patient']) => {
    if (!patient) return false;
    return !!(
      patient.diagnoses || 
      patient.medical_history || 
      patient.relevant_exams || 
      patient.pendencies || 
      patient.admission_history
    );
  };

  return (
    <>
      {/* Pop-up notification for new requests */}
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="text-center pb-2">
            <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-warning/20 flex items-center justify-center">
              <Bed className="h-7 w-7 text-warning animate-pulse" />
            </div>
            <DialogTitle className="text-lg">
              Nova Solicitação de Alocação
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 py-2">
            {/* Where the patient is */}
            <div className="bg-primary/10 rounded-lg p-3 border border-border/20">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-sm">
                  Um médico da porta registrou um novo paciente. O paciente está atualmente na seção{" "}
                  <span className="font-medium text-foreground">"Fora das Alas"</span>, aguardando sua aprovação para alocação.
                </p>
              </div>
            </div>

            {/* What the leader can do */}
            <div className="bg-warning/10 rounded-lg p-3 border border-warning/20">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-warning/20 flex items-center justify-center shrink-0 mt-1">
                  <Clock className="h-3.5 w-3.5 text-warning" />
                </div>
                <p className="text-sm">
                  Você pode <span className="font-medium text-warning-on-soft">aguardar a discussão do caso</span> antes de decidir, ou <span className="font-medium text-released-on-soft">aprovar diretamente</span> a alocação para o setor solicitado.
                </p>
              </div>
            </div>

            {/* How to access */}
            <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                  <Bed className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-sm">
                  Para revisar, acesse{" "}
                  <span className="font-medium text-primary">"Solicitações de Alocação"</span>{" "}
                  clicando no ícone de leito no cabeçalho.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button 
              onClick={() => setShowPopup(false)} 
              className="w-full h-11"
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bed allocation icon with counter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-8 w-8 bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:border-white/40 transition-all duration-200" title="Solicitações de Alocação">
            <Bed className="h-4 w-4" />
            {pendingCount > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-warning text-white text-xs animate-pulse"
              >
                {pendingCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
          <div className="p-4 border-b">
            <h3 className="font-medium">Solicitações de Alocação</h3>
            <p className="text-sm text-muted-foreground">
              {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
            </p>
          </div>
          <ScrollArea className="h-[400px]">
            {pendingRequests.length === 0 && discussingRequests.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                Nenhuma solicitação pendente
              </div>
            ) : (
              <div className="divide-y">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">
                            {request.patient?.name || "Paciente"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Bed className="h-3 w-3 text-muted-foreground shrink-0" />
                          <Badge variant="outline" className={getSectorColor(request.requested_sector)}>
                            {request.requested_sector}
                          </Badge>
                        </div>
                        {request.requesting_doctor_name && (
                          <div className="flex items-center gap-2 mt-1 text-xs text-released-on-soft">
                            <Stethoscope className="h-3 w-3" />
                            <span>{request.requesting_doctor_name}</span>
                            {request.requesting_office_number && (
                              <span className="text-muted-foreground">• Cons. {request.requesting_office_number}</span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(request.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </p>
                          <SlaBadge startAt={request.created_at} thresholds={[60, 120, 180]} compact />
                        </div>
                      </div>
                      <Badge className="bg-warning/20 text-warning border-warning/30 shrink-0">
                        Pendente
                      </Badge>
                    </div>
                  </div>
                ))}
                {discussingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">
                            {request.patient?.name || "Paciente"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Bed className="h-3 w-3 text-muted-foreground shrink-0" />
                          <Badge variant="outline" className={getSectorColor(request.requested_sector)}>
                            {request.requested_sector}
                          </Badge>
                        </div>
                        {request.requesting_doctor_name && (
                          <div className="flex items-center gap-2 mt-1 text-xs text-released-on-soft">
                            <Stethoscope className="h-3 w-3" />
                            <span>{request.requesting_doctor_name}</span>
                            {request.requesting_office_number && (
                              <span className="text-muted-foreground">• Cons. {request.requesting_office_number}</span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(request.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </p>
                          <SlaBadge startAt={request.created_at} thresholds={[60, 120, 180]} compact />
                        </div>
                      </div>
                      <Badge className="bg-primary/20 text-muted-foreground border-border/30 shrink-0">
                        Em Discussão
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Request detail dialog - OPTIMIZED with collapsible sections */}
      <Dialog open={!!selectedRequest && !showRejectDialog} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
          {selectedRequest && (
            <>
              {/* Header with patient name and sector badge */}
              <div className={`bg-primary/10 p-4 border-b border-l-4 ${getSectorBorderColor(selectedRequest.requested_sector)}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold truncate">
                          {selectedRequest.patient?.name || "Paciente"}
                        </h2>
                        {selectedRequest.patient?.age && (
                          <p className="text-sm text-muted-foreground">{selectedRequest.patient.age}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`${getSectorColor(selectedRequest.requested_sector)} text-sm px-3 py-2 shrink-0`}
                  >
                    <Bed className="h-3.5 w-3.5 mr-2" />
                    {selectedRequest.requested_sector}
                  </Badge>
                </div>
                
                {/* Requesting Doctor Info */}
                {(selectedRequest.requesting_doctor_name || selectedRequest.requesting_office_number) && (
                  <div className="mt-3 p-3 rounded-lg bg-released/10 border border-released/20">
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <Stethoscope className="h-4 w-4 text-released-on-soft shrink-0" />
                      <span className="text-muted-foreground">Solicitante:</span>
                      <span className="font-medium text-released-on-soft">
                        {selectedRequest.requesting_doctor_name || "Não informado"}
                      </span>
                      {selectedRequest.requesting_office_number && (
                        <>
                          <span className="text-muted-foreground">|</span>
                          <Building className="h-3.5 w-3.5 text-released-on-soft shrink-0" />
                          <span className="text-muted-foreground">Consultório:</span>
                          <span className="font-medium text-released-on-soft">
                            {selectedRequest.requesting_office_number}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-3">
                  Solicitado em {format(new Date(selectedRequest.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>

              {/* Content area with clinical data - optimized grid layout for quick reading */}
              <ScrollArea className="flex-1 max-h-[50vh]">
                <motion.div 
                  className="p-4 space-y-4"
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                >
                  {/* No clinical data warning */}
                  {!hasAnyClinicalData(selectedRequest.patient) && (
                    <motion.div 
                      variants={itemVariants}
                      className="text-center py-6 px-4 rounded-lg border-2 border-dashed border-muted-foreground/20"
                    >
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 text-warning/60" />
                      <p className="text-sm text-muted-foreground font-medium">
                        Nenhuma informação clínica cadastrada
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        O médico da porta pode adicionar dados clínicos na "Edição Avançada" do paciente
                      </p>
                    </motion.div>
                  )}

                  {/* Admission History - Full width priority section */}
                  {selectedRequest.patient?.admission_history && (
                    <motion.div variants={admissionVariants}>
                      <InlineAdmissionHistory content={selectedRequest.patient?.admission_history} />
                    </motion.div>
                  )}

                  {/* Clinical data grid - 2 columns on larger screens */}
                  <motion.div 
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    variants={containerVariants}
                  >
                    {/* Left column: Diagnósticos + Antecedentes */}
                    <motion.div 
                      className="space-y-4 p-3 rounded-lg bg-muted/30"
                      variants={itemVariants}
                    >
                      <InlineClinicalList
                        title="Hipóteses / Diagnósticos"
                        icon={<Activity className="h-3.5 w-3.5 text-warning" />}
                        content={selectedRequest.patient?.diagnoses}
                        accentColor="amber-500"
                      />
                      <InlineClinicalList
                        title="Antecedentes / Comorbidades"
                        icon={<ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />}
                        content={selectedRequest.patient?.medical_history}
                        accentColor="purple-500"
                      />
                    </motion.div>

                    {/* Right column: Exames + Pendências */}
                    <motion.div 
                      className="space-y-4 p-3 rounded-lg bg-muted/30"
                      variants={itemVariants}
                    >
                      <InlineClinicalList
                        title="Plano Terapêutico"
                        icon={<FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />}
                        content={selectedRequest.patient?.relevant_exams}
                        accentColor="cyan-500"
                      />
                      <InlineClinicalList
                        title="Programações / Pendências"
                        icon={<AlertCircle className="h-3.5 w-3.5 text-warning" />}
                        content={selectedRequest.patient?.pendencies}
                        accentColor="orange-500"
                      />
                    </motion.div>
                  </motion.div>
                </motion.div>
              </ScrollArea>

              {/* Action buttons */}
              <div className="border-t bg-muted/20 p-4 mt-auto">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-11 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50"
                    onClick={() => setShowRejectDialog(true)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Negar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-11 border-border/30 text-muted-foreground hover:bg-primary/10 hover:border-border/50"
                    onClick={() => handleDiscussing(selectedRequest)}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Aguardando Discussão
                  </Button>
                  <Button
                    className="flex-1 h-11 bg-released hover:bg-released text-white shadow-md shadow-md"
                    onClick={() => handleApprove(selectedRequest)}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Aprovar Alocação
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject reason dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo da Negação</DialogTitle>
            <DialogDescription>
              Informe o motivo da negação (opcional)
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ex: Paciente não atende critérios para observação..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Confirmar Negação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
