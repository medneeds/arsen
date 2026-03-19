import { useEffect, useState } from "react";
import { usePatientVersions } from "@/hooks/usePatientVersions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, RotateCcw, Trash2, Eye, History, Filter, CalendarIcon, Search } from "lucide-react";
import { format, subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePatients } from "@/hooks/usePatients";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useDepartment } from "@/contexts/DepartmentContext";
import { formatAgeDisplay } from "@/utils/ageDisplay";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function VersionsPage() {
  const { versions, isLoading, fetchVersions, deleteVersion } = usePatientVersions();
  const { currentDepartment } = useDepartment();
  const { patients, deletePatient, createPatient } = usePatients(currentDepartment);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<typeof versions[0] | null>(null);
  const [filteredVersions, setFilteredVersions] = useState(versions);
  const [searchDescription, setSearchDescription] = useState("");
  
  // Temporary filter states (before applying)
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(undefined);
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(undefined);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  
  // Applied filter states
  const [appliedStartDate, setAppliedStartDate] = useState<Date | undefined>(undefined);
  const [appliedEndDate, setAppliedEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    fetchVersions(currentDepartment);
  }, [currentDepartment]);

  useEffect(() => {
    applyFilters();
  }, [searchDescription, appliedStartDate, appliedEndDate, versions]);

  const handleRestore = (versionId: string) => {
    setSelectedVersion(versionId);
    setRestoreDialogOpen(true);
  };

  const handlePreview = (version: typeof versions[0]) => {
    setPreviewVersion(version);
    setPreviewDialogOpen(true);
  };

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    const now = new Date();
    
    switch (period) {
      case "today":
        setTempStartDate(now);
        setTempEndDate(now);
        break;
      case "week":
        setTempStartDate(subDays(now, 7));
        setTempEndDate(now);
        break;
      case "month":
        setTempStartDate(subMonths(now, 1));
        setTempEndDate(now);
        break;
      case "quarter":
        setTempStartDate(subMonths(now, 3));
        setTempEndDate(now);
        break;
      case "all":
        setTempStartDate(undefined);
        setTempEndDate(undefined);
        break;
    }
  };

  const handleApplyFilters = () => {
    setAppliedStartDate(tempStartDate);
    setAppliedEndDate(tempEndDate);
    toast({
      title: "FILTROS APLICADOS",
      description: "A VISUALIZAÇÃO FOI ATUALIZADA COM OS FILTROS SELECIONADOS.",
    });
  };

  const handleClearFilters = () => {
    setTempStartDate(undefined);
    setTempEndDate(undefined);
    setAppliedStartDate(undefined);
    setAppliedEndDate(undefined);
    setSelectedPeriod("all");
    setSearchDescription("");
    toast({
      title: "FILTROS LIMPOS",
      description: "EXIBINDO TODAS AS VERSÕES.",
    });
  };

  const applyFilters = () => {
    let filtered = [...versions];

    // Search filter
    if (searchDescription) {
      filtered = filtered.filter(version =>
        version.description.toLowerCase().includes(searchDescription.toLowerCase())
      );
    }

    // Date filter using APPLIED dates
    if (appliedStartDate || appliedEndDate) {
      filtered = filtered.filter(version => {
        const versionDate = new Date(version.created_at);
        if (appliedStartDate && appliedEndDate) {
          return versionDate >= startOfDay(appliedStartDate) && versionDate <= endOfDay(appliedEndDate);
        } else if (appliedStartDate) {
          return versionDate >= startOfDay(appliedStartDate);
        } else if (appliedEndDate) {
          return versionDate <= endOfDay(appliedEndDate);
        }
        return true;
      });
    }

    setFilteredVersions(filtered);
  };

  const confirmRestore = async () => {
    if (!selectedVersion) return;

    const version = versions.find(v => v.id === selectedVersion);
    if (!version) return;

    try {
      await Promise.all(
        patients.map(p => deletePatient(p.id, { showToast: false, updateLocalState: false }))
      );

      await Promise.all(
        version.snapshot_data.map(p => createPatient({
          bedNumber: p.bedNumber,
          name: p.name,
          age: p.age,
          sector: p.sector,
          diagnoses: p.diagnoses,
          medicalHistory: p.medicalHistory,
          relevantExams: p.relevantExams,
          pendencies: p.pendencies,
          schedule: p.schedule,
          admissionHistory: p.admissionHistory,
          admissionDate: p.admissionDate,
        }))
      );

      toast({
        title: "Versão restaurada",
        description: `Mapa restaurado para ${version.description}`,
      });

      navigate("/");
    } catch (error) {
      console.error('Error restoring version:', error);
      toast({
        title: "Erro ao restaurar",
        description: "Não foi possível restaurar a versão.",
        variant: "destructive",
      });
    }

    setRestoreDialogOpen(false);
    setSelectedVersion(null);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-muted-foreground">Carregando versões...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center">
            <History className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Versões Salvas
            </h1>
            <p className="text-muted-foreground text-sm">
              {currentDepartment} • Histórico de versões do mapa de pacientes
            </p>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por descrição..."
          value={searchDescription}
          onChange={(e) => setSearchDescription(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Date Filters */}
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Filtros de Busca</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Busque versões por descrição ou período
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Quick Period Buttons */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Período Rápido</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedPeriod === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePeriodChange("all")}
                className="text-xs"
              >
                Todos
              </Button>
              <Button
                variant={selectedPeriod === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePeriodChange("today")}
                className="text-xs"
              >
                Hoje
              </Button>
              <Button
                variant={selectedPeriod === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePeriodChange("week")}
                className="text-xs"
              >
                Última Semana
              </Button>
              <Button
                variant={selectedPeriod === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePeriodChange("month")}
                className="text-xs"
              >
                Último Mês
              </Button>
              <Button
                variant={selectedPeriod === "quarter" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePeriodChange("quarter")}
                className="text-xs"
              >
                Último Trimestre
              </Button>
            </div>
          </div>

          <Separator />

          {/* Date Pickers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium uppercase">Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal uppercase",
                      !tempStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {tempStartDate ? format(tempStartDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={tempStartDate}
                    onSelect={(date) => {
                      setTempStartDate(date);
                      setSelectedPeriod("custom");
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium uppercase">Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal uppercase",
                      !tempEndDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {tempEndDate ? format(tempEndDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={tempEndDate}
                    onSelect={(date) => {
                      setTempEndDate(date);
                      setSelectedPeriod("custom");
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleApplyFilters}
              className="flex-1 uppercase font-semibold"
              size="lg"
            >
              <Filter className="mr-2 h-4 w-4" />
              Aplicar Filtro
            </Button>
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="flex-1 uppercase"
              size="lg"
            >
              Limpar Filtro
            </Button>
          </div>
        </CardContent>
      </Card>

      {filteredVersions.length === 0 ? (
        <Card className="shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Clock className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground font-semibold uppercase text-lg">
              {searchDescription || appliedStartDate || appliedEndDate 
                ? "Nenhuma Versão Encontrada" 
                : "Nenhuma Versão Salva Ainda"}
            </p>
            <p className="text-muted-foreground text-sm uppercase mt-2">
              {searchDescription || appliedStartDate || appliedEndDate 
                ? "Tente ajustar os filtros de busca" 
                : "Salve uma versão do mapa para criar um histórico"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredVersions.map((version) => (
            <Card key={version.id} className="shadow-lg hover:shadow-xl transition-all duration-300 border-primary/20">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="uppercase text-lg">
                        {version.description}
                      </CardTitle>
                      <CardDescription className="uppercase text-xs">
                        {version.snapshot_data.length} {version.snapshot_data.length === 1 ? 'paciente salvo' : 'pacientes salvos'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePreview(version)}
                      className="gap-2 uppercase hover:bg-primary/10 hover:text-primary"
                    >
                      <Eye className="h-4 w-4" />
                      Prévia
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(version.id)}
                      className="gap-2 uppercase hover:bg-green-500/10 hover:text-green-600"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Restaurar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteVersion(version.id)}
                      className="hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase">Confirmar Restauração</AlertDialogTitle>
            <AlertDialogDescription className="uppercase">
              Isso irá substituir todos os pacientes atuais pelos pacientes da versão selecionada. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="uppercase">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore} className="uppercase">
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Prévia da Versão
            </DialogTitle>
            <DialogDescription className="uppercase">
              {previewVersion?.description} • {previewVersion?.snapshot_data.length} pacientes
            </DialogDescription>
          </DialogHeader>
          <Separator className="my-4" />
          <div className="space-y-4 mt-4">
            {previewVersion?.snapshot_data.map((patient, index) => (
              <Card key={index} className="border-primary/20">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2 uppercase">
                        Leito {patient.bedNumber} - {patient.name}
                        {patient.age && <span className="text-sm text-muted-foreground">({formatAgeDisplay(patient.age)})</span>}
                      </CardTitle>
                      <Badge variant="outline" className="uppercase">{patient.sector}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {patient.diagnoses && (
                    <div>
                      <p className="font-semibold text-muted-foreground mb-1 uppercase">Hipóteses Diagnósticas:</p>
                      <p className="uppercase">{patient.diagnoses}</p>
                    </div>
                  )}
                  {patient.medicalHistory && (
                    <div>
                      <p className="font-semibold text-muted-foreground mb-1 uppercase">Antecedentes:</p>
                      <p className="uppercase">{patient.medicalHistory}</p>
                    </div>
                  )}
                  {patient.relevantExams && (
                    <div>
                      <p className="font-semibold text-muted-foreground mb-1 uppercase">Exames Relevantes:</p>
                      <p className="uppercase">{patient.relevantExams}</p>
                    </div>
                  )}
                  {patient.pendencies && (
                    <div>
                      <p className="font-semibold text-muted-foreground mb-1 uppercase">Pendências:</p>
                      <p className="uppercase">{patient.pendencies}</p>
                    </div>
                  )}
                  {patient.schedule && (
                    <div>
                      <p className="font-semibold text-muted-foreground mb-1 uppercase">Programação:</p>
                      <p className="uppercase">{patient.schedule}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
