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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Save, Users, User as UserIcon } from "lucide-react";
import type { QuickTemplateItem } from "@/hooks/useQuickPrescriptionTemplates";

const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "sepse", label: "Sepse / Infecção" },
  { value: "pos-op", label: "Pós-operatório" },
  { value: "respiratorio", label: "Respiratório (DPOC, asma, PNM)" },
  { value: "cardiovascular", label: "Cardiovascular (IAM, ICC, HAS)" },
  { value: "neurologico", label: "Neurológico (AVC, TCE, crise)" },
  { value: "gastro", label: "Gastrointestinal" },
  { value: "renal", label: "Renal / Metabólico" },
  { value: "trauma", label: "Trauma" },
  { value: "obstetrico", label: "Obstétrico" },
  { value: "pediatrico", label: "Pediátrico" },
  { value: "outro", label: "Outro" },
];

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentItems: any[];
  hospitalUnitId: string | null;
  stateId: string | null;
  onSave: (input: {
    name: string;
    description?: string;
    clinical_category: string;
    items: QuickTemplateItem[];
    scope: "personal" | "shared";
    hospital_unit_id: string | null;
    state_id: string | null;
  }) => Promise<void>;
}

export function SaveTemplateDialog({
  open,
  onOpenChange,
  currentItems,
  hospitalUnitId,
  stateId,
  onSave,
}: SaveTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("geral");
  const [scope, setScope] = useState<"personal" | "shared">("personal");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setDescription("");
    setCategory("geral");
    setScope("personal");
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      // Strip runtime-only fields and save just the prescriptive payload
      const items: QuickTemplateItem[] = currentItems
        .filter((i: any) => i.status !== "suspended")
        .map((i: any) => ({
          name: i.name,
          presentation: i.presentation,
          dose: i.dose,
          route: i.route,
          posology: i.posology,
          schedule: i.schedule,
          instructions: i.instructions,
          category: i.category,
          flags: i.flags || [],
          highAlert: !!i.highAlert,
          diluent: i.diluent,
          diluentVolume: i.diluentVolume,
          infusionTime: i.infusionTime,
          quantity: i.quantity,
          quantityUnit: i.quantityUnit,
        }));
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        clinical_category: category,
        items,
        scope,
        hospital_unit_id: scope === "shared" ? hospitalUnitId : null,
        state_id: scope === "shared" ? stateId : null,
      });
      reset();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Save className="h-4 w-4 text-primary" />
            Salvar prescrição como template
          </DialogTitle>
          <DialogDescription className="text-xs">
            {currentItems.length} item(ns) ativos serão incluídos. Templates pessoais ficam só com você. Compartilhados ficam disponíveis para todo o hospital.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="tpl-name" className="text-xs">Nome do template *</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Sepse — Pacote 1ª hora"
              autoFocus
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="tpl-desc" className="text-xs">Descrição (opcional)</Label>
            <Textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Quando usar, observações clínicas, etc."
              className="text-xs min-h-[60px]"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="tpl-cat" className="text-xs">Categoria clínica</Label>
            <select
              id="tpl-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Visibilidade</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as any)} className="grid grid-cols-2 gap-2">
              <label
                className={`flex items-start gap-2 p-2.5 rounded-md border cursor-pointer transition-colors ${
                  scope === "personal" ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30"
                }`}
              >
                <RadioGroupItem value="personal" id="scope-personal" className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-1 text-xs font-medium">
                    <UserIcon className="h-3 w-3" /> Pessoal
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Só você vê e usa.
                  </p>
                </div>
              </label>
              <label
                className={`flex items-start gap-2 p-2.5 rounded-md border cursor-pointer transition-colors ${
                  scope === "shared" ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30"
                }`}
              >
                <RadioGroupItem value="shared" id="scope-shared" className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-1 text-xs font-medium">
                    <Users className="h-3 w-3" /> Compartilhado
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Todo o hospital pode aplicar.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || saving}>
            <Save className="h-3.5 w-3.5 mr-1" />
            {saving ? "Salvando..." : "Salvar template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
