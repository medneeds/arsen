import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import {
  Users, UserPlus, Search, RefreshCw, Loader2, Power, KeyRound, Pencil, Settings2,
  ShieldCheck, Inbox, History, MoreHorizontal,
} from "lucide-react";
import { CreateUserForm } from "@/components/users/CreateUserForm";
import { PreRegistrationApprovalsPanel } from "@/components/users/PreRegistrationApprovalsPanel";
import { UserApprovalsPanel } from "@/components/users/UserApprovalsPanel";
import { UserAuditHistoryPanel } from "@/components/users/UserAuditHistoryPanel";
import { PasswordResetRequestsPanel } from "@/components/PasswordResetRequestsPanel";
import { ResetUserPasswordDialog } from "@/components/ResetUserPasswordDialog";
import { UserPermissionsDialog } from "@/components/UserPermissionsDialog";

const PAPEIS = [
  { value: "medico", label: "Médico" },
  { value: "enfermeiro", label: "Enfermeiro" },
  { value: "tecnico", label: "Técnico" },
  { value: "coordenador", label: "Coordenador" },
  { value: "farmacia", label: "Farmácia" },
  { value: "regulador", label: "Regulador" },
  { value: "nir", label: "NIR" },
  { value: "porta", label: "Médico da porta" },
  { value: "visitante", label: "Visitante" },
];
const papelLabel = (p: string) => PAPEIS.find((x) => x.value === p)?.label ?? p;

interface Profissional {
  id: string; user_id: string | null; nome: string; email: string | null;
  papel: string; ativo: boolean; cargo: string | null; conselho: string | null; numero_conselho: string | null;
}

