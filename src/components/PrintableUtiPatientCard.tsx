import { Patient } from "@/types/patient";
import { formatAgeDisplay } from "@/utils/ageDisplay";

interface PrintableUtiPatientCardProps {
  patient: Patient;
  mode: 'compact' | 'detailed';
  colorVariant?: 'blue' | 'yellow';
}

// Calculate days in UTI
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

export function PrintableUtiPatientCard({ patient, mode, colorVariant = 'blue' }: PrintableUtiPatientCardProps) {
  if (!patient.name) return null;
  
  const isCompact = mode === 'compact';
  const daysInUti = calculateDaysInUti(patient.utiAdmissionDate);
  
  // Color scheme based on variant
  const colors = {
    blue: {
      primary: '#3b82f6',
      light: '#dbeafe',
      accent: '#1e40af',
      border: '#93c5fd'
    },
    yellow: {
      primary: '#eab308',
      light: '#fef9c3',
      accent: '#854d0e',
      border: '#fde047'
    }
  };
  
  const scheme = colors[colorVariant];
  
  // Get UTI-specific fields
  const planoTerapeutico = patient.utiDailyConducts || [];
  const dispositivos = patient.utiDevices || [];
  const culturasAtb = patient.utiCulturesAntibiotics || [];
  const alergias = patient.utiAllergies || [];
  
  // Compact mode for landscape map printing
  if (isCompact) {
    return (
      <div 
        style={{ 
          border: `1px solid ${scheme.border}`,
          borderLeft: `3px solid ${scheme.primary}`,
          borderRadius: '4px',
          padding: '5px 7px',
          marginBottom: '3px',
          backgroundColor: '#ffffff',
          fontSize: '7pt',
          pageBreakInside: 'avoid',
          breakInside: 'avoid'
        }}
      >
        {/* Header row with bed, name, age, DIH */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          marginBottom: '4px',
          paddingBottom: '3px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{ 
            backgroundColor: scheme.primary,
            color: '#ffffff',
            padding: '1px 6px',
            borderRadius: '2px',
            fontSize: '7pt',
            fontWeight: 'bold',
            minWidth: '32px',
            textAlign: 'center'
          }}>
            {patient.bedNumber}
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '7.5pt', fontWeight: 'bold', color: '#111827' }}>
              {patient.name || 'SEM NOME'}
            </span>
            <span style={{ fontSize: '6.5pt', color: '#6b7280', marginLeft: '6px' }}>
              {formatAgeDisplay(patient.age)}
            </span>
          </div>
          <div style={{ 
            backgroundColor: daysInUti > 4 ? '#fef2f2' : scheme.light,
            border: `1px solid ${daysInUti > 4 ? '#fca5a5' : scheme.border}`,
            padding: '1px 5px',
            borderRadius: '2px',
            fontSize: '6.5pt',
            fontWeight: 'bold',
            color: daysInUti > 4 ? '#991b1b' : scheme.accent
          }}>
            DIH: {daysInUti}d {daysInUti > 4 && '⚠'}
          </div>
          {(dispositivos.length > 0 || alergias.length > 0) && (
            <div style={{ 
              backgroundColor: '#fef2f2',
              border: '1px solid #fca5a5',
              padding: '1px 5px',
              borderRadius: '2px',
              fontSize: '6pt',
              fontWeight: 'bold',
              color: '#991b1b'
            }}>
              ⚠ {dispositivos.length + alergias.length}
            </div>
          )}
        </div>
        
        {/* 4-column grid matching UTI card layout */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr 1fr 1.2fr',
          gap: '6px'
        }}>
          {/* Hipóteses / Diagnósticos */}
          <div>
            <div style={{ fontSize: '6pt', color: scheme.accent, marginBottom: '1px', fontWeight: '600', textTransform: 'uppercase' }}>
              Hipóteses
            </div>
            <div style={{ fontSize: '6.5pt', color: '#374151', lineHeight: '1.35' }}>
              {patient.diagnoses.length > 0 ? (
                patient.diagnoses.slice(0, 3).map((d, idx) => (
                  <div key={idx} style={{ marginBottom: '1px' }}>
                    <span style={{ fontWeight: 'bold', color: '#9ca3af' }}>{idx + 1}.</span> {d}
                  </div>
                ))
              ) : (
                <span style={{ color: '#d1d5db' }}>-</span>
              )}
              {patient.diagnoses.length > 3 && (
                <div style={{ fontSize: '5.5pt', color: '#9ca3af' }}>+{patient.diagnoses.length - 3} mais</div>
              )}
            </div>
          </div>

          {/* Antecedentes */}
          <div>
            <div style={{ fontSize: '6pt', color: scheme.accent, marginBottom: '1px', fontWeight: '600', textTransform: 'uppercase' }}>
              Antecedentes
            </div>
            <div style={{ fontSize: '6.5pt', color: '#374151', lineHeight: '1.35' }}>
              {patient.medicalHistory.length > 0 ? (
                patient.medicalHistory.slice(0, 3).map((h, idx) => (
                  <div key={idx} style={{ marginBottom: '1px' }}>
                    <span style={{ fontWeight: 'bold', color: '#9ca3af' }}>{idx + 1}.</span> {h}
                  </div>
                ))
              ) : (
                <span style={{ color: '#d1d5db' }}>-</span>
              )}
              {patient.medicalHistory.length > 3 && (
                <div style={{ fontSize: '5.5pt', color: '#9ca3af' }}>+{patient.medicalHistory.length - 3} mais</div>
              )}
            </div>
          </div>

          {/* Plano Terapêutico */}
          <div>
            <div style={{ fontSize: '6pt', color: scheme.accent, marginBottom: '1px', fontWeight: '600', textTransform: 'uppercase' }}>
              Plano Terapêutico
            </div>
            <div style={{ fontSize: '6.5pt', color: '#374151', lineHeight: '1.35' }}>
              {planoTerapeutico.length > 0 ? (
                planoTerapeutico.slice(0, 3).map((c, idx) => (
                  <div key={idx} style={{ marginBottom: '1px' }}>
                    <span style={{ fontWeight: 'bold', color: '#9ca3af' }}>{idx + 1}.</span> {c}
                  </div>
                ))
              ) : (
                <span style={{ color: '#d1d5db' }}>-</span>
              )}
              {planoTerapeutico.length > 3 && (
                <div style={{ fontSize: '5.5pt', color: '#9ca3af' }}>+{planoTerapeutico.length - 3} mais</div>
              )}
            </div>
          </div>

          {/* Pendências */}
          <div>
            <div style={{ fontSize: '6pt', color: scheme.accent, marginBottom: '1px', fontWeight: '600', textTransform: 'uppercase' }}>
              Pendências
            </div>
            <div style={{ fontSize: '6.5pt', color: '#374151', lineHeight: '1.35' }}>
              {patient.pendencies.length > 0 ? (
                patient.pendencies.map((p, idx) => {
                  const isHighlighted = patient.highlightedPendencies?.includes(idx);
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        marginBottom: '1px',
                        fontWeight: isHighlighted ? 'bold' : 'normal',
                        backgroundColor: isHighlighted ? scheme.light : 'transparent',
                        padding: isHighlighted ? '1px 2px' : '0',
                        borderRadius: isHighlighted ? '2px' : '0'
                      }}
                    >
                      <span style={{ fontWeight: 'bold', color: '#9ca3af' }}>{idx + 1}.</span> {p}
                    </div>
                  );
                })
              ) : (
                <span style={{ color: '#d1d5db' }}>-</span>
              )}
            </div>
          </div>
        </div>
        
        {/* Critical info row (if exists) */}
        {(dispositivos.length > 0 || culturasAtb.length > 0 || alergias.length > 0) && (
          <div style={{ 
            marginTop: '3px',
            paddingTop: '3px',
            borderTop: '1px dashed #fca5a5',
            display: 'flex',
            gap: '10px',
            fontSize: '6pt'
          }}>
            {dispositivos.length > 0 && (
              <div>
                <span style={{ color: '#991b1b', fontWeight: '600' }}>DISP: </span>
                <span style={{ color: '#374151' }}>{dispositivos.join(', ')}</span>
              </div>
            )}
            {alergias.length > 0 && (
              <div>
                <span style={{ color: '#991b1b', fontWeight: '600' }}>ALERG: </span>
                <span style={{ color: '#374151' }}>{alergias.join(', ')}</span>
              </div>
            )}
            {culturasAtb.length > 0 && (
              <div>
                <span style={{ color: '#991b1b', fontWeight: '600' }}>ATB: </span>
                <span style={{ color: '#374151' }}>{culturasAtb.join(', ')}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  
  // Detailed mode - more space for each field
  return (
    <div 
      style={{ 
        border: `1px solid ${scheme.border}`,
        borderLeft: `4px solid ${scheme.primary}`,
        borderRadius: '6px',
        padding: '10px 12px',
        marginBottom: '8px',
        backgroundColor: '#ffffff',
        fontSize: '8.5pt',
        pageBreakInside: 'avoid',
        breakInside: 'avoid'
      }}
    >
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        marginBottom: '8px',
        paddingBottom: '6px',
        borderBottom: `1px solid ${scheme.border}`
      }}>
        <div style={{ 
          backgroundColor: scheme.primary,
          color: '#ffffff',
          padding: '4px 12px',
          borderRadius: '4px',
          fontSize: '10pt',
          fontWeight: 'bold'
        }}>
          {patient.bedNumber}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10pt', fontWeight: 'bold', color: '#111827' }}>
            {patient.name || 'SEM NOME'}
          </div>
          <div style={{ fontSize: '8pt', color: '#6b7280' }}>
            {formatAgeDisplay(patient.age)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ 
            backgroundColor: daysInUti > 4 ? '#fef2f2' : scheme.light,
            border: `1px solid ${daysInUti > 4 ? '#fca5a5' : scheme.border}`,
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '8pt',
            fontWeight: 'bold',
            color: daysInUti > 4 ? '#991b1b' : scheme.accent
          }}>
            DIH: {daysInUti} dias {daysInUti > 4 && '⚠️'}
          </div>
          {patient.utiAdmissionDate?.[0] && (
            <div style={{ fontSize: '7pt', color: '#9ca3af', marginTop: '2px' }}>
              Admissão: {patient.utiAdmissionDate[0]}
            </div>
          )}
        </div>
      </div>
      
      {/* 4-column grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr 1fr 1.2fr',
        gap: '12px',
        marginBottom: '8px'
      }}>
        {/* Hipóteses / Diagnósticos */}
        <div>
          <div style={{ fontSize: '7pt', color: scheme.accent, marginBottom: '3px', fontWeight: '600', textTransform: 'uppercase' }}>
            Hipóteses / Diagnósticos
          </div>
          <div style={{ fontSize: '8pt', color: '#374151', lineHeight: '1.5' }}>
            {patient.diagnoses.length > 0 ? (
              patient.diagnoses.map((d, idx) => (
                <div key={idx} style={{ marginBottom: '2px' }}>
                  <span style={{ fontWeight: 'bold', color: '#6b7280' }}>{idx + 1}.</span> {d}
                </div>
              ))
            ) : (
              <span style={{ color: '#d1d5db' }}>-</span>
            )}
          </div>
        </div>

        {/* Antecedentes */}
        <div>
          <div style={{ fontSize: '7pt', color: scheme.accent, marginBottom: '3px', fontWeight: '600', textTransform: 'uppercase' }}>
            Antecedentes
          </div>
          <div style={{ fontSize: '8pt', color: '#374151', lineHeight: '1.5' }}>
            {patient.medicalHistory.length > 0 ? (
              patient.medicalHistory.map((h, idx) => (
                <div key={idx} style={{ marginBottom: '2px' }}>
                  <span style={{ fontWeight: 'bold', color: '#6b7280' }}>{idx + 1}.</span> {h}
                </div>
              ))
            ) : (
              <span style={{ color: '#d1d5db' }}>-</span>
            )}
          </div>
        </div>

        {/* Plano Terapêutico */}
        <div>
          <div style={{ fontSize: '7pt', color: scheme.accent, marginBottom: '3px', fontWeight: '600', textTransform: 'uppercase' }}>
            Plano Terapêutico
          </div>
          <div style={{ fontSize: '8pt', color: '#374151', lineHeight: '1.5' }}>
            {planoTerapeutico.length > 0 ? (
              planoTerapeutico.map((c, idx) => (
                <div key={idx} style={{ marginBottom: '2px' }}>
                  <span style={{ fontWeight: 'bold', color: '#6b7280' }}>{idx + 1}.</span> {c}
                </div>
              ))
            ) : (
              <span style={{ color: '#d1d5db' }}>-</span>
            )}
          </div>
        </div>

        {/* Pendências */}
        <div>
          <div style={{ fontSize: '7pt', color: scheme.accent, marginBottom: '3px', fontWeight: '600', textTransform: 'uppercase' }}>
            Programações / Pendências
          </div>
          <div style={{ fontSize: '8pt', color: '#374151', lineHeight: '1.5' }}>
            {patient.pendencies.length > 0 ? (
              patient.pendencies.map((p, idx) => {
                const isHighlighted = patient.highlightedPendencies?.includes(idx);
                return (
                  <div 
                    key={idx} 
                    style={{ 
                      marginBottom: '2px',
                      fontWeight: isHighlighted ? 'bold' : 'normal',
                      backgroundColor: isHighlighted ? scheme.light : 'transparent',
                      padding: isHighlighted ? '1px 4px' : '0',
                      borderRadius: isHighlighted ? '3px' : '0'
                    }}
                  >
                    <span style={{ fontWeight: 'bold', color: '#6b7280' }}>{idx + 1}.</span> {p}
                  </div>
                );
              })
            ) : (
              <span style={{ color: '#d1d5db' }}>-</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Critical section */}
      {(dispositivos.length > 0 || culturasAtb.length > 0 || alergias.length > 0) && (
        <div style={{ 
          padding: '6px 8px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '4px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          fontSize: '7.5pt'
        }}>
          {dispositivos.length > 0 && (
            <div>
              <div style={{ color: '#991b1b', fontWeight: '600', marginBottom: '2px' }}>DISPOSITIVOS</div>
              <div style={{ color: '#374151' }}>{dispositivos.join(' • ')}</div>
            </div>
          )}
          {alergias.length > 0 && (
            <div>
              <div style={{ color: '#991b1b', fontWeight: '600', marginBottom: '2px' }}>ALERGIAS</div>
              <div style={{ color: '#374151' }}>{alergias.join(' • ')}</div>
            </div>
          )}
          {culturasAtb.length > 0 && (
            <div>
              <div style={{ color: '#991b1b', fontWeight: '600', marginBottom: '2px' }}>CULTURAS / ATB</div>
              <div style={{ color: '#374151' }}>{culturasAtb.join(' • ')}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
