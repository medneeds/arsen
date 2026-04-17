import { useState } from "react";
import { usePrivacy, maskName } from "@/contexts/PrivacyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, Edit, ChevronDown, ChevronUp } from "lucide-react";
import { format, parseISO, differenceInDays, eachDayOfInterval, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, eachMonthOfInterval, isSameMonth, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DhdReportDialog } from "./DhdReportDialog";
import { EditDhdPatientDialog } from "./EditDhdPatientDialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DhdPatient {
  id: string;
  patient_name: string;
  patient_age: string | null;
  diagnosis: string | null;
  start_date: string;
  end_date: string;
  medication_schedule: string | null;
  medication_days: string[] | any;
  dhd_report: string | null;
  status: string;
}

interface DhdPatientCardProps {
  patient: DhdPatient;
  onMedicationToggle: (patientId: string, date: string, currentDays: string[]) => void;
  onRefresh: () => void;
}

export function DhdPatientCard({ patient, onMedicationToggle, onRefresh }: DhdPatientCardProps) {
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );

  const startDate = parseISO(patient.start_date);
  const endDate = patient.end_date ? parseISO(patient.end_date) : null;
  const totalDays = endDate ? differenceInDays(endDate, startDate) + 1 : 0;
  const completedDays = patient.medication_days.length;
  const progressPercentage = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;
  const daysRemaining = endDate ? differenceInDays(endDate, new Date()) : null;

  // Generate days based on view mode
  const allDays = endDate ? eachDayOfInterval({ start: startDate, end: endDate }) : [];
  const months = endDate ? eachMonthOfInterval({ start: startDate, end: endDate }) : [];
  
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
  const weekDays = calendarExpanded 
    ? allDays 
    : eachDayOfInterval({ 
        start: currentWeekStart > startDate ? currentWeekStart : startDate,
        end: endDate && weekEnd < endDate ? weekEnd : (endDate || weekEnd)
      });

  // Group days by month for expanded view
  const daysByMonth = months.map(month => ({
    month,
    days: allDays.filter(day => isSameMonth(day, month))
  }));

  const handleDayClick = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    onMedicationToggle(patient.id, dateStr, patient.medication_days);
  };

  const isDayMarked = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return patient.medication_days.includes(dateStr);
  };

  const handlePreviousWeek = () => {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  const canGoPrevious = currentWeekStart > startDate;
  const canGoNext = endDate ? weekEnd < endDate : false;
  const { namesHidden } = usePrivacy();
  const displayName = maskName(patient.patient_name, namesHidden);

  return (
    <>
      <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="patient-id text-lg mb-1">
                {namesHidden ? <span className="tracking-widest opacity-70">{displayName}</span> : patient.patient_name}
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {patient.patient_age && <span>{patient.patient_age}</span>}
                {patient.patient_age && patient.diagnosis && <span>•</span>}
                {patient.diagnosis && (
                  <span className="line-clamp-1">{patient.diagnosis}</span>
                )}
              </div>
              {patient.medication_schedule && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-normal">
                    {patient.medication_schedule}
                  </Badge>
                </div>
              )}
            </div>
            {endDate ? (
              <Badge
                variant={daysRemaining !== null && daysRemaining >= 0 ? "default" : "secondary"}
                className="ml-2"
              >
                {format(endDate, "dd/MM/yyyy")}
              </Badge>
            ) : (
              <Badge variant="outline" className="ml-2">
                Sem data definida
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress Bar */}
          {endDate && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">{completedDays}/{totalDays} dias</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Calendar Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {calendarExpanded ? "Calendário Completo" : "Semana Atual"}
              </p>
              <div className="flex items-center gap-2">
                {!calendarExpanded && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePreviousWeek}
                      disabled={!canGoPrevious}
                      className="h-7 w-7 p-0"
                    >
                      ◄
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNextWeek}
                      disabled={!canGoNext}
                      className="h-7 w-7 p-0"
                    >
                      ►
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCalendarExpanded(!calendarExpanded)}
                  className="h-7 gap-1 text-xs"
                >
                  {calendarExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {calendarExpanded ? "Compactar" : "Expandir"}
                </Button>
              </div>
            </div>
            
            {calendarExpanded ? (
              // Expanded view with months
              <ScrollArea className="h-[400px] w-full rounded-md border">
                <div className="p-4 space-y-6">
                  {daysByMonth.map(({ month, days }) => {
                    const monthStart = startOfMonth(month);
                    const monthEnd = endOfMonth(month);
                    const firstDayOfMonth = getDay(monthStart);
                    
                    // Create empty cells for alignment
                    const emptyCells = Array(firstDayOfMonth).fill(null);
                    
                    return (
                      <div key={month.toString()} className="space-y-3">
                        <h3 className="text-sm font-semibold text-foreground capitalize sticky top-0 bg-background py-2 border-b">
                          {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
                        </h3>
                        
                        {/* Day labels */}
                        <div className="grid grid-cols-7 gap-1 mb-1">
                          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                            <div key={i} className="text-center text-xs font-medium text-muted-foreground">
                              {day}
                            </div>
                          ))}
                        </div>
                        
                        <div className="grid grid-cols-7 gap-1.5">
                          {/* Empty cells for alignment */}
                          {emptyCells.map((_, i) => (
                            <div key={`empty-${i}`} className="aspect-square" />
                          ))}
                          
                          {/* Days of the month */}
                          {days.map((day, index) => {
                            const isMarked = isDayMarked(day);
                            const isPast = day < new Date();
                            const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

                            return (
                              <button
                                key={index}
                                onClick={() => handleDayClick(day)}
                                className={`
                                  aspect-square rounded-lg text-sm font-medium transition-all
                                  ${isMarked
                                    ? "bg-primary text-primary-foreground shadow-md hover:shadow-lg"
                                    : "bg-muted hover:bg-muted/70"}
                                  ${isToday ? "ring-2 ring-primary ring-offset-2" : ""}
                                  ${isPast && !isMarked ? "opacity-40" : ""}
                                `}
                                title={format(day, "dd/MM/yyyy", { locale: ptBR })}
                              >
                                {format(day, "d")}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  
                  {daysByMonth.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Defina uma data de finalização para visualizar o calendário completo
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              // Compact weekly view
              <div>
                {/* Day labels */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                    <div key={i} className="text-center text-xs font-medium text-muted-foreground">
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1.5">
                  {weekDays.length === 0 && (
                    <div className="col-span-7 text-center py-8 text-muted-foreground text-sm">
                      Defina uma data de finalização para visualizar o calendário completo
                    </div>
                  )}
                  {weekDays.map((day, index) => {
                    const isMarked = isDayMarked(day);
                    const isPast = day < new Date();
                    const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

                    return (
                      <button
                        key={index}
                        onClick={() => handleDayClick(day)}
                        className={`
                          aspect-square rounded-lg text-sm font-medium transition-all
                          ${isMarked
                            ? "bg-primary text-primary-foreground shadow-md hover:shadow-lg"
                            : "bg-muted hover:bg-muted/70"}
                          ${isToday ? "ring-2 ring-primary ring-offset-2" : ""}
                          ${isPast && !isMarked ? "opacity-40" : ""}
                        `}
                        title={format(day, "dd/MM/yyyy", { locale: ptBR })}
                      >
                        {format(day, "d")}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Clique nos dias para marcar/desmarcar medicações realizadas
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditDialogOpen(true)}
              className="flex-1 gap-2"
            >
              <Edit className="h-4 w-4" />
              Editar
            </Button>
            {patient.dhd_report && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReportDialogOpen(true)}
                className="flex-1 gap-2"
              >
                <FileText className="h-4 w-4" />
                Ver Relatório
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Dialog */}
      <DhdReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        patient={patient}
      />

      {/* Edit Dialog */}
      <EditDhdPatientDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        patient={patient}
        onUpdate={onRefresh}
      />
    </>
  );
}