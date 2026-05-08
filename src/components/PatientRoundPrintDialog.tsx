import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Printer, ClipboardCheck, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import PrintableRoundMulti, { type RoundPrintItem } from "./PrintableRoundMulti";
import { ROUND_SECTIONS, type RoundStatus } from "@/data/roundChecklistSchema";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SessionRow {
  id: string;
  round_date: string;
  observations: string | null;
  updated_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  patientSector: string;
  patientBed: string;
  patientAge?: string | number | null;
}

/**
 * Dialog individual para impressão do Round de UM paciente.
 * - Aba "Em branco": gera PDF só com identificação preenchida.
 * - Aba "Preenchido": lista as sessões salvas; usuário escolhe e imprime.
 */
export function PatientRoundPrintDialog({
  open, onOpenChange,
  patientId, patientName, patientSector, patientBed, patientAge,
}: Props) {
  const [tab, setTab] = useState<"blank" | "filled">("blank");
  const [blankDate, setBlankDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [filledItem, setFilledItem] = useState<RoundPrintItem | null>(null);
  const [loadingFilled, setLoadingFilled] = useState(false);
  const [printing, setPrinting] = useState<"blank" | "filled" | null>(null);

  // Carrega sessões ao abrir
  useEffect(() => {
    if (!open || !patientId) return;
    let cancelled = false;
    (async () => {
      setLoadingSessions(true);
      const { data } = await supabase
        .from("round_sessions")
        .select("id, round_date, observations, updated_at")
        .eq("patient_id", patientId)
        .order("round_date", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(50);
      if (!cancelled) {
        setSessions((data as SessionRow[]) || []);
        setLoadingSessions(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, patientId]);

  const ageStr = patientAge != null ? String(patientAge) : null;

  const blankItem: RoundPrintItem = useMemo(() => ({
    patientName, patientSector, patientBed, patientAge: ageStr, roundDate: blankDate,
  }), [patientName, patientSector, patientBed, ageStr, blankDate]);

  const handlePrintBlank = () => {
    setPrinting("blank");
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrinting(null), 500);
    }, 100);
  };

  const loadAndPrintSession = async (sessionId: string) => {
    setLoadingFilled(true);
    setSelectedSessionId(sessionId);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) { setLoadingFilled(false); return; }
    const [{ data: respData }, { data: goalData }] = await Promise.all([
      supabase.from("round_responses").select("*").eq("session_id", sessionId),
      supabase.from("round_section_goals").select("*").eq("session_id", sessionId),
    ]);
    const responses: Record<string, { status: RoundStatus | null; observation: string }> = {};
    (respData as any[] | null)?.forEach((r) => {
      responses[`${r.section_code}_${r.item_id}`] = {
        status: r.status as RoundStatus,
        observation: r.observation || "",
      };
    });
    const goals: Record<string, string> = {};
    (goalData as any[] | null)?.forEach((g) => { goals[g.section_code] = g.goal || ""; });
    setFilledItem({
      patientName, patientSector, patientBed, patientAge: ageStr,
      roundDate: session.round_date,
      responses, goals,
      observations: session.observations || "",
    });
    setLoadingFilled(false);
    setPrinting("filled");
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrinting(null), 500);
    }, 150);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Round Multiprofissional
            </DialogTitle>
            <DialogDescription>
              <span className="font-mono font-bold mr-2">{patientBed}</span>
              {patientName}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="blank">
                <FileText className="h-4 w-4 mr-2" /> Em branco
              </TabsTrigger>
              <TabsTrigger value="filled">
                <ClipboardCheck className="h-4 w-4 mr-2" /> Preenchido
              </TabsTrigger>
            </TabsList>

            <TabsContent value="blank" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Gera o PDF com apenas a identificação preenchida (paciente, leito, setor, idade)
                e os campos do Round em branco para preenchimento manual à beira-leito.
              </p>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-muted-foreground">Data do round:</label>
                <Input type="date" value={blankDate} onChange={(e) => setBlankDate(e.target.value)} className="h-8 w-44" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button onClick={handlePrintBlank} disabled={printing !== null}>
                  <Printer className="h-4 w-4 mr-2" /> Imprimir em branco
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="filled" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Selecione uma sessão de Round salva para imprimir com os dados preenchidos:
              </p>
              <div className="border rounded-md">
                <ScrollArea className="h-[280px]">
                  {loadingSessions ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 inline-block animate-spin mr-2" /> Carregando sessões...
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      Nenhuma sessão de round salva para este paciente.
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {sessions.map((s) => {
                        const dt = (() => {
                          try { return format(new Date(s.round_date + "T12:00:00"), "dd/MM/yyyy"); }
                          catch { return s.round_date; }
                        })();
                        const upd = (() => {
                          try { return format(new Date(s.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
                          catch { return ""; }
                        })();
                        return (
                          <li key={s.id}>
                            <button
                              type="button"
                              disabled={loadingFilled}
                              onClick={() => loadAndPrintSession(s.id)}
                              className={cn(
                                "w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition",
                                selectedSessionId === s.id && "bg-primary/5"
                              )}
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold">{dt}</div>
                                <div className="text-[11px] text-muted-foreground">Atualizado em {upd}</div>
                              </div>
                              {loadingFilled && selectedSessionId === s.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              ) : (
                                <Printer className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </ScrollArea>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Clique em uma sessão para imprimir imediatamente.
              </p>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Conteúdo de impressão (display:none na tela, visível só em @media print). */}
      {printing === "blank" && <PrintableRoundMulti items={[blankItem]} blank />}
      {printing === "filled" && filledItem && <PrintableRoundMulti items={[filledItem]} />}
    </>
  );
}

export default PatientRoundPrintDialog;
