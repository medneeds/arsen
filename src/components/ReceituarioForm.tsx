import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Printer, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  type ReceituarioData,
  type ReceituarioItem,
  type ReceituarioType,
  RECEITUARIO_ROUTES,
  RECEITUARIO_FREQUENCIES,
  printReceituario,
} from "@/lib/receituario";
import { useUnifiedMedicationCatalog } from "@/hooks/useUnifiedMedicationCatalog";

// ── Helpers ──────────────────────────────────────────────────────────────────

function newItem(): ReceituarioItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    dose: "",
    route: "VO",
    frequency: "1x/dia",
    duration: "",
  };
}

// ── Props ────────────────────────────────────────────────────────────────────

interface ReceituarioFormProps {
  type: ReceituarioType;
  patientName: string;
  patientId?: string | null;
  patientBed?: string;
  patientSector?: string;
  signedByName?: string;
  signedByCrm?: string;
  hospitalName?: string;
  /** Chamado ao salvar (persistir no banco). Retorna se salvou com sucesso —
   *  "Imprimir" bloqueia a impressão quando vier false, para nunca emitir
   *  um receituário que não existe no sistema. */
  onSave: (data: ReceituarioData) => Promise<boolean>;
  /** Receituário existente para edição (undefined = novo) */
  initial?: ReceituarioData | null;
  /** Classe CSS adicional */
  className?: string;
}

// ── Componente ───────────────────────────────────────────────────────────────

