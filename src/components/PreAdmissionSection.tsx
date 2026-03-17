import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { PatientRegistrationDialog } from "./PatientRegistrationDialog";
import { RiskClassificationDialog } from "./RiskClassificationDialog";
import { 
  UserPlus, Shield, Trash2, Edit, ChevronDown, ChevronUp, 
  Clock, AlertTriangle, User, Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PreAdmission {
  id: string;
  patient_name: string;
  birth_date: string | null;
  sex: string | null;
  medical_record: string | null;
  destination_sector: string | null;
  status: string;
  risk_classification: string | null;
  created_at: string;
  notes: string | null;
}

const RISK_COLORS: Record<string, string> = {
  vermelho: "bg-red-600 text-white",
  laranja: "bg-orange-500 text-white",
  amarelo: "bg-yellow-500 text-black",
  verde: "bg-green-600 text-white",
  azul: "bg-blue-600 text-white",
};

const RISK_LABELS: Record<string, string> = {
  vermelho: "EMERGÊNCIA",
  laranja: "MUITO URGENTE",
  amarelo: "URGENTE",
  verde: "POUCO URGENTE",
  azul: "NÃO URGENTE",
};

export function PreAdmissionSection() {
  const [preAdmissions, setPreAdmissions] = useState<PreAdmission[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [showRegistration, setShowRegistration] = useState(false);
  const [classifyTarget, setClassifyTarget] = useState<PreAdmission | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PreAdmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();

  const fetchPreAdmissions = async () => {
    if (!currentHospital?.id || !currentState?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("pre_admissions")
        .select("*")
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .in("status", ["pre_admissao", "classificado"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPreAdmissions((data as PreAdmission[]) || []);
    } catch (err) {
      console.error("Fetch pre-admissions error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPreAdmissions();
  }, [selectedHospitalId, selectedStateId]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from("pre_admissions")
        .update({ status: "cancelado" })
        .eq("id", deleteTarget.id);
      if (error) throw error;
      toast({ title: "Pré-admissão cancelada" });
      fetchPreAdmissions();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const calcAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    return Math.floor((Date.now() - new Date(birthDate + 'T12:00:00').getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  const pendingCount = preAdmissions.filter(p => p.status === "pre_admissao").length;
  const classifiedCount = preAdmissions.filter(p => p.status === "classificado").length;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between mb-2">
          <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Aguardando Admissão em Leito
              <Badge variant="secondary" className="text-xs">
                {preAdmissions.length}
              </Badge>
              {pendingCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {pendingCount} sem classificação
                </Badge>
              )}
            </h2>
          </CollapsibleTrigger>
          <Button size="sm" onClick={() => setShowRegistration(true)} className="gap-1 text-xs h-7">
            <UserPlus className="h-3.5 w-3.5" />
            Cadastrar Paciente
          </Button>
        </div>

        <CollapsibleContent>
          {preAdmissions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-4 text-center text-sm text-muted-foreground">
                Nenhum paciente aguardando admissão.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {preAdmissions.map(pa => {
                const age = calcAge(pa.birth_date);
                return (
                  <Card key={pa.id} className={cn(
                    "transition-all hover:shadow-md",
                    pa.risk_classification && "border-l-4",
                    pa.risk_classification === "vermelho" && "border-l-red-600",
                    pa.risk_classification === "laranja" && "border-l-orange-500",
                    pa.risk_classification === "amarelo" && "border-l-yellow-500",
                    pa.risk_classification === "verde" && "border-l-green-600",
                    pa.risk_classification === "azul" && "border-l-blue-600",
                  )}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate">{pa.patient_name}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                            {age !== null && <span>{age}a</span>}
                            {pa.sex && <span>• {pa.sex}</span>}
                            {pa.medical_record && <span>• Pront: {pa.medical_record}</span>}
                          </div>
                        </div>
                        {pa.risk_classification && (
                          <Badge className={cn("text-[9px] shrink-0 px-1.5 py-0.5", RISK_COLORS[pa.risk_classification])}>
                            {RISK_LABELS[pa.risk_classification]}
                          </Badge>
                        )}
                      </div>

                      {pa.destination_sector && (
                        <p className="text-[10px] text-muted-foreground">
                          Destino: {pa.destination_sector}
                        </p>
                      )}

                      <div className="flex gap-1 pt-1 border-t">
                        {!pa.risk_classification && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-6 text-[10px] gap-1 text-orange-600 border-orange-300 hover:bg-orange-50"
                            onClick={() => setClassifyTarget(pa)}
                          >
                            <Shield className="h-3 w-3" />
                            Classificar Risco
                          </Button>
                        )}
                        {pa.risk_classification && (
                          <Button
                            size="sm"
                            className="flex-1 h-6 text-[10px] gap-1"
                            onClick={() => {
                              toast({ title: "Em breve", description: "Admissão em leito será implementada na próxima fase" });
                            }}
                          >
                            <User className="h-3 w-3" />
                            Admitir em Leito
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive"
                          onClick={() => setDeleteTarget(pa)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <PatientRegistrationDialog
        open={showRegistration}
        onOpenChange={setShowRegistration}
        onSuccess={fetchPreAdmissions}
      />

      <RiskClassificationDialog
        open={!!classifyTarget}
        onOpenChange={(open) => !open && setClassifyTarget(null)}
        preAdmission={classifyTarget}
        onSuccess={fetchPreAdmissions}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Pré-Admissão?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja cancelar a pré-admissão de <strong>{deleteTarget?.patient_name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Sim, Cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
