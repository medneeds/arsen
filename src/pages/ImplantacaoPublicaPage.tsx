import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  IdCard,
  Lock,
  MapPin,
  AlertTriangle,
} from "lucide-react";

// Formulario PUBLICO de implantacao de hospital, acessado por link de uso unico
// (?k=<token>) gerado pelo super_admin. Nao exige login. O envio cria uma conta
// INERTE com a senha escolhida e deixa a solicitacao 'pendente' para aprovacao.
// Toda a mecanica fica nas RPCs/edge SECURITY DEFINER (ver migration + edges).

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const formatCnpj = (v: string) => {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};
const formatPhone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) => [a && `(${a}) `, b, c && `-${c}`].filter(Boolean).join(""));
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
};

const MOTIVO_MSG: Record<string, string> = {
  inexistente: "Link invalido. Confira a URL ou peca um novo a equipe do Arsen.",
  expirado: "Este link expirou. Peca um novo a equipe do Arsen.",
  usado: "Este link ja foi utilizado.",
  reprovado: "Esta solicitacao foi recusada. Fale com a equipe do Arsen.",
};

type Gate = "checando" | "ok" | "invalido";

// Shell em escopo de modulo (estavel): se ficasse dentro do componente, cada render
// criaria um tipo novo e o React remontaria o form, fazendo os inputs perderem o foco.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-muted py-10 px-4">
      <div className="relative max-w-2xl mx-auto space-y-4">
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-lg bg-primary/20 ring-1 ring-primary/30 flex items-center justify-center">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Implantacao Arsen</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Cadastro inicial da instituicao. Apos a revisao da equipe Arsen, voce acessa a
            plataforma com o e-mail e a senha definidos aqui e configura o restante.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ImplantacaoPublicaPage() {
  const [params] = useSearchParams();
  const token = params.get("k") || "";

  const [gate, setGate] = useState<Gate>("checando");
  const [motivo, setMotivo] = useState<string>("inexistente");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    hospitalNome: "",
    cnpj: "",
    endereco: "",
    contatoNome: "",
    contatoEmail: "",
    contatoTelefone: "",
    senha: "",
    confirmarSenha: "",
  });

  useEffect(() => {
    (async () => {
      if (!token) {
        setGate("invalido");
        setMotivo("inexistente");
        return;
      }
      const { data, error } = await (supabase.rpc as any)("implantacao_convite_validar", { p_token: token });
      const valido = !error && data && (data as any).valido === true;
      if (valido) {
        setGate("ok");
      } else {
        setGate("invalido");
        setMotivo((data as any)?.motivo || "inexistente");
      }
    })();
  }, [token]);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validate = (): string | null => {
    if (form.hospitalNome.trim().length < 3) return "Informe o nome do hospital.";
    if (onlyDigits(form.cnpj).length !== 14) return "CNPJ invalido (14 digitos).";
    if (form.contatoNome.trim().length < 5) return "Informe o nome do responsavel.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contatoEmail)) return "E-mail invalido.";
    if (form.contatoTelefone && onlyDigits(form.contatoTelefone).length < 10) return "Telefone invalido.";
    if (form.senha.length < 8) return "A senha deve ter ao menos 8 caracteres.";
    if (form.senha !== form.confirmarSenha) return "As senhas nao conferem.";
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
      const res = await supabase.functions.invoke("implantacao-submeter", {
        body: {
          token,
          hospitalNome: form.hospitalNome.trim(),
          cnpj: onlyDigits(form.cnpj),
          endereco: form.endereco.trim(),
          contatoNome: form.contatoNome.trim(),
          contatoEmail: form.contatoEmail.trim().toLowerCase(),
          contatoTelefone: onlyDigits(form.contatoTelefone),
          senha: form.senha,
        },
      });
      if (res.error) {
        let msg = res.error.message || "Falha ao enviar o cadastro.";
        try {
          const body = (res.error as any)?.context?.body;
          if (body) {
            const parsed = typeof body === "string" ? JSON.parse(body) : body;
            if (parsed?.error) msg = parsed.error;
          }
        } catch { /* mantem msg padrao */ }
        throw new Error(msg);
      }
      const data = res.data as { success?: boolean; error?: string };
      if (!data?.success) throw new Error(data?.error || "Falha ao enviar o cadastro.");
      setSubmitted(true);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Falha ao enviar o cadastro.");
    } finally {
      setSubmitting(false);
    }
  };

  if (gate === "checando") {
    return (
      <Shell>
        <Card className="p-10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </Card>
      </Shell>
    );
  }

  if (gate === "invalido") {
    return (
      <Shell>
        <Card className="p-8 text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-full bg-critical-soft/30 ring-1 ring-critical/30 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-critical-on-soft" />
          </div>
          <h2 className="text-lg font-semibold">Link indisponivel</h2>
          <p className="text-sm text-muted-foreground">{MOTIVO_MSG[motivo] || MOTIVO_MSG.inexistente}</p>
        </Card>
      </Shell>
    );
  }

  if (submitted) {
    return (
      <Shell>
        <Card className="p-8 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-released-soft/20 ring-1 ring-released/30 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-released" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Cadastro enviado!</h2>
          <p className="text-muted-foreground text-sm">
            Recebemos os dados do hospital. A equipe Arsen vai revisar e, apos a aprovacao,
            voce podera entrar com o e-mail <b>{form.contatoEmail}</b> e a senha que definiu.
          </p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card className="p-6 md:p-8 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hospitalNome" className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> Nome do hospital *
            </Label>
            <Input
              id="hospitalNome"
              value={form.hospitalNome}
              onChange={(e) => update("hospitalNome", e.target.value)}
              placeholder="Ex.: Hospital Municipal ..."
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cnpj" className="flex items-center gap-1">
                <IdCard className="h-3.5 w-3.5" /> CNPJ *
              </Label>
              <Input
                id="cnpj"
                value={form.cnpj}
                onChange={(e) => update("cnpj", formatCnpj(e.target.value))}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endereco" className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> Endereco
              </Label>
              <Input
                id="endereco"
                value={form.endereco}
                onChange={(e) => update("endereco", e.target.value)}
                placeholder="Cidade / UF"
              />
            </div>
          </div>

          <div className="pt-2 border-t">
            <p className="text-sm font-medium">Responsavel (administrador do hospital)</p>
            <p className="text-xs text-muted-foreground">
              Sera a conta de acesso do admin apos a aprovacao.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contatoNome">Nome completo *</Label>
            <Input
              id="contatoNome"
              value={form.contatoNome}
              onChange={(e) => update("contatoNome", e.target.value)}
              placeholder="Ex.: Maria Silva Souza"
              autoComplete="name"
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contatoEmail" className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> E-mail *
              </Label>
              <Input
                id="contatoEmail"
                type="email"
                value={form.contatoEmail}
                onChange={(e) => update("contatoEmail", e.target.value)}
                placeholder="responsavel@hospital.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contatoTelefone" className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> Telefone
              </Label>
              <Input
                id="contatoTelefone"
                value={form.contatoTelefone}
                onChange={(e) => update("contatoTelefone", formatPhone(e.target.value))}
                placeholder="(99) 99999-9999"
                inputMode="tel"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="senha" className="flex items-center gap-1">
                <Lock className="h-3.5 w-3.5" /> Senha *
              </Label>
              <Input
                id="senha"
                type="password"
                value={form.senha}
                onChange={(e) => update("senha", e.target.value)}
                placeholder="Minimo 8 caracteres"
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmarSenha" className="flex items-center gap-1">
                <Lock className="h-3.5 w-3.5" /> Confirmar senha *
              </Label>
              <Input
                id="confirmarSenha"
                type="password"
                value={form.confirmarSenha}
                onChange={(e) => update("confirmarSenha", e.target.value)}
                placeholder="Repita a senha"
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <Button type="submit" disabled={submitting} size="lg">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar cadastro"
              )}
            </Button>
          </div>
        </form>
      </Card>

      <p className="text-center text-xs text-muted-foreground/80">
        Seus dados sao tratados conforme a politica de privacidade. A aprovacao e feita
        manualmente pela equipe Arsen.
      </p>
    </Shell>
  );
}
