import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Search, Loader2, ChevronLeft, ChevronRight, Eye, Play, UserCheck, UserX,
  ArrowUpDown, FileText, Users, RefreshCw, Activity,
} from "lucide-react";
import { PatientRowActions } from "@/components/reception/PatientRowActions";

// Tipos
interface PatientRow {
  id: string;
  medical_record: string | null;
  full_name: string;
  social_name?: string | null;
  cpf?: string | null;
  cns?: string | null;
  birth_date?: string | null;
  sex?: string | null;
  city?: string | null;
  mother_name?: string | null;
  is_unidentified: boolean;
  unidentified_code?: string | null;
  created_at: string;
  updated_at: string;
}

type SortKey = "full_name_asc" | "full_name_desc" | "created_desc" | "created_asc" | "updated_desc";
type TypeFilter = "all" | "identified" | "unidentified";
type SexFilter = "all" | "M" | "F" | "I";

const PAGE_SIZE = 50;

interface MedicalRecordsListProps {
  /** Quando o usuário pede "Iniciar atendimento" da lista */
  onStartEncounter: (patient: PatientRow) => void;
  /** Quando o usuário pede para visualizar/editar */
  onViewPatient: (patient: PatientRow) => void;
}

/**
 * Lista paginada de prontuários com filtros, ordenação e ações rápidas.
 * Usado na aba "Prontuários" do dashboard da Recepção.
 */
