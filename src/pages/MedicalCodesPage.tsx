import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, FileCode, Copy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

type MedicalCode = {
  id: string;
  code: string;
  name: string;
  system_description: string;
  category: string;
};

const categoryLabels = {
  EXAMES: "Exames",
  PROCEDIMENTOS: "Procedimentos",
  MATERIAIS: "Materiais",
  MEDICAÇÕES: "Medicações",
};

export default function MedicalCodesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const category = (searchParams.get("category") || "EXAMES").toUpperCase();
  const [codes, setCodes] = useState<MedicalCode[]>([]);
  const [filteredCodes, setFilteredCodes] = useState<MedicalCode[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<MedicalCode | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    system_description: "",
  });

  useEffect(() => {
    fetchCodes();
  }, [category]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = codes.filter(
        (code) =>
          code.code.toUpperCase().includes(searchTerm.toUpperCase()) ||
          code.name.toUpperCase().includes(searchTerm.toUpperCase()) ||
          code.system_description.toUpperCase().includes(searchTerm.toUpperCase())
      );
      setFilteredCodes(filtered);
    } else {
      setFilteredCodes(codes);
    }
  }, [searchTerm, codes]);

  const fetchCodes = async () => {
    const { data, error } = await supabase
      .from("medical_codes")
      .select("*")
      .eq("category", category)
      .order("code", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar códigos");
      if (import.meta.env.DEV) {
        console.error(error);
      }
      return;
    }

    setCodes(data || []);
    setFilteredCodes(data || []);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name || !formData.system_description) {
      toast.error("Preencha todos os campos");
      return;
    }

    const dataToSave = {
      ...formData,
      code: formData.code,
      name: formData.name,
      system_description: formData.system_description,
      category,
    };

    if (editingCode) {
      const { error } = await supabase
        .from("medical_codes")
        .update(dataToSave)
        .eq("id", editingCode.id);

      if (error) {
        toast.error("Erro ao atualizar código");
        if (import.meta.env.DEV) {
          console.error(error);
        }
        return;
      }

      toast.success("Código atualizado com sucesso");
    } else {
      const { error } = await supabase.from("medical_codes").insert(dataToSave);

      if (error) {
        toast.error("Erro ao criar código");
        if (import.meta.env.DEV) {
          console.error(error);
        }
        return;
      }

      toast.success("Código criado com sucesso");
    }

    setIsDialogOpen(false);
    setEditingCode(null);
    setFormData({ code: "", name: "", system_description: "" });
    fetchCodes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar este código?")) return;

    const { error } = await supabase.from("medical_codes").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao deletar código");
      if (import.meta.env.DEV) {
        console.error(error);
      }
      return;
    }

    toast.success("Código deletado com sucesso");
    fetchCodes();
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch (error) {
      toast.error("Erro ao copiar");
    }
  };

  const openDialog = (code?: MedicalCode) => {
    if (role !== 'admin') {
      toast.error("Apenas administradores podem criar ou editar códigos médicos");
      return;
    }

    if (code) {
      setEditingCode(code);
      setFormData({
        code: code.code,
        name: code.name,
        system_description: code.system_description,
      });
    } else {
      setEditingCode(null);
      setFormData({ code: "", name: "", system_description: "" });
    }
    setIsDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 flex items-center justify-center">
            <FileCode className="h-6 w-6 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {categoryLabels[category as keyof typeof categoryLabels]}
            </h1>
            <p className="text-muted-foreground text-sm">
              Códigos e descritivos do sistema
            </p>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Search and Add */}
      <Card className="border-primary/20 shadow-lg">
        <CardHeader>
          <CardTitle className="uppercase text-lg">Pesquisar Códigos</CardTitle>
          <CardDescription className="uppercase text-xs">
            {filteredCodes.length} {filteredCodes.length === 1 ? 'código encontrado' : 'códigos encontrados'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, nome ou descritivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                className="pl-10 uppercase h-12"
              />
            </div>
            <Button 
              onClick={() => openDialog()} 
              className="gap-2 h-12 px-6"
              size="lg"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-lg">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-bold uppercase w-32">Código</TableHead>
                <TableHead className="font-bold uppercase w-64">Nome</TableHead>
                <TableHead className="font-bold uppercase">Descritivo no Sistema</TableHead>
                <TableHead className="font-bold uppercase w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground uppercase">
                    <div className="flex flex-col items-center gap-2">
                      <FileCode className="h-12 w-12 text-muted-foreground/50" />
                      <p className="font-semibold">Nenhum Código Cadastrado</p>
                      <p className="text-xs">Clique em "Adicionar" para criar um novo código</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCodes.map((code) => (
                  <TableRow key={code.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="font-mono font-semibold text-primary uppercase">
                      <div className="group relative flex items-center gap-2">
                        <span>{code.code}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(code.code, "Código")}
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
                          title="Copiar Código"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium uppercase">{code.name}</TableCell>
                    <TableCell className="text-muted-foreground uppercase">
                      <div className="group relative flex items-center gap-2">
                        <span className="flex-1">{code.system_description}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(code.system_description, "Descritivo")}
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary flex-shrink-0"
                          title="Copiar Descritivo"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDialog(code)}
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                          disabled={role !== 'admin'}
                          title={role !== 'admin' ? 'APENAS ADMINISTRADORES' : 'Editar'}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(code.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={role !== 'admin'}
                          title={role !== 'admin' ? 'APENAS ADMINISTRADORES' : 'Deletar'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="uppercase flex items-center gap-2">
              {editingCode ? <><Pencil className="h-5 w-5 text-primary" /> Editar Código</> : <><Plus className="h-5 w-5 text-primary" /> Adicionar Código</>}
            </DialogTitle>
          </DialogHeader>
          <Separator className="my-4" />
          <div className="grid gap-6 py-4">
            <div className="grid gap-3">
              <Label htmlFor="code" className="uppercase text-sm font-semibold">
                Código
              </Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
                placeholder="Código"
                className="uppercase h-12"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="name" className="uppercase text-sm font-semibold">
                Nome
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value.toUpperCase() })
                }
                placeholder="Nome do exame/procedimento/material/medicação"
                className="uppercase h-12"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="description" className="uppercase text-sm font-semibold">
                Descritivo no Sistema
              </Label>
              <Textarea
                id="description"
                value={formData.system_description}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    system_description: e.target.value.toUpperCase(),
                  })
                }
                placeholder="Como é escrito no sistema"
                className="uppercase min-h-24 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setEditingCode(null);
                setFormData({ code: "", name: "", system_description: "" });
              }}
              className="uppercase"
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} className="uppercase">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
