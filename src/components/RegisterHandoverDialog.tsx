import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { Patient } from "@/types/patient";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { useDepartment } from "@/contexts/DepartmentContext";

interface RegisterHandoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: Patient[];
}

export function RegisterHandoverDialog({ open, onOpenChange, patients }: RegisterHandoverDialogProps) {
  const [notes, setNotes] = useState("");
  const [shiftType, setShiftType] = useState<string>("MATUTINO");
  const [handoverFrom, setHandoverFrom] = useState("");
  const [handoverTo, setHandoverTo] = useState("");
  const [handoverDatetime, setHandoverDatetime] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { currentDepartment } = useDepartment();

  const occupiedBeds = patients.filter(p => p.name.trim() !== "").length;
  const totalPatients = patients.length;

  const handleTranscription = (data: {
    summary: string;
    clinicalStatus: string;
    pendingProcedures: string;
    relevantObservations: string;
  }) => {
    // Combine all transcribed data into notes
    const combinedNotes = [
      data.summary,
      data.clinicalStatus && `STATUS CLÍNICO: ${data.clinicalStatus}`,
      data.pendingProcedures && `PENDÊNCIAS: ${data.pendingProcedures}`,
      data.relevantObservations && `OBSERVAÇÕES: ${data.relevantObservations}`,
    ]
      .filter(Boolean)
      .join('\n\n')
      .toUpperCase();
    
    setNotes(combinedNotes);
  };

  const handleRegister = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para registrar uma passagem",
          variant: "destructive",
        });
        return;
      }

      const snapshotData = {
        timestamp: new Date().toISOString(),
        patients: patients.map(p => ({
          id: p.id,
          bedNumber: p.bedNumber,
          name: p.name,
          age: p.age,
          sector: p.sector,
          diagnoses: p.diagnoses,
          medicalHistory: p.medicalHistory,
          relevantExams: p.relevantExams,
          pendencies: p.pendencies,
          schedule: p.schedule,
          admissionHistory: p.admissionHistory,
          admissionDate: p.admissionDate,
        })),
        sectors: {
          red: patients.filter(p => p.sector === 'red').length,
          yellow: patients.filter(p => p.sector === 'yellow').length,
          blue: patients.filter(p => p.sector === 'blue').length,
          outside: patients.filter(p => p.sector === 'outside').length,
        }
      };

      const { error } = await (supabase as any)
        .from('shift_handovers')
        .insert({
          created_by: user.id,
          snapshot_data: snapshotData,
          notes: notes.trim() || null,
          total_patients: totalPatients,
          occupied_beds: occupiedBeds,
          shift_type: shiftType,
          handover_from: handoverFrom.trim().toUpperCase() || null,
          handover_to: handoverTo.trim().toUpperCase() || null,
          handover_datetime: new Date(handoverDatetime).toISOString(),
          department: currentDepartment,
        });

      if (error) throw error;

      toast({
        title: "Passagem registrada!",
        description: `Registro salvo com sucesso às ${new Date(handoverDatetime).toLocaleTimeString('pt-BR')}`,
      });

      setNotes("");
      setShiftType("MATUTINO");
      setHandoverFrom("");
      setHandoverTo("");
      setHandoverDatetime(new Date().toISOString().slice(0, 16));
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao registrar passagem:", error);
      toast({
        title: "Erro ao registrar passagem",
        description: "Não foi possível salvar o registro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            REGISTRAR PASSAGEM DE PLANTÃO
          </DialogTitle>
          <DialogDescription>
            Salve um snapshot do estado atual dos pacientes para consulta histórica
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Data e Hora */}
          <div className="space-y-2">
            <Label htmlFor="handover-datetime" className="uppercase text-sm font-semibold">
              Data e Hora da Passagem *
            </Label>
            <input
              id="handover-datetime"
              type="datetime-local"
              value={handoverDatetime}
              onChange={(e) => setHandoverDatetime(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 uppercase"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground uppercase">Leitos Ocupados</p>
              <p className="text-2xl font-bold text-foreground">{occupiedBeds}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground uppercase">Total de Leitos</p>
              <p className="text-2xl font-bold text-foreground">{totalPatients}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shift-type" className="uppercase text-sm font-semibold">
              Tipo de Plantão *
            </Label>
            <Select value={shiftType} onValueChange={setShiftType}>
              <SelectTrigger id="shift-type" className="uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MATUTINO" className="uppercase">MATUTINO</SelectItem>
                <SelectItem value="VESPERTINO" className="uppercase">VESPERTINO</SelectItem>
                <SelectItem value="NOTURNO" className="uppercase">NOTURNO</SelectItem>
                <SelectItem value="OUTRO" className="uppercase">OUTRO</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="handover-from" className="uppercase text-sm font-semibold">
              Passagem De (Médicos) - Opcional
            </Label>
            <input
              id="handover-from"
              type="text"
              value={handoverFrom}
              onChange={(e) => setHandoverFrom(e.target.value.toUpperCase())}
              placeholder="NOMES DOS MÉDICOS SEPARADOS POR VÍRGULA"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 uppercase"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="handover-to" className="uppercase text-sm font-semibold">
              Passagem Para (Médicos) - Opcional
            </Label>
            <input
              id="handover-to"
              type="text"
              value={handoverTo}
              onChange={(e) => setHandoverTo(e.target.value.toUpperCase())}
              placeholder="NOMES DOS MÉDICOS SEPARADOS POR VÍRGULA"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 uppercase"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="notes" className="uppercase text-sm font-semibold">
                Observações - Opcional
              </Label>
              <VoiceRecorder onTranscriptionComplete={handleTranscription} />
            </div>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.toUpperCase())}
              placeholder="ADICIONE OBSERVAÇÕES SOBRE ESTA PASSAGEM OU USE O BOTÃO DE VOZ..."
              className="min-h-[100px] resize-none uppercase"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            CANCELAR
          </Button>
          <Button
            onClick={handleRegister}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                REGISTRANDO...
              </>
            ) : (
              <>
                <ClipboardCheck className="h-4 w-4" />
                REGISTRAR PASSAGEM
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
