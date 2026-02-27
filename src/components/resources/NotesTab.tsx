import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Download, Copy, Trash2, FileInput, Save, FolderOpen, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { internmentTemplate } from "@/data/internmentTemplate";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SavedTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

const NotesTab = () => {
  const [notes, setNotes] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem("customTemplates");
    if (stored) {
      setSavedTemplates(JSON.parse(stored));
    }
  }, []);

  const saveTemplatesToStorage = (templates: SavedTemplate[]) => {
    localStorage.setItem("customTemplates", JSON.stringify(templates));
    setSavedTemplates(templates);
  };

  const handleImportTemplate = () => {
    setNotes(internmentTemplate);
    toast({
      title: "MODELO IMPORTADO",
      description: "TEMPLATE DE SOLICITAÇÃO DE INTERNAÇÃO CARREGADO COM SUCESSO",
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(notes);
      toast({
        title: "COPIADO",
        description: "TEXTO COPIADO PARA A ÁREA DE TRANSFERÊNCIA",
      });
    } catch (err) {
      toast({
        title: "ERRO",
        description: "NÃO FOI POSSÍVEL COPIAR O TEXTO",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([notes], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ANAMNESE_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "DOWNLOAD REALIZADO",
      description: "ARQUIVO SALVO COM SUCESSO",
    });
  };

  const handlePrint = () => {
    window.print();
    toast({
      title: "IMPRESSÃO INICIADA",
      description: "PREPARANDO DOCUMENTO PARA IMPRESSÃO",
    });
  };

  const handleClear = () => {
    setNotes("");
    toast({
      title: "LIMPO",
      description: "TODO O TEXTO FOI REMOVIDO",
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value.toUpperCase());
  };

  const handleOpenSaveDialog = () => {
    if (!notes.trim()) {
      toast({
        title: "ERRO",
        description: "NÃO HÁ CONTEÚDO PARA SALVAR",
        variant: "destructive",
      });
      return;
    }
    setIsSaveDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast({
        title: "ERRO",
        description: "DIGITE UM NOME PARA O MODELO",
        variant: "destructive",
      });
      return;
    }

    const newTemplate: SavedTemplate = {
      id: Date.now().toString(),
      name: templateName.toUpperCase(),
      content: notes,
      createdAt: new Date().toISOString(),
    };

    const updatedTemplates = [...savedTemplates, newTemplate];
    saveTemplatesToStorage(updatedTemplates);

    toast({
      title: "MODELO SALVO",
      description: `MODELO "${templateName.toUpperCase()}" SALVO COM SUCESSO`,
    });

    setTemplateName("");
    setIsSaveDialogOpen(false);
  };

  const handleLoadTemplate = (template: SavedTemplate) => {
    setNotes(template.content);
    toast({
      title: "MODELO CARREGADO",
      description: `MODELO "${template.name}" CARREGADO COM SUCESSO`,
    });
  };

  const handleDeleteTemplate = (templateId: string) => {
    const updatedTemplates = savedTemplates.filter(t => t.id !== templateId);
    saveTemplatesToStorage(updatedTemplates);
    toast({
      title: "MODELO EXCLUÍDO",
      description: "MODELO REMOVIDO COM SUCESSO",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportTemplate}
            className="gap-2 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/50 transition-all uppercase"
          >
            <FileInput className="h-4 w-4" />
            IMPORTAR MODELO PADRÃO
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenSaveDialog}
            disabled={!notes}
            className="gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all uppercase"
          >
            <Save className="h-4 w-4" />
            SALVAR COMO MODELO
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={!notes}
            className="gap-2 hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500/50 transition-all uppercase"
          >
            <Printer className="h-4 w-4" />
            IMPRIMIR
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={savedTemplates.length === 0}
                className="gap-2 hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500/50 transition-all uppercase"
              >
                <FolderOpen className="h-4 w-4" />
                MEUS MODELOS ({savedTemplates.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="uppercase">MODELOS SALVOS</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {savedTemplates.map((template) => (
                <DropdownMenuItem
                  key={template.id}
                  className="flex items-center justify-between group uppercase"
                >
                  <button
                    onClick={() => handleLoadTemplate(template)}
                    className="flex-1 text-left uppercase"
                  >
                    {template.name}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(template.id);
                    }}
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Print Title - Only visible when printing */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold uppercase text-center">ANOTAÇÕES MÉDICAS</h1>
        <p className="text-sm text-center mt-2">
          Data: {new Date().toLocaleDateString('pt-BR')} - {new Date().toLocaleTimeString('pt-BR')}
        </p>
        <hr className="my-4 border-t-2 border-gray-300" />
      </div>

      <Card className="p-6 shadow-xl border-2 print:border-0 print:shadow-none print:p-0">
        <div className="space-y-4 print:space-y-0">
          <Textarea
            value={notes}
            onChange={handleChange}
            placeholder="DIGITE SUA ANAMNESE AQUI OU IMPORTE O MODELO PADRÃO..."
            className="min-h-[600px] font-mono text-sm resize-none focus:ring-2 focus:ring-emerald-500 transition-all uppercase print:min-h-0 print:border-0 print:focus:ring-0 print:p-0"
          />
          
          <div className="flex items-center justify-between print:hidden">
            <div className="text-xs text-muted-foreground uppercase">
              {notes.length} CARACTERES
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!notes}
                className="gap-2 hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500/50 transition-all uppercase"
              >
                <Copy className="h-4 w-4" />
                COPIAR TEXTO
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={!notes}
                className="gap-2 hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/50 transition-all uppercase"
              >
                <Download className="h-4 w-4" />
                BAIXAR
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={!notes}
                className="gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all uppercase"
              >
                <Trash2 className="h-4 w-4" />
                LIMPAR TUDO
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Save Template Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="uppercase">SALVAR MODELO</DialogTitle>
            <DialogDescription className="uppercase">
              DIGITE UM NOME PARA ESTE MODELO
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="template-name" className="uppercase">
                NOME DO MODELO
              </Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value.toUpperCase())}
                placeholder="EX: MODELO CARDIOLOGIA"
                className="uppercase"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveTemplate();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsSaveDialogOpen(false);
                setTemplateName("");
              }}
              className="uppercase"
            >
              CANCELAR
            </Button>
            <Button
              type="button"
              onClick={handleSaveTemplate}
              className="uppercase"
            >
              SALVAR MODELO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotesTab;
