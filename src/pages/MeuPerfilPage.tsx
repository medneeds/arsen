import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, User as UserIcon, KeyRound, Mail, Loader2, Shield } from "lucide-react";

/* ───── Máscara CPF ───── */
const maskCpf = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const cpfDigits = (v: string) => v.replace(/\D/g, "");

const validateCpf = (cpf: string): boolean => {
  const d = cpfDigits(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10) r = 0;
  if (r !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10) r = 0;
  return r === parseInt(d[10]);
};

const maskPhone = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");

/* ───── Schema ───── */
const profileSchema = z.object({
  full_name: z.string().trim().min(3, "Nome muito curto").max(120),
  username: z.string().trim().min(3, "Mínimo 3 caracteres").max(40).optional().or(z.literal("")),
  cpf: z.string().refine((v) => !v || validateCpf(v), "CPF inválido"),
  phone: z.string().optional().or(z.literal("")),
  crm: z.string().trim().max(20).optional().or(z.literal("")),
  specialty: z.string().trim().max(80).optional().or(z.literal("")),
  matricula: z.string().trim().max(40).optional().or(z.literal("")),
  cargo: z.string().trim().max(80).optional().or(z.literal("")),
});

const passwordSchema = z
  .object({
    newPassword: z.string().min(8, "Mínimo 8 caracteres").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "As senhas não conferem",
    path: ["confirm"],
  });

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  cpf: string | null;
  phone: string | null;
  crm: string | null;
  specialty: string | null;
  matricula: string | null;
  cargo: string | null;
  professional_type: string | null;
  access_profile: string | null;
}

export default function MeuPerfilPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    username: "",
    cpf: "",
    phone: "",
    crm: "",
    specialty: "",
    matricula: "",
    cargo: "",
  });

  const [pwd, setPwd] = useState({ newPassword: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, username, cpf, phone, crm, specialty, matricula, cargo, professional_type, access_profile",
        )
        .eq("id", user.id)
        .maybeSingle();
      if (error) {
        toast.error("Falha ao carregar perfil");
        setLoading(false);
        return;
      }
      const row = (data ?? null) as ProfileRow | null;
      setProfile(row);
      setForm({
        full_name: row?.full_name ?? "",
        username: row?.username ?? "",
        cpf: row?.cpf ? maskCpf(row.cpf) : "",
        phone: row?.phone ? maskPhone(row.phone) : "",
        crm: row?.crm ?? "",
        specialty: row?.specialty ?? "",
        matricula: row?.matricula ?? "",
        cargo: row?.cargo ?? "",
      });
      setLoading(false);
    })();
  }, [user?.id]);

  const handleSave = async () => {
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || "Verifique os campos");
      return;
    }
    if (!user?.id) return;
    setSaving(true);
    const payload = {
      full_name: form.full_name.trim().toUpperCase(),
      username: form.username.trim() || null,
      cpf: form.cpf ? cpfDigits(form.cpf) : null,
      phone: form.phone ? form.phone.replace(/\D/g, "") : null,
      crm: form.crm.trim() || null,
      specialty: form.specialty.trim().toUpperCase() || null,
      matricula: form.matricula.trim() || null,
      cargo: form.cargo.trim().toUpperCase() || null,
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    setSaving(false);
    if (error) {
      if (error.message.includes("cpf")) toast.error("Este CPF já está em uso por outro usuário");
      else if (error.message.includes("username")) toast.error("Este nome de usuário já está em uso");
      else toast.error("Falha ao salvar: " + error.message);
      return;
    }
    toast.success("Dados atualizados");
  };

  const handleChangePassword = async () => {
    const parsed = passwordSchema.safeParse(pwd);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || "Verifique as senhas");
      return;
    }
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd.newPassword });
    setPwdSaving(false);
    if (error) {
      toast.error("Falha ao atualizar senha: " + error.message);
      return;
    }
    setPwd({ newPassword: "", confirm: "" });
    toast.success("Senha atualizada com sucesso");
  };

  const handleSendResetEmail = async () => {
    if (!user?.email) {
      toast.error("Email não disponível");
      return;
    }
    setResetSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetSending(false);
    if (error) {
      toast.error("Falha ao enviar email: " + error.message);
      return;
    }
    toast.success(`Link de redefinição enviado para ${user.email}`);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando perfil…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground">
            Atualize seus dados cadastrais e gerencie sua senha
          </p>
        </div>
      </div>

      <Tabs defaultValue="dados" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="dados">
            <UserIcon className="mr-2 h-4 w-4" /> Dados cadastrais
          </TabsTrigger>
          <TabsTrigger value="seguranca">
            <Shield className="mr-2 h-4 w-4" /> Segurança
          </TabsTrigger>
        </TabsList>

        {/* ─── Dados ─── */}
        <TabsContent value="dados" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados cadastrais</CardTitle>
              <CardDescription>
                Informações sincronizadas com sua identidade no sistema. Email, perfil de acesso e status
                são gerenciados pela administração.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Somente leitura */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Email (login)</Label>
                  <Input value={user?.email ?? ""} disabled className="font-mono text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Perfil de acesso</Label>
                  <Input value={profile?.access_profile ?? "—"} disabled />
                </div>
              </div>

              <div className="border-t pt-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="full_name">Nome completo *</Label>
                    <Input
                      id="full_name"
                      value={form.full_name}
                      onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                      placeholder="Nome civil completo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="username">Nome de usuário</Label>
                    <Input
                      id="username"
                      value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                      placeholder="login alternativo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      value={form.cpf}
                      onChange={(e) => setForm((f) => ({ ...f, cpf: maskCpf(e.target.value) }))}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: maskPhone(e.target.value) }))}
                      placeholder="(00) 00000-0000"
                      inputMode="tel"
                    />
                  </div>
                  <div>
                    <Label htmlFor="matricula">Matrícula</Label>
                    <Input
                      id="matricula"
                      value={form.matricula}
                      onChange={(e) => setForm((f) => ({ ...f, matricula: e.target.value }))}
                      placeholder="Matrícula funcional"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cargo">Cargo</Label>
                    <Input
                      id="cargo"
                      value={form.cargo}
                      onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                      placeholder="Ex.: Médico plantonista"
                    />
                  </div>
                  <div>
                    <Label htmlFor="crm">CRM / Conselho</Label>
                    <Input
                      id="crm"
                      value={form.crm}
                      onChange={(e) => setForm((f) => ({ ...f, crm: e.target.value }))}
                      placeholder="Ex.: CRM-MA 12345"
                    />
                  </div>
                  <div>
                    <Label htmlFor="specialty">Especialidade</Label>
                    <Input
                      id="specialty"
                      value={form.specialty}
                      onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                      placeholder="Ex.: Medicina Intensiva"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => navigate(-1)} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar alterações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Segurança ─── */}
        <TabsContent value="seguranca" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Alterar senha agora
              </CardTitle>
              <CardDescription>
                Defina uma nova senha imediatamente. Será aplicada nesta sessão.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="newPassword">Nova senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={pwd.newPassword}
                    onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <Label htmlFor="confirm">Confirmar nova senha</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={pwd.confirm}
                    onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
                    placeholder="Repita a nova senha"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleChangePassword} disabled={pwdSaving}>
                  {pwdSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Atualizar senha
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Redefinição por email
              </CardTitle>
              <CardDescription>
                Receba um link seguro no email <strong>{user?.email}</strong> para criar uma nova senha.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end">
                <Button variant="outline" onClick={handleSendResetEmail} disabled={resetSending}>
                  {resetSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Enviar link de redefinição
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
