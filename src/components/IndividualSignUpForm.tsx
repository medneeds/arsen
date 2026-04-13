import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment, DEPARTMENTS, Department } from "@/contexts/DepartmentContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import {
  User, Lock, Eye, EyeOff, Stethoscope, Phone,
  ArrowLeft, UserPlus, Building2, CheckCircle, Shield, Mail, Briefcase, Hash,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const PROFESSIONAL_TYPES = [
  { value: "medico", label: "Médico(a)" },
  { value: "enfermeiro", label: "Enfermeiro(a)" },
  { value: "tecnico_enfermagem", label: "Técnico(a) de Enfermagem" },
  { value: "fisioterapeuta", label: "Fisioterapeuta" },
  { value: "farmaceutico", label: "Farmacêutico(a)" },
  { value: "psicologo", label: "Psicólogo(a)" },
  { value: "assistente_social", label: "Assistente Social" },
  { value: "nutricionista", label: "Nutricionista" },
  { value: "administrativo", label: "Administrativo" },
  { value: "outro", label: "Outro" },
];

// Dynamic validation
const createSignUpSchema = (professionalType: string) => {
  const base = z.object({
    fullName: z.string().trim()
      .min(3, { message: "Nome completo obrigatório (min. 3 caracteres)" })
      .regex(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s.]+$/, { message: "Nome: apenas letras maiúsculas" }),
    professionalType: z.string().min(1, { message: "Selecione o tipo de profissional" }),
    crm: z.string().optional().or(z.literal("")),
    rqe: z.string().optional().or(z.literal("")),
    specialty: z.string().optional().or(z.literal("")),
    matricula: z.string().optional().or(z.literal("")),
    cargo: z.string().optional().or(z.literal("")),
    phone: z.string().trim().min(10, { message: "Telefone obrigatório" }),
    email: z.string().trim().min(1, { message: "E-mail obrigatório" }).email({ message: "E-mail inválido" }),
    username: z.string().trim()
      .min(3, { message: "Usuário obrigatório (min. 3 caracteres)" })
      .max(30)
      .regex(/^[A-Z0-9.]+$/, { message: "Usuário: apenas maiúsculas e números" }),
    password: z.string()
      .min(6, { message: "Senha deve ter 6 caracteres" })
      .max(6, { message: "Senha deve ter 6 caracteres" })
      .regex(/^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{6}$/, { message: "Senha: 6 caracteres com letras e números" }),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });

  // Add CRM requirement for doctors
  if (professionalType === "medico") {
    return base.refine((data) => data.crm && data.crm.trim().length >= 4, {
      message: "CRM obrigatório para médicos",
      path: ["crm"],
    });
  }

  return base;
};

interface IndividualSignUpFormProps {
  onBack: () => void;
  onSuccess: () => void;
  selectedState: string;
  selectedHospitalId: string;
  selectedDepartment: Department;
  onStateChange: (value: string) => void;
  onHospitalChange: (value: string) => void;
  onDepartmentChange: (value: Department) => void;
}

