// Pop-up MAV — Guia de Medicamentos de Alta Vigilância
// Subgrupos clínicos: Opioides Fortes, Drogas Vasoativas,
// Bolus de Intubação (IOT-RSI), Sedoanalgesia Contínua.
// Cada item já vem com posologia sugerida adequada ao contexto (bolus vs infusão).
import React, { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Search, Plus, Syringe, Activity, Zap, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MedicationEntry } from "@/data/medicationsDatabase";
import { normalizeSearch } from "@/lib/fuzzySearch";

interface MavItem extends MedicationEntry {
  subgroup: 'opioid' | 'vasoactive' | 'rsi_bolus' | 'continuous';
  doseHint?: string;
}

const MAV_ITEMS: MavItem[] = [
  // ---------- OPIOIDES FORTES ----------
  { id: 'mav-op-morfina', subgroup: 'opioid', name: 'Morfina', presentation: '10mg/mL - Ampola', defaultDose: '2-5mg', defaultRoute: 'Intravenosa', defaultPosology: '4/4h', defaultSchedule: 'ACM', instructions: 'Diluir 1 amp em 9mL de SF0,9% (1mg/mL). Titular conforme dor e FR. Reversor: naloxona.', category: 'high_alert', highAlert: true, doseHint: '2-5mg IV q4h (titular)' },
  { id: 'mav-op-fentanil-sos', subgroup: 'opioid', name: 'Fentanil (analgesia SOS)', presentation: '50mcg/mL - Ampola 10mL', defaultDose: '25-50mcg', defaultRoute: 'Intravenosa', defaultPosology: 'SOS', defaultSchedule: 'ACM', instructions: 'Bolus para dor aguda. Início rápido (1-2 min). Monitorar FR e PA.', category: 'high_alert', highAlert: true, doseHint: '25-50mcg IV SOS' },
  { id: 'mav-op-metadona', subgroup: 'opioid', name: 'Metadona', presentation: '10mg - Comprimido', defaultDose: '5-10mg', defaultRoute: 'Oral', defaultPosology: '8/8h', defaultSchedule: '08h', instructions: 'Início lento, meia-vida longa. Risco de acúmulo. Avaliar QTc.', category: 'high_alert', highAlert: true },
  { id: 'mav-op-tramadol', subgroup: 'opioid', name: 'Tramadol', presentation: '100mg/2mL - Ampola', defaultDose: '100mg', defaultRoute: 'Intravenosa', defaultPosology: '6/6h', defaultSchedule: 'ACM', instructions: 'Diluir em 100mL de SF0,9%. Infundir em 15-30 min. Risco de convulsão e síndrome serotoninérgica.', category: 'high_alert', highAlert: true },

  // ---------- DROGAS VASOATIVAS (infusão contínua) ----------
  { id: 'mav-va-norepi', subgroup: 'vasoactive', name: 'Noradrenalina (Norepinefrina)', presentation: '4mg/4mL - Ampola', defaultDose: '0,05-0,5mcg/kg/min', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: '4 amp (16mg) em 234mL SG5% (62,5mcg/mL). BIC central. Titular para PAM ≥ 65.', category: 'high_alert', highAlert: true, doseHint: '0,05-0,5 mcg/kg/min — BIC central' },
  { id: 'mav-va-epi', subgroup: 'vasoactive', name: 'Adrenalina (Epinefrina)', presentation: '1mg/mL - Ampola', defaultDose: '0,05-0,5mcg/kg/min', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: '6mg em 100mL SG5% (60mcg/mL). BIC central. Choque refratário ou anafilaxia.', category: 'high_alert', highAlert: true, doseHint: '0,05-0,5 mcg/kg/min' },
  { id: 'mav-va-dobut', subgroup: 'vasoactive', name: 'Dobutamina', presentation: '250mg/20mL - Ampola', defaultDose: '2,5-20mcg/kg/min', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: '250mg em 230mL SG5% (1mg/mL). Inotrópico β1. Choque cardiogênico/IC descompensada.', category: 'high_alert', highAlert: true, doseHint: '2,5-20 mcg/kg/min' },
  { id: 'mav-va-vaso', subgroup: 'vasoactive', name: 'Vasopressina', presentation: '20UI/mL - Ampola', defaultDose: '0,01-0,04 UI/min', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: '20UI em 100mL SF0,9% (0,2UI/mL). Adjuvante à noradrenalina no choque séptico.', category: 'high_alert', highAlert: true, doseHint: '0,01-0,04 UI/min (dose fixa)' },
  { id: 'mav-va-nitro', subgroup: 'vasoactive', name: 'Nitroprussiato de Sódio', presentation: '50mg - Frasco', defaultDose: '0,3-10mcg/kg/min', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: '50mg em 250mL SG5% (200mcg/mL). FOTOPROTEGER. Crise hipertensiva. Risco de tiocianato.', category: 'high_alert', highAlert: true, doseHint: '0,3-10 mcg/kg/min — fotoproteger' },
  { id: 'mav-va-nitrog', subgroup: 'vasoactive', name: 'Nitroglicerina (Tridil)', presentation: '50mg/10mL - Ampola', defaultDose: '5-200mcg/min', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: '50mg em 240mL SG5% (200mcg/mL). EAP, SCA, crise hipertensiva.', category: 'high_alert', highAlert: true },
  { id: 'mav-va-milri', subgroup: 'vasoactive', name: 'Milrinona', presentation: '20mg/20mL - Ampola', defaultDose: '0,375-0,75mcg/kg/min', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: '20mg em 80mL SG5% (200mcg/mL). Inodilatador. IC com baixo débito.', category: 'high_alert', highAlert: true },

  // ---------- BOLUS DE INTUBAÇÃO (IOT - SRI) ----------
  { id: 'mav-rsi-fent', subgroup: 'rsi_bolus', name: 'Fentanil (pré-IOT)', presentation: '50mcg/mL - Ampola 10mL', defaultDose: '2-3 mcg/kg', defaultRoute: 'Intravenosa', defaultPosology: 'Dose única', defaultSchedule: 'ACM', instructions: 'Bolus lento 1-2 min. Atenuação simpática. Aguardar 3 min antes do hipnótico.', category: 'high_alert', highAlert: true, doseHint: '2-3 mcg/kg em bolus' },
  { id: 'mav-rsi-etomi', subgroup: 'rsi_bolus', name: 'Etomidato', presentation: '20mg/10mL - Ampola', defaultDose: '0,3 mg/kg', defaultRoute: 'Intravenosa', defaultPosology: 'Dose única', defaultSchedule: 'ACM', instructions: 'Hipnótico de escolha em instabilidade hemodinâmica. Risco de supressão adrenal.', category: 'high_alert', highAlert: true, doseHint: '0,3 mg/kg IV bolus' },
  { id: 'mav-rsi-keta-iot', subgroup: 'rsi_bolus', name: 'Cetamina (indução)', presentation: '50mg/mL - Frasco 10mL', defaultDose: '1,5-2 mg/kg', defaultRoute: 'Intravenosa', defaultPosology: 'Dose única', defaultSchedule: 'ACM', instructions: 'Hipnótico para choque/asma. Aumenta PA e FC. Evitar em HIC e doença coronariana.', category: 'high_alert', highAlert: true, doseHint: '1,5-2 mg/kg IV' },
  { id: 'mav-rsi-mida-iot', subgroup: 'rsi_bolus', name: 'Midazolam (indução)', presentation: '5mg/mL - Ampola 3mL', defaultDose: '0,2-0,3 mg/kg', defaultRoute: 'Intravenosa', defaultPosology: 'Dose única', defaultSchedule: 'ACM', instructions: 'Alternativa hipnótica. Pode causar hipotensão. Reversor: flumazenil.', category: 'high_alert', highAlert: true, doseHint: '0,2-0,3 mg/kg IV' },
  { id: 'mav-rsi-prop-iot', subgroup: 'rsi_bolus', name: 'Propofol (indução)', presentation: '10mg/mL - Frasco 20mL', defaultDose: '1,5-2,5 mg/kg', defaultRoute: 'Intravenosa', defaultPosology: 'Dose única', defaultSchedule: 'ACM', instructions: 'Hipnótico rápido. Hipotensão dose-dependente. Cuidado em hipovolemia.', category: 'high_alert', highAlert: true, doseHint: '1,5-2,5 mg/kg IV' },
  { id: 'mav-rsi-succ', subgroup: 'rsi_bolus', name: 'Succinilcolina', presentation: '100mg - Frasco', defaultDose: '1-1,5 mg/kg', defaultRoute: 'Intravenosa', defaultPosology: 'Dose única', defaultSchedule: 'ACM', instructions: 'BNM despolarizante. Início <60s. Contraindicado: hipercalemia, queimadura >24h, distrofias.', category: 'high_alert', highAlert: true, doseHint: '1-1,5 mg/kg IV' },
  { id: 'mav-rsi-rocu', subgroup: 'rsi_bolus', name: 'Rocurônio', presentation: '10mg/mL - Frasco 5mL', defaultDose: '1,2 mg/kg', defaultRoute: 'Intravenosa', defaultPosology: 'Dose única', defaultSchedule: 'ACM', instructions: 'BNM não-despolarizante. Dose SRI: 1,2 mg/kg. Início ~60s. Reversor: sugamadex.', category: 'high_alert', highAlert: true, doseHint: '1,2 mg/kg IV (SRI)' },
  { id: 'mav-rsi-cisa', subgroup: 'rsi_bolus', name: 'Cisatracúrio (bolus)', presentation: '2mg/mL - Ampola 5mL', defaultDose: '0,15-0,2 mg/kg', defaultRoute: 'Intravenosa', defaultPosology: 'Dose única', defaultSchedule: 'ACM', instructions: 'BNM não-despolarizante. Eliminação Hofmann (independe de fígado/rim).', category: 'high_alert', highAlert: true, doseHint: '0,15-0,2 mg/kg IV' },
  { id: 'mav-rsi-lido-iot', subgroup: 'rsi_bolus', name: 'Lidocaína (pré-IOT)', presentation: '20mg/mL - Frasco', defaultDose: '1,5 mg/kg', defaultRoute: 'Intravenosa', defaultPosology: 'Dose única', defaultSchedule: 'ACM', instructions: 'Atenua resposta pressórica e tosse. Útil em HIC e broncoespasmo. 3 min antes da IOT.', category: 'high_alert', highAlert: true },

  // ---------- SEDOANALGESIA CONTÍNUA (manutenção pós-IOT) ----------
  { id: 'mav-cont-mida', subgroup: 'continuous', name: 'Midazolam (sedação contínua)', presentation: '50mg/10mL - Ampola', defaultDose: '0,02-0,1 mg/kg/h', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: '50mg em 240mL SF0,9% (0,2mg/mL) ou puro em BIC. Acúmulo em uso prolongado.', category: 'high_alert', highAlert: true, doseHint: '0,02-0,1 mg/kg/h — BIC' },
  { id: 'mav-cont-prop', subgroup: 'continuous', name: 'Propofol (sedação contínua)', presentation: '10mg/mL - Frasco 100mL', defaultDose: '0,3-3 mg/kg/h', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: 'Frasco puro em BIC. Risco de PRIS (>4mg/kg/h por >48h). Trocar equipo q12h.', category: 'high_alert', highAlert: true, doseHint: '0,3-3 mg/kg/h — BIC' },
  { id: 'mav-cont-fent', subgroup: 'continuous', name: 'Fentanil (analgesia contínua)', presentation: '50mcg/mL - Ampola 10mL', defaultDose: '0,5-3 mcg/kg/h', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: '5 amp (2500mcg) em 240mL SF0,9% (10mcg/mL). Acúmulo em IRC/IH.', category: 'high_alert', highAlert: true, doseHint: '0,5-3 mcg/kg/h — BIC' },
  { id: 'mav-cont-keta', subgroup: 'continuous', name: 'Cetamina (analgesia contínua)', presentation: '50mg/mL - Frasco 10mL', defaultDose: '0,1-0,5 mg/kg/h', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: '500mg em 250mL SF0,9% (2mg/mL). Adjuvante poupador de opioide. Útil em asma/broncoespasmo.', category: 'high_alert', highAlert: true, doseHint: '0,1-0,5 mg/kg/h' },
  { id: 'mav-cont-dexme', subgroup: 'continuous', name: 'Dexmedetomidina', presentation: '200mcg/2mL - Ampola', defaultDose: '0,2-1,4 mcg/kg/h', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: '200mcg em 48mL SF0,9% (4mcg/mL). Sedação leve, sem depressão respiratória. Bradicardia/hipotensão.', category: 'high_alert', highAlert: true, doseHint: '0,2-1,4 mcg/kg/h' },
  { id: 'mav-cont-cisa', subgroup: 'continuous', name: 'Cisatracúrio (BNM contínuo)', presentation: '2mg/mL - Ampola 5mL', defaultDose: '1-3 mcg/kg/min', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: '50mg em 250mL SF0,9% (200mcg/mL). SDRA grave / assincronia ventilatória. TOF.', category: 'high_alert', highAlert: true, doseHint: '1-3 mcg/kg/min — uso restrito' },
  { id: 'mav-cont-morf-bic', subgroup: 'continuous', name: 'Morfina (analgesia contínua)', presentation: '10mg/mL - Ampola', defaultDose: '1-10 mg/h', defaultRoute: 'Intravenosa', defaultPosology: 'Contínuo', defaultSchedule: 'ACM', instructions: '50mg em 250mL SF0,9% (0,2mg/mL). Alternativa ao fentanil. Acúmulo em IRC.', category: 'high_alert', highAlert: true },
];

