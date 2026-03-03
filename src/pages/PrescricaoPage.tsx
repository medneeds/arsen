import { useState, useRef, useMemo, useCallback } from "react";
import { format } from "date-fns";
import bighelpLogo from "@/assets/bighelp-map-logo.png";
import socorraoLogo from "@/assets/socorrao1-logo.png";
import { ptBR } from "date-fns/locale";
import {
  Pill, Plus, Trash2, Copy, Printer, Save, RefreshCw,
  Search, AlertTriangle,
  UtensilsCrossed, Droplets, Syringe, ClipboardList, X, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  MEDICATIONS_DATABASE,
  DIET_OPTIONS,
  SOLUTION_OPTIONS,
  ROUTES,
  POSOLOGIES,
  COMMON_SCHEDULES,
  RECOMMENDATION_TEMPLATES,
  type MedicationEntry,
} from "@/data/medicationsDatabase";

// --- Types ---
interface PrescriptionItem {
  id: string;
  name: string;
  presentation: string;
  dose: string;
  route: string;
  posology: string;
  schedule: string;
  instructions: string;
  category: 'medicamento' | 'solucao' | 'dieta';
}

interface PatientHeader {
  name: string;
  birthDate: string;
  age: string;
  sex: string;
  bed: string;
  unit: string;
  record: string;
  admissionDate: string;
  weight: string;
  allergies: string;
}

