import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  title: string;
  summary: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Card retrátil para dados pré-preenchidos do paciente / contexto. */
export function CollapsibleInfoCard({ title, summary, badge, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="bg-muted/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground transition-colors rounded-t-lg"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-xs text-foreground truncate">{summary}</p>
        </div>
        {badge && <Badge variant="outline" className="shrink-0 text-[10px]">{badge}</Badge>}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && <CardContent className="pt-3 border-t">{children}</CardContent>}
    </Card>
  );
}
