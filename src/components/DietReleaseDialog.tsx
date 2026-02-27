import { useState } from "react";
import { Patient } from "@/types/patient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Utensils, Printer, Eye, Apple, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { PrintableDietDocument } from "./PrintableDietDocument";

interface DietReleaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
}

const DIET_TYPES = [
  "Livre",
  "Branda", 
  "Pastosa",
  "Liquidificada",
  "Líquida",
];

const RESTRICTIONS = [
  { id: "hipossodica", label: "Hipossódica", desc: "Hipertensão" },
  { id: "diabetica", label: "Diabética", desc: "DM" },
  { id: "renal", label: "Renal", desc: "DRC" },
  { id: "hipogordurosa", label: "Hipogordurosa", desc: "" },
  { id: "hipoproteica", label: "Hipoproteica", desc: "" },
  { id: "sem_residuo", label: "Sem Resíduo", desc: "" },
];

export function DietReleaseDialog({ isOpen, onClose, patient }: DietReleaseDialogProps) {
  const [dietRoute, setDietRoute] = useState<"oral" | "enteral">("oral");
  const [selectedDietType, setSelectedDietType] = useState<string>("");
  const [customDietType, setCustomDietType] = useState("");
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([]);
  const [customRestriction, setCustomRestriction] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [crm, setCrm] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const formatDateInput = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  };

  const handleRestrictionChange = (restrictionId: string, checked: boolean) => {
    if (checked) {
      setSelectedRestrictions([...selectedRestrictions, restrictionId]);
    } else {
      setSelectedRestrictions(selectedRestrictions.filter(r => r !== restrictionId));
    }
  };

  const getSelectedRestrictionsLabels = () => {
    const labels = selectedRestrictions.map(id => {
      const restriction = RESTRICTIONS.find(r => r.id === id);
      return restriction?.label || id;
    });
    if (customRestriction.trim()) {
      labels.push(customRestriction.trim());
    }
    return labels;
  };

  const getDietTypeDisplay = () => {
    if (customDietType.trim()) {
      return selectedDietType ? `${selectedDietType} + ${customDietType}` : customDietType;
    }
    return selectedDietType;
  };

  const handlePrint = () => {
    setShowPreview(true);
  };

  const handleClose = () => {
    setShowPreview(false);
    setDietRoute("oral");
    setSelectedDietType("");
    setCustomDietType("");
    setSelectedRestrictions([]);
    setCustomRestriction("");
    setBirthDate("");
    setDoctorName("");
    setCrm("");
    onClose();
  };

  const isFormValid = selectedDietType || customDietType.trim();

  if (showPreview) {
    return (
      <PrintableDietDocument
        patient={patient}
        dietRoute={dietRoute}
        dietType={getDietTypeDisplay()}
        restrictions={getSelectedRestrictionsLabels()}
        birthDate={birthDate}
        doctorName={doctorName}
        crm={crm}
        onClose={() => setShowPreview(false)}
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <Utensils className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <span>Autorização de Dieta</span>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">
                {patient.name} • Leito {patient.bedNumber}
              </p>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Formulário para autorização de dieta do paciente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Seção 1: Via da Dieta */}
          <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">1</span>
              Via da Dieta
            </Label>
            <RadioGroup
              value={dietRoute}
              onValueChange={(value) => setDietRoute(value as "oral" | "enteral")}
              className="flex gap-3 pt-1"
            >
              <label 
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all flex-1",
                  dietRoute === "oral" 
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" 
                    : "border-slate-200 dark:border-slate-600 hover:border-slate-300"
                )}
              >
                <RadioGroupItem value="oral" id="oral" className="sr-only" />
                <Apple className={cn("h-5 w-5", dietRoute === "oral" ? "text-emerald-600" : "text-slate-400")} />
                <span className={cn("font-medium", dietRoute === "oral" ? "text-emerald-700 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300")}>
                  Oral
                </span>
              </label>
              <label 
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all flex-1",
                  dietRoute === "enteral" 
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                    : "border-slate-200 dark:border-slate-600 hover:border-slate-300"
                )}
              >
                <RadioGroupItem value="enteral" id="enteral" className="sr-only" />
                <Heart className={cn("h-5 w-5", dietRoute === "enteral" ? "text-blue-600" : "text-slate-400")} />
                <span className={cn("font-medium", dietRoute === "enteral" ? "text-blue-700 dark:text-blue-400" : "text-slate-600 dark:text-slate-300")}>
                  Enteral
                </span>
              </label>
            </RadioGroup>
          </div>

          {/* Seção 2: Tipo de Dieta */}
          <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">2</span>
              Tipo de Dieta
            </Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {DIET_TYPES.map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={selectedDietType === type ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-10 px-4 text-sm font-medium transition-all",
                    selectedDietType === type 
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md" 
                      : "hover:border-emerald-300 hover:text-emerald-700"
                  )}
                  onClick={() => setSelectedDietType(selectedDietType === type ? "" : type)}
                >
                  {type}
                </Button>
              ))}
            </div>
            <Input
              placeholder="Especificações adicionais ou outro tipo..."
              value={customDietType}
              onChange={(e) => setCustomDietType(e.target.value)}
              className="text-sm mt-2"
            />
          </div>

          {/* Seção 3: Restrições/Comorbidades */}
          <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">3</span>
              Restrições / Comorbidades
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {RESTRICTIONS.map((restriction) => (
                <label
                  key={restriction.id}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all",
                    selectedRestrictions.includes(restriction.id)
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                      : "border-slate-200 dark:border-slate-600 hover:border-slate-300"
                  )}
                >
                  <Checkbox
                    id={restriction.id}
                    checked={selectedRestrictions.includes(restriction.id)}
                    onCheckedChange={(checked) => handleRestrictionChange(restriction.id, !!checked)}
                    className="sr-only"
                  />
                  <div className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center",
                    selectedRestrictions.includes(restriction.id)
                      ? "bg-amber-500 border-amber-500"
                      : "border-slate-300 dark:border-slate-500"
                  )}>
                    {selectedRestrictions.includes(restriction.id) && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className={cn(
                      "text-sm font-medium",
                      selectedRestrictions.includes(restriction.id) ? "text-amber-700 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"
                    )}>
                      {restriction.label}
                    </span>
                    {restriction.desc && (
                      <span className="text-xs text-muted-foreground">{restriction.desc}</span>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <Textarea
              placeholder="Outras restrições ou observações específicas..."
              value={customRestriction}
              onChange={(e) => setCustomRestriction(e.target.value)}
              className="text-sm min-h-[60px] mt-2"
            />
          </div>

          {/* Seção 4: Dados do Paciente */}
          <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">4</span>
              Data de Nascimento
            </Label>
            <Input
              placeholder="DD/MM/AAAA"
              value={birthDate}
              onChange={(e) => setBirthDate(formatDateInput(e.target.value))}
              maxLength={10}
              className="text-sm max-w-[200px]"
            />
          </div>

          {/* Seção 5: Médico Responsável */}
          <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">5</span>
              Médico Responsável
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome Completo</Label>
                <Input
                  placeholder="Dr(a). Nome Completo"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">CRM</Label>
                <Input
                  placeholder="CRM-MA 00000"
                  value={crm}
                  onChange={(e) => setCrm(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="ghost" onClick={handleClose} className="text-slate-600">
            Cancelar
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              disabled={!isFormValid}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Visualizar
            </Button>
            <Button
              onClick={handlePrint}
              disabled={!isFormValid}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Printer className="h-4 w-4" />
              Gerar Documento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
