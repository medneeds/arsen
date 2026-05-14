import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { SectorSection } from "@/components/SectorSection";
import { UtiSectorSection } from "@/components/UtiSectorSection";
import { PreAdmissionSection, type PreAdmissionSectionHandle } from "@/components/PreAdmissionSection";
import { PatientCard } from "@/components/PatientCard";
import { PatientSidebar } from "@/components/PatientSidebar";
import { PrintLayout } from "@/components/PrintLayout";
import { PrintUtiLayout } from "@/components/PrintUtiLayout";
import { PrintPatientLayout } from "@/components/PrintPatientLayout";
import { PrintPatientPreviewDialog } from "@/components/PrintPatientPreviewDialog";
import { PrintMapPreviewDialog } from "@/components/PrintMapPreviewDialog";
import { PrintUtiPreviewDialog } from "@/components/PrintUtiPreviewDialog";
import { RoundSectorPrintDialog } from "@/components/RoundSectorPrintDialog";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PageLoader } from "@/components/PageLoader";
import { usePageReady } from "@/hooks/usePageReady";
import { MainLayout } from "@/components/MainLayout";
import { ShiftReminderDialog } from "@/components/ShiftReminderDialog";
import { Patient, SectorType } from "@/types/patient";
import { Activity, Users, Clock, Printer, Eye, EyeOff, ClipboardList, LogOut, CheckSquare, Trash2, Plus, StickyNote, Edit, List, X, FileText, ChevronDown, ChevronRight, GripVertical, ClipboardCheck, MoreVertical, Building2, RefreshCw, Maximize2, Minimize2, ArrowLeftRight, LayoutDashboard } from "lucide-react";
import { ClinicalNavTabs } from "@/components/ClinicalNavTabs";
import { SectorSelector } from "@/components/SectorSelector";
import { BreadcrumbBar } from "@/components/BreadcrumbBar";
import { whitelabel } from "@/config/whitelabel";
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
  const navigate = useNavigate();
  
  // Redirect sector-specific profiles to their dedicated panels
  const accessProfile = typeof window !== 'undefined' ? localStorage.getItem("access_profile") || "medico" : "medico";
  useEffect(() => {
    if (accessProfile === "imagem") {
      navigate("/setor-imagem", { replace: true });
    } else if (accessProfile === "laboratorio") {
      navigate("/setor-laboratorio", { replace: true });
    }
  }, [accessProfile, navigate]);

  // Use department context
  const { currentDepartment, setCurrentDepartment, currentSectorCode } = useDepartment();
  
  // Active sector derived from department context
  const [activeSector, setActiveSector] = useState<string>(() => {
    return localStorage.getItem("selected_sector") || currentSectorCode || "red";
  });
  
  // Sync activeSector when department changes via sidebar
  useEffect(() => {
    if (currentSectorCode) {
      setActiveSector(currentSectorCode);
    }
  }, [currentSectorCode]);
  
  // Persist active sector changes
  const handleSectorChange = (sector: string) => {
    setActiveSector(sector);
    localStorage.setItem("selected_sector", sector);
  };

  // Sector visual config — padronizado em azul institucional para integridade visual
  const BLUE_DOT = "bg-primary/80 border-primary/40";
  const BLUE_GRAD = "from-primary/20 to-primary/10";
  const SECTOR_VISUAL: Record<string, { title: string; color: string; dotClass: string; colorVariant: string; isUti?: boolean }> = {
    red: { title: "UTI 1", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    yellow: { title: "UTI 2", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    blue: { title: "UCI 1", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    outside: { title: "UCI 2", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    ucc: { title: "UCC", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    neuro_01: { title: "Neuro 01", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    neuro_02: { title: "Neuro 02", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    clinica_cirurgica: { title: "Clínica Cirúrgica", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    enfermaria_transicao: { title: "Enf. Transição", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    enfermaria_vascular: { title: "Enf. Vascular", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    sala_vermelha: { title: "Sala Vermelha", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    sala_laranja: { title: "Sala Laranja", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    observacao_clinica: { title: "Obs. Clínica", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    internacao_ue: { title: "Internação UE", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    ue_vertical: { title: "UE Vertical", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    ue_horizontal: { title: "UE Horizontal", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    riv: { title: "RIV", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    cc_preparo: { title: "CC Preparo", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    cc_bloco: { title: "CC Bloco Cirúrgico", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
    cc_rpa: { title: "CC RPA", color: BLUE_GRAD, dotClass: BLUE_DOT, colorVariant: "blue", isUti: true },
  };
  
  // Use real database patients filtered by active sector on bed map
  const { patients: dbPatients, isLoading: patientsLoading, updatePatient: dbUpdatePatient, createPatient: dbCreatePatient, deletePatient: dbDeletePatient, releaseBedPreAdmission: dbReleaseBedPreAdmission, reorderPatients: dbReorderPatients, refetch } = usePatients(undefined, activeSector);
  const [patients, setPatients] = useState<Patient[]>(dbPatients);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const preAdmissionRef = useRef<PreAdmissionSectionHandle>(null);
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
  const [roundSectorDialogOpen, setRoundSectorDialogOpen] = useState(false);
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
  const [quickViewPatient, setQuickViewPatient] = useState<Patient | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
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
    setPatients(dbPatients);
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
      .eq('sector', sector);
    
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

  const handleReleasePreAdmissionBed = async (
    patientId: string,
    payload: { reason: string; reasonNote: string },
  ) => {
    saveToHistory(patients);
    try {
      await dbReleaseBedPreAdmission(patientId, payload);
      await refetch();
    } catch (error) {
      console.error("Failed to release pre-admission bed:", error);
      throw error;
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
      await Promise.all([
        refetch(),
        preAdmissionRef.current?.refresh(),
      ]);
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

  const handleQuickView = (patient: Patient) => {
    setQuickViewPatient(patient);
    setQuickViewOpen(true);
  };

  const pageReady = usePageReady({ loading: authLoading || patientsLoading });
  if (!pageReady) {
    const sectorLabel = SECTOR_VISUAL[activeSector]?.title;
    return <PageLoader message={sectorLabel ? `Preparando ${sectorLabel}` : "Carregando mapa de leitos"} subMessage={whitelabel.institution.hospitalAbbreviation} />;
  }

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
            redPatients={redPatients}
            yellowPatients={yellowPatients}
            bluePatients={bluePatients}
            outsidePatients={outsidePatients}
            defaultSector={activeSector as any}
            mode={previewUtiMapMode}
            onClose={() => setPreviewUtiMapMode(null)}
          />
        )}

        {/* Round do setor — pop-up de seleção de leitos para impressão em branco */}
        <RoundSectorPrintDialog
          open={roundSectorDialogOpen}
          onOpenChange={setRoundSectorDialogOpen}
          patients={(() => {
            const map: Record<string, Patient[]> = {
              red: redPatients, yellow: yellowPatients, blue: bluePatients, outside: outsidePatients,
            };
            return map[activeSector] ?? patients.filter((p) => p.sector === activeSector);
          })()}
          sectorLabel={activeSector?.toUpperCase()}
        />
        
        <div className={printMode ? 'print-hide' : ''}>
          {/* Main Content — sem cabeçalho duplicado; ações ficam no BreadcrumbBar */}
          <main className="container mx-auto px-2 sm:px-4 py-3 sm:py-6 print:py-0 print:px-1 print:pt-3">
            <div className="space-y-3 sm:space-y-4 print:space-y-1">
              {/* Unified breadcrumb bar com ações integradas */}
              <BreadcrumbBar
                variant="institutional"
                actions={
                  <TooltipProvider delayDuration={300}>
                    <div className="flex items-center gap-1 print:hidden">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={handleRefreshMap} disabled={isRefreshing}
                            className="h-8 w-8 bg-white/95 text-foreground border-white/40 hover:bg-white hover:text-primary shadow-sm">
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Atualizar mapa</p></TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={handlePrintCompact}
                            className="h-8 w-8 bg-white/95 text-foreground border-white/40 hover:bg-white hover:text-primary shadow-sm">
                            <Printer className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Imprimir mapa</p></TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={() => setRoundSectorDialogOpen(true)}
                            className="h-8 w-8 bg-white/95 text-foreground border-white/40 hover:bg-white hover:text-primary shadow-sm">
                            <ClipboardCheck className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Imprimir Round do Setor</p></TooltipContent>
                      </Tooltip>

                      <div className="h-6 w-px bg-white/30" />

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={handleToggleSelectionMode}
                            className={`h-8 w-8 transition-all duration-200 shadow-sm ${selectionMode ? 'bg-primary text-white border-white/40 ring-2 ring-white/40' : 'bg-white/95 text-foreground border-white/40 hover:bg-white hover:text-primary'}`}>
                            <CheckSquare className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>{selectionMode ? "Sair do modo seleção" : "Modo de seleção"}</p></TooltipContent>
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
                    </div>
                  </TooltipProvider>
                }
              />


              {/* Pre-admission section — filtra por setor ativo (exceto UE Vertical/Horizontal que mostram todos) */}
              <div className="print:hidden">
                <PreAdmissionSection
                  ref={preAdmissionRef}
                  sectorFilterLabel={
                    activeSector === "ue_vertical" || activeSector === "ue_horizontal"
                      ? undefined
                      : SECTOR_VISUAL[activeSector]?.title
                  }
                />
              </div>

              {SECTOR_VISUAL[activeSector]?.isUti ? (
                <div className="space-y-4">
                  <UtiSectorSection 
                    sector={activeSector as any}
                    patients={patients.filter(p => p.sector === activeSector)}
                    onUpdatePatient={handleUpdatePatient}
                    onDeletePatient={handleDeletePatient}
                    onReleasePreAdmissionBed={handleReleasePreAdmissionBed}
                    onUndeletePatient={handleUndeletePatient}
                    onPrintSector={() => handlePrintSector(activeSector)}
                    onPrintRound={() => setRoundSectorDialogOpen(true)}
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
                <div className="space-y-4">
                  <SectorSection 
                    sector={activeSector as any}
                    patients={filterPatients(patients.filter(p => p.sector === activeSector))}
                    onUpdatePatient={handleUpdatePatient}
                    onDeletePatient={handleDeletePatient}
                    onReleasePreAdmissionBed={handleReleasePreAdmissionBed}
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
                    onQuickView={handleQuickView}
                  />
                </div>
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
                          <h2 className="text-lg font-bold text-foreground">Anotações, Lembretes e Check-lists</h2>
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

          {/* Floating bottom controls — Tela cheia + Ocultar nomes (LGPD) */}
          <div className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-full border border-border/60 bg-card/95 backdrop-blur-md shadow-lg p-1 print:hidden">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={toggleNamesHidden}
                    className={`h-9 w-9 rounded-full transition-all ${namesHidden ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-foreground hover:bg-muted'}`}>
                    {namesHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left"><p>{namesHidden ? "Mostrar nomes" : "Ocultar nomes (LGPD)"}</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={toggleFullscreen}
                    className="h-9 w-9 rounded-full text-foreground hover:bg-muted">
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left"><p>{isFullscreen ? "Sair da tela cheia" : "Tela cheia"}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>


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

      <PatientSidebar
        patient={quickViewPatient}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
      />
    </MainLayout>
  );
};

export default Index;
