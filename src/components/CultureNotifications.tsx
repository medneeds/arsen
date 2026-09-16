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

    // MIGRAÇÃO (Wave3): culture_results → resultados_cultura. As colunas
    // denormalizadas de paciente (patient_name/sector/bed) e uploaded_by_name não
    // existem → reconstruídas via join internacoes→pacientes/leitos/setores e
    // enviado_por→profissionais. Sem hospital_unit_id/state_id → filtro por
    // unidade removido (RLS escopa). Colunas: culture_type→tipo_cultura,
    // microorganism→microorganismo, antibiogram→antibiograma, result_text→
    // resultado_texto, read_by_doctor→lido_pelo_medico, created_at→criado_em.
    const { data } = await supabase
      .from("resultados_cultura")
      .select(`
        id, tipo_cultura, microorganismo, antibiograma, resultado_texto, criado_em,
        enviado:profissionais!resultados_cultura_enviado_por_fkey(nome),
        internacao:internacoes!resultados_cultura_internacao_id_fkey(
          paciente:pacientes(nome_completo, nome_social),
          leito:leitos(numero),
          setor:setores(tipo, nome)
        )
      `)
      .eq("status", "completed")
      .eq("lido_pelo_medico", false)
      .order("criado_em", { ascending: false })
      .limit(10);

    if (data) {
      let mapped: CultureNotification[] = (data as any[]).map((row) => {
        const internacao = row.internacao || {};
        const paciente = internacao.paciente || {};
        return {
          id: row.id,
          patient_name: paciente.nome_social || paciente.nome_completo || "",
          patient_sector: internacao.setor?.tipo || "",
          patient_bed: internacao.leito?.numero || null,
          culture_type: row.tipo_cultura,
          microorganism: row.microorganismo,
          antibiogram: row.antibiograma,
          result_text: row.resultado_texto,
          uploaded_by_name: row.enviado?.nome || null,
          created_at: row.criado_em,
        };
      });
      // MIGRAÇÃO: filtro por setor do médico feito client-side (setor.tipo),
      // pois resultados_cultura não tem coluna de setor do paciente.
      if (activeSector) mapped = mapped.filter((n) => n.patient_sector === activeSector);
      setNotifications(mapped);
    }
  }, [hospitalId, stateId, isMedico, activeSector]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  // Realtime subscription
  useEffect(() => {
    if (!hospitalId || !isMedico) return;
    // MIGRAÇÃO: realtime em resultados_cultura. Sem coluna hospital_unit_id →
    // sem filtro por unidade (RLS escopa); refetch por evento.
    const channel = supabase
      .channel("culture-notifications")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "resultados_cultura",
      }, () => fetchUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hospitalId, isMedico, fetchUnread]);

  const markAsRead = async (id: string) => {
    // MIGRAÇÃO: read_by_doctor→lido_pelo_medico, read_at→lido_em.
    await supabase
      .from("resultados_cultura")
      .update({ lido_pelo_medico: true, lido_em: new Date().toISOString() } as any)
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
              "bg-background border-2 border-violet-400 rounded-xl p-3 shadow-2xl",
              "animate-in slide-in-from-right-5 fade-in-0 duration-300"
            )}
          >
            <div className="flex items-start gap-2">
              <div className="p-1.5 rounded-lg bg-violet-500/10 shrink-0 mt-0.5">
                <Microscope className="h-4 w-4 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-bold text-foreground">Nova cultura disponível</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={() => markAsRead(notif.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-[11px] font-semibold text-foreground truncate">{notif.patient_name}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Badge variant="outline" className="text-[9px]">
                    {getSectorDisplayLabel(notif.patient_sector)} · {notif.patient_bed}
                  </Badge>
                  <span>{CULTURE_TYPES[notif.culture_type] || notif.culture_type}</span>
                </div>
                {notif.microorganism && (
                  <p className="text-[10px] text-red-600 font-semibold mt-1">
                    🦠 {notif.microorganism}
                  </p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-6 text-[10px] gap-1 w-full border-violet-200 text-violet-700 hover:bg-violet-50"
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
              <Microscope className="h-5 w-5 text-violet-600" />
              Resultado de cultura — CCIH
            </DialogTitle>
            <DialogDescription>Registrado pela comissão de controle de infecção</DialogDescription>
          </DialogHeader>
          {viewDetail && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
                <p className="text-sm font-bold text-foreground">{viewDetail.patient_name}</p>
                <div className="text-xs text-muted-foreground">
                  <span>{getSectorDisplayLabel(viewDetail.patient_sector)} · Leito {viewDetail.patient_bed}</span>
                  <span className="ml-3">{CULTURE_TYPES[viewDetail.culture_type] || viewDetail.culture_type}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Registrado em {format(new Date(viewDetail.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  {viewDetail.uploaded_by_name && ` por ${viewDetail.uploaded_by_name}`}
                </p>
              </div>

              {viewDetail.microorganism && (
                <div className="p-3 rounded-lg bg-red-50/50 border border-red-200 dark:bg-red-500/5 dark:border-red-500/20">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-0.5">Microrganismo</p>
                  <p className="text-sm font-medium text-foreground">{viewDetail.microorganism}</p>
                </div>
              )}

              {viewDetail.antibiogram && (
                <div className="p-3 rounded-lg bg-violet-50/50 border border-violet-200 dark:bg-violet-500/5 dark:border-violet-500/20">
                  <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-0.5">Antibiograma</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{viewDetail.antibiogram}</p>
                </div>
              )}

              {viewDetail.result_text && (
                <div className="p-3 rounded-lg border bg-muted/30">
                  <p className="text-xs font-semibold text-foreground mb-0.5">Observações</p>
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
