import { format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { whitelabel } from "@/config/whitelabel";
import { TrendingUp, TrendingDown, UserPlus, Users, UserCheck, UserX, ArrowRightLeft, Bed } from "lucide-react";

// Helper function to safely format dates
const safeFormatDate = (dateValue: string | Date, formatString: string): string => {
  try {
    if (!dateValue) return "N/A";
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : dateValue;
    if (!isValid(date)) return "N/A";
    return format(date, formatString, { locale: ptBR });
  } catch (error) {
    return "N/A";
  }
};

interface KPIData {
  value: number;
  previousValue: number;
  change: number;
}

interface MovementData {
  date: string;
  admissions: number;
  discharges: number;
  deaths: number;
  transfers: number;
}

interface SectorData {
  sector: string;
  count: number;
  color: string;
}

interface MovementTypeData {
  type: string;
  count: number;
  color: string;
}

interface BedOccupancyData {
  date: string;
  occupied: number;
  available: number;
}

interface DestinationData {
  destination: string;
  count: number;
}

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
  department,
  dateRange,
  kpis,
  movementsOverTime,
  sectorDistribution,
  movementsByType,
  bedOccupancy,
  requestsByDestination,
}: PrintableDashboardProps) {
  const departmentLabels: Record<string, string> = {
    "urgencia-emergencia-adulto": "Urgência e Emergência Adulto",
    "urgencia-emergencia-pediatrica": "Urgência e Emergência Pediátrica",
    "uti": "UTI",
    "posto-internacao": "Posto Internação",
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  const KPICard = ({ 
    title, 
    value, 
    change, 
    icon: Icon 
  }: { 
    title: string; 
    value: number; 
    change: number; 
    icon: any;
  }) => (
    <div className="border-2 border-primary/20 rounded-lg p-4 bg-gradient-to-br from-background to-muted/30">
      <div className="flex items-center justify-between mb-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        {change !== 0 && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${
            change >= 0 ? "text-emerald-600" : "text-rose-600"
          }`}>
            {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {formatPercentage(change)}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium uppercase">{title}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="hidden print:block bg-white text-black p-8 min-h-screen">
      <style>
        {`
          @media print {
            @page {
              size: A4 landscape;
              margin: 1cm;
            }
            html, body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            /* Mobile Safari specific fixes */
            @supports (-webkit-touch-callout: none) {
              * {
                -webkit-print-color-adjust: exact !important;
              }
            }
          }
        `}
      </style>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-primary/30">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-primary mb-2">Dashboard de Gestão</h1>
          <div className="space-y-1 text-sm text-gray-700">
            <p className="font-semibold text-base">{departmentLabels[department] || department}</p>
            <p>
              <span className="font-medium">Período:</span>{" "}
              {safeFormatDate(dateRange.from, "dd/MM/yyyy")} até{" "}
              {safeFormatDate(dateRange.to, "dd/MM/yyyy")}
            </p>
            <p>
              <span className="font-medium">Gerado em:</span>{" "}
              {safeFormatDate(new Date(), "dd/MM/yyyy 'às' HH:mm")}
            </p>
          </div>
        </div>
        <img src={whitelabel.logos.networkFull} alt={whitelabel.institution.networkLogoAlt} className="h-16 object-contain" />
      </div>

      {/* KPIs Grid */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-primary mb-4">Indicadores Principais</h2>
        <div className="grid grid-cols-5 gap-4">
          <KPICard
            title="Solicitações"
            value={kpis.requests.value}
            change={kpis.requests.change}
            icon={UserPlus}
          />
          <KPICard
            title="Pacientes Ativos"
            value={kpis.activePatients.value}
            change={kpis.activePatients.change}
            icon={Users}
          />
          <KPICard
            title="Altas"
            value={kpis.discharges.value}
            change={kpis.discharges.change}
            icon={UserCheck}
          />
          <KPICard
            title="Óbitos"
            value={kpis.deaths.value}
            change={kpis.deaths.change}
            icon={UserX}
          />
          <KPICard
            title="Transferências"
            value={kpis.transfers.value}
            change={kpis.transfers.change}
            icon={ArrowRightLeft}
          />
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Movements Over Time */}
        <div className="border-2 border-primary/20 rounded-lg p-4">
          <h3 className="text-lg font-bold text-primary mb-3">Movimentações ao Longo do Tempo</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-primary/20">
                  <th className="text-left py-2 font-semibold">Data</th>
                  <th className="text-right py-2 font-semibold">Admissões</th>
                  <th className="text-right py-2 font-semibold">Altas</th>
                  <th className="text-right py-2 font-semibold">Óbitos</th>
                  <th className="text-right py-2 font-semibold">Transferências</th>
                </tr>
              </thead>
              <tbody>
                {movementsOverTime.slice(0, 8).map((item, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-2">{safeFormatDate(item.date, "dd/MM")}</td>
                    <td className="text-right py-2 font-medium text-blue-600">{item.admissions || 0}</td>
                    <td className="text-right py-2 font-medium text-emerald-600">{item.discharges || 0}</td>
                    <td className="text-right py-2 font-medium text-rose-600">{item.deaths || 0}</td>
                    <td className="text-right py-2 font-medium text-amber-600">{item.transfers || 0}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-primary/30 font-bold">
                  <td className="py-2">TOTAL</td>
                  <td className="text-right py-2 text-blue-600">
                    {movementsOverTime.reduce((sum, item) => sum + item.admissions, 0)}
                  </td>
                  <td className="text-right py-2 text-emerald-600">
                    {movementsOverTime.reduce((sum, item) => sum + item.discharges, 0)}
                  </td>
                  <td className="text-right py-2 text-rose-600">
                    {movementsOverTime.reduce((sum, item) => sum + item.deaths, 0)}
                  </td>
                  <td className="text-right py-2 text-amber-600">
                    {movementsOverTime.reduce((sum, item) => sum + item.transfers, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Sector Distribution */}
        <div className="border-2 border-primary/20 rounded-lg p-4">
          <h3 className="text-lg font-bold text-primary mb-3">Distribuição por Setor</h3>
          <div className="space-y-3">
            {sectorDistribution.map((sector, index) => {
              const total = sectorDistribution.reduce((sum, s) => sum + s.count, 0);
              const percentage = total > 0 ? ((sector.count / total) * 100).toFixed(1) : "0.0";
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{sector.sector}</span>
                    <span className="text-sm font-bold">
                      {sector.count} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: sector.color 
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t-2 border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Total de Pacientes</span>
                <span className="text-lg font-bold text-primary">
                  {sectorDistribution.reduce((sum, s) => sum + s.count, 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Movements by Type */}
        <div className="border-2 border-primary/20 rounded-lg p-4">
          <h3 className="text-lg font-bold text-primary mb-3">Movimentações por Tipo</h3>
          <div className="space-y-3">
            {movementsByType.map((movement, index) => {
              const total = movementsByType.reduce((sum, m) => sum + m.count, 0);
              const percentage = total > 0 ? ((movement.count / total) * 100).toFixed(1) : "0.0";
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{movement.type}</span>
                    <span className="text-sm font-bold">
                      {movement.count} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: movement.color 
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bed Occupancy */}
        <div className="border-2 border-primary/20 rounded-lg p-4">
          <h3 className="text-lg font-bold text-primary mb-3">Ocupação de Leitos</h3>
          <div className="space-y-2">
            {bedOccupancy.slice(0, 8).map((item, index) => {
              const total = (item.occupied || 0) + (item.available || 0);
              const occupancyRate = total > 0 ? (((item.occupied || 0) / total) * 100).toFixed(1) : "0.0";
              return (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-16">
                    {safeFormatDate(item.date, "dd/MM")}
                  </span>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-200 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${occupancyRate}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                        {item.occupied || 0}/{total} ({occupancyRate}%)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transfers by Destination */}
      {requestsByDestination.length > 0 && (
        <div className="border-2 border-primary/20 rounded-lg p-4">
          <h3 className="text-lg font-bold text-primary mb-3">Transferências por Destino</h3>
          <div className="grid grid-cols-2 gap-4">
            {requestsByDestination.map((dest, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-primary/10">
                <span className="text-sm font-medium">{dest.destination}</span>
                <span className="text-lg font-bold text-primary">{dest.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-300 text-center">
        <p className="text-xs text-gray-600">
          Documento gerado automaticamente pelo sistema {whitelabel.platform.fullName} - Dashboard de Gestão
        </p>
      </div>
      
      {/* Developer Signature - Fixed Bottom Right */}
      <div className="fixed bottom-8 right-10 text-[10px] text-gray-400 italic opacity-40 z-[1000]">
        {whitelabel.credits.authorSignature}
      </div>
    </div>
  );
}
