import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, X, GripVertical } from "lucide-react";
import { useTherapeuticTemplates, TherapeuticTemplate } from "@/hooks/useTherapeuticTemplates";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PROTOCOL_TYPES = [
  "SEPSE",
  "AVC",
  "DOR TORÁCICA",
  "IAM",
  "TEP",
  "CETOACIDOSE",
  "OUTRO",
];

interface EditTherapeuticTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TherapeuticTemplate | null;
}

export function EditTherapeuticTemplateDialog({
  open,
  onOpenChange,
  template,
}: EditTherapeuticTemplateDialogProps) {
  const { createTemplate, updateTemplate } = useTherapeuticTemplates();
  const { user } = useAuth();
  const isEditing = !!template;

  const [name, setName] = useState("");
  const [protocolType, setProtocolType] = useState("SEPSE");
  const [customProtocol, setCustomProtocol] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<string[]>([""]);

  useEffect(() => {
    if (open && template) {
      setName(template.name);
      const isKnown = PROTOCOL_TYPES.includes(template.protocol_type);
      setProtocolType(isKnown ? template.protocol_type : "OUTRO");
      setCustomProtocol(isKnown ? "" : template.protocol_type);
      setDescription(template.description || "");
      setItems(template.items.length > 0 ? template.items : [""]);
    } else if (open && !template) {
      setName("");
      setProtocolType("SEPSE");
      setCustomProtocol("");
      setDescription("");
      setItems([""]);
    }
  }, [open, template]);

  const handleSave = () => {
    const finalType = protocolType === "OUTRO" ? customProtocol.toUpperCase().trim() : protocolType;
    const cleanItems = items.map((i) => i.toUpperCase().trim()).filter(Boolean);

    if (!name.trim() || !finalType || cleanItems.length === 0) return;

    if (isEditing && template) {
      updateTemplate.mutate({
        id: template.id,
        name: name.toUpperCase().trim(),
        protocol_type: finalType,
        description: description.trim() || null,
        items: cleanItems,
      });
    } else {
      createTemplate.mutate({
        name: name.toUpperCase().trim(),
        protocol_type: finalType,
        description: description.trim() || null,
        items: cleanItems,
        hospital_unit_id: null,
        state_id: null,
        is_global: true,
        created_by: user?.id || null,
      });
    }
    onOpenChange(false);
  };

  const addItem = () => setItems([...items, ""]);
  const updateItem = (idx: number, value: string) => {
    const updated = [...items];
    updated[idx] = value;
    setItems(updated);
  };
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-wide">
            {isEditing ? "Editar template" : "Novo template terapêutico"}
          </DialogTitle>
          <DialogDescription className="text-xs tracking-wider">
            {isEditing ? "Modifique os itens do protocolo" : "Defina um protocolo institucional padronizado"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Protocol Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tipo de protocolo</Label>
              <Select value={protocolType} onValueChange={setProtocolType}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROTOCOL_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-sm">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {protocolType === "OUTRO" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Especificar</Label>
                <Input
                  value={customProtocol}
                  onChange={(e) => setCustomProtocol(e.target.value)}
                  placeholder="Nome do protocolo"
                  className="text-sm"
                />
              </div>
            )}
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Nome do template</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={(e) => setName(e.target.value)}
              placeholder="Ex: Protocolo Sepse - Pacote 1h"
              className="text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição do protocolo..."
              className="text-sm resize-none h-16"
            />
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                Itens do Protocolo ({items.filter((i) => i.trim()).length})
              </Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem} className="h-7 px-2 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Adicionar
              </Button>
            </div>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-mono w-5 text-right flex-shrink-0">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <Input
                    value={item}
                    onChange={(e) => updateItem(idx, e.target.value)}
                    onBlur={(e) => updateItem(idx, e.target.value)}
                    placeholder={`Item ${idx + 1} do protocolo`}
                    className="h-9 text-sm flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeItem(idx)}
                    className="h-9 w-9 flex-shrink-0"
                    disabled={items.length === 1}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || items.filter((i) => i.trim()).length === 0}
            className="uppercase text-xs font-bold"
          >
            {isEditing ? "Salvar Alterações" : "Criar Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