export function IndividualSignUpForm({
  onBack, onSuccess,
  selectedState, selectedHospitalId, selectedDepartment,
  onStateChange, onHospitalChange, onDepartmentChange,
}: IndividualSignUpFormProps) {
  const { states, hospitals, isLoading: hospitalLoading } = useHospital();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    professionalType: "",
    crm: "",
    rqe: "",
    specialty: "",
    matricula: "",
    cargo: "",
    phone: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const filteredHospitals = selectedState
    ? hospitals.filter(h => h.state_id === selectedState)
    : [];

  const isMedico = formData.professionalType === "medico";
  const isAdministrativo = formData.professionalType === "administrativo";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedState) { toast.error("Selecione um estado"); return; }
    if (!selectedHospitalId) { toast.error("Selecione uma unidade hospitalar"); return; }

    setLoading(true);

    try {
      const schema = createSignUpSchema(formData.professionalType);
      const validated = schema.parse(formData);

      const redirectUrl = `${window.location.origin}/`;
      const internalEmail = `${validated.username.toLowerCase()}@sistema.local`;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: internalEmail,
        password: validated.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: validated.fullName,
            username: validated.username,
            professional_type: validated.professionalType,
            crm: validated.crm || null,
            specialty: validated.specialty || null,
            phone: validated.phone || null,
          },
        },
      });

      if (authError) {
        if (authError.message.includes("User already registered")) {
          toast.error("Usuário já cadastrado");
        } else {
          toast.error("Erro ao cadastrar: " + authError.message);
        }
        setLoading(false);
        return;
      }

      if (authData.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: authData.user.id,
            full_name: validated.fullName,
            email: internalEmail,
            crm: validated.crm || null,
            specialty: validated.specialty || null,
            phone: validated.phone || null,
            professional_type: validated.professionalType,
            matricula: validated.matricula || null,
            cargo: validated.cargo || null,
            status: "pending",
          });

        if (profileError) console.error("Error updating profile:", profileError);

        // Default role based on professional type
        const defaultRole = formData.professionalType === "medico" ? "medico" : "medico";
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: authData.user.id, role: defaultRole });

        if (roleError) console.error("Error assigning role:", roleError);

        await supabase.auth.signOut();
      }

      setSuccess(true);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        toast.error("Erro ao validar dados");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-6 text-center py-8">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-emerald-100 mx-auto">
          <CheckCircle className="h-10 w-10 text-emerald-600" />
        </div>
        <div className="space-y-3">
          <h3 className="text-xl font-bold text-gray-900">Cadastro recebido com sucesso!</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-xs mx-auto">
            <p className="text-[10px] font-semibold text-blue-600 uppercase mb-1">Seu usuário de acesso:</p>
            <p className="text-lg font-bold text-blue-800 tracking-wide">{formData.username}</p>
          </div>
          <p className="text-sm text-gray-600 max-w-xs mx-auto">
            Aguarde a aprovação do <strong>gestor</strong> para liberar seu acesso ao sistema. O gestor definirá seu perfil e setores de atuação.
          </p>
        </div>
        <div className="flex items-center gap-2 justify-center text-xs text-gray-500">
          <Shield className="h-4 w-4" />
          <span>Conforme Lei 13.709/2018 (LGPD)</span>
        </div>
        <Button type="button" variant="outline" onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="text-gray-600 hover:text-gray-900 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar
      </Button>

      {/* Header */}
      <div className="text-center mb-4">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-[#013ba6] to-[#0152d4] shadow-lg mb-3">
          <UserPlus className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">Cadastro de profissional</h2>
        <p className="text-xs text-gray-500">Preencha seus dados para solicitar acesso</p>
      </div>

      {/* Location Section */}
      <div className="space-y-3 pb-3 border-b border-gray-200">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Localização</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-gray-600">Estado</Label>
            <Select value={selectedState} onValueChange={(v) => { onStateChange(v); onHospitalChange(""); }} disabled={loading || hospitalLoading}>
              <SelectTrigger className="h-9 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {states.map((s) => <SelectItem key={s.id} value={s.id} className="text-xs">{s.abbreviation}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-gray-600">Unidade</Label>
            <Select value={selectedHospitalId} onValueChange={onHospitalChange} disabled={loading || hospitalLoading || !selectedState}>
              <SelectTrigger className="h-9 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                {filteredHospitals.map((h) => <SelectItem key={h.id} value={h.id} className="text-xs">{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-gray-600">Setor</Label>
          <Select value={selectedDepartment} onValueChange={(v: Department) => onDepartmentChange(v)} disabled={loading}>
            <SelectTrigger className="h-9 bg-gray-50 border border-gray-200 rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Professional Type */}
      <div className="space-y-3 pb-3 border-b border-gray-200">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Tipo de profissional</p>
        <Select value={formData.professionalType} onValueChange={(v) => setFormData({ ...formData, professionalType: v })} disabled={loading}>
          <SelectTrigger className="h-9 bg-gray-50 border border-gray-200 rounded-lg text-xs">
            <SelectValue placeholder="Selecione sua categoria" />
          </SelectTrigger>
          <SelectContent>
            {PROFESSIONAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Professional Data */}
      <div className="space-y-3 pb-3 border-b border-gray-200">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Dados profissionais</p>

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-gray-600">Nome completo *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value.toUpperCase() })}
              placeholder="Seu nome completo"
              className="h-9 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase"
              disabled={loading}
            />
          </div>
        </div>

        {/* Medical fields - show for doctors */}
        {isMedico && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-gray-600">CRM *</Label>
              <div className="relative">
                <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={formData.crm}
                  onChange={(e) => setFormData({ ...formData, crm: e.target.value.replace(/\D/g, "") })}
                  placeholder="12345"
                  className="h-9 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-gray-600">RQE (Opcional)</Label>
              <div className="relative">
                <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={formData.rqe}
                  onChange={(e) => setFormData({ ...formData, rqe: e.target.value.replace(/\D/g, "") })}
                  placeholder="12345"
                  className="h-9 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        )}

        {/* Specialty for doctors */}
        {isMedico && (
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-gray-600">Especialidade (Opcional)</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value.toUpperCase() })}
                placeholder="Clínico geral, Cardiologista..."
                className="h-9 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase"
                disabled={loading}
              />
            </div>
          </div>
        )}

        {/* Administrative fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-gray-600">Matrícula {isAdministrativo ? "*" : "(Opcional)"}</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={formData.matricula}
                onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                placeholder="Nº matrícula"
                className="h-9 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                disabled={loading}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-gray-600">Cargo/Função {isAdministrativo ? "*" : "(Opcional)"}</Label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value.toUpperCase() })}
                placeholder="Cargo exercido"
                className="h-9 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-gray-600">Telefone (WhatsApp) *</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(99) 99999-9999"
              className="h-9 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              disabled={loading}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-gray-600">E-mail *</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="seu.email@exemplo.com"
              className="h-9 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* Credentials */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Credenciais de acesso</p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <p className="text-[10px] font-bold text-blue-800 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Requisitos de segurança
          </p>
          <ul className="text-[10px] text-blue-700 space-y-1 pl-5 list-disc">
            <li><strong>Usuário:</strong> Apenas letras maiúsculas, números e ponto (.)</li>
            <li><strong>Senha:</strong> Exatamente 6 caracteres (letras + números)</li>
            <li>Seu perfil de acesso será definido pelo <strong>gestor</strong></li>
          </ul>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-gray-600">Usuário *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, '') })}
              placeholder="Escolha seu nome de usuário"
              className="h-9 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase"
              disabled={loading}
              maxLength={30}
            />
          </div>
          <p className="text-[9px] text-gray-500">Este será seu login no sistema (ex: JOAO.SILVA)</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-gray-600">Senha *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                placeholder="ABC123"
                className="h-9 pl-10 pr-9 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                disabled={loading}
                maxLength={6}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-gray-600">Confirmar *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                placeholder="ABC123"
                className="h-9 pl-10 pr-9 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                disabled={loading}
                maxLength={6}
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading || !formData.professionalType}
        className="w-full h-10 bg-gradient-to-r from-[#013ba6] to-[#0152d4] hover:from-[#012d85] hover:to-[#0142b0] text-white font-semibold text-xs rounded-xl shadow-lg transition-all duration-300"
      >
        {loading ? "Cadastrando..." : "Solicitar cadastro"}
      </Button>

      <p className="text-[9px] text-center text-gray-400">
        Ao cadastrar-se, você concorda com os termos de uso e política de privacidade conforme LGPD.
      </p>
    </form>
  );
}
