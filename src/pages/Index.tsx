import { useState, useEffect } from "react";
import { SectorSection } from "@/components/SectorSection";
import { UtiSectorSection } from "@/components/UtiSectorSection";
import { PreAdmissionSection } from "@/components/PreAdmissionSection";
import { PatientCard } from "@/components/PatientCard";
import { PatientSidebar } from "@/components/PatientSidebar";
import { PrintLayout } from "@/components/PrintLayout";
import { PrintUtiLayout } from "@/components/PrintUtiLayout";
import { PrintPatientLayout } from "@/components/PrintPatientLayout";
import { PrintPatientPreviewDialog } from "@/components/PrintPatientPreviewDialog";
import { PrintMapPreviewDialog } from "@/components/PrintMapPreviewDialog";
import { PrintUtiPreviewDialog } from "@/components/PrintUtiPreviewDialog";
import { LoadingScreen } from "@/components/LoadingScreen";
import { MainLayout } from "@/components/MainLayout";
import { ShiftReminderDialog } from "@/components/ShiftReminderDialog";
import { Patient, SectorType } from "@/types/patient";
import { Activity, Users, Clock, Printer, Eye, EyeOff, ClipboardList, LogOut, CheckSquare, Trash2, Undo, Redo, Plus, StickyNote, Edit, List, X, FileText, ChevronDown, GripVertical, ClipboardCheck, Save, MoreVertical, Building2, RefreshCw, Bell, Maximize2, Minimize2, Search, ArrowLeftRight } from "lucide-react";
import { SECTOR_BED_CONFIG } from "@/utils/bedNaming";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NotificationCenter } from "@/components/NotificationCenter";
import { GlobalSearchDialog } from "@/components/GlobalSearchDialog";
import { BedAllocationNotifications } from "@/components/BedAllocationNotifications";
import { DoorPatientNotifications } from "@/components/DoorPatientNotifications";
import { RequestNewAllocationDialog } from "@/components/RequestNewAllocationDialog";
import { RequestUtiAllocationDialog } from "@/components/RequestUtiAllocationDialog";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartment, DEPARTMENTS, Department } from "@/contexts/DepartmentContext";
import { supabase } from "@/integrations/supabase/client";
import { usePrivacy } from "@/contexts/PrivacyContext";
import { getNextBedNumber } from "@/utils/bedNaming";
import { RegisterHandoverDialog } from "@/components/RegisterHandoverDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import NotesTabOptimized from "@/components/resources/NotesTabOptimized";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePatients } from "@/hooks/usePatients";
import { usePatientVersions } from "@/hooks/usePatientVersions";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const STORAGE_KEY = "hospital_patients_data";
const HISTORY_KEY = "hospital_patients_history";
const REDO_HISTORY_KEY = "hospital_patients_redo_history";
const NOTES_KEY = "hospital_notes";
const CHECKLIST_KEY = "hospital_checklist";

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

// Helper component for draggable patient cards
interface SortableOutsidePatientCardProps {
  patient: Patient;
  onUpdate: (patient: Patient) => void;
  onDelete?: (patientId: string) => void;
  onUndelete?: (patient: Patient) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (patientId: string) => void;
  onTransfer?: (patientId: string, newSector: Patient['sector']) => void;
  onPrintPatient?: (patientId: string) => void;
  onRefetch?: () => void;
  onQuickView?: (patient: Patient) => void;
}

function SortableOutsidePatientCard(props: SortableOutsidePatientCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.patient.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded flex-shrink-0 print:hidden"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="flex-1">
        <PatientCard {...props} />
      </div>
    </div>
  );
}

// Componente interno que pode usar useSidebar
function DynamicHeader({ children }: { children: React.ReactNode }) {
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  
  return (
    <header 
      className="border-b border-white/10 bg-gradient-to-r from-[#0a1628] via-[#0f2847] to-[#1a3a5c] backdrop-blur-xl fixed top-0 right-0 z-50 shadow-lg print:static print:border-b print:shadow-none print:mb-1 print:pb-0.5 transition-[left] duration-200 ease-linear"
      style={{
        left: isMobile ? 0 : (state === 'collapsed' ? 'var(--sidebar-width-icon)' : 'var(--sidebar-width)')
      }}
    >
      {children}
    </header>
  );
}

