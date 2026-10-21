import { useMemo, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Rocket, Building2, Palette, Layers, DoorOpen, Bed, Users, ClipboardList,
  Check, ChevronLeft, ChevronRight, Plus, Trash2, Star, ShieldAlert, Loader2,
} from "lucide-react";

/**
 * Assistente de Implantacao de Instituicao (super-admin).
 *
 * ESCOPO DESTA ENTREGA: layout navegavel, SEM gravar no banco. Nenhuma chamada
 * Supabase de escrita, nenhum insert. O botao final "Provisionar" so mostra um
 * toast. O objetivo e validar visualmente o fluxo em dev antes de ligar o
 * backend (RPC criar_hospital_com_admin + insercoes de estrutura/equipe).
 *
 * Todo o estado vive em useState local e serve apenas para navegacao e revisao.
 */

// ── Vocabulario travado pelas CHECK constraints do banco (mesmo do AdminHospitalPage) ──
const SETOR_TIPOS = [
  { value: "triagem", label: "Triagem" },
  { value: "clinico", label: "Clínico" },
  { value: "cirurgico", label: "Cirúrgico" },
];
const LEITO_TIPOS = [
  { value: "leito", label: "Leito" },
  { value: "maca", label: "Maca" },
];
const PAPEIS = [
  { value: "medico", label: "Médico" },
  { value: "enfermeiro", label: "Enfermeiro" },
  { value: "tecnico", label: "Técnico" },
  { value: "regulador", label: "Regulador" },
  { value: "farmacia", label: "Farmácia" },
  { value: "nir", label: "NIR" },
  { value: "porta", label: "Médico da porta" },
  { value: "visitante", label: "Visitante" },
  { value: "coordenador", label: "Coordenador" },
];
const PERFIS_ACESSO = [
  { value: "medico", label: "Médico" },
  { value: "gestor", label: "Gestor" },
  { value: "farmacia", label: "Farmácia" },
  { value: "ccih", label: "CCIH" },
  { value: "nir", label: "NIR" },
  { value: "imagem", label: "Imagem" },
  { value: "laboratorio", label: "Laboratório" },
  { value: "administrativo", label: "Administrativo" },
  { value: "multi", label: "Multiprofissional" },
  { value: "coord_medico", label: "Coord. Médico" },
  { value: "coord_enfermagem", label: "Coord. Enfermagem" },
  { value: "coord_multi", label: "Coord. Multi" },
  { value: "qualidade", label: "Qualidade" },
];

// Identificadores de paciente (etapa 7 — descritiva/parametrizacao futura).
const IDENTIFICADORES_PACIENTE = [
  { key: "prontuario", label: "Prontuário", obrigatorio: true },
  { key: "cpf", label: "CPF", obrigatorio: false },
  { key: "cns", label: "CNS", obrigatorio: false },
  { key: "nome_social", label: "Nome social", obrigatorio: false },
  { key: "nome_mae", label: "Nome da mãe", obrigatorio: false },
  { key: "data_nascimento", label: "Data de nascimento", obrigatorio: false },
  { key: "sexo", label: "Sexo", obrigatorio: false },
  { key: "telefone", label: "Telefone", obrigatorio: false },
  { key: "endereco", label: "Endereço", obrigatorio: false },
  { key: "tipo_sanguineo", label: "Tipo sanguíneo", obrigatorio: false },
  { key: "alergias", label: "Alergias", obrigatorio: false },
  { key: "comorbidades", label: "Comorbidades", obrigatorio: false },
];

const papelLabel = (v: string) => PAPEIS.find((p) => p.value === v)?.label ?? v;
const perfilLabel = (v: string) => PERFIS_ACESSO.find((p) => p.value === v)?.label ?? v;
const setorTipoLabel = (v: string) => SETOR_TIPOS.find((t) => t.value === v)?.label ?? v;