// --- Autocomplete Component ---
function MedicationAutocomplete({
  source,
  onSelect,
  placeholder,
}: {
  source: MedicationEntry[];
  onSelect: (med: MedicationEntry) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return source.slice(0, 8);
    const q = query.toLowerCase();
    return source.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.presentation.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [query, source]);

  const handleSelect = (med: MedicationEntry) => {
    onSelect(med);
    setQuery("");
    setFocused(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder={placeholder}
          className="pl-9 bg-muted/30 border-border/50 focus:border-primary/50 transition-colors"
        />
      </div>
      {focused && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-64 overflow-y-auto">
          {filtered.map((med) => (
            <button
              key={med.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(med)}
              className="w-full px-3 py-2.5 text-left hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 border-b border-border/30 last:border-0"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground block truncate">{med.name}</span>
                <span className="text-xs text-muted-foreground block truncate">{med.presentation}</span>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {med.defaultRoute}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Prescription Item Row (screen) ---
function PrescriptionItemRow({
  item,
  index,
  onUpdate,
  onRemove,
}: {
  item: PrescriptionItem;
  index: number;
  onUpdate: (id: string, field: keyof PrescriptionItem, value: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="group relative rounded-lg border border-border/50 bg-card/50 hover:border-primary/20 transition-all print:hidden">
      <div className="flex items-start gap-2 p-2.5">
        <span className="text-xs font-mono text-muted-foreground w-6 text-center shrink-0 pt-1.5">
          {index + 1}.
        </span>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">
              {item.name}
              {item.presentation && item.presentation !== '-' && (
                <span className="font-normal text-muted-foreground ml-1">({item.presentation})</span>
              )}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive ml-auto"
              onClick={() => onRemove(item.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Input value={item.dose} onChange={(e) => onUpdate(item.id, "dose", e.target.value)} className="h-7 text-xs bg-muted/20 border-border/30 w-24" placeholder="Dose" />
            <span className="text-muted-foreground text-[10px]">—</span>
            <Select value={item.route} onValueChange={(v) => onUpdate(item.id, "route", v)}>
              <SelectTrigger className="h-7 text-xs bg-muted/20 border-border/30 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{ROUTES.map((r) => (<SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>))}</SelectContent>
            </Select>
            <span className="text-muted-foreground text-[10px]">—</span>
            <Select value={item.posology} onValueChange={(v) => onUpdate(item.id, "posology", v)}>
              <SelectTrigger className="h-7 text-xs bg-muted/20 border-border/30 w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{POSOLOGIES.map((p) => (<SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>))}</SelectContent>
            </Select>
            <span className="text-muted-foreground text-[10px]">—</span>
            <Input value={item.schedule} onChange={(e) => onUpdate(item.id, "schedule", e.target.value)} className="h-7 text-xs bg-muted/20 border-border/30 w-20" placeholder="Horário" />
          </div>
          <div className="relative">
            <Input value={item.instructions} onChange={(e) => onUpdate(item.id, "instructions", e.target.value)} className="h-7 text-[11px] bg-muted/10 border-border/20 text-muted-foreground italic pl-2.5 focus:text-foreground focus:not-italic" placeholder="Preparo, diluição, tempo de infusão, gotas/min, mL/h..." />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Print-only Item Row (flat text, no inputs) ---
function PrintItemRow({ item, index }: { item: PrescriptionItem; index: number }) {
  return (
    <tr style={{ pageBreakInside: 'avoid' }}>
      <td className="border border-black/25 px-1 py-[2px] align-top" style={{ width: '75%' }}>
        <p className="text-[9px] leading-[1.3]">
          <span className="font-bold">{index + 1}. {item.name}</span>
          {item.presentation && item.presentation !== '-' && (
            <span className="font-normal"> ({item.presentation})</span>
          )}
          {item.dose && item.dose !== '-' && <span> — {item.dose}</span>}
          {item.route && item.route !== '-' && <span> — {item.route}</span>}
          {item.posology && item.posology !== '-' && <span> — {item.posology}</span>}
          {item.schedule && item.schedule !== '-' && <span> — <span className="font-semibold">{item.schedule}</span></span>}
        </p>
        {item.instructions && (
          <p className="text-[8px] italic text-gray-600 ml-2 leading-[1.2]">
            ↳ {item.instructions}
          </p>
        )}
      </td>
      {[0,1,2,3,4,5].map(i => (
        <td key={i} className="border border-black/25 text-center align-middle" style={{ width: '4.16%', minWidth: '24px' }}>
          <div className="h-[18px]" />
        </td>
      ))}
    </tr>
  );
}

// --- Print-only simple row (diets, recommendations) ---
function PrintSimpleRow({ text, index }: { text: string; index: number }) {
  return (
    <tr style={{ pageBreakInside: 'avoid' }}>
      <td className="border border-black/25 px-1 py-[2px] align-top" colSpan={7}>
        <p className="text-[9px] leading-[1.3]">
          <span className="font-bold">{index + 1}.</span> {text}
        </p>
      </td>
    </tr>
  );
}

// --- Section Header ---
function SectionHeader({
  icon: Icon,
  title,
  count,
  color,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className={cn("p-1.5 rounded-md", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</h3>
      {count > 0 && (
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{count}</Badge>
      )}
    </div>
  );
}


// ===================== MAIN COMPONENT =====================
const PrescricaoPage = () => {
  // Patient header state
  const [patient, setPatient] = useState<PatientHeader>({
    name: "", birthDate: "", age: "", sex: "", bed: "",
    unit: "", record: "", admissionDate: "", weight: "", allergies: "",
  });

  // Prescription items
  const [diets, setDiets] = useState<PrescriptionItem[]>([]);
  const [solutions, setSolutions] = useState<PrescriptionItem[]>([]);
  const [medications, setMedications] = useState<PrescriptionItem[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [newRecommendation, setNewRecommendation] = useState("");
  const [recSearchQuery, setRecSearchQuery] = useState("");

  const prescriptionDate = format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });

  // --- Handlers ---
  const createItem = (med: MedicationEntry, cat: 'medicamento' | 'solucao' | 'dieta'): PrescriptionItem => ({
    id: crypto.randomUUID(),
    name: med.name,
    presentation: med.presentation,
    dose: med.defaultDose,
    route: med.defaultRoute,
    posology: med.defaultPosology,
    schedule: med.defaultSchedule,
    instructions: med.instructions || "",
    category: cat,
  });

  const addDiet = (med: MedicationEntry) => setDiets((prev) => [...prev, createItem(med, 'dieta')]);
  const addSolution = (med: MedicationEntry) => setSolutions((prev) => [...prev, createItem(med, 'solucao')]);
  const addMedication = (med: MedicationEntry) => setMedications((prev) => [...prev, createItem(med, 'medicamento')]);

  const updateItem = useCallback((setter: React.Dispatch<React.SetStateAction<PrescriptionItem[]>>) => {
    return (id: string, field: keyof PrescriptionItem, value: string) => {
      setter((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    };
  }, []);

  const removeItem = useCallback((setter: React.Dispatch<React.SetStateAction<PrescriptionItem[]>>) => {
    return (id: string) => {
      setter((prev) => prev.filter((item) => item.id !== id));
    };
  }, []);

  const addRecommendation = (rec: string) => {
    if (rec.trim() && !recommendations.includes(rec.trim())) {
      setRecommendations((prev) => [...prev, rec.trim()]);
      setNewRecommendation("");
      setRecSearchQuery("");
    }
  };

  const removeRecommendation = (index: number) => {
    setRecommendations((prev) => prev.filter((_, i) => i !== index));
  };

  const filteredRecTemplates = useMemo(() => {
    if (!recSearchQuery.trim()) return RECOMMENDATION_TEMPLATES;
    const q = recSearchQuery.toLowerCase();
    return RECOMMENDATION_TEMPLATES.filter((r) => r.toLowerCase().includes(q));
  }, [recSearchQuery]);

  const totalItems = diets.length + solutions.length + medications.length + recommendations.length;

  const handleRenew = () => {
    toast.success("Prescrição renovada para o dia seguinte", { description: "Todos os itens foram mantidos com data atualizada." });
  };

  const handleSave = () => {
    if (!patient.name.trim()) {
      toast.error("Preencha o nome do paciente");
      return;
    }
    toast.success("Prescrição salva com sucesso", { description: `${totalItems} itens registrados.` });
  };

  const handlePrint = () => {
    window.print();
  };

  const updatePatient = (field: keyof PatientHeader, value: string) => {
    setPatient((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5 print:p-2 print:space-y-1 print:max-w-none print:text-black">
      {/* ===== PRINT-ONLY LETTERHEAD + PATIENT INFO (combined, compact) ===== */}
      <div className="hidden print:block prescription-print-section mb-1">
        {/* Letterhead */}
        <div className="flex items-center justify-between border-b-2 border-black pb-1 mb-1">
          <img src={socorraoLogo} alt="Socorrão I" className="h-8 object-contain" />
          <div className="text-center flex-1 px-2">
            <p className="text-[10px] font-bold uppercase tracking-wide leading-tight text-black">Hospital Municipal Djalma Marques — Socorrão I</p>
            <p className="text-[8px] text-gray-500 leading-tight">Prescrição Médica Diária</p>
          </div>
          <img src={bighelpLogo} alt="BigHelp Map" className="h-7 object-contain" />
        </div>
        {/* Patient Grid - full width, 2 rows */}
        <table className="w-full border-collapse border border-black/30 text-[9px] text-black">
          <tbody>
            <tr>
              <td className="border border-black/20 px-1 py-[2px]" colSpan={3}><span className="font-bold">Paciente:</span> {patient.name || '___________________________________'}</td>
              <td className="border border-black/20 px-1 py-[2px]"><span className="font-bold">Leito:</span> {patient.bed || '______'}</td>
              <td className="border border-black/20 px-1 py-[2px]"><span className="font-bold">Prontuário:</span> {patient.record || '________'}</td>
              <td className="border border-black/20 px-1 py-[2px]"><span className="font-bold">Data:</span> {prescriptionDate}</td>
            </tr>
            <tr>
              <td className="border border-black/20 px-1 py-[2px]"><span className="font-bold">Idade:</span> {patient.age || '____'}</td>
              <td className="border border-black/20 px-1 py-[2px]"><span className="font-bold">Sexo:</span> {patient.sex || '____'}</td>
              <td className="border border-black/20 px-1 py-[2px]"><span className="font-bold">Peso:</span> {patient.weight ? `${patient.weight}kg` : '____'}</td>
              <td className="border border-black/20 px-1 py-[2px]"><span className="font-bold">Admissão:</span> {patient.admissionDate || '__/__/____'}</td>
              <td className="border border-black/20 px-1 py-[2px]" colSpan={2}><span className="font-bold text-red-600">Alergias:</span> <span className="text-red-600 font-semibold">{patient.allergies || 'NDAM'}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      {/* Page Title Bar */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
            <Pill className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Prescrição Médica</h1>
            <p className="text-xs text-muted-foreground">Prescrição médica diária digital</p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handleRenew} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Renovar
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            Salvar
          </Button>
        </div>
      </div>

      {/* ===== PATIENT HEADER ===== */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 print:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificação do Paciente</h2>
          <span className="text-xs text-muted-foreground font-mono">{prescriptionDate}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="col-span-2">
            <Label className="text-[11px] text-muted-foreground">Paciente</Label>
            <Input value={patient.name} onChange={(e) => updatePatient("name", e.target.value)} placeholder="Nome completo" className="mt-0.5 h-8 text-sm font-medium" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Nascimento</Label>
            <Input type="date" value={patient.birthDate} onChange={(e) => updatePatient("birthDate", e.target.value)} className="mt-0.5 h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Idade</Label>
            <Input value={patient.age} onChange={(e) => updatePatient("age", e.target.value)} placeholder="Ex: 71 anos" className="mt-0.5 h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Sexo</Label>
            <Select value={patient.sex} onValueChange={(v) => updatePatient("sex", v)}>
              <SelectTrigger className="mt-0.5 h-8 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Masculino">Masculino</SelectItem>
                <SelectItem value="Feminino">Feminino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Leito</Label>
            <Input value={patient.bed} onChange={(e) => updatePatient("bed", e.target.value)} placeholder="Ex: 11" className="mt-0.5 h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Prontuário</Label>
            <Input value={patient.record} onChange={(e) => updatePatient("record", e.target.value)} placeholder="Nº prontuário" className="mt-0.5 h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Admissão</Label>
            <Input type="date" value={patient.admissionDate} onChange={(e) => updatePatient("admissionDate", e.target.value)} className="mt-0.5 h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Unidade</Label>
            <Input value={patient.unit} onChange={(e) => updatePatient("unit", e.target.value)} placeholder="Ex: UTI 2" className="mt-0.5 h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Peso (kg)</Label>
            <Input value={patient.weight} onChange={(e) => updatePatient("weight", e.target.value)} placeholder="Ex: 72" className="mt-0.5 h-8 text-xs" />
          </div>
          <div className="col-span-2">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-destructive" /> Alergias
            </Label>
            <Input
              value={patient.allergies}
              onChange={(e) => updatePatient("allergies", e.target.value)}
              placeholder="Informe alergias medicamentosas"
              className="mt-0.5 h-8 text-xs border-destructive/20 focus:border-destructive/50"
            />
          </div>
        </div>
      </div>

      {/* ===== DIETAS ===== */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 print:hidden">
        <SectionHeader icon={UtensilsCrossed} title="Dietas" count={diets.length} color="bg-emerald-500/10 text-emerald-500" />
        {diets.length > 0 && (
          <div className="space-y-1.5">
            {diets.map((item, i) => (
              <div key={item.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border/40 bg-muted/20 group">
                <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                <span className="text-sm font-medium text-foreground flex-1">{item.name}</span>
                <Badge variant="outline" className="text-[10px]">{item.dose !== '-' ? item.dose : ''}</Badge>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => removeItem(setDiets)(item.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <MedicationAutocomplete source={DIET_OPTIONS} onSelect={addDiet} placeholder="Buscar dieta..." />
      </div>

      {/* ===== SOLUÇÕES ===== */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 print:hidden">
        <SectionHeader icon={Droplets} title="Soluções" count={solutions.length} color="bg-blue-500/10 text-blue-500" />
        {solutions.length > 0 && (
          <div className="space-y-1.5">
            {solutions.map((item, i) => (
              <PrescriptionItemRow key={item.id} item={item} index={i} onUpdate={updateItem(setSolutions)} onRemove={removeItem(setSolutions)} />
            ))}
          </div>
        )}
        <MedicationAutocomplete source={SOLUTION_OPTIONS} onSelect={addSolution} placeholder="Buscar solução..." />
      </div>

      {/* ===== MEDICAMENTOS ===== */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 print:hidden">
        <SectionHeader icon={Syringe} title="Medicamentos" count={medications.length} color="bg-primary/10 text-primary" />
        {medications.length > 0 && (
          <div className="space-y-1.5">
            {medications.map((item, i) => (
              <PrescriptionItemRow key={item.id} item={item} index={i} onUpdate={updateItem(setMedications)} onRemove={removeItem(setMedications)} />
            ))}
          </div>
        )}
        <MedicationAutocomplete source={MEDICATIONS_DATABASE} onSelect={addMedication} placeholder="Buscar medicamento... (ex: Omeprazol, Dipirona, Noradrenalina)" />
      </div>

      {/* ===== RECOMENDAÇÕES ===== */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 print:hidden">
        <SectionHeader icon={ClipboardList} title="Recomendações" count={recommendations.length} color="bg-amber-500/10 text-amber-500" />
        {recommendations.length > 0 && (
          <div className="space-y-1">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 px-2.5 py-2 rounded-lg border border-border/40 bg-muted/20 group">
                <span className="text-xs font-mono text-muted-foreground mt-0.5 w-5">{i + 1}.</span>
                <p className="text-sm text-foreground flex-1">{rec}</p>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => removeRecommendation(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={recSearchQuery} onChange={(e) => setRecSearchQuery(e.target.value)} placeholder="Buscar recomendação pré-definida..." className="pl-9 bg-muted/30 border-border/50" />
          </div>
          {recSearchQuery && (
            <div className="rounded-lg border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
              {filteredRecTemplates.map((rec, i) => (
                <button key={i} type="button" onClick={() => addRecommendation(rec)} disabled={recommendations.includes(rec)} className="w-full px-3 py-2 text-left hover:bg-accent/50 transition-colors text-sm border-b border-border/30 last:border-0 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                  {recommendations.includes(rec) ? <Check className="h-3 w-3 text-primary shrink-0" /> : <Plus className="h-3 w-3 text-muted-foreground shrink-0" />}
                  <span className="truncate">{rec}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input value={newRecommendation} onChange={(e) => setNewRecommendation(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addRecommendation(newRecommendation); }} placeholder="Digitar recomendação personalizada..." className="bg-muted/30 border-border/50" />
            <Button variant="outline" size="sm" onClick={() => addRecommendation(newRecommendation)} disabled={!newRecommendation.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ===== PRINT-ONLY PRESCRIPTION BODY (flat text) ===== */}
      {/* ========================================================= */}
      <div className="hidden print:block prescription-print-section">
        <table className="w-full border-collapse text-black">
          {/* Table header with aprazamento columns */}
          <thead>
            <tr>
              <th className="border border-black/30 px-1 py-[2px] text-left text-[8px] font-bold uppercase tracking-wider bg-gray-100" style={{ width: '75%' }}>
                Prescrição
              </th>
              {['','','','','',''].map((_, i) => (
                <th key={i} className="border border-black/30 px-0 py-[2px] text-center text-[7px] font-bold bg-gray-100 uppercase" style={{ width: '4.16%' }}>
                  {i === 0 ? 'Apraz.' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* DIETAS */}
            {diets.length > 0 && (
              <>
                <tr><td colSpan={7} className="border border-black/30 px-1 py-[1px] text-[8px] font-bold uppercase tracking-wider bg-gray-50">Dietas</td></tr>
                {diets.map((item, i) => (
                  <PrintSimpleRow key={item.id} text={`${item.name}${item.dose && item.dose !== '-' ? ` — ${item.dose}` : ''}`} index={i} />
                ))}
              </>
            )}

            {/* SOLUÇÕES */}
            {solutions.length > 0 && (
              <>
                <tr><td colSpan={7} className="border border-black/30 px-1 py-[1px] text-[8px] font-bold uppercase tracking-wider bg-gray-50">Soluções</td></tr>
                {solutions.map((item, i) => (
                  <PrintItemRow key={item.id} item={item} index={i} />
                ))}
              </>
            )}

            {/* MEDICAMENTOS */}
            {medications.length > 0 && (
              <>
                <tr><td colSpan={7} className="border border-black/30 px-1 py-[1px] text-[8px] font-bold uppercase tracking-wider bg-gray-50">Medicamentos</td></tr>
                {medications.map((item, i) => (
                  <PrintItemRow key={item.id} item={item} index={i + solutions.length} />
                ))}
              </>
            )}

            {/* RECOMENDAÇÕES */}
            {recommendations.length > 0 && (
              <>
                <tr><td colSpan={7} className="border border-black/30 px-1 py-[1px] text-[8px] font-bold uppercase tracking-wider bg-gray-50">Recomendações</td></tr>
                {recommendations.map((rec, i) => (
                  <PrintSimpleRow key={i} text={rec} index={i} />
                ))}
              </>
            )}
          </tbody>
        </table>

        {/* PRINT FOOTER */}
        <div className="pt-4 mt-2 border-t border-black/20 flex items-end justify-between" style={{ pageBreakInside: 'avoid' }}>
          <div className="text-[7px] text-gray-500">
            <p>Gerado em: {prescriptionDate}</p>
            <p>BigHelp Map — Prescrição Digital</p>
          </div>
          <div className="text-center">
            <div className="w-44 border-b border-black mb-1" />
            <p className="text-[8px] text-black font-medium">Assinatura / Carimbo do Médico</p>
            <p className="text-[7px] text-gray-500">CRM: _______________</p>
          </div>
        </div>
      </div>

      {/* ===== FOOTER SUMMARY (screen) ===== */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="gap-1 text-xs">
            <Pill className="h-3 w-3" />
            {totalItems} itens
          </Badge>
          <span className="text-xs text-muted-foreground">
            {diets.length} dietas · {solutions.length} soluções · {medications.length} medicamentos · {recommendations.length} recomendações
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRenew} className="gap-1.5 text-xs">
            <Copy className="h-3 w-3" />
            Duplicar para amanhã
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5 text-xs">
            <Save className="h-3 w-3" />
            Salvar prescrição
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PrescricaoPage;
