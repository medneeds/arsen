import { Patient } from "@/types/patient";
import { formatAgeDisplay } from "@/utils/ageDisplay";

interface PrintableUtiPatientCardProps {
  patient: Patient;
  mode: 'compact' | 'detailed';
  colorVariant?: 'blue' | 'yellow';
}

function calculateDaysInUti(admissionDate: string[] | undefined): number {
  if (!admissionDate || admissionDate.length === 0) return 0;
  const dateStr = admissionDate[0];
  if (!dateStr) return 0;
  
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      if (!isNaN(d.getTime())) {
        return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
      }
    }
    return 0;
  }
  return Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24));
}

const colors = {
  blue: { primary: '#2563eb', light: '#dbeafe', accent: '#1e40af', border: '#93c5fd' },
  yellow: { primary: '#ca8a04', light: '#fef9c3', accent: '#854d0e', border: '#fde047' }
};

const renderList = (items: string[], fontSize: string, accentColor: string, maxItems?: number) => {
  if (items.length === 0) return <span style={{ color: '#cbd5e1', fontSize }}>—</span>;
  const display = maxItems ? items.slice(0, maxItems) : items;
  return (
    <>
      {display.map((item, idx) => (
        <div key={idx} style={{ marginBottom: '1px', fontSize, color: '#1e293b', lineHeight: '1.3' }}>
          <span style={{ color: '#94a3b8', fontWeight: '600', marginRight: '2px' }}>{idx + 1}.</span>{item}
        </div>
      ))}
      {maxItems && items.length > maxItems && (
        <div style={{ fontSize: '5pt', color: '#94a3b8' }}>+{items.length - maxItems}</div>
      )}
    </>
  );
};

const ColLabel = ({ children, color, isCompact }: { children: string; color: string; isCompact: boolean }) => (
  <div style={{ 
    fontSize: isCompact ? '5.5pt' : '6pt', 
    color, 
    marginBottom: '1px', 
    fontWeight: '700', 
    textTransform: 'uppercase',
    letterSpacing: '0.4px'
  }}>
    {children}
  </div>
);

