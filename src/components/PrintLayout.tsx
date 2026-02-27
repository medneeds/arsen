import { Patient } from "@/types/patient";
import { ClipboardList } from "lucide-react";
import { PrintableSectorSection } from "./PrintableSectorSection";
import { whitelabel, getMainPageTitle, getConfidentialityFooter } from "@/config/whitelabel";

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

  const pageStyle = `
    @page {
      size: A4 landscape;
      margin: 0;
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
      
      /* Mobile Safari specific fixes */
      @supports (-webkit-touch-callout: none) {
        * {
          -webkit-print-color-adjust: exact !important;
        }
      }
    }
  `;

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    maxWidth: isPreview ? '297mm' : 'none',
    margin: isPreview ? '0 auto' : '0',
    padding: isCompact ? '12mm 15mm' : '15mm 18mm',
    paddingTop: isCompact ? '15mm' : '18mm',
    fontSize: isCompact ? '9pt' : '10pt',
    lineHeight: isCompact ? '1.3' : '1.4',
    backgroundColor: '#ffffff',
    minHeight: '210mm',
    boxShadow: isPreview ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
  };

  return (
    <>
      <style>{pageStyle}</style>
      <div style={containerStyle}>
      {/* Logo as watermark */}
      <img 
        src={whitelabel.logos.networkFull} 
        alt={whitelabel.institution.networkLogoAlt}
        style={{ 
          position: 'absolute',
          top: '5mm',
          right: '10mm',
          height: isCompact ? '35px' : '45px',
          width: 'auto',
          opacity: 0.35,
          zIndex: 0
        }}
      />
      
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px', 
        marginBottom: isCompact ? '10px' : '14px', 
        paddingBottom: isCompact ? '8px' : '10px', 
        borderBottom: '2px solid #d1d5db',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ 
          height: isCompact ? '32px' : '36px', 
          width: isCompact ? '32px' : '36px', 
          background: 'linear-gradient(135deg, #ef4444, #eab308, #3b82f6)', 
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <ClipboardList style={{ height: isCompact ? '16px' : '18px', width: isCompact ? '16px' : '18px', color: '#ffffff' }} />
        </div>
        <h1 style={{ 
          fontSize: isCompact ? '16pt' : '18pt', 
          fontWeight: 'bold', 
          textTransform: 'uppercase',
          margin: 0,
          color: '#000000',
          letterSpacing: '0.5px'
        }}>
          {getMainPageTitle()}
        </h1>
      </div>
      
      {/* Metadata */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '12px',
        fontSize: isCompact ? '8.5pt' : '9.5pt', 
        color: '#4b5563', 
        marginBottom: isCompact ? '10px' : '14px', 
        paddingBottom: isCompact ? '8px' : '10px', 
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        padding: '8px',
        borderRadius: '4px'
      }}>
        <div><strong>Data:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
        <div><strong>Hora:</strong> {new Date().toLocaleTimeString('pt-BR')}</div>
        <div><strong>Modo:</strong> {mode === 'compact' ? 'Retraído' : 'Detalhado'}</div>
      </div>
      
      {/* Sectors */}
      <div>
        <PrintableSectorSection
          patients={redPatients}
          sectorName="Ala Vermelha"
          bgColor="#fef2f2"
          borderColor="#ef4444"
          textColor="#b91c1c"
          mode={mode}
        />
        <PrintableSectorSection
          patients={yellowPatients}
          sectorName="Ala Amarela"
          bgColor="#fefce8"
          borderColor="#eab308"
          textColor="#a16207"
          mode={mode}
        />
        <PrintableSectorSection
          patients={bluePatients}
          sectorName="Ala Azul"
          bgColor="#eff6ff"
          borderColor="#3b82f6"
          textColor="#1d4ed8"
          mode={mode}
        />
        <PrintableSectorSection
          patients={outsidePatients}
          sectorName="Fora das Alas"
          bgColor="#f9fafb"
          borderColor="#6b7280"
          textColor="#4b5563"
          mode={mode}
        />
      </div>
      
      {/* Footer */}
      <div style={{ 
        fontSize: isCompact ? '7.5pt' : '8.5pt',
        fontStyle: 'italic',
        textAlign: 'center', 
        color: '#9ca3af', 
        marginTop: isCompact ? '16px' : '20px', 
        paddingTop: isCompact ? '12px' : '14px', 
        borderTop: '1px solid #f3f4f6',
        letterSpacing: '0.3px',
        opacity: 0.85
      }}>
        Urgência e Emergência • {whitelabel.institution.hospitalName} • Documento gerado automaticamente • {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
      </div>
      
      {/* Developer Signature - Fixed Bottom Right */}
      <div style={{
        position: 'fixed',
        bottom: '8mm',
        right: '10mm',
        fontSize: '6pt',
        fontStyle: 'italic',
        color: '#9ca3af',
        opacity: 0.4,
        zIndex: 1000
      }}>
        {whitelabel.credits.authorSignature}
      </div>
    </div>
    </>
  );
}
