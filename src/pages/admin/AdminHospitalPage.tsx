import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/MainLayout";
import { GestaoUsuarios } from "@/components/admin/GestaoUsuarios";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import {
  Building2, LogOut, Plus, Trash2, Loader2, Layers, DoorOpen, Bed, Palette, Save,
  Users, UserPlus, Copy, Power, KeyRound, Pencil, ClipboardCheck, UserCheck, XCircle,
} from "lucide-react";

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

// Rótulos dos perfis de acesso do formulário público de pré-cadastro.
const PERFIL_ACESSO_LABEL: Record<string, string> = {
  medico: "Médico", gestor: "Gestor", farmacia: "Farmácia", ccih: "CCIH", nir: "NIR",
  imagem: "Imagem", laboratorio: "Laboratório", administrativo: "Administrativo", multi: "Multiprofissional",
  coord_medico: "Coord. Médico", coord_enfermagem: "Coord. Enfermagem", coord_multi: "Coord. Multi", qualidade: "Qualidade",
};
const perfilAcessoLabel = (p: string) => PERFIL_ACESSO_LABEL[p] ?? p;
// Dica de papel do sistema a partir do perfil pretendido (o admin confirma/ajusta).
const PERFIL_TO_PAPEL: Record<string, string> = {
  medico: "medico", ccih: "enfermeiro", nir: "nir", farmacia: "farmacia",
  imagem: "tecnico", laboratorio: "tecnico", administrativo: "visitante", multi: "visitante", qualidade: "coordenador",
  gestor: "coordenador", coord_medico: "coordenador", coord_enfermagem: "coordenador", coord_multi: "coordenador",
};
const papelSugerido = (perfil: string) => PERFIL_TO_PAPEL[perfil] ?? "medico";

// Vocabulário travado pelas CHECK constraints do banco.
const SETOR_TIPOS = [
  { value: "triagem", label: "Triagem" },
  { value: "clinico", label: "Clínico" },
  { value: "cirurgico", label: "Cirúrgico" },
];
const LEITO_TIPOS = [
  { value: "leito", label: "Leito" },
  { value: "maca", label: "Maca" },
];
const LEITO_STATUS = [
  { value: "livre", label: "Livre" },
  { value: "ocupado", label: "Ocupado" },
  { value: "higienizacao", label: "Higienização" },
  { value: "bloqueado", label: "Bloqueado" },
  { value: "reservado", label: "Reservado" },
];
const statusVariant: Record<string, string> = {
  livre: "bg-emerald-600", ocupado: "bg-red-600", higienizacao: "bg-amber-500",
  bloqueado: "bg-slate-500", reservado: "bg-blue-600",
};

interface Hospital { id: string; nome: string; cnpj: string | null; endereco: string | null; }
interface Ala { id: string; hospital_id: string; nome: string; descricao: string | null; ativo: boolean; }
interface Setor { id: string; ala_id: string; nome: string; tipo: string; ativo: boolean; }
interface Leito { id: string; setor_id: string; numero: string; tipo: string; status: string; }
interface Branding {
  id?: string; hospital_id: string; sigla: string; slogan: string | null; logo_url: string | null;
  cor_primaria: string | null; cor_secundaria: string | null; cor_destaque: string | null;
}

