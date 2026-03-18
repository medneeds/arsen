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
    <div style={{ marginBottom: isCompact ? '6px' : '10px' }}>
      {/* Sector header — slim pill style */}
      <div 
        style={{ 
          backgroundColor: bgColor,
          borderLeft: `4px solid ${borderColor}`,
          padding: isCompact ? '4px 10px' : '6px 12px',
          marginBottom: isCompact ? '4px' : '6px',
          pageBreakAfter: 'avoid',
          breakAfter: 'avoid',
          borderRadius: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <h2 style={{ 
          fontSize: isCompact ? '9pt' : '10pt', 
          fontWeight: '700', 
          textTransform: 'uppercase',
          color: textColor,
          margin: 0,
          letterSpacing: '0.6px'
        }}>
          {sectorName}
        </h2>
        <span style={{
          fontSize: isCompact ? '7pt' : '7.5pt',
          fontWeight: '600',
          color: textColor,
          opacity: 0.7
        }}>
          {patients.length} {patients.length === 1 ? 'paciente' : 'pacientes'}
        </span>
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
