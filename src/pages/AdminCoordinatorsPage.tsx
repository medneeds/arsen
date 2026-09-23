import { useState, useEffect } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, UserCog, Loader2, Building2, Shield } from "lucide-react";

// MIGRAÇÃO: hospital_units→hospitais; profiles/user_roles/user_hospital_assignments→
// profissionais(+profissionais_hospitais). Não há tabela `states` nem coluna state_id
// em hospitais no schema novo → o conceito de "estado/UF" foi degradado (removido).
interface HospitalUnit {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  crm: string | null;
  status: string;
}

interface CoordinatorAssignment {
  id: string;
  user_id: string;
  hospital_unit_id: string;
  created_at: string;
  profile?: Profile;
  hospital_unit?: HospitalUnit;
}

const DEPARTMENTS = [
  "URGÊNCIA E EMERGÊNCIA ADULTO",
  "URGÊNCIA E EMERGÊNCIA PEDIÁTRICA",
  "UTI",
  "POSTO DE INTERNAÇÃO",
];

export default function AdminCoordinatorsPage() {
  const [coordinators, setCoordinators] = useState<CoordinatorAssignment[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [units, setUnits] = useState<HospitalUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    user_id: "",
    hospital_unit_id: "",
    departments: [] as string[],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [filterUnit, setFilterUnit] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  // MIGRAÇÃO: um "profissional" (profissionais) é a fonte da verdade de perfil + papel.
  const profToProfile = (p: any): Profile => ({
    id: p.id,
    full_name: p.nome ?? null,
    email: p.email ?? null,
    // MIGRAÇÃO: crm ← profissionais.numero_conselho (não há coluna crm dedicada).
    crm: p.numero_conselho ?? null,
    status: p.ativo ? "approved" : "inactive",
  });

  const fetchData = async () => {
    try {
      // Buscar unidades (hospital_units→hospitais)
      const { data: unitsData } = await supabase
        .from("hospitais")
        .select("id, nome")
        .order("nome");
      const mappedUnits: HospitalUnit[] = (unitsData || []).map((u: any) => ({ id: u.id, name: u.nome }));
      setUnits(mappedUnits);

      // Buscar atribuições de coordenadores (user_hospital_assignments→profissionais_hospitais)
      const { data: assignmentsData } = await supabase
        .from("profissionais_hospitais")
        .select("id, profissional_id, hospital_id, criado_em, profissional:profissionais(id, nome, email, numero_conselho, papel, ativo)")
        .order("criado_em", { ascending: false });

      // MIGRAÇÃO: mantém apenas vínculos de profissionais com papel 'coordenador'.
      const coordinatorsWithDetails: CoordinatorAssignment[] = (assignmentsData || [])
        .filter((a: any) => a.profissional?.papel === "coordenador")
        .map((a: any) => ({
          id: a.id,
          user_id: a.profissional_id,
          hospital_unit_id: a.hospital_id,
          created_at: a.criado_em,
          profile: a.profissional ? profToProfile(a.profissional) : undefined,
          hospital_unit: mappedUnits.find((u) => u.id === a.hospital_id),
        }));

      setCoordinators(coordinatorsWithDetails);

      // Buscar profissionais elegíveis a coordenador (papel admin/coordenador, ativos)
      // MIGRAÇÃO: substitui user_roles(role='admin') + profiles(status='approved').
      const { data: adminProfiles } = await supabase
        .from("profissionais")
        .select("id, nome, email, numero_conselho, papel, ativo")
        .in("papel", ["admin", "coordenador"])
        .eq("ativo", true)
        .order("nome");

      setAvailableUsers((adminProfiles || []).map(profToProfile));
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Não foi possível carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setFormData({ user_id: "", hospital_unit_id: "", departments: [] });
    setIsDialogOpen(true);
  };

  const handleDepartmentToggle = (dept: string) => {
    setFormData((prev) => ({
      ...prev,
      departments: prev.departments.includes(dept)
        ? prev.departments.filter((d) => d !== dept)
        : [...prev.departments, dept],
    }));
  };

  const handleSave = async () => {
    if (!formData.user_id || !formData.hospital_unit_id) {
      toast.error("Selecione o usuário e a unidade");
      return;
    }

    setIsSaving(true);
    try {
      // MIGRAÇÃO: formData.user_id agora é profissionais.id; a atribuição vive em
      // profissionais_hospitais (profissional_id + hospital_id).
      const { data: existing } = await supabase
        .from("profissionais_hospitais")
        .select("id")
        .eq("profissional_id", formData.user_id)
        .eq("hospital_id", formData.hospital_unit_id)
        .maybeSingle();

      if (existing) {
        toast.error("Este usuário já está atribuído a esta unidade");
        setIsSaving(false);
        return;
      }

      // Inserir atribuição de unidade
      const { error: assignmentError } = await supabase
        .from("profissionais_hospitais")
        .insert({
          profissional_id: formData.user_id,
          hospital_id: formData.hospital_unit_id,
        });

      if (assignmentError) throw assignmentError;

      // MIGRAÇÃO: "Setores de Acesso" usava user_departments (nomes de departamento).
      // No schema novo o vínculo é profissionais_setores (setor_id UUID) e os nomes
      // fixos de DEPARTMENTS não mapeiam para setores → seleção NÃO é persistida
      // (degradado; ver MIGRACAO_DEGRADACOES.md).

      toast.success("Coordenador atribuído com sucesso");
      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error("Não foi possível atribuir coordenador");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("profissionais_hospitais")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;
      toast.success("Atribuição removida com sucesso");
      fetchData();
    } catch (error) {
      console.error("Erro ao remover:", error);
      toast.error("Não foi possível remover atribuição");
    }
  };

  // MIGRAÇÃO: sem estado/UF no schema novo — o seletor lista todas as unidades.
  const filteredUnitsForDialog = units;

  const filteredCoordinators =
    filterUnit === "all"
      ? coordinators
      : coordinators.filter((c) => c.hospital_unit_id === filterUnit);

  return (
    <MainLayout>
      <div className="container mx-auto py-6 px-4 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <UserCog className="h-6 w-6" />
              Gerenciar Coordenadores
            </h1>
            <p className="text-muted-foreground">
              Atribua coordenadores às unidades hospitalares
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={handleOpenDialog}
                disabled={availableUsers.length === 0 || units.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Atribuição
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Atribuir Coordenador</DialogTitle>
                <DialogDescription>
                  Selecione o coordenador e a unidade hospitalar
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Coordenador *</Label>
                  <Select
                    value={formData.user_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, user_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o coordenador" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email} {user.crm && `(CRM: ${user.crm})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Unidade Hospitalar *</Label>
                  <Select
                    value={formData.hospital_unit_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, hospital_unit_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredUnitsForDialog.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Setores de Acesso</Label>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {DEPARTMENTS.map((dept) => (
                      <div key={dept} className="flex items-center space-x-2">
                        <Checkbox
                          id={dept}
                          checked={formData.departments.includes(dept)}
                          onCheckedChange={() => handleDepartmentToggle(dept)}
                        />
                        <label
                          htmlFor={dept}
                          className="text-sm cursor-pointer"
                        >
                          {dept}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {(availableUsers.length === 0 || units.length === 0) && !loading && (
          <Card className="mb-6 border-warning-border bg-warning-soft">
            <CardContent className="pt-6">
              <p className="text-warning-on-soft">
                {availableUsers.length === 0
                  ? "Não há usuários admin aprovados para atribuir como coordenadores."
                  : "Cadastre unidades hospitalares antes de atribuir coordenadores."}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Coordenadores Atribuídos</CardTitle>
                <CardDescription>
                  Total de {filteredCoordinators.length} atribuição(ões)
                </CardDescription>
              </div>
              <div className="w-56">
                <Select value={filterUnit} onValueChange={setFilterUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as unidades</SelectItem>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCoordinators.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum coordenador atribuído
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coordenador</TableHead>
                    <TableHead>CRM</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Atribuído em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoordinators.map((coord) => (
                    <TableRow key={coord.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          {coord.profile?.full_name || coord.profile?.email || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell>{coord.profile?.crm || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {coord.hospital_unit?.name || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(coord.created_at), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover Atribuição</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover{" "}
                                <strong>{coord.profile?.full_name}</strong> da
                                unidade <strong>{coord.hospital_unit?.name}</strong>?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(coord.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
