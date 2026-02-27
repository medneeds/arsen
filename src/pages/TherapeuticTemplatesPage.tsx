import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Search, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTherapeuticTemplates, TherapeuticTemplate } from "@/hooks/useTherapeuticTemplates";
import { useAuth } from "@/contexts/AuthContext";
import { EditTherapeuticTemplateDialog } from "@/components/EditTherapeuticTemplateDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PROTOCOL_COLORS: Record<string, string> = {
  "SEPSE": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "AVC": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "DOR TORÁCICA": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "IAM": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "TEP": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "CETOACIDOSE": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

export default function TherapeuticTemplatesPage() {
  const navigate = useNavigate();
  const { templates, isLoading, deleteTemplate } = useTherapeuticTemplates();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [search, setSearch] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<TherapeuticTemplate | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.protocol_type.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, TherapeuticTemplate[]>>((acc, t) => {
    const key = t.protocol_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/documents")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wide">
              Templates Terapêuticos
            </h1>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
              Protocolos institucionais padronizados
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsCreateOpen(true)} className="gap-2 uppercase text-xs font-bold tracking-wider">
              <Plus className="h-4 w-4" />
              Novo Template
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 uppercase"
          />
        </div>

        {/* Templates List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm uppercase">Carregando...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground text-sm uppercase">
              {search ? "Nenhum template encontrado" : "Nenhum template cadastrado"}
            </p>
            {isAdmin && !search && (
              <Button variant="outline" className="mt-4 uppercase text-xs" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro template
              </Button>
            )}
          </div>
        ) : (
          Object.entries(grouped).map(([protocolType, items]) => (
            <div key={protocolType} className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className={PROTOCOL_COLORS[protocolType] || "bg-muted text-foreground"}>
                  {protocolType}
                </Badge>
                <span className="text-xs text-muted-foreground">{items.length} template(s)</span>
              </div>

              {items.map((template) => (
                <Card
                  key={template.id}
                  className="transition-all duration-200 hover:shadow-md cursor-pointer"
                  onClick={() => setExpandedId(expandedId === template.id ? null : template.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                          {template.name}
                          {expandedId === template.id ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </CardTitle>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingTemplate(template)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(template.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  {expandedId === template.id && (
                    <CardContent className="pt-0">
                      <div className="border-t pt-3 space-y-1.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                          Itens do Protocolo ({template.items.length})
                        </p>
                        {template.items.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <span className="text-muted-foreground font-mono text-[10px] mt-0.5">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                            <span className="uppercase">{item}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <EditTherapeuticTemplateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        template={null}
      />

      {/* Edit Dialog */}
      {editingTemplate && (
        <EditTherapeuticTemplateDialog
          open={!!editingTemplate}
          onOpenChange={(open) => !open && setEditingTemplate(null)}
          template={editingTemplate}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase">Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="uppercase">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground uppercase"
              onClick={() => {
                if (deleteId) deleteTemplate.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
