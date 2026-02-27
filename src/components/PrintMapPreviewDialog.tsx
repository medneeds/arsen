import { Patient } from "@/types/patient";
import { Button } from "@/components/ui/button";
import { X, Download, ClipboardList } from "lucide-react";
import { useRef } from "react";
import { whitelabel, getMainPageTitle } from "@/config/whitelabel";
import { PrintableSectorSection } from "./PrintableSectorSection";

interface PrintMapPreviewDialogProps {
  redPatients: Patient[];
  yellowPatients: Patient[];
  bluePatients: Patient[];
  outsidePatients: Patient[];
  mode: 'compact' | 'detailed';
  onClose: () => void;
}

export function PrintMapPreviewDialog({ 
  redPatients, 
  yellowPatients, 
  bluePatients,
  outsidePatients, 
  mode,
  onClose 
}: PrintMapPreviewDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const isCompact = mode === 'compact';

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) {
      alert("Por favor, permita pop-ups para imprimir o documento.");
      return;
    }

    const htmlToPrint = printContent.outerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${getMainPageTitle()}</title>
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
              size: A4 landscape;
              margin: 8mm;
            }
            @media print {
              html, body {
                overflow: visible !important;
                height: auto !important;
                background: #ffffff !important;
              }
            }
            .watermark {
              position: absolute;
              top: 5mm;
              right: 10mm;
              height: ${isCompact ? '35px' : '45px'};
              width: auto;
              opacity: 0.35;
            }
            .header-icon {
              height: ${isCompact ? '32px' : '36px'};
              width: ${isCompact ? '32px' : '36px'};
              background: linear-gradient(135deg, #ef4444, #eab308, #3b82f6);
              border-radius: 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }
            .header-icon svg {
              height: ${isCompact ? '16px' : '18px'};
              width: ${isCompact ? '16px' : '18px'};
              color: #ffffff;
            }
            .sector-section {
              margin-bottom: ${isCompact ? '10px' : '14px'};
              page-break-inside: avoid;
            }
            .sector-header {
              padding: ${isCompact ? '6px 10px' : '8px 12px'};
              border-radius: 4px;
              margin-bottom: ${isCompact ? '6px' : '8px'};
              font-weight: 600;
              font-size: ${isCompact ? '9pt' : '10pt'};
              text-transform: uppercase;
            }
            .patient-row {
              display: grid;
              grid-template-columns: ${isCompact ? '50px 1fr 60px' : '60px 1fr 80px'};
              gap: 8px;
              padding: ${isCompact ? '4px 8px' : '6px 10px'};
              border-bottom: 1px solid #e5e7eb;
              font-size: ${isCompact ? '8pt' : '9pt'};
              align-items: start;
            }
            .patient-row:last-child {
              border-bottom: none;
            }
            .bed-badge {
              font-weight: bold;
              padding: 2px 6px;
              border-radius: 3px;
              text-align: center;
              font-size: ${isCompact ? '8pt' : '9pt'};
            }
            .patient-name {
              font-weight: 600;
              text-transform: uppercase;
            }
            .patient-details {
              color: #6b7280;
              margin-top: 2px;
            }
            .patient-age {
              text-align: right;
              color: #374151;
            }
            .footer {
              font-size: ${isCompact ? '7.5pt' : '8.5pt'};
              font-style: italic;
              text-align: center;
              color: #9ca3af;
              margin-top: ${isCompact ? '16px' : '20px'};
              padding-top: ${isCompact ? '12px' : '14px'};
              border-top: 1px solid #f3f4f6;
            }
            .dev-signature {
              position: fixed;
              bottom: 8mm;
              right: 10mm;
              font-size: 6pt;
              font-style: italic;
              color: #9ca3af;
              opacity: 0.4;
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
          Mapa de Pacientes {mode === 'compact' ? '(Compacto)' : '(Detalhado)'}
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

      {/* Document Preview - Landscape orientation */}
      <div className="flex justify-center py-4 sm:py-8 px-2 sm:px-4 bg-background overflow-x-auto">
        <div className="bg-card rounded-lg shadow-2xl overflow-hidden" style={{ width: '297mm', minWidth: '297mm', maxWidth: '100vw' }}>
          <div
            ref={printRef}
            style={{
              width: "297mm",
              minHeight: "210mm",
              padding: isCompact ? '12mm 15mm' : '15mm 18mm',
              paddingTop: isCompact ? '15mm' : '18mm',
              position: "relative",
              boxSizing: "border-box",
              backgroundColor: "#ffffff",
              color: "#1f2937",
              fontSize: isCompact ? '9pt' : '10pt',
              lineHeight: isCompact ? '1.3' : '1.4',
              aspectRatio: '297/210', /* A4 Landscape ratio */
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
                right: '10mm',
                height: isCompact ? '35px' : '45px',
                width: 'auto',
                opacity: 0.35,
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
            
            {/* Developer Signature */}
            <div style={{
              position: 'absolute',
              bottom: '8mm',
              right: '10mm',
              fontSize: '6pt',
              fontStyle: 'italic',
              color: '#9ca3af',
              opacity: 0.4,
            }}>
              {whitelabel.credits.authorSignature}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
