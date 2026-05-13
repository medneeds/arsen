import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MedicalResponsibility, MedicalResponsibilityType } from "@/types/patient";
import { X, Stethoscope, UserCog, UsersRound, Check, Baby, Bone, Scissors, Search, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface MedicalResponsibilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentResponsibility?: MedicalResponsibility;
  onSave: (responsibility: MedicalResponsibility) => void;
  sectorColor: string;
}

export const MedicalResponsibilityDialog = ({
  open,
  onOpenChange,
  currentResponsibility,
  onSave,
  sectorColor,
}: MedicalResponsibilityDialogProps) => {
  const [type, setType] = useState<MedicalResponsibilityType>(
    currentResponsibility?.type || null
  );
  const [officeNumber, setOfficeNumber] = useState(
    currentResponsibility?.officeNumber || ""
  );
  const [leaderNames, setLeaderNames] = useState(
    currentResponsibility?.leaderNames || ""
  );
  const [portaNames, setPortaNames] = useState(
    currentResponsibility?.portaNames || ""
  );

  const [responsibleDoctorId, setResponsibleDoctorId] = useState<string | undefined>(
    currentResponsibility?.responsibleDoctorId
  );
  const [responsibleDoctorName, setResponsibleDoctorName] = useState<string>(
    currentResponsibility?.responsibleDoctorName || ""
  );
  const [responsibleDoctorCrm, setResponsibleDoctorCrm] = useState<string | undefined>(
    currentResponsibility?.responsibleDoctorCrm
  );
  const [doctorQuery, setDoctorQuery] = useState("");
  const [doctorResults, setDoctorResults] = useState<Array<{ id: string; full_name: string; crm?: string | null }>>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!doctorQuery || doctorQuery.length < 2) {
      setDoctorResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, crm, access_profile, professional_type")
        .eq("status", "approved")
        .ilike("full_name", `%${doctorQuery}%`)
        .limit(10);
      if (cancelled) return;
      const filtered = (data || []).filter((p: any) => {
        const ap = (p.access_profile || "").toLowerCase();
        const pt = (p.professional_type || "").toLowerCase();
        return ap.includes("medic") || pt.includes("medic") || pt.includes("médic");
      });
      setDoctorResults(filtered as any);
      setSearching(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [doctorQuery]);

  const selectDoctor = (d: { id: string; full_name: string; crm?: string | null }) => {
    setResponsibleDoctorId(d.id);
    setResponsibleDoctorName(d.full_name);
    setResponsibleDoctorCrm(d.crm || undefined);
    setDoctorQuery("");
    setShowResults(false);
  };

  const clearDoctor = () => {
    setResponsibleDoctorId(undefined);
    setResponsibleDoctorName("");
    setResponsibleDoctorCrm(undefined);
  };

  const handleSave = () => {
    onSave({
      type,
      officeNumber: type === 'porta' || type === 'conjunto' || type === 'obstetra' || type === 'cirurgiao_geral' || type === 'traumatologista' ? officeNumber : undefined,
      leaderNames: type === 'lider' || type === 'conjunto' ? leaderNames : undefined,
      portaNames: type === 'porta' || type === 'conjunto' || type === 'obstetra' || type === 'cirurgiao_geral' || type === 'traumatologista' ? portaNames : undefined,
      responsibleDoctorId,
      responsibleDoctorName: responsibleDoctorName || undefined,
      responsibleDoctorCrm,
    });
    onOpenChange(false);
  };

  const handleClear = () => {
    setType(null);
    setOfficeNumber("");
    setLeaderNames("");
    setPortaNames("");
    clearDoctor();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto bg-background dark:bg-gray-900 border-2 dark:border-gray-700 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2 dark:text-white" style={{ color: sectorColor }}>
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm"
              style={{ backgroundColor: `${sectorColor}20` }}
            >
              <UsersRound className="h-5 w-5" style={{ color: sectorColor }} />
            </div>
            Responsabilidade Médica
          </DialogTitle>
          <DialogDescription className="dark:text-gray-300">
            Configure o tipo de acompanhamento e responsáveis pelo paciente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Médico responsável (rotineiro do setor) */}
          <div className="space-y-2 p-3 rounded-xl border-2 border-dashed bg-muted/30 dark:bg-gray-800/40 dark:border-gray-700">
            <Label className="text-sm font-semibold flex items-center gap-2 dark:text-white">
              <UserCheck className="h-4 w-4" style={{ color: sectorColor }} />
              Médico Responsável
            </Label>
            {responsibleDoctorName ? (
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background dark:bg-gray-900 border">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold uppercase truncate">{responsibleDoctorName}</span>
                  {responsibleDoctorCrm && (
                    <span className="text-[10px] text-muted-foreground">CRM {responsibleDoctorCrm}</span>
                  )}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={clearDoctor} className="h-7 px-2 text-xs">
                  <X className="h-3.5 w-3.5 mr-1" /> Trocar
                </Button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={doctorQuery}
                    onChange={(e) => { setDoctorQuery(e.target.value); setShowResults(true); }}
                    onFocus={() => setShowResults(true)}
                    placeholder="Buscar médico (nome) — mínimo 2 caracteres"
                    className="pl-8 h-9 text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  />
                </div>
                {showResults && doctorQuery.length >= 2 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-popover shadow-lg dark:bg-gray-900 dark:border-gray-700">
                    {searching && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">Buscando…</div>
                    )}
                    {!searching && doctorResults.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum médico encontrado</div>
                    )}
                    {!searching && doctorResults.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => selectDoctor(d)}
                        className="w-full text-left px-3 py-2 hover:bg-accent dark:hover:bg-gray-800 border-b last:border-b-0 dark:border-gray-700"
                      >
                        <div className="text-xs font-semibold uppercase">{d.full_name}</div>
                        {d.crm && <div className="text-[10px] text-muted-foreground">CRM {d.crm}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground italic">
              Por padrão, é o médico que admitiu. Use a busca para redefinir para o rotineiro do setor.
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold text-foreground dark:text-white">Selecione o Tipo de Acompanhamento</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setType(null)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all hover:shadow-md dark:hover:shadow-gray-700/50",
                  type === null
                    ? 'border-gray-400 bg-gray-50 dark:bg-gray-800 dark:border-gray-500 shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800/50'
                )}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700">
                  <X className="h-5 w-5 text-gray-500 dark:text-gray-300" />
                </div>
                <span className="font-semibold text-xs dark:text-white">Nenhum</span>
              </button>
              
              <button
                type="button"
                onClick={() => setType('porta')}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all hover:shadow-md dark:hover:shadow-lg animate-fade-in",
                  type === 'porta' && 'shadow-md dark:shadow-lg',
                  type !== 'porta' && 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
                )}
                style={{
                  borderColor: type === 'porta' ? sectorColor : undefined,
                  backgroundColor: type === 'porta' ? `${sectorColor}20` : undefined,
                }}
              >
                <div 
                  className="flex items-center justify-center w-10 h-10 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: `${sectorColor}25` }}
                >
                  <Stethoscope className="h-5 w-5" style={{ color: sectorColor }} />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-semibold text-xs dark:text-white">Porta</span>
                  <span className="text-[10px] text-muted-foreground dark:text-gray-400 text-center leading-tight">Consultório</span>
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => setType('lider')}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all hover:shadow-md dark:hover:shadow-lg animate-fade-in",
                  type === 'lider' && 'shadow-md dark:shadow-lg',
                  type !== 'lider' && 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
                )}
                style={{
                  borderColor: type === 'lider' ? sectorColor : undefined,
                  backgroundColor: type === 'lider' ? `${sectorColor}20` : undefined,
                }}
              >
                <div 
                  className="flex items-center justify-center w-10 h-10 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: `${sectorColor}25` }}
                >
                  <UserCog className="h-5 w-5" style={{ color: sectorColor }} />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-semibold text-xs dark:text-white">Líder</span>
                  <span className="text-[10px] text-muted-foreground dark:text-gray-400 text-center leading-tight">100% do caso</span>
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => setType('conjunto')}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all hover:shadow-md dark:hover:shadow-lg animate-fade-in",
                  type === 'conjunto' && 'shadow-md dark:shadow-lg',
                  type !== 'conjunto' && 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
                )}
                style={{
                  borderColor: type === 'conjunto' ? sectorColor : undefined,
                  backgroundColor: type === 'conjunto' ? `${sectorColor}20` : undefined,
                }}
              >
                <div 
                  className="flex items-center justify-center w-10 h-10 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: `${sectorColor}25` }}
                >
                  <UsersRound className="h-5 w-5" style={{ color: sectorColor }} />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-semibold text-xs dark:text-white">Conjunto</span>
                  <span className="text-[10px] text-muted-foreground dark:text-gray-400 text-center leading-tight">Líder + Porta</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('obstetra')}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all hover:shadow-md dark:hover:shadow-lg animate-fade-in",
                  type === 'obstetra' && 'shadow-md dark:shadow-lg',
                  type !== 'obstetra' && 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
                )}
                style={{
                  borderColor: type === 'obstetra' ? sectorColor : undefined,
                  backgroundColor: type === 'obstetra' ? `${sectorColor}20` : undefined,
                }}
              >
                <div 
                  className="flex items-center justify-center w-10 h-10 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: `${sectorColor}25` }}
                >
                  <Baby className="h-5 w-5" style={{ color: sectorColor }} />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-semibold text-xs dark:text-white">Obstetra</span>
                  <span className="text-[10px] text-muted-foreground dark:text-gray-400 text-center leading-tight">Especialista</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('cirurgiao_geral')}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all hover:shadow-md dark:hover:shadow-lg animate-fade-in",
                  type === 'cirurgiao_geral' && 'shadow-md dark:shadow-lg',
                  type !== 'cirurgiao_geral' && 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
                )}
                style={{
                  borderColor: type === 'cirurgiao_geral' ? sectorColor : undefined,
                  backgroundColor: type === 'cirurgiao_geral' ? `${sectorColor}20` : undefined,
                }}
              >
                <div 
                  className="flex items-center justify-center w-10 h-10 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: `${sectorColor}25` }}
                >
                  <Scissors className="h-5 w-5" style={{ color: sectorColor, strokeWidth: 2.5 }} />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-semibold text-xs dark:text-white">Cirurgião</span>
                  <span className="text-[10px] text-muted-foreground dark:text-gray-400 text-center leading-tight">Geral</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('traumatologista')}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all hover:shadow-md dark:hover:shadow-lg animate-fade-in",
                  type === 'traumatologista' && 'shadow-md dark:shadow-lg',
                  type !== 'traumatologista' && 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
                )}
                style={{
                  borderColor: type === 'traumatologista' ? sectorColor : undefined,
                  backgroundColor: type === 'traumatologista' ? `${sectorColor}20` : undefined,
                }}
              >
                <div 
                  className="flex items-center justify-center w-10 h-10 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: `${sectorColor}25` }}
                >
                  <Bone className="h-5 w-5" style={{ color: sectorColor }} />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-semibold text-xs dark:text-white">Traumato</span>
                  <span className="text-[10px] text-muted-foreground dark:text-gray-400 text-center leading-tight">Ortopedista</span>
                </div>
              </button>
            </div>
          </div>

          {(type === 'porta' || type === 'conjunto' || type === 'obstetra' || type === 'cirurgiao_geral' || type === 'traumatologista') && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="office" className="text-sm font-semibold flex items-center gap-2 dark:text-white">
                  <Stethoscope className="h-4 w-4" style={{ color: sectorColor }} />
                  Número do Consultório
                </Label>
                <Input
                  id="office"
                  value={officeNumber}
                  onChange={(e) => setOfficeNumber(e.target.value)}
                  placeholder="Ex: 3, 5A, etc."
                  className="border-2 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  style={{ borderColor: `${sectorColor}40` }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="portaNames" className="text-sm font-semibold flex items-center gap-2 dark:text-white">
                  <Stethoscope className="h-4 w-4" style={{ color: sectorColor }} />
                  {type === 'porta' || type === 'conjunto' ? 'Nomes dos Médicos Porta' : 'Nomes dos Médicos Especialistas'}
                </Label>
                <Input
                  id="portaNames"
                  value={portaNames}
                  onChange={(e) => setPortaNames(e.target.value)}
                  placeholder="Ex: Dr. Carlos, Dra. Ana"
                  className="border-2 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  style={{ borderColor: `${sectorColor}40` }}
                />
              </div>
            </div>
          )}

          {(type === 'lider' || type === 'conjunto') && (
            <div className="space-y-2">
              <Label htmlFor="leaders" className="text-sm font-semibold flex items-center gap-2 dark:text-white">
                <UserCog className="h-4 w-4" style={{ color: sectorColor }} />
                Nomes dos Médicos Líderes
              </Label>
              <Input
                id="leaders"
                value={leaderNames}
                onChange={(e) => setLeaderNames(e.target.value)}
                placeholder="Ex: Dr. João, Dra. Maria"
                className="border-2 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                style={{ borderColor: `${sectorColor}40` }}
              />
            </div>
          )}
        </div>

        <div className="flex justify-between gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleClear}
            className="gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 dark:border-gray-600 dark:hover:bg-destructive/20 dark:text-white transition-all"
          >
            <X className="h-4 w-4" />
            Limpar
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="hover:bg-accent dark:border-gray-600 dark:hover:bg-gray-700 dark:text-white transition-all"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              className="gap-2 shadow-sm hover:shadow-md transition-all text-white dark:shadow-lg"
              style={{ backgroundColor: sectorColor }}
            >
              <Check className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
