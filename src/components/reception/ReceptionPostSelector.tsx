/**
 * ReceptionPostSelector — pop-up modal que pergunta ao recepcionista qual posto
 * está assumindo (Vertical ou Horizontal) antes de liberar o painel.
 *
 * - Aparece automaticamente em /recepcao quando o usuário ainda não escolheu
 * - Pode ser reaberto a qualquer momento pelo botão "Trocar posto" no header
 */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowDownToLine, ArrowRightToLine, Footprints, Ambulance } from "lucide-react";
import type { ReceptionPoint } from "@/hooks/useReceptionPost";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPoint: ReceptionPoint | null;
  onSelect: (point: ReceptionPoint) => void;
  /** Quando true, esconde o botão fechar e impede dismiss (primeira escolha do dia) */
  forceChoice?: boolean;
}

export function ReceptionPostSelector({ open, onOpenChange, currentPoint, onSelect, forceChoice }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Se forceChoice e ainda não escolheu, não permite fechar
        if (forceChoice && !v && !currentPoint) return;
        onOpenChange(v);
      }}
    >
      <DialogContent
        className="max-w-2xl"
        onPointerDownOutside={(e) => {
          if (forceChoice && !currentPoint) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (forceChoice && !currentPoint) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">
            {currentPoint ? "Trocar posto de recepção" : "Onde você está atendendo agora?"}
          </DialogTitle>
          <DialogDescription>
            Selecione o posto onde você está atuando. Todos os atendimentos abertos por você até trocar de posto serão
            categorizados nesta recepção.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          <PostOption
            icon={Footprints}
            title="Recepção Vertical"
            description="Pacientes que entram caminhando — consultórios, atendimentos eletivos, demanda espontânea."
            color="from-sky-500 to-blue-600"
            iconBg="bg-sky-500/15 text-sky-600 dark:text-sky-400"
            secondaryIcon={ArrowDownToLine}
            secondaryLabel="Andando"
            active={currentPoint === "vertical"}
            onClick={() => {
              onSelect("vertical");
              onOpenChange(false);
            }}
          />
          <PostOption
            icon={Ambulance}
            title="Recepção Horizontal"
            description="Pacientes em maca — chegam por ambulância, SAMU, transferências ou casos críticos."
            color="from-rose-500 to-red-600"
            iconBg="bg-rose-500/15 text-rose-600 dark:text-rose-400"
            secondaryIcon={ArrowRightToLine}
            secondaryLabel="Maca / Ambulância"
            active={currentPoint === "horizontal"}
            onClick={() => {
              onSelect("horizontal");
              onOpenChange(false);
            }}
          />
        </div>

        {currentPoint && !forceChoice && (
          <div className="flex justify-end mt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface PostOptionProps {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  iconBg: string;
  secondaryIcon: React.ElementType;
  secondaryLabel: string;
  active: boolean;
  onClick: () => void;
}

function PostOption({ icon: Icon, title, description, iconBg, secondaryIcon: SecIcon, secondaryLabel, active, onClick }: PostOptionProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className={cn(
        "p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/40 group",
        active && "border-primary ring-2 ring-primary/30 bg-primary/5",
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base">{title}</h3>
            {active && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-primary">Ativo</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
            <SecIcon className="h-3 w-3" />
            <span>{secondaryLabel}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
