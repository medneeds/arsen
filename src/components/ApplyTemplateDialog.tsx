import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileText } from "lucide-react";
import { useTherapeuticTemplates, TherapeuticTemplate } from "@/hooks/useTherapeuticTemplates";

interface ApplyTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (items: string[]) => void;
  patientName: string;
}

const PROTOCOL_COLORS: Record<string, string> = {
  "SEPSE": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "AVC": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "DOR TORÁCICA": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "IAM": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "TEP": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "CETOACIDOSE": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

export function ApplyTemplateDialog({ open, onOpenChange, onApply, patientName }: ApplyTemplateDialogProps) {
  const { templates, isLoading } = useTherapeuticTemplates();
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TherapeuticTemplate | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [editableItems, setEditableItems] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.protocol_type.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectTemplate = (template: TherapeuticTemplate) => {
    setSelectedTemplate(template);
    const items = [...template.items];
    setEditableItems(items);
    setSelectedItems(items.map((_, i) => String(i))); // track by index
    setEditingIndex(null);
  };

  const handleToggleItem = (idx: number) => {
    const key = String(idx);
    setSelectedItems((prev) =>
      prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key]
    );
  };

  const handleEditItem = (idx: number, value: string) => {
    setEditableItems((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleApply = () => {
    const itemsToApply = selectedItems.map((i) => editableItems[Number(i)]).filter(Boolean);
    if (itemsToApply.length > 0) {
      onApply(itemsToApply);
      setSelectedTemplate(null);
      setSelectedItems([]);
      setEditableItems([]);
      setEditingIndex(null);
      setSearch("");
      onOpenChange(false);
    }
  };

  const handleBack = () => {
    setSelectedTemplate(null);
    setSelectedItems([]);
    setEditableItems([]);
    setEditingIndex(null);
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setSelectedItems([]);
    setEditableItems([]);
    setEditingIndex(null);
    setSearch("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="space-y-2 pb-3 border-b">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-bold tracking-wide text-primary">
                {selectedTemplate ? selectedTemplate.name : "Templates terapêuticos"}
              </DialogTitle>
              <p className="text-sm font-semibold text-foreground mt-0.5 tracking-wide">
                {patientName}
              </p>
            </div>
          </div>
          <DialogDescription className="text-xs tracking-wider text-muted-foreground">
            {selectedTemplate
              ? "Selecione e edite os itens antes de aplicar (duplo clique para editar)"
              : "Selecione um protocolo para aplicar"}
          </DialogDescription>
        </DialogHeader>

        {!selectedTemplate ? (
          // Template selection view
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar protocolos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[350px]">
              {isLoading ? (
                <div className="text-center py-8 text-sm text-muted-foreground">Carregando...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum template disponível
                </div>
              ) : (
                <div className="space-y-2 pr-2">
                  {filtered.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="group p-3.5 rounded-xl border border-border/40 bg-card/50 hover:bg-accent/15 hover:border-primary/40 hover:shadow-md hover:scale-[1.01] transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              className={`text-[10px] ${PROTOCOL_COLORS[template.protocol_type] || "bg-muted text-foreground"}`}
                            >
                              {template.protocol_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {template.items.length} itens
                            </span>
                          </div>
                          <p className="text-sm font-semibold">{template.name}</p>
                          {template.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          // Item selection view
          <>
            <div className="flex gap-2 pb-2">
              <Button variant="outline" size="sm" onClick={handleBack} className="text-xs">
                ← Voltar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelectedItems(
                    selectedItems.length === editableItems.length ? [] : editableItems.map((_, i) => String(i))
                  )
                }
                className="text-xs"
              >
                {selectedItems.length === editableItems.length ? "Desmarcar Todos" : "Selecionar Todos"}
              </Button>
            </div>

            <Button
              onClick={handleApply}
              disabled={selectedItems.length === 0}
              className="w-full uppercase tracking-wider font-bold shadow-lg"
            >
              ⚡ APLICAR {selectedItems.length > 0 && `(${selectedItems.length} ITENS)`}
            </Button>

            <ScrollArea className="h-[320px]">
              <div className="space-y-1.5 pr-2">
                {editableItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="group flex items-center space-x-3 p-3 rounded-xl border border-border/40 bg-card/50 hover:bg-accent/10 hover:border-primary/30 transition-all duration-200"
                  >
                    <Checkbox
                      id={`item-${idx}`}
                      checked={selectedItems.includes(String(idx))}
                      onCheckedChange={() => handleToggleItem(idx)}
                    />
                    {editingIndex === idx ? (
                      <Input
                        value={item}
                        onChange={(e) => handleEditItem(idx, e.target.value)}
                        onBlur={() => setEditingIndex(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setEditingIndex(null);
                        }}
                        autoFocus
                        className="flex-1 text-sm uppercase h-8"
                      />
                    ) : (
                      <Label
                        htmlFor={`item-${idx}`}
                        className="text-sm cursor-pointer flex-1 uppercase"
                        onDoubleClick={() => setEditingIndex(idx)}
                      >
                        {item}
                      </Label>
                    )}
                    <span className="text-[10px] text-muted-foreground font-mono">
                      #{String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="pt-3 border-t">
          <Button variant="outline" onClick={handleClose} className="uppercase text-xs">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