export function GestaoUsuarios({ hospitalId }: { hospitalId: string }) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtroPapel, setFiltroPapel] = useState<string>("all");
  const [filtroStatus, setFiltroStatus] = useState<string>("all");

  const [editando, setEditando] = useState<Profissional | null>(null);
  const [resetAlvo, setResetAlvo] = useState<Profissional | null>(null);
  const [permAlvo, setPermAlvo] = useState<Profissional | null>(null);

  const { data: equipe, isLoading, isFetching } = useQuery({
    queryKey: ["gu-equipe", hospitalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, user_id, nome, email, papel, ativo, cargo, conselho, numero_conselho")
        .eq("hospital_id", hospitalId).order("nome");
      if (error) throw error;
      return (data ?? []) as Profissional[];
    },
  });
  const invalidar = () => qc.invalidateQueries({ queryKey: ["gu-equipe", hospitalId] });

  const { data: preRegPend } = useQuery({
    queryKey: ["gu-prereg-count", hospitalId],
    queryFn: async () => {
      const { count } = await supabase
        .from("solicitacoes_pre_cadastro")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente");
      return count ?? 0;
    },
  });

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (equipe ?? []).filter((p) => {
      const okBusca = !t || p.nome.toLowerCase().includes(t) || (p.email ?? "").toLowerCase().includes(t) || (p.numero_conselho ?? "").toLowerCase().includes(t);
      const okPapel = filtroPapel === "all" || p.papel === filtroPapel;
      const okStatus = filtroStatus === "all" || (filtroStatus === "ativo" ? p.ativo : !p.ativo);
      return okBusca && okPapel && okStatus;
    });
  }, [equipe, busca, filtroPapel, filtroStatus]);

  const toggleAtivo = useMutation({
    mutationFn: async (p: Profissional) => {
      const { error } = await supabase.from("profissionais").update({ ativo: !p.ativo }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const salvarEdicao = useMutation({
    mutationFn: async (p: Profissional) => {
      const { error } = await supabase.from("profissionais").update({
        nome: p.nome.trim(), papel: p.papel as never,
        cargo: (p.cargo ?? "").trim() || null,
        conselho: (p.conselho ?? "").trim() || null,
        numero_conselho: (p.numero_conselho ?? "").trim() || null,
      }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Usuário atualizado" }); setEditando(null); invalidar(); },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <Tabs defaultValue="lista" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="lista"><Users className="h-4 w-4 mr-1.5" /> Usuários</TabsTrigger>
          <TabsTrigger value="prereg">
            <Inbox className="h-4 w-4 mr-1.5" /> Pré-cadastros
            {(preRegPend ?? 0) > 0 && <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-[10px]">{preRegPend}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="reativacoes"><ShieldCheck className="h-4 w-4 mr-1.5" /> Reativações</TabsTrigger>
          <TabsTrigger value="criar"><UserPlus className="h-4 w-4 mr-1.5" /> Cadastrar</TabsTrigger>
          <TabsTrigger value="senhas"><KeyRound className="h-4 w-4 mr-1.5" /> Senhas</TabsTrigger>
          <TabsTrigger value="historico"><History className="h-4 w-4 mr-1.5" /> Histórico</TabsTrigger>
        </TabsList>

        {/* ===== LISTA ===== */}
        <TabsContent value="lista" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, e-mail ou conselho..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
            </div>
            <Select value={filtroPapel} onValueChange={setFiltroPapel}>
              <SelectTrigger className="md:w-44"><SelectValue placeholder="Papel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os papéis</SelectItem>
                {PAPEIS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="md:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={invalidar} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...</div>
              ) : filtrados.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
              ) : (
                <div className="divide-y">
                  {filtrados.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium text-sm">
                          {p.nome}
                          <Badge variant="outline" className="text-[10px]">{papelLabel(p.papel)}</Badge>
                          {!p.ativo && <Badge variant="destructive" className="text-[10px]">Inativo</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {p.email}{p.conselho ? ` · ${p.conselho} ${p.numero_conselho ?? ""}` : ""}{p.cargo ? ` · ${p.cargo}` : ""}
                        </div>
                      </div>
                      {p.papel !== "admin" && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button size="sm" variant="outline" disabled={toggleAtivo.isPending} onClick={() => toggleAtivo.mutate(p)}>
                            <Power className="h-3.5 w-3.5 mr-1" /> {p.ativo ? "Desativar" : "Ativar"}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel className="truncate">{p.nome}</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setEditando(p)}>
                                <Pencil className="h-4 w-4 mr-2" /> Editar dados
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPermAlvo(p)}>
                                <Settings2 className="h-4 w-4 mr-2" /> Papel e setores
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-amber-700 focus:text-amber-700" disabled={!p.user_id} onClick={() => setResetAlvo(p)}>
                                <KeyRound className="h-4 w-4 mr-2" /> Redefinir senha
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prereg"><PreRegistrationApprovalsPanel hospitalId={hospitalId} /></TabsContent>
        <TabsContent value="reativacoes"><UserApprovalsPanel /></TabsContent>
        <TabsContent value="criar">
          <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-5 w-5" /> Cadastrar usuário</CardTitle>
            <CardDescription>Cria a conta e vincula ao seu hospital. Uma senha provisória é exibida ao final.</CardDescription></CardHeader>
            <CardContent><CreateUserForm onCreated={invalidar} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="senhas"><PasswordResetRequestsPanel hospitalId={hospitalId} /></TabsContent>
        <TabsContent value="historico"><UserAuditHistoryPanel hospitalId={hospitalId} /></TabsContent>
      </Tabs>

      {/* Editar dados */}
      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>O e-mail de acesso não pode ser alterado aqui.</DialogDescription>
          </DialogHeader>
          {editando && (
            <div className="space-y-3 py-2">
              <div className="space-y-2"><Label>Nome *</Label><Input value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} /></div>
              <div className="space-y-2"><Label>E-mail</Label><Input value={editando.email ?? ""} disabled /></div>
              <div className="space-y-2"><Label>Papel *</Label>
                <Select value={editando.papel} onValueChange={(v) => setEditando({ ...editando, papel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAPEIS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Conselho</Label><Input value={editando.conselho ?? ""} onChange={(e) => setEditando({ ...editando, conselho: e.target.value })} placeholder="CRM, COREN..." /></div>
                <div className="space-y-2"><Label>Nº do conselho</Label><Input value={editando.numero_conselho ?? ""} onChange={(e) => setEditando({ ...editando, numero_conselho: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Cargo</Label><Input value={editando.cargo ?? ""} onChange={(e) => setEditando({ ...editando, cargo: e.target.value })} placeholder="Opcional" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button disabled={!editando?.nome.trim() || salvarEdicao.isPending} onClick={() => editando && salvarEdicao.mutate(editando)}>
              {salvarEdicao.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {resetAlvo && (
        <ResetUserPasswordDialog
          open={!!resetAlvo}
          onOpenChange={(o) => !o && setResetAlvo(null)}
          profissionalId={resetAlvo.id}
          userName={resetAlvo.nome}
          userEmail={resetAlvo.email ?? ""}
          onSuccess={invalidar}
        />
      )}

      {permAlvo && (
        <UserPermissionsDialog
          open={!!permAlvo}
          onOpenChange={(o) => !o && setPermAlvo(null)}
          profissionalId={permAlvo.id}
          userId={permAlvo.user_id}
          userName={permAlvo.nome}
          userEmail={permAlvo.email ?? ""}
          currentRole={permAlvo.papel}
          hospitalId={hospitalId}
          onSaved={invalidar}
        />
      )}
    </div>
  );
}

export default GestaoUsuarios;
