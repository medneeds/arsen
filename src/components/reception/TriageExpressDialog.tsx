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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, Loader2, UserX, Stethoscope, Clock, Phone, FileWarning,
  ArrowRight, Zap, Cake, CalendarDays, Hash, Siren, Ambulance, Footprints,
} from "lucide-react";
import type { ReceptionPoint } from "@/hooks/useReceptionPost";

export type AgeInputMode = "approx" | "exact" | "dob";

export interface TriageExpressPayload {
  /** Nome (parcial ou completo). Vazio ou isUnidentified=true = NÃO IDENTIFICADO */
  partialName: string;
  /** Forçar paciente como Não Identificado (NI) — gera código NI mesmo se houver nome */
  isUnidentified: boolean;
  sex: "M" | "F" | "I";
  /** Idade em anos calculada/digitada — string p/ retrocompatibilidade */
  approxAge: string;
  /** Modo escolhido para idade */
  ageMode: AgeInputMode;
  /** Data de nascimento ISO (YYYY-MM-DD) quando ageMode = 'dob' */
  birthDate?: string | null;
  chiefComplaint: string;
  arrivalMode: string;
  contactPhone: string;
  documentsPending: boolean;
  destinationValue: string;
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
  /** Recepção ativa do usuário (vertical/horizontal). Influencia destino padrão. */
  receptionPoint?: ReceptionPoint | null;
}

const ARRIVAL_MODES = [
  "ESPONTÂNEO",
  "SAMU 192",
  "POLÍCIA MILITAR",
  "BOMBEIROS",
  "TRANSF. INTERHOSPITALAR",
  "FAMILIAR / TERCEIRO",
];

