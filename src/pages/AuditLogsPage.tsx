import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Shield, 
  Search, 
  Eye, 
  FileText, 
  User, 
  Clock,
  Database,
  Edit,
  Trash2,
  Plus,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT' | 'LOGIN' | 'LOGOUT';
  table_name: string;
  record_id: string | null;
  old_data: any;
  new_data: any;
  changed_fields: string[] | null;
  hospital_unit_id: string | null;
  state_id: string | null;
  department: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  INSERT: { label: "Criação", color: "bg-released-soft text-released-on-soft border-released-border", icon: <Plus className="h-3 w-3" /> },
  UPDATE: { label: "Alteração", color: "bg-muted text-foreground border-border", icon: <Edit className="h-3 w-3" /> },
  DELETE: { label: "Exclusão", color: "bg-critical-soft text-critical-on-soft border-critical-border", icon: <Trash2 className="h-3 w-3" /> },
  SELECT: { label: "Consulta", color: "bg-muted text-foreground border-border", icon: <Eye className="h-3 w-3" /> },
  LOGIN: { label: "Login", color: "bg-muted text-foreground border-border", icon: <User className="h-3 w-3" /> },
  LOGOUT: { label: "Logout", color: "bg-warning-soft text-warning-on-soft border-warning-border", icon: <User className="h-3 w-3" /> },
};

const TABLE_LABELS: Record<string, string> = {
  patients: "Pacientes",
  patient_movements: "Movimentações",
  patient_versions: "Versões",
  shift_handovers: "Passagens de Plantão",
  sepsis_protocols: "Protocolos de Sepse",
  dhd_patients: "Pacientes DHD",
  internment_requests: "Solicitações de Internação",
  bed_allocation_requests: "Solicitações de Leito",
};

