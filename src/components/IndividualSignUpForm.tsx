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
  User,
  Lock,
  Eye,
  EyeOff,
  Stethoscope,
  Phone,
  ArrowLeft,
  UserPlus,
  Building2,
  CheckCircle,
  Shield,
  Mail,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Validação com uppercase obrigatório e senha alfanumérica de 6 dígitos
const signUpSchema = z.object({
  fullName: z.string()
    .trim()
    .min(3, { message: "NOME COMPLETO OBRIGATÓRIO (MIN. 3 CARACTERES)" })
    .regex(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s.]+$/, { message: "NOME: APENAS LETRAS MAIÚSCULAS" }),
  crm: z.string()
    .trim()
    .min(4, { message: "CRM OBRIGATÓRIO" })
    .regex(/^[A-Z0-9/\-\s]+$/, { message: "CRM: APENAS MAIÚSCULAS E NÚMEROS" }),
  specialty: z.string()
    .trim()
    .regex(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]*$/, { message: "ESPECIALIDADE: APENAS LETRAS MAIÚSCULAS" })
    .optional()
    .or(z.literal("")),
  phone: z.string()
    .trim()
    .min(10, { message: "TELEFONE OBRIGATÓRIO" }),
  email: z.string()
    .trim()
    .min(1, { message: "E-MAIL OBRIGATÓRIO" })
    .email({ message: "E-MAIL INVÁLIDO" }),
  username: z.string()
    .trim()
    .min(3, { message: "USUÁRIO OBRIGATÓRIO (MIN. 3 CARACTERES)" })
    .max(30)
    .regex(/^[A-Z0-9.]+$/, { message: "USUÁRIO: APENAS MAIÚSCULAS E NÚMEROS" }),
  password: z.string()
    .min(6, { message: "SENHA DEVE TER 6 CARACTERES" })
    .max(6, { message: "SENHA DEVE TER 6 CARACTERES" })
    .regex(/^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{6}$/, { message: "SENHA: 6 CARACTERES COM LETRAS E NÚMEROS" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "SENHAS NÃO CONFEREM",
  path: ["confirmPassword"],
});

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
  onBack,
  onSuccess,
  selectedState,
  selectedHospitalId,
  selectedDepartment,
  onStateChange,
  onHospitalChange,
  onDepartmentChange,
}: IndividualSignUpFormProps) {
  const { states, hospitals, isLoading: hospitalLoading } = useHospital();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    crm: "",
    rqe: "",
    specialty: "",
    phone: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const filteredHospitals = selectedState 
    ? hospitals.filter(h => h.state_id === selectedState)
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedState) {
      toast.error("SELECIONE UM ESTADO");
      return;
    }
    if (!selectedHospitalId) {
      toast.error("SELECIONE UMA UNIDADE HOSPITALAR");
      return;
    }

    setLoading(true);

    try {
      const validated = signUpSchema.parse(formData);
      
      const redirectUrl = `${window.location.origin}/`;
      const internalEmail = `${validated.username.toLowerCase()}@sistema.local`;
      
      // Create user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: internalEmail,
        password: validated.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: validated.fullName,
            username: validated.username,
            crm: validated.crm,
            specialty: validated.specialty,
            phone: validated.phone || null,
          },
        },
      });

      if (authError) {
        if (authError.message.includes("User already registered")) {
          toast.error("USUÁRIO JÁ CADASTRADO");
        } else {
          toast.error("ERRO AO CADASTRAR: " + authError.message.toUpperCase());
        }
        setLoading(false);
        return;
      }

      // If user was created, update their profile with additional info
      if (authData.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: authData.user.id,
            full_name: validated.fullName,
            email: internalEmail,
            crm: validated.crm,
            specialty: validated.specialty,
            phone: validated.phone || null,
            status: "pending", // Requires coordinator approval
          });

        if (profileError) {
          console.error("Error updating profile:", profileError);
        }

        // Assign default role as "medico"
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: authData.user.id,
            role: "medico",
          });

        if (roleError) {
          console.error("Error assigning role:", roleError);
        }

        // Sign out immediately - user needs approval
        await supabase.auth.signOut();
      }

      setSuccess(true);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        toast.error("ERRO AO VALIDAR DADOS");
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
          <h3 className="text-xl font-bold text-gray-900">Cadastro Recebido com Sucesso!</h3>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-xs mx-auto">
            <p className="text-[10px] font-semibold text-blue-600 uppercase mb-1">Seu usuário de acesso:</p>
            <p className="text-lg font-bold text-blue-800 tracking-wide">{formData.username}</p>
          </div>
          
          <p className="text-sm text-gray-600 max-w-xs mx-auto">
            Aguarde a aprovação do <strong>Administrador</strong> para liberar seu acesso ao sistema.
          </p>
        </div>

        <div className="flex items-center gap-2 justify-center text-xs text-gray-500">
          <Shield className="h-4 w-4" />
          <span>Conforme Lei 13.709/2018 (LGPD)</span>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Back button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="text-gray-600 hover:text-gray-900 -ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar
      </Button>

      {/* Header */}
      <div className="text-center mb-4">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-[#013ba6] to-[#0152d4] shadow-lg mb-3">
          <UserPlus className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 uppercase">Cadastro Individual</h2>
        <p className="text-xs text-gray-500">Preencha seus dados profissionais</p>
      </div>

      {/* Location Section */}
      <div className="space-y-3 pb-3 border-b border-gray-200">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">LOCALIZAÇÃO</p>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-gray-600 uppercase">Estado</Label>
            <Select
              value={selectedState}
              onValueChange={(value) => {
                onStateChange(value);
                onHospitalChange("");
              }}
              disabled={loading || hospitalLoading}
            >
              <SelectTrigger className="h-9 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {states.map((state) => (
                  <SelectItem key={state.id} value={state.id} className="text-xs">
                    {state.abbreviation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-gray-600 uppercase">Unidade</Label>
            <Select
              value={selectedHospitalId}
              onValueChange={onHospitalChange}
              disabled={loading || hospitalLoading || !selectedState}
            >
              <SelectTrigger className="h-9 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                {filteredHospitals.map((hospital) => (
                  <SelectItem key={hospital.id} value={hospital.id} className="text-xs">
                    {hospital.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-gray-600 uppercase">Setor</Label>
          <Select
            value={selectedDepartment}
            onValueChange={(value: Department) => onDepartmentChange(value)}
            disabled={loading}
          >
            <SelectTrigger className="h-9 bg-gray-50 border border-gray-200 rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((dept) => (
                <SelectItem key={dept} value={dept} className="text-xs">
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Personal Data Section */}
      <div className="space-y-3 pb-3 border-b border-gray-200">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">DADOS PROFISSIONAIS</p>
        
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-gray-600 uppercase">Nome Completo *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value.toUpperCase() })}
              placeholder="SEU NOME COMPLETO AQUI"
              className="h-9 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase"
              disabled={loading}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-gray-600 uppercase">CRM *</Label>
            <div className="relative">
              <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                value={formData.crm}
                onChange={(e) => setFormData({ ...formData, crm: e.target.value.replace(/\D/g, "") })}
                placeholder="12345"
                className="h-9 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-gray-600 uppercase">RQE (Opcional)</Label>
            <div className="relative">
              <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                value={formData.rqe}
                onChange={(e) => setFormData({ ...formData, rqe: e.target.value.replace(/\D/g, "") })}
                placeholder="12345"
                className="h-9 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-gray-600 uppercase">Telefone (WhatsApp) *</Label>
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
          <Label className="text-[10px] font-semibold text-gray-600 uppercase">E-mail *</Label>
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

        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-gray-600 uppercase">Especialidade (Opcional)</Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              value={formData.specialty}
              onChange={(e) => setFormData({ ...formData, specialty: e.target.value.toUpperCase() })}
              placeholder="CLÍNICO GERAL, CARDIOLOGISTA..."
              className="h-9 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* Credentials Section */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">CREDENCIAIS DE ACESSO</p>
        
        {/* Password Requirements Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <p className="text-[10px] font-bold text-blue-800 uppercase flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Requisitos de Segurança
          </p>
          <ul className="text-[10px] text-blue-700 space-y-1 pl-5 list-disc">
            <li><strong>CRM:</strong> Apenas números</li>
            <li><strong>RQE:</strong> Apenas números (opcional)</li>
            <li><strong>Usuário:</strong> Apenas letras maiúsculas, números e ponto (.)</li>
            <li><strong>Senha:</strong> Exatamente 6 caracteres</li>
            <li>Deve conter <strong>letras</strong> E <strong>números</strong> (ex: ABC123)</li>
            <li>Todos os campos marcados com <strong>*</strong> são obrigatórios</li>
          </ul>
        </div>
        
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold text-gray-600 uppercase">Usuário *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, '') })}
              onBlur={(e) => setFormData({ ...formData, username: e.target.value.toUpperCase() })}
              placeholder="ESCOLHA SEU NOME DE USUÁRIO PARA LOGIN"
              className="h-9 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase"
              disabled={loading}
              maxLength={30}
            />
          </div>
          <p className="text-[9px] text-gray-500">Este será seu login no sistema (ex: JOAO.SILVA)</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-gray-600 uppercase">Senha *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) })}
                placeholder="ABC123"
                className="h-9 pl-10 pr-9 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase tracking-widest"
                disabled={loading}
                maxLength={6}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            </div>
            <p className="text-[9px] text-gray-500">{formData.password.length}/6 caracteres</p>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-gray-600 uppercase">Confirmar *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) })}
                placeholder="ABC123"
                className="h-9 pl-10 pr-9 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase tracking-widest"
                disabled={loading}
                maxLength={6}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            </div>
            <p className="text-[9px] text-gray-500">{formData.confirmPassword.length}/6 caracteres</p>
          </div>
        </div>
        
        {/* Password match indicator */}
        {formData.password.length === 6 && formData.confirmPassword.length > 0 && (
          <div className={`flex items-center gap-1.5 text-[10px] ${formData.password === formData.confirmPassword ? 'text-emerald-600' : 'text-red-500'}`}>
            {formData.password === formData.confirmPassword ? (
              <>
                <CheckCircle className="h-3.5 w-3.5" />
                <span>Senhas conferem</span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" />
                <span>Senhas não conferem</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 bg-gradient-to-r from-[#013ba6] to-[#0152d4] hover:from-[#012d80] hover:to-[#013ba6] text-white font-bold uppercase rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl"
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Processando...</span>
          </div>
        ) : (
          <span className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Solicitar Cadastro
          </span>
        )}
      </Button>

      {/* LGPD Notice */}
      <p className="text-[9px] text-center text-gray-400">
        Ao se cadastrar, você concorda com o tratamento de seus dados conforme a LGPD (Lei 13.709/2018).
        Seu acesso será liberado após aprovação do coordenador.
      </p>
    </form>
  );
}
