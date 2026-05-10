import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Shield,
  AlertTriangle,
  FileText,
  Droplets,
  FlaskConical,
  Pill,
  Wind,
  TestTube,
  UtensilsCrossed,
  ClipboardList,
  Zap,
} from "lucide-react";
import type { PrescriptionCategory } from "@/data/medicationsDatabase";

export interface ExtraCategoryOption {
  value: PrescriptionCategory | 'all';
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}

const OPTIONS: ExtraCategoryOption[] = [
  {
    value: 'antimicrobial',
    label: 'Antimicrobiano',
    description: 'Antibióticos, antifúngicos e antivirais. Abre Guia ATM ao confirmar.',
    icon: Shield,
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800 hover:border-orange-400',
  },
  {
    value: 'high_alert',
    label: 'Alta Vigilância',
    description: 'MAV — psicotrópicos e medicamentos de risco. Dupla checagem obrigatória.',
    icon: AlertTriangle,
    color: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800 hover:border-red-400',
  },
  {
    value: 'replacement',
    label: 'Reposição / Hidratação',
    description: 'Eletrólitos, soros e correções volêmicas.',
    icon: Droplets,
    color: 'text-sky-600',
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    border: 'border-sky-200 dark:border-sky-800 hover:border-sky-400',
  },
  {
    value: 'medication',
    label: 'Medicação Geral',
    description: 'Analgésicos, sintomáticos, SOS e medicações avulsas.',
    icon: Pill,
    color: 'text-primary',
    bg: 'bg-primary/5',
    border: 'border-primary/20 hover:border-primary/60',
  },
  {
    value: 'inhalation',
    label: 'Inalação',
    description: 'Nebulização e medicação inalatória.',
    icon: Wind,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    border: 'border-cyan-200 dark:border-cyan-800 hover:border-cyan-400',
  },
  {
    value: 'hemotherapy',
    label: 'Hemoterapia',
    description: 'Hemocomponentes e derivados sanguíneos.',
    icon: TestTube,
    color: 'text-rose-600',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-800 hover:border-rose-400',
  },
  {
    value: 'nutrition',
    label: 'Nutrição',
    description: 'Dietas, suplementos e ajustes nutricionais.',
    icon: UtensilsCrossed,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-400',
  },
  {
    value: 'care',
    label: 'Cuidados',
    description: 'Cuidados de enfermagem e orientações.',
    icon: ClipboardList,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800 hover:border-amber-400',
  },
  {
    value: 'all',
    label: 'Outros / Buscar livre',
    description: 'Não tem certeza da categoria? Abra a busca completa.',
    icon: FileText,
    color: 'text-slate-600',
    bg: 'bg-slate-50 dark:bg-slate-950/30',
    border: 'border-slate-200 dark:border-slate-800 hover:border-slate-400',
  },
];

interface ExtraPrescriptionChooserDialogProps {
  open: boolean;
  onClose: () => void;
  onPick: (category: PrescriptionCategory | 'all') => void;
}

/**
 * Seletor de tipo de prescrição extra (avulsa).
 * Após escolher a categoria, abre o fluxo específico para aquela classe.
 */
export function ExtraPrescriptionChooserDialog({
  open,
  onClose,
  onPick,
}: ExtraPrescriptionChooserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            Prescrição Extra — escolha o tipo
          </DialogTitle>
          <DialogDescription>
            Selecione a classe da medicação para abrir o fluxo apropriado. A prescrição extra será
            anexada à prescrição diária e poderá ser impressa isoladamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => { onPick(opt.value); onClose(); }}
                className={`text-left rounded-lg border-2 p-3 transition-all ${opt.bg} ${opt.border}`}
              >
                <div className="flex items-start gap-2.5">
                  <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${opt.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">{opt.label}</div>
                    <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                      {opt.description}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