export default function AdminHospitalPage() {
  const qc = useQueryClient();
  const { signOut } = useAuth();
  // Aba ativa vem da URL (?tab=) — a navegação agora fica na barra lateral.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "estrutura";

  // Hospital do admin (RLS já restringe hospitais ao hospital dele).
  const { data: hospital, isLoading: loadingHosp, error: hospErr } = useQuery({
    queryKey: ["admin-hospital"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hospitais").select("id, nome, cnpj, endereco").limit(1).maybeSingle();
      if (error) throw error;
      return data as Hospital | null;
    },
  });
  const hid = hospital?.id;

  // Estrutura física (3 queries; RLS restringe setores/leitos ao hospital do admin).
  const { data: estrutura, isLoading: loadingEstr } = useQuery({
    queryKey: ["admin-estrutura", hid],
    enabled: !!hid,
    queryFn: async () => {
      const [{ data: alas, error: ea }, { data: setores, error: es }, { data: leitos, error: el }] = await Promise.all([
        supabase.from("alas").select("id, hospital_id, nome, descricao, ativo").eq("hospital_id", hid).order("nome"),
        supabase.from("setores").select("id, ala_id, nome, tipo, ativo").order("nome"),
        supabase.from("leitos").select("id, setor_id, numero, tipo, status").order("numero"),
      ]);
      if (ea || es || el) throw ea || es || el;
      return { alas: (alas ?? []) as Ala[], setores: (setores ?? []) as Setor[], leitos: (leitos ?? []) as Leito[] };
    },
  });

  const setoresByAla = useMemo(() => {
    const m = new Map<string, Setor[]>();
    for (const s of estrutura?.setores ?? []) { (m.get(s.ala_id) ?? m.set(s.ala_id, []).get(s.ala_id)!).push(s); }
    return m;
  }, [estrutura]);
  const leitosBySetor = useMemo(() => {
    const m = new Map<string, Leito[]>();
    for (const l of estrutura?.leitos ?? []) { (m.get(l.setor_id) ?? m.set(l.setor_id, []).get(l.setor_id)!).push(l); }
    return m;
  }, [estrutura]);

  const invalidarEstrutura = () => qc.invalidateQueries({ queryKey: ["admin-estrutura", hid] });
  const erro = (e: unknown) => toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });

  const addAla = useMutation({
    mutationFn: async (v: { nome: string; descricao: string }) => {
      const { error } = await supabase.from("alas").insert({ hospital_id: hid, nome: v.nome, descricao: v.descricao || null });
      if (error) throw error;
    },
    onSuccess: invalidarEstrutura, onError: erro,
  });
  const delAla = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("alas").delete().eq("id", id); if (error) throw error; },
    onSuccess: invalidarEstrutura, onError: erro,
  });
  const addSetor = useMutation({
    mutationFn: async (v: { ala_id: string; nome: string; tipo: string }) => {
      const { error } = await supabase.from("setores").insert({ ala_id: v.ala_id, nome: v.nome, tipo: v.tipo });
      if (error) throw error;
    },
    onSuccess: invalidarEstrutura, onError: erro,
  });
  const delSetor = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("setores").delete().eq("id", id); if (error) throw error; },
    onSuccess: invalidarEstrutura, onError: erro,
  });
  const addLeito = useMutation({
    mutationFn: async (v: { setor_id: string; numero: string; tipo: string; status: string }) => {
      const { error } = await supabase.from("leitos").insert({ setor_id: v.setor_id, numero: v.numero, tipo: v.tipo, status: v.status });
      if (error) throw error;
    },
    onSuccess: invalidarEstrutura, onError: erro,
  });
  const delLeito = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("leitos").delete().eq("id", id); if (error) throw error; },
    onSuccess: invalidarEstrutura, onError: erro,
  });

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Painel Administrativo</h1>
              <p className="text-sm text-muted-foreground">{hospital?.nome ?? "Gestão do hospital"}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => signOut()}><LogOut className="h-4 w-4 mr-2" /> Sair</Button>
        </header>

        {loadingHosp ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...</div>
        ) : hospErr || !hospital ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            Não foi possível carregar seu hospital. {(hospErr as Error)?.message ?? ""}
          </CardContent></Card>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
            {/* Navegação migrada para a barra lateral (por papel). TabsList oculto. */}

            {/* ===================== ESTRUTURA ===================== */}
            <TabsContent value="estrutura" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Nova ala</CardTitle>
                  <CardDescription>Alas agrupam os setores do hospital.</CardDescription>
                </CardHeader>
                <CardContent>
                  <AddAlaForm pending={addAla.isPending} onAdd={(v) => addAla.mutate(v)} />
                </CardContent>
              </Card>

              {loadingEstr ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando estrutura...</div>
              ) : (estrutura?.alas.length ?? 0) === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma ala cadastrada ainda.</p>
              ) : (
                estrutura!.alas.map((ala) => (
                  <Card key={ala.id}>
                    <CardHeader className="flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4" /> {ala.nome}</CardTitle>
                        {ala.descricao && <CardDescription>{ala.descricao}</CardDescription>}
                      </div>
                      <Button size="sm" variant="ghost" className="text-red-600" disabled={delAla.isPending}
                        onClick={() => { if (confirm(`Excluir a ala "${ala.nome}" e tudo dentro dela?`)) delAla.mutate(ala.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <AddSetorForm pending={addSetor.isPending} onAdd={(v) => addSetor.mutate({ ala_id: ala.id, ...v })} />
                      {(setoresByAla.get(ala.id) ?? []).map((setor) => (
                        <div key={setor.id} className="rounded-lg border p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-medium text-sm">
                              <DoorOpen className="h-4 w-4 text-muted-foreground" /> {setor.nome}
                              <Badge variant="outline" className="text-[10px]">{SETOR_TIPOS.find(t => t.value === setor.tipo)?.label ?? setor.tipo}</Badge>
                            </div>
                            <Button size="sm" variant="ghost" className="text-red-600 h-7 w-7 p-0" disabled={delSetor.isPending}
                              onClick={() => { if (confirm(`Excluir o setor "${setor.nome}"?`)) delSetor.mutate(setor.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(leitosBySetor.get(setor.id) ?? []).map((leito) => (
                              <span key={leito.id} className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs">
                                <Bed className="h-3 w-3" /> {leito.numero}
                                <span className={`h-2 w-2 rounded-full ${statusVariant[leito.status] ?? "bg-slate-400"}`} title={leito.status} />
                                <button className="text-red-500 hover:text-red-700" title="Excluir leito"
                                  onClick={() => delLeito.mutate(leito.id)}>×</button>
                              </span>
                            ))}
                            {(leitosBySetor.get(setor.id) ?? []).length === 0 && <span className="text-xs text-muted-foreground">Sem leitos.</span>}
                          </div>
                          <AddLeitoForm pending={addLeito.isPending} onAdd={(v) => addLeito.mutate({ setor_id: setor.id, ...v })} />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* ===================== USUÁRIOS ===================== */}
            <TabsContent value="equipe">
              <GestaoUsuarios hospitalId={hospital.id} />
            </TabsContent>

            {/* ===================== HOSPITAL ===================== */}
            <TabsContent value="hospital">
              <HospitalForm hospital={hospital} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-hospital"] })} />
            </TabsContent>

            {/* ===================== BRANDING ===================== */}
            <TabsContent value="branding">
              <BrandingForm hospitalId={hospital.id} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}

// ---------- formulários de adição ----------
function AddAlaForm({ onAdd, pending }: { onAdd: (v: { nome: string; descricao: string }) => void; pending: boolean }) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Input placeholder="Nome da ala (ex.: Ala A)" value={nome} onChange={(e) => setNome(e.target.value)} />
      <Input placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      <Button disabled={!nome.trim() || pending} onClick={() => { onAdd({ nome: nome.trim(), descricao: descricao.trim() }); setNome(""); setDescricao(""); }}>
        <Plus className="h-4 w-4 mr-1" /> Adicionar
      </Button>
    </div>
  );
}

function AddSetorForm({ onAdd, pending }: { onAdd: (v: { nome: string; tipo: string }) => void; pending: boolean }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("clinico");
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Input placeholder="Novo setor" value={nome} onChange={(e) => setNome(e.target.value)} className="sm:max-w-xs" />
      <Select value={tipo} onValueChange={setTipo}>
        <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
        <SelectContent>{SETOR_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="sm" variant="secondary" disabled={!nome.trim() || pending} onClick={() => { onAdd({ nome: nome.trim(), tipo }); setNome(""); }}>
        <Plus className="h-4 w-4 mr-1" /> Setor
      </Button>
    </div>
  );
}

function AddLeitoForm({ onAdd, pending }: { onAdd: (v: { numero: string; tipo: string; status: string }) => void; pending: boolean }) {
  const [numero, setNumero] = useState("");
  const [tipo, setTipo] = useState("leito");
  const [status, setStatus] = useState("livre");
  return (
    <div className="flex flex-col sm:flex-row gap-2 pt-1">
      <Input placeholder="Nº do leito" value={numero} onChange={(e) => setNumero(e.target.value)} className="sm:w-32" />
      <Select value={tipo} onValueChange={setTipo}>
        <SelectTrigger className="sm:w-28"><SelectValue /></SelectTrigger>
        <SelectContent>{LEITO_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
        <SelectContent>{LEITO_STATUS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="sm" variant="outline" disabled={!numero.trim() || pending} onClick={() => { onAdd({ numero: numero.trim(), tipo, status }); setNumero(""); }}>
        <Plus className="h-4 w-4 mr-1" /> Leito
      </Button>
    </div>
  );
}

// ---------- dados do hospital ----------
function HospitalForm({ hospital, onSaved }: { hospital: Hospital; onSaved: () => void }) {
  const [nome, setNome] = useState(hospital.nome);
  const [cnpj, setCnpj] = useState(hospital.cnpj ?? "");
  const [endereco, setEndereco] = useState(hospital.endereco ?? "");
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hospitais").update({ nome: nome.trim(), cnpj: cnpj.trim() || null, endereco: endereco.trim() || null }).eq("id", hospital.id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Hospital atualizado" }); onSaved(); },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Dados do hospital</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="space-y-2"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="space-y-2"><Label>CNPJ</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></div>
        <div className="space-y-2"><Label>Endereço</Label><Input value={endereco} onChange={(e) => setEndereco(e.target.value)} /></div>
        <Button disabled={!nome.trim() || salvar.isPending} onClick={() => salvar.mutate()}>
          {salvar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------- identidade visual ----------
function BrandingForm({ hospitalId }: { hospitalId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-branding", hospitalId],
    queryFn: async () => {
      const { data, error } = await supabase.from("identidade_visual_hospital").select("*").eq("hospital_id", hospitalId).maybeSingle();
      if (error) throw error;
      return data as Branding | null;
    },
  });
  const [form, setForm] = useState<Branding>({ hospital_id: hospitalId, sigla: "", slogan: "", logo_url: "", cor_primaria: "", cor_secundaria: "", cor_destaque: "" });
  useEffect(() => { if (data) setForm({ ...data, slogan: data.slogan ?? "", logo_url: data.logo_url ?? "", cor_primaria: data.cor_primaria ?? "", cor_secundaria: data.cor_secundaria ?? "", cor_destaque: data.cor_destaque ?? "" }); }, [data]);
  const set = (k: keyof Branding) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        hospital_id: hospitalId, sigla: form.sigla.trim(),
        slogan: form.slogan || null, logo_url: form.logo_url || null,
        cor_primaria: form.cor_primaria || null, cor_secundaria: form.cor_secundaria || null, cor_destaque: form.cor_destaque || null,
      };
      if (data?.id) {
        const { error } = await supabase.from("identidade_visual_hospital").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("identidade_visual_hospital").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast({ title: "Identidade visual salva" }); qc.invalidateQueries({ queryKey: ["admin-branding", hospitalId] }); },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Identidade visual</CardTitle>
        <CardDescription>Upload de arquivo de logo ainda não disponível (sem bucket de storage) — informe a URL da logo por enquanto.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="space-y-2"><Label>Sigla *</Label><Input value={form.sigla} onChange={set("sigla")} placeholder="ex.: HMDM" /></div>
        <div className="space-y-2"><Label>Slogan</Label><Input value={form.slogan ?? ""} onChange={set("slogan")} /></div>
        <div className="space-y-2"><Label>URL da logo</Label><Input value={form.logo_url ?? ""} onChange={set("logo_url")} placeholder="https://..." /></div>
        {form.logo_url ? <img src={form.logo_url} alt="logo" className="h-16 rounded border object-contain bg-white p-1" /> : null}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2"><Label>Cor primária</Label><Input type="color" value={form.cor_primaria || "#000000"} onChange={set("cor_primaria")} className="h-10 p-1" /></div>
          <div className="space-y-2"><Label>Secundária</Label><Input type="color" value={form.cor_secundaria || "#000000"} onChange={set("cor_secundaria")} className="h-10 p-1" /></div>
          <div className="space-y-2"><Label>Destaque</Label><Input type="color" value={form.cor_destaque || "#000000"} onChange={set("cor_destaque")} className="h-10 p-1" /></div>
        </div>
        <Button disabled={!form.sigla.trim() || salvar.isPending} onClick={() => salvar.mutate()}>
          {salvar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------- equipe (profissionais) ----------
interface Profissional {
  id: string; user_id: string | null; nome: string; email: string | null;
  papel: string; ativo: boolean; cargo: string | null; conselho: string | null; numero_conselho: string | null;
}

interface Solicitacao {
  id: string; nome_completo: string; email: string; cpf: string; telefone: string;
  crm: string | null; perfil_acesso: string; justificativa: string | null; criado_em: string;
}

function EquipeTab({ hospitalId }: { hospitalId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novaSenha, setNovaSenha] = useState<{ email: string; senha: string } | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", papel: "medico", conselho: "", numeroConselho: "", cargo: "" });
  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const { data: equipe, isLoading } = useQuery({
    queryKey: ["admin-equipe", hospitalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, user_id, nome, email, papel, ativo, cargo, conselho, numero_conselho")
        .eq("hospital_id", hospitalId).order("nome");
      if (error) throw error;
      return (data ?? []) as Profissional[];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");
      const { data: res, error } = await supabase.functions.invoke("criar-profissional", {
        body: {
          nome: form.nome.trim(), email: form.email.trim().toLowerCase(), papel: form.papel,
          conselho: form.conselho.trim(), numeroConselho: form.numeroConselho.trim(), cargo: form.cargo.trim(),
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        const payload = (error as { context?: { body?: unknown } })?.context?.body;
        const parsed = typeof payload === "string" ? (() => { try { return JSON.parse(payload); } catch { return null; } })() : payload;
        throw new Error((parsed as { error?: string } | null)?.error ?? error.message);
      }
      const p = res as { success?: boolean; error?: string; tempPassword?: string; email?: string };
      if (!p?.success) throw new Error(p?.error ?? "Falha ao criar profissional.");
      return p;
    },
    onSuccess: (p) => {
      toast({ title: "Profissional criado", description: p.email });
      setNovaSenha({ email: p.email ?? form.email, senha: p.tempPassword ?? "" });
      setForm({ nome: "", email: "", papel: "medico", conselho: "", numeroConselho: "", cargo: "" });
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-equipe", hospitalId] });
    },
    onError: (e: Error) => toast({ title: "Não foi possível criar", description: e.message, variant: "destructive" }),
  });

  const toggleAtivo = useMutation({
    mutationFn: async (p: Profissional) => {
      const { error } = await supabase.from("profissionais").update({ ativo: !p.ativo }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-equipe", hospitalId] }),
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Edição de um profissional existente (papel/cargo/conselho). RLS: admin tem ALL.
  const [editando, setEditando] = useState<Profissional | null>(null);
  const salvarEdicao = useMutation({
    mutationFn: async (p: Profissional) => {
      const { error } = await supabase.from("profissionais").update({
        nome: p.nome.trim(),
        papel: p.papel as never,
        cargo: (p.cargo ?? "").trim() || null,
        conselho: (p.conselho ?? "").trim() || null,
        numero_conselho: (p.numero_conselho ?? "").trim() || null,
      }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Usuário atualizado" });
      setEditando(null);
      qc.invalidateQueries({ queryKey: ["admin-equipe", hospitalId] });
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  // Redefinir senha provisória de um profissional da equipe (edge function).
  const resetarSenha = useMutation({
    mutationFn: async (p: Profissional) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");
      const { data: res, error } = await supabase.functions.invoke("resetar-senha-profissional", {
        body: { profissionalId: p.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        const payload = (error as { context?: { body?: unknown } })?.context?.body;
        const parsed = typeof payload === "string" ? (() => { try { return JSON.parse(payload); } catch { return null; } })() : payload;
        throw new Error((parsed as { error?: string } | null)?.error ?? error.message);
      }
      const r = res as { tempPassword?: string; email?: string; error?: string };
      if (!r?.tempPassword) throw new Error(r?.error ?? "Falha ao redefinir senha.");
      return { email: r.email ?? p.email ?? "", senha: r.tempPassword };
    },
    onSuccess: (r) => { toast({ title: "Nova senha gerada" }); setNovaSenha(r); },
    onError: (e: Error) => toast({ title: "Não foi possível redefinir", description: e.message, variant: "destructive" }),
  });

  // ---- Solicitações de acesso (pré-cadastro) pendentes ----
  // RLS restringe as solicitações ao hospital do admin automaticamente.
  const { data: solicitacoes, isLoading: loadingSolic } = useQuery({
    queryKey: ["admin-precadastros", hospitalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitacoes_pre_cadastro")
        .select("id, nome_completo, email, cpf, telefone, crm, perfil_acesso, justificativa, criado_em")
        .eq("status", "pendente").order("criado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Solicitacao[];
    },
  });
  const invalidarSolic = () => qc.invalidateQueries({ queryKey: ["admin-precadastros", hospitalId] });

  const [aprovando, setAprovando] = useState<Solicitacao | null>(null);
  const [papelAprov, setPapelAprov] = useState("medico");
  const [cargoAprov, setCargoAprov] = useState("");
  const [recusando, setRecusando] = useState<Solicitacao | null>(null);
  const [motivo, setMotivo] = useState("");

  const abrirAprovar = (s: Solicitacao) => { setAprovando(s); setPapelAprov(papelSugerido(s.perfil_acesso)); setCargoAprov(""); };

  const aprovar = useMutation({
    mutationFn: async () => {
      if (!aprovando) throw new Error("Solicitação inválida.");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");
      const { data: res, error } = await supabase.functions.invoke("aprovar-pre-cadastro", {
        body: { solicitacaoId: aprovando.id, papel: papelAprov, cargo: cargoAprov.trim() },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        const payload = (error as { context?: { body?: unknown } })?.context?.body;
        const parsed = typeof payload === "string" ? (() => { try { return JSON.parse(payload); } catch { return null; } })() : payload;
        throw new Error((parsed as { error?: string } | null)?.error ?? error.message);
      }
      const p = res as { success?: boolean; error?: string; tempPassword?: string; email?: string; aviso?: string };
      if (!p?.success) throw new Error(p?.error ?? "Falha ao aprovar.");
      return p;
    },
    onSuccess: (p) => {
      if (p.aviso) toast({ title: "Aprovado com aviso", description: p.aviso });
      else toast({ title: "Cadastro aprovado", description: p.email });
      setNovaSenha({ email: p.email ?? aprovando?.email ?? "", senha: p.tempPassword ?? "" });
      setAprovando(null);
      invalidarSolic();
      qc.invalidateQueries({ queryKey: ["admin-equipe", hospitalId] });
    },
    onError: (e: Error) => toast({ title: "Não foi possível aprovar", description: e.message, variant: "destructive" }),
  });

  const recusar = useMutation({
    mutationFn: async () => {
      if (!recusando) throw new Error("Solicitação inválida.");
      const { error } = await supabase.from("solicitacoes_pre_cadastro").update({
        status: "reprovado", observacoes_avaliador: motivo.trim() || null,
        avaliado_por: user?.id ?? null, avaliado_em: new Date().toISOString(),
      }).eq("id", recusando.id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Cadastro recusado" }); setRecusando(null); setMotivo(""); invalidarSolic(); },
    onError: (e: Error) => toast({ title: "Erro ao recusar", description: e.message, variant: "destructive" }),
  });

  const formOk = form.nome.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()) && !!form.papel;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><UserPlus className="h-4 w-4 mr-2" /> Novo profissional</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo profissional</DialogTitle>
              <DialogDescription>Cria a conta e vincula ao seu hospital. Uma senha provisória é exibida ao final.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={setF("nome")} /></div>
              <div className="space-y-2"><Label>E-mail *</Label><Input type="email" value={form.email} onChange={setF("email")} autoComplete="off" /></div>
              <div className="space-y-2"><Label>Papel *</Label>
                <Select value={form.papel} onValueChange={(v) => setForm((f) => ({ ...f, papel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAPEIS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Conselho</Label><Input value={form.conselho} onChange={setF("conselho")} placeholder="CRM, COREN..." /></div>
                <div className="space-y-2"><Label>Nº do conselho</Label><Input value={form.numeroConselho} onChange={setF("numeroConselho")} /></div>
              </div>
              <div className="space-y-2"><Label>Cargo</Label><Input value={form.cargo} onChange={setF("cargo")} placeholder="Opcional" /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button disabled={!formOk || criar.isPending} onClick={() => criar.mutate()}>
                {criar.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</> : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {novaSenha && (
        <Alert>
          <KeyRound className="h-4 w-4" />
          <AlertTitle>Senha provisória — copie agora</AlertTitle>
          <AlertDescription>
            <p className="mb-2">Repasse ao profissional <strong>{novaSenha.email}</strong> (ele troca no primeiro acesso).</p>
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 text-sm font-mono">{novaSenha.senha}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(novaSenha.senha); toast({ title: "Copiado" }); }}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNovaSenha(null)}>Fechar</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Solicitações de acesso (pré-cadastro público) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" /> Solicitações de acesso
            {(solicitacoes?.length ?? 0) > 0 && <Badge variant="destructive" className="ml-1">{solicitacoes!.length}</Badge>}
          </CardTitle>
          <CardDescription>Pré-cadastros públicos aguardando sua autorização.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSolic ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...</div>
          ) : (solicitacoes?.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
          ) : (
            <div className="divide-y">
              {solicitacoes!.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium text-sm">
                      {s.nome_completo}
                      <Badge variant="outline" className="text-[10px]">{perfilAcessoLabel(s.perfil_acesso)}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.email} · {s.telefone}{s.crm ? ` · CRM ${s.crm}` : ""}
                    </div>
                    {s.justificativa && <div className="text-xs text-muted-foreground/80 italic truncate max-w-md">"{s.justificativa}"</div>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/10" onClick={() => abrirAprovar(s)}>
                      <UserCheck className="h-3.5 w-3.5 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-700 border-red-500/30 hover:bg-red-500/10" onClick={() => { setRecusando(s); setMotivo(""); }}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Recusar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aprovar solicitação */}
      <Dialog open={!!aprovando} onOpenChange={(o) => !o && setAprovando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar cadastro</DialogTitle>
            <DialogDescription>{aprovando?.nome_completo} · {aprovando?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-md border p-3 bg-muted/30 text-xs space-y-1">
              <div>CPF: {aprovando?.cpf} · Telefone: {aprovando?.telefone}</div>
              {aprovando?.crm && <div>CRM: {aprovando.crm}</div>}
              <div>Função pretendida: {aprovando ? perfilAcessoLabel(aprovando.perfil_acesso) : ""}</div>
            </div>
            <div className="space-y-2"><Label>Papel no sistema *</Label>
              <Select value={papelAprov} onValueChange={setPapelAprov}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAPEIS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Cargo</Label><Input value={cargoAprov} onChange={(e) => setCargoAprov(e.target.value)} placeholder="Opcional" /></div>
            <p className="text-xs text-muted-foreground">Uma senha provisória será gerada para o profissional trocar no primeiro acesso.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAprovando(null)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={aprovar.isPending} onClick={() => aprovar.mutate()}>
              {aprovar.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aprovando...</> : "Aprovar e criar conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recusar solicitação */}
      <Dialog open={!!recusando} onOpenChange={(o) => !o && setRecusando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar cadastro</DialogTitle>
            <DialogDescription>{recusando?.nome_completo} · {recusando?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Motivo (opcional)</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ex.: documentação inconsistente" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecusando(null)}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700" disabled={recusar.isPending} onClick={() => recusar.mutate()}>
              {recusar.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Recusando...</> : "Recusar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-5 w-5" /> Equipe</CardTitle>
          <CardDescription>Profissionais com acesso ao hospital.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...</div>
          ) : (equipe?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum profissional cadastrado ainda.</p>
          ) : (
            <div className="divide-y">
              {equipe!.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium text-sm">
                      {p.nome}
                      <Badge variant="outline" className="text-[10px]">{papelLabel(p.papel)}</Badge>
                      {!p.ativo && <Badge variant="destructive" className="text-[10px]">Inativo</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.email}{p.conselho ? ` · ${p.conselho} ${p.numero_conselho ?? ""}` : ""}
                    </div>
                  </div>
                  {p.papel !== "admin" && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button size="sm" variant="ghost" title="Editar" onClick={() => setEditando(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" title="Redefinir senha" disabled={resetarSenha.isPending || !p.user_id}
                        onClick={() => { if (confirm(`Gerar nova senha provisória para ${p.nome}?`)) resetarSenha.mutate(p); }}>
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" disabled={toggleAtivo.isPending} onClick={() => toggleAtivo.mutate(p)}>
                        <Power className="h-3.5 w-3.5 mr-1" /> {p.ativo ? "Desativar" : "Ativar"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editar profissional */}
      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>Altere papel, cargo e conselho. O e-mail de acesso não pode ser alterado aqui.</DialogDescription>
          </DialogHeader>
          {editando && (
            <div className="space-y-3 py-2">
              <div className="space-y-2"><Label>Nome *</Label>
                <Input value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>E-mail</Label>
                <Input value={editando.email ?? ""} disabled />
              </div>
              <div className="space-y-2"><Label>Papel *</Label>
                <Select value={editando.papel} onValueChange={(v) => setEditando({ ...editando, papel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAPEIS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Conselho</Label>
                  <Input value={editando.conselho ?? ""} onChange={(e) => setEditando({ ...editando, conselho: e.target.value })} placeholder="CRM, COREN..." />
                </div>
                <div className="space-y-2"><Label>Nº do conselho</Label>
                  <Input value={editando.numero_conselho ?? ""} onChange={(e) => setEditando({ ...editando, numero_conselho: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2"><Label>Cargo</Label>
                <Input value={editando.cargo ?? ""} onChange={(e) => setEditando({ ...editando, cargo: e.target.value })} placeholder="Opcional" />
              </div>
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
    </div>
  );
}
