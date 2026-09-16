import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

// existe_super_admin / criar_primeiro_super_admin ainda não estão no types.ts
// gerado (RPCs a serem deployadas) → cast até regenerar os tipos.
// .bind(supabase) é OBRIGATÓRIO: sem o receiver, supabase-js acessa `this.rest`
// e quebra com "Cannot read properties of undefined (reading 'rest')".
const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

type Fase = "checando" | "erro_check" | "ja_configurado" | "formulario";

export default function SetupPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [fase, setFase] = useState<Fase>("checando");
  const [checkError, setCheckError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Ao montar: existe super_admin? Se sim, esta tela não faz mais sentido → login.
  useEffect(() => {
    (async () => {
      const { data, error } = await rpc("existe_super_admin");
      if (error) {
        setCheckError(error.message);
        setFase("erro_check");
        return;
      }
      if (data === true) {
        setFase("ja_configurado");
      } else {
        setFase("formulario");
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Senha deve ter ao menos 6 caracteres", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const emailNorm = email.trim().toLowerCase();

      // 1) Cria a conta de auth. Sem confirmação de e-mail nesta instância → já autentica.
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: emailNorm,
        password,
        options: { data: { nome: fullName.trim() } },
      });
      if (signUpError) {
        const m = signUpError.message.toLowerCase();
        const amigavel = /already|registered|exists/.test(m)
          ? "Este e-mail já está cadastrado. Use outro ou faça login."
          : /password|least|weak|short/.test(m)
            ? "Senha muito fraca — escolha uma senha mais forte."
            : signUpError.message;
        throw new Error(amigavel);
      }

      // 2) Garante sessão (signUp já deve retornar; se não, autentica explicitamente).
      let userId = signUpData.user?.id ?? signUpData.session?.user?.id ?? null;
      if (!signUpData.session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: emailNorm,
          password,
        });
        if (signInError || !signInData.user) {
          throw new Error(
            "Conta criada, mas não foi possível autenticar automaticamente. Tente fazer login.",
          );
        }
        userId = signInData.user.id;
      }
      if (!userId) throw new Error("Não foi possível obter o usuário recém-criado.");

      // 3) Promove a super_admin (RPC só funciona uma vez).
      const { error: rpcError } = await rpc("criar_primeiro_super_admin", {
        p_user_id: userId,
        p_nome: fullName.trim(),
        p_email: emailNorm,
      });
      if (rpcError) {
        const m = rpcError.message.toLowerCase();
        if (/super_admin|já existe|already|exists/.test(m)) {
          // Corrida: alguém criou o super_admin antes. Manda pro login.
          toast({
            title: "Sistema já configurado",
            description: "Um super_admin já foi criado. Faça login com suas credenciais.",
          });
          navigate("/auth");
          return;
        }
        throw new Error(rpcError.message);
      }

      // 4) Sucesso: destrava o gate (existe_super_admin agora é true) e vai ao painel.
      qc.setQueryData(["existe-super-admin"], true);
      toast({ title: "Super administrador criado", description: "Bem-vindo(a) ao painel." });
      navigate("/painel-super-admin");
    } catch (err) {
      toast({
        title: "Erro na configuração inicial",
        description: (err as Error)?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold">CONFIGURAÇÃO INICIAL</h1>
          <p className="text-sm text-muted-foreground mt-1">CRIE O DONO DO SISTEMA (SUPER ADMIN)</p>
        </div>

        {fase === "checando" ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Verificando...
          </div>
        ) : fase === "erro_check" ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Não foi possível verificar o estado do sistema. A função <code>existe_super_admin</code> pode
              ainda não estar disponível no backend.
            </p>
            <p className="text-xs text-red-600 break-words">{checkError}</p>
            <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">Ir para login</Button>
          </div>
        ) : fase === "ja_configurado" ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Já existe um super administrador neste sistema. A configuração inicial não pode ser executada novamente.
            </p>
            <Button onClick={() => navigate("/auth")} className="w-full">Ir para login</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground text-center mb-2">
              Esta conta será o dono do sistema (super_admin), sem vínculo a um hospital específico.
            </p>
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
            </div>
            <Button type="submit" disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Criando...</> : "Criar super administrador"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Esta ação só pode ser realizada uma vez.
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
