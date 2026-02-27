import { Patient } from "@/types/patient";
import { Button } from "@/components/ui/button";
import { Printer, X, Download } from "lucide-react";
import { formatAgeDisplay } from "@/utils/ageDisplay";
import { useRef } from "react";
import { whitelabel, getConfidentialityFooter } from "@/config/whitelabel";

interface PrintPatientPreviewDialogProps {
  patient: Patient;
  onClose: () => void;
}

const sectorLabels = {
  red: "Sala Vermelha",
  yellow: "Observação Amarela",
  blue: "Observação Azul",
  outside: "Fora das Alas"
};

const sectorColors = {
  red: {
    primary: '#ef4444',
    light: '#fee2e2',
    border: '#fca5a5',
  },
  yellow: {
    primary: '#eab308',
    light: '#fef9c3',
    border: '#fde047',
  },
  blue: {
    primary: '#3b82f6',
    light: '#dbeafe',
    border: '#93c5fd',
  },
  outside: {
    primary: '#6b7280',
    light: '#f3f4f6',
    border: '#d1d5db',
  }
};

export function PrintPatientPreviewDialog({ patient, onClose }: PrintPatientPreviewDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const colors = sectorColors[patient.sector] || sectorColors.outside;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      alert("Por favor, permita pop-ups para imprimir o documento.");
      return;
    }

    // Use outerHTML to preserve the white page container styling even in production builds
    const htmlToPrint = printContent.outerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Caso Clínico - ${patient.name}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html {
              color-scheme: light;
              background: #ffffff;
            }
            html, body {
              width: 100%;
              height: auto;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #ffffff !important;
              overflow: visible !important;
            }
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            @media print {
              html, body {
                overflow: visible !important;
                height: auto !important;
                background: #ffffff !important;
              }
              body {
                padding: 0;
              }
            }
            .watermark {
              position: absolute;
              top: 5mm;
              right: 8mm;
              height: 26px;
              width: auto;
              opacity: 0.15;
            }
            .header {
              border-left: 4px solid ${colors.primary};
              padding: 8px 10px;
              margin-bottom: 10px;
              background-color: #fafafa;
            }
            .header-title {
              font-size: 11pt;
              font-weight: 600;
              text-transform: uppercase;
              margin: 0;
              color: #111827;
            }
            .header-subtitle {
              font-size: 7pt;
              color: #6b7280;
              margin-top: 2px;
            }
            .bed-badge {
              background-color: ${colors.primary};
              color: #ffffff;
              padding: 6px 12px;
              border-radius: 3px;
              font-size: 12pt;
              font-weight: bold;
            }
            .patient-card {
              padding: 10px 12px;
              margin-bottom: 10px;
              border: 1px solid #e5e7eb;
              border-left: 3px solid ${colors.primary};
              background-color: #ffffff;
            }
            .section {
              margin-bottom: 8px;
              padding: 8px 10px;
              border-radius: 3px;
              border: 1px solid #e5e7eb;
              background-color: #fafafa;
            }
            .section-title {
              font-size: 7.5pt;
              font-weight: 600;
              color: #4b5563;
              margin-bottom: 6px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .section ul {
              margin: 0;
              padding-left: 16px;
            }
            .section li {
              font-size: 8pt;
              color: #374151;
              margin-bottom: 3px;
              line-height: 1.35;
            }
            .highlighted {
              font-weight: 600;
              background-color: ${colors.light};
              padding: 2px 4px;
              margin-left: -4px;
              border-radius: 2px;
              border: 1px solid ${colors.border};
            }
            .footer {
              position: absolute;
              bottom: 8mm;
              left: 12mm;
              right: 12mm;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 6pt;
              color: #9ca3af;
              padding-top: 6px;
              border-top: 1px solid ${colors.border};
            }
            .admission-history {
              white-space: pre-wrap;
              text-align: justify;
            }
          </style>
        </head>
        <body>
          ${htmlToPrint}
        </body>
      </html>
    `);

    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-auto print-light bg-background text-foreground">
      {/* Screen Controls */}
      <div className="sticky top-0 z-10 bg-card border-b border-border p-3 sm:p-4 flex items-center justify-between shadow-sm gap-2">
        <h2 className="text-sm sm:text-lg font-semibold text-foreground truncate">
          Caso Clínico - {patient.name}
        </h2>
        <div className="flex gap-2 flex-shrink-0">
          <Button onClick={handlePrint} size="sm" className="gap-1 sm:gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Gerar PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onClose} className="gap-1 sm:gap-2 bg-card border-border text-foreground hover:bg-muted">
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Fechar</span>
          </Button>
        </div>
      </div>

      {/* Document Preview */}
      <div className="flex justify-center py-4 sm:py-8 px-2 sm:px-4 bg-background">
        <div className="bg-card rounded-lg shadow-2xl overflow-hidden w-full max-w-[210mm]">
          <div
            ref={printRef}
            style={{
              width: "100%",
              minHeight: "297mm",
              padding: "12mm",
              paddingBottom: "24mm",
              position: "relative",
              boxSizing: "border-box",
              backgroundColor: "#ffffff",
              color: "#1f2937",
            }}
          >
            {/* Watermark */}
            <img 
              src={whitelabel.logos.networkFull} 
              alt={whitelabel.institution.networkLogoAlt}
              className="watermark"
              style={{ 
                position: 'absolute',
                top: '5mm',
                right: '8mm',
                height: '26px',
                width: 'auto',
                opacity: 0.15,
              }}
            />
            
            {/* Header */}
            <div className="header" style={{ 
              borderLeft: `4px solid ${colors.primary}`,
              padding: '8px 10px',
              marginBottom: '10px',
              backgroundColor: '#fafafa',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div>
                  <h1 style={{ fontSize: '11pt', fontWeight: 600, textTransform: 'uppercase', margin: 0, color: '#111827' }}>
                    Caso Clínico Completo
                  </h1>
                  <div style={{ fontSize: '7pt', color: '#6b7280', marginTop: '2px' }}>
                    {sectorLabels[patient.sector]} • Leito {patient.bedNumber}
                  </div>
                </div>
                <div className="bed-badge" style={{ 
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
              
              {/* Metadata */}
              <div style={{ 
                display: 'flex', gap: '8px', fontSize: '6.5pt', color: '#6b7280',
                paddingTop: '6px', borderTop: '1px solid #e5e7eb'
              }}>
                <div>{new Date().toLocaleDateString('pt-BR')}</div>
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

            {/* Patient Card */}
            <div className="patient-card" style={{ 
              padding: '10px 12px', marginBottom: '10px',
              border: '1px solid #e5e7eb',
              borderLeft: `3px solid ${colors.primary}`,
              backgroundColor: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '6.5pt', color: '#9ca3af', marginBottom: '2px', fontWeight: 600, textTransform: 'uppercase' }}>
                    Paciente
                  </div>
                  <div style={{ fontSize: '10pt', fontWeight: 600, color: '#111827', textTransform: 'uppercase' }}>
                    {patient.name}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: '6.5pt', color: '#9ca3af', marginBottom: '2px', fontWeight: 600 }}>IDADE</div>
                  <div style={{ fontSize: '9pt', fontWeight: 600, color: '#374151' }}>{formatAgeDisplay(patient.age)}</div>
                </div>
              </div>
            </div>

            {/* Diagnoses */}
            {patient.diagnoses.length > 0 && (
              <div className="section" style={{ marginBottom: '8px', padding: '8px 10px', borderRadius: '3px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa' }}>
                <div className="section-title" style={{ fontSize: '7.5pt', fontWeight: 600, color: '#4b5563', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Hipóteses Diagnósticas
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc' }}>
                  {patient.diagnoses.map((diagnosis, idx) => (
                    <li key={idx} style={{ fontSize: '8pt', color: '#374151', marginBottom: '3px', lineHeight: 1.35 }}>
                      {diagnosis}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Medical History */}
            {patient.medicalHistory.length > 0 && (
              <div className="section" style={{ marginBottom: '8px', padding: '8px 10px', borderRadius: '3px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa' }}>
                <div className="section-title" style={{ fontSize: '7.5pt', fontWeight: 600, color: '#4b5563', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Antecedentes Mórbidos Pessoais
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc' }}>
                  {patient.medicalHistory.map((history, idx) => (
                    <li key={idx} style={{ fontSize: '8pt', color: '#374151', marginBottom: '3px', lineHeight: 1.35 }}>
                      {history}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Relevant Exams */}
            {patient.relevantExams.length > 0 && (
              <div className="section" style={{ marginBottom: '8px', padding: '8px 10px', borderRadius: '3px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa' }}>
                <div className="section-title" style={{ fontSize: '7.5pt', fontWeight: 600, color: '#4b5563', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Exames Complementares Relevantes
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'square' }}>
                  {patient.relevantExams.map((exam, idx) => (
                    <li key={idx} style={{ fontSize: '8pt', color: '#374151', marginBottom: '3px', lineHeight: 1.35 }}>
                      {exam}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pendencies */}
            {patient.pendencies.length > 0 && (
              <div className="section" style={{ marginBottom: '8px', padding: '8px 10px', borderRadius: '3px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa' }}>
                <div className="section-title" style={{ fontSize: '7.5pt', fontWeight: 600, color: '#4b5563', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Programações e Pendências
                </div>
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
                          lineHeight: 1.35,
                          fontWeight: isHighlighted ? 600 : 'normal',
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
              </div>
            )}

            {/* Admission History */}
            {patient.admissionHistory && (
              <div className="section" style={{ marginBottom: '8px', padding: '8px 10px', borderRadius: '3px', border: '1px solid #e5e7eb', backgroundColor: '#fafafa' }}>
                <div className="section-title" style={{ fontSize: '7.5pt', fontWeight: 600, color: '#4b5563', marginBottom: '6px', textTransform: 'uppercase' }}>
                  História Admissional e Anamnese Completa
                </div>
                <div className="admission-history" style={{ fontSize: '8pt', color: '#374151', lineHeight: 1.4, whiteSpace: 'pre-wrap', textAlign: 'justify' }}>
                  {patient.admissionHistory}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="footer" style={{ 
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
        </div>
      </div>
    </div>
  );
}
