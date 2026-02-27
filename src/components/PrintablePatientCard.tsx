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
    if (portaNames) parts.push(`🩺 ${portaNames}`);
    if (officeNumber) parts.push(`C${officeNumber}`);
    return parts.join(' • ') || '🩺 Porta';
  } else if (type === 'lider' && leaderNames) {
    return `⚕️ Líder: ${leaderNames}`;
  } else if (type === 'conjunto') {
    if (portaNames) parts.push(portaNames);
    if (officeNumber) parts.push(`C${officeNumber}`);
    if (leaderNames) parts.push(`Líder: ${leaderNames}`);
    return `👥 ${parts.join(' • ')}`;
  }
  
  return null;
};

export function PrintablePatientCard({ patient, mode, bedColor = '#6b7280' }: PrintablePatientCardProps) {
  if (!patient.name) return null;
  
  const isCompact = mode === 'compact';
  
  // Modo compacto otimizado para paisagem
  if (isCompact) {
    return (
      <div 
        style={{ 
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          padding: '7px 8px',
          marginBottom: '4px',
          backgroundColor: '#ffffff',
          fontSize: '8.5pt',
          pageBreakInside: 'avoid',
          breakInside: 'avoid'
        }}
      >
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '45px 1.8fr 3fr 2.2fr 2.2fr 3.2fr',
          gap: '12px',
          alignItems: 'start'
        }}>
          {/* Leito */}
          <div>
            <div style={{ fontSize: '7.5pt', color: '#6b7280', marginBottom: '3px', textTransform: 'uppercase', fontWeight: '600' }}>Leito</div>
            <div style={{ 
              backgroundColor: bedColor,
              color: '#ffffff',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '9pt',
              fontWeight: 'bold',
              display: 'inline-block'
            }}>
              {patient.bedNumber}
            </div>
            {getMedicalResponsibilityLabel(patient) && (
              <div style={{
                fontSize: '6.5pt',
                color: bedColor,
                backgroundColor: `${bedColor}15`,
                border: `1px solid ${bedColor}40`,
                padding: '2px 4px',
                borderRadius: '3px',
                marginTop: '3px',
                display: 'inline-block'
              }}>
                {getMedicalResponsibilityLabel(patient)}
              </div>
            )}
          </div>

          {/* Paciente */}
          <div>
            <div style={{ fontSize: '7.5pt', color: '#6b7280', marginBottom: '3px', textTransform: 'uppercase', fontWeight: '600' }}>Paciente</div>
            <div style={{ fontSize: '9pt', fontWeight: 'bold', color: '#000000', marginBottom: '2px' }}>
              {patient.name || 'SEM NOME'}
            </div>
            <div style={{ fontSize: '7.5pt', color: '#6b7280' }}>
              {formatAgeDisplay(patient.age)}
            </div>
          </div>

          {/* Hipóteses / Diagnósticos */}
          <div>
            <div style={{ fontSize: '7.5pt', color: '#6b7280', marginBottom: '3px', textTransform: 'uppercase', fontWeight: '600' }}>
              Hipóteses / Diagnósticos
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {patient.diagnoses.length > 0 ? (
                patient.diagnoses.map((diagnosis, idx) => (
                  <span 
                    key={idx} 
                    style={{ 
                      backgroundColor: '#f3f4f6',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '7.5pt',
                      color: '#374151',
                      lineHeight: '1.6'
                    }}
                  >
                    {diagnosis}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '7.5pt', color: '#9ca3af' }}>-</span>
              )}
            </div>
          </div>

          {/* Antecedentes */}
          <div>
            <div style={{ fontSize: '7.5pt', color: '#6b7280', marginBottom: '3px', textTransform: 'uppercase', fontWeight: '600' }}>
              Antecedentes
            </div>
            <div style={{ fontSize: '7.5pt', color: '#374151', lineHeight: '1.5' }}>
              {patient.medicalHistory.length > 0 ? (
                patient.medicalHistory.map((history, idx) => (
                  <div key={idx} style={{ marginBottom: '2px' }}>
                    <span style={{ fontWeight: 'bold', color: '#6b7280' }}>{idx + 1}.</span> {history}
                  </div>
                ))
              ) : (
                <span style={{ color: '#9ca3af' }}>-</span>
              )}
            </div>
          </div>

          {/* Exames */}
          <div>
            <div style={{ fontSize: '7.5pt', color: '#6b7280', marginBottom: '3px', textTransform: 'uppercase', fontWeight: '600' }}>
              Exames
            </div>
            <div style={{ fontSize: '7.5pt', color: '#374151', lineHeight: '1.5' }}>
              {patient.relevantExams.length > 0 ? (
                patient.relevantExams.map((exam, idx) => (
                  <div key={idx} style={{ marginBottom: '2px' }}>
                    <span style={{ fontWeight: 'bold', color: '#6b7280' }}>{idx + 1}.</span> {exam}
                  </div>
                ))
              ) : (
                <span style={{ color: '#9ca3af' }}>-</span>
              )}
            </div>
          </div>

          {/* Programações / Pendências */}
          <div>
            <div style={{ fontSize: '7.5pt', color: '#6b7280', marginBottom: '3px', textTransform: 'uppercase', fontWeight: '600' }}>
              Programações / Pendências
            </div>
            <div style={{ fontSize: '7.5pt', color: '#374151', lineHeight: '1.5' }}>
              {patient.pendencies.length > 0 ? (
                patient.pendencies.map((pendency, idx) => (
                  <div key={idx} style={{ marginBottom: '2px' }}>
                    <span style={{ fontWeight: 'bold', color: '#6b7280' }}>{idx + 1}.</span> {pendency}
                  </div>
                ))
              ) : (
                <span style={{ color: '#9ca3af' }}>-</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Modo detalhado - agora com layout grid organizado
  return (
    <div 
      style={{ 
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        padding: '10px 12px',
        marginBottom: '10px',
        backgroundColor: '#ffffff',
        fontSize: '9.5pt',
        pageBreakInside: 'avoid',
        breakInside: 'avoid'
      }}
    >
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '60px 2fr 3fr 2.5fr 2.5fr 3.5fr',
        gap: '14px',
        alignItems: 'start'
      }}>
        {/* Leito */}
        <div>
          <div style={{ fontSize: '8pt', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>Leito</div>
          <div style={{ 
            backgroundColor: bedColor,
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: '5px',
            fontSize: '10pt',
            fontWeight: 'bold',
            display: 'inline-block',
            textAlign: 'center',
            minWidth: '45px'
          }}>
            {patient.bedNumber}
          </div>
          {getMedicalResponsibilityLabel(patient) && (
            <div style={{
              fontSize: '7pt',
              color: bedColor,
              backgroundColor: `${bedColor}15`,
              border: `1px solid ${bedColor}40`,
              padding: '3px 6px',
              borderRadius: '4px',
              marginTop: '4px',
              display: 'inline-block'
            }}>
              {getMedicalResponsibilityLabel(patient)}
            </div>
          )}
        </div>

        {/* Paciente */}
        <div>
          <div style={{ fontSize: '8pt', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>Paciente</div>
          <div style={{ fontSize: '10pt', fontWeight: 'bold', color: '#000000', marginBottom: '3px', lineHeight: '1.3' }}>
            {patient.name || 'SEM NOME'}
          </div>
          <div style={{ fontSize: '8pt', color: '#6b7280' }}>
            {formatAgeDisplay(patient.age)}
          </div>
        </div>

        {/* Hipóteses / Diagnósticos */}
        <div>
          <div style={{ fontSize: '8pt', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>
            Hipóteses / Diagnósticos
          </div>
          <div style={{ fontSize: '8.5pt', color: '#374151', lineHeight: '1.5' }}>
            {patient.diagnoses.length > 0 ? (
              patient.diagnoses.map((diagnosis, idx) => (
                <div key={idx} style={{ marginBottom: '3px' }}>
                  <span style={{ fontWeight: 'bold', color: '#6b7280' }}>{idx + 1}.</span> {diagnosis}
                </div>
              ))
            ) : (
              <span style={{ color: '#9ca3af' }}>-</span>
            )}
          </div>
        </div>

        {/* Antecedentes */}
        <div>
          <div style={{ fontSize: '8pt', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>
            Antecedentes
          </div>
          <div style={{ fontSize: '8.5pt', color: '#374151', lineHeight: '1.5' }}>
            {patient.medicalHistory.length > 0 ? (
              patient.medicalHistory.map((history, idx) => (
                <div key={idx} style={{ marginBottom: '3px' }}>
                  <span style={{ fontWeight: 'bold', color: '#6b7280' }}>{idx + 1}.</span> {history}
                </div>
              ))
            ) : (
              <span style={{ color: '#9ca3af' }}>-</span>
            )}
          </div>
        </div>

        {/* Exames */}
        <div>
          <div style={{ fontSize: '8pt', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>
            Exames
          </div>
          <div style={{ fontSize: '8.5pt', color: '#374151', lineHeight: '1.5' }}>
            {patient.relevantExams.length > 0 ? (
              patient.relevantExams.map((exam, idx) => (
                <div key={idx} style={{ marginBottom: '3px' }}>
                  <span style={{ fontWeight: 'bold', color: '#6b7280' }}>{idx + 1}.</span> {exam}
                </div>
              ))
            ) : (
              <span style={{ color: '#9ca3af' }}>-</span>
            )}
          </div>
        </div>

        {/* Programações / Pendências */}
        <div>
          <div style={{ fontSize: '8pt', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>
            Programações / Pendências
          </div>
          <div style={{ fontSize: '8.5pt', color: '#374151', lineHeight: '1.5' }}>
            {patient.pendencies.length > 0 ? (
              patient.pendencies.map((pendency, idx) => {
                const isHighlighted = patient.highlightedPendencies?.includes(idx);
                return (
                  <div 
                    key={idx} 
                    style={{ 
                      marginBottom: '3px',
                      fontWeight: isHighlighted ? 'bold' : 'normal',
                      backgroundColor: isHighlighted ? '#fef3c7' : 'transparent',
                      padding: isHighlighted ? '2px 4px' : '0',
                      borderRadius: isHighlighted ? '3px' : '0',
                      display: 'inline-block',
                      width: '100%'
                    }}
                  >
                    <span style={{ fontWeight: 'bold', color: '#6b7280' }}>{idx + 1}.</span> {pendency}
                  </div>
                );
              })
            ) : (
              <span style={{ color: '#9ca3af' }}>-</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
