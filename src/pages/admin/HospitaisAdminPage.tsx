import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { setImpersonation, clearImpersonation } from "@/lib/impersonation";
import { Building2, Plus, Loader2, ShieldCheck, Lock, Unlock, Copy, KeyRound, LogOut, UserCog } from "lucide-react";

interface HospitalRow {
  id: string;
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  ativo: boolean;
}
interface AdminRow {
  hospital_id: string | null;
  user_id: string | null;
  nome: string;
  email: string | null;
  ativo: boolean;
}

const soDigitos = (s: string) => s.replace(/\D/g, "");
const formatCnpj = (v: string | null) => {
  const d = soDigitos(v ?? "");
  if (d.length !== 14) return v ?? "—";
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};

export default function HospitaisAdminPage() {
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novaSenha, setNovaSenha] = useState<{ email: string; senha: string } | null>(null);

  // Formulário de novo hospital
  const [form, setForm] = useState({ nome: "", cnpj: "", endereco: "", adminNome: "", adminEmail: "" });
  const setField = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Lista de hospitais + admins responsáveis (2 queries, sem depender do nome da FK)
  const { data, isLoading, error } = useQuery({
    queryKey: ["hospitais-admin"],
    queryFn: async () => {
      const [{ data: hospitais, error: hErr }, { data: admins, error: aErr }] = await Promise.all([
        supabase.from("hospitais").select("id, nome, cnpj, endereco, ativo").order("nome"),
        supabase.from("profissionais").select("hospital_id, user_id, nome, email, ativo").eq("papel", "admin"),
      ]);
      if (hErr) throw hErr;
      if (aErr) throw aErr;
      const adminByHospital = new Map<string, AdminRow>();
      for (const a of (admins ?? []) as AdminRow[]) {
        if (a.hospital_id && !adminByHospital.has(a.hospital_id)) adminByHospital.set(a.hospital_id, a);
      }
      return { hospitais: (hospitais ?? []) as HospitalRow[], adminByHospital };
    },
  });

  const criarHospital = useMutation({
    mutationFn: async () => {
      // Anexa o JWT da sessão EXPLICITAMENTE. Sem isso, o FunctionsClient do
      // supabase-js às vezes manda a anon key em vez do token do usuário logado,
      // e a Edge Function rejeita o super_admin como se não fosse.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");
      const { data: res, error: fnErr } = await supabase.functions.invoke("criar-hospital-admin", {
        body: {
          nomeHospital: form.nome.trim(),
          cnpj: soDigitos(form.cnpj),
          endereco: form.endereco.trim(),
          adminNome: form.adminNome.trim(),
          adminEmail: form.adminEmail.trim().toLowerCase(),
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      // supabase.functions.invoke devolve erro genérico em não-2xx; a mensagem real vem no corpo.
      if (fnErr) {
        const payload = (fnErr as { context?: { body?: unknown } })?.context?.body;
        const parsed = typeof payload === "string" ? (() => { try { return JSON.parse(payload); } catch { return null; } })() : payload;
        throw new Error((parsed as { error?: string } | null)?.error ?? fnErr.message);
      }
      const payload = res as { success?: boolean; error?: string; tempPassword?: string; adminEmail?: string };
      if (!payload?.success) throw new Error(payload?.error ?? "Falha ao criar hospital.");
      return payload;
    },
    onSuccess: (payload) => {
      toast({ title: "Hospital criado", description: `Admin ${payload.adminEmail} cadastrado.` });
      setNovaSenha({ email: payload.adminEmail ?? form.adminEmail, senha: payload.tempPassword ?? "" });
      setForm({ nome: "", cnpj: "", endereco: "", adminNome: "", adminEmail: "" });
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["hospitais-admin"] });
    },
    onError: (e: Error) => {
      toast({ title: "Não foi possível criar o hospital", description: e.message, variant: "destructive" });
    },
  });

  // Feature 2 (bloquear/desbloquear) — build-ahead. A RPC definir_status_hospital
  // ainda NÃO existe na instância; o cast evita erro de tipo e o erro de runtime é
  // exibido com clareza até o backend deployar a função + o trigger de guarda do `ativo`.
  const alternarStatus = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error: rpcErr } = await (supabase.rpc as unknown as (
        fn: string, args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>)("definir_status_hospital", {
        p_hospital_id: id,
        p_ativo: ativo,
      });
      if (rpcErr) throw new Error(rpcErr.message);
    },
    onSuccess: (_r, vars) => {
      toast({ title: vars.ativo ? "Hospital desbloqueado" : "Hospital bloqueado" });
      qc.invalidateQueries({ queryKey: ["hospitais-admin"] });
    },
    onError: (e: Error) => {
      toast({
        title: "Ação indisponível",
        description: `Bloqueio/desbloqueio depende da RPC definir_status_hospital (ainda não deployada). Detalhe: ${e.message}`,
        variant: "destructive",
      });
    },
  });

  // "Entrar como admin da unidade": pega um OTP via Edge Function (service_role,
  // guardada por super_admin), guarda a sessão do super_admin e troca para a do
  // admin com verifyOtp. O banner global permite voltar.
  const impersonar = useMutation({
    mutationFn: async ({ adm, hospitalNome }: { adm: AdminRow; hospitalNome: string }) => {
      if (!adm.user_id) throw new Error("Este hospital não tem admin com conta vinculada.");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");

      const { data: res, error: fnErr } = await supabase.functions.invoke("impersonar-admin", {
        body: { adminUserId: adm.user_id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (fnErr) {
        const payload = (fnErr as { context?: { body?: unknown } })?.context?.body;
        const parsed = typeof payload === "string" ? (() => { try { return JSON.parse(payload); } catch { return null; } })() : payload;
        throw new Error((parsed as { error?: string } | null)?.error ?? fnErr.message);
      }
      const { email, otp, nome } = (res ?? {}) as { email?: string; otp?: string; nome?: string };
      if (!email || !otp) throw new Error("Resposta inválida do servidor de impersonação.");

      // Guarda a sessão do super_admin ANTES de trocar (para o "Voltar").
      setImpersonation({
        origin: { access_token: session.access_token, refresh_token: session.refresh_token },
        target: { nome: nome ?? adm.nome, email, hospitalNome },
      });

      const { error: otpErr } = await supabase.auth.verifyOtp({ email, token: otp, type: "magiclink" });
      if (otpErr) {
        clearImpersonation();
        throw new Error("Falha ao entrar como admin: " + otpErr.message);
      }
    },
    onSuccess: () => {
      // Reload completo para reinicializar os contexts como o admin.
      window.location.assign("/");
    },
    onError: (e: Error) => {
      toast({ title: "Não foi possível entrar como admin", description: e.message, variant: "destructive" });
    },
  });

  // Gera uma NOVA senha provisória para o admin (quando a original não foi anotada).
  const resetarSenha = useMutation({
    mutationFn: async ({ adm }: { adm: AdminRow }) => {
      if (!adm.user_id) throw new Error("Este hospital não tem admin com conta vinculada.");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");
      const { data: res, error: fnErr } = await supabase.functions.invoke("resetar-senha-admin", {
        body: { adminUserId: adm.user_id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (fnErr) {
        const payload = (fnErr as { context?: { body?: unknown } })?.context?.body;
        const parsed = typeof payload === "string" ? (() => { try { return JSON.parse(payload); } catch { return null; } })() : payload;
        throw new Error((parsed as { error?: string } | null)?.error ?? fnErr.message);
      }
      const { email, tempPassword } = (res ?? {}) as { email?: string; tempPassword?: string };
      if (!email || !tempPassword) throw new Error("Resposta inválida do servidor.");
      return { email, tempPassword };
    },
    onSuccess: ({ email, tempPassword }) => {
      setNovaSenha({ email, senha: tempPassword });
      toast({ title: "Nova senha gerada", description: `Repasse ao admin ${email}.` });
    },
    onError: (e: Error) => {
      toast({ title: "Não foi possível gerar nova senha", description: e.message, variant: "destructive" });
    },
  });

  const formValido = useMemo(
    () => form.nome.trim() && soDigitos(form.cnpj).length === 14 && form.adminNome.trim()
      && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.adminEmail.trim()),
    [form],
  );

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Painel do Super Admin</h1>
              <p className="text-sm text-muted-foreground">Hospitais e administradores responsáveis</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => signOut()}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Novo hospital</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo hospital + admin responsável</DialogTitle>
                <DialogDescription>
                  Cria o hospital e a conta do administrador. O admin recebe uma senha provisória
                  (exibida ao final) e a troca no primeiro acesso.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do hospital *</Label>
                  <Input id="nome" value={form.nome} onChange={setField("nome")} placeholder="Hospital Municipal ..." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ *</Label>
                    <Input id="cnpj" value={form.cnpj} onChange={setField("cnpj")} placeholder="00.000.000/0000-00" inputMode="numeric" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input id="endereco" value={form.endereco} onChange={setField("endereco")} placeholder="Opcional" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="adminNome">Nome do admin *</Label>
                    <Input id="adminNome" value={form.adminNome} onChange={setField("adminNome")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminEmail">E-mail do admin *</Label>
                    <Input id="adminEmail" type="email" value={form.adminEmail} onChange={setField("adminEmail")} autoComplete="off" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={() => criarHospital.mutate()} disabled={!formValido || criarHospital.isPending}>
                  {criarHospital.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</> : "Criar hospital"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </header>

        {novaSenha && (
          <Alert>
            <KeyRound className="h-4 w-4" />
            <AlertTitle>Senha provisória do admin — copie agora</AlertTitle>
            <AlertDescription>
              <p className="mb-2">
                O e-mail de convite não é enviado nesta instância. Repasse estas credenciais ao admin{" "}
                <strong>{novaSenha.email}</strong> por um canal seguro. Ele deve trocar a senha no primeiro acesso.
              </p>
              <div className="flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 text-sm font-mono">{novaSenha.senha}</code>
                <Button size="sm" variant="outline" onClick={() => {
                  navigator.clipboard?.writeText(novaSenha.senha);
                  toast({ title: "Senha copiada" });
                }}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNovaSenha(null)}>Fechar</Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Hospitais</CardTitle>
            <CardDescription>Todos os hospitais cadastrados e seus administradores.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertTitle>Erro ao carregar hospitais</AlertTitle>
                <AlertDescription>{(error as Error).message}</AlertDescription>
              </Alert>
            ) : data && data.hospitais.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Nenhum hospital cadastrado ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hospital</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Admin responsável</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.hospitais.map((h) => {
                    const adm = data.adminByHospital.get(h.id);
                    return (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">{h.nome}</TableCell>
                        <TableCell className="font-mono text-xs">{formatCnpj(h.cnpj)}</TableCell>
                        <TableCell>
                          {h.ativo
                            ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Ativo</Badge>
                            : <Badge variant="destructive">Bloqueado</Badge>}
                        </TableCell>
                        <TableCell>
                          {adm ? (
                            <div className="leading-tight">
                              <div>{adm.nome}</div>
                              <div className="text-xs text-muted-foreground">{adm.email ?? "—"}</div>
                            </div>
                          ) : <span className="text-muted-foreground text-sm">— sem admin —</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={!adm?.user_id || impersonar.isPending}
                              title={adm?.user_id ? "Logar como o admin desta unidade" : "Sem admin vinculado"}
                              onClick={() => adm && impersonar.mutate({ adm, hospitalNome: h.nome })}
                            >
                              <UserCog className="h-3.5 w-3.5 mr-1" /> Entrar como admin
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!adm?.user_id || resetarSenha.isPending}
                              title={adm?.user_id ? "Gerar nova senha provisória do admin" : "Sem admin vinculado"}
                              onClick={() => adm && resetarSenha.mutate({ adm })}
                            >
                              <KeyRound className="h-3.5 w-3.5 mr-1" /> Nova senha
                            </Button>
                            <Button
                              size="sm"
                              variant={h.ativo ? "outline" : "default"}
                              disabled={alternarStatus.isPending}
                              onClick={() => alternarStatus.mutate({ id: h.id, ativo: !h.ativo })}
                            >
                              {h.ativo
                                ? <><Lock className="h-3.5 w-3.5 mr-1" /> Bloquear</>
                                : <><Unlock className="h-3.5 w-3.5 mr-1" /> Desbloquear</>}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
