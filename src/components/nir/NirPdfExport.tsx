import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useHospital } from "@/contexts/HospitalContext";
import type { NirMetrics } from "@/hooks/useNirMetrics";
import type { DischargePrediction } from "@/hooks/useDischargePredictions";

interface Props {
  metrics: NirMetrics;
  predictions?: DischargePrediction[];
}

const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

export function NirPdfExport({ metrics, predictions = [] }: Props) {
  const { currentHospital } = useHospital();

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=1024,height=768");
    if (!printWindow) return;

    const today = new Date().toLocaleString("pt-BR");
    const hospital = currentHospital?.name || "Unidade Hospitalar";

    const sectorRows = metrics.occupancyBySector
      .map((s) => `<tr><td>${s.sector}</td><td style="text-align:center">${s.occupied}/${s.total}</td><td style="text-align:right;font-weight:bold;color:${s.rate >= 95 ? "#dc2626" : s.rate >= 80 ? "#d97706" : "#059669"}">${s.rate}%</td></tr>`)
      .join("");

    const next72 = predictions.filter((p) => p.bucket === "today" || p.bucket === "tomorrow" || p.bucket === "48_72h");
    const dischargeRows = next72
      .map((p) => `<tr><td>${p.name}</td><td>${p.sector || "—"}</td><td style="text-align:center">${p.bed_number || "—"}</td><td>${p.uti_discharge_prediction || ""}</td></tr>`)
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Relatório NIR — ${hospital}</title>
    <style>
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; }
      h1 { font-size: 16pt; margin: 0 0 4px; }
      h2 { font-size: 11pt; margin: 16px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e1; color: #1e293b; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; }
      .meta { font-size: 9pt; color: #475569; text-align: right; }
      .kpi-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px; }
      .kpi { border:1px solid #e2e8f0; padding:6px 8px; border-radius:4px; }
      .kpi .label { font-size: 7.5pt; text-transform: uppercase; letter-spacing:.5px; color:#64748b; }
      .kpi .value { font-size: 14pt; font-weight: 700; }
      .kpi .sub { font-size: 7.5pt; color:#64748b; }
      table { width:100%; border-collapse: collapse; font-size: 9pt; }
      th, td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; text-align:left; }
      th { background:#f1f5f9; font-weight:600; font-size: 8pt; text-transform: uppercase; letter-spacing:.4px; }
      .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #cbd5e1; font-size: 8pt; color:#64748b; text-align:center; }
      .alerts { display:grid; grid-template-columns: repeat(4,1fr); gap:6px; margin-top: 6px; }
      .alert { border-left: 3px solid; padding:4px 6px; font-size: 8.5pt; }
      .alert.red { border-color:#dc2626; background:#fef2f2; }
      .alert.amber { border-color:#d97706; background:#fffbeb; }
      .alert.purple { border-color:#9333ea; background:#faf5ff; }
      .alert.orange { border-color:#ea580c; background:#fff7ed; }
      .alert b { display:block; font-size: 12pt; }
    </style></head><body>
      <div class="header">
        <div>
          <h1>Relatório Operacional NIR</h1>
          <div style="font-size:9pt;color:#475569">${hospital}</div>
        </div>
        <div class="meta">
          <div><b>Emitido em:</b> ${today}</div>
          <div>Núcleo Interno de Regulação</div>
        </div>
      </div>

      <h2>Indicadores principais</h2>
      <div class="kpi-grid">
        <div class="kpi"><div class="label">Ocupação geral</div><div class="value">${metrics.occupancyRate}%</div><div class="sub">${metrics.occupied}/${metrics.total} leitos</div></div>
        <div class="kpi"><div class="label">Vagas livres</div><div class="value">${metrics.vacant}</div><div class="sub">UTI ${metrics.vacantByType.uti} · Enf ${metrics.vacantByType.enfermaria} · Emer ${metrics.vacantByType.emergencia}</div></div>
        <div class="kpi"><div class="label">Bloqueados</div><div class="value">${metrics.blocked}</div><div class="sub">média ${metrics.blockedAvgHours}h</div></div>
        <div class="kpi"><div class="label">Higienização</div><div class="value">${metrics.cleaning}</div><div class="sub">${metrics.longCleaning.length} >4h</div></div>
        <div class="kpi"><div class="label">Solicitações pendentes</div><div class="value">${metrics.pending + metrics.inAnalysis}</div><div class="sub">total ${metrics.totalRequests}</div></div>
        <div class="kpi"><div class="label">Aprovação</div><div class="value">${metrics.approvalRate}%</div><div class="sub">${fmt(metrics.approved + metrics.completed)} aprovadas</div></div>
        <div class="kpi"><div class="label">Tempo médio resposta</div><div class="value">${metrics.avgResponseMin}min</div><div class="sub">criação → aprovação</div></div>
        <div class="kpi"><div class="label">Altas administrativas</div><div class="value">${metrics.dischargeReady}</div><div class="sub">prontas p/ liberar</div></div>
      </div>

      <h2>Alertas críticos</h2>
      <div class="alerts">
        <div class="alert red"><b>${metrics.stuck24h.length}</b>Aguardando vaga +24h</div>
        <div class="alert red"><b>${metrics.stuck48hUti.length}</b>UTI aguardando +48h</div>
        <div class="alert orange"><b>${metrics.longCleaning.length}</b>Higienização +4h</div>
        <div class="alert purple"><b>${metrics.sisregStuck.length}</b>SISREG sem resposta +12h</div>
      </div>

      <h2>Ocupação por setor</h2>
      <table><thead><tr><th>Setor</th><th style="text-align:center">Ocupados/Total</th><th style="text-align:right">Taxa</th></tr></thead><tbody>${sectorRows || '<tr><td colspan="3" style="text-align:center;color:#64748b">Sem dados</td></tr>'}</tbody></table>

      <h2>Previsão de altas — próximas 72h (${next72.length})</h2>
      <table><thead><tr><th>Paciente</th><th>Setor</th><th style="text-align:center">Leito</th><th>Previsão</th></tr></thead><tbody>${dischargeRows || '<tr><td colspan="4" style="text-align:center;color:#64748b">Nenhuma previsão registrada</td></tr>'}</tbody></table>

      <div class="footer">
        Documento gerado automaticamente · Arsen — Plataforma Clínica · ${hospital}
      </div>
      <script>window.onload=()=>{setTimeout(()=>window.print(),250);};</script>
    </body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePrint} className="h-7 gap-1.5">
      <Printer className="h-3.5 w-3.5" />
      Exportar PDF
    </Button>
  );
}
