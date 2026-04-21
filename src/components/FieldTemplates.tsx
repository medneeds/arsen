import React, { useMemo, useState } from "react";
import { BookmarkPlus, Bookmark, Plus, Trash2, FilePlus2, Replace, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFieldTemplates, type FieldTemplate } from "@/hooks/useFieldTemplates";
import { getSeedsForScope, type SeedTemplate } from "@/data/fieldTemplateSeeds";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldTemplatesProps {
  /** Identificador único do campo (ex: "evolution.subjective"). */
  scope: string;
  /** Valor atual do campo — usado para "Salvar atual como modelo" e para ANEXAR vs SUBSTITUIR. */
  currentValue: string;
  /** Aplica o conteúdo do modelo no campo. */
  onApply: (next: string) => void;
  /** Tamanho compacto (ícone) ou padrão. */
  compact?: boolean;
  /** Rótulo exibido no botão (default "Modelos"). */
  label?: string;
  /** Hospital atual (para compartilhamento). */
  hospitalUnitId?: string | null;
  className?: string;
}

export const FieldTemplates: React.FC<FieldTemplatesProps> = ({
  scope, currentValue, onApply, compact = true, label = "Modelos",
  hospitalUnitId = null, className,
}) => {
  const { templates, create, remove, touch } = useFieldTemplates(scope);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"insert" | "create">("insert");
  const [newName, setNewName] = useState("");
  const [newBody, setNewBody] = useState("");
  const [isShared, setIsShared] = useState(false);

  const ordered = useMemo(() => templates, [templates]);
  const seeds = useMemo(() => getSeedsForScope(scope), [scope]);
  const totalCount = ordered.length + seeds.length;

  const apply = (t: FieldTemplate, mode: "replace" | "append") => {
    const next = mode === "append" && currentValue.trim()
      ? `${currentValue.trim()}\n${t.body}`
      : t.body;
    onApply(next);
    touch.mutate(t);
    setOpen(false);
  };

  const applySeed = (s: SeedTemplate, mode: "replace" | "append") => {
    const next = mode === "append" && currentValue.trim()
      ? `${currentValue.trim()}\n${s.body}`
      : s.body;
    onApply(next);
    setOpen(false);
  };

  const saveCurrentAsTemplate = () => {
    setNewBody(currentValue);
    setNewName("");
    setTab("create");
  };

  const submitCreate = async () => {
    if (!newName.trim() || !newBody.trim()) return;
    await create.mutateAsync({
      name: newName, body: newBody, is_shared: isShared, hospital_unit_id: hospitalUnitId,
    });
    setNewName(""); setNewBody(""); setIsShared(false);
    setTab("insert");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60",
            compact ? "h-6 px-1.5" : "h-7 px-2",
            className,
          )}
          title="Modelos rápidos para este campo"
        >
          <Bookmark className="h-3 w-3" />
          {!compact && <span>{label}</span>}
          {totalCount > 0 && (
            <Badge variant="secondary" className="h-3.5 px-1 text-[9px] leading-none">
              {totalCount}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <div className="flex items-center justify-between border-b px-2 py-1.5">
            <TabsList className="h-7 bg-transparent p-0 gap-1">
              <TabsTrigger value="insert" className="h-6 px-2 text-[11px] data-[state=active]:bg-muted">
                Inserir ({totalCount})
              </TabsTrigger>
              <TabsTrigger value="create" className="h-6 px-2 text-[11px] data-[state=active]:bg-muted">
                <Plus className="h-3 w-3 mr-0.5" /> Novo
              </TabsTrigger>
            </TabsList>
            {currentValue.trim() && tab === "insert" && (
              <Button
                size="sm" variant="ghost"
                className="h-6 px-1.5 text-[10px] gap-1"
                onClick={saveCurrentAsTemplate}
                title="Salvar texto atual como modelo"
              >
                <BookmarkPlus className="h-3 w-3" /> Salvar atual
              </Button>
            )}
          </div>

          <TabsContent value="insert" className="m-0">
            {ordered.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <FilePlus2 className="h-6 w-6 mx-auto text-muted-foreground/40 mb-1.5" />
                <p className="text-[11px] text-muted-foreground">Nenhum modelo neste campo.</p>
                <Button
                  size="sm" variant="link"
                  className="text-[11px] h-6 px-1 mt-1"
                  onClick={() => setTab("create")}
                >
                  Criar o primeiro modelo
                </Button>
              </div>
            ) : (
              <ScrollArea className="max-h-[280px]">
                <div className="divide-y">
                  {ordered.map(t => (
                    <div key={t.id} className="px-2 py-1.5 hover:bg-muted/40 group">
                      <div className="flex items-start gap-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-foreground truncate">{t.name}</span>
                            {t.is_shared && (
                              <Badge variant="outline" className="h-3.5 px-1 text-[8px]">compartilhado</Badge>
                            )}
                            {t.use_count > 0 && (
                              <span className="text-[9px] text-muted-foreground ml-auto">
                                usado {t.use_count}×
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 whitespace-pre-wrap">
                            {t.body}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Button
                              size="sm" variant="secondary"
                              className="h-5 px-1.5 text-[10px] gap-1"
                              onClick={() => apply(t, "replace")}
                              title="Substituir conteúdo do campo"
                            >
                              <Replace className="h-2.5 w-2.5" /> Substituir
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              className="h-5 px-1.5 text-[10px] gap-1"
                              onClick={() => apply(t, "append")}
                              title="Anexar ao texto atual"
                              disabled={!currentValue.trim()}
                            >
                              <Plus className="h-2.5 w-2.5" /> Anexar
                            </Button>
                          </div>
                        </div>
                        <Button
                          size="sm" variant="ghost"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          onClick={() => remove.mutate(t.id)}
                          title="Excluir modelo"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="create" className="m-0 p-2.5 space-y-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Nome do modelo</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Ex.: Paciente estável, sem queixas"
                className="h-7 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Conteúdo</Label>
              <Textarea
                value={newBody}
                onChange={e => setNewBody(e.target.value)}
                placeholder="Texto que será inserido no campo..."
                className="min-h-[100px] text-xs"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Switch checked={isShared} onCheckedChange={setIsShared} id="shared-toggle" />
                <Label htmlFor="shared-toggle" className="text-[10px] text-muted-foreground cursor-pointer">
                  Compartilhar com a equipe
                </Label>
              </div>
              <Button
                size="sm"
                className="h-6 px-2 text-[10px] gap-1"
                onClick={submitCreate}
                disabled={!newName.trim() || !newBody.trim() || create.isPending}
              >
                <BookmarkPlus className="h-3 w-3" /> Salvar
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};
