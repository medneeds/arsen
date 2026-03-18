import { Patient } from "@/types/patient";
import { PrintableSectorSection } from "./PrintableSectorSection";
import { whitelabel } from "@/config/whitelabel";

interface PrintUtiLayoutProps {
  uti1Patients: Patient[];
  uti2Patients: Patient[];
  outsidePatients: Patient[];
  mode: 'compact' | 'detailed';
  isPreview?: boolean;
}

export function PrintUtiLayout({ 
  uti1Patients, 
  uti2Patients,
  outsidePatients, 
  mode,
  isPreview = false 
}: PrintUtiLayoutProps) {

  const isCompact = mode === 'compact';
  const totalPatients = uti1Patients.length + uti2Patients.length + outsidePatients.length;

  const pageStyle = `
    @page {
      size: A4 landscape;
      margin: 8mm 10mm 10mm 10mm;
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
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
      .print-content-area {
        margin-top: 0;
      }
    }
  `;

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    maxWidth: isPreview ? '297mm' : 'none',
    margin: isPreview ? '0 auto' : '0',
    padding: isCompact ? '8mm 10mm' : '10mm 12mm',
    fontSize: isCompact ? '7.5pt' : '8.5pt',
    lineHeight: isCompact ? '1.2' : '1.3',
    backgroundColor: '#ffffff',
    minHeight: '210mm',
    fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
    boxShadow: isPreview ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
  };

  const now = new Date();

  return (
    <>
      <style>{pageStyle}</style>
      <div style={containerStyle}>
        {/* Watermark */}
        <img 
          src={whitelabel.logos.networkFull} 
          alt={whitelabel.institution.networkLogoAlt}
          style={{ 
            position: 'absolute',
            top: '6mm',
            right: '8mm',
            height: isCompact ? '22px' : '28px',
            width: 'auto',
            opacity: 0.18,
            zIndex: 0
          }}
        />
        
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: isCompact ? '6px' : '8px', 
          paddingBottom: isCompact ? '5px' : '6px', 
          borderBottom: '1.5px solid #1e293b',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <h1 style={{ 
              fontSize: isCompact ? '13pt' : '15pt', 
              fontWeight: '800', 
              textTransform: 'uppercase',
              margin: 0,
              color: '#0f172a',
              letterSpacing: '0.8px'
            }}>
              Mapa UTI — {whitelabel.institution.hospitalName}
            </h1>
            <span style={{ 
              fontSize: isCompact ? '7pt' : '7.5pt',
              color: '#64748b',
              fontWeight: '500'
            }}>
              {totalPatients} pacientes
            </span>
          </div>
          <div style={{ 
            fontSize: isCompact ? '7pt' : '7.5pt', 
            color: '#64748b',
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums'
          }}>
            {now.toLocaleDateString('pt-BR')} • {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {mode === 'compact' ? 'Compacto' : 'Detalhado'}
          </div>
        </div>
        
        {/* UTI Sectors */}
        <div className="print-content-area">
          <PrintableSectorSection
            patients={uti1Patients}
            sectorName="Unidade de Terapia Intensiva 1"
            bgColor="#eff6ff"
            borderColor="#2563eb"
            textColor="#1e40af"
            mode={mode}
            isUti={true}
            utiColorVariant="blue"
          />
          <PrintableSectorSection
            patients={uti2Patients}
            sectorName="Unidade de Terapia Intensiva 2"
            bgColor="#fefce8"
            borderColor="#ca8a04"
            textColor="#854d0e"
            mode={mode}
            isUti={true}
            utiColorVariant="yellow"
          />
          {outsidePatients.length > 0 && (
            <PrintableSectorSection
              patients={outsidePatients}
              sectorName="Solicitações de Leito UTI"
              bgColor="#f8fafc"
              borderColor="#64748b"
              textColor="#475569"
              mode={mode}
              isUti={true}
              utiColorVariant="blue"
            />
          )}
        </div>
        
        {/* Footer */}
        <div style={{ 
          fontSize: isCompact ? '6pt' : '6.5pt',
          textAlign: 'center', 
          color: '#94a3b8', 
          marginTop: isCompact ? '8px' : '12px', 
          paddingTop: isCompact ? '6px' : '8px', 
          borderTop: '0.5px solid #e2e8f0',
          letterSpacing: '0.3px'
        }}>
          UTI • {whitelabel.institution.hospitalName} • {whitelabel.print.documentFooter(now.toLocaleDateString('pt-BR'), now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))}
        </div>
        
        {/* Signature */}
        <div style={{
          position: 'fixed',
          bottom: '5mm',
          right: '8mm',
          fontSize: '5pt',
          color: '#cbd5e1',
          opacity: 0.5,
          zIndex: 1000
        }}>
          {whitelabel.credits.authorSignature}
        </div>
      </div>
    </>
  );
}
