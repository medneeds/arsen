import { useState, useEffect } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Pencil, Trash2, UserCog, Loader2, Building2, Shield } from "lucide-react";

interface State {
  id: string;
  name: string;
  abbreviation: string;
}

interface HospitalUnit {
  id: string;
  name: string;
  state_id: string;
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
  const [states, setStates] = useState<State[]>([]);
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
  const [selectedState, setSelectedState] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Buscar estados
      const { data: statesData } = await supabase
        .from("states")
        .select("*")
        .order("name");
      setStates(statesData || []);

      // Buscar unidades
      const { data: unitsData } = await supabase
        .from("hospital_units")
        .select("*")
        .order("name");
      setUnits(unitsData || []);

      // Buscar atribuições de coordenadores (user_hospital_assignments)
      const { data: assignmentsData } = await supabase
        .from("user_hospital_assignments")
        .select("*")
        .order("created_at", { ascending: false });

      // Buscar perfis dos usuários atribuídos
      const userIds = [...new Set(assignmentsData?.map((a) => a.user_id) || [])];
      let profilesMap: Record<string, Profile> = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("*")
          .in("id", userIds);

        profilesData?.forEach((p) => {
          profilesMap[p.id] = p;
        });
      }

      // Mapear dados
      const coordinatorsWithDetails = (assignmentsData || []).map((assignment) => ({
        ...assignment,
        profile: profilesMap[assignment.user_id],
        hospital_unit: unitsData?.find((u) => u.id === assignment.hospital_unit_id),
      }));

      setCoordinators(coordinatorsWithDetails);

      // Buscar usuários aprovados que são admins para seleção
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      const adminUserIds = adminRoles?.map((r) => r.user_id) || [];

      if (adminUserIds.length > 0) {
        const { data: adminProfiles } = await supabase
          .from("profiles")
          .select("*")
          .in("id", adminUserIds)
          .eq("status", "approved");

        setAvailableUsers(adminProfiles || []);
      }
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setFormData({ user_id: "", hospital_unit_id: "", departments: [] });
    setSelectedState("");
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
      // Verificar se já existe atribuição
      const { data: existing } = await supabase
        .from("user_hospital_assignments")
        .select("id")
        .eq("user_id", formData.user_id)
        .eq("hospital_unit_id", formData.hospital_unit_id)
        .single();

      if (existing) {
        toast.error("Este usuário já está atribuído a esta unidade");
        setIsSaving(false);
        return;
      }

      // Inserir atribuição de unidade
      const { error: assignmentError } = await supabase
        .from("user_hospital_assignments")
        .insert({
          user_id: formData.user_id,
          hospital_unit_id: formData.hospital_unit_id,
        });

      if (assignmentError) throw assignmentError;

      // Inserir departamentos se selecionados
      if (formData.departments.length > 0) {
        const deptInserts = formData.departments.map((dept) => ({
          user_id: formData.user_id,
          department: dept,
        }));

        await supabase.from("user_departments").insert(deptInserts);
      }

      toast.success("Coordenador atribuído com sucesso!");
      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao atribuir coordenador");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("user_hospital_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;
      toast.success("Atribuição removida com sucesso!");
      fetchData();
    } catch (error) {
      console.error("Erro ao remover:", error);
      toast.error("Erro ao remover atribuição");
    }
  };

  const filteredUnitsForDialog = selectedState
    ? units.filter((u) => u.state_id === selectedState)
    : [];

  const filteredCoordinators =
    filterUnit === "all"
      ? coordinators
      : coordinators.filter((c) => c.hospital_unit_id === filterUnit);

  const getStateName = (stateId: string) => {
    return states.find((s) => s.id === stateId)?.abbreviation || "";
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 px-4 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
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
                  <Label>Estado *</Label>
                  <Select
                    value={selectedState}
                    onValueChange={(value) => {
                      setSelectedState(value);
                      setFormData({ ...formData, hospital_unit_id: "" });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((state) => (
                        <SelectItem key={state.id} value={state.id}>
                          {state.name} ({state.abbreviation})
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
                    disabled={!selectedState}
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
          <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="pt-6">
              <p className="text-amber-800 dark:text-amber-200">
                ⚠️ {availableUsers.length === 0
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
                        {unit.name} ({getStateName(unit.state_id)})
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
                    <TableHead>Estado</TableHead>
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
                        <Badge variant="outline">
                          {getStateName(coord.hospital_unit?.state_id || "")}
                        </Badge>
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
