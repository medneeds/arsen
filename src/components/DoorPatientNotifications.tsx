import { useEffect, useState } from "react";
import { Bell, Check, Clock, X } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBedAllocationRequests, BedAllocationRequest } from "@/hooks/useBedAllocationRequests";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function DoorPatientNotifications() {
  const { role, user } = useAuth();
  const { currentHospital } = useHospital();
  const { requests } = useBedAllocationRequests();
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [lastNotifiedId, setLastNotifiedId] = useState<string | null>(null);

  // Apenas médico da porta vê estas notificações
  if (role !== "porta") return null;

  // Filtra apenas solicitações do usuário atual
  const myRequests = requests.filter(r => r.requested_by === user?.id);
  const discussingCount = myRequests.filter(r => r.status === "discussing").length;
  const rejectedCount = myRequests.filter(r => r.status === "rejected").length;
  const notificationCount = discussingCount + rejectedCount;

  // Realtime notification for status changes
  useEffect(() => {
    if (!currentHospital?.id || !user?.id) return;

    const channel = supabase
      .channel("door-patient-notifications")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bed_allocation_requests",
          filter: `requested_by=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = payload.new.status as string;
          if (payload.new.id !== lastNotifiedId) {
            setLastNotifiedId(payload.new.id as string);
            
            if (newStatus === "discussing") {
              setPopupMessage("Sua solicitação está aguardando discussão do caso com o líder.");
              setShowPopup(true);
            } else if (newStatus === "rejected") {
              setPopupMessage("Sua solicitação de alocação foi negada. Verifique os detalhes.");
              setShowPopup(true);
            } else if (newStatus === "approved") {
              setPopupMessage("Sua solicitação foi aprovada! Paciente alocado no setor.");
              setShowPopup(true);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentHospital?.id, user?.id, lastNotifiedId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-500">Pendente</Badge>;
      case "approved":
        return <Badge className="bg-green-500/20 text-green-500">Aprovado</Badge>;
      case "discussing":
        return <Badge className="bg-blue-500/20 text-blue-500">Em Discussão</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-500">Negado</Badge>;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <Check className="h-4 w-4 text-green-500" />;
      case "discussing":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "rejected":
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <>
      {/* Pop-up notification */}
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Atualização de Solicitação
            </DialogTitle>
            <DialogDescription>{popupMessage}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <Button onClick={() => setShowPopup(false)}>Entendido</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bell icon with counter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-blue-500 text-white text-xs"
              >
                {notificationCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Minhas Solicitações</h3>
            <p className="text-sm text-muted-foreground">
              {myRequests.length} solicitaç{myRequests.length !== 1 ? "ões" : "ão"}
            </p>
          </div>
          <ScrollArea className="h-[300px]">
            {myRequests.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                Nenhuma solicitação enviada
              </div>
            ) : (
              <div className="divide-y">
                {myRequests.map((request) => (
                  <div key={request.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(request.status)}
                          <span className="font-medium truncate">
                            {request.patient?.name || "Paciente"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {request.requested_sector}
                        </p>
                        {request.status === "rejected" && request.rejection_reason && (
                          <p className="text-xs text-red-500 mt-1">
                            Motivo: {request.rejection_reason}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(request.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </>
  );
}