export function MedicalRecordsList({ onStartEncounter, onViewPatient }: MedicalRecordsListProps) {
  const { currentHospital } = useHospital();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Filtros
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_desc");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sexFilter, setSexFilter] = useState<SexFilter>("all");
  const [cityFilter, setCityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");

  // Paginação
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Promote NI dialog
  const [promoteTarget, setPromoteTarget] = useState<PatientRow | null>(null);
  const [promoteForm, setPromoteForm] = useState({
    full_name: "", birth_date: "", sex: "", cpf: "", cns: "",
    mother_name: "", phone: "", address: "",
  });
  const [isPromoting, setIsPromoting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Reseta página ao mudar filtros
  useEffect(() => { setPage(1); }, [search, sortKey, typeFilter, sexFilter, cityFilter, dateFrom, dateTo, ageMin, ageMax]);

  // Carrega lista
  const fetchData = async () => {
    if (!currentHospital?.id) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from("patient_registry")
        .select("id, medical_record, full_name, social_name, cpf, cns, birth_date, sex, city, mother_name, is_unidentified, unidentified_code, created_at, updated_at", { count: "exact" })
        .is("merged_into_registry_id", null);

      // Busca: nome, CPF, CNS, prontuário, NI code
      if (search.trim()) {
        const q = search.trim();
        query = query.or(
          `full_name.ilike.%${q}%,cpf.ilike.%${q}%,cns.ilike.%${q}%,medical_record.ilike.%${q}%,unidentified_code.ilike.%${q}%`
        );
      }

      if (typeFilter === "identified") query = query.eq("is_unidentified", false);
      if (typeFilter === "unidentified") query = query.eq("is_unidentified", true);
      if (sexFilter !== "all") query = query.eq("sex", sexFilter);
      if (cityFilter.trim()) query = query.ilike("city", `%${cityFilter.trim()}%`);
      if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

      // Idade — converte para range de birth_date
      const today = new Date();
      if (ageMax) {
        // birth_date >= hoje - (ageMax+1) anos + 1 dia (aprox.) → simplificamos
        const minBirth = new Date(today.getFullYear() - parseInt(ageMax) - 1, today.getMonth(), today.getDate() + 1);
        query = query.gte("birth_date", minBirth.toISOString().slice(0, 10));
      }
      if (ageMin) {
        const maxBirth = new Date(today.getFullYear() - parseInt(ageMin), today.getMonth(), today.getDate());
        query = query.lte("birth_date", maxBirth.toISOString().slice(0, 10));
      }

      // Ordenação
      switch (sortKey) {
        case "full_name_asc": query = query.order("full_name", { ascending: true }); break;
        case "full_name_desc": query = query.order("full_name", { ascending: false }); break;
        case "created_asc": query = query.order("created_at", { ascending: true }); break;
        case "created_desc": query = query.order("created_at", { ascending: false }); break;
        case "updated_desc": query = query.order("updated_at", { ascending: false }); break;
      }

      // Paginação
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await query.range(from, to);

      if (error) throw error;
      setRows((data as PatientRow[]) || []);
      setTotal(count || 0);
    } catch (err: any) {
      console.error("Erro ao carregar prontuários:", err);
      toast.error("Erro ao carregar prontuários", { description: err?.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHospital?.id, page, sortKey, typeFilter, sexFilter, search, dateFrom, dateTo, cityFilter, ageMin, ageMax]);

  // KPIs simples (página atual)
  const stats = useMemo(() => {
    const ni = rows.filter(r => r.is_unidentified).length;
    return { totalPagina: rows.length, ni, identificados: rows.length - ni };
  }, [rows]);

  // Promoção NI
  const openPromote = (p: PatientRow) => {
    setPromoteTarget(p);
    setPromoteForm({
      full_name: "", birth_date: "", sex: "", cpf: "", cns: "",
      mother_name: "", phone: "", address: "",
    });
  };

  const handlePromote = async () => {
    if (!promoteTarget) return;
    if (!promoteForm.full_name.trim()) {
      toast.error("Nome completo é obrigatório");
      return;
    }
    setIsPromoting(true);
    try {
      const { error } = await supabase.rpc("promote_unidentified_patient", {
        p_ni_id: promoteTarget.id,
        p_full_name: promoteForm.full_name.trim().toUpperCase(),
        p_birth_date: promoteForm.birth_date || null,
        p_sex: promoteForm.sex || null,
        p_cpf: promoteForm.cpf?.trim() || null,
        p_cns: promoteForm.cns?.trim() || null,
        p_mother_name: promoteForm.mother_name?.trim().toUpperCase() || null,
        p_phone: promoteForm.phone?.trim() || null,
        p_address: promoteForm.address?.trim().toUpperCase() || null,
      });
      if (error) throw error;
      toast.success("Paciente identificado com sucesso", {
        description: `Prontuário ${promoteTarget.medical_record} atualizado`,
      });
      setPromoteTarget(null);
      fetchData();
    } catch (err: any) {
      console.error("Erro ao promover NI:", err);
      toast.error("Erro ao identificar paciente", { description: err?.message });
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header com KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total filtrado</p>
              <p className="text-lg font-bold">{total.toLocaleString("pt-BR")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Identificados (página)</p>
              <p className="text-lg font-bold">{stats.identificados}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <UserX className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">NI (página)</p>
              <p className="text-lg font-bold">{stats.ni}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Filtros e Ordenação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Busca + ordenação */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
            <div className="lg:col-span-6 flex gap-2">
              <Input
                placeholder="Buscar por nome, CPF, CNS, prontuário ou NI..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") setSearch(searchInput); }}
              />
              <Button onClick={() => setSearch(searchInput)} disabled={isLoading}>
                <Search className="h-4 w-4" />
              </Button>
              {(search || searchInput) && (
                <Button variant="outline" onClick={() => { setSearchInput(""); setSearch(""); }}>
                  Limpar
                </Button>
              )}
            </div>
            <div className="lg:col-span-3">
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger>
                  <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_desc">Mais recentes</SelectItem>
                  <SelectItem value="created_asc">Mais antigos</SelectItem>
                  <SelectItem value="full_name_asc">Nome A → Z</SelectItem>
                  <SelectItem value="full_name_desc">Nome Z → A</SelectItem>
                  <SelectItem value="updated_desc">Atualizados recente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-3">
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os pacientes</SelectItem>
                  <SelectItem value="identified">Apenas identificados</SelectItem>
                  <SelectItem value="unidentified">Apenas NI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filtros secundários */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Sexo</Label>
              <Select value={sexFilter} onValueChange={(v) => setSexFilter(v as SexFilter)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                  <SelectItem value="I">Indeterminado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Cidade</Label>
              <Input className="h-9" placeholder="Ex.: São Luís" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Idade mín.</Label>
              <Input className="h-9" type="number" min={0} max={130} placeholder="0" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Idade máx.</Label>
              <Input className="h-9" type="number" min={0} max={130} placeholder="130" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Criado de</Label>
              <Input className="h-9" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Criado até</Label>
              <Input className="h-9" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          {/* Limpar tudo */}
          {(search || cityFilter || dateFrom || dateTo || ageMin || ageMax || sexFilter !== "all" || typeFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch(""); setSearchInput(""); setCityFilter("");
                setDateFrom(""); setDateTo(""); setAgeMin(""); setAgeMax("");
                setSexFilter("all"); setTypeFilter("all");
              }}
            >
              Limpar todos os filtros
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Lista de Prontuários
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">Prontuário</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead className="w-[110px]">CPF</TableHead>
                  <TableHead className="w-[100px]">Nasc.</TableHead>
                  <TableHead className="w-[140px]">Cidade</TableHead>
                  <TableHead className="w-[120px]">Cadastro</TableHead>
                  <TableHead className="w-[200px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Carregando prontuários...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Nenhum prontuário encontrado com os filtros atuais
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((p) => (
                    <TableRow key={p.id} className={cn(p.is_unidentified && "bg-amber-500/5")}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {p.medical_record || "—"}
                        </Badge>
                        {p.is_unidentified && (
                          <Badge className="ml-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[9px] font-mono">
                            {p.unidentified_code || "NI"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-sm">{p.full_name}</p>
                        {p.social_name && (
                          <p className="text-[11px] text-muted-foreground">Nome social: {p.social_name}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{p.cpf || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {p.birth_date ? format(new Date(p.birth_date + "T00:00:00"), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{p.city || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(p.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {p.is_unidentified && (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 text-[10px] border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
                              onClick={() => openPromote(p)}
                            >
                              <UserCheck className="h-3 w-3 mr-1" /> Identificar
                            </Button>
                          )}
                          <Button
                            size="sm" variant="ghost" className="h-7 w-7 p-0"
                            title="Visualizar / Editar"
                            onClick={() => onViewPatient(p)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="h-7 w-7 p-0"
                            title="Histórico longitudinal"
                            onClick={() => navigate(`/historico-paciente?registryId=${p.id}&patientName=${encodeURIComponent(p.full_name)}`)}
                          >
                            <Activity className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="outline" className="h-7 text-[10px]"
                            onClick={() => onStartEncounter(p)}
                          >
                            <Play className="h-3 w-3 mr-1" /> Atender
                          </Button>
                          <PatientRowActions
                            patient={p}
                            onReopenEncounter={(_code, registryId) => {
                              // Reabrir = selecionar para atendimento (mesmo fluxo do Atender)
                              onStartEncounter({ ...p, id: registryId });
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between p-3 border-t">
            <p className="text-xs text-muted-foreground">
              Página {page} de {totalPages} • {total.toLocaleString("pt-BR")} prontuário(s) • {PAGE_SIZE} por página
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="sm" disabled={page <= 1 || isLoading}
                onClick={() => setPage(1)}
              >Início</Button>
              <Button
                variant="outline" size="sm" disabled={page <= 1 || isLoading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="outline" size="sm" disabled={page >= totalPages || isLoading}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
              <Button
                variant="outline" size="sm" disabled={page >= totalPages || isLoading}
                onClick={() => setPage(totalPages)}
              >Fim</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Promover NI Dialog */}
      <Dialog open={!!promoteTarget} onOpenChange={(o) => !o && setPromoteTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-emerald-600" />
              Identificar Paciente
            </DialogTitle>
            <DialogDescription>
              Vinculando dados ao prontuário <span className="font-mono font-semibold">{promoteTarget?.medical_record}</span>
              {promoteTarget?.unidentified_code && (
                <> (código original: <span className="font-mono">{promoteTarget.unidentified_code}</span>)</>
              )}.
              Esta ação é auditável e mantém o histórico do atendimento.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
            <div className="md:col-span-2">
              <Label>Nome Completo *</Label>
              <Input
                value={promoteForm.full_name}
                onChange={(e) => setPromoteForm(f => ({ ...f, full_name: e.target.value.toUpperCase() }))}
                placeholder="NOME COMPLETO DO PACIENTE"
              />
            </div>
            <div>
              <Label>Data de Nascimento</Label>
              <Input type="date" value={promoteForm.birth_date}
                onChange={(e) => setPromoteForm(f => ({ ...f, birth_date: e.target.value }))} />
            </div>
            <div>
              <Label>Sexo</Label>
              <Select value={promoteForm.sex} onValueChange={(v) => setPromoteForm(f => ({ ...f, sex: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                  <SelectItem value="I">Indeterminado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>CPF</Label>
              <Input placeholder="000.000.000-00" value={promoteForm.cpf}
                onChange={(e) => setPromoteForm(f => ({ ...f, cpf: e.target.value }))} />
            </div>
            <div>
              <Label>CNS (SUS)</Label>
              <Input placeholder="Cartão SUS" value={promoteForm.cns}
                onChange={(e) => setPromoteForm(f => ({ ...f, cns: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Nome da Mãe</Label>
              <Input value={promoteForm.mother_name}
                onChange={(e) => setPromoteForm(f => ({ ...f, mother_name: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input placeholder="(00) 00000-0000" value={promoteForm.phone}
                onChange={(e) => setPromoteForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={promoteForm.address}
                onChange={(e) => setPromoteForm(f => ({ ...f, address: e.target.value.toUpperCase() }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteTarget(null)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handlePromote}
              disabled={isPromoting || !promoteForm.full_name.trim()}
            >
              {isPromoting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
              Confirmar Identificação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
