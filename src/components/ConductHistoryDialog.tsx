import { memo, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Filter, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ConductHistoryEntry, getFieldLabel } from "@/hooks/useConductHistory";

interface ConductHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: ConductHistoryEntry[];
  isLoading: boolean;
  patientName: string;
}

const fieldColorMap: Record<string, string> = {
  diagnoses: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  medicalHistory: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  relevantExams: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  pendencies: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  schedule: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  admissionHistory: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

function extractUsername(email: string | null): string {
  if (!email) return "Sistema";
  return email.replace("@sistema.local", "").toUpperCase();
}

export const ConductHistoryDialog = memo(function ConductHistoryDialog({
  open,
  onOpenChange,
  history,
  isLoading,
  patientName,
}: ConductHistoryDialogProps) {
  const [fieldFilter, setFieldFilter] = useState<string>("all");

  const uniqueFields = useMemo(() => {
    const fields = new Set(history.map((h) => h.field_name));
    return Array.from(fields).sort();
  }, [history]);

  const filtered = useMemo(() => {
    if (fieldFilter === "all") return history;
    return history.filter((h) => h.field_name === fieldFilter);
  }, [history, fieldFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, ConductHistoryEntry[]> = {};
    filtered.forEach((entry) => {
      const dateKey = format(parseISO(entry.created_at), "dd/MM/yyyy");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(entry);
    });
    return groups;
  }, [filtered]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Condutas — {patientName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={fieldFilter} onValueChange={setFieldFilter}>
            <SelectTrigger className="w-[220px] h-8 text-xs">
              <SelectValue placeholder="Filtrar por campo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os campos</SelectItem>
              {uniqueFields.map((f) => (
                <SelectItem key={f} value={f}>
                  {getFieldLabel(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} alteração(ões)
          </span>
        </div>

        <ScrollArea className="max-h-[55vh] pr-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum registro de alteração encontrado.
            </p>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([dateKey, entries]) => (
                <div key={dateKey}>
                  <div className="sticky top-0 bg-background z-10 pb-1 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {dateKey}
                    </span>
                  </div>
                  <div className="relative border-l-2 border-muted ml-2 space-y-3">
                    {entries.map((entry) => (
                      <div key={entry.id} className="relative pl-5">
                        <div className="absolute -left-[5px] top-2 h-2 w-2 rounded-full bg-primary" />
                        <div className="bg-accent/30 rounded-lg p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${fieldColorMap[entry.field_name] || ""}`}
                            >
                              {getFieldLabel(entry.field_name)}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {format(parseISO(entry.created_at), "HH:mm:ss", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <User className="h-3 w-3" />
                            {extractUsername(entry.changed_by_email)}
                          </div>
                          {entry.old_value && (
                            <div className="text-[10px]">
                              <span className="text-muted-foreground">De: </span>
                              <span className="line-through text-muted-foreground/70 break-all">
                                {entry.old_value.length > 200
                                  ? entry.old_value.substring(0, 200) + "..."
                                  : entry.old_value}
                              </span>
                            </div>
                          )}
                          {entry.new_value && (
                            <div className="text-[10px]">
                              <span className="text-muted-foreground">Para: </span>
                              <span className="text-foreground break-all">
                                {entry.new_value.length > 200
                                  ? entry.new_value.substring(0, 200) + "..."
                                  : entry.new_value}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
});
