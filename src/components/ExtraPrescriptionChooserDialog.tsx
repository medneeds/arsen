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

// Paleta unificada azul institucional. Apenas `high_alert` permanece vermelho
// (convenção ISMP-Brasil para Medicamentos de Alta Vigilância).
const BLUE_BASE = {
  color: 'text-[hsl(217,70%,40%)]',
  bg: 'bg-[hsl(217,55%,96%)] dark:bg-[hsl(217,55%,12%)]/30',
  border: 'border-[hsl(217,55%,82%)] dark:border-[hsl(217,55%,30%)] hover:border-[hsl(217,60%,60%)]',
};

const OPTIONS: ExtraCategoryOption[] = [
  {
    value: 'antimicrobial',
    label: 'Antimicrobiano',
    description: 'Antibióticos, antifúngicos e antivirais. Abre Guia ATM ao confirmar.',
    icon: Shield,
    ...BLUE_BASE,
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
    ...BLUE_BASE,
  },
  {
    value: 'medication',
    label: 'Medicação Geral',
    description: 'Analgésicos, sintomáticos, SOS e medicações avulsas.',
    icon: Pill,
    ...BLUE_BASE,
  },
  {
    value: 'inhalation',
    label: 'Inalação',
    description: 'Nebulização e medicação inalatória.',
    icon: Wind,
    ...BLUE_BASE,
  },
  {
    value: 'hemotherapy',
    label: 'Hemoterapia',
    description: 'Hemocomponentes e derivados sanguíneos.',
    icon: TestTube,
    ...BLUE_BASE,
  },
  {
    value: 'nutrition',
    label: 'Nutrição',
    description: 'Dietas, suplementos e ajustes nutricionais.',
    icon: UtensilsCrossed,
    ...BLUE_BASE,
  },
  {
    value: 'care',
    label: 'Cuidados',
    description: 'Cuidados de enfermagem e orientações.',
    icon: ClipboardList,
    ...BLUE_BASE,
  },
  {
    value: 'all',
    label: 'Outros / Buscar livre',
    description: 'Não tem certeza da categoria? Abra a busca completa.',
    icon: FileText,
    ...BLUE_BASE,
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
            <Zap className="h-5 w-5 text-[hsl(217,70%,40%)]" />
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
