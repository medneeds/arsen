import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Stethoscope,
  Building2,
  Mail,
  Phone,
  IdCard,
  ClipboardList,
} from "lucide-react";
import { ACCESS_PROFILES } from "@/config/userProfiles";
import { whitelabel, getInstitutionalHeaderLines } from "@/config/whitelabel";
import socorraoCross from "@/assets/socorrao-cross-logo.png";

const INSTITUTIONAL_LINES = getInstitutionalHeaderLines();
const INST_COLORS = whitelabel.theme.institutionalColors;

function NormaZeroHeader() {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl">
      <div className="grid grid-cols-[68px_1fr_68px] items-center gap-3 px-5 py-3">
        <img
          src={socorraoCross}
          alt="Brasão institucional"
          className="h-[62px] w-[62px] object-contain drop-shadow"
        />
        <div className="text-center leading-tight">
          {INSTITUTIONAL_LINES.map((l, i) => (
            <div
              key={i}
              className={
                i === 2
                  ? "text-[12px] md:text-[13px] font-bold tracking-wide text-foreground"
                  : "text-[10px] md:text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
              }
            >
              {l}
            </div>
          ))}
        </div>
        <div />
      </div>
      <div className="flex h-1.5 w-full">
        <div className="flex-1" style={{ background: INST_COLORS.red }} />
        <div className="flex-1" style={{ background: INST_COLORS.orange }} />
        <div className="flex-1" style={{ background: INST_COLORS.yellow }} />
        <div className="flex-1" style={{ background: INST_COLORS.green }} />
        <div className="flex-1" style={{ background: INST_COLORS.blue }} />
      </div>
    </header>
  );
}

function NormaZeroFooter() {
  return (
    <footer className="text-center text-[10px] uppercase tracking-wider text-muted-foreground/80 space-y-0.5">
      <div>HMDM · Arsen 1.0 · MAN.05-001 v05 · Conformidade LGPD/CFM</div>
      <div className="text-muted-foreground/60 normal-case tracking-normal">
        Seus dados são tratados conforme nossa política de privacidade. A aprovação
        é feita manualmente pela equipe administrativa.
      </div>
    </footer>
  );
}

interface HospitalUnit {
  id: string;
  name: string;
}

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const formatCpf = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};
const formatPhone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) => [a && `(${a}) `, b, c && `-${c}`].filter(Boolean).join(""));
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
};

