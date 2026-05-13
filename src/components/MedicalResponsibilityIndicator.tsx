import { Stethoscope, UserCog, UsersRound, Baby, Bone, Scissors, CalendarClock, Moon, Siren } from "lucide-react";
import { MedicalResponsibility } from "@/types/patient";
import { cn } from "@/lib/utils";

interface MedicalResponsibilityIndicatorProps {
  responsibility?: MedicalResponsibility;
  sectorColor: string;
  onClick?: () => void;
  compact?: boolean;
}

export const MedicalResponsibilityIndicator = ({
  responsibility,
  sectorColor,
  onClick,
  compact = false,
}: MedicalResponsibilityIndicatorProps) => {
  if (!responsibility?.type) return null;

  const getIcon = () => {
    const iconStyle = { color: sectorColor };
    switch (responsibility.type) {
      case 'rotineiro':
        return <CalendarClock className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} style={iconStyle} />;
      case 'plantonista':
        return <Moon className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} style={iconStyle} />;
      case 'intercorrencista':
        return <Siren className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} style={iconStyle} />;
      case 'porta':
        return <Stethoscope className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} style={iconStyle} />;
      case 'lider':
        return <UserCog className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} style={iconStyle} />;
      case 'conjunto':
        return <UsersRound className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} style={iconStyle} />;
      case 'obstetra':
        return <Baby className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} style={iconStyle} />;
      case 'cirurgiao_geral':
        return <Scissors className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} style={{ ...iconStyle, strokeWidth: 2.5 }} />;
      case 'traumatologista':
        return <Bone className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} style={iconStyle} />;
      default:
        return null;
    }
  };

  const getText = () => {
    const parts: string[] = [];

    if (responsibility.type === 'rotineiro') return 'Rotineiro';
    if (responsibility.type === 'plantonista') return 'Plantonista';
    if (responsibility.type === 'intercorrencista') return 'Intercorrencista';

    if (responsibility.type === 'porta') {
      if (responsibility.portaNames) parts.push(responsibility.portaNames);
      if (responsibility.officeNumber) parts.push(`C${responsibility.officeNumber}`);
      return parts.join(' • ') || 'Porta';
    } else if (responsibility.type === 'lider' && responsibility.leaderNames) {
      return responsibility.leaderNames;
    } else if (responsibility.type === 'conjunto') {
      if (responsibility.portaNames) parts.push(responsibility.portaNames);
      if (responsibility.officeNumber) parts.push(`C${responsibility.officeNumber}`);
      if (responsibility.leaderNames) parts.push(responsibility.leaderNames);
      return parts.join(' • ');
    } else if (responsibility.type === 'obstetra') {
      if (responsibility.portaNames) parts.push(responsibility.portaNames);
      if (responsibility.officeNumber) parts.push(`C${responsibility.officeNumber}`);
      return parts.join(' • ') || 'Obstetra';
    } else if (responsibility.type === 'cirurgiao_geral') {
      if (responsibility.portaNames) parts.push(responsibility.portaNames);
      if (responsibility.officeNumber) parts.push(`C${responsibility.officeNumber}`);
      return parts.join(' • ') || 'Cirurgião Geral';
    } else if (responsibility.type === 'traumatologista') {
      if (responsibility.portaNames) parts.push(responsibility.portaNames);
      if (responsibility.officeNumber) parts.push(`C${responsibility.officeNumber}`);
      return parts.join(' • ') || 'Traumatologista';
    }

    return '';
  };

  const getAbbreviation = () => {
    switch (responsibility.type) {
      case 'rotineiro': return 'ROTIN.';
      case 'plantonista': return 'PLANT.';
      case 'intercorrencista': return 'INTERC.';
      case 'porta': return 'PORTA';
      case 'lider': return 'LÍDER';
      case 'conjunto': return 'CONJUNTO';
      case 'obstetra': return 'OBS';
      case 'cirurgiao_geral': return 'CIRURG.';
      case 'traumatologista': return 'ORTOP';
      default: return '';
    }
  };

  const getLabel = () => {
    switch (responsibility.type) {
      case 'rotineiro': return 'Médico Rotineiro';
      case 'plantonista': return 'Médico Plantonista';
      case 'intercorrencista': return 'Médico Intercorrencista';
      case 'porta': return 'Médico Porta';
      case 'lider': return 'Médico Líder';
      case 'conjunto': return 'Seguimento Conjunto';
      case 'obstetra': return 'Obstetra';
      case 'cirurgiao_geral': return 'Cirurgião Geral';
      case 'traumatologista': return 'Traumatologista';
      default: return '';
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-md cursor-pointer transition-all duration-300 hover:scale-105 animate-fade-in backdrop-blur-sm",
        compact ? "text-[8px] px-1.5 py-1" : "text-[9px] px-2 py-1.5"
      )}
      style={{
        backgroundColor: `${sectorColor}15`,
        color: sectorColor,
        border: `1.5px solid ${sectorColor}40`,
      }}
      onClick={onClick}
      title={getLabel()}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = `${sectorColor}30`;
        e.currentTarget.style.borderColor = `${sectorColor}80`;
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = `${sectorColor}15`;
        e.currentTarget.style.borderColor = `${sectorColor}40`;
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <div 
        className={cn(
          "rounded-full flex items-center justify-center flex-shrink-0 transition-all",
          compact ? "h-4 w-4" : "h-5 w-5"
        )}
      >
        {getIcon()}
      </div>
      <span className="font-medium leading-none whitespace-nowrap" style={{ fontSize: compact ? '7px' : '8px', color: sectorColor }}>
        {getAbbreviation()}
      </span>
      {responsibility.officeNumber && (
        <span className="font-normal leading-none whitespace-nowrap" style={{ fontSize: compact ? '6.5px' : '7.5px', color: sectorColor }}>
          C{responsibility.officeNumber}
        </span>
      )}
    </div>
  );
};
