import { Patient } from "@/types/patient";
import { Button } from "@/components/ui/button";
import { X, Printer } from "lucide-react";
import { format } from "date-fns";
import { useRef } from "react";

// Import logos from whitelabel config
import { whitelabel } from "@/config/whitelabel";
import { sectorLabelFromCode } from "@/lib/hospitalSectors";
import { DocumentHeader } from "@/components/DocumentHeader";
import { useHeaderPatient } from "@/hooks/useHeaderPatient";
import { asUuidOrNull } from "@/lib/utils";

interface PrintableDietDocumentProps {
  patient: Patient;
  dietRoute: "oral" | "enteral";
  dietType: string;
  restrictions: string[];
  birthDate: string;
  doctorName: string;
  crm: string;
  onClose: () => void;
}
export function PrintableDietDocument({
  patient,
  dietRoute,
  dietType,
  restrictions,
  birthDate,
  doctorName,
  crm,
  onClose,
}: PrintableDietDocumentProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const currentDate = new Date();
  const sectorLabel = sectorLabelFromCode(patient.sector);
  // Cabecalho padronizado (modelo assistencial): alergias importam para a dieta.
  const headerPatient = useHeaderPatient(asUuidOrNull(patient.id), {
    name: patient.name,
    bed: patient.bedNumber,
    sector: sectorLabel,
    birthDate: birthDate,
    age: patient.age != null ? String(patient.age) : "",
  });

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para imprimir o documento.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Autorização de Dieta - ${patient.name}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Helvetica Neue', 'Segoe UI', Inter, Arial, sans-serif;
              background: white;
              color: black;
              padding: 12mm 15mm;
            }
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 16px;
              padding-bottom: 12px;
              border-bottom: 2px solid #1e40af;
            }
            .header img.logo-left {
              height: 70px;
              width: auto;
              object-fit: contain;
            }
            .header img.logo-right {
              height: 55px;
              width: auto;
              object-fit: contain;
            }
            .title-section {
              text-align: center;
              margin-bottom: 24px;
            }
            .header-title {
              font-size: 24px;
              font-weight: bold;
              color: #1e3a5f;
              letter-spacing: 2px;
              text-transform: uppercase;
              margin: 0;
            }
            .header-subtitle {
              font-size: 14px;
              color: #64748b;
              margin-top: 6px;
            }
            .patient-card {
              margin-bottom: 24px;
              padding: 16px;
              background-color: #f8fafc;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
            }
            .patient-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
            }
            .field-label {
              font-size: 10px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              display: block;
            }
            .field-value {
              font-size: 16px;
              font-weight: 600;
              color: #1e293b;
              margin-top: 4px;
            }
            .field-value-small {
              font-size: 14px;
              font-weight: 500;
              color: #1e293b;
              margin-top: 4px;
            }
            .diet-section {
              margin-bottom: 24px;
            }
            .diet-title {
              font-size: 16px;
              font-weight: bold;
              color: #1e3a5f;
              margin-bottom: 16px;
              padding-bottom: 8px;
              border-bottom: 1px solid #cbd5e1;
            }
            .diet-row {
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 12px;
              padding-left: 8px;
            }
            .diet-label {
              font-weight: 600;
              color: #475569;
              min-width: 100px;
              font-size: 14px;
            }
            .badge-blue {
              background-color: #dbeafe;
              color: #1e40af;
              padding: 6px 16px;
              border-radius: 6px;
              font-weight: 600;
              font-size: 14px;
              text-transform: uppercase;
            }
            .badge-green {
              background-color: #dcfce7;
              color: #166534;
              padding: 6px 16px;
              border-radius: 6px;
              font-weight: 600;
              font-size: 14px;
              text-transform: uppercase;
            }
            .badge-yellow {
              background-color: #fef3c7;
              color: #92400e;
              padding: 6px 12px;
              border-radius: 6px;
              font-size: 13px;
              font-weight: 500;
              border: 1px solid #fcd34d;
              margin: 4px;
            }
            .restrictions-row {
              display: flex;
              align-items: flex-start;
              gap: 12px;
              margin-bottom: 12px;
              padding-left: 8px;
            }
            .restrictions-badges {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
            }
            .observations {
              margin-bottom: 32px;
            }
            .observations-title {
              font-size: 13px;
              font-weight: 600;
              color: #475569;
              margin-bottom: 8px;
            }
            .observations-box {
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 16px;
              min-height: 70px;
              background-color: #fafafa;
            }
            .observations-placeholder {
              color: #94a3b8;
              font-size: 12px;
              font-style: italic;
            }
            .signature-section {
              margin-top: 40px;
              padding-top: 20px;
              display: flex;
              justify-content: center;
            }
            .signature-container {
              text-align: center;
            }
            .signature-line {
              width: 280px;
              border-top: 2px solid #1e293b;
              padding-top: 8px;
              margin-bottom: 4px;
            }
            .signature-name {
              font-weight: 500;
              color: #1e293b;
              font-size: 14px;
            }
            .signature-role {
              font-size: 12px;
              color: #64748b;
              margin-top: 4px;
            }
            .signature-crm {
              font-size: 12px;
              color: #475569;
              font-weight: 600;
              margin-top: 2px;
            }
            .footer {
              position: fixed;
              bottom: 12mm;
              left: 15mm;
              right: 15mm;
              text-align: center;
              border-top: 1px solid #e2e8f0;
              padding-top: 12px;
            }
            .footer-hospital {
              font-size: 11px;
              color: #64748b;
            }
            .footer-address {
              font-size: 10px;
              color: #94a3b8;
              margin-top: 4px;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    
    // Wait for images to load before printing
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-100 dark:bg-slate-900 overflow-auto">
      {/* Screen Controls */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
          Visualização - Autorização de Dieta
        </h2>
        <div className="flex gap-2">
          <Button onClick={handlePrint} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          <Button variant="outline" onClick={onClose} className="gap-2">
            <X className="h-4 w-4" />
            Fechar
          </Button>
        </div>
      </div>

      {/* Document Preview */}
      <div className="flex justify-center py-8 px-4">
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          <div 
            ref={printRef}
            className="bg-white text-black"
            style={{ 
              width: '210mm',
              minHeight: '297mm',
              padding: '12mm 15mm',
              fontFamily: "'Helvetica Neue', 'Segoe UI', Inter, Arial, sans-serif",
              position: 'relative'
            }}
          >
            {/* Cabeçalho padronizado: timbrado + faixa + identificação do paciente */}
            <DocumentHeader
              model="assistencial"
              title="Autorização de dieta"
              complement="Serviço de Nutrição e Dietética"
              emission={format(currentDate, "dd/MM/yyyy HH:mm:ss")}
              width="100%"
              patient={headerPatient}
            />
            <div style={{ height: '16px' }} />

            {/* Diet Section */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e3a5f', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #cbd5e1' }}>
                LIBERADA DIETA:
              </h2>
              
              <div style={{ paddingLeft: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontWeight: '600', color: '#475569', minWidth: '100px', fontSize: '14px' }}>Via:</span>
                  <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '6px 16px', borderRadius: '6px', fontWeight: '600', fontSize: '14px', textTransform: 'uppercase' }}>
                    {dietRoute === "oral" ? "Oral" : "Enteral"}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontWeight: '600', color: '#475569', minWidth: '100px', fontSize: '14px' }}>Tipo:</span>
                  <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '6px 16px', borderRadius: '6px', fontWeight: '600', fontSize: '14px', textTransform: 'uppercase' }}>
                    {dietType || "Não especificado"}
                  </span>
                </div>
                
                {restrictions.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ fontWeight: '600', color: '#475569', minWidth: '100px', fontSize: '14px', paddingTop: '6px' }}>Restrições:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {restrictions.map((restriction, index) => (
                        <span key={index} style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '500', border: '1px solid #fcd34d' }}>
                          {restriction}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Observations */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>Observações da Nutrição:</h3>
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', minHeight: '70px', backgroundColor: '#fafafa' }}>
                <p style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic', margin: 0 }}>Espaço reservado para anotações</p>
              </div>
            </div>

            {/* Signature */}
            <div style={{ marginTop: '40px', paddingTop: '20px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '280px', borderTop: '2px solid #1e293b', paddingTop: '8px', marginBottom: '4px' }}>
                  <p style={{ fontWeight: '500', color: '#1e293b', margin: 0, fontSize: '14px' }}>{doctorName || ""}</p>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Médico(a) Responsável</p>
                {crm && <p style={{ fontSize: '12px', color: '#475569', fontWeight: '600', margin: '2px 0 0 0' }}>{crm}</p>}
              </div>
            </div>

            {/* Footer */}
            <div style={{ position: 'absolute', bottom: '12mm', left: '0', right: '0', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginLeft: '15mm', marginRight: '15mm' }}>
              <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{whitelabel.institution.hospitalName} - Rede {whitelabel.institution.networkName}</p>
              <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>{whitelabel.print.systemLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
