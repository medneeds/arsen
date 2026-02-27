import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface QuickTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTemplates: (templates: string[]) => void;
  patientName: string;
}

const QUICK_TEMPLATES = [
  "M.O.V.",
  "SOLICITAR INTERNAÇÃO",
  "SOLICITADA INTERNAÇÃO EM UTI (AGUARDANDO PSM)",
  "SOLICITADA INTERNAÇÃO EM UTI (PSM FAVORÁVEL)",
  "IR PARA LEITO DE UTI",
  "SOLICITADA INTERNAÇÃO EM ENFERMARIA (AGUARDANDO PSM)",
  "SOLICITADA INTERNAÇÃO EM ENFERMARIA (PSM FAVORÁVEL)",
  "AGUARDANDO ALOCAÇÃO NO SIGA",
  "IR PARA LEITO DE ENFERMARIA",
  "SOLICITADA INTERNAÇÃO PSIQUIÁTRICA (AGUARDANDO PSM)",
  "IR PARA O INSTITUTO VOLTA VIDA (IVV)",
  "AGUARDANDO EXAMES",
  "IR PARA O CENTRO CIRÚRGICO",
  "INTERNAÇÃO EM UTI NEGADA POR CARÊNCIA CONTRATUAL",
  "INTERNAÇÃO EM ENFERMARIA NEGADA POR CARÊNCIA CONTRATUAL",
  "PSM ORIENTA REALIZAÇÃO DO EXAME VIA PQA",
  "PSM ORIENTA REALIZAÇÃO DO PROCEDIMENTO VIA PQA",
  "PSM ORIENTA PERMANÊNCIA EM OBSERVAÇÃO (PACK 30H) E REDISCUSSÃO APÓS O PERÍODO",
  "SEGUIMENTO CONJUNTO COM TELECARDIO",
  "SEGUIMENTO CONJUNTO COM TELENEURO",
  "ABERTO PROTOCOLO SEPSE (CULTURAS ADMISSIONAIS + ATB EMPÍRICA)",
  "SOLICITADA HEMOTRANSFUSÃO",
  "INICIADA HEMOTRANSFUSÃO",
  "MEDIDAS PARA HIPONATREMIA",
  "MEDIDAS PARA HIPOCALEMIA",
  "MEDIDAS PARA HIPERNATREMIA",
  "MEDIDAS PARA HIPERCALEMIA",
  "SOLICITAR TERAPIA DIALÍTICA"
];

export function QuickTemplatesDialog({ open, onOpenChange, onAddTemplates, patientName }: QuickTemplatesDialogProps) {
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const handleToggleTemplate = (template: string) => {
    setSelectedTemplates(prev => 
      prev.includes(template) 
        ? prev.filter(t => t !== template)
        : [...prev, template]
    );
  };

  const handleAdd = () => {
    if (selectedTemplates.length > 0) {
      onAddTemplates(selectedTemplates);
      setSelectedTemplates([]);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setSelectedTemplates([]);
    setSearchTerm("");
    onOpenChange(false);
  };

  const filteredTemplates = QUICK_TEMPLATES.filter(template =>
    template.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] animate-scale-in">
        <DialogHeader className="space-y-3 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <span className="text-primary font-bold text-lg">⚡</span>
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold tracking-wide uppercase text-primary">
                TEMPLATES RÁPIDOS
              </DialogTitle>
              <p className="text-sm font-semibold text-foreground mt-1 tracking-wide">
                {patientName}
              </p>
            </div>
          </div>
          <DialogDescription className="text-xs uppercase tracking-wider text-muted-foreground">
            SELECIONE OS ITENS PARA ADICIONAR ÀS PROGRAMAÇÕES/PENDÊNCIAS
          </DialogDescription>
        </DialogHeader>

        {/* Barra de pesquisa e botão adicionar no topo */}
        <div className="space-y-3 pb-4 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 uppercase tracking-wide"
            />
          </div>
          <Button 
            onClick={handleAdd}
            disabled={selectedTemplates.length === 0}
            className="w-full uppercase tracking-wider font-bold hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg hover:shadow-xl"
          >
            <span className="mr-2">⚡</span>
            ADICIONAR {selectedTemplates.length > 0 && `(${selectedTemplates.length})`}
          </Button>
        </div>
        
        <ScrollArea className="h-[380px] pr-4 -mr-4">
          <div className="space-y-2 pr-2">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm uppercase tracking-wide">
                  Nenhum template encontrado
                </p>
                <p className="text-muted-foreground text-xs mt-2">
                  Tente outro termo de pesquisa
                </p>
              </div>
            ) : (
              filteredTemplates.map((template, index) => (
              <div 
                key={template} 
                className="group relative flex items-center space-x-3 p-3.5 rounded-xl border border-border/40 bg-gradient-to-r from-card/50 to-card/30 hover:from-accent/15 hover:to-accent/5 hover:border-primary/40 hover:shadow-md hover:scale-[1.02] transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-primary/10 rounded-xl transition-all duration-300" />
                
                <Checkbox
                  id={template}
                  checked={selectedTemplates.includes(template)}
                  onCheckedChange={() => handleToggleTemplate(template)}
                  className="flex-shrink-0 z-10 transition-transform group-hover:scale-110"
                />
                <Label
                  htmlFor={template}
                  className="text-sm font-medium leading-relaxed cursor-pointer flex-1 group-hover:text-primary group-hover:font-semibold transition-all duration-200 z-10"
                >
                  {template}
                </Label>
                <div className="flex items-center gap-2 z-10">
                  <span className="text-xs text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0 translate-x-2">
                    #{String(QUICK_TEMPLATES.indexOf(template) + 1).padStart(2, "0")}
                  </span>
                  {selectedTemplates.includes(template) && (
                    <span className="text-primary animate-scale-in">✓</span>
                  )}
                </div>
              </div>
            ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-2 pt-4 border-t border-border/50">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className="uppercase tracking-wider font-semibold hover:scale-105 transition-transform duration-200"
          >
            CANCELAR
          </Button>
          <Button 
            onClick={handleAdd}
            disabled={selectedTemplates.length === 0}
            className="uppercase tracking-wider font-bold hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg hover:shadow-xl"
          >
            <span className="mr-2">⚡</span>
            ADICIONAR {selectedTemplates.length > 0 && `(${selectedTemplates.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
