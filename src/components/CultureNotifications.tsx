import React, { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Microscope, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

const CULTURE_TYPES: Record<string, string> = {
  hemocultura: "Hemocultura",
  urocultura: "Urocultura",
  cultura_secrecao: "Cultura de secreção",
  cultura_liquor: "Cultura de líquor",
  cultura_cateter: "Cultura de ponta de cateter",
  cultura_escarro: "Cultura de escarro",
  cultura_ferida: "Cultura de ferida",
  antibiograma: "Antibiograma",
  outro: "Outro",
};

interface CultureNotification {
  id: string;
  patient_name: string;
  patient_sector: string;
  patient_bed: string | null;
  culture_type: string;
  microorganism: string | null;
  antibiogram: string | null;
  result_text: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

export function CultureNotifications() {
  const { user, role } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const hospitalId = currentHospital?.id;
  const stateId = currentState?.id;

  const [notifications, setNotifications] = useState<CultureNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [viewDetail, setViewDetail] = useState<CultureNotification | null>(null);

  const accessProfile = typeof window !== "undefined" ? localStorage.getItem("access_profile") || "medico" : "medico";
  const activeSector = typeof window !== "undefined" ? localStorage.getItem("selected_sector") || "" : "";

  // Only show for doctors
  const isMedico = role === "medico" || accessProfile === "medico";

  const fetchUnread = useCallback(async () => {
    if (!hospitalId || !stateId || !isMedico) return;

    let query = supabase
      .from("culture_results")
      .select("id, patient_name, patient_sector, patient_bed, culture_type, microorganism, antibiogram, result_text, uploaded_by_name, created_at")
      .eq("hospital_unit_id", hospitalId)
      .eq("state_id", stateId)
      .eq("status", "completed")
      .eq("read_by_doctor", false)
      .order("created_at", { ascending: false })
      .limit(10);

    // Filter by sector if doctor has one selected
    if (activeSector) {
      query = query.eq("patient_sector", activeSector);
    }

    const { data } = await query;
    if (data) {
      setNotifications(data as CultureNotification[]);
    }
  }, [hospitalId, stateId, isMedico, activeSector]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  // Realtime subscription
  useEffect(() => {
    if (!hospitalId || !isMedico) return;
    const channel = supabase
      .channel("culture-notifications")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "culture_results",
        filter: `hospital_unit_id=eq.${hospitalId}`,
      }, () => fetchUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hospitalId, isMedico, fetchUnread]);

  const markAsRead = async (id: string) => {
    await supabase
      .from("culture_results")
      .update({ read_by_doctor: true, read_at: new Date().toISOString() } as any)
      .eq("id", id);

    setDismissed(prev => new Set(prev).add(id));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleView = (notif: CultureNotification) => {
    setViewDetail(notif);
    markAsRead(notif.id);
  };

  if (!isMedico) return null;

  const visibleNotifications = notifications.filter(n => !dismissed.has(n.id));

  if (visibleNotifications.length === 0 && !viewDetail) return null;

  return (
    <>
      {/* Pop-up notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {visibleNotifications.slice(0, 3).map((notif) => (
          <div
            key={notif.id}
            className={cn(
              "bg-background border-2 border-border rounded-lg p-3 shadow-md",
              "animate-in slide-in-from-right-5 fade-in-0 duration-300"
            )}
          >
            <div className="flex items-start gap-2">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-1">
                <Microscope className="h-4 w-4 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-foreground">Nova cultura disponível</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={() => markAsRead(notif.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs font-medium text-foreground truncate">{notif.patient_name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    {getSectorDisplayLabel(notif.patient_sector)} · {notif.patient_bed}
                  </Badge>
                  <span>{CULTURE_TYPES[notif.culture_type] || notif.culture_type}</span>
                </div>
                {notif.microorganism && (
                  <p className="text-xs text-critical-on-soft font-medium mt-1">
                    {notif.microorganism}
                  </p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-6 text-xs gap-1 w-full border-border text-foreground hover:bg-muted"
                  onClick={() => handleView(notif)}
                >
                  <Eye className="h-3 w-3" /> Ver resultado completo
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!viewDetail} onOpenChange={(open) => !open && setViewDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Microscope className="h-5 w-5 text-foreground" />
              Resultado de cultura — CCIH
            </DialogTitle>
            <DialogDescription>Registrado pela comissão de controle de infecção</DialogDescription>
          </DialogHeader>
          {viewDetail && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
                <p className="text-sm font-semibold text-foreground">{viewDetail.patient_name}</p>
                <div className="text-xs text-muted-foreground">
                  <span>{getSectorDisplayLabel(viewDetail.patient_sector)} · Leito {viewDetail.patient_bed}</span>
                  <span className="ml-3">{CULTURE_TYPES[viewDetail.culture_type] || viewDetail.culture_type}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Registrado em {format(new Date(viewDetail.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  {viewDetail.uploaded_by_name && ` por ${viewDetail.uploaded_by_name}`}
                </p>
              </div>

              {viewDetail.microorganism && (
                <div className="p-3 rounded-lg bg-critical-soft/50 border border-critical-border">
                  <p className="text-xs font-medium text-critical-on-soft mb-1">Microrganismo</p>
                  <p className="text-sm font-medium text-foreground">{viewDetail.microorganism}</p>
                </div>
              )}

              {viewDetail.antibiogram && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs font-medium text-foreground mb-1">Antibiograma</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{viewDetail.antibiogram}</p>
                </div>
              )}

              {viewDetail.result_text && (
                <div className="p-3 rounded-lg border bg-muted/30">
                  <p className="text-xs font-medium text-foreground mb-1">Observações</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{viewDetail.result_text}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
