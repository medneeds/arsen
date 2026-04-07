import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  QUICK_PRESETS, CATEGORY_LABELS, DESTINATION_OPTIONS,
  type AttendancePreset, type PresetItem,
} from "@/data/quickAttendancePresets";
import { ArrowRight, Zap, Check } from "lucide-react";

interface QuickAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  patientBed: string;
  onApply: (preset: AttendancePreset, selectedItems: PresetItem[], destination: string) => void;
}

export function QuickAttendanceDialog({
  open, onOpenChange, patientName, patientBed, onApply,
}: QuickAttendanceDialogProps) {
  const [selectedPreset, setSelectedPreset] = useState<AttendancePreset | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [destination, setDestination] = useState<string>('');

  const handleSelectPreset = (preset: AttendancePreset) => {
    setSelectedPreset(preset);
    const initial: Record<string, boolean> = {};
    preset.items.forEach(i => { initial[i.id] = i.defaultChecked; });
    setCheckedItems(initial);
    setDestination(preset.defaultDestination || '');
  };

  const toggleItem = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedCount = Object.values(checkedItems).filter(Boolean).length;

  const groupedItems = useMemo(() => {
    if (!selectedPreset) return {};
    const groups: Record<string, PresetItem[]> = {};
    for (const item of selectedPreset.items) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [selectedPreset]);

  const handleApply = () => {
    if (!selectedPreset || !destination) {
      toast.error("Selecione um destino para o paciente");
      return;
    }
    const items = selectedPreset.items.filter(i => checkedItems[i.id]);
    onApply(selectedPreset, items, destination);
    onOpenChange(false);
    setSelectedPreset(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedPreset(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-amber-500" />
            Atendimento Rápido
            <Badge variant="outline" className="text-[10px] ml-1">{patientBed}</Badge>
            <span className="text-sm font-normal text-muted-foreground truncate">— {patientName}</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          {!selectedPreset ? (
            /* ── Preset Selection Grid ── */
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground">Selecione o perfil clínico para gerar o checklist de atendimento inicial:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {QUICK_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all",
                      "hover:shadow-md hover:border-primary/40 hover:bg-primary/5",
                      "border-border bg-card"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{preset.icon}</span>
                      <span className="text-xs font-bold">{preset.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug">{preset.description}</p>
                    <Badge className={cn("text-[9px] mt-1 text-white", preset.color)}>
                      {preset.items.length} itens
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Editable Checklist ── */
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedPreset(null)}>
                    ← Voltar
                  </Button>
                  <Badge className={cn("text-white text-xs", selectedPreset.color)}>
                    {selectedPreset.icon} {selectedPreset.label}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">{selectedCount} itens selecionados</span>
              </div>

              {Object.entries(groupedItems).map(([cat, items]) => {
                const catInfo = CATEGORY_LABELS[cat];
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-sm">{catInfo?.icon}</span>
                      <h4 className="text-xs font-bold text-foreground">{catInfo?.label || cat}</h4>
                      <Badge variant="secondary" className="text-[9px]">{items.filter(i => checkedItems[i.id]).length}/{items.length}</Badge>
                    </div>
                    <div className="space-y-1">
                      {items.map(item => (
                        <label
                          key={item.id}
                          className={cn(
                            "flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all",
                            checkedItems[item.id]
                              ? "border-primary/30 bg-primary/5"
                              : "border-transparent hover:bg-muted/50"
                          )}
                        >
                          <Checkbox
                            checked={checkedItems[item.id]}
                            onCheckedChange={() => toggleItem(item.id)}
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <span className={cn("text-xs", checkedItems[item.id] ? "font-semibold" : "font-medium")}>{item.label}</span>
                            {item.details && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{item.details}</p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                    <Separator className="mt-3" />
                  </div>
                );
              })}

              {/* Destination */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 text-primary" />
                  <h4 className="text-xs font-bold">Destino do Paciente</h4>
                </div>
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione o destino..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DESTINATION_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </ScrollArea>

        {selectedPreset && (
          <DialogFooter className="px-5 py-3 border-t">
            <Button variant="outline" size="sm" onClick={handleClose} className="text-xs">Cancelar</Button>
            <Button size="sm" onClick={handleApply} className="text-xs gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Aplicar ({selectedCount} itens)
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