const SUBGROUPS = [
  { id: 'opioid' as const,    label: 'Opioides Fortes',         icon: Syringe,   color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/20', border: 'border-purple-200 dark:border-purple-900', desc: 'Morfina, fentanil SOS, metadona, tramadol' },
  { id: 'vasoactive' as const, label: 'Drogas Vasoativas',       icon: Activity,  color: 'text-rose-600',   bg: 'bg-rose-50 dark:bg-rose-950/20',     border: 'border-rose-200 dark:border-rose-900',     desc: 'Noradrenalina, adrenalina, dobutamina, vasopressina, NPS' },
  { id: 'rsi_bolus' as const,  label: 'Bolus de Intubação (SRI)', icon: Zap,       color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-950/20',   border: 'border-amber-200 dark:border-amber-900',   desc: 'Fentanil, etomidato, cetamina, midazolam, propofol, succinilcolina, rocurônio' },
  { id: 'continuous' as const, label: 'Sedoanalgesia Contínua',   icon: Waves,     color: 'text-sky-600',    bg: 'bg-sky-50 dark:bg-sky-950/20',       border: 'border-sky-200 dark:border-sky-900',       desc: 'Midazolam, propofol, fentanil, cetamina, dexmedetomidina (BIC)' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItem: (med: MedicationEntry) => void;
}

export function HighAlertGuideDialog({ open, onOpenChange, onAddItem }: Props) {
  const [query, setQuery] = useState("");
  const [activeSubgroup, setActiveSubgroup] = useState<typeof SUBGROUPS[number]['id'] | 'all'>('all');

  const filtered = useMemo(() => {
    const q = normalizeSearch(query.trim());
    return MAV_ITEMS.filter(item => {
      if (activeSubgroup !== 'all' && item.subgroup !== activeSubgroup) return false;
      if (!q) return true;
      const hay = normalizeSearch(`${item.name} ${item.presentation} ${item.doseHint || ''} ${item.instructions || ''}`);
      return hay.includes(q);
    });
  }, [query, activeSubgroup]);

  const grouped = useMemo(() => {
    const map = new Map<string, MavItem[]>();
    SUBGROUPS.forEach(g => map.set(g.id, []));
    filtered.forEach(it => {
      const arr = map.get(it.subgroup);
      if (arr) arr.push(it);
    });
    return map;
  }, [filtered]);

  const handleAdd = (item: MavItem) => {
    onAddItem(item);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b border-border bg-gradient-to-r from-red-50 to-amber-50 dark:from-red-950/30 dark:to-amber-950/30">
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Guia MAV — Medicamentos de Alta Vigilância
          </DialogTitle>
          <DialogDescription className="text-xs">
            Selecione opioides fortes, vasoativas, bolus de intubação ou sedoanalgesia contínua. Cada item já vem com posologia sugerida pela boa prática clínica.
          </DialogDescription>
        </DialogHeader>

        {/* Subgroup tabs + search */}
        <div className="px-5 py-3 border-b border-border space-y-2.5 bg-muted/20">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveSubgroup('all')}
              className={cn(
                "text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all",
                activeSubgroup === 'all'
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              )}
            >
              Todos ({MAV_ITEMS.length})
            </button>
            {SUBGROUPS.map(g => {
              const Icon = g.icon;
              const count = MAV_ITEMS.filter(i => i.subgroup === g.id).length;
              const active = activeSubgroup === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActiveSubgroup(g.id)}
                  className={cn(
                    "text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5",
                    active
                      ? cn(g.bg, g.color, g.border, "border-current")
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {g.label} <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar droga MAV (ex: fentanil, noradrenalina, rocurônio)..."
              className="pl-9 h-9 text-sm bg-background"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1 px-5 py-3">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              Nenhuma droga MAV encontrada para "{query}".
            </div>
          ) : (
            <div className="space-y-4">
              {SUBGROUPS.map(g => {
                const items = grouped.get(g.id) || [];
                if (items.length === 0) return null;
                const Icon = g.icon;
                return (
                  <section key={g.id}>
                    <div className={cn("flex items-center gap-2 mb-2 px-2 py-1 rounded-md", g.bg)}>
                      <Icon className={cn("h-4 w-4", g.color)} />
                      <h3 className={cn("text-xs font-bold tracking-wide uppercase", g.color)}>{g.label}</h3>
                      <span className="text-[10px] text-muted-foreground ml-auto">{g.desc}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {items.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleAdd(item)}
                          className={cn(
                            "group text-left p-2.5 rounded-lg border bg-card hover:shadow-md transition-all",
                            g.border,
                            "hover:border-current",
                            g.color,
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                                <span className="text-sm font-semibold text-foreground truncate">{item.name}</span>
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.presentation}</div>
                              {item.doseHint && (
                                <Badge variant="outline" className={cn("mt-1.5 text-[10px] px-1.5 py-0 font-mono", g.color, g.border)}>
                                  {item.doseHint}
                                </Badge>
                              )}
                              {item.instructions && (
                                <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-2 leading-snug">{item.instructions}</p>
                              )}
                            </div>
                            <Plus className={cn("h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity", g.color)} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="px-5 py-2.5 border-t border-border bg-muted/30 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-red-500" />
            Doses são sugestões baseadas em boas práticas — sempre titular conforme paciente.
          </p>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-7 text-xs">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