export function PrintableUtiPatientCard({ patient, mode, colorVariant = 'blue' }: PrintableUtiPatientCardProps) {
  if (!patient.name) return null;
  
  const isCompact = mode === 'compact';
  const daysInUti = calculateDaysInUti(patient.utiAdmissionDate);
  const scheme = colors[colorVariant];
  const fs = isCompact ? '6pt' : '7pt';
  
  const planoTerapeutico = patient.utiDailyConducts || [];
  const dispositivos = patient.utiDevices || [];
  const culturasAtb = patient.utiCulturesAntibiotics || [];
  const alergias = patient.utiAllergies || [];
  const hasCritical = dispositivos.length > 0 || culturasAtb.length > 0 || alergias.length > 0;
  
  return (
    <div 
      style={{ 
        border: `0.5px solid ${scheme.border}`,
        borderLeft: `3px solid ${scheme.primary}`,
        borderRadius: '3px',
        padding: isCompact ? '3px 6px' : '6px 8px',
        marginBottom: isCompact ? '2px' : '4px',
        backgroundColor: '#ffffff',
        pageBreakInside: 'avoid',
        breakInside: 'avoid'
      }}
    >
      {/* Header row */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px',
        marginBottom: isCompact ? '2px' : '4px',
        paddingBottom: isCompact ? '2px' : '3px',
        borderBottom: '0.5px solid #e2e8f0'
      }}>
        <div style={{ 
          backgroundColor: scheme.primary,
          color: '#ffffff',
          padding: isCompact ? '1px 5px' : '2px 8px',
          borderRadius: '2px',
          fontSize: isCompact ? '7pt' : '9pt',
          fontWeight: '800',
          minWidth: isCompact ? '28px' : '36px',
          textAlign: 'center'
        }}>
          {patient.bedNumber}
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: isCompact ? '7pt' : '9pt', fontWeight: '700', color: '#0f172a' }}>
            {patient.name || 'SEM NOME'}
          </span>
          <span style={{ fontSize: isCompact ? '6pt' : '7pt', color: '#64748b' }}>
            {formatAgeDisplay(patient.age)}
          </span>
        </div>
        <div style={{ 
          backgroundColor: daysInUti > 4 ? '#fef2f2' : scheme.light,
          border: `0.5px solid ${daysInUti > 4 ? '#fca5a5' : scheme.border}`,
          padding: '1px 5px',
          borderRadius: '2px',
          fontSize: isCompact ? '6pt' : '7pt',
          fontWeight: '700',
          color: daysInUti > 4 ? '#991b1b' : scheme.accent
        }}>
          DIH {daysInUti}d{daysInUti > 4 ? ' ⚠' : ''}
        </div>
      </div>
      
      {/* Content grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr 1fr 1.2fr',
        gap: isCompact ? '4px' : '8px'
      }}>
        <div>
          <ColLabel color={scheme.accent} isCompact={isCompact}>Hipóteses</ColLabel>
          {renderList(patient.diagnoses, fs, scheme.accent, isCompact ? 3 : undefined)}
        </div>
        <div>
          <ColLabel color={scheme.accent} isCompact={isCompact}>Antecedentes</ColLabel>
          {renderList(patient.medicalHistory, fs, scheme.accent, isCompact ? 3 : undefined)}
        </div>
        <div>
          <ColLabel color={scheme.accent} isCompact={isCompact}>Plano Terapêutico</ColLabel>
          {renderList(planoTerapeutico, fs, scheme.accent, isCompact ? 3 : undefined)}
        </div>
        <div>
          <ColLabel color={scheme.accent} isCompact={isCompact}>Pendências</ColLabel>
          {patient.pendencies.length > 0 ? (
            patient.pendencies.map((p, idx) => {
              const hl = patient.highlightedPendencies?.includes(idx);
              return (
                <div key={idx} style={{ 
                  marginBottom: '1px', fontSize: fs, color: '#1e293b', lineHeight: '1.3',
                  fontWeight: hl ? '700' : 'normal',
                  backgroundColor: hl ? scheme.light : 'transparent',
                  padding: hl ? '1px 2px' : '0',
                  borderRadius: hl ? '2px' : '0'
                }}>
                  <span style={{ color: '#94a3b8', fontWeight: '600', marginRight: '2px' }}>{idx + 1}.</span>{p}
                </div>
              );
            })
          ) : (
            <span style={{ color: '#cbd5e1', fontSize: fs }}>—</span>
          )}
        </div>
      </div>
      
      {/* Critical info — inline compact */}
      {hasCritical && (
        <div style={{ 
          marginTop: isCompact ? '2px' : '4px',
          paddingTop: isCompact ? '2px' : '3px',
          borderTop: '0.5px dashed #fca5a5',
          display: 'flex',
          gap: isCompact ? '8px' : '12px',
          fontSize: isCompact ? '5.5pt' : '6.5pt',
          flexWrap: 'wrap'
        }}>
          {dispositivos.length > 0 && (
            <div><span style={{ color: '#991b1b', fontWeight: '700' }}>DISP:</span> <span style={{ color: '#334155' }}>{dispositivos.join(', ')}</span></div>
          )}
          {alergias.length > 0 && (
            <div><span style={{ color: '#991b1b', fontWeight: '700' }}>ALERG:</span> <span style={{ color: '#334155' }}>{alergias.join(', ')}</span></div>
          )}
          {culturasAtb.length > 0 && (
            <div><span style={{ color: '#991b1b', fontWeight: '700' }}>ATB:</span> <span style={{ color: '#334155' }}>{culturasAtb.join(', ')}</span></div>
          )}
        </div>
      )}
    </div>
  );
}
