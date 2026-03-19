import { Patient } from "@/types/patient";
import { formatAgeDisplay } from "@/utils/ageDisplay";

interface PrintablePatientCardProps {
  patient: Patient;
  mode: 'compact' | 'detailed';
  bedColor?: string;
}

const getMedicalResponsibilityLabel = (patient: Patient) => {
  if (!patient.medicalResponsibility?.type) return null;
  
  const { type, officeNumber, leaderNames, portaNames } = patient.medicalResponsibility;
  const parts: string[] = [];
  
  if (type === 'porta') {
    if (portaNames) parts.push(`${portaNames}`);
    if (officeNumber) parts.push(`C${officeNumber}`);
    return parts.join(' · ') || 'Porta';
  } else if (type === 'lider' && leaderNames) {
    return `Líder: ${leaderNames}`;
  } else if (type === 'conjunto') {
    if (portaNames) parts.push(portaNames);
    if (officeNumber) parts.push(`C${officeNumber}`);
    if (leaderNames) parts.push(`Líder: ${leaderNames}`);
    return parts.join(' · ');
  }
  
  return null;
};

const renderList = (items: string[], fontSize: string, maxItems?: number) => {
  if (items.length === 0) return <span style={{ color: '#cbd5e1', fontSize }}>—</span>;
  const display = maxItems ? items.slice(0, maxItems) : items;
  return (
    <>
      {display.map((item, idx) => (
        <div key={idx} style={{ marginBottom: '1px', fontSize, color: '#1e293b', lineHeight: '1.35' }}>
          <span style={{ color: '#94a3b8', fontWeight: '600', marginRight: '2px' }}>{idx + 1}.</span>{item}
        </div>
      ))}
      {maxItems && items.length > maxItems && (
        <div style={{ fontSize: '5.5pt', color: '#94a3b8' }}>+{items.length - maxItems}</div>
      )}
    </>
  );
};

const SectionLabel = ({ children, isCompact }: { children: string; isCompact: boolean }) => (
  <div style={{ 
    fontSize: isCompact ? '6pt' : '6.5pt', 
    color: '#64748b', 
    marginBottom: '2px', 
    textTransform: 'none' as const, 
    fontWeight: '700',
    letterSpacing: '0.5px'
  }}>
    {children}
  </div>
);

export function PrintablePatientCard({ patient, mode, bedColor = '#64748b' }: PrintablePatientCardProps) {
  if (!patient.name) return null;
  
  const isCompact = mode === 'compact';
  const fs = isCompact ? '7pt' : '7.5pt';
  const responsibilityLabel = getMedicalResponsibilityLabel(patient);
  
  return (
    <div 
      style={{ 
        border: '0.5px solid #e2e8f0',
        borderRadius: '3px',
        padding: isCompact ? '4px 6px' : '6px 8px',
        marginBottom: isCompact ? '2px' : '4px',
        backgroundColor: '#ffffff',
        pageBreakInside: 'avoid',
        breakInside: 'avoid'
      }}
    >
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isCompact 
          ? '38px 1.5fr 2.8fr 2fr 2fr 3fr' 
          : '48px 1.8fr 2.8fr 2.2fr 2.2fr 3fr',
        gap: isCompact ? '6px' : '10px',
        alignItems: 'start'
      }}>
        {/* Leito */}
        <div>
          <SectionLabel isCompact={isCompact}>Leito</SectionLabel>
          <div style={{ 
            backgroundColor: bedColor,
            color: '#ffffff',
            padding: isCompact ? '2px 4px' : '2px 6px',
            borderRadius: '3px',
            fontSize: isCompact ? '8pt' : '9pt',
            fontWeight: '800',
            display: 'inline-block',
            textAlign: 'center',
            minWidth: isCompact ? '28px' : '36px',
            letterSpacing: '0.3px'
          }}>
            {patient.bedNumber}
          </div>
          {responsibilityLabel && (
            <div style={{
              fontSize: '5.5pt',
              color: bedColor,
              padding: '1px 3px',
              marginTop: '2px',
              lineHeight: '1.2'
            }}>
              {responsibilityLabel}
            </div>
          )}
        </div>

        {/* Paciente */}
        <div>
          <SectionLabel isCompact={isCompact}>Paciente</SectionLabel>
          <div style={{ 
            fontSize: isCompact ? '8pt' : '8.5pt', 
            fontWeight: '700', 
            color: '#0f172a', 
            lineHeight: '1.2',
            marginBottom: '1px'
          }}>
            {patient.name || 'SEM NOME'}
          </div>
          <div style={{ fontSize: isCompact ? '6.5pt' : '7pt', color: '#64748b' }}>
            {formatAgeDisplay(patient.age)}
          </div>
        </div>

        {/* Hipóteses */}
        <div>
          <SectionLabel isCompact={isCompact}>Hipóteses / Diagnósticos</SectionLabel>
          {isCompact ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
              {patient.diagnoses.length > 0 ? (
                patient.diagnoses.map((d, idx) => (
                  <span key={idx} style={{ 
                    backgroundColor: '#f1f5f9',
                    padding: '1px 4px',
                    borderRadius: '2px',
                    fontSize: '6.5pt',
                    color: '#334155',
                    lineHeight: '1.5'
                  }}>
                    {d}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '6.5pt', color: '#cbd5e1' }}>—</span>
              )}
            </div>
          ) : (
            renderList(patient.diagnoses, fs)
          )}
        </div>

        {/* Antecedentes */}
        <div>
          <SectionLabel isCompact={isCompact}>Antecedentes</SectionLabel>
          {renderList(patient.medicalHistory, fs, isCompact ? 3 : undefined)}
        </div>

        {/* Exames */}
        <div>
          <SectionLabel isCompact={isCompact}>Exames</SectionLabel>
          {renderList(patient.relevantExams, fs, isCompact ? 3 : undefined)}
        </div>

        {/* Pendências */}
        <div>
          <SectionLabel isCompact={isCompact}>Programações / Pendências</SectionLabel>
          {patient.pendencies.length > 0 ? (
            patient.pendencies.map((p, idx) => {
              const isHighlighted = patient.highlightedPendencies?.includes(idx);
              return (
                <div key={idx} style={{ 
                  marginBottom: '1px', 
                  fontSize: fs, 
                  color: '#1e293b', 
                  lineHeight: '1.35',
                  fontWeight: isHighlighted ? '700' : 'normal',
                  backgroundColor: isHighlighted ? '#fef9c3' : 'transparent',
                  padding: isHighlighted ? '1px 3px' : '0',
                  borderRadius: isHighlighted ? '2px' : '0'
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
    </div>
  );
}