export function ReceituarioForm({
  type,
  patientName,
  patientId,
  patientBed,
  patientSector,
  signedByName,
  signedByCrm,
  hospitalName,
  onSave,
  initial,
  className,
}: ReceituarioFormProps) {
  const [items, setItems] = useState<ReceituarioItem[]>(
    initial?.items?.length ? initial.items : []
  );
  const [freeText, setFreeText] = useState(initial?.free_text ?? "");
  const [doctorName, setDoctorName] = useState(signedByName ?? initial?.signed_by_name ?? "");
  const [crm, setCrm] = useState(signedByCrm ?? initial?.signed_by_crm ?? "");
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [nameSearch, setNameSearch] = useState<Record<string, string>>({});

  const { findControlledByName } = useUnifiedMedicationCatalog();

  // ── Item CRUD ──────────────────────────────────────────────────────────────

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, newItem()]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const updateItem = useCallback(<K extends keyof ReceituarioItem>(
    id: string, field: K, value: ReceituarioItem[K]
  ) => {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, [field]: value } : it));
  }, []);

  // ── Verificação de controlado ao digitar o nome ───────────────────────────

  const handleNameChange = useCallback((id: string, value: string) => {
    setNameSearch((prev) => ({ ...prev, [id]: value }));
    updateItem(id, "name", value);

    if (value.trim().length < 3) return;
    const controlled = findControlledByName?.(value);
    if (controlled) {
      toast.warning(`${value} é medicamento controlado`, {
        description: `Exige ${controlled} — use o formulário de Prescrição Controlada. Este item não pode constar no receituário comum.`,
        duration: 7000,
      });
      // Remove o item adicionado e limpa o campo
      setItems((prev) => prev.map((it) =>
        it.id === id ? { ...it, name: "" } : it
      ));
      setNameSearch((prev) => ({ ...prev, [id]: "" }));
    }
  }, [updateItem, findControlledByName]);

  // ── Build do payload ───────────────────────────────────────────────────────

  const buildPayload = (): ReceituarioData => ({
    type,
    patient_id: patientId ?? null,
    patient_name: patientName,
    patient_bed: patientBed,
    patient_sector: patientSector,
    items,
    free_text: freeText || undefined,
    signed_by_name: doctorName || undefined,
    signed_by_crm: crm || undefined,
  });

  // ── Ações ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (items.length === 0 && !freeText.trim()) {
      toast.error("Adicione pelo menos um medicamento ou orientação antes de salvar");
      return;
    }
    setSaving(true);
    try {
      await onSave(buildPayload());
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    if (items.length === 0 && !freeText.trim()) {
      toast.error("Adicione pelo menos um medicamento ou orientação antes de imprimir");
      return;
    }
    setPrinting(true);
    try {
      // Grava PRIMEIRO. Se falhar, nada é impresso — receituário no papel
      // sem contrapartida no sistema é o furo de rastreabilidade que essa
      // correção veio fechar.
      const ok = await onSave(buildPayload());
      if (!ok) return;
      await printReceituario(buildPayload(), hospitalName);
    } finally {
      setPrinting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={cn("space-y-4", className)}>

      {/* ── Lista de medicamentos ── */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">
          Medicamentos
        </Label>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="grid gap-1.5 p-2.5 rounded-lg border border-border/70 bg-muted/20"
            >
              {/* Linha 1: número + nome */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground w-4 shrink-0">
                  {idx + 1}.
                </span>
                <Input
                  value={item.name}
                  onChange={(e) => handleNameChange(item.id, e.target.value)}
                  placeholder="Nome do medicamento..."
                  className="h-7 text-xs flex-1"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Linha 2: dose + via + frequência + duração */}
              <div className="grid grid-cols-2 gap-1.5 pl-6 sm:grid-cols-4">
                <div>
                  <p className="text-[9px] text-muted-foreground mb-0.5">Dose</p>
                  <Input
                    value={item.dose}
                    onChange={(e) => updateItem(item.id, "dose", e.target.value)}
                    placeholder="Ex: 500mg"
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground mb-0.5">Via</p>
                  <Select
                    value={item.route}
                    onValueChange={(v) => updateItem(item.id, "route", v)}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECEITUARIO_ROUTES.map((r) => (
                        <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground mb-0.5">Frequência</p>
                  <Select
                    value={item.frequency}
                    onValueChange={(v) => updateItem(item.id, "frequency", v)}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECEITUARIO_FREQUENCIES.map((f) => (
                        <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground mb-0.5">Duração</p>
                  <Input
                    value={item.duration}
                    onChange={(e) => updateItem(item.id, "duration", e.target.value)}
                    placeholder="Ex: 5 dias"
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Botão adicionar */}
        <Button
          variant="outline"
          size="sm"
          className="mt-2 h-7 text-xs gap-1.5 border-dashed w-full"
          onClick={addItem}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar medicamento
        </Button>

        {/* Aviso sobre controlados */}
        <div className="flex items-start gap-1.5 mt-1.5 text-[10px] text-amber-700 dark:text-amber-500">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          Medicamentos controlados (Receita Azul/Especial) não podem ser incluídos aqui — use o formulário de Prescrição Controlada.
        </div>
      </div>

      {/* ── Orientações gerais (texto livre) ── */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">
          Orientações gerais (opcional)
        </Label>
        <Textarea
          rows={3}
          className="text-xs"
          placeholder="Instruções adicionais, cuidados em casa, retorno..."
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
        />
      </div>

      {/* ── Médico responsável ── */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Médico responsável</Label>
          <Input
            className="h-8 text-xs"
            placeholder="Nome completo"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">CRM</Label>
          <Input
            className="h-8 text-xs"
            placeholder="CRM-XX 000000"
            value={crm}
            onChange={(e) => setCrm(e.target.value)}
          />
        </div>
      </div>

      {/* ── Ações ── */}
      <div className="flex gap-2 pt-1">
        <Button
          className="flex-1 gap-1.5"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={handlePrint}
          disabled={printing || items.length === 0}
          title={items.length === 0 ? "Adicione medicamentos para imprimir" : "Imprimir receituário"}
        >
          <Printer className="h-4 w-4" />
          {printing ? "Aguarde..." : "Imprimir"}
        </Button>
      </div>
    </div>
  );
}
