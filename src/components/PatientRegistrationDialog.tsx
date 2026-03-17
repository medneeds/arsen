import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { Camera, Upload, User, MapPin, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PatientRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface PatientFormData {
  patient_name: string;
  social_name: string;
  mother_name: string;
  birth_date: string;
  sex: string;
  cpf: string;
  cns: string;
  medical_record: string;
  phone: string;
  address: string;
  neighborhood: string;
  city: string;
  destination_sector: string;
  notes: string;
}

const EMPTY_FORM: PatientFormData = {
  patient_name: "",
  social_name: "",
  mother_name: "",
  birth_date: "",
  sex: "",
  cpf: "",
  cns: "",
  medical_record: "",
  phone: "",
  address: "",
  neighborhood: "",
  city: "",
  destination_sector: "",
  notes: "",
};

const SECTORS = [
  "UTI 1", "UTI 2", "UCI 1", "UCI 2",
  "Cuidados Especiais", "Observação Amarela", "Observação Azul",
  "Enfermaria", "Centro Cirúrgico"
];

export function PatientRegistrationDialog({ open, onOpenChange, onSuccess }: PatientRegistrationDialogProps) {
  const [activeTab, setActiveTab] = useState("ai");
  const [form, setForm] = useState<PatientFormData>(EMPTY_FORM);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { selectedHospitalId, selectedStateId } = useHospital();
  const { currentDepartment } = useDepartment();

  const updateField = (field: keyof PatientFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10MB", variant: "destructive" });
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewImage(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Convert to base64
    setIsExtracting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const response = await supabase.functions.invoke("extract-patient-data", {
        body: { imageBase64: base64, mimeType: file.type },
      });

      if (response.error) throw new Error(response.error.message);
      
      const { data } = response.data;
      if (data) {
        setForm(prev => ({
          ...prev,
          patient_name: data.patient_name || prev.patient_name,
          mother_name: data.mother_name || prev.mother_name,
          birth_date: data.birth_date || prev.birth_date,
          sex: data.sex || prev.sex,
          cpf: data.cpf || prev.cpf,
          cns: data.cns || prev.cns,
          phone: data.phone || prev.phone,
          address: data.address || prev.address,
          neighborhood: data.neighborhood || prev.neighborhood,
          city: data.city || prev.city,
        }));
        setActiveTab("dados");
        toast({ title: "✅ Dados extraídos com sucesso!", description: "Revise os campos preenchidos pela IA" });
      }
    } catch (err) {
      console.error("AI extraction error:", err);
      toast({ title: "Erro na extração", description: "Não foi possível extrair dados. Preencha manualmente.", variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!form.patient_name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    if (!form.birth_date) {
      toast({ title: "Data de nascimento obrigatória", variant: "destructive" });
      return;
    }
    if (!form.sex) {
      toast({ title: "Sexo obrigatório", variant: "destructive" });
      return;
    }

    if (!selectedHospitalId || !selectedStateId) {
      toast({ title: "Selecione um hospital", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("pre_admissions").insert({
        patient_name: form.patient_name.trim().toUpperCase(),
        social_name: form.social_name?.trim() || null,
        mother_name: form.mother_name?.trim() || null,
        birth_date: form.birth_date || null,
        sex: form.sex || null,
        cpf: form.cpf?.replace(/\D/g, "") || null,
        cns: form.cns?.replace(/\D/g, "") || null,
        medical_record: form.medical_record?.trim() || null,
        phone: form.phone?.trim() || null,
        address: form.address?.trim() || null,
        neighborhood: form.neighborhood?.trim() || null,
        city: form.city?.trim() || null,
        destination_sector: form.destination_sector || null,
        notes: form.notes?.trim() || null,
        hospital_unit_id: selectedHospitalId,
        state_id: selectedStateId,
        department: currentDepartment,
        created_by: userData?.user?.id || null,
        status: "pre_admissao",
      });

      if (error) throw error;

      toast({ title: "✅ Paciente cadastrado!", description: "Aguardando classificação de risco" });
      setForm(EMPTY_FORM);
      setPreviewImage(null);
      setActiveTab("ai");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Save error:", err);
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setPreviewImage(null);
    setActiveTab("ai");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            Cadastrar Paciente (Pré-Admissão)
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ai" className="text-xs gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              Importar com IA
            </TabsTrigger>
            <TabsTrigger value="dados" className="text-xs gap-1">
              <User className="h-3.5 w-3.5" />
              Dados do Paciente
            </TabsTrigger>
            <TabsTrigger value="destino" className="text-xs gap-1">
              <MapPin className="h-3.5 w-3.5" />
              Setor Destino
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: AI Import */}
          <TabsContent value="ai" className="space-y-4 mt-4">
            <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
              <CardContent className="p-6 text-center space-y-4">
                <div className="flex flex-col items-center gap-2">
                  <Camera className="h-10 w-10 text-primary/60" />
                  <h3 className="font-semibold">Upload de Documento</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Fotografe ou faça upload de um documento de identidade (RG, CNH, Cartão SUS). 
                    A IA extrairá automaticamente os dados do paciente.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isExtracting}
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Extraindo dados...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Selecionar Imagem
                      </>
                    )}
                  </Button>
                </div>

                {previewImage && (
                  <div className="mt-4">
                    <img src={previewImage} alt="Documento" className="max-h-48 mx-auto rounded-lg border shadow-sm" />
                  </div>
                )}

                {isExtracting && (
                  <div className="flex items-center gap-2 justify-center text-sm text-primary">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    Analisando documento com Inteligência Artificial...
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              Você também pode preencher os dados manualmente na aba "Dados do Paciente"
            </div>
          </TabsContent>

          {/* Tab 2: Patient Data */}
          <TabsContent value="dados" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs font-semibold">Nome Completo *</Label>
                <Input value={form.patient_name} onChange={e => updateField("patient_name", e.target.value)} placeholder="Nome completo do paciente" className="uppercase" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Nome Social</Label>
                <Input value={form.social_name} onChange={e => updateField("social_name", e.target.value)} placeholder="Nome social (se aplicável)" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Nome da Mãe</Label>
                <Input value={form.mother_name} onChange={e => updateField("mother_name", e.target.value)} placeholder="Nome completo da mãe" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Data de Nascimento *</Label>
                <Input type="date" value={form.birth_date} onChange={e => updateField("birth_date", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold">Sexo *</Label>
                <Select value={form.sex} onValueChange={v => updateField("sex", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">CPF</Label>
                <Input value={form.cpf} onChange={e => updateField("cpf", e.target.value)} placeholder="000.000.000-00" />
              </div>
              <div>
                <Label className="text-xs">CNS</Label>
                <Input value={form.cns} onChange={e => updateField("cns", e.target.value)} placeholder="Cartão Nacional de Saúde" />
              </div>
              <div>
                <Label className="text-xs">Prontuário</Label>
                <Input value={form.medical_record} onChange={e => updateField("medical_record", e.target.value)} placeholder="Nº prontuário" />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={form.phone} onChange={e => updateField("phone", e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Endereço</Label>
                <Input value={form.address} onChange={e => updateField("address", e.target.value)} placeholder="Rua, número" />
              </div>
              <div>
                <Label className="text-xs">Bairro</Label>
                <Input value={form.neighborhood} onChange={e => updateField("neighborhood", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Cidade</Label>
                <Input value={form.city} onChange={e => updateField("city", e.target.value)} />
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Destination */}
          <TabsContent value="destino" className="space-y-4 mt-4">
            <div>
              <Label className="text-xs font-semibold">Setor de Destino</Label>
              <Select value={form.destination_sector} onValueChange={v => updateField("destination_sector", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                <SelectContent>
                  {SECTORS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea
                value={form.notes}
                onChange={e => updateField("notes", e.target.value)}
                placeholder="Informações adicionais sobre o paciente..."
                rows={3}
              />
            </div>

            {/* Summary */}
            {form.patient_name && (
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-1 text-sm">
                  <p className="font-semibold">{form.patient_name.toUpperCase()}</p>
                  {form.birth_date && <p className="text-muted-foreground">Nascimento: {new Date(form.birth_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>}
                  {form.sex && <p className="text-muted-foreground">Sexo: {form.sex === 'M' ? 'Masculino' : form.sex === 'F' ? 'Feminino' : 'Outro'}</p>}
                  {form.cpf && <p className="text-muted-foreground">CPF: {form.cpf}</p>}
                  {form.destination_sector && <p className="text-muted-foreground">Destino: {form.destination_sector}</p>}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving || !form.patient_name || !form.birth_date || !form.sex}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Cadastrar Paciente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
