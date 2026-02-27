import { useState, useEffect } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2, MapPin, Loader2 } from "lucide-react";

interface State {
  id: string;
  name: string;
  abbreviation: string;
  created_at: string;
}

export default function AdminStatesPage() {
  const [states, setStates] = useState<State[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingState, setEditingState] = useState<State | null>(null);
  const [formData, setFormData] = useState({ name: "", abbreviation: "" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchStates();
  }, []);

  const fetchStates = async () => {
    try {
      const { data, error } = await supabase
        .from("states")
        .select("*")
        .order("name");

      if (error) throw error;
      setStates(data || []);
    } catch (error) {
      console.error("Erro ao buscar estados:", error);
      toast.error("Erro ao carregar estados");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (state?: State) => {
    if (state) {
      setEditingState(state);
      setFormData({ name: state.name, abbreviation: state.abbreviation });
    } else {
      setEditingState(null);
      setFormData({ name: "", abbreviation: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.abbreviation.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (formData.abbreviation.length !== 2) {
      toast.error("A sigla deve ter exatamente 2 caracteres");
      return;
    }

    setIsSaving(true);
    try {
      const dataToSave = {
        name: formData.name.toUpperCase().trim(),
        abbreviation: formData.abbreviation.toUpperCase().trim(),
      };

      if (editingState) {
        const { error } = await supabase
          .from("states")
          .update(dataToSave)
          .eq("id", editingState.id);

        if (error) throw error;
        toast.success("Estado atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("states")
          .insert(dataToSave);

        if (error) throw error;
        toast.success("Estado cadastrado com sucesso!");
      }

      setIsDialogOpen(false);
      fetchStates();
    } catch (error: any) {
      console.error("Erro ao salvar estado:", error);
      if (error.message?.includes("duplicate")) {
        toast.error("Este estado ou sigla já existe");
      } else {
        toast.error("Erro ao salvar estado");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (stateId: string) => {
    try {
      const { error } = await supabase
        .from("states")
        .delete()
        .eq("id", stateId);

      if (error) throw error;
      toast.success("Estado excluído com sucesso!");
      fetchStates();
    } catch (error: any) {
      console.error("Erro ao excluir estado:", error);
      if (error.message?.includes("foreign key")) {
        toast.error("Não é possível excluir: existem unidades vinculadas a este estado");
      } else {
        toast.error("Erro ao excluir estado");
      }
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="h-6 w-6" />
              Gerenciar Estados
            </h1>
            <p className="text-muted-foreground">
              Cadastre e gerencie os estados onde a plataforma opera
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Estado
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingState ? "Editar Estado" : "Novo Estado"}
                </DialogTitle>
                <DialogDescription>
                  {editingState
                    ? "Atualize as informações do estado"
                    : "Preencha os dados para cadastrar um novo estado"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Estado</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Maranhão"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value.toUpperCase() })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abbreviation">Sigla (UF)</Label>
                  <Input
                    id="abbreviation"
                    placeholder="Ex: MA"
                    maxLength={2}
                    value={formData.abbreviation}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        abbreviation: e.target.value.toUpperCase(),
                      })
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
            <CardTitle>Estados Cadastrados</CardTitle>
            <CardDescription>
              Total de {states.length} estado(s) cadastrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : states.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum estado cadastrado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Sigla</TableHead>
                    <TableHead>Cadastrado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {states.map((state) => (
                    <TableRow key={state.id}>
                      <TableCell className="font-medium">{state.name}</TableCell>
                      <TableCell>{state.abbreviation}</TableCell>
                      <TableCell>
                        {format(new Date(state.created_at), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(state)}
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
                                  Excluir Estado
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o estado{" "}
                                  <strong>{state.name}</strong>? Esta ação não
                                  pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(state.id)}
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
