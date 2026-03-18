import { format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { whitelabel } from "@/config/whitelabel";
import { TrendingUp, TrendingDown, UserPlus, Users, UserCheck, UserX, ArrowRightLeft } from "lucide-react";

const safeFormatDate = (dateValue: string | Date, formatString: string): string => {
  try {
    if (!dateValue) return "N/A";
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : dateValue;
    if (!isValid(date)) return "N/A";
    return format(date, formatString, { locale: ptBR });
  } catch {
    return "N/A";
  }
};

interface KPIData { value: number; previousValue: number; change: number; }
interface MovementData { date: string; admissions: number; discharges: number; deaths: number; transfers: number; }
interface SectorData { sector: string; count: number; color: string; }
interface MovementTypeData { type: string; count: number; color: string; }
interface BedOccupancyData { date: string; occupied: number; available: number; }
interface DestinationData { destination: string; count: number; }

interface PrintableDashboardProps {
  department: string;
  dateRange: { from: Date; to: Date };
  kpis: {
    requests: KPIData;
    activePatients: KPIData;
    discharges: KPIData;
    deaths: KPIData;
    transfers: KPIData;
  };
  movementsOverTime: MovementData[];
  sectorDistribution: SectorData[];
  movementsByType: MovementTypeData[];
  bedOccupancy: BedOccupancyData[];
  requestsByDestination: DestinationData[];
}

export function PrintableDashboard({
  department, dateRange, kpis, movementsOverTime, sectorDistribution, movementsByType, bedOccupancy, requestsByDestination,
}: PrintableDashboardProps) {
  const departmentLabels: Record<string, string> = {
    "urgencia-emergencia-adulto": "Urgência e Emergência Adulto",
    "urgencia-emergencia-pediatrica": "Urgência e Emergência Pediátrica",
    "uti": "UTI",
    "posto-internacao": "Posto Internação",
  };

  const formatPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

  const KPICard = ({ title, value, change, icon: Icon }: { title: string; value: number; change: number; icon: any }) => (
    <div style={{
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      padding: '10px 12px',
      background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ padding: '4px', borderRadius: '4px', backgroundColor: '#eff6ff' }}>
          <Icon style={{ height: '14px', width: '14px', color: '#2563eb' }} />
        </div>
        {change !== 0 && (
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '2px',
            fontSize: '7pt', fontWeight: '700',
            color: change >= 0 ? '#059669' : '#dc2626'
          }}>
            {change >= 0 ? <TrendingUp style={{ height: '10px', width: '10px' }} /> : <TrendingDown style={{ height: '10px', width: '10px' }} />}
            {formatPct(change)}
          </div>
        )}
      </div>
      <div style={{ fontSize: '6.5pt', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>{title}</div>
      <div style={{ fontSize: '18pt', fontWeight: '800', color: '#0f172a' }}>{value}</div>
    </div>
  );

  return (
    <div className="hidden print:block" style={{ 
      backgroundColor: '#ffffff', color: '#000000', padding: '8mm 10mm', minHeight: '100vh',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif"
    }}>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1.5px solid #0f172a' }}>
        <div>
          <h1 style={{ fontSize: '18pt', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '0.5px' }}>Dashboard de Gestão</h1>
          <div style={{ fontSize: '8pt', color: '#475569', lineHeight: '1.6' }}>
            <span style={{ fontWeight: '700' }}>{departmentLabels[department] || department}</span>
            <span style={{ margin: '0 6px', color: '#cbd5e1' }}>|</span>
            {safeFormatDate(dateRange.from, "dd/MM/yyyy")} — {safeFormatDate(dateRange.to, "dd/MM/yyyy")}
            <span style={{ margin: '0 6px', color: '#cbd5e1' }}>|</span>
            Gerado: {safeFormatDate(new Date(), "dd/MM/yyyy HH:mm")}
          </div>
        </div>
        <img src={whitelabel.logos.networkFull} alt={whitelabel.institution.networkLogoAlt} style={{ height: '36px', objectFit: 'contain', opacity: 0.3 }} />
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '12px' }}>
        <KPICard title="Solicitações" value={kpis.requests.value} change={kpis.requests.change} icon={UserPlus} />
        <KPICard title="Pacientes Ativos" value={kpis.activePatients.value} change={kpis.activePatients.change} icon={Users} />
        <KPICard title="Altas" value={kpis.discharges.value} change={kpis.discharges.change} icon={UserCheck} />
        <KPICard title="Óbitos" value={kpis.deaths.value} change={kpis.deaths.change} icon={UserX} />
        <KPICard title="Transferências" value={kpis.transfers.value} change={kpis.transfers.change} icon={ArrowRightLeft} />
      </div>

      {/* Charts 2x2 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        {/* Movements table */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
          <h3 style={{ fontSize: '10pt', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>Movimentações</h3>
          <table style={{ width: '100%', fontSize: '7pt', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '3px 4px', fontWeight: '700', color: '#64748b' }}>Data</th>
                <th style={{ textAlign: 'right', padding: '3px 4px', fontWeight: '700', color: '#2563eb' }}>Adm</th>
                <th style={{ textAlign: 'right', padding: '3px 4px', fontWeight: '700', color: '#059669' }}>Altas</th>
                <th style={{ textAlign: 'right', padding: '3px 4px', fontWeight: '700', color: '#dc2626' }}>Óbitos</th>
                <th style={{ textAlign: 'right', padding: '3px 4px', fontWeight: '700', color: '#d97706' }}>Transf</th>
              </tr>
            </thead>
            <tbody>
              {movementsOverTime.slice(0, 10).map((item, i) => (
                <tr key={i} style={{ borderBottom: '0.5px solid #f1f5f9' }}>
                  <td style={{ padding: '2px 4px' }}>{safeFormatDate(item.date, "dd/MM")}</td>
                  <td style={{ textAlign: 'right', padding: '2px 4px', fontWeight: '600', color: '#2563eb' }}>{item.admissions || 0}</td>
                  <td style={{ textAlign: 'right', padding: '2px 4px', fontWeight: '600', color: '#059669' }}>{item.discharges || 0}</td>
                  <td style={{ textAlign: 'right', padding: '2px 4px', fontWeight: '600', color: '#dc2626' }}>{item.deaths || 0}</td>
                  <td style={{ textAlign: 'right', padding: '2px 4px', fontWeight: '600', color: '#d97706' }}>{item.transfers || 0}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1.5px solid #0f172a', fontWeight: '800' }}>
                <td style={{ padding: '3px 4px' }}>TOTAL</td>
                <td style={{ textAlign: 'right', padding: '3px 4px', color: '#2563eb' }}>{movementsOverTime.reduce((s, i) => s + i.admissions, 0)}</td>
                <td style={{ textAlign: 'right', padding: '3px 4px', color: '#059669' }}>{movementsOverTime.reduce((s, i) => s + i.discharges, 0)}</td>
                <td style={{ textAlign: 'right', padding: '3px 4px', color: '#dc2626' }}>{movementsOverTime.reduce((s, i) => s + i.deaths, 0)}</td>
                <td style={{ textAlign: 'right', padding: '3px 4px', color: '#d97706' }}>{movementsOverTime.reduce((s, i) => s + i.transfers, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Sector distribution */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
          <h3 style={{ fontSize: '10pt', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>Distribuição por Setor</h3>
          {sectorDistribution.map((s, i) => {
            const total = sectorDistribution.reduce((sum, x) => sum + x.count, 0);
            const pct = total > 0 ? ((s.count / total) * 100).toFixed(1) : "0.0";
            return (
              <div key={i} style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '7.5pt' }}>
                  <span style={{ fontWeight: '600' }}>{s.sector}</span>
                  <span style={{ fontWeight: '700' }}>{s.count} ({pct}%)</span>
                </div>
                <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '3px', width: `${pct}%`, backgroundColor: s.color }} />
                </div>
              </div>
            );
          })}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '4px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '8pt' }}>
            <span style={{ fontWeight: '700' }}>Total</span>
            <span style={{ fontWeight: '800', color: '#2563eb' }}>{sectorDistribution.reduce((s, x) => s + x.count, 0)}</span>
          </div>
        </div>

        {/* Movement types */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
          <h3 style={{ fontSize: '10pt', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>Por Tipo</h3>
          {movementsByType.map((m, i) => {
            const total = movementsByType.reduce((s, x) => s + x.count, 0);
            const pct = total > 0 ? ((m.count / total) * 100).toFixed(1) : "0.0";
            return (
              <div key={i} style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '7.5pt' }}>
                  <span style={{ fontWeight: '600' }}>{m.type}</span>
                  <span style={{ fontWeight: '700' }}>{m.count} ({pct}%)</span>
                </div>
                <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '3px', width: `${pct}%`, backgroundColor: m.color }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bed occupancy */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
          <h3 style={{ fontSize: '10pt', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>Ocupação de Leitos</h3>
          {bedOccupancy.slice(0, 10).map((item, i) => {
            const total = (item.occupied || 0) + (item.available || 0);
            const rate = total > 0 ? (((item.occupied || 0) / total) * 100).toFixed(1) : "0.0";
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <span style={{ fontSize: '7pt', fontWeight: '600', width: '32px', color: '#64748b' }}>{safeFormatDate(item.date, "dd/MM")}</span>
                <div style={{ flex: 1, height: '12px', backgroundColor: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ height: '100%', backgroundColor: '#2563eb', borderRadius: '6px', width: `${rate}%` }} />
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6pt', fontWeight: '700', color: '#334155' }}>
                    {item.occupied || 0}/{total} ({rate}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transfers by destination */}
      {requestsByDestination.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
          <h3 style={{ fontSize: '10pt', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>Transferências por Destino</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            {requestsByDestination.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: '#f8fafc', borderRadius: '4px', border: '0.5px solid #e2e8f0', fontSize: '7.5pt' }}>
                <span style={{ fontWeight: '500' }}>{d.destination}</span>
                <span style={{ fontWeight: '800', color: '#2563eb' }}>{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '10px', paddingTop: '6px', borderTop: '0.5px solid #e2e8f0', textAlign: 'center', fontSize: '6pt', color: '#94a3b8' }}>
        {whitelabel.platform.fullName} • Dashboard de Gestão • Documento gerado automaticamente
      </div>
      <div style={{ position: 'fixed', bottom: '5mm', right: '8mm', fontSize: '5pt', color: '#cbd5e1', opacity: 0.5 }}>
        {whitelabel.credits.authorSignature}
      </div>
    </div>
  );
}
