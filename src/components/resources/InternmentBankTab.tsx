import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Database, Plus, Search, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useHospital } from "@/contexts/HospitalContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

const InternmentBankTab = () => {
  const { currentDepartment } = useDepartment();
  const { currentState, currentHospital } = useHospital();
  const [requests, setRequests] = useState<InternmentRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<InternmentRequest[]>([]);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<InternmentRequest | null>(null);
  const [searchName, setSearchName] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    patientName: "",
    patientAge: "",
    patientSex: "",
    patientRecord: "",
    destination: "",
    content: "",
  });

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [searchName, searchDate, requests]);

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

  const filterRequests = () => {
    let filtered = [...requests];

    if (searchName) {
      filtered = filtered.filter(req =>
        req.patient_name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    if (searchDate) {
      filtered = filtered.filter(req => {
        const reqDate = new Date(req.created_at).toISOString().split('T')[0];
        return reqDate === searchDate;
      });
    }

    setFilteredRequests(filtered);
  };

  const handleOpenSaveDialog = () => {
    setFormData({
      patientName: "",
      patientAge: "",
      patientSex: "",
      patientRecord: "",
      destination: "",
      content: "",
    });
    setIsSaveDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.patientName.trim()) {
      toast({
        title: "ERRO",
        description: "NOME DO PACIENTE É OBRIGATÓRIO",
        variant: "destructive",
      });
      return;
    }

    if (!formData.destination.trim()) {
      toast({
        title: "ERRO",
        description: "DESTINO DA SOLICITAÇÃO É OBRIGATÓRIO",
        variant: "destructive",
      });
      return;
    }

    if (!formData.content.trim()) {
      toast({
        title: "ERRO",
        description: "CONTEÚDO DA SOLICITAÇÃO É OBRIGATÓRIO",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "ERRO",
        description: "USUÁRIO NÃO AUTENTICADO",
        variant: "destructive",
      });
      return;
    }

    if (!currentHospital || !currentState) {
      toast({
        title: "ERRO",
        description: "UNIDADE HOSPITALAR NÃO SELECIONADA",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("internment_requests")
      .insert({
        patient_name: formData.patientName.toUpperCase(),
        patient_age: formData.patientAge ? parseInt(formData.patientAge) : null,
        patient_sex: formData.patientSex || null,
        patient_record: formData.patientRecord.toUpperCase() || null,
        destination: formData.destination.toUpperCase(),
        content: formData.content.toUpperCase(),
        created_by: user.id,
        department: currentDepartment,
        state_id: currentState.id,
        hospital_unit_id: currentHospital.id,
      });

    if (error) {
      if (import.meta.env.DEV) {
        console.error("Erro ao salvar:", error);
      }
      toast({
        title: "ERRO",
        description: "NÃO FOI POSSÍVEL SALVAR A SOLICITAÇÃO",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "SALVO",
      description: "SOLICITAÇÃO SALVA COM SUCESSO NO BANCO",
    });

    setIsSaveDialogOpen(false);
    loadRequests();
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
    <div className="space-y-4">
      {/* Header with Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Database className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground uppercase">
              BANCO DE SOLICITAÇÕES DE INTERNAÇÃO
            </h2>
            <p className="text-sm text-muted-foreground uppercase">
              {filteredRequests.length} REGISTROS
            </p>
          </div>
        </div>

        <Button
          onClick={handleOpenSaveDialog}
          className="gap-2 uppercase"
        >
          <Plus className="h-4 w-4" />
          NOVA SOLICITAÇÃO
        </Button>
      </div>

      {/* Print Title - Only visible when printing */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold uppercase text-center">BANCO DE SOLICITAÇÕES DE INTERNAÇÃO</h1>
        <p className="text-sm text-center mt-2">
          Total de Registros: {filteredRequests.length} | Data: {new Date().toLocaleDateString('pt-BR')}
        </p>
        <hr className="my-4 border-t-2 border-gray-300" />
      </div>

      {/* Filters */}
      <Card className="p-4 print:hidden">
        <div className="flex items-center gap-3 mb-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold uppercase">FILTROS DE BUSCA</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search-name" className="uppercase text-xs">
              BUSCAR POR NOME DO PACIENTE
            </Label>
            <Input
              id="search-name"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value.toUpperCase())}
              placeholder="DIGITE O NOME..."
              className="uppercase"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="search-date" className="uppercase text-xs">
              BUSCAR POR DATA
            </Label>
            <Input
              id="search-date"
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="print:border-0 print:shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="uppercase">NOME DO PACIENTE</TableHead>
              <TableHead className="uppercase">IDADE</TableHead>
              <TableHead className="uppercase">DESTINO</TableHead>
              <TableHead className="uppercase">DATA</TableHead>
              <TableHead className="uppercase text-right print:hidden">AÇÕES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground uppercase py-8">
                  NENHUMA SOLICITAÇÃO ENCONTRADA
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => (
                <TableRow key={request.id}>
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
                  <TableCell className="text-right print:hidden">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(request)}
                        className="gap-2 uppercase"
                      >
                        <Eye className="h-3 w-3" />
                        VER
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(request.id)}
                        className="gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 uppercase"
                      >
                        <Trash2 className="h-3 w-3" />
                        EXCLUIR
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Save Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase">NOVA SOLICITAÇÃO DE INTERNAÇÃO</DialogTitle>
            <DialogDescription className="uppercase">
              PREENCHA OS DADOS DO PACIENTE E DA SOLICITAÇÃO
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="patient-name" className="uppercase">
                NOME COMPLETO DO PACIENTE *
              </Label>
              <Input
                id="patient-name"
                value={formData.patientName}
                onChange={(e) => setFormData({ ...formData, patientName: e.target.value.toUpperCase() })}
                placeholder="NOME COMPLETO"
                className="uppercase"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="patient-age" className="uppercase">
                  IDADE
                </Label>
                <Input
                  id="patient-age"
                  type="number"
                  value={formData.patientAge}
                  onChange={(e) => setFormData({ ...formData, patientAge: e.target.value })}
                  placeholder="IDADE"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="patient-sex" className="uppercase">
                  SEXO
                </Label>
                <Select
                  value={formData.patientSex}
                  onValueChange={(value) => setFormData({ ...formData, patientSex: value })}
                >
                  <SelectTrigger className="uppercase">
                    <SelectValue placeholder="SELECIONE" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M" className="uppercase">MASCULINO</SelectItem>
                    <SelectItem value="F" className="uppercase">FEMININO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="patient-record" className="uppercase">
                  PRONTUÁRIO
                </Label>
                <Input
                  id="patient-record"
                  value={formData.patientRecord}
                  onChange={(e) => setFormData({ ...formData, patientRecord: e.target.value.toUpperCase() })}
                  placeholder="Nº PRONTUÁRIO"
                  className="uppercase"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="destination" className="uppercase">
                DESTINO DA SOLICITAÇÃO *
              </Label>
              <Select
                value={formData.destination}
                onValueChange={(value) => setFormData({ ...formData, destination: value })}
              >
                <SelectTrigger className="uppercase">
                  <SelectValue placeholder="SELECIONE O DESTINO" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTI" className="uppercase">UTI - Unidade de Terapia Intensiva</SelectItem>
                  <SelectItem value="ENFERMARIA" className="uppercase">Enfermaria</SelectItem>
                  <SelectItem value="POSTO INTERNAÇÃO" className="uppercase">Posto Internação</SelectItem>
                  <SelectItem value="CIRURGIA" className="uppercase">Centro Cirúrgico</SelectItem>
                  <SelectItem value="HEMODINÂMICA" className="uppercase">Hemodinâmica</SelectItem>
                  <SelectItem value="PSIQUIATRIA (INSTITUTO VOLTA VIDA)" className="uppercase">
                    Psiquiatria (Instituto Volta Vida)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="content" className="uppercase">
                CONTEÚDO DA SOLICITAÇÃO *
              </Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value.toUpperCase() })}
                placeholder="DIGITE O CONTEÚDO DA SOLICITAÇÃO..."
                className="min-h-[300px] font-mono text-sm uppercase"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSaveDialogOpen(false)}
              className="uppercase"
            >
              CANCELAR
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="uppercase"
            >
              SALVAR NO BANCO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase">DETALHES DA SOLICITAÇÃO</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <Card className="p-4 bg-muted/30">
                <h3 className="font-semibold uppercase mb-3 text-sm">DADOS DO PACIENTE</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground uppercase">NOME:</span>
                    <p className="font-medium uppercase">{selectedRequest.patient_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground uppercase">IDADE:</span>
                    <p className="font-medium uppercase">{selectedRequest.patient_age || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground uppercase">SEXO:</span>
                    <p className="font-medium uppercase">{selectedRequest.patient_sex || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground uppercase">PRONTUÁRIO:</span>
                    <p className="font-medium uppercase">{selectedRequest.patient_record || "-"}</p>
                  </div>
                </div>
              </Card>

              <div>
                <Label className="uppercase text-sm">DESTINO</Label>
                <p className="mt-1 font-medium uppercase">{selectedRequest.destination}</p>
              </div>

              <div>
                <Label className="uppercase text-sm">CONTEÚDO</Label>
                <Card className="mt-2 p-4">
                  <pre className="whitespace-pre-wrap font-mono text-xs uppercase">
                    {selectedRequest.content}
                  </pre>
                </Card>
              </div>

              <div className="text-xs text-muted-foreground uppercase">
                CRIADO EM: {formatDate(selectedRequest.created_at)}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setIsViewDialogOpen(false)}
              className="uppercase"
            >
              FECHAR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InternmentBankTab;
