import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, Loader2, UserX, Stethoscope, Clock, Phone, FileWarning,
  ArrowRight, Zap,
} from "lucide-react";

export interface TriageExpressPayload {
  /** Nome (parcial ou completo). Vazio = NÃO IDENTIFICADO */
  partialName: string;
  sex: "M" | "F" | "I";
  approxAge: string;        // texto livre: "60a", "ADULTO", "RN", etc.
  chiefComplaint: string;   // queixa principal rápida
  arrivalMode: string;      // "espontâneo" | "SAMU" | "PM" | etc.
  contactPhone: string;
  documentsPending: boolean;
  destinationValue: string; // value do DESTINATION_SECTORS
  observations: string;
}

interface SectorOption {
  value: string;
  label: string;
  group: string;
  color: string;
  isTriage?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sectors: SectorOption[];
  groups: string[];
  onConfirm: (payload: TriageExpressPayload) => Promise<void> | void;
  loading?: boolean;
}

const ARRIVAL_MODES = [
  "ESPONTÂNEO",
  "SAMU 192",
  "POLÍCIA MILITAR",
  "BOMBEIROS",
  "TRANSF. INTERHOSPITALAR",
  "FAMILIAR / TERCEIRO",
];

export function TriageExpressDialog({
  open, onOpenChange, sectors, groups, onConfirm, loading = false,
}: Props) {
  const [partialName, setPartialName] = useState("");
  const [sex, setSex] = useState<"M" | "F" | "I">("I");
  const [approxAge, setApproxAge] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [arrivalMode, setArrivalMode] = useState("ESPONTÂNEO");
  const [contactPhone, setContactPhone] = useState("");
  const [documentsPending, setDocumentsPending] = useState(true); // padrão: marcado
  const [destinationValue, setDestinationValue] = useState("triagem");
  const [observations, setObservations] = useState("");

  // Reset ao reabrir
  useEffect(() => {
    if (open) {
      setPartialName("");
      setSex("I");
      setApproxAge("");
      setChiefComplaint("");
      setArrivalMode("ESPONTÂNEO");
      setContactPhone("");
      setDocumentsPending(true);
      setDestinationValue("triagem");
      setObservations("");
    }
  }, [open]);

  const selectedSector = useMemo(
    () => sectors.find((s) => s.value === destinationValue),
    [sectors, destinationValue]
  );

  const handleSubmit = async () => {
    await onConfirm({
      partialName: partialName.trim(),
      sex,
      approxAge: approxAge.trim(),
      chiefComplaint: chiefComplaint.trim(),
      arrivalMode,
      contactPhone: contactPhone.trim(),
      documentsPending,
      destinationValue,
      observations: observations.trim(),
    });
  };

  const isFullyIdentified = partialName.trim().split(/\s+/).filter(Boolean).length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        {/* Header com gradiente de urgência */}
        <div className="bg-gradient-to-r from-rose-600 to-red-600 text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-white">
              <Zap className="h-5 w-5" />
              Triagem Express — Pré-identificação
            </DialogTitle>
            <DialogDescription className="text-rose-50/90 text-xs">
              Pergunte rapidamente o que conseguir. Tudo é opcional. Você pode finalizar e direcionar mesmo sem documentos.
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[65vh]">
          <div className="px-5 py-4 space-y-4">
            {/* Bloco 1 — Identificação parcial */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Identificação rápida (opcional)
                </h3>
                {!isFullyIdentified && partialName.trim() && (
                  <Badge variant="outline" className="text-[9px] h-4 border-amber-500/40 text-amber-700 dark:text-amber-400">
                    parcial
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1.5">
                  <Label htmlFor="te-name" className="text-xs">Nome do paciente</Label>
                  <Input
                    id="te-name"
                    placeholder="Ex.: JOÃO ou JOÃO DA SILVA SANTOS"
                    value={partialName}
                    onChange={(e) => setPartialName(e.target.value.toUpperCase())}
                    autoFocus
                    className="font-medium"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Vazio = paciente NÃO IDENTIFICADO (gera código NI automático).
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Sexo</Label>
                  <Select value={sex} onValueChange={(v) => setSex(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="I">Não informado</SelectItem>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="te-age" className="text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Idade aproximada
                  </Label>
                  <Input
                    id="te-age"
                    placeholder="Ex.: 60a, ADULTO, IDOSO, RN"
                    value={approxAge}
                    onChange={(e) => setApproxAge(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="te-phone" className="text-xs flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Contato (acompanhante)
                  </Label>
                  <Input
                    id="te-phone"
                    placeholder="(99) 99999-9999"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Modo de chegada</Label>
                  <Select value={arrivalMode} onValueChange={setArrivalMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ARRIVAL_MODES.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Bloco 2 — Queixa rápida */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Queixa principal (orienta a triagem)
                </h3>
              </div>
              <Textarea
                placeholder="Ex.: DOR TORÁCICA INTENSA, REBAIXAMENTO DE CONSCIÊNCIA, TRAUMA EM MMII…"
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value.toUpperCase())}
                rows={2}
              />
            </section>

            {/* Bloco 3 — Pendência */}
            <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={documentsPending}
                  onCheckedChange={(c) => setDocumentsPending(Boolean(c))}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <FileWarning className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium">Marcar como documentação pendente</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    O atendimento aparecerá no painel da Recepção com um indicador
                    de pendência (CPF, CNS, RG ou nome completo) para complementação posterior.
                  </p>
                </div>
              </label>
            </section>

            {/* Bloco 4 — Destino */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Direcionamento do atendimento
                </h3>
              </div>

              <div className="space-y-3">
                {groups.map((group) => (
                  <div key={group}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
                      {group}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                      {sectors.filter((s) => s.group === group).map((sector) => (
                        <button
                          key={sector.value}
                          type="button"
                          onClick={() => setDestinationValue(sector.value)}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-md border text-left transition-all hover:bg-accent/50",
                            destinationValue === sector.value && "ring-2 ring-primary bg-primary/5 border-primary/30"
                          )}
                        >
                          <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", sector.color)} />
                          <span className="text-xs font-medium truncate">{sector.label}</span>
                          {sector.isTriage && (
                            <Badge variant="secondary" className="ml-auto text-[8px] h-3.5 px-1">
                              recomendado
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {selectedSector && !selectedSector.isTriage && (
                <div className="text-[11px] rounded-md bg-sky-500/10 border border-sky-500/30 p-2 flex items-start gap-2 text-sky-700 dark:text-sky-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Direcionamento direto para <strong>{selectedSector.label}</strong> — gera pré-admissão e pula a fila de triagem.
                  </span>
                </div>
              )}
            </section>

            {/* Bloco 5 — Observações */}
            <section className="space-y-2">
              <Label htmlFor="te-obs" className="text-xs">Observações adicionais (opcional)</Label>
              <Textarea
                id="te-obs"
                placeholder="Ex.: ACOMPANHANTE PRESENTE, TRAZIDO PELA POLÍCIA, USO DE MEDICAÇÃO CONTÍNUA…"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={2}
              />
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando…</>
            ) : (
              <><Zap className="h-4 w-4 mr-2" /> Gerar atendimento Express</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
