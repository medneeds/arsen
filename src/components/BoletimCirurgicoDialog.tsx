import { useState, useEffect } from "react";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Printer } from "lucide-react";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";
import { usePatientLive } from "@/hooks/usePatientLive";
import {
  useBoletimCirurgico,
  type BoletimCarater,
  type BoletimDestino,
} from "@/hooks/useBoletimCirurgico";
import { printBoletimCirurgico } from "@/lib/boletimCirurgico";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string | null;
  patientName: string;
  patientBed?: string;
  patientSector?: string;
  hospitalName?: string;
}

export function BoletimCirurgicoDialog({
  open, onOpenChange, patientId, patientName, patientBed, patientSector, hospitalName,
}: Props) {
  const doctor = useCurrentDoctor();
  const { patient } = usePatientLive(patientId);
  const { save } = useBoletimCirurgico(patientId, patientName);

  // Dados cadastrais complementares (nascimento/prontuario) — mesmo caminho do
  // MedicalDocumentDialog: internacoes → pacientes. `patientId` e internacoes.id.
  const [patientRegistry, setPatientRegistry] = useState<{ birth_date?: string | null; medical_record?: string | null } | null>(null);
  useEffect(() => {
    if (!patientId) return;
    supabase
      .from("internacoes")
      .select("paciente:pacientes(data_nascimento, prontuario)")
      .eq("id", patientId)
      .maybeSingle()
      .then(({ data }) => {
        const pac = (data as { paciente?: { data_nascimento?: string | null; prontuario?: string | null } | null } | null)?.paciente;
        if (!pac) return;
        setPatientRegistry({ birth_date: pac.data_nascimento ?? null, medical_record: pac.prontuario ?? null });
      });
  }, [patientId]);

  const [passwordOpen, setPasswordOpen] = useState(false);

  // Campos do boletim
  const [procedimentoProposto, setProcedimentoProposto] = useState("");
  const [procedimentoRealizado, setProcedimentoRealizado] = useState("");
  const [cirurgiaoPrincipal, setCirurgiaoPrincipal] = useState("");
  const [auxiliares, setAuxiliares] = useState("");
  const [anestesista, setAnestesista] = useState("");
  const [tipoAnestesia, setTipoAnestesia] = useState("");
  const [carater, setCarater] = useState<BoletimCarater | "">("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [achados, setAchados] = useState("");
  const [intercorrencias, setIntercorrencias] = useState("");
  const [sangramento, setSangramento] = useState("");
  const [materiais, setMateriais] = useState("");
  const [destino, setDestino] = useState<BoletimDestino | "">("");

  const reset = () => {
    setProcedimentoProposto(""); setProcedimentoRealizado("");
    setCirurgiaoPrincipal(""); setAuxiliares(""); setAnestesista("");
    setTipoAnestesia(""); setCarater(""); setInicio(""); setFim("");
    setAchados(""); setIntercorrencias(""); setSangramento("");
    setMateriais(""); setDestino("");
  };

  const close = () => { reset(); onOpenChange(false); };

  const handlePrint = async () => {
    if (!procedimentoRealizado.trim()) {
      toast.error("Informe o procedimento realizado antes de imprimir");
      return;
    }

    // Grava PRIMEIRO (mesma rastreabilidade dos demais documentos). Se o save
    // falhar, nada e impresso.
    const data = {
      internacao_id: patientId ?? null,
      patient_name: patientName,
      patient_bed: patientBed ?? null,
      patient_sector: patientSector ?? null,
      patient_age: patient?.age ? String(patient.age) : null,
      patient_birth_date: patientRegistry?.birth_date ?? null,
      patient_medical_record: patientRegistry?.medical_record ?? null,
      procedimento_proposto: procedimentoProposto || null,
      procedimento_realizado: procedimentoRealizado,
      cirurgiao_principal: cirurgiaoPrincipal || null,
      auxiliares: auxiliares || null,
      anestesista: anestesista || null,
      tipo_anestesia: tipoAnestesia || null,
      carater: carater || null,
      data_hora_inicio: inicio || null,
      data_hora_fim: fim || null,
      achados_operatorios: achados || null,
      intercorrencias: intercorrencias || null,
      sangramento_estimado: sangramento || null,
      materiais_opme: materiais || null,
      destino_pos_operatorio: destino || null,
      signed_by_name: doctor.fullName || null,
      signed_by_crm: doctor.crm || null,
    };

    const savedId = await save(data);
    if (!savedId) return;

    await printBoletimCirurgico(data, {
      hospitalName,
      doctorName: doctor.fullName,
      doctorCrm: doctor.crm,
      doctorSpecialty: doctor.specialty,
    });
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="max-w-2xl" onInteractOutside={(e) => { e.preventDefault(); close(); }}>
        <DialogHeader>
          <DialogTitle className="normal-case">Boletim cirurgico</DialogTitle>
          <DialogDescription className="normal-case">
            {`Para ${(patientName || "").toUpperCase()}${patientBed ? ` • leito ${patientBed}` : ""}`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Carater</Label>
                <Select value={carater} onValueChange={(v) => setCarater(v as BoletimCarater)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eletivo">Eletivo</SelectItem>
                    <SelectItem value="urgencia">Urgencia</SelectItem>
                    <SelectItem value="emergencia">Emergencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Destino pos-operatorio</Label>
                <Select value={destino} onValueChange={(v) => setDestino(v as BoletimDestino)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rpa">RPA (recuperacao pos-anestesica)</SelectItem>
                    <SelectItem value="uti">UTI</SelectItem>
                    <SelectItem value="enfermaria">Enfermaria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Procedimento proposto</Label>
              <Textarea value={procedimentoProposto} onChange={(e) => setProcedimentoProposto(e.target.value)} rows={2} className="mt-1" placeholder="Procedimento indicado / planejado" />
            </div>

            <div>
              <Label className="text-xs">Procedimento realizado *</Label>
              <Textarea value={procedimentoRealizado} onChange={(e) => setProcedimentoRealizado(e.target.value)} rows={2} className="mt-1" placeholder="Procedimento efetivamente realizado (obrigatorio)" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cirurgiao principal</Label>
                <Input value={cirurgiaoPrincipal} onChange={(e) => setCirurgiaoPrincipal(e.target.value)} className="h-9 mt-1" placeholder="Nome / CRM" />
              </div>
              <div>
                <Label className="text-xs">Auxiliares</Label>
                <Input value={auxiliares} onChange={(e) => setAuxiliares(e.target.value)} className="h-9 mt-1" placeholder="Nomes separados por virgula" />
              </div>
              <div>
                <Label className="text-xs">Anestesista</Label>
                <Input value={anestesista} onChange={(e) => setAnestesista(e.target.value)} className="h-9 mt-1" placeholder="Nome / CRM" />
              </div>
              <div>
                <Label className="text-xs">Tipo de anestesia</Label>
                <Input value={tipoAnestesia} onChange={(e) => setTipoAnestesia(e.target.value)} className="h-9 mt-1" placeholder="Geral, raqui, local..." />
              </div>
              <div>
                <Label className="text-xs">Inicio</Label>
                <Input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-9 mt-1" />
              </div>
              <div>
                <Label className="text-xs">Termino</Label>
                <Input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} className="h-9 mt-1" />
              </div>
              <div>
                <Label className="text-xs">Sangramento estimado</Label>
                <Input value={sangramento} onChange={(e) => setSangramento(e.target.value)} className="h-9 mt-1" placeholder="Ex: 200 mL" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Achados operatorios</Label>
              <Textarea value={achados} onChange={(e) => setAchados(e.target.value)} rows={3} className="mt-1" placeholder="Descricao dos achados" />
            </div>

            <div>
              <Label className="text-xs">Intercorrencias</Label>
              <Textarea value={intercorrencias} onChange={(e) => setIntercorrencias(e.target.value)} rows={2} className="mt-1" placeholder="Intercorrencias intra-operatorias (se houver)" />
            </div>

            <div>
              <Label className="text-xs">Materiais / OPME</Label>
              <Textarea value={materiais} onChange={(e) => setMateriais(e.target.value)} rows={2} className="mt-1" placeholder="Materiais, orteses, proteses e especiais utilizados" />
            </div>

            {/* Signing doctor */}
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs flex items-center justify-between">
              <div>
                <b className="text-foreground">Assinatura: </b>
                {doctor.fullName ? doctor.fullName.toUpperCase() : <span className="text-destructive">medico nao identificado</span>}
              </div>
              {doctor.crm && <Badge variant="outline" className="text-xs">CRM {doctor.crm}</Badge>}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button onClick={() => setPasswordOpen(true)}>
            <Printer className="h-4 w-4 mr-2" /> Gerar e imprimir
          </Button>

          <PasswordConfirmDialog
            open={passwordOpen}
            onOpenChange={setPasswordOpen}
            title="Confirmar emissao do boletim cirurgico"
            description="Confirme sua identidade para gerar e assinar o boletim."
            actionLabel="Confirmar e gerar"
            onConfirmed={async () => {
              setPasswordOpen(false);
              await handlePrint();
            }}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
