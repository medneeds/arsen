import React from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { AccordionItem, AccordionContent, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

/**
 * Item de secao em acordeao — identidade visual unica compartilhada entre a
 * evolucao e a admissao. Extraido do SectionItem que vivia inline em
 * EvolutionForm; API mantida identica para a evolucao (que passa complete /
 * required / iconColor explicitos). `required`, `complete` e `iconColor` sao
 * opcionais para callers que nao rastreiam preenchimento por secao (admissao).
 *
 * DEVE ser usado dentro de um <Accordion> (type="multiple") controlado por um
 * estado openSections no componente pai.
 */
export const AccordionSectionItem: React.FC<{
  id: string;
  icon: React.ElementType;
  iconColor?: string;
  label: string;
  hint?: string;
  complete?: boolean;
  required?: boolean;
  customStatus?: React.ReactNode;
  children: React.ReactNode;
}> = ({ id, icon: Icon, iconColor = "text-muted-foreground", label, hint, complete = false, required = false, customStatus, children }) => {
  return (
    <AccordionItem value={id} className="border-0">
      <AccordionTrigger className="px-3 py-3 hover:no-underline hover:bg-muted/30 [&>svg]:hidden group">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={cn(
            "flex items-center justify-center h-6 w-6 rounded-full shrink-0",
            complete ? "bg-released text-white" : "bg-muted text-muted-foreground"
          )}>
            {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className={cn("h-3.5 w-3.5", !complete && iconColor)} />}
          </span>
          <span className="text-xs font-medium text-foreground">{label}</span>
          {required && !complete && (
            <span className="text-warning text-xs font-semibold">*</span>
          )}
          {hint && (
            <span className="text-xs text-muted-foreground hidden md:inline">— {hint}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {customStatus}
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-3 pb-3 pt-0">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
};
