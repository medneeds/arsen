import { Patient } from "@/types/patient";
import { PrintableSectorSection } from "./PrintableSectorSection";
import { whitelabel, getMainPageTitle } from "@/config/whitelabel";

interface PrintLayoutProps {
  redPatients: Patient[];
  yellowPatients: Patient[];
  bluePatients: Patient[];
  outsidePatients: Patient[];
  mode: 'compact' | 'detailed';
  isPreview?: boolean;
}

export function PrintLayout({ 
  redPatients, 
  yellowPatients, 
  bluePatients,
  outsidePatients, 
  mode,
  isPreview = false 
}: PrintLayoutProps) {

  const isCompact = mode === 'compact';
  const totalPatients = redPatients.length + yellowPatients.length + bluePatients.length + outsidePatients.length;

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
    }
  `;

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    maxWidth: isPreview ? '297mm' : 'none',
    margin: isPreview ? '0 auto' : '0',
    padding: isCompact ? '8mm 10mm' : '10mm 12mm',
    fontSize: isCompact ? '8pt' : '9pt',
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
            height: isCompact ? '24px' : '30px',
            width: 'auto',
            opacity: 0.2,
            zIndex: 0
          }}
        />
        
        {/* Header — single elegant line */}
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
              {getMainPageTitle()}
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
        
        {/* Sectors */}
        <div>
          <PrintableSectorSection
            patients={redPatients}
            sectorName="UTI 1"
            bgColor="#fef2f2"
            borderColor="#dc2626"
            textColor="#991b1b"
            mode={mode}
          />
          <PrintableSectorSection
            patients={yellowPatients}
            sectorName="UTI 2"
            bgColor="#fefce8"
            borderColor="#ca8a04"
            textColor="#854d0e"
            mode={mode}
          />
          <PrintableSectorSection
            patients={bluePatients}
            sectorName="UCI 1"
            bgColor="#eff6ff"
            borderColor="#2563eb"
            textColor="#1e40af"
            mode={mode}
          />
          <PrintableSectorSection
            patients={outsidePatients}
            sectorName="Fora das Alas"
            bgColor="#f8fafc"
            borderColor="#64748b"
            textColor="#475569"
            mode={mode}
          />
        </div>
        
        {/* Footer — minimal */}
        <div style={{ 
          fontSize: isCompact ? '6pt' : '6.5pt',
          textAlign: 'center', 
          color: '#94a3b8', 
          marginTop: isCompact ? '8px' : '12px', 
          paddingTop: isCompact ? '6px' : '8px', 
          borderTop: '0.5px solid #e2e8f0',
          letterSpacing: '0.3px'
        }}>
          {whitelabel.institution.hospitalName} • {whitelabel.print.documentFooter(now.toLocaleDateString('pt-BR'), now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))}
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
