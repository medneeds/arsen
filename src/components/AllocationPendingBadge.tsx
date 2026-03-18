import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, CheckCircle, XCircle, MessageSquare, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Patient } from "@/types/patient";
import { useBedAllocationRequests } from "@/hooks/useBedAllocationRequests";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AllocationPendingBadgeProps {
  patient: Patient;
  onStatusChange?: () => void;
}

export function AllocationPendingBadge({ patient, onStatusChange }: AllocationPendingBadgeProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSettingDiscussing, setIsSettingDiscussing] = useState(false);
  const { requests, approveRequest, setDiscussing, refetch } = useBedAllocationRequests();
  const { role } = useAuth();
  const navigate = useNavigate();
  
  // Find request for this patient
  const patientRequest = requests.find(r => r.patient_id === patient.id);
  
  // Use patient's allocation status as primary source
  const status = patient.allocationStatus;
  
  // Don't show badge if no status, status is approved, or patient is no longer a door patient
  if (!status || status === 'approved' || !patient.isDoorPatient) return null;

  // Check if user can take actions (admin = COORDENADOR, medico = LIDER)
  const canTakeAction = role === 'admin' || role === 'medico';

  const statusConfig = {
    pending: {
      icon: Clock,
      label: "Aguardando Aprovação",
      description: "Solicitação enviada, aguardando análise do líder",
      className: "bg-amber-500/20 text-amber-500 border-amber-500/30 hover:bg-amber-500/30",
      iconClassName: "text-amber-500",
      pulseClassName: "animate-pulse",
    },
    discussing: {
      icon: MessageSquare,
      label: "Em Discussão",
      description: "O caso está sendo discutido pela equipe",
      className: "bg-sky-500/20 text-sky-500 border-sky-500/30 hover:bg-sky-500/30",
      iconClassName: "text-sky-500",
      pulseClassName: "",
    },
    rejected: {
      icon: XCircle,
      label: "Negado",
      description: "A solicitação foi negada",
      className: "bg-red-500/20 text-red-500 border-red-500/30 hover:bg-red-500/30",
      iconClassName: "text-red-500",
      pulseClassName: "",
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig];
  if (!config) return null;

  const Icon = config.icon;

  // Check if this is a UTI sector allocation
  const isUtiAllocation = () => {
    if (!patientRequest) return false;
    const utiSectors = ["UTI 1", "UTI 2", "red", "yellow"];
    return utiSectors.includes(patientRequest.requested_sector) || patientRequest.department === "UTI";
  };

  const handleApprove = async () => {
    if (!patientRequest?.id) return;
    setIsApproving(true);
    try {
      const isUti = isUtiAllocation();

      if (isUti) {
        const params = new URLSearchParams({
          fromAllocation: "true",
          allocationRequestId: patientRequest.id,
          patientId: patient.id,
          patientName: patient.name || "",
          patientAge: String(patient.age ?? ""),
          destinationSector: patientRequest.requested_sector || "",
        });

        setIsDialogOpen(false);
        navigate(`/saps3?${params.toString()}`);
        return;
      }

      const success = await approveRequest(patientRequest.id);
      if (success) {
        setIsDialogOpen(false);
        await refetch();
        onStatusChange?.();
      }
    } finally {
      setIsApproving(false);
    }
  };

  const handleSetDiscussing = async () => {
    if (!patientRequest?.id) return;
    setIsSettingDiscussing(true);
    try {
      const success = await setDiscussing(patientRequest.id);
      if (success) {
        setIsDialogOpen(false);
        await refetch();
        onStatusChange?.();
      }
    } finally {
      setIsSettingDiscussing(false);
    }
  };

  // If user can take action, show interactive badge
  if (canTakeAction && (status === 'pending' || status === 'discussing')) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`allocation-badge-trigger cursor-pointer transition-all ${config.className} ${config.pulseClassName} flex items-center gap-1.5 px-2 py-1 print:hidden`}
              onClick={(e) => {
                e.stopPropagation();
                setIsDialogOpen(true);
              }}
            >
              <Icon className={`h-3.5 w-3.5 ${config.iconClassName}`} />
              <span className="text-xs font-medium">{config.label}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">Clique para gerenciar a solicitação</p>
            {patientRequest?.requested_sector && (
              <p className="text-xs text-muted-foreground mt-1">
                Setor solicitado: {patientRequest.requested_sector}
              </p>
            )}
          </TooltipContent>
        </Tooltip>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${config.iconClassName}`} />
                Gerenciar Solicitação
              </DialogTitle>
              <DialogDescription>
                Escolha uma ação para esta solicitação de alocação
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Patient Info */}
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-full ${config.className}`}>
                    <Icon className={`h-5 w-5 ${config.iconClassName}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{patient.name || "Paciente"}</p>
                    {patient.age && <p className="text-sm text-muted-foreground">{patient.age}</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {patientRequest?.requested_sector && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Setor solicitado:</span>
                    <span className="font-medium">{patientRequest.requested_sector}</span>
                  </div>
                )}
                
                {patientRequest?.requesting_doctor_name && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Médico solicitante:</span>
                    <span className="font-medium">{patientRequest.requesting_doctor_name}</span>
                  </div>
                )}
                
                {patientRequest?.created_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Data da solicitação:</span>
                    <span className="font-medium">
                      {format(new Date(patientRequest.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {status === 'pending' && (
                <Button
                  variant="outline"
                  onClick={handleSetDiscussing}
                  disabled={isApproving || isSettingDiscussing}
                  className="w-full sm:w-auto border-sky-500/50 text-sky-500 hover:bg-sky-500/10"
                >
                  {isSettingDiscussing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Aguardando Discussão
                    </>
                  )}
                </Button>
              )}
              <Button
                onClick={handleApprove}
                disabled={isApproving || isSettingDiscussing}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aprovando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Aprovar Alocação
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    );
  }

  // For non-action users (porta, visitante), show read-only badge
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`transition-all ${config.className} ${config.pulseClassName} flex items-center gap-1.5 px-2 py-1`}
          >
            <Icon className={`h-3.5 w-3.5 ${config.iconClassName}`} />
            <span className="text-xs font-medium">{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{config.description}</p>
          {patientRequest?.requested_sector && (
            <p className="text-xs text-muted-foreground mt-1">
              Setor solicitado: {patientRequest.requested_sector}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}