import { Patient } from "@/types/patient";
import { ClipboardList } from "lucide-react";
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

  const pageStyle = `
    @page {
      size: A4 landscape;
      margin: 12mm 15mm 18mm 15mm;
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
      
      /* Fixed header on all pages */
      .print-header-fixed {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: auto;
        padding: 8mm 15mm 5mm 15mm;
        background: #ffffff;
        z-index: 1000;
        border-bottom: 2px solid #d1d5db;
      }
      
      /* Fixed footer on all pages */
      .print-footer-fixed {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: auto;
        padding: 3mm 15mm 5mm 15mm;
        background: #ffffff;
        z-index: 1000;
        border-top: 1px solid #e5e7eb;
      }
      
      /* Fixed watermark on all pages */
      .print-watermark-fixed {
        position: fixed;
        top: 5mm;
        right: 12mm;
        z-index: 999;
      }
      
      /* Content area with margins to avoid overlap with fixed elements */
      .print-content-area {
        margin-top: ${isCompact ? '32mm' : '36mm'};
        margin-bottom: 20mm;
      }
      
      /* Developer signature fixed position */
      .print-dev-signature {
        position: fixed;
        bottom: 5mm;
        right: 15mm;
        font-size: 5.5pt;
        font-style: italic;
        color: #9ca3af;
        opacity: 0.4;
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
    padding: isCompact ? '10mm 12mm' : '12mm 15mm',
    paddingTop: isCompact ? '12mm' : '15mm',
    fontSize: isCompact ? '8.5pt' : '9.5pt',
    lineHeight: isCompact ? '1.25' : '1.35',
    backgroundColor: '#ffffff',
    minHeight: '210mm',
    boxShadow: isPreview ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
  };

  const totalPatients = uti1Patients.length + uti2Patients.length + outsidePatients.length;

  return (
    <>
      <style>{pageStyle}</style>
      <div style={containerStyle}>
        {/* Fixed Watermark - appears on all pages */}
        <img 
          src={whitelabel.logos.networkFull} 
          alt={whitelabel.institution.networkLogoAlt}
          className="print-watermark-fixed"
          style={{ 
            position: 'absolute',
            top: '4mm',
            right: '8mm',
            height: isCompact ? '30px' : '38px',
            width: 'auto',
            opacity: 0.30,
            zIndex: 0
          }}
        />
        
        {/* Fixed Header - appears on all pages */}
        <div 
          className="print-header-fixed"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: isCompact ? '8px' : '10px', 
            paddingBottom: isCompact ? '6px' : '8px', 
            borderBottom: '2px solid #d1d5db',
            position: 'relative',
            zIndex: 1
          }}
        >
          <div style={{ 
            height: isCompact ? '28px' : '32px', 
            width: isCompact ? '28px' : '32px', 
            background: 'linear-gradient(135deg, #3b82f6, #eab308)', 
            borderRadius: '5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <ClipboardList style={{ height: isCompact ? '14px' : '16px', width: isCompact ? '14px' : '16px', color: '#ffffff' }} />
          </div>
          <h1 style={{ 
            fontSize: isCompact ? '14pt' : '16pt', 
            fontWeight: 'bold', 
            textTransform: 'uppercase',
            margin: 0,
            color: '#000000',
            letterSpacing: '0.4px'
          }}>
            Mapa UTI - {whitelabel.institution.hospitalName}
          </h1>
        </div>
        
        {/* Metadata */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: '10px',
          fontSize: isCompact ? '7.5pt' : '8.5pt', 
          color: '#4b5563', 
          marginBottom: isCompact ? '8px' : '10px', 
          paddingBottom: isCompact ? '6px' : '8px', 
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          padding: '6px 8px',
          borderRadius: '3px'
        }}>
          <div><strong>Data:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
          <div><strong>Hora:</strong> {new Date().toLocaleTimeString('pt-BR')}</div>
          <div><strong>Total:</strong> {totalPatients} pacientes</div>
          <div><strong>Modo:</strong> {mode === 'compact' ? 'Retraído' : 'Detalhado'}</div>
        </div>
        
        {/* UTI Sectors - Content Area */}
        <div className="print-content-area">
          <PrintableSectorSection
            patients={uti1Patients}
            sectorName="Unidade de Terapia Intensiva 1"
            bgColor="#eff6ff"
            borderColor="#3b82f6"
            textColor="#1d4ed8"
            mode={mode}
            isUti={true}
            utiColorVariant="blue"
          />
          <PrintableSectorSection
            patients={uti2Patients}
            sectorName="Unidade de Terapia Intensiva 2"
            bgColor="#fefce8"
            borderColor="#eab308"
            textColor="#a16207"
            mode={mode}
            isUti={true}
            utiColorVariant="yellow"
          />
          {outsidePatients.length > 0 && (
            <PrintableSectorSection
              patients={outsidePatients}
              sectorName="Solicitações de Leito UTI"
              bgColor="#f9fafb"
              borderColor="#6b7280"
              textColor="#4b5563"
              mode={mode}
              isUti={true}
              utiColorVariant="blue"
            />
          )}
        </div>
        
        {/* Fixed Footer - appears on all pages */}
        <div 
          className="print-footer-fixed"
          style={{ 
            fontSize: isCompact ? '6.5pt' : '7.5pt',
            fontStyle: 'italic',
            textAlign: 'center', 
            color: '#9ca3af', 
            marginTop: isCompact ? '12px' : '16px', 
            paddingTop: isCompact ? '8px' : '10px', 
            borderTop: '1px solid #f3f4f6',
            letterSpacing: '0.2px',
            opacity: 0.85
          }}
        >
          Unidade de Terapia Intensiva • {whitelabel.institution.hospitalName} • Documento gerado automaticamente • {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
        </div>
        
        {/* Developer Signature - Fixed position on all pages */}
        <div 
          className="print-dev-signature"
          style={{
            position: 'fixed',
            bottom: '5mm',
            right: '10mm',
            fontSize: '5.5pt',
            fontStyle: 'italic',
            color: '#9ca3af',
            opacity: 0.4,
            zIndex: 1000
          }}
        >
          {whitelabel.credits.authorSignature}
        </div>
      </div>
    </>
  );
}
