import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, TrendingUp, Search, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExamCurvesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCurves: (curves: string[]) => void;
  patientName?: string;
}

interface ExamTemplate {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
}

const EXAM_TEMPLATES: ExamTemplate[] = [
  { id: 'sodio', name: 'SÓDIO', abbreviation: 'Na', color: 'from-blue-500 to-cyan-500' },
  { id: 'potassio', name: 'POTÁSSIO', abbreviation: 'K', color: 'from-rose-500 to-pink-500' },
  { id: 'troponina', name: 'TROPONINA', abbreviation: 'TROP', color: 'from-red-500 to-orange-500' },
  { id: 'cpk', name: 'CPK', abbreviation: 'CPK', color: 'from-amber-500 to-yellow-500' },
  { id: 'leucocitos', name: 'LEUCÓCITOS', abbreviation: 'LEUCO', color: 'from-green-500 to-emerald-500' },
  { id: 'creatinina', name: 'CREATININA', abbreviation: 'Cr', color: 'from-teal-500 to-cyan-500' },
  { id: 'ureia', name: 'UREIA', abbreviation: 'Ur', color: 'from-indigo-500 to-blue-500' },
  { id: 'hemoglobina', name: 'HEMOGLOBINA', abbreviation: 'Hb', color: 'from-rose-500 to-red-500' },
  { id: 'plaquetas', name: 'PLAQUETAS', abbreviation: 'Plaq', color: 'from-sky-500 to-blue-500' },
  { id: 'pcr', name: 'PCR', abbreviation: 'PCR', color: 'from-orange-500 to-amber-500' },
  { id: 'lactato', name: 'LACTATO', abbreviation: 'Lac', color: 'from-lime-500 to-green-500' },
];

interface ExamValues {
  [examId: string]: string[];
}

export function ExamCurvesDialog({
  open,
  onOpenChange,
  onAddCurves,
  patientName,
}: ExamCurvesDialogProps) {
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [examValues, setExamValues] = useState<ExamValues>({});
  const [searchTerm, setSearchTerm] = useState('');

  const handleToggleExam = (examId: string) => {
    setSelectedExams((prev) => {
      if (prev.includes(examId)) {
        // Remove exam and its values
        const newValues = { ...examValues };
        delete newValues[examId];
        setExamValues(newValues);
        return prev.filter((id) => id !== examId);
      } else {
        // Add exam with one empty value field
        setExamValues((prevValues) => ({
          ...prevValues,
          [examId]: [''],
        }));
        return [...prev, examId];
      }
    });
  };

  const handleAddValueField = (examId: string) => {
    setExamValues((prev) => ({
      ...prev,
      [examId]: [...(prev[examId] || []), ''],
    }));
  };

  const handleRemoveValueField = (examId: string, index: number) => {
    setExamValues((prev) => ({
      ...prev,
      [examId]: prev[examId].filter((_, i) => i !== index),
    }));
  };

  const handleValueChange = (examId: string, index: number, value: string) => {
    setExamValues((prev) => ({
      ...prev,
      [examId]: prev[examId].map((v, i) => (i === index ? value : v)),
    }));
  };

  const handleAdd = () => {
    const curves = selectedExams
      .map((examId) => {
        const exam = EXAM_TEMPLATES.find((e) => e.id === examId);
        const values = examValues[examId]?.filter((v) => v.trim() !== '') || [];
        
        if (exam && values.length > 0) {
          return `${exam.abbreviation}: ${values.join(' > ').toUpperCase()}`;
        }
        return null;
      })
      .filter((curve): curve is string => curve !== null);

    if (curves.length > 0) {
      onAddCurves(curves);
      handleCancel();
    }
  };

  const handleCancel = () => {
    setSelectedExams([]);
    setExamValues({});
    setSearchTerm('');
    onOpenChange(false);
  };

  const filteredExams = EXAM_TEMPLATES.filter((exam) =>
    exam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exam.abbreviation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header com gradiente */}
        <DialogHeader className="px-6 py-4 bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">Curvas de Exames</DialogTitle>
                {patientName && (
                  <p className="text-xs text-muted-foreground mt-0.5">{patientName}</p>
                )}
              </div>
            </div>
            {selectedExams.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full animate-in fade-in zoom-in duration-300">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">
                  {selectedExams.length} selecionado{selectedExams.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Barra de pesquisa */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar exames..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-9 h-10 bg-background/50 border-muted-foreground/20 focus:border-primary transition-all"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchTerm('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Conteúdo com scroll */}
        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-4">
            {filteredExams.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Nenhum exame encontrado</p>
              </div>
            ) : (
              filteredExams.map((exam) => (
                <div
                  key={exam.id}
                  className={cn(
                    "rounded-xl border-2 transition-all duration-300",
                    selectedExams.includes(exam.id)
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                      : "border-border/50 bg-card hover:border-border hover:shadow-md"
                  )}
                >
                  <div className="p-4">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={exam.id}
                        checked={selectedExams.includes(exam.id)}
                        onCheckedChange={() => handleToggleExam(exam.id)}
                        className="h-5 w-5"
                      />
                      <Label
                        htmlFor={exam.id}
                        className="flex-1 flex items-center gap-3 cursor-pointer"
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold shadow-md",
                          exam.color
                        )}>
                          {exam.abbreviation}
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{exam.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {exam.abbreviation}
                          </div>
                        </div>
                      </Label>
                    </div>

                    {selectedExams.includes(exam.id) && (
                      <div className="mt-4 space-y-2 animate-in slide-in-from-top-2 duration-300">
                        <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                          <TrendingUp className="h-3 w-3" />
                          Valores da curva
                        </div>
                        {examValues[exam.id]?.map((value, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Input
                                placeholder={`Valor ${index + 1}`}
                                value={value}
                                onChange={(e) =>
                                  handleValueChange(exam.id, index, e.target.value)
                                }
                                className="h-9 pr-8"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                {index > 0 && '>'}
                              </span>
                            </div>
                            {examValues[exam.id].length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveValueField(exam.id, index)}
                                className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddValueField(exam.id)}
                          className="w-full h-8 text-xs gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary transition-all"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Adicionar Valor
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer com botões */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/30 gap-2">
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selectedExams.length === 0}
            className="flex-1 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all"
          >
            <TrendingUp className="h-4 w-4" />
            Adicionar {selectedExams.length > 0 && `(${selectedExams.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