// ── Formas do estado local (nao persiste; so navegacao/revisao) ──
interface AlaForm { id: string; nome: string; descricao: string; }
interface SetorForm { id: string; alaId: string; nome: string; tipo: string; aplicaSaps: boolean; }
interface LeitoForm { id: string; setorId: string; numero: string; tipo: string; }
interface PessoaForm {
  id: string; nome: string; email: string; papel: string;
  perfis: string[]; perfilPrincipal: string | null;
  conselho: string; numeroConselho: string; cargo: string;
}

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}`;
}

const STEPS = [
  { label: "Instituição", icon: Building2 },
  { label: "Identidade", icon: Palette },
  { label: "Alas", icon: Layers },
  { label: "Setores", icon: DoorOpen },
  { label: "Leitos", icon: Bed },
  { label: "Equipe", icon: Users },
  { label: "Cadastro", icon: ClipboardList },
  { label: "Revisão", icon: Rocket },
];

export default function ImplantacaoPage() {
  const { isSuperAdmin, loading } = useIsSuperAdmin();
  const [step, setStep] = useState(0);

  // Etapa 1 — Instituicao
  const [inst, setInst] = useState({
    nome: "", cnpj: "", endereco: "", adminNome: "", adminEmail: "",
  });
  const setInstField = (k: keyof typeof inst) => (v: string) => setInst((s) => ({ ...s, [k]: v }));

  // Etapa 2 — Identidade visual
  const [ident, setIdent] = useState({
    sigla: "", slogan: "",
    corPrimaria: "#2563eb", corSecundaria: "#64748b", corDestaque: "#f59e0b",
  });
  const setIdentField = (k: keyof typeof ident) => (v: string) => setIdent((s) => ({ ...s, [k]: v }));

  // Etapa 3 — Alas
  const [alas, setAlas] = useState<AlaForm[]>([]);
  // Etapa 4 — Setores
  const [setores, setSetores] = useState<SetorForm[]>([]);
  // Etapa 5 — Leitos
  const [leitos, setLeitos] = useState<LeitoForm[]>([]);
  // Etapa 6 — Equipe
  const [pessoas, setPessoas] = useState<PessoaForm[]>([]);
  // Etapa 7 — Identificadores (somente os opcionais sao alternaveis; prontuario fixo)
  const [identificadores, setIdentificadores] = useState<Set<string>>(
    () => new Set(["prontuario", "cpf", "data_nascimento", "nome_mae"]),
  );

  const setoresByAla = useMemo(() => {
    const m = new Map<string, SetorForm[]>();
    for (const s of setores) {
      const arr = m.get(s.alaId) ?? [];
      arr.push(s);
      m.set(s.alaId, arr);
    }
    return m;
  }, [setores]);
  const leitosBySetor = useMemo(() => {
    const m = new Map<string, LeitoForm[]>();
    for (const l of leitos) {
      const arr = m.get(l.setorId) ?? [];
      arr.push(l);
      m.set(l.setorId, arr);
    }
    return m;
  }, [leitos]);

  const totalLeitos = leitos.length;

  // ── Acesso restrito ──
  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...
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
              <p className="text-sm text-muted-foreground">
                Acesso restrito à implantação (super-admin).
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const goNext = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const provisionar = () => {
    toast("Provisionamento será ligado na próxima fase");
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        {/* Cabecalho */}
        <header className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Implantação de Instituição</h1>
            <p className="text-sm text-muted-foreground">
              Assistente guiado para provisionar um novo hospital e sua estrutura.
            </p>
          </div>
          <Badge variant="outline" className="ml-auto border-warning-border bg-warning-soft text-warning-on-soft">
            Prévia — não grava no banco
          </Badge>
        </header>

        {/* Trilha de etapas */}
        <Stepper step={step} onSelect={setStep} />

        {/* Conteudo da etapa */}
        <div className="min-h-[18rem]">
          {step === 0 && renderInstituicao()}
          {step === 1 && renderIdentidade()}
          {step === 2 && renderAlas()}
          {step === 3 && renderSetores()}
          {step === 4 && renderLeitos()}
          {step === 5 && renderEquipe()}
          {step === 6 && renderCadastroPaciente()}
          {step === 7 && renderRevisao()}
        </div>

        {/* Navegacao */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={goBack} disabled={step === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={goNext}>
              Avançar <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={provisionar} className="gap-2">
              <Rocket className="h-4 w-4" /> Provisionar
            </Button>
          )}
        </div>
      </div>
    </MainLayout>
  );

  // ======================= ETAPA 1 — INSTITUICAO =======================
  function renderInstituicao() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> Dados da instituição
          </CardTitle>
          <CardDescription>Identificação do hospital e do administrador responsável.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da instituição *</Label>
            <Input
              value={inst.nome}
              onChange={(e) => setInstField("nome")(e.target.value)}
              placeholder="Ex.: Hospital Municipal Djalma Marques"
              className={cn(!inst.nome.trim() && "border-critical-border")}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={inst.cnpj} onChange={(e) => setInstField("cnpj")(e.target.value)} placeholder="00.000.000/0001-00" />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={inst.endereco} onChange={(e) => setInstField("endereco")(e.target.value)} placeholder="Rua, nº, bairro, cidade/UF" />
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-3 text-sm font-medium">Administrador responsável</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={inst.adminNome}
                  onChange={(e) => setInstField("adminNome")(e.target.value)}
                  className={cn(!inst.adminNome.trim() && "border-critical-border")}
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail *</Label>
                <Input
                  type="email"
                  value={inst.adminEmail}
                  onChange={(e) => setInstField("adminEmail")(e.target.value)}
                  className={cn(!inst.adminEmail.trim() && "border-critical-border")}
                />
              </div>
            </div>
          </div>

          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Cria hospital + conta admin (RPC <code>criar_hospital_com_admin</code>) — ligado na próxima fase.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ======================= ETAPA 2 — IDENTIDADE =======================
  function renderIdentidade() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" /> Identidade visual
          </CardTitle>
          <CardDescription>Sigla, slogan, logo e paleta de cores do hospital.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Sigla *</Label>
              <Input
                value={ident.sigla}
                onChange={(e) => setIdentField("sigla")(e.target.value)}
                placeholder="Ex.: HMDM"
                className={cn(!ident.sigla.trim() && "border-critical-border")}
              />
            </div>
            <div className="space-y-2">
              <Label>Slogan</Label>
              <Input value={ident.slogan} onChange={(e) => setIdentField("slogan")(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-3 rounded-md border border-dashed border-border bg-muted/40 px-3 py-4">
              <Input type="file" disabled className="max-w-xs cursor-not-allowed opacity-60" />
              <span className="text-xs text-muted-foreground">Upload em breve.</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cores</Label>
            <div className="grid gap-4 sm:grid-cols-3">
              <ColorField label="Primária" value={ident.corPrimaria} onChange={setIdentField("corPrimaria")} />
              <ColorField label="Secundária" value={ident.corSecundaria} onChange={setIdentField("corSecundaria")} />
              <ColorField label="Destaque" value={ident.corDestaque} onChange={setIdentField("corDestaque")} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ======================= ETAPA 3 — ALAS =======================
  function addAla() {
    setAlas((a) => [...a, { id: uid(), nome: "", descricao: "" }]);
  }
  function updateAla(id: string, patch: Partial<AlaForm>) {
    setAlas((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removeAla(id: string) {
    setAlas((a) => a.filter((x) => x.id !== id));
    // Remove setores e leitos orfaos.
    const setoresOrfaos = setores.filter((s) => s.alaId === id).map((s) => s.id);
    setSetores((s) => s.filter((x) => x.alaId !== id));
    setLeitos((l) => l.filter((x) => !setoresOrfaos.includes(x.setorId)));
  }
  function renderAlas() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" /> Alas
            <Badge variant="secondary" className="ml-1">{alas.length} alas</Badge>
          </CardTitle>
          <CardDescription>Alas agrupam os setores do hospital.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {alas.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma ala adicionada ainda.</p>
          )}
          {alas.map((ala) => (
            <div key={ala.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center">
              <Input
                value={ala.nome}
                onChange={(e) => updateAla(ala.id, { nome: e.target.value })}
                placeholder="Nome da ala (ex.: Ala A)"
                className={cn("sm:max-w-xs", !ala.nome.trim() && "border-critical-border")}
              />
              <Input
                value={ala.descricao}
                onChange={(e) => updateAla(ala.id, { descricao: e.target.value })}
                placeholder="Descrição (opcional)"
              />
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeAla(ala.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="secondary" onClick={addAla}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar ala
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ======================= ETAPA 4 — SETORES =======================
  function addSetor(alaId: string) {
    setSetores((s) => [...s, { id: uid(), alaId, nome: "", tipo: "clinico", aplicaSaps: false }]);
  }
  function updateSetor(id: string, patch: Partial<SetorForm>) {
    setSetores((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removeSetor(id: string) {
    setSetores((s) => s.filter((x) => x.id !== id));
    setLeitos((l) => l.filter((x) => x.setorId !== id));
  }
  function renderSetores() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DoorOpen className="h-4 w-4" /> Setores
            <Badge variant="secondary" className="ml-1">{setores.length} setores</Badge>
          </CardTitle>
          <CardDescription>Adicione setores a cada ala. Cada setor tem tipo e indica se aplica a ficha SAPS.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {alas.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Crie ao menos uma ala na etapa anterior.
            </p>
          )}
          {alas.map((ala) => {
            const setoresDaAla = setoresByAla.get(ala.id) ?? [];
            return (
              <div key={ala.id} className="rounded-lg border border-border p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  {ala.nome || <span className="text-muted-foreground">(ala sem nome)</span>}
                  <Badge variant="outline" className="ml-1 text-[10px]">{setoresDaAla.length} setores</Badge>
                </div>
                <div className="space-y-2">
                  {setoresDaAla.map((setor) => (
                    <div key={setor.id} className="flex flex-col gap-2 rounded-md border border-border/70 bg-muted/30 p-2 sm:flex-row sm:items-center">
                      <Input
                        value={setor.nome}
                        onChange={(e) => updateSetor(setor.id, { nome: e.target.value })}
                        placeholder="Nome do setor"
                        className={cn("sm:max-w-xs", !setor.nome.trim() && "border-critical-border")}
                      />
                      <Select value={setor.tipo} onValueChange={(v) => updateSetor(setor.id, { tipo: v })}>
                        <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SETOR_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={setor.aplicaSaps}
                          onCheckedChange={(v) => updateSetor(setor.id, { aplicaSaps: v })}
                        />
                        <span className={setor.aplicaSaps ? "font-medium text-foreground" : "text-muted-foreground"}>
                          Aplica SAPS
                        </span>
                      </label>
                      <Button variant="ghost" size="icon" className="ml-auto text-destructive" onClick={() => removeSetor(setor.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button variant="secondary" size="sm" className="mt-2" onClick={() => addSetor(ala.id)}>
                  <Plus className="mr-1 h-4 w-4" /> Setor
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  // ======================= ETAPA 5 — LEITOS =======================
  function addLeitoAvulso(setorId: string, numero: string, tipo: string) {
    if (!numero.trim()) return;
    setLeitos((l) => [...l, { id: uid(), setorId, numero: numero.trim(), tipo }]);
  }
  function addLeitosLote(setorId: string, numeros: string[], tipo: string) {
    const existentes = new Set(leitos.filter((l) => l.setorId === setorId).map((l) => l.numero));
    const novos = numeros
      .filter((n) => !existentes.has(n))
      .map((n) => ({ id: uid(), setorId, numero: n, tipo }));
    setLeitos((l) => [...l, ...novos]);
  }
  function removeLeito(id: string) {
    setLeitos((l) => l.filter((x) => x.id !== id));
  }
  function renderLeitos() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bed className="h-4 w-4" /> Leitos
            <Badge variant="secondary" className="ml-1">{totalLeitos} leitos</Badge>
          </CardTitle>
          <CardDescription>Gere leitos em lote por setor ou adicione números avulsos. Todos nascem como "Livre".</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {setores.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Crie ao menos um setor na etapa anterior.
            </p>
          )}
          {setores.map((setor) => {
            const ala = alas.find((a) => a.id === setor.alaId);
            const leitosDoSetor = leitosBySetor.get(setor.id) ?? [];
            return (
              <div key={setor.id} className="rounded-lg border border-border p-3">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-medium">
                  <DoorOpen className="h-4 w-4 text-muted-foreground" />
                  {setor.nome || <span className="text-muted-foreground">(setor sem nome)</span>}
                  <span className="text-xs text-muted-foreground">· {ala?.nome ?? "—"}</span>
                  <Badge variant="outline" className="ml-1 text-[10px]">{leitosDoSetor.length} leitos</Badge>
                </div>

                <LeitoGenerator
                  onGerar={(numeros, tipo) => addLeitosLote(setor.id, numeros, tipo)}
                  onAvulso={(numero, tipo) => addLeitoAvulso(setor.id, numero, tipo)}
                />

                {leitosDoSetor.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {leitosDoSetor.map((leito) => (
                      <span key={leito.id} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs">
                        <Bed className="h-3 w-3 text-muted-foreground" /> {leito.numero}
                        <Badge variant="outline" className="h-4 border-released-border bg-released-soft px-1 text-[9px] text-released-on-soft">Livre</Badge>
                        <button className="text-destructive hover:opacity-70" title="Remover" onClick={() => removeLeito(leito.id)}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  // ======================= ETAPA 6 — EQUIPE =======================
  function addPessoa() {
    setPessoas((p) => [...p, {
      id: uid(), nome: "", email: "", papel: "medico",
      perfis: [], perfilPrincipal: null, conselho: "", numeroConselho: "", cargo: "",
    }]);
  }
  function updatePessoa(id: string, patch: Partial<PessoaForm>) {
    setPessoas((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removePessoa(id: string) {
    setPessoas((p) => p.filter((x) => x.id !== id));
  }
  function togglePerfil(pessoa: PessoaForm, perfil: string) {
    const tem = pessoa.perfis.includes(perfil);
    const perfis = tem ? pessoa.perfis.filter((x) => x !== perfil) : [...pessoa.perfis, perfil];
    let principal = pessoa.perfilPrincipal;
    if (tem && principal === perfil) principal = perfis[0] ?? null;
    if (!tem && principal === null) principal = perfil;
    updatePessoa(pessoa.id, { perfis, perfilPrincipal: principal });
  }
  function renderEquipe() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Equipe
            <Badge variant="secondary" className="ml-1">{pessoas.length} pessoas</Badge>
          </CardTitle>
          <CardDescription>Profissionais que receberão acesso. Marque os perfis e indique o principal (★).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pessoas.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum profissional adicionado ainda.</p>
          )}
          {pessoas.map((pessoa) => (
            <div key={pessoa.id} className="space-y-3 rounded-lg border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={pessoa.nome}
                    onChange={(e) => updatePessoa(pessoa.id, { nome: e.target.value })}
                    className={cn(!pessoa.nome.trim() && "border-critical-border")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={pessoa.email}
                    onChange={(e) => updatePessoa(pessoa.id, { email: e.target.value })}
                    className={cn(!pessoa.email.trim() && "border-critical-border")}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-2 sm:col-span-1">
                  <Label>Papel *</Label>
                  <Select value={pessoa.papel} onValueChange={(v) => updatePessoa(pessoa.id, { papel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAPEIS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conselho</Label>
                  <Input value={pessoa.conselho} onChange={(e) => updatePessoa(pessoa.id, { conselho: e.target.value })} placeholder="CRM, COREN..." />
                </div>
                <div className="space-y-2">
                  <Label>Nº conselho</Label>
                  <Input value={pessoa.numeroConselho} onChange={(e) => updatePessoa(pessoa.id, { numeroConselho: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input value={pessoa.cargo} onChange={(e) => updatePessoa(pessoa.id, { cargo: e.target.value })} placeholder="Opcional" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Perfis de acesso</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PERFIS_ACESSO.map((perfil) => {
                    const ativo = pessoa.perfis.includes(perfil.value);
                    const principal = pessoa.perfilPrincipal === perfil.value;
                    return (
                      <button
                        key={perfil.value}
                        type="button"
                        onClick={() => togglePerfil(pessoa, perfil.value)}
                        onDoubleClick={() => ativo && updatePessoa(pessoa.id, { perfilPrincipal: perfil.value })}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                          ativo
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {principal && <Star className="h-3 w-3 fill-current" />}
                        {perfil.label}
                      </button>
                    );
                  })}
                </div>
                {pessoa.perfis.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Clique para marcar; duplo clique no perfil marcado define o principal (★).
                  </p>
                )}
              </div>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removePessoa(pessoa.id)}>
                  <Trash2 className="mr-1 h-4 w-4" /> Remover
                </Button>
              </div>
            </div>
          ))}
          <Button variant="secondary" onClick={addPessoa}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar profissional
          </Button>
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            O admin já é criado na etapa 1; super-admin não se cria aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ======================= ETAPA 7 — CADASTRO DE PACIENTE =======================
  function toggleIdentificador(key: string) {
    setIdentificadores((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }
  function renderCadastroPaciente() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" /> Tipos de cadastro de paciente
          </CardTitle>
          <CardDescription>Identificadores coletados no cadastro do paciente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {IDENTIFICADORES_PACIENTE.map((ident2) => {
              const marcado = ident2.obrigatorio || identificadores.has(ident2.key);
              return (
                <label
                  key={ident2.key}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm",
                    ident2.obrigatorio ? "cursor-not-allowed bg-muted/50" : "cursor-pointer hover:bg-muted/40",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={ident2.obrigatorio}
                    onChange={() => !ident2.obrigatorio && toggleIdentificador(ident2.key)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className={marcado ? "text-foreground" : "text-muted-foreground"}>{ident2.label}</span>
                  {ident2.obrigatorio && (
                    <Badge variant="outline" className="ml-auto text-[10px]">Obrigatório</Badge>
                  )}
                </label>
              );
            })}
          </div>
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Hoje o cadastro de paciente é global e feito em tempo de execução (na porta). Esta etapa é
            informativa — a parametrização por instituição será ligada numa fase futura.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ======================= ETAPA 8 — REVISAO =======================
  function renderRevisao() {
    const identMarcados = IDENTIFICADORES_PACIENTE.filter((i) => i.obrigatorio || identificadores.has(i.key));
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Rocket className="h-4 w-4" /> Revisão
            </CardTitle>
            <CardDescription>Confira o resumo antes de provisionar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">1 instituição</Badge>
              <Badge variant="secondary">{alas.length} alas</Badge>
              <Badge variant="secondary">{setores.length} setores</Badge>
              <Badge variant="secondary">{totalLeitos} leitos</Badge>
              <Badge variant="secondary">{pessoas.length} pessoas</Badge>
            </div>

            <Separator />

            <ReviewRow label="Instituição">
              <p className="font-medium">{inst.nome || "(sem nome)"}</p>
              <p className="text-xs text-muted-foreground">
                {[inst.cnpj, inst.endereco].filter(Boolean).join(" · ") || "Sem CNPJ/endereço"}
              </p>
              <p className="text-xs text-muted-foreground">
                Admin: {inst.adminNome || "(sem nome)"} · {inst.adminEmail || "(sem e-mail)"}
              </p>
            </ReviewRow>

            <ReviewRow label="Identidade">
              <p className="text-xs text-muted-foreground">
                Sigla: <span className="font-medium text-foreground">{ident.sigla || "—"}</span>
                {ident.slogan ? ` · ${ident.slogan}` : ""}
              </p>
              <div className="mt-1 flex items-center gap-2">
                {[ident.corPrimaria, ident.corSecundaria, ident.corDestaque].map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="h-4 w-4 rounded border border-border" style={{ backgroundColor: c }} /> {c}
                  </span>
                ))}
              </div>
            </ReviewRow>

            <ReviewRow label="Estrutura">
              {alas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma ala.</p>
              ) : (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {alas.map((ala) => {
                    const setoresDaAla = setoresByAla.get(ala.id) ?? [];
                    return (
                      <li key={ala.id}>
                        <span className="font-medium text-foreground">{ala.nome || "(ala sem nome)"}</span>
                        {" — "}{setoresDaAla.length} setores,{" "}
                        {setoresDaAla.reduce((acc, s) => acc + (leitosBySetor.get(s.id)?.length ?? 0), 0)} leitos
                        {setoresDaAla.length > 0 && (
                          <ul className="ml-4 list-disc">
                            {setoresDaAla.map((s) => (
                              <li key={s.id}>
                                {s.nome || "(setor sem nome)"} · {setorTipoLabel(s.tipo)}
                                {s.aplicaSaps ? " · SAPS" : ""} · {(leitosBySetor.get(s.id)?.length ?? 0)} leitos
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </ReviewRow>

            <ReviewRow label="Equipe">
              {pessoas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum profissional.</p>
              ) : (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {pessoas.map((p) => (
                    <li key={p.id}>
                      <span className="font-medium text-foreground">{p.nome || "(sem nome)"}</span>
                      {" · "}{papelLabel(p.papel)}
                      {p.perfis.length > 0 && (
                        <> · {p.perfis.map((x) => (x === p.perfilPrincipal ? `★ ${perfilLabel(x)}` : perfilLabel(x))).join(", ")}</>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </ReviewRow>

            <ReviewRow label="Cadastro de paciente">
              <p className="text-xs text-muted-foreground">
                {identMarcados.map((i) => i.label).join(", ")}
              </p>
            </ReviewRow>
          </CardContent>
        </Card>

        <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-on-soft">
          Esta é uma prévia visual. O botão "Provisionar" ainda não grava nada no banco.
        </p>
      </div>
    );
  }
}

// ======================= COMPONENTES AUXILIARES =======================

function Stepper({ step, onSelect }: { step: number; onSelect: (i: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < step;
        const current = i === step;
        return (
          <div key={s.label} className="flex items-center">
            <button
              type="button"
              onClick={() => onSelect(i)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                current ? "bg-primary/15 text-primary"
                  : done ? "text-foreground hover:bg-muted"
                    : "text-muted-foreground hover:bg-muted",
              )}
            >
              <span className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
                current ? "bg-primary text-primary-foreground"
                  : done ? "bg-primary/30 text-primary"
                    : "bg-muted text-muted-foreground",
              )}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="hidden items-center gap-1 sm:inline-flex">
                <Icon className="h-3.5 w-3.5" /> {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
          </div>
        );
      })}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-14 p-1" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
      </div>
    </div>
  );
}

function LeitoGenerator({
  onGerar, onAvulso,
}: {
  onGerar: (numeros: string[], tipo: string) => void;
  onAvulso: (numero: string, tipo: string) => void;
}) {
  const [prefixo, setPrefixo] = useState("L");
  const [inicio, setInicio] = useState("1");
  const [fim, setFim] = useState("10");
  const [tipo, setTipo] = useState("leito");
  const [avulso, setAvulso] = useState("");

  const preview = useMemo(() => {
    const ini = parseInt(inicio, 10);
    const f = parseInt(fim, 10);
    if (Number.isNaN(ini) || Number.isNaN(f) || ini > f || f - ini > 200) return [];
    const width = Math.max(2, String(f).length);
    const out: string[] = [];
    for (let n = ini; n <= f; n++) out.push(`${prefixo}${String(n).padStart(width, "0")}`);
    return out;
  }, [prefixo, inicio, fim]);

  return (
    <div className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Prefixo</Label>
          <Input value={prefixo} onChange={(e) => setPrefixo(e.target.value)} className="w-20" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Início</Label>
          <Input value={inicio} onChange={(e) => setInicio(e.target.value)} inputMode="numeric" className="w-20" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Fim</Label>
          <Input value={fim} onChange={(e) => setFim(e.target.value)} inputMode="numeric" className="w-20" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEITO_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline" className="h-6 border-released-border bg-released-soft text-released-on-soft">Livre</Badge>
        <Button
          size="sm"
          variant="secondary"
          disabled={preview.length === 0}
          onClick={() => { onGerar(preview, tipo); }}
        >
          <Plus className="mr-1 h-4 w-4" /> Gerar {preview.length > 0 ? `${preview.length}` : ""}
        </Button>
      </div>

      {preview.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Prévia: <span className="font-mono text-foreground">{preview.slice(0, 6).join(", ")}{preview.length > 6 ? `, … ${preview[preview.length - 1]}` : ""}</span>
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Número avulso</Label>
          <Input value={avulso} onChange={(e) => setAvulso(e.target.value)} placeholder="Ex.: ISO-1" className="w-36" />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!avulso.trim()}
          onClick={() => { onAvulso(avulso, tipo); setAvulso(""); }}
        >
          <Plus className="mr-1 h-4 w-4" /> Avulso
        </Button>
      </div>
    </div>
  );
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_1fr]">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div>{children}</div>
    </div>
  );
}