export default function PreCadastroPage() {
  const [units, setUnits] = useState<HospitalUnit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    cpf: "",
    phone: "",
    crm: "",
    accessProfile: "medico",
    hospitalUnitId: "",
    justification: "",
  });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("hospital_units")
        .select("id, name")
        .order("name");
      if (!error && data) {
        setUnits(data as HospitalUnit[]);
        // Auto-select Socorrão 1 (HMDM) if found
        const hmdm = (data as HospitalUnit[]).find((u) =>
          /socorr[aã]o\s*1|hmdm/i.test(u.name),
        );
        if (hmdm) setForm((f) => ({ ...f, hospitalUnitId: hmdm.id }));
      }
      setLoadingUnits(false);
    })();
  }, []);

  const isMedico = useMemo(
    () => ["medico", "ccih"].includes(form.accessProfile),
    [form.accessProfile],
  );

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validate = (): string | null => {
    if (!form.fullName.trim() || form.fullName.trim().length < 5)
      return "Informe seu nome completo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Email inválido.";
    if (onlyDigits(form.cpf).length !== 11) return "CPF inválido.";
    if (onlyDigits(form.phone).length < 10) return "Telefone inválido.";
    if (!form.hospitalUnitId) return "Selecione a unidade hospitalar.";
    if (isMedico && !form.crm.trim()) return "CRM obrigatório para perfil médico.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      // Verifica duplicidade rápida (CPF pendente)
      const cpfDigits = onlyDigits(form.cpf);
      const { data: existing } = await supabase
        .from("pre_registration_requests")
        .select("id, status")
        .eq("cpf", cpfDigits)
        .in("status", ["pending", "approved"])
        .maybeSingle();

      if (existing) {
        toast.error(
          existing.status === "approved"
            ? "Já existe um cadastro aprovado para este CPF."
            : "Já existe uma solicitação pendente para este CPF.",
        );
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from("pre_registration_requests").insert({
        full_name: form.fullName.trim().toUpperCase(),
        email: form.email.trim().toLowerCase(),
        cpf: cpfDigits,
        phone: onlyDigits(form.phone),
        crm: form.crm.trim() || null,
        access_profile: form.accessProfile,
        hospital_unit_id: form.hospitalUnitId,
        justification: form.justification.trim() || null,
        status: "pending",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Falha ao enviar pré-cadastro.");
    } finally {
      setSubmitting(false);
    }
  };

  // Backdrop compartilhado: profundidade com orbs animados + grid sutil
  const Backdrop = () => (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-pulse" />
        <div
          className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-blue-500/15 blur-3xl animate-pulse"
          style={{ animationDelay: "1.2s", animationDuration: "6s" }}
        />
        <div
          className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl animate-pulse"
          style={{ animationDelay: "0.6s", animationDuration: "7s" }}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
    </>
  );

  if (submitted) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 flex items-center justify-center p-6">
        <Backdrop />
        <div className="relative w-full max-w-lg space-y-5 animate-in fade-in zoom-in-95 duration-500">
          <NormaZeroHeader />
          <Card className="p-8 text-center space-y-4 backdrop-blur-xl bg-card/70 border-border/60 shadow-2xl shadow-emerald-500/10">
            <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400/20 to-emerald-600/10 ring-1 ring-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">PRÉ-CADASTRO ENVIADO!</h1>
            <p className="text-muted-foreground">
              Sua solicitação foi recebida e entrará na lista de aprovações da equipe
              administrativa. Você receberá um retorno por email assim que o cadastro
              for revisado.
            </p>
            <div className="pt-2">
              <Button asChild variant="outline" className="backdrop-blur">
                <Link to="/auth">Voltar para o login</Link>
              </Button>
            </div>
          </Card>
          <NormaZeroFooter />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 py-8 px-4">
      <Backdrop />
      <div className="relative max-w-2xl mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <NormaZeroHeader />
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/15 to-blue-500/20 ring-1 ring-primary/30 flex items-center justify-center shadow-xl shadow-primary/20">
            <ShieldCheck className="h-7 w-7 text-primary drop-shadow" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
            PRÉ-CADASTRO DE ACESSO
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Preencha os dados abaixo para solicitar acesso à plataforma. Sua
            solicitação será revisada pela equipe administrativa.
          </p>
        </div>

        <Card className="relative p-6 md:p-8 space-y-5 backdrop-blur-xl bg-card/70 border-border/60 shadow-2xl shadow-primary/5 overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo *</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                placeholder="Ex.: Maria Silva Souza"
                autoComplete="name"
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="seu.email@dominio.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> Telefone *
                </Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => update("phone", formatPhone(e.target.value))}
                  placeholder="(99) 99999-9999"
                  inputMode="tel"
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cpf" className="flex items-center gap-1">
                  <IdCard className="h-3.5 w-3.5" /> CPF *
                </Label>
                <Input
                  id="cpf"
                  value={form.cpf}
                  onChange={(e) => update("cpf", formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crm" className="flex items-center gap-1">
                  <Stethoscope className="h-3.5 w-3.5" />
                  CRM {isMedico ? "*" : <span className="text-xs text-muted-foreground">(se aplicável)</span>}
                </Label>
                <Input
                  id="crm"
                  value={form.crm}
                  onChange={(e) => update("crm", e.target.value.toUpperCase())}
                  placeholder="Ex.: 12345-MA"
                  required={isMedico}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <ClipboardList className="h-3.5 w-3.5" /> Função pretendida *
                </Label>
                <Select
                  value={form.accessProfile}
                  onValueChange={(v) => update("accessProfile", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_PROFILES.filter(
                      (p) => !["desenvolvedor"].includes(p.value),
                    ).map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> Unidade hospitalar *
                </Label>
                <Select
                  value={form.hospitalUnitId}
                  onValueChange={(v) => update("hospitalUnitId", v)}
                  disabled={loadingUnits}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingUnits ? "Carregando..." : "Selecione"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification">Observações / justificativa (opcional)</Label>
              <Textarea
                id="justification"
                value={form.justification}
                onChange={(e) => update("justification", e.target.value)}
                placeholder="Ex.: plantonista da UTI 1, indicado pela coordenação..."
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <Link
                to="/auth"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← Já tenho cadastro
              </Link>
              <Button type="submit" disabled={submitting} size="lg">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar pré-cadastro"
                )}
              </Button>
            </div>
          </form>
        </Card>

        <NormaZeroFooter />
      </div>
    </div>
  );
}