const Index = () => {
  // Use department context
  const { currentDepartment, setCurrentDepartment } = useDepartment();
  
  // Selected sector from login
  const [activeSector, setActiveSector] = useState<SectorType>(() => {
    return (localStorage.getItem("selected_sector") as SectorType) || "red";
  });
  
  // Persist active sector changes
  const handleSectorChange = (sector: string) => {
    setActiveSector(sector as SectorType);
    localStorage.setItem("selected_sector", sector);
  };

  // Sector visual config
  const SECTOR_VISUAL: Record<string, { title: string; color: string; dotClass: string; colorVariant: string }> = {
    red: { title: "UTI 1", color: "from-emerald-500/20 to-emerald-600/10", dotClass: "bg-emerald-500/80 border-emerald-400/40", colorVariant: "green" },
    yellow: { title: "UTI 2", color: "from-emerald-500/20 to-emerald-600/10", dotClass: "bg-emerald-500/80 border-emerald-400/40", colorVariant: "green" },
    blue: { title: "UCI 1", color: "from-emerald-500/20 to-emerald-600/10", dotClass: "bg-emerald-500/80 border-emerald-400/40", colorVariant: "green" },
    outside: { title: "UCI 2", color: "from-emerald-500/20 to-emerald-600/10", dotClass: "bg-emerald-500/80 border-emerald-400/40", colorVariant: "green" },
  };
  
  // Use real database patients filtered by department
  const { patients: dbPatients, isLoading: patientsLoading, updatePatient: dbUpdatePatient, createPatient: dbCreatePatient, deletePatient: dbDeletePatient, reorderPatients: dbReorderPatients, refetch } = usePatients(currentDepartment);
  const [patients, setPatients] = useState<Patient[]>(dbPatients);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [history, setHistory] = useState<Patient[][]>(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [redoHistory, setRedoHistory] = useState<Patient[][]>(() => {
    const saved = localStorage.getItem(REDO_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [notes, setNotes] = useState<string>(() => {
    const saved = localStorage.getItem(NOTES_KEY);
    return saved || "";
  });
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    const saved = localStorage.getItem(CHECKLIST_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [isOutsideSectionOpen, setIsOutsideSectionOpen] = useState(false);
  const [isNotesSectionOpen, setIsNotesSectionOpen] = useState(false);
  const [printingSector, setPrintingSector] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<'compact' | 'detailed' | null>(null);
  const [printingPatientId, setPrintingPatientId] = useState<string | null>(null);
  const [previewPatientId, setPreviewPatientId] = useState<string | null>(null);
  const [previewMapMode, setPreviewMapMode] = useState<'compact' | 'detailed' | null>(null);
  const [previewUtiMapMode, setPreviewUtiMapMode] = useState<'compact' | 'detailed' | null>(null);
  const [showOnlyOccupied, setShowOnlyOccupied] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());
  const [isDeleteSelectedDialogOpen, setIsDeleteSelectedDialogOpen] = useState(false);
  const [handoverDialogOpen, setHandoverDialogOpen] = useState(false);
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [allocationTargetSector, setAllocationTargetSector] = useState<"Cuidados Especiais" | "Observação Amarela" | "Observação Azul">("Cuidados Especiais");
  const [utiAllocationDialogOpen, setUtiAllocationDialogOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { toast } = useToast();
  const { signOut, user, role, allowedDepartments, loading: authLoading } = useAuth();
  const { saveVersion, fetchVersions } = usePatientVersions();
  const isMobile = useIsMobile();
  const { namesHidden, toggleNamesHidden } = usePrivacy();

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEndOutside = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = outsidePatients.findIndex((p) => p.id === active.id);
      const newIndex = outsidePatients.findIndex((p) => p.id === over.id);
      
      const reorderedPatients = arrayMove(outsidePatients, oldIndex, newIndex);
      handleReorderPatients("outside", reorderedPatients);
    }
  };

  // Persist patients data to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
  }, [patients]);

  // Sync database patients to local state
  useEffect(() => {
    if (dbPatients.length > 0) {
      setPatients(dbPatients);
    }
  }, [dbPatients]);

  // Persist history to localStorage
  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  // Persist redo history to localStorage
  useEffect(() => {
    localStorage.setItem(REDO_HISTORY_KEY, JSON.stringify(redoHistory));
  }, [redoHistory]);

  // Persist notes to localStorage
  useEffect(() => {
    localStorage.setItem(NOTES_KEY, notes);
  }, [notes]);

  // Persist checklist to localStorage
  useEffect(() => {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(checklist));
  }, [checklist]);

  // Fullscreen API handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        toast({
          title: "Erro ao entrar em tela cheia",
          description: "Não foi possível ativar o modo de tela cheia.",
          variant: "destructive",
        });
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Auto-expand/collapse sections based on content
  useEffect(() => {
    const red = patients.filter((p) => p.sector === "red");
    const yellow = patients.filter((p) => p.sector === "yellow");
    const blue = patients.filter((p) => p.sector === "blue");
    const outside = patients.filter((p) => p.sector === "outside");
    
    // Auto-manage "Fora das Alas" section based on patient count
    setIsOutsideSectionOpen(outside.length > 0);
  }, [patients]);

  const saveToHistory = (currentPatients: Patient[]) => {
    setHistory(prev => [...prev.slice(-9), currentPatients]); // Keep last 10 states
    setRedoHistory([]); // Clear redo history when new action is performed
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    
    const newItem: ChecklistItem = {
      id: `checklist-${Date.now()}`,
      text: newChecklistItem.toUpperCase(),
      completed: false
    };
    
    setChecklist(prev => [...prev, newItem]);
    setNewChecklistItem("");
  };

  const handleToggleChecklistItem = (id: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const handleRemoveChecklistItem = (id: string) => {
    setChecklist(prev => prev.filter(item => item.id !== id));
  };
  
  const filterPatients = (sectorPatients: Patient[]) => {
    let filtered = sectorPatients;
    
    // Filter by occupied status if enabled
    if (showOnlyOccupied) {
      filtered = filtered.filter(p => p.name.trim() !== "");
    }
    
    return filtered;
  };

  const redPatients = filterPatients(patients.filter((p) => p.sector === "red"));
  const yellowPatients = filterPatients(patients.filter((p) => p.sector === "yellow"));
  const bluePatients = filterPatients(patients.filter((p) => p.sector === "blue"));
  const outsidePatients = filterPatients(patients.filter((p) => p.sector === "outside"));

  const totalPatients = patients.length;
  const criticalPatients = redPatients.length;

  const handleUpdatePatient = async (updatedPatient: Patient) => {
    saveToHistory(patients);
    
    try {
      // Update in database
      await dbUpdatePatient(updatedPatient.id, updatedPatient);
      
      // Update local state (will be synced by realtime)
      setPatients((prev) =>
        prev.map((p) => (p.id === updatedPatient.id ? updatedPatient : p))
      );
    } catch (error) {
      // Error toast already shown in dbUpdatePatient
      console.error("Failed to update patient:", error);
    }
  };

  const handleAddExtraBed = async (sector: Patient['sector']) => {
    // Visitante users cannot add beds
    if (role === 'visitante') {
      toast({
        title: "Acesso restrito",
        description: "Usuários visitantes não podem adicionar leitos.",
        variant: "destructive"
      });
      return;
    }

    // For porta users, clicking on specialized sectors opens allocation request dialog
    if (role === 'porta' && (sector === 'red' || sector === 'yellow' || sector === 'blue')) {
      const sectorMap: Record<string, "Cuidados Especiais" | "Observação Amarela" | "Observação Azul"> = {
        'red': 'Cuidados Especiais',
        'yellow': 'Observação Amarela',
        'blue': 'Observação Azul',
      };
      setAllocationTargetSector(sectorMap[sector]);
      setAllocationDialogOpen(true);
      return;
    }

    saveToHistory(patients);
    
    // Buscar todos os pacientes deste setor do banco de dados para garantir unicidade
    const { data: allSectorPatients } = await supabase
      .from('patients')
      .select('bed_number')
      .eq('sector', sector)
      .eq('department', currentDepartment);
    
    const existingBedNumbers = (allSectorPatients || []).map(p => p.bed_number);
    const newBedNumber = getNextBedNumber(sector, existingBedNumbers, currentDepartment);
    
    const newPatientData: Omit<Patient, 'id'> = {
      bedNumber: newBedNumber,
      name: "",
      age: 0,
      sector: sector,
      diagnoses: [],
      medicalHistory: [],
      relevantExams: [],
      pendencies: [],
      schedule: [],
      admissionHistory: "",
      admissionDate: new Date().toISOString().slice(0, 16).replace('T', ' '),
      highlightedPendencies: [],
      // Add UTI fields for UTI department
      ...(currentDepartment === 'UTI' && {
        utiAdmissionDate: [],
        utiDischargePrediction: [],
        utiAllergies: [],
        utiAdmissionReason: [],
        utiCurrentStatus: [],
        utiDevices: [],
        utiCulturesAntibiotics: [],
        utiSpecialties: [],
        utiOriginSector: [],
      })
    };

    try {
      const createdPatient = await dbCreatePatient(newPatientData, currentDepartment);

      // Scroll automático para o novo leito criado após pequeno delay para garantir renderização
      setTimeout(() => {
        const patientElement = document.querySelector(`[data-patient-id="${createdPatient.id}"]`);
        if (patientElement) {
          patientElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }
      }, 100);
    } catch (error) {
      console.error("Failed to create patient:", error);
    }
  };

  const handleDeletePatient = async (patientId: string) => {
    saveToHistory(patients);
    try {
      await dbDeletePatient(patientId);
    } catch (error) {
      console.error("Failed to delete patient:", error);
    }
  };

  const handleUndeletePatient = async (patient: Patient) => {
    try {
      await dbCreatePatient({
        bedNumber: patient.bedNumber,
        name: patient.name,
        age: patient.age,
        sector: patient.sector,
        diagnoses: patient.diagnoses,
        medicalHistory: patient.medicalHistory,
        relevantExams: patient.relevantExams,
        pendencies: patient.pendencies,
        highlightedPendencies: patient.highlightedPendencies,
        schedule: patient.schedule,
        admissionHistory: patient.admissionHistory,
        admissionDate: patient.admissionDate,
        medicalResponsibility: patient.medicalResponsibility,
        // Include UTI fields
        utiAdmissionDate: patient.utiAdmissionDate,
        utiDischargePrediction: patient.utiDischargePrediction,
        utiAllergies: patient.utiAllergies,
        utiAdmissionReason: patient.utiAdmissionReason,
        utiCurrentStatus: patient.utiCurrentStatus,
        utiDevices: patient.utiDevices,
        utiCulturesAntibiotics: patient.utiCulturesAntibiotics,
        utiSpecialties: patient.utiSpecialties,
        utiOriginSector: patient.utiOriginSector,
      }, currentDepartment);
      toast({
        title: "Exclusão desfeita",
        description: `Leito ${patient.bedNumber} - ${patient.name} foi restaurado.`,
      });
    } catch (error) {
      console.error("Failed to restore patient:", error);
      toast({
        title: "Erro ao restaurar",
        description: "Não foi possível restaurar o leito.",
        variant: "destructive",
      });
    }
  };

  const handleToggleSelection = (patientId: string) => {
    setSelectedPatients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(patientId)) {
        newSet.delete(patientId);
      } else {
        newSet.add(patientId);
      }
      return newSet;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedPatients.size === 0) return;
    setIsDeleteSelectedDialogOpen(true);
  };

  const confirmDeleteSelected = async () => {
    if (selectedPatients.size === 0) return;
    
    saveToHistory(patients);
    const selectedCount = selectedPatients.size;
    const selectedPatientsList = Array.from(selectedPatients);
    
    try {
      // Delete all selected patients from database in parallel (without toasts or local state updates)
      await Promise.all(
        selectedPatientsList.map(patientId => 
          dbDeletePatient(patientId, { showToast: false, updateLocalState: false })
        )
      );
      
      // Update local state once after all deletions
      setPatients(prev => prev.filter(p => !selectedPatients.has(p.id)));
      
      toast({
        title: "Pacientes excluídos",
        description: `${selectedCount} leito(s) removido(s) com sucesso.`,
      });
      
      setSelectedPatients(new Set());
      setSelectionMode(false);
      setIsDeleteSelectedDialogOpen(false);
    } catch (error) {
      console.error("Failed to delete selected patients:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir alguns pacientes.",
        variant: "destructive",
      });
    }
  };

  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedPatients(new Set());
  };

  const handleReorderPatients = async (sector: Patient['sector'], reorderedPatients: Patient[]) => {
    saveToHistory(patients);
    
    // Manter pacientes de outros setores e substituir os do setor reordenado
    const otherSectorPatients = patients.filter(p => p.sector !== sector);
    const newPatients = [...otherSectorPatients, ...reorderedPatients];
    
    // Update local state immediately for responsive UX
    setPatients(newPatients);
    
    try {
      // Persist reorder to database
      await dbReorderPatients(reorderedPatients);
      toast({
        title: "Ordem salva",
        description: "A nova ordem foi salva com sucesso.",
      });
    } catch (error) {
      console.error('Error persisting reorder:', error);
      // Local state already updated, don't revert for better UX
    }
  };

  const handleTransferPatient = async (patientId: string, newSector: Patient['sector']) => {
    saveToHistory(patients);
    
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

    // Calculate next available bed number in destination sector
    const patientsInNewSector = patients.filter(p => p.sector === newSector);
    const bedNumbers = patientsInNewSector.map(p => parseInt(p.bedNumber.replace(/\D/g, '')) || 0);
    const maxBedNumber = bedNumbers.length > 0 ? Math.max(...bedNumbers) : 0;
    const newBedNumber = `${patient.bedNumber.match(/[A-Z]+/)?.[0] || 'L'}${String(maxBedNumber + 1).padStart(2, '0')}`;

    const updatedPatient = { ...patient, sector: newSector, bedNumber: newBedNumber };
    
    try {
      // Persist to database
      await dbUpdatePatient(patientId, updatedPatient);
      
      // Update local state
      setPatients(prev => prev.map(p => p.id === patientId ? updatedPatient : p));
      
      toast({
        title: "Paciente transferido",
        description: `${patient.name} foi transferido para ${
          newSector === 'red' ? 'Cuidados Especiais' :
          newSector === 'yellow' ? 'Observação Amarela' :
          newSector === 'blue' ? 'Observação Azul' : 'Fora das Alas'
        } (novo leito: ${newBedNumber}).`,
      });
    } catch (error) {
      console.error("Failed to transfer patient:", error);
      toast({
        title: "Erro ao transferir",
        description: "Não foi possível transferir o paciente.",
        variant: "destructive",
      });
    }
  };

  const handleUndo = () => {
    if (history.length === 0) {
      toast({
        title: "Nenhuma ação para desfazer",
        description: "Não há histórico de ações disponível.",
        variant: "destructive",
      });
      return;
    }

    const previousState = history[history.length - 1];
    setRedoHistory(prev => [...prev, patients]); // Save current state to redo history
    setPatients(previousState);
    setHistory(prev => prev.slice(0, -1));
    toast({
      title: "Ação desfeita",
      description: "A última ação foi desfeita com sucesso.",
    });
  };

  const handleRedo = () => {
    if (redoHistory.length === 0) {
      toast({
        title: "Nenhuma ação para refazer",
        description: "Não há histórico de ações desfeitas disponível.",
        variant: "destructive",
      });
      return;
    }

    const nextState = redoHistory[redoHistory.length - 1];
    setHistory(prev => [...prev, patients]); // Save current state to undo history
    setPatients(nextState);
    setRedoHistory(prev => prev.slice(0, -1));
    toast({
      title: "Ação refeita",
      description: "A ação foi refeita com sucesso.",
    });
  };

  const handleSaveVersion = async () => {
    try {
      await saveVersion(patients, currentDepartment);
      await fetchVersions(currentDepartment);
    } catch (error) {
      console.error('Failed to save version:', error);
    }
  };

  const handlePrint = () => {
    // On mobile, open the preview dialog for better PDF generation
    if (isMobile) {
      setPreviewMapMode('detailed');
    } else {
      // Desktop: use traditional print approach
      setPrintMode('detailed');
      setPrintingSector(null);
      setTimeout(() => {
        window.print();
        setTimeout(() => setPrintMode(null), 500);
      }, 100);
    }
  };

  const handleRefreshMap = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Mapa atualizado",
        description: "Os dados foram atualizados com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o mapa.",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handlePrintCompact = () => {
    // On mobile, open the preview dialog for better PDF generation
    if (isMobile) {
      // Use UTI-specific dialog for UTI department
      if (currentDepartment === "UTI") {
        setPreviewUtiMapMode('compact');
      } else {
        setPreviewMapMode('compact');
      }
    } else {
      // Desktop: for UTI, always use preview dialog with selection
      if (currentDepartment === "UTI") {
        setPreviewUtiMapMode('compact');
      } else {
        // Desktop: use traditional print approach for other departments
        setPrintMode('compact');
        setPrintingSector(null);
        setTimeout(() => {
          window.print();
          setTimeout(() => setPrintMode(null), 500);
        }, 300);
      }
    }
  };

  const handlePrintSector = (sector: string) => {
    // Usa modo detalhado para impressão de setor
    setPrintMode('detailed');
    setPrintingSector(sector);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintMode(null);
        setPrintingSector(null);
      }, 500);
    }, 100);
  };

  const handlePrintSelected = () => {
    if (selectedPatients.size === 0) return;
    
    // Usa modo detalhado para impressão
    setPrintMode('detailed');
    setPrintingSector("selected");
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintMode(null);
        setPrintingSector(null);
      }, 500);
    }, 100);
  };

  const handlePrintPatient = (patientId: string) => {
    // On mobile, open the preview dialog for better PDF generation
    // On desktop, use the traditional print approach
    if (isMobile) {
      setPreviewPatientId(patientId);
    } else {
      setPrintingPatientId(patientId);
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          setPrintingPatientId(null);
        }, 500);
      }, 100);
    }
  };

  return (
    <MainLayout onOpenHandover={() => setHandoverDialogOpen(true)}>
        {/* Print-only layout - Hidden on screen, visible only when printing */}
        {printMode && (
          <div className="print-layout-container">
            {currentDepartment === "UTI" ? (
              <PrintUtiLayout 
                uti1Patients={printingSector === "blue" ? bluePatients : printingSector === "selected" ? bluePatients.filter(p => selectedPatients.has(p.id)) : printingSector ? [] : bluePatients}
                uti2Patients={printingSector === "yellow" ? yellowPatients : printingSector === "selected" ? yellowPatients.filter(p => selectedPatients.has(p.id)) : printingSector ? [] : yellowPatients}
                outsidePatients={printingSector === "outside" ? outsidePatients : printingSector === "selected" ? outsidePatients.filter(p => selectedPatients.has(p.id)) : printingSector ? [] : outsidePatients}
                mode={printMode}
                isPreview={false}
              />
            ) : (
              <PrintLayout 
                redPatients={printingSector === "red" ? redPatients : printingSector === "selected" ? redPatients.filter(p => selectedPatients.has(p.id)) : printingSector ? [] : redPatients}
                yellowPatients={printingSector === "yellow" ? yellowPatients : printingSector === "selected" ? yellowPatients.filter(p => selectedPatients.has(p.id)) : printingSector ? [] : yellowPatients}
                bluePatients={printingSector === "blue" ? bluePatients : printingSector === "selected" ? bluePatients.filter(p => selectedPatients.has(p.id)) : printingSector ? [] : bluePatients}
                outsidePatients={printingSector === "outside" ? outsidePatients : printingSector === "selected" ? outsidePatients.filter(p => selectedPatients.has(p.id)) : printingSector ? [] : outsidePatients}
                mode={printMode}
                isPreview={false}
              />
            )}
          </div>
        )}

        {/* Print individual patient layout */}
        {printingPatientId && (() => {
          const patient = patients.find(p => p.id === printingPatientId);
          return patient ? (
            <div className="print-layout-container">
              <PrintPatientLayout patient={patient} />
            </div>
          ) : null;
        })()}

        {/* Mobile preview dialog for patient PDF */}
        {previewPatientId && (() => {
          const patient = patients.find(p => p.id === previewPatientId);
          return patient ? (
            <PrintPatientPreviewDialog 
              patient={patient} 
              onClose={() => setPreviewPatientId(null)} 
            />
          ) : null;
        })()}

        {/* Mobile preview dialog for map PDF */}
        {previewMapMode && (
          <PrintMapPreviewDialog
            redPatients={redPatients}
            yellowPatients={yellowPatients}
            bluePatients={bluePatients}
            outsidePatients={outsidePatients}
            mode={previewMapMode}
            onClose={() => setPreviewMapMode(null)}
          />
        )}

        {/* UTI preview dialog with unit selection */}
        {previewUtiMapMode && (
          <PrintUtiPreviewDialog
            uti1Patients={bluePatients}
            uti2Patients={yellowPatients}
            outsidePatients={outsidePatients}
            mode={previewUtiMapMode}
            onClose={() => setPreviewUtiMapMode(null)}
          />
        )}
        
        <div className={printMode ? 'print-hide' : ''}>
          {/* Header */}
          <DynamicHeader>
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent print:hidden"></div>
            <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3 print:py-0.5 print:px-1">
              <div className="flex items-center justify-between gap-2">
                {/* Left side: Sidebar button + Title + Department selector */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <SidebarTrigger className="print:hidden flex-shrink-0 text-white hover:text-white hover:bg-white/25 border-white/30 hover:border-white/50 data-[state=open]:bg-white/25 transition-all duration-200" />
                  
                    <div className="min-w-0 flex-1">
                      <h1 className="text-base sm:text-2xl font-bold text-white print:text-xs uppercase tracking-tight truncate">BigHelp Map</h1>
                      <div className="flex items-center gap-2 print:hidden">
                        <span className={`w-2 h-2 rounded-full ${SECTOR_VISUAL[activeSector]?.dotClass} border`} />
                        <Select value={activeSector} onValueChange={handleSectorChange}>
                          <SelectTrigger className="h-5 w-auto gap-1 bg-transparent border-none text-[10px] sm:text-xs text-white/60 font-light uppercase tracking-widest p-0 focus:ring-0 focus:ring-offset-0 hover:text-white/90 transition-colors [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-white/40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(SECTOR_VISUAL).map(([key, cfg]) => (
                              <SelectItem key={key} value={key} className="uppercase text-xs font-medium">
                                <span className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${cfg.dotClass} border`} />
                                  {cfg.title}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                </div>

                {/* Right side: Action buttons + Theme toggle */}
                <div className="flex gap-1.5 sm:gap-3 print:gap-2 items-center flex-shrink-0">
                  {/* Search button - always visible */}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSearchOpen(true)}
                    className="print:hidden h-11 w-11 sm:h-8 sm:w-8 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white hover:border-white/40 transition-all duration-200"
                    title="Buscar paciente (Ctrl+K)"
                  >
                    <Search className="h-4 w-4" />
                  </Button>

                  {/* Mobile: Show only essential buttons + dropdown menu */}
                  {isMobile ? (
                    <>
                      <Button
                        variant={selectionMode ? "default" : "outline"}
                        size="icon"
                        onClick={handleToggleSelectionMode}
                        className={`print:hidden h-11 w-11 transition-all duration-200 ${selectionMode ? 'bg-white text-[#013ba6] shadow-md' : 'bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white hover:border-white/40'}`}
                        title="Modo de seleção"
                      >
                        <CheckSquare className="h-5 w-5" />
                      </Button>
                      {selectionMode && selectedPatients.size > 0 && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={handlePrintSelected}
                            className="print:hidden h-11 w-11 bg-gradient-to-br from-critical via-warning to-stable text-white border-0"
                            title={`Imprimir ${selectedPatients.size}`}
                          >
                            <Printer className="h-5 w-5" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={handleDeleteSelected}
                            className="print:hidden h-11 w-11 bg-red-600 text-white hover:bg-red-700 border-0"
                            title={`Deletar ${selectedPatients.size}`}
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="print:hidden h-11 w-11 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white hover:border-white/40 transition-all duration-200"
                          >
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-background z-50">
                          <DropdownMenuItem onClick={handleUndo} disabled={history.length === 0}>
                            <Undo className="mr-2 h-4 w-4" />
                            Desfazer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleRedo} disabled={redoHistory.length === 0}>
                            <Redo className="mr-2 h-4 w-4" />
                            Refazer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={handleSaveVersion}>
                            <Save className="mr-2 h-4 w-4" />
                            Salvar Versão
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleRefreshMap} disabled={isRefreshing}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Atualizar Mapa
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handlePrintCompact}>
                            <Printer className="mr-2 h-4 w-4" />
                            Imprimir Mapa
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={toggleFullscreen}>
                            {isFullscreen ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
                            {isFullscreen ? "Sair Tela Cheia" : "Tela Cheia"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setShowOnlyOccupied(!showOnlyOccupied)}>
                            {showOnlyOccupied ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                            {showOnlyOccupied ? "Mostrar Vazios" : "Ocultar Vazios"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={toggleNamesHidden}>
                            {namesHidden ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                            {namesHidden ? "Mostrar Nomes" : "Ocultar Nomes (LGPD)"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={signOut} className="text-red-600">
                            <LogOut className="mr-2 h-4 w-4" />
                            Sair
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <div className="print:hidden">
                        <ThemeToggle />
                      </div>
                    </>
                  ) : (
                    /* Desktop: Show all buttons */
                    <>
                      <TooltipProvider delayDuration={300}>
                      {/* Action buttons group */}
                      <div className="flex items-center gap-1 print:hidden">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={handleUndo} disabled={history.length === 0}
                              className="h-8 w-8 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white hover:border-white/40 disabled:opacity-40 transition-all duration-200">
                              <Undo className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Desfazer última ação</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={handleRedo} disabled={redoHistory.length === 0}
                              className="h-8 w-8 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white hover:border-white/40 disabled:opacity-40 transition-all duration-200">
                              <Redo className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Refazer ação</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={handleSaveVersion}
                              className="h-8 w-8 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white hover:border-white/40 transition-all duration-200">
                              <Save className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Salvar versão atual</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={handleRefreshMap} disabled={isRefreshing}
                              className="h-8 w-8 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white hover:border-white/40 transition-all duration-200">
                              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Atualizar mapa</p></TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Separator */}
                      <div className="h-6 w-px bg-white/20 print:hidden hidden sm:block" />

                      {/* Selection & Print group */}
                      <div className="flex items-center gap-1 print:hidden">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={selectionMode ? "default" : "outline"}
                              size="icon"
                              onClick={handleToggleSelectionMode}
                              className={`h-8 w-8 transition-all duration-200 ${selectionMode ? 'bg-white text-[#013ba6] shadow-md' : 'bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white hover:border-white/40'}`}>
                              <CheckSquare className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Modo de seleção múltipla</p></TooltipContent>
                        </Tooltip>
                        {selectionMode && selectedPatients.size > 0 && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={handlePrintSelected}
                                  className="h-8 w-8 bg-gradient-to-br from-critical via-warning to-stable text-white border-0 hover:shadow-lg hover:scale-105 transition-all">
                                  <Printer className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Imprimir {selectedPatients.size} selecionado(s)</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="destructive" size="icon" onClick={handleDeleteSelected}
                                  className="h-8 w-8 bg-red-600 text-white hover:bg-red-700 border-0">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Deletar {selectedPatients.size} selecionado(s)</p></TooltipContent>
                            </Tooltip>
                          </>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={handlePrintCompact}
                              className="hidden sm:flex h-8 w-8 bg-gradient-to-br from-critical via-warning to-stable text-white border-0 hover:shadow-lg hover:scale-105 transition-all">
                              <Printer className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Imprimir mapa</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={toggleFullscreen}
                              className="hidden sm:flex h-8 w-8 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white hover:border-white/40 transition-all duration-200">
                              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>{isFullscreen ? "Sair da tela cheia" : "Tela cheia"}</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={toggleNamesHidden}
                              className={`hidden sm:flex h-8 w-8 transition-all duration-200 ${namesHidden ? 'bg-white text-[#013ba6] shadow-md' : 'bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white hover:border-white/40'}`}>
                              {namesHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>{namesHidden ? "Mostrar nomes dos pacientes" : "Ocultar nomes (Proteção de Dados)"}</p></TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Separator */}
                      <div className="h-6 w-px bg-white/20 print:hidden hidden sm:block" />

                      {/* Notifications & Info group */}
                      <div className="flex items-center gap-1 print:hidden">
                        <NotificationCenter />
                        <BedAllocationNotifications />
                        <DoorPatientNotifications />
                      </div>

                      {/* Separator */}
                      <div className="h-6 w-px bg-white/20 print:hidden hidden md:block" />

                      {/* Patient count + User info */}
                      <div className="hidden md:flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-white/20">
                        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-white/10 border border-white/20">
                          <Users className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div className="flex flex-col justify-center">
                          <p className="text-[8px] text-white/70 uppercase leading-none tracking-wide font-medium">Total</p>
                          <p className="text-base font-bold text-white leading-tight">{totalPatients}</p>
                        </div>
                      </div>

                      <div className="hidden lg:flex items-center gap-2 print:hidden">
                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-white uppercase tracking-tight">
                            {user?.user_metadata?.username || user?.email?.split('@')[0]}
                          </p>
                          <p className="text-[9px] text-white/70 uppercase">
                            {role === 'admin' ? 'Administrador' : 'Médico'}
                          </p>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={signOut}
                              className="h-8 w-8 bg-white/10 border-white/20 text-white hover:bg-red-500/80 hover:text-white hover:border-red-400/50 transition-all duration-200">
                              <LogOut className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Sair do sistema</p></TooltipContent>
                        </Tooltip>
                      </div>

                      </TooltipProvider>
                      <div className="print:hidden">
                        <ThemeToggle />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </DynamicHeader>

          {/* Main Content */}
          <main className="container mx-auto px-2 sm:px-4 py-3 sm:py-6 print:py-0 print:px-1 pt-[120px] sm:pt-[110px] print:pt-3">
            <div className="space-y-3 sm:space-y-4 print:space-y-1">
              {/* Pre-admission section */}
              <div className="print:hidden">
                <PreAdmissionSection />
              </div>
              {currentDepartment === "UTI" ? (
                <div className="space-y-4">
                  {/* Only render the active sector */}
                  <UtiSectorSection 
                    sector={activeSector as any}
                    patients={patients.filter(p => p.sector === activeSector)}
                    onUpdatePatient={handleUpdatePatient}
                    onDeletePatient={handleDeletePatient}
                    onUndeletePatient={handleUndeletePatient}
                    onPrintSector={() => handlePrintSector(activeSector)}
                    onAddExtraBed={() => handleAddExtraBed(activeSector as Patient['sector'])}
                    selectionMode={selectionMode}
                    selectedPatients={selectedPatients}
                    onToggleSelection={handleToggleSelection}
                    onReorderPatients={(reordered) => handleReorderPatients(activeSector, reordered)}
                    onTransfer={handleTransferPatient}
                    onPrintPatient={handlePrintPatient}
                    onRefetch={refetch}
                    customTitle={SECTOR_VISUAL[activeSector]?.title || "Setor"}
                    customIcon={<span className={`w-3 h-3 rounded-full ${SECTOR_VISUAL[activeSector]?.dotClass} border`} />}
                    colorVariant={SECTOR_VISUAL[activeSector]?.colorVariant as any || "red"}
                    allPatients={patients}
                    currentUtiUnit={SECTOR_VISUAL[activeSector]?.title || "UTI 1"}
                  />
                </div>
              ) : (
                <>
                  {/* Emergency sectors: Red, Yellow, Blue, Outside */}
                  <SectorSection 
                    sector="red" 
                    patients={redPatients} 
                    onUpdatePatient={handleUpdatePatient}
                    onDeletePatient={handleDeletePatient}
                    onUndeletePatient={handleUndeletePatient}
                    onPrintSector={() => handlePrintSector("red")}
                    onAddExtraBed={() => handleAddExtraBed("red")}
                    selectionMode={selectionMode}
                    selectedPatients={selectedPatients}
                    onToggleSelection={handleToggleSelection}
                    onReorderPatients={(reordered) => handleReorderPatients("red", reordered)}
                    onTransfer={handleTransferPatient}
                    onPrintPatient={handlePrintPatient}
                    onRefetch={refetch}
                  />
                  <SectorSection 
                    sector="yellow" 
                    patients={yellowPatients} 
                    onUpdatePatient={handleUpdatePatient}
                    onDeletePatient={handleDeletePatient}
                    onUndeletePatient={handleUndeletePatient}
                    onPrintSector={() => handlePrintSector("yellow")}
                    onAddExtraBed={() => handleAddExtraBed("yellow")}
                    selectionMode={selectionMode}
                    selectedPatients={selectedPatients}
                    onToggleSelection={handleToggleSelection}
                    onReorderPatients={(reordered) => handleReorderPatients("yellow", reordered)}
                    onTransfer={handleTransferPatient}
                    onPrintPatient={handlePrintPatient}
                    onRefetch={refetch}
                  />
                  <SectorSection 
                    sector="blue" 
                    patients={bluePatients} 
                    onUpdatePatient={handleUpdatePatient}
                    onDeletePatient={handleDeletePatient}
                    onUndeletePatient={handleUndeletePatient}
                    onPrintSector={() => handlePrintSector("blue")}
                    onAddExtraBed={() => handleAddExtraBed("blue")}
                    selectionMode={selectionMode}
                    selectedPatients={selectedPatients}
                    onToggleSelection={handleToggleSelection}
                    onReorderPatients={(reordered) => handleReorderPatients("blue", reordered)}
                    onTransfer={handleTransferPatient}
                    onPrintPatient={handlePrintPatient}
                    onRefetch={refetch}
                  />

                  {/* Pacientes Fora das Alas Section */}
                  <Collapsible open={isOutsideSectionOpen} onOpenChange={setIsOutsideSectionOpen} className="space-y-3 mb-4 print:hidden">
                      <div className="bg-gradient-card rounded-xl p-2 border border-border/50 shadow-md transition-all duration-200 min-h-[48px] flex items-center">
                        <div className="flex items-center justify-between w-full">
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                              <ChevronDown className={`h-5 w-5 transition-transform ${isOutsideSectionOpen ? '' : '-rotate-90'}`} />
                              <div className="flex items-center gap-2">
                                <span className="text-lg">📍</span>
                                <h2 className="text-lg font-bold text-foreground uppercase">Fora das Alas</h2>
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleAddExtraBed("outside")}
                              className="h-8 w-8"
                              title="Adicionar paciente"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handlePrintSector("outside")}
                              className="h-8 w-8"
                              title="Imprimir seção"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                            <div className="flex items-center justify-center h-8 w-8 bg-card/80 backdrop-blur-sm rounded-lg border border-border/50">
                              <p className="text-base font-bold text-foreground">{outsidePatients.length}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <CollapsibleContent>
                        <div className="space-y-2 mt-3">
                          {outsidePatients.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Nenhum paciente fora das alas
                            </p>
                          ) : (
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={handleDragEndOutside}
                            >
                              <SortableContext
                                items={outsidePatients.map(p => p.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                {outsidePatients.map((patient) => (
                                <SortableOutsidePatientCard
                                    key={patient.id}
                                    patient={patient}
                                    onUpdate={handleUpdatePatient}
                                    onDelete={handleDeletePatient}
                                    onUndelete={handleUndeletePatient}
                                    selectionMode={selectionMode}
                                    isSelected={selectedPatients.has(patient.id)}
                                    onToggleSelection={handleToggleSelection}
                                    onTransfer={handleTransferPatient}
                                    onPrintPatient={handlePrintPatient}
                                    onRefetch={refetch}
                                  />
                                ))}
                              </SortableContext>
                            </DndContext>
                          )}
                        </div>
                      </CollapsibleContent>
                  </Collapsible>
                </>
              )}

              {/* Anotações e Lembretes Section */}
              <Collapsible open={isNotesSectionOpen} onOpenChange={setIsNotesSectionOpen} className="space-y-3 mb-4 print:hidden">
                <div className="bg-gradient-card rounded-xl p-2 border border-border/50 shadow-md transition-all duration-200 min-h-[48px] flex items-center">
                  <div className="flex items-center justify-between w-full">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <ChevronDown className={`h-5 w-5 transition-transform ${isNotesSectionOpen ? '' : '-rotate-90'}`} />
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📝</span>
                          <h2 className="text-lg font-bold text-foreground uppercase">Anotações, Lembretes e Check-lists</h2>
                        </div>
                      </button>
                    </CollapsibleTrigger>
                  </div>
                </div>
                <CollapsibleContent>
                  <div className="mt-3">
                    <NotesTabOptimized />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t border-border mt-8 print:hidden">
            <div className="container mx-auto px-4 py-4">
              <p className="text-center text-xs text-muted-foreground">
                Sistema de Gestão Hospitalar - Todos os direitos reservados
              </p>
            </div>
          </footer>
        </div>

      {/* Register Handover Dialog */}
      <RegisterHandoverDialog
        open={handoverDialogOpen}
        onOpenChange={setHandoverDialogOpen}
        patients={patients}
      />

      {/* Shift Reminder Dialog */}
      <ShiftReminderDialog />

      {/* Request New Allocation Dialog (for porta users) */}
      <RequestNewAllocationDialog
        open={allocationDialogOpen}
        onOpenChange={setAllocationDialogOpen}
        targetSector={allocationTargetSector}
      />

      {/* Request UTI Allocation Dialog */}
      <RequestUtiAllocationDialog
        open={utiAllocationDialogOpen}
        onOpenChange={setUtiAllocationDialogOpen}
      />

      {/* Department Change Password Dialog - Removido, apenas admin pode trocar */}

      {/* Delete Multiple Patients Confirmation Dialog */}
      <AlertDialog open={isDeleteSelectedDialogOpen} onOpenChange={setIsDeleteSelectedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão Múltipla</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedPatients.size} leito(s)</strong> selecionado(s)?
              Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSelected}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GlobalSearchDialog externalOpen={searchOpen} onExternalOpenChange={setSearchOpen} />
    </MainLayout>
  );
};

export default Index;
