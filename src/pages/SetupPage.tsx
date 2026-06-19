import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export default function SetupPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("Super Administrador");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("setup-initial-admin", {
          method: "GET",
        });
        if (error) throw error;
        setNeedsSetup(Boolean((data as { needsSetup?: boolean })?.needsSetup));
      } catch (e) {
        console.error(e);
        setNeedsSetup(false);
      } finally {
        setChecking(false);
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
      const { data, error } = await supabase.functions.invoke("setup-initial-admin", {
        body: { fullName: fullName.trim(), email: email.trim().toLowerCase(), password },
      });
      if (error) throw error;
      const payload = data as { success?: boolean; error?: string };
      if (!payload?.success) throw new Error(payload?.error ?? "Falha no setup");
      toast({ title: "Administrador criado", description: "Faça login com o e-mail e senha definidos." });
      navigate("/auth");
    } catch (err: any) {
      toast({
        title: "Erro no setup",
        description: err?.message ?? String(err),
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
          <h1 className="text-2xl font-bold">SETUP INICIAL</h1>
          <p className="text-sm text-muted-foreground mt-1">CONFIGURE O ADMINISTRADOR DO SISTEMA</p>
        </div>

        {checking ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Verificando...
          </div>
        ) : !needsSetup ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Já existe um administrador configurado neste sistema. O setup inicial não pode ser executado novamente.
            </p>
            <Button onClick={() => navigate("/auth")} className="w-full">Ir para login</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground text-center mb-2">
              Cria um novo super_admin do sistema. Esta rota permanece aberta — use credenciais seguras e considere desativá-la quando não estiver em uso.
            </p>
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
            </div>
            <Button type="submit" disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Criando...</> : "Criar Administrador"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Esta ação só pode ser realizada uma vez. Certifique-se de usar credenciais seguras.
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
