import { Patient } from "@/types/patient";
import { formatAgeDisplay } from "@/utils/ageDisplay";
import { ClipboardList } from "lucide-react";
import { whitelabel, getConfidentialityFooter } from "@/config/whitelabel";

interface PrintPatientLayoutProps {
  patient: Patient;
}

const sectorLabels = {
  red: "UTI 1",
  yellow: "UTI 2",
  blue: "UCI 1",
  outside: "UCI 2"
};

const sectorColors = {
  red: {
    primary: '#ef4444',
    light: '#fee2e2',
    border: '#fca5a5',
    text: '#7f1d1d',
    dark: '#991b1b'
  },
  yellow: {
    primary: '#eab308',
    light: '#fef9c3',
    border: '#fde047',
    text: '#713f12',
    dark: '#854d0e'
  },
  blue: {
    primary: '#3b82f6',
    light: '#dbeafe',
    border: '#93c5fd',
    text: '#1e3a8a',
    dark: '#1e40af'
  },
  outside: {
    primary: '#6b7280',
    light: '#f3f4f6',
    border: '#d1d5db',
    text: '#1f2937',
    dark: '#374151'
  }
};

export function PrintPatientLayout({ patient }: PrintPatientLayoutProps) {
  const colors = sectorColors[patient.sector] || sectorColors.outside;
  
  const containerStyle: React.CSSProperties = {
    padding: '12mm',
    paddingBottom: '24mm',
    fontSize: '8.5pt',
    lineHeight: '1.35',
    backgroundColor: '#ffffff',
    color: '#1f2937',
    position: 'relative',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '100%',
    overflow: 'visible'
  };

  const pageStyle = `
    @page {
      size: A4 portrait;
      margin: 8mm;
    }
    
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }

      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        box-sizing: border-box !important;
      }
      
      /* Mobile Safari specific fixes */
      @supports (-webkit-touch-callout: none) {
        * {
          -webkit-print-color-adjust: exact !important;
        }
      }
    }
  `;

  const SectionCard = ({ title, children }: { 
    title: string; 
    children: React.ReactNode;
  }) => (
    <div style={{ 
      marginBottom: '8px',
      padding: '8px 10px',
      borderRadius: '3px',
      border: '1px solid #e5e7eb',
      backgroundColor: '#fafafa'
    }}>
      <div style={{ 
        fontSize: '7.5pt', 
        fontWeight: '600', 
        color: '#4b5563', 
        marginBottom: '6px', 
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {title}
      </div>
      {children}
    </div>
  );

  return (
    <>
      <style>{pageStyle}</style>
      <div style={containerStyle}>
        {/* Logo Watermark */}
        <img 
          src={whitelabel.logos.networkFull} 
          alt={whitelabel.institution.networkLogoAlt}
          style={{ 
            position: 'absolute',
            top: '5mm',
            right: '8mm',
            height: '26px',
            width: 'auto',
            opacity: 0.15,
            zIndex: 0
          }}
        />
        
        {/* Header - Minimalista */}
        <div style={{ 
          borderLeft: `4px solid ${colors.primary}`,
          padding: '8px 10px',
          marginBottom: '10px',
          backgroundColor: '#fafafa',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: '6px'
          }}>
            <div>
              <h1 style={{ 
                fontSize: '11pt', 
                fontWeight: '600', 
                textTransform: 'uppercase',
                margin: 0,
                color: '#111827',
                letterSpacing: '0.3px'
              }}>
                Caso Clínico Completo
              </h1>
              <div style={{ 
                fontSize: '7pt', 
                color: '#6b7280',
                marginTop: '2px'
              }}>
                {sectorLabels[patient.sector]} • Leito {patient.bedNumber}
              </div>
            </div>
            <div style={{ 
              backgroundColor: colors.primary,
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '3px',
              fontSize: '12pt',
              fontWeight: 'bold'
            }}>
              {patient.bedNumber}
            </div>
          </div>
          
          {/* Metadata Bar */}
          <div style={{ 
            display: 'flex',
            gap: '8px',
            fontSize: '6.5pt',
            color: '#6b7280',
            paddingTop: '6px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <div>
              {new Date().toLocaleDateString('pt-BR')}
            </div>
            <div style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '8px' }}>
              {new Date().toLocaleTimeString('pt-BR')}
            </div>
            {patient.admissionDate && (
              <div style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '8px' }}>
                Admissão: {new Date(patient.admissionDate).toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>
        </div>

        {/* Patient Card - Clean */}
        <div style={{ 
          padding: '10px 12px', 
          marginBottom: '10px',
          border: '1px solid #e5e7eb',
          borderLeft: `3px solid ${colors.primary}`,
          backgroundColor: '#ffffff'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px'
          }}>
            <div>
              <div style={{ fontSize: '6.5pt', color: '#9ca3af', marginBottom: '2px', fontWeight: '600', textTransform: 'uppercase' }}>
                Paciente
              </div>
              <div style={{ 
                fontSize: '10pt', 
                fontWeight: '600', 
                color: '#111827', 
                textTransform: 'uppercase',
                letterSpacing: '0.3px'
              }}>
                {patient.name}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: '6.5pt', color: '#9ca3af', marginBottom: '2px', fontWeight: '600' }}>IDADE</div>
              <div style={{ fontSize: '9pt', fontWeight: '600', color: '#374151' }}>{formatAgeDisplay(patient.age)}</div>
            </div>
          </div>
        </div>

        {/* UTI-specific header info */}
        {(patient.utiAdmissionDate?.[0] || patient.utiOriginSector?.[0]) && (
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '10px',
            padding: '8px 10px',
            backgroundColor: colors.light,
            borderRadius: '4px',
            fontSize: '7.5pt'
          }}>
            {patient.utiOriginSector?.[0] && (
              <div>
                <span style={{ color: '#6b7280', fontWeight: '600' }}>Setor de Origem: </span>
                <span style={{ color: '#111827' }}>{patient.utiOriginSector[0]}</span>
              </div>
            )}
            {patient.utiAdmissionDate?.[0] && (
              <div>
                <span style={{ color: '#6b7280', fontWeight: '600' }}>Admissão UTI: </span>
                <span style={{ color: '#111827' }}>{patient.utiAdmissionDate[0]}</span>
              </div>
            )}
            {patient.utiDischargePrediction?.[0] && (
              <div>
                <span style={{ color: '#6b7280', fontWeight: '600' }}>Previsão Alta: </span>
                <span style={{ color: '#111827' }}>{patient.utiDischargePrediction[0]}</span>
              </div>
            )}
          </div>
        )}

        {/* UTI Critical Fields - Devices, Allergies, Cultures */}
        {((patient.utiDevices?.length || 0) > 0 || (patient.utiAllergies?.length || 0) > 0 || (patient.utiCulturesAntibiotics?.length || 0) > 0) && (
          <div style={{
            padding: '8px 10px',
            marginBottom: '8px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '4px'
          }}>
            <div style={{ 
              fontSize: '7pt', 
              fontWeight: '600', 
              color: '#991b1b', 
              marginBottom: '6px',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              ⚠ Informações Críticas
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {(patient.utiDevices?.length || 0) > 0 && (
                <div>
                  <div style={{ fontSize: '7pt', color: '#991b1b', fontWeight: '600', marginBottom: '3px' }}>DISPOSITIVOS</div>
                  <ul style={{ margin: 0, paddingLeft: '14px', listStyleType: 'disc' }}>
                    {patient.utiDevices!.map((d, idx) => (
                      <li key={idx} style={{ fontSize: '7.5pt', color: '#374151', marginBottom: '2px' }}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(patient.utiAllergies?.length || 0) > 0 && (
                <div>
                  <div style={{ fontSize: '7pt', color: '#991b1b', fontWeight: '600', marginBottom: '3px' }}>ALERGIAS</div>
                  <ul style={{ margin: 0, paddingLeft: '14px', listStyleType: 'disc' }}>
                    {patient.utiAllergies!.map((a, idx) => (
                      <li key={idx} style={{ fontSize: '7.5pt', color: '#374151', marginBottom: '2px' }}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(patient.utiCulturesAntibiotics?.length || 0) > 0 && (
                <div>
                  <div style={{ fontSize: '7pt', color: '#991b1b', fontWeight: '600', marginBottom: '3px' }}>CULTURAS / ATB</div>
                  <ul style={{ margin: 0, paddingLeft: '14px', listStyleType: 'disc' }}>
                    {patient.utiCulturesAntibiotics!.map((c, idx) => (
                      <li key={idx} style={{ fontSize: '7.5pt', color: '#374151', marginBottom: '2px' }}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clinical Sections - Minimalista */}
        {patient.diagnoses.length > 0 && (
          <SectionCard title="Hipóteses Diagnósticas">
            <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc' }}>
              {patient.diagnoses.map((diagnosis, idx) => (
                <li key={idx} style={{ 
                  fontSize: '8pt', 
                  color: '#374151', 
                  marginBottom: '3px', 
                  lineHeight: '1.35'
                }}>
                  {diagnosis}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {patient.medicalHistory.length > 0 && (
          <SectionCard title="Antecedentes Mórbidos Pessoais">
            <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc' }}>
              {patient.medicalHistory.map((history, idx) => (
                <li key={idx} style={{ 
                  fontSize: '8pt', 
                  color: '#374151', 
                  marginBottom: '3px', 
                  lineHeight: '1.35'
                }}>
                  {history}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* UTI-specific: Plano Terapêutico */}
        {(patient.utiDailyConducts?.length || 0) > 0 && (
          <SectionCard title="Plano Terapêutico">
            <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'decimal' }}>
              {patient.utiDailyConducts!.map((conduct, idx) => (
                <li key={idx} style={{ 
                  fontSize: '8pt', 
                  color: '#374151', 
                  marginBottom: '3px', 
                  lineHeight: '1.35'
                }}>
                  {conduct}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {patient.relevantExams.length > 0 && (
          <SectionCard title="Exames Complementares Relevantes">
            <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'square' }}>
              {patient.relevantExams.map((exam, idx) => (
                <li key={idx} style={{ 
                  fontSize: '8pt', 
                  color: '#374151', 
                  marginBottom: '3px', 
                  lineHeight: '1.35'
                }}>
                  {exam}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {patient.pendencies.length > 0 && (
          <SectionCard title="Programações e Pendências">
            <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'decimal' }}>
              {patient.pendencies.map((pendency, idx) => {
                const isHighlighted = patient.highlightedPendencies?.includes(idx);
                return (
                  <li 
                    key={idx} 
                    style={{ 
                      fontSize: '8pt', 
                      color: '#374151', 
                      marginBottom: '3px', 
                      lineHeight: '1.35',
                      fontWeight: isHighlighted ? '600' : 'normal',
                      backgroundColor: isHighlighted ? colors.light : 'transparent',
                      padding: isHighlighted ? '2px 4px' : '0',
                      marginLeft: isHighlighted ? '-4px' : '0',
                      borderRadius: isHighlighted ? '2px' : '0',
                      border: isHighlighted ? `1px solid ${colors.border}` : 'none'
                    }}
                  >
                    {pendency}
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        )}

        {/* UTI Admission Reason */}
        {patient.utiAdmissionReason?.[0] && (
          <SectionCard title="Motivo da Admissão UTI">
            <div style={{ 
              fontSize: '8pt', 
              color: '#374151', 
              lineHeight: '1.4',
              whiteSpace: 'pre-wrap'
            }}>
              {patient.utiAdmissionReason[0]}
            </div>
          </SectionCard>
        )}

        {patient.admissionHistory && (
          <SectionCard title="História Admissional e Anamnese Completa">
            <div style={{ 
              fontSize: '8pt', 
              color: '#374151', 
              lineHeight: '1.4',
              whiteSpace: 'pre-wrap',
              textAlign: 'justify'
            }}>
              {patient.admissionHistory}
            </div>
          </SectionCard>
        )}

        {/* Footer - Fixed at bottom */}
        <div style={{ 
          position: 'absolute',
          bottom: '8mm',
          left: '12mm',
          right: '12mm',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '6pt', 
          color: '#9ca3af', 
          paddingTop: '6px', 
          borderTop: `1px solid ${colors.border}`
        }}>
          <span>{getConfidentialityFooter()}</span>
          <span>{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}</span>
          <span style={{ fontStyle: 'italic', opacity: 0.6 }}>{whitelabel.credits.authorSignature}</span>
        </div>
      </div>
    </>
  );
}
