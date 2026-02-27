import { useState, useEffect } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Pencil, Trash2, Building2, Loader2 } from "lucide-react";

interface State {
  id: string;
  name: string;
  abbreviation: string;
}

interface HospitalUnit {
  id: string;
  name: string;
  address: string | null;
  state_id: string;
  created_at: string;
  state?: State;
}

export default function AdminUnitsPage() {
  const [units, setUnits] = useState<HospitalUnit[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<HospitalUnit | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    state_id: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [filterState, setFilterState] = useState<string>("all");

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

      // Buscar unidades com estado
      const { data: unitsData, error } = await supabase
        .from("hospital_units")
        .select("*")
        .order("name");

      if (error) throw error;

      // Mapear estados para unidades
      const unitsWithState = (unitsData || []).map((unit) => ({
        ...unit,
        state: statesData?.find((s) => s.id === unit.state_id),
      }));

      setUnits(unitsWithState);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (unit?: HospitalUnit) => {
    if (unit) {
      setEditingUnit(unit);
      setFormData({
        name: unit.name,
        address: unit.address || "",
        state_id: unit.state_id,
      });
    } else {
      setEditingUnit(null);
      setFormData({ name: "", address: "", state_id: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.state_id) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setIsSaving(true);
    try {
      const dataToSave = {
        name: formData.name.toUpperCase().trim(),
        address: formData.address.toUpperCase().trim() || null,
        state_id: formData.state_id,
      };

      if (editingUnit) {
        const { error } = await supabase
          .from("hospital_units")
          .update(dataToSave)
          .eq("id", editingUnit.id);

        if (error) throw error;
        toast.success("Unidade atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("hospital_units")
          .insert(dataToSave);

        if (error) throw error;
        toast.success("Unidade cadastrada com sucesso!");
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao salvar unidade:", error);
      if (error.message?.includes("duplicate")) {
        toast.error("Esta unidade já existe");
      } else {
        toast.error("Erro ao salvar unidade");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (unitId: string) => {
    try {
      const { error } = await supabase
        .from("hospital_units")
        .delete()
        .eq("id", unitId);

      if (error) throw error;
      toast.success("Unidade excluída com sucesso!");
      fetchData();
    } catch (error: any) {
      console.error("Erro ao excluir unidade:", error);
      if (error.message?.includes("foreign key")) {
        toast.error("Não é possível excluir: existem dados vinculados a esta unidade");
      } else {
        toast.error("Erro ao excluir unidade");
      }
    }
  };

  const filteredUnits = filterState === "all"
    ? units
    : units.filter((u) => u.state_id === filterState);

  return (
    <MainLayout>
      <div className="container mx-auto py-6 px-4 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              Gerenciar Unidades Hospitalares
            </h1>
            <p className="text-muted-foreground">
              Cadastre e gerencie as unidades hospitalares do sistema
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} disabled={states.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Unidade
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingUnit ? "Editar Unidade" : "Nova Unidade Hospitalar"}
                </DialogTitle>
                <DialogDescription>
                  {editingUnit
                    ? "Atualize as informações da unidade"
                    : "Preencha os dados para cadastrar uma nova unidade"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="state">Estado *</Label>
                  <Select
                    value={formData.state_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, state_id: value })
                    }
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
                  <Label htmlFor="name">Nome da Unidade *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Hospital Central"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value.toUpperCase() })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Textarea
                    id="address"
                    placeholder="Endereço completo da unidade"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value.toUpperCase() })
                    }
                  />
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

        {states.length === 0 && !loading && (
          <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="pt-6">
              <p className="text-amber-800 dark:text-amber-200">
                ⚠️ Cadastre pelo menos um estado antes de criar unidades hospitalares.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Unidades Cadastradas</CardTitle>
                <CardDescription>
                  Total de {filteredUnits.length} unidade(s)
                </CardDescription>
              </div>
              <div className="w-48">
                <Select value={filterState} onValueChange={setFilterState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os estados</SelectItem>
                    {states.map((state) => (
                      <SelectItem key={state.id} value={state.id}>
                        {state.abbreviation}
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
            ) : filteredUnits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma unidade cadastrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Cadastrada em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnits.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {unit.state?.abbreviation || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {unit.address || "-"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(unit.created_at), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(unit)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Excluir Unidade
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir{" "}
                                  <strong>{unit.name}</strong>? Esta ação não
                                  pode ser desfeita e removerá todos os dados
                                  vinculados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(unit.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
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
