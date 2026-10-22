import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Rocket, Copy, RefreshCw, CheckCircle2, XCircle, Clock, ShieldAlert, Loader2,
  Building2, Mail, Link2,
} from "lucide-react";

// Painel super-admin de implantacoes: gera o link de uso unico e revisa/aprova/reprova
// as submissoes publicas (ver ImplantacaoPublicaPage + edges implantacao-submeter /
// avaliar-implantacao). O link publico vive no dominio principal.
const PUBLIC_BASE = "https://arsen.com.br";

type ImplStatus = "convidado" | "pendente" | "aprovado" | "reprovado";

interface Impl {
  id: string;
  status: ImplStatus;
  hospital_nome: string | null;
  cnpj: string | null;
  endereco: string | null;
  contato_nome: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
  expira_em: string | null;
  criado_em: string;
  enviado_em: string | null;
  observacoes_avaliador: string | null;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  convidado: { label: "Link gerado", cls: "bg-muted text-muted-foreground border-border" },
  pendente: { label: "Pendente", cls: "bg-warning-soft text-warning-on-soft border-warning-border" },
  aprovado: { label: "Aprovado", cls: "bg-released-soft text-released-on-soft border-released-border" },
  reprovado: { label: "Recusado", cls: "bg-critical-soft text-critical-on-soft border-critical-border" },
};

const copy = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success("Copiado");
};