export default function AuditLogsPage() {
  const { currentHospital } = useHospital();
  const { currentDepartment } = useDepartment();
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', currentHospital?.id, currentDepartment],
    queryFn: async () => {
      if (!currentHospital?.id) return [];

      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('hospital_unit_id', currentHospital.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Error fetching audit logs:', error);
        return [];
      }

      return data as AuditLog[];
    },
    enabled: !!currentHospital?.id,
  });

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (log.table_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (log.record_id?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesTable = tableFilter === "all" || log.table_name === tableFilter;

    return matchesSearch && matchesAction && matchesTable;
  });

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
  };

  const renderChangedFields = (log: AuditLog) => {
    if (!log.changed_fields || log.changed_fields.length === 0) return null;
    
    return (
      <div className="mt-2">
        <p className="text-xs font-medium text-muted-foreground mb-1">Campos alterados:</p>
        <div className="flex flex-wrap gap-1">
          {log.changed_fields.map((field, idx) => (
            <Badge key={idx} variant="outline" className="text-[10px]">
              {field}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  const renderDataDiff = (oldData: any, newData: any, changedFields: string[] | null) => {
    if (!changedFields || changedFields.length === 0) return null;

    return (
      <div className="space-y-2 mt-4">
        <p className="text-sm font-semibold text-foreground">Detalhes das Alterações:</p>
        {changedFields.map((field) => (
          <div key={field} className="bg-muted rounded-lg p-3 border">
            <p className="text-xs font-medium text-foreground mb-2">{field}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-critical-soft rounded p-2 border border-critical-border">
                <p className="text-[10px] text-critical-on-soft font-medium mb-1">ANTES</p>
                <p className="text-xs text-foreground break-all">
                  {oldData?.[field] !== undefined ? String(oldData[field]) : "(vazio)"}
                </p>
              </div>
              <div className="bg-released-soft rounded p-2 border border-released-border">
                <p className="text-[10px] text-released-on-soft font-medium mb-1">DEPOIS</p>
                <p className="text-xs text-foreground break-all">
                  {newData?.[field] !== undefined ? String(newData[field]) : "(vazio)"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#013ba6] to-[#0152d4] flex items-center justify-center shadow-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">Trilha de Auditoria</h1>
              <p className="text-sm text-muted-foreground">Conformidade LGPD e CFM 1.821/2007</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-released-soft text-released-on-soft border-released-border">
              <Shield className="h-3 w-3 mr-1" />
              Dados Protegidos
            </Badge>
            <Badge variant="outline" className="bg-muted text-foreground border-border">
              <FileText className="h-3 w-3 mr-1" />
              Retenção: 20 anos
            </Badge>
          </div>
        </div>

        {/* Alert */}
        <Card className="border-warning-border bg-warning-soft">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning-on-soft flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning-on-soft">
                  Registro Imutável de Auditoria
                </p>
                <p className="text-xs text-warning-on-soft mt-1">
                  Todos os acessos e modificações em dados de pacientes são registrados automaticamente 
                  e não podem ser alterados ou excluídos, conforme exigência da Resolução CFM 1.821/2007.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Search className="h-4 w-4" />
              Filtros de Busca
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por usuário, tabela ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="INSERT">Criação</SelectItem>
                  <SelectItem value="UPDATE">Alteração</SelectItem>
                  <SelectItem value="DELETE">Exclusão</SelectItem>
                </SelectContent>
              </Select>

              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tabela" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as tabelas</SelectItem>
                  {Object.entries(TABLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <Database className="h-4 w-4" />
                Registros de Auditoria
              </CardTitle>
              <Badge variant="secondary">
                {filteredLogs.length} registros
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="h-6 w-6 border-2 border-[#013ba6] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Nenhum registro encontrado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Data/Hora</TableHead>
                      <TableHead className="w-[120px]">Ação</TableHead>
                      <TableHead className="w-[150px]">Tabela</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead className="w-[100px]">Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const actionInfo = ACTION_LABELS[log.action] || ACTION_LABELS.SELECT;
                      return (
                        <TableRow key={log.id} className="hover:bg-muted">
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {formatDate(log.created_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${actionInfo.color} border text-[10px] gap-1`}>
                              {actionInfo.icon}
                              {actionInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {TABLE_LABELS[log.table_name] || log.table_name}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1.5">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate max-w-[150px]">
                                {log.user_email || "Sistema"}
                              </span>
                              {log.user_role && (
                                <Badge variant="outline" className="text-[9px] ml-1">
                                  {log.user_role}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => setSelectedLog(log)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <Shield className="h-5 w-5 text-[#013ba6]" />
                                    Detalhes do Registro de Auditoria
                                  </DialogTitle>
                                </DialogHeader>
                                
                                {selectedLog && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="bg-muted rounded-lg p-3">
                                        <p className="text-[10px] text-muted-foreground font-medium">Data/Hora</p>
                                        <p className="text-sm font-medium">{formatDate(selectedLog.created_at)}</p>
                                      </div>
                                      <div className="bg-muted rounded-lg p-3">
                                        <p className="text-[10px] text-muted-foreground font-medium">Ação</p>
                                        <Badge className={`${ACTION_LABELS[selectedLog.action]?.color} mt-1`}>
                                          {ACTION_LABELS[selectedLog.action]?.label}
                                        </Badge>
                                      </div>
                                      <div className="bg-muted rounded-lg p-3">
                                        <p className="text-[10px] text-muted-foreground font-medium">Tabela</p>
                                        <p className="text-sm font-medium">
                                          {TABLE_LABELS[selectedLog.table_name] || selectedLog.table_name}
                                        </p>
                                      </div>
                                      <div className="bg-muted rounded-lg p-3">
                                        <p className="text-[10px] text-muted-foreground font-medium">ID do Registro</p>
                                        <p className="text-xs font-mono">{selectedLog.record_id || "-"}</p>
                                      </div>
                                      <div className="bg-muted rounded-lg p-3 col-span-2">
                                        <p className="text-[10px] text-muted-foreground font-medium">Usuário</p>
                                        <p className="text-sm font-medium">{selectedLog.user_email || "Sistema"}</p>
                                        {selectedLog.user_role && (
                                          <Badge variant="outline" className="text-[10px] mt-1">
                                            Role: {selectedLog.user_role}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>

                                    {renderChangedFields(selectedLog)}
                                    
                                    {selectedLog.action === 'UPDATE' && 
                                      renderDataDiff(
                                        selectedLog.old_data, 
                                        selectedLog.new_data, 
                                        selectedLog.changed_fields
                                      )
                                    }

                                    {selectedLog.action === 'INSERT' && selectedLog.new_data && (
                                      <div className="mt-4">
                                        <p className="text-sm font-semibold text-foreground mb-2">Dados Criados:</p>
                                        <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto max-h-48 border">
                                          {JSON.stringify(selectedLog.new_data, null, 2)}
                                        </pre>
                                      </div>
                                    )}

                                    {selectedLog.action === 'DELETE' && selectedLog.old_data && (
                                      <div className="mt-4">
                                        <p className="text-sm font-semibold text-foreground mb-2">Dados Excluídos:</p>
                                        <pre className="bg-critical-soft rounded-lg p-3 text-xs overflow-auto max-h-48 border border-critical-border">
                                          {JSON.stringify(selectedLog.old_data, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
