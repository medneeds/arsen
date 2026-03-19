import { useState, useEffect } from "react";
import { Search, Trash2, Eye, History, Filter, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";

interface InternmentRequest {
  id: string;
  destination: string;
  content: string;
  patient_name: string;
  patient_age: number | null;
  patient_sex: string | null;
  patient_record: string | null;
  created_at: string;
  updated_at: string;
}

const InternmentHistoryPage = () => {
  const { user } = useAuth();
  const { currentDepartment } = useDepartment();
  const { toast } = useToast();
  const [requests, setRequests] = useState<InternmentRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<InternmentRequest[]>([]);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<InternmentRequest | null>(null);
  const [searchName, setSearchName] = useState("");
  
  // Temporary filter states (before applying)
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(undefined);
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(undefined);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  
  // Applied filter states
  const [appliedStartDate, setAppliedStartDate] = useState<Date | undefined>(undefined);
  const [appliedEndDate, setAppliedEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    loadRequests();
  }, [currentDepartment]);

  useEffect(() => {
    filterRequests();
  }, [searchName, appliedStartDate, appliedEndDate, requests]);

  const loadRequests = async () => {
    const { data, error } = await supabase
      .from("internment_requests")
      .select("*")
      .eq("department", currentDepartment)
      .order("created_at", { ascending: false });

    if (error) {
      if (import.meta.env.DEV) {
        console.error("Erro ao carregar solicitações:", error);
      }
      toast({
        title: "ERRO",
        description: "NÃO FOI POSSÍVEL CARREGAR AS SOLICITAÇÕES",
        variant: "destructive",
      });
      return;
    }

    setRequests(data || []);
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
    setSearchName("");
    toast({
      title: "FILTROS LIMPOS",
      description: "EXIBINDO TODAS AS SOLICITAÇÕES.",
    });
  };

  const filterRequests = () => {
    let filtered = [...requests];

    if (searchName) {
      filtered = filtered.filter(req =>
        req.patient_name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    // Date filter using APPLIED dates
    if (appliedStartDate || appliedEndDate) {
      filtered = filtered.filter(req => {
        const reqDate = new Date(req.created_at);
        if (appliedStartDate && appliedEndDate) {
          return reqDate >= startOfDay(appliedStartDate) && reqDate <= endOfDay(appliedEndDate);
        } else if (appliedStartDate) {
          return reqDate >= startOfDay(appliedStartDate);
        } else if (appliedEndDate) {
          return reqDate <= endOfDay(appliedEndDate);
        }
        return true;
      });
    }

    setFilteredRequests(filtered);
  };

  const handleView = (request: InternmentRequest) => {
    setSelectedRequest(request);
    setIsViewDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("internment_requests")
      .delete()
      .eq("id", id);

    if (error) {
      if (import.meta.env.DEV) {
        console.error("Erro ao excluir:", error);
      }
      toast({
        title: "ERRO",
        description: "NÃO FOI POSSÍVEL EXCLUIR A SOLICITAÇÃO",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "EXCLUÍDO",
      description: "SOLICITAÇÃO REMOVIDA DO BANCO",
    });

    loadRequests();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/10 flex items-center justify-center">
            <History className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Histórico de Solicitações
            </h1>
            <p className="text-muted-foreground text-sm">
              {currentDepartment} • {filteredRequests.length} registros encontrados
            </p>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Filters Card */}
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Filtros de Busca</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Busque solicitações por nome do paciente ou período
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Search by Name */}
          <div className="space-y-3">
            <Label htmlFor="search-name" className="text-sm font-semibold flex items-center gap-2">
              <Search className="h-4 w-4" />
              Buscar por nome do paciente
            </Label>
            <Input
              id="search-name"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Digite o nome..."
              className="h-12"
            />
          </div>

          <Separator />

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

          {/* Date Pickers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
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

      {/* Results Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="uppercase text-lg">Solicitações Encontradas</CardTitle>
          <CardDescription className="uppercase text-xs">
            {filteredRequests.length} {filteredRequests.length === 1 ? 'registro' : 'registros'} no histórico
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="uppercase font-bold">Nome do Paciente</TableHead>
                  <TableHead className="uppercase font-bold">Idade</TableHead>
                  <TableHead className="uppercase font-bold">Destino</TableHead>
                  <TableHead className="uppercase font-bold">Data</TableHead>
                  <TableHead className="uppercase text-right font-bold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground uppercase py-12">
                      <div className="flex flex-col items-center gap-2">
                        <History className="h-12 w-12 text-muted-foreground/50" />
                        <p className="font-semibold">Nenhuma Solicitação Encontrada</p>
                        <p className="text-xs">Tente ajustar os filtros de busca</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((request) => (
                    <TableRow key={request.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium uppercase">
                        {request.patient_name}
                      </TableCell>
                      <TableCell className="uppercase">
                        {request.patient_age || "-"}
                      </TableCell>
                      <TableCell className="uppercase max-w-xs truncate">
                        {request.destination}
                      </TableCell>
                      <TableCell className="uppercase text-xs">
                        {formatDate(request.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleView(request)}
                            className="gap-2 uppercase hover:bg-primary/10 hover:text-primary"
                          >
                            <Eye className="h-3 w-3" />
                            Ver
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(request.id)}
                            className="gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 uppercase"
                          >
                            <Trash2 className="h-3 w-3" />
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Detalhes da Solicitação
            </DialogTitle>
          </DialogHeader>
          <Separator className="my-4" />
          {selectedRequest && (
            <div className="space-y-4">
              <Card className="bg-muted/30 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase">Dados do Paciente</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground uppercase text-xs">Nome:</span>
                      <p className="font-medium uppercase">{selectedRequest.patient_name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground uppercase text-xs">Idade:</span>
                      <p className="font-medium uppercase">{selectedRequest.patient_age || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground uppercase text-xs">Sexo:</span>
                      <p className="font-medium uppercase">{selectedRequest.patient_sex || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground uppercase text-xs">Prontuário:</span>
                      <p className="font-medium uppercase">{selectedRequest.patient_record || "-"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase">Destino</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm uppercase font-medium">{selectedRequest.destination}</p>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase">Conteúdo da Solicitação</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/20 p-4 rounded-md border">
                    <pre className="whitespace-pre-wrap font-mono text-xs uppercase">
                      {selectedRequest.content}
                    </pre>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/30 border-primary/20">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground uppercase">Data de Criação:</span>
                      <p className="font-medium uppercase">{formatDate(selectedRequest.created_at)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground uppercase">Última Atualização:</span>
                      <p className="font-medium uppercase">{formatDate(selectedRequest.updated_at)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ScrollToTopButton />
    </div>
  );
};

export default InternmentHistoryPage;
