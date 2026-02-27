import { Patient } from "@/types/patient";
import { PrintablePatientCard } from "./PrintablePatientCard";
import { PrintableUtiPatientCard } from "./PrintableUtiPatientCard";

interface PrintableSectorSectionProps {
  patients: Patient[];
  sectorName: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  mode: 'compact' | 'detailed';
  isUti?: boolean;
  utiColorVariant?: 'blue' | 'yellow';
}

export function PrintableSectorSection({
  patients,
  sectorName,
  bgColor,
  borderColor,
  textColor,
  mode,
  isUti = false,
  utiColorVariant = 'blue'
}: PrintableSectorSectionProps) {
  if (patients.length === 0) return null;
  
  const isCompact = mode === 'compact';
  
  return (
    <div 
      style={{ 
        marginBottom: isCompact ? '12px' : '16px'
      }}
    >
      <div 
        style={{ 
          backgroundColor: bgColor,
          borderLeft: `6px solid ${borderColor}`,
          padding: isCompact ? '8px 12px' : '10px 14px',
          marginBottom: isCompact ? '8px' : '12px',
          pageBreakAfter: 'avoid',
          breakAfter: 'avoid',
          borderRadius: '4px'
        }}
      >
        <h2 style={{ 
          fontSize: isCompact ? '12pt' : '13pt', 
          fontWeight: 'bold', 
          textTransform: 'uppercase',
          color: textColor,
          margin: 0,
          letterSpacing: '0.5px'
        }}>
          {sectorName} ({patients.length} {patients.length === 1 ? 'PACIENTE' : 'PACIENTES'})
        </h2>
      </div>
      <div>
        {patients.map(patient => (
          isUti ? (
            <PrintableUtiPatientCard 
              key={patient.id} 
              patient={patient} 
              mode={mode}
              colorVariant={utiColorVariant}
            />
          ) : (
            <PrintablePatientCard 
              key={patient.id} 
              patient={patient} 
              mode={mode}
              bedColor={borderColor}
            />
          )
        ))}
      </div>
    </div>
  );
}