export default function ImplantacoesPage() {
  const { isSuperAdmin, loading } = useIsSuperAdmin();

  const [items, setItems] = useState<Impl[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // Gerar link
  const [genNome, setGenNome] = useState("");
  const [genEmail, setGenEmail] = useState("");
  const [genDias, setGenDias] = useState("7");
  const [generating, setGenerating] = useState(false);
  const [novoLink, setNovoLink] = useState<string | null>(null);

  // Avaliar
  const [target, setTarget] = useState<Impl | null>(null);
  const [decision, setDecision] = useState<"aprovar" | "reprovar" | null>(null);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState(false);

  const fetchItems = async () => {
    setListLoading(true);
    try {
      const { data, error } = await supabase
        .from("solicitacoes_implantacao")
        .select("id, status, hospital_nome, cnpj, endereco, contato_nome, contato_email, contato_telefone, expira_em, criado_em, enviado_em, observacoes_avaliador")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      setItems((data as any[] as Impl[]) || []);
    } catch (e) {
      console.error(e);
      toast.error("Nao foi possivel carregar as implantacoes.");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) fetchItems();
  }, [isSuperAdmin]);

  const counters = useMemo(() => ({
    pendente: items.filter((i) => i.status === "pendente").length,
    convidado: items.filter((i) => i.status === "convidado").length,
    aprovado: items.filter((i) => i.status === "aprovado").length,
  }), [items]);

  const gerarLink = async () => {
    setGenerating(true);
    setNovoLink(null);
    try {
      const { data, error } = await (supabase.rpc as any)("implantacao_convite_gerar", {
        p_contato_nome: genNome.trim() || null,
        p_contato_email: genEmail.trim().toLowerCase() || null,
        p_expira_dias: Math.max(1, parseInt(genDias, 10) || 7),
      });
      if (error) throw error;
      const token = (data as any)?.token;
      if (!token) throw new Error("Token nao retornado.");
      const url = `${PUBLIC_BASE}/implantacao?k=${token}`;
      setNovoLink(url);
      setGenNome("");
      setGenEmail("");
      toast.success("Link gerado.");
      fetchItems();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Falha ao gerar o link.");
    } finally {
      setGenerating(false);
    }
  };

  const openDecision = (item: Impl, type: "aprovar" | "reprovar") => {
    setTarget(item);
    setDecision(type);
    setNote("");
  };
  const close = () => { setTarget(null); setDecision(null); setNote(""); };

  const submit = async () => {
    if (!target || !decision) return;
    setActing(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Sessao expirada.");
      const res = await supabase.functions.invoke("avaliar-implantacao", {
        body: { solicitacaoId: target.id, decisao: decision, observacoes: note.trim() || undefined },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.error) {
        let msg = res.error.message || "Falha ao processar.";
        try {
          const b = (res.error as any)?.context?.body;
          if (b) { const p = typeof b === "string" ? JSON.parse(b) : b; if (p?.error) msg = p.error; }
        } catch { /* mantem */ }
        throw new Error(msg);
      }
      const data = res.data as { success?: boolean; error?: string };
      if (!data?.success) throw new Error(data?.error || "Falha ao processar.");
      toast.success(decision === "aprovar" ? "Implantacao aprovada." : "Implantacao recusada.");
      close();
      fetchItems();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao processar decisao.");
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!isSuperAdmin) {
    return (
      <MainLayout>
        <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <ShieldAlert className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Acesso restrito aa implantacao (super-admin).</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-2">
          <Rocket className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Implantacoes</h1>
        </div>

        {/* Gerar link de uso unico */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4" /> Gerar link de implantacao</CardTitle>
            <CardDescription>
              Link de uso unico para o hospital preencher o cadastro inicial. Expira e so vale uma vez.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Contato (opcional)</Label>
                <Input value={genNome} onChange={(e) => setGenNome(e.target.value)} placeholder="Nome de quem recebe" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail (opcional)</Label>
                <Input value={genEmail} onChange={(e) => setGenEmail(e.target.value)} placeholder="para sua referencia" />
              </div>
              <div className="space-y-1.5">
                <Label>Validade (dias)</Label>
                <Input value={genDias} onChange={(e) => setGenDias(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="7" />
              </div>
            </div>
            <Button onClick={gerarLink} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
              Gerar link
            </Button>
            {novoLink && (
              <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-3">
                <Input value={novoLink} readOnly className="text-xs" />
                <Button variant="outline" size="sm" onClick={() => copy(novoLink)}>
                  <Copy className="h-4 w-4 mr-1" /> Copiar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { k: "pendente", label: "Pendentes", icon: Clock },
            { k: "convidado", label: "Links ativos", icon: Link2 },
            { k: "aprovado", label: "Aprovados", icon: CheckCircle2 },
          ].map(({ k, label, icon: Icon }) => (
            <Card key={k} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="text-2xl font-semibold">{(counters as any)[k]}</p>
                </div>
                <Icon className="h-8 w-8 text-muted-foreground/40" />
              </div>
            </Card>
          ))}
        </div>

        {/* Lista */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Solicitacoes</h2>
          <Button variant="outline" size="sm" onClick={fetchItems} disabled={listLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${listLoading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">Hospital</TableHead>
                <TableHead className="text-xs font-semibold">Responsavel</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">Nenhuma implantacao ainda. Gere um link acima.</TableCell></TableRow>
              ) : (
                items.map((i) => {
                  const meta = STATUS_META[i.status] || STATUS_META.convidado;
                  return (
                    <TableRow key={i.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {i.hospital_nome || <span className="text-muted-foreground italic">aguardando preenchimento</span>}
                          </span>
                          {i.cnpj && <span className="text-xs text-muted-foreground">CNPJ {i.cnpj}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span>{i.contato_nome || "—"}</span>
                          {i.contato_email && <span className="text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {i.contato_email}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${meta.cls} gap-1`}>{meta.label}</Badge>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {format(new Date(i.enviado_em || i.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {i.status === "pendente" ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" className="text-released-on-soft border-released/30 hover:bg-released/10" onClick={() => openDecision(i, "aprovar")}>
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                            </Button>
                            <Button size="sm" variant="outline" className="text-critical-on-soft border-critical/30 hover:bg-critical/10" onClick={() => openDecision(i, "reprovar")}>
                              <XCircle className="h-4 w-4 mr-1" /> Recusar
                            </Button>
                          </div>
                        ) : i.observacoes_avaliador ? (
                          <span className="text-xs text-muted-foreground italic">"{i.observacoes_avaliador}"</span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {decision === "aprovar" ? <CheckCircle2 className="h-5 w-5 text-released-on-soft" /> : <XCircle className="h-5 w-5 text-critical-on-soft" />}
              {decision === "aprovar" ? "Aprovar implantacao" : "Recusar implantacao"}
            </DialogTitle>
            <DialogDescription>{target?.hospital_nome} • {target?.contato_email}</DialogDescription>
          </DialogHeader>
          {target && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border p-3 bg-muted/30 space-y-1 text-xs">
                <div><b>Hospital:</b> {target.hospital_nome} {target.cnpj ? `• CNPJ ${target.cnpj}` : ""}</div>
                {target.endereco && <div><b>Endereco:</b> {target.endereco}</div>}
                <div><b>Responsavel:</b> {target.contato_nome} • {target.contato_email}</div>
              </div>
              {decision === "aprovar" ? (
                <p className="text-xs text-muted-foreground">
                  Cria o hospital e o admin ligados aa conta que o responsavel ja definiu; o acesso e liberado com a senha dele.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  A conta provisoria sera removida (o e-mail fica livre de novo).
                </p>
              )}
              <div className="space-y-2">
                <Label>{decision === "aprovar" ? "Observacao (opcional)" : "Motivo da recusa (recomendado)"}</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={acting}>Cancelar</Button>
            <Button onClick={submit} disabled={acting} className={decision === "aprovar" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}>
              {acting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : decision === "aprovar" ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Confirmar {decision === "aprovar" ? "aprovacao" : "recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
