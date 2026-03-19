import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Download,
  Copy,
  Trash2,
  Save,
  Printer,
  Plus,
  Clock,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useHospital } from "@/contexts/HospitalContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

const NotesTabOptimized = () => {
  const [notes, setNotes] = useState("");
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [scheduledContent, setScheduledContent] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const { toast } = useToast();
  const { currentDepartment } = useDepartment();
  const { currentState, currentHospital } = useHospital();

  useEffect(() => {
    loadChecklistFromDB();
  }, [currentDepartment]);

  const loadChecklistFromDB = async () => {
    const { data, error } = await supabase
      .from("notes_reminders")
      .select("*")
      .eq("department", currentDepartment)
      .eq("type", "checklist_item")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao carregar checklist:", error);
      return;
    }

    setChecklistItems(
      (data || []).map((item) => ({
        id: item.id,
        text: item.content,
        completed: item.completed,
      }))
    );
  };

  const handleSaveFreeText = async () => {
    if (!notes.trim()) {
      toast({
        title: "ERRO",
        description: "NÃO HÁ CONTEÚDO PARA SALVAR",
        variant: "destructive",
      });
      return;
    }

    if (!currentHospital || !currentState) {
      toast({
        title: "Erro",
        description: "Unidade hospitalar não selecionada",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("notes_reminders").insert({
      department: currentDepartment,
      content: notes,
      type: "free_text",
      is_active: true,
      state_id: currentState.id,
      hospital_unit_id: currentHospital.id,
    });

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar a anotação",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Salvo",
      description: "Anotação salva na central de notificações",
    });
    
    setNotes("");
  };

  const handleAddChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;

    if (!currentHospital || !currentState) {
      toast({
        title: "Erro",
        description: "Unidade hospitalar não selecionada",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("notes_reminders").insert({
      department: currentDepartment,
      content: newChecklistItem,
      type: "checklist_item",
      completed: false,
      is_active: true,
      state_id: currentState.id,
      hospital_unit_id: currentHospital.id,
    });

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o item",
        variant: "destructive",
      });
      return;
    }

    setNewChecklistItem("");
    loadChecklistFromDB();
    
    toast({
      title: "Adicionado",
      description: "Item adicionado ao checklist",
    });
  };

  const toggleChecklistItem = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("notes_reminders")
      .update({ completed: !currentStatus })
      .eq("id", id);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o item",
        variant: "destructive",
      });
      return;
    }

    loadChecklistFromDB();
  };

  const deleteChecklistItem = async (id: string) => {
    const { error } = await supabase
      .from("notes_reminders")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      toast({
        title: "ERRO",
        description: "NÃO FOI POSSÍVEL REMOVER O ITEM",
        variant: "destructive",
      });
      return;
    }

    loadChecklistFromDB();
    toast({
      title: "REMOVIDO",
      description: "ITEM REMOVIDO DO CHECKLIST",
    });
  };

  const handleSchedulePopup = async () => {
    if (!scheduledContent.trim() || !scheduledDate || !scheduledTime) {
      toast({
        title: "ERRO",
        description: "PREENCHA TODOS OS CAMPOS",
        variant: "destructive",
      });
      return;
    }

    if (!currentHospital || !currentState) {
      toast({
        title: "ERRO",
        description: "Unidade hospitalar não selecionada",
        variant: "destructive",
      });
      return;
    }

    const scheduledDateTime = `${scheduledDate}T${scheduledTime}:00`;

    const { error } = await supabase.from("notes_reminders").insert({
      department: currentDepartment,
      content: scheduledContent,
      type: "free_text",
      scheduled_popup_time: scheduledDateTime,
      is_active: true,
      state_id: currentState.id,
      hospital_unit_id: currentHospital.id,
    });

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível agendar o lembrete",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Agendado",
      description: `Lembrete programado para ${new Date(scheduledDateTime).toLocaleString("pt-BR")}`,
    });

    setScheduledContent("");
    setScheduledDate("");
    setScheduledTime("");
    setIsScheduleDialogOpen(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(notes);
      toast({
        title: "Copiado",
        description: "Texto copiado para a área de transferência",
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
    a.download = `anamnese_${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Download realizado",
      description: "Arquivo salvo com sucesso",
    });
  };

  const handlePrint = () => {
    window.print();
    toast({
      title: "Impressão iniciada",
      description: "Preparando documento para impressão",
    });
  };

  const handleClear = () => {
    setNotes("");
    toast({
      title: "Limpo",
      description: "Todo o texto foi removido",
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="notes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="notes">
            Anotações
          </TabsTrigger>
          <TabsTrigger value="checklist">
            Check-list
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="space-y-4">
          <div className="flex items-center justify-between print:hidden flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveFreeText}
                disabled={!notes}
                className="gap-2 hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500/50 transition-all"
              >
                <Save className="h-4 w-4" />
                Salvar na central
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsScheduleDialogOpen(true)}
                className="gap-2 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/50 transition-all"
              >
                <Clock className="h-4 w-4" />
                Programar lembrete
              </Button>
            </div>
          </div>

          <div className="hidden print:block mb-6">
            <h1 className="text-2xl font-bold uppercase text-center">ANOTAÇÕES MÉDICAS</h1>
            <p className="text-sm text-center mt-2">
              Data: {new Date().toLocaleDateString("pt-BR")} -{" "}
              {new Date().toLocaleTimeString("pt-BR")}
            </p>
            <hr className="my-4 border-t-2 border-gray-300" />
          </div>

          <Card className="p-6 shadow-xl border-2 print:border-0 print:shadow-none print:p-0">
            <div className="space-y-4 print:space-y-0">
              <Textarea
                value={notes}
                onChange={handleChange}
                placeholder="Digite sua anotação aqui..."
                className="min-h-[600px] font-mono text-sm resize-none focus:ring-2 focus:ring-emerald-500 transition-all print:min-h-0 print:border-0 print:focus:ring-0 print:p-0"
              />

              <div className="flex items-center justify-between print:hidden">
                <div className="text-xs text-muted-foreground">
                  {notes.length} caracteres
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    disabled={!notes}
                    className="gap-2 hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500/50 transition-all"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    disabled={!notes}
                    className="gap-2 hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/50 transition-all"
                  >
                    <Download className="h-4 w-4" />
                    Baixar
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrint}
                    disabled={!notes}
                    className="gap-2 hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500/50 transition-all"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClear}
                    disabled={!notes}
                    className="gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                    Limpar
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="checklist" className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newChecklistItem}
              onChange={(e) => setNewChecklistItem(e.target.value)}
              placeholder="Adicionar novo item..."
              className=""
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddChecklistItem();
                }
              }}
            />
            <Button
              onClick={handleAddChecklistItem}
              disabled={!newChecklistItem.trim()}
              className="gap-2 uppercase"
            >
              <Plus className="h-4 w-4" />
              ADICIONAR
            </Button>
          </div>

          <Card className="p-6">
            <div className="space-y-3">
              {checklistItems.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">
                  Nenhum item no checklist
                </p>
              ) : (
                checklistItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-all group"
                  >
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => toggleChecklistItem(item.id, item.completed)}
                      className="h-5 w-5"
                    />
                    <span
                      className={`flex-1 text-sm ${
                        item.completed ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {item.text}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteChecklistItem(item.id)}
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Schedule Popup Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Programar lembrete
            </DialogTitle>
            <DialogDescription>
              Defina data, hora e mensagem do lembrete
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="scheduled-content">
                Mensagem do lembrete
              </Label>
              <Textarea
                id="scheduled-content"
                value={scheduledContent}
                onChange={(e) => setScheduledContent(e.target.value)}
                placeholder="Digite a mensagem..."
                className=""
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="scheduled-date">
                  Data
                </Label>
                <Input
                  id="scheduled-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="scheduled-time">
                  Hora
                </Label>
                <Input
                  id="scheduled-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsScheduleDialogOpen(false);
                setScheduledContent("");
                setScheduledDate("");
                setScheduledTime("");
              }}
              className="uppercase"
            >
              CANCELAR
            </Button>
            <Button type="button" onClick={handleSchedulePopup} className="uppercase">
              <Clock className="h-4 w-4 mr-2" />
              AGENDAR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotesTabOptimized;
