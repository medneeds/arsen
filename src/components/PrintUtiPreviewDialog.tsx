import { Patient } from "@/types/patient";
import { Button } from "@/components/ui/button";
import { X, Download, ClipboardList, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { whitelabel, getPrintTitle } from "@/config/whitelabel";
import { PrintableSectorSection } from "./PrintableSectorSection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SectorSelection = 'all' | 'red' | 'yellow' | 'blue' | 'outside';

const SECTOR_LABELS: Record<SectorSelection, string> = {
  all: "Todos os setores",
  red: "UTI 1",
  yellow: "UTI 2",
  blue: "UCI 1",
  outside: "UCI 2",
};

const SECTOR_PRINT_CONFIG: Record<string, { name: string; bg: string; border: string; text: string; variant: string }> = {
  red: { name: "Unidade de Terapia Intensiva 1", bg: "#fef2f2", border: "#ef4444", text: "#b91c1c", variant: "red" },
  yellow: { name: "Unidade de Terapia Intensiva 2", bg: "#fefce8", border: "#eab308", text: "#a16207", variant: "yellow" },
  blue: { name: "Unidade de Cuidados Intermediários 1", bg: "#eff6ff", border: "#3b82f6", text: "#1d4ed8", variant: "blue" },
  outside: { name: "Unidade de Cuidados Intermediários 2", bg: "#f0fdf4", border: "#22c55e", text: "#15803d", variant: "green" },
};

interface PrintUtiPreviewDialogProps {
  redPatients: Patient[];
  yellowPatients: Patient[];
  bluePatients: Patient[];
  outsidePatients: Patient[];
  defaultSector?: SectorSelection;
  mode: 'compact' | 'detailed';
  onClose: () => void;
}

export function PrintUtiPreviewDialog({ 
  redPatients,
  yellowPatients,
  bluePatients,
  outsidePatients,
  defaultSector = 'all',
  mode,
  onClose 
}: PrintUtiPreviewDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const isCompact = mode === 'compact';
  const [selectedSector, setSelectedSector] = useState<SectorSelection>(defaultSector);

  // Build sectors to display
  const allSectors: { key: string; patients: Patient[] }[] = [
    { key: 'red', patients: redPatients },
    { key: 'yellow', patients: yellowPatients },
    { key: 'blue', patients: bluePatients },
    { key: 'outside', patients: outsidePatients },
  ];

  const sectorsToDisplay = selectedSector === 'all'
    ? allSectors.filter(s => s.patients.length > 0)
    : allSectors.filter(s => s.key === selectedSector && s.patients.length > 0);

  const totalPatients = sectorsToDisplay.reduce((sum, s) => sum + s.patients.length, 0);
  const sectorLabel = SECTOR_LABELS[selectedSector];
  const printTitle = selectedSector === 'all' ? 'Mapa de Pacientes' : `Mapa ${SECTOR_LABELS[selectedSector]}`;

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
          <title>${getPrintTitle(printTitle)}</title>
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
              margin: 10mm 12mm 15mm 12mm;
            }
            @media print {
              html, body {
                overflow: visible !important;
                height: auto !important;
                background: #ffffff !important;
              }
            }
            .print-page {
              position: relative;
              page-break-after: auto;
              page-break-inside: auto;
            }
            .watermark {
              position: fixed;
              top: 5mm;
              right: 10mm;
              height: ${isCompact ? '30px' : '38px'};
              width: auto;
              opacity: 0.30;
              z-index: 0;
            }
            .sector-section {
              margin-bottom: ${isCompact ? '8px' : '12px'};
              page-break-inside: avoid;
            }
            .sector-header {
              padding: ${isCompact ? '5px 8px' : '6px 10px'};
              border-radius: 4px;
              margin-bottom: ${isCompact ? '5px' : '6px'};
              font-weight: 600;
              font-size: ${isCompact ? '8.5pt' : '9.5pt'};
            }
            .patient-row {
              display: grid;
              grid-template-columns: ${isCompact ? '45px 1fr 55px' : '55px 1fr 70px'};
              gap: 6px;
              padding: ${isCompact ? '3px 6px' : '5px 8px'};
              border-bottom: 1px solid #e5e7eb;
              font-size: ${isCompact ? '7.5pt' : '8.5pt'};
              align-items: start;
            }
            .patient-row:last-child {
              border-bottom: none;
            }
            .bed-badge {
              font-weight: bold;
              padding: 2px 5px;
              border-radius: 3px;
              text-align: center;
              font-size: ${isCompact ? '7.5pt' : '8.5pt'};
            }
            .patient-name {
              font-weight: 600;
            }
            .patient-details {
              color: #6b7280;
              margin-top: 2px;
            }
            .patient-age {
              text-align: right;
              color: #374151;
            }
            .page-footer-content {
              position: fixed;
              bottom: 5mm;
              left: 10mm;
              right: 10mm;
              font-size: ${isCompact ? '6.5pt' : '7.5pt'};
              font-style: italic;
              text-align: center;
              color: #9ca3af;
              padding-top: 6px;
              border-top: 1px solid #f3f4f6;
              background: #ffffff;
            }
            .dev-signature {
              position: fixed;
              bottom: 3mm;
              right: 10mm;
              font-size: 5.5pt;
              font-style: italic;
              color: #9ca3af;
              opacity: 0.4;
            }
            .content-area {
              padding-top: 2mm;
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
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <h2 className="text-sm sm:text-lg font-semibold text-foreground truncate">
            {printTitle} {mode === 'compact' ? '(Compacto)' : '(Detalhado)'}
          </h2>
          
          {/* Sector Selection Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 px-3">
                <span className="text-xs font-medium">{sectorLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px]">
              {(Object.keys(SECTOR_LABELS) as SectorSelection[]).map(key => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setSelectedSector(key)}
                  className={selectedSector === key ? 'bg-accent' : ''}
                >
                  {SECTOR_LABELS[key]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
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
              padding: isCompact ? '10mm 12mm' : '12mm 15mm',
              paddingTop: isCompact ? '12mm' : '15mm',
              position: "relative",
              boxSizing: "border-box",
              backgroundColor: "#ffffff",
              color: "#1f2937",
              fontSize: isCompact ? '8.5pt' : '9.5pt',
              lineHeight: isCompact ? '1.25' : '1.35',
            }}
          >
            {/* Watermark */}
            <img 
              src={whitelabel.logos.networkFull} 
              alt={whitelabel.institution.networkLogoAlt}
              className="watermark"
              style={{ 
                position: 'absolute',
                top: '4mm',
                right: '8mm',
                height: isCompact ? '30px' : '38px',
                width: 'auto',
                opacity: 0.30,
              }}
            />
            
            {/* Header */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              marginBottom: isCompact ? '8px' : '10px', 
              paddingBottom: isCompact ? '6px' : '8px', 
              borderBottom: '2px solid #d1d5db',
              position: 'relative',
              zIndex: 1
            }}>
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
                margin: 0,
                color: '#000000',
                letterSpacing: '0.4px'
              }}>
                {getPrintTitle(printTitle)}
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
              <div><strong>Setor:</strong> {sectorLabel}</div>
            </div>
            
            {/* Sectors */}
            <div className="content-area">
              {sectorsToDisplay.map(({ key, patients }) => {
                const config = SECTOR_PRINT_CONFIG[key];
                if (!config) return null;
                return (
                  <PrintableSectorSection
                    key={key}
                    patients={patients}
                    sectorName={config.name}
                    bgColor={config.bg}
                    borderColor={config.border}
                    textColor={config.text}
                    mode={mode}
                    isUti={key === 'red' || key === 'yellow'}
                    utiColorVariant={config.variant}
                  />
                );
              })}
              {sectorsToDisplay.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '10pt' }}>
                  Nenhum paciente neste setor
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div style={{ 
              fontSize: isCompact ? '6.5pt' : '7.5pt',
              fontStyle: 'italic',
              textAlign: 'center', 
              color: '#9ca3af', 
              marginTop: isCompact ? '12px' : '16px', 
              paddingTop: isCompact ? '8px' : '10px', 
              borderTop: '1px solid #f3f4f6',
              letterSpacing: '0.2px',
              opacity: 0.85
            }}>
              {whitelabel.institution.hospitalName} • Documento gerado automaticamente • {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
            </div>
            
            {/* Developer Signature */}
            <div style={{
              position: 'absolute',
              bottom: '6mm',
              right: '8mm',
              fontSize: '5.5pt',
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
