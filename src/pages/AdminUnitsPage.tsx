import { useState, useEffect } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Pencil, Trash2, Building2, Loader2 } from "lucide-react";

// MIGRAÇÃO: `hospital_units` (morta) → `hospitais`. Mapeamento: name←nome,
// address←endereco, created_at←criado_em. `states`/`state_id` NÃO têm tabela
// nem coluna equivalente no schema novo (mesma degradação de
// AdminCoordinatorsPage/HospitalContext) → o conceito de UF foi REMOVIDO
// (seletor de estado, coluna "Estado", filtro por estado e o aviso "cadastre um
// estado antes").
interface HospitalUnit {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
}

export default function AdminUnitsPage() {
  const [units, setUnits] = useState<HospitalUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<HospitalUnit | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: unitsData, error } = await supabase
        .from("hospitais")
        .select("id, nome, endereco, criado_em")
        .order("nome");

      if (error) throw error;

      const mapped: HospitalUnit[] = (unitsData || []).map((u) => ({
        id: u.id,
        name: u.nome,
        address: u.endereco,
        created_at: u.criado_em,
      }));

      setUnits(mapped);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Não foi possível carregar dados");
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
      });
    } else {
      setEditingUnit(null);
      setFormData({ name: "", address: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setIsSaving(true);
    try {
      const dataToSave = {
        nome: formData.name.trim(),
        endereco: formData.address.trim() || null,
      };

      if (editingUnit) {
        const { error } = await supabase
          .from("hospitais")
          .update(dataToSave)
          .eq("id", editingUnit.id);

        if (error) throw error;
        toast.success("Unidade atualizada com sucesso");
      } else {
        const { error } = await supabase
          .from("hospitais")
          .insert(dataToSave);

        if (error) throw error;
        toast.success("Unidade cadastrada com sucesso");
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao salvar unidade:", error);
      if (error.message?.includes("duplicate")) {
        toast.error("Esta unidade já existe");
      } else {
        toast.error("Não foi possível salvar unidade");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (unitId: string) => {
    try {
      const { error } = await supabase
        .from("hospitais")
        .delete()
        .eq("id", unitId);

      if (error) throw error;
      toast.success("Unidade excluída com sucesso");
      fetchData();
    } catch (error: any) {
      console.error("Erro ao excluir unidade:", error);
      if (error.message?.includes("foreign key")) {
        toast.error("Não é possível excluir: existem dados vinculados a esta unidade");
      } else {
        toast.error("Não foi possível excluir unidade");
      }
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 px-4 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              Gerenciar Unidades Hospitalares
            </h1>
            <p className="text-muted-foreground">
              Cadastre e gerencie as unidades hospitalares do sistema
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
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
                  <Label htmlFor="name">Nome da Unidade *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Hospital Central"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
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
                      setFormData({ ...formData, address: e.target.value })
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

        <Card>
          <CardHeader>
            <CardTitle>Unidades Cadastradas</CardTitle>
            <CardDescription>
              Total de {units.length} unidade(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : units.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma unidade cadastrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Cadastrada em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.name}</TableCell>
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