/** Calcula anos completos a partir de uma data ISO YYYY-MM-DD */
function calcAgeFromDob(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

export function TriageExpressDialog({
  open, onOpenChange, sectors, groups, onConfirm, loading = false, receptionPoint = null,
}: Props) {
  const [partialName, setPartialName] = useState("");
  const [isUnidentified, setIsUnidentified] = useState(false);
  const [sex, setSex] = useState<"M" | "F" | "I">("I");

  // Idade — três modos
  const [ageMode, setAgeMode] = useState<AgeInputMode>("approx");
  const [approxAgeText, setApproxAgeText] = useState(""); // texto livre (ADULTO, RN, etc)
  const [exactAge, setExactAge] = useState(""); // número
  const [birthDate, setBirthDate] = useState(""); // YYYY-MM-DD

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [arrivalMode, setArrivalMode] = useState("ESPONTÂNEO");
  const [contactPhone, setContactPhone] = useState("");
  const [documentsPending, setDocumentsPending] = useState(true);
  const [destinationValue, setDestinationValue] = useState("triagem");
  const [observations, setObservations] = useState("");

  // Reset ao reabrir — destino padrão sempre TRIAGEM (recomendado)
  useEffect(() => {
    if (open) {
      setPartialName("");
      setIsUnidentified(false);
      setSex("I");
      setAgeMode("approx");
      setApproxAgeText("");
      setExactAge("");
      setBirthDate("");
      setChiefComplaint("");
      // Recepção horizontal → modo de chegada padrão é SAMU (mais comum em macas)
      setArrivalMode(receptionPoint === "horizontal" ? "SAMU 192" : "ESPONTÂNEO");
      setContactPhone("");
      setDocumentsPending(true);
      setDestinationValue("triagem");
      setObservations("");
    }
  }, [open, receptionPoint]);

  const selectedSector = useMemo(
    () => sectors.find((s) => s.value === destinationValue),
    [sectors, destinationValue]
  );

  // Setor "Sala Vermelha" — atalho de destaque na recepção horizontal
  const salaVermelha = useMemo(
    () => sectors.find((s) => s.value === "sala_vermelha"),
    [sectors]
  );
  const triagemSector = useMemo(
    () => sectors.find((s) => s.isTriage),
    [sectors]
  );

  const computedAge = useMemo(() => {
    if (ageMode === "dob" && birthDate) {
      const a = calcAgeFromDob(birthDate);
      return a !== null ? String(a) : "";
    }
    if (ageMode === "exact") return exactAge.trim();
    return approxAgeText.trim();
  }, [ageMode, birthDate, exactAge, approxAgeText]);

  const handleSubmit = async () => {
    await onConfirm({
      partialName: partialName.trim(),
      sex,
      approxAge: computedAge,
      ageMode,
      birthDate: ageMode === "dob" && birthDate ? birthDate : null,
      chiefComplaint: chiefComplaint.trim(),
      arrivalMode,
      contactPhone: contactPhone.trim(),
      documentsPending,
      destinationValue,
      observations: observations.trim(),
    });
  };

  const isFullyIdentified = partialName.trim().split(/\s+/).filter(Boolean).length >= 2;
  const isHorizontal = receptionPoint === "horizontal";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        {/* Header com gradiente de urgência */}
        <div className="bg-gradient-to-r from-rose-600 to-red-600 text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-white">
              <Zap className="h-5 w-5" />
              Triagem Express — Pré-identificação
              {receptionPoint && (
                <Badge
                  variant="outline"
                  className="ml-2 text-[10px] h-5 border-white/40 text-white bg-white/10 font-normal"
                >
                  {isHorizontal ? <Ambulance className="h-3 w-3 mr-1" /> : <Footprints className="h-3 w-3 mr-1" />}
                  Recepção {isHorizontal ? "Horizontal" : "Vertical"}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-rose-50/90 text-xs">
              {isHorizontal
                ? "Maca/ambulância — destino prioritário sugerido: Sala Vermelha. Tudo é opcional."
                : "Pergunte rapidamente o que conseguir. Tudo é opcional. Direcionamento padrão: Triagem."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[65vh]">
          <div className="px-5 py-4 space-y-4">
            {/* ========== ATALHO PRIORITÁRIO — só na horizontal ========== */}
            {isHorizontal && salaVermelha && (
              <section className="rounded-lg border-2 border-red-600/40 bg-red-600/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Siren className="h-4 w-4 text-red-600 animate-pulse" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">
                    Direcionamento prioritário (Recepção Horizontal)
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDestinationValue(triagemSector?.value || "triagem")}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-md border text-left transition-all hover:bg-accent/50",
                      destinationValue === (triagemSector?.value || "triagem") && "ring-2 ring-emerald-500 bg-emerald-500/10 border-emerald-500/40"
                    )}
                  >
                    <div className="h-3 w-3 rounded-full bg-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold">Triagem</div>
                      <div className="text-[10px] text-muted-foreground">classificação de risco</div>
                    </div>
                    <Badge variant="secondary" className="text-[8px] h-3.5 px-1">recomendado</Badge>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestinationValue("sala_vermelha")}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-md border text-left transition-all hover:bg-accent/50",
                      destinationValue === "sala_vermelha" && "ring-2 ring-red-600 bg-red-600/10 border-red-600/40"
                    )}
                  >
                    <div className="h-3 w-3 rounded-full bg-red-700 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold">Sala Vermelha</div>
                      <div className="text-[10px] text-muted-foreground">emergência crítica</div>
                    </div>
                    <Siren className="h-3 w-3 text-red-600" />
                  </button>
                </div>
              </section>
            )}

            {/* ========== Bloco 1 — Identificação parcial ========== */}
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

              {/* Idade — toggle de modo */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Idade do paciente
                  </Label>
                  <ToggleGroup
                    type="single"
                    value={ageMode}
                    onValueChange={(v) => v && setAgeMode(v as AgeInputMode)}
                    size="sm"
                    className="h-7"
                  >
                    <ToggleGroupItem value="approx" className="text-[10px] h-7 px-2 gap-1">
                      <Hash className="h-3 w-3" /> Aproximada
                    </ToggleGroupItem>
                    <ToggleGroupItem value="exact" className="text-[10px] h-7 px-2 gap-1">
                      <Cake className="h-3 w-3" /> Exata
                    </ToggleGroupItem>
                    <ToggleGroupItem value="dob" className="text-[10px] h-7 px-2 gap-1">
                      <CalendarDays className="h-3 w-3" /> Data nasc.
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {ageMode === "approx" && (
                  <Input
                    placeholder="Ex.: ADULTO, IDOSO, RN, ~60a"
                    value={approxAgeText}
                    onChange={(e) => setApproxAgeText(e.target.value.toUpperCase())}
                  />
                )}
                {ageMode === "exact" && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={130}
                      placeholder="Ex.: 60"
                      value={exactAge}
                      onChange={(e) => setExactAge(e.target.value)}
                      className="max-w-[140px]"
                    />
                    <span className="text-xs text-muted-foreground">anos</span>
                  </div>
                )}
                {ageMode === "dob" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      max={new Date().toISOString().slice(0, 10)}
                      className="max-w-[200px]"
                    />
                    {birthDate && computedAge && (
                      <Badge variant="secondary" className="text-[10px]">
                        {computedAge} anos
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    O atendimento aparecerá no painel da Recepção com indicador de pendência (CPF, CNS, RG ou nome completo) para complementação posterior.
                  </p>
                </div>
              </label>
            </section>

            {/* Bloco 4 — Destino completo (sempre disponível) */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {isHorizontal ? "Outros destinos disponíveis" : "Direcionamento do atendimento"}
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
