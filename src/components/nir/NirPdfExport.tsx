import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useHospital } from "@/contexts/HospitalContext";
import { buildNormaZeroDocument, openPrintWindow, prepareLogo } from "@/lib/printNormaZero";
import type { NirMetrics } from "@/hooks/useNirMetrics";
import type { DischargePrediction } from "@/hooks/useDischargePredictions";

interface Props {
  metrics: NirMetrics;
  predictions?: DischargePrediction[];
}

const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

export function NirPdfExport({ metrics, predictions = [] }: Props) {
  const { currentHospital } = useHospital();

  const handlePrint = async () => {
    const logoData = await prepareLogo();

    const sectorRows = metrics.occupancyBySector
      .map(
        (s) =>
          `<tr><td style="text-transform:capitalize">${s.sector}</td><td class="nz-c">${s.occupied}/${s.total}</td><td class="nz-r" style="font-weight:700;color:${
            s.rate >= 95 ? "#dc2626" : s.rate >= 80 ? "#d97706" : "#059669"
          }">${s.rate}%</td><td class="nz-r"><div class="bar"><div style="width:${s.rate}%;background:${
            s.rate >= 95 ? "#dc2626" : s.rate >= 80 ? "#d97706" : "#059669"
          }"></div></div></td></tr>`,
      )
      .join("");

    const next72 = predictions.filter((p) => p.bucket === "today" || p.bucket === "tomorrow" || p.bucket === "48_72h");
    const dischargeRows = next72
      .map(
        (p) =>
          `<tr><td style="font-weight:600">${p.name}</td><td style="text-transform:capitalize">${p.sector || "—"}</td><td class="nz-c">${
            p.bed_number || "—"
          }</td><td>${p.uti_discharge_prediction || ""}</td><td class="nz-c"><span class="pill pill-${p.bucket}">${
            { today: "Hoje", tomorrow: "Amanhã", "48_72h": "48–72h", week: "Semana", later: "Futuro", unparsed: "—" }[p.bucket]
          }</span></td></tr>`,
      )
      .join("");

    const bodyHtml = `
      <h2 class="nz-section">1. Indicadores Principais</h2>
      <div class="kpi-grid">
        <div class="kpi ${metrics.occupancyRate >= 95 ? "danger" : metrics.occupancyRate >= 80 ? "warn" : "success"}"><div class="label">Ocupação geral</div><div class="value">${metrics.occupancyRate}%</div><div class="sub">${metrics.occupied}/${metrics.total} leitos</div></div>
        <div class="kpi success"><div class="label">Vagas livres</div><div class="value">${metrics.vacant}</div><div class="sub">UTI ${metrics.vacantByType.uti} · Enf ${metrics.vacantByType.enfermaria} · Emer ${metrics.vacantByType.emergencia}</div></div>
        <div class="kpi ${metrics.blocked > 0 ? "warn" : ""}"><div class="label">Bloqueados</div><div class="value">${metrics.blocked}</div><div class="sub">média ${metrics.blockedAvgHours}h</div></div>
        <div class="kpi"><div class="label">Higienização</div><div class="value">${metrics.cleaning}</div><div class="sub">${metrics.longCleaning.length} acima de 4h</div></div>
        <div class="kpi ${metrics.pending + metrics.inAnalysis > 0 ? "warn" : ""}"><div class="label">Pendentes</div><div class="value">${metrics.pending + metrics.inAnalysis}</div><div class="sub">${metrics.totalRequests} solicitações totais</div></div>
        <div class="kpi success"><div class="label">Taxa aprovação</div><div class="value">${metrics.approvalRate}%</div><div class="sub">${fmt(metrics.approved + metrics.completed)} aprovadas</div></div>
        <div class="kpi"><div class="label">Tempo médio</div><div class="value">${metrics.avgResponseMin}<span style="font-size:9pt">min</span></div><div class="sub">criação → aprovação</div></div>
        <div class="kpi"><div class="label">Altas administrativas</div><div class="value">${metrics.dischargeReady}</div><div class="sub">prontas para liberar</div></div>
      </div>

      <h2 class="nz-section">2. Alertas Críticos</h2>
      <div class="alerts">
        <div class="alert red"><b>${metrics.stuck24h.length}</b>Aguardando vaga +24h</div>
        <div class="alert red"><b>${metrics.stuck48hUti.length}</b>UTI aguardando +48h</div>
        <div class="alert orange"><b>${metrics.longCleaning.length}</b>Higienização +4h</div>
        <div class="alert purple"><b>${metrics.sisregStuck.length}</b>SISREG sem resposta +12h</div>
      </div>

      <h2 class="nz-section">3. Ocupação por Setor</h2>
      <table class="nz"><thead><tr><th>Setor</th><th class="nz-c">Ocupados/Total</th><th class="nz-r">Taxa</th><th class="nz-r" style="width:30%">Distribuição</th></tr></thead><tbody>${
        sectorRows || '<tr><td colspan="4" class="nz-empty">Nenhum setor com dados de ocupação</td></tr>'
      }</tbody></table>

      <h2 class="nz-section">4. Previsão de Altas — Próximas 72h (${next72.length})</h2>
      <table class="nz"><thead><tr><th>Paciente</th><th>Setor</th><th class="nz-c">Leito</th><th>Previsão</th><th class="nz-c">Janela</th></tr></thead><tbody>${
        dischargeRows || '<tr><td colspan="5" class="nz-empty">Nenhuma previsão de alta registrada nas próximas 72h</td></tr>'
      }</tbody></table>
    `;

    const extraStyles = `
      .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4pt; margin-top: 4pt; }
      .kpi { border: 1px solid #e2e8f0; border-left: 3pt solid #0054A6; padding: 4pt 6pt; border-radius: 2pt; background: #fafbfc; }
      .kpi.warn { border-left-color: #d97706; }
      .kpi.danger { border-left-color: #dc2626; }
      .kpi.success { border-left-color: #059669; }
      .kpi .label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.4pt; color: #64748b; font-weight: 600; }
      .kpi .value { font-size: 15pt; font-weight: 700; color: #0a1628; line-height: 1.1; margin-top: 1pt; }
      .kpi .sub { font-size: 7pt; color: #64748b; margin-top: 1pt; }
      .alerts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4pt; }
      .alert { border-left: 3pt solid; padding: 4pt 6pt; font-size: 8pt; border-radius: 2pt; }
      .alert b { display: block; font-size: 13pt; font-weight: 700; line-height: 1; margin-bottom: 1pt; }
      .alert.red { border-color: #dc2626; background: #fef2f2; color: #7f1d1d; }
      .alert.amber { border-color: #d97706; background: #fffbeb; color: #78350f; }
      .alert.purple { border-color: #9333ea; background: #faf5ff; color: #581c87; }
      .alert.orange { border-color: #ea580c; background: #fff7ed; color: #7c2d12; }
      .bar { width: 100%; height: 4pt; background: #e2e8f0; border-radius: 2pt; overflow: hidden; }
      .bar > div { height: 100%; border-radius: 2pt; }
      .pill { display: inline-block; font-size: 7pt; padding: 1pt 5pt; border-radius: 8pt; font-weight: 600; }
      .pill-today { background: #d1fae5; color: #065f46; }
      .pill-tomorrow { background: #cffafe; color: #155e75; }
      .pill-48_72h { background: #dbeafe; color: #1e40af; }
    `;

    const html = buildNormaZeroDocument({
      title: "Relatório Operacional — NIR",
      subtitle: "Indicadores em tempo real",
      sectorLabel: "Núcleo Interno de Regulação (NIR)",
      hospitalName: currentHospital?.name,
      docCodePrefix: "NIR",
      bodyHtml,
      signatures: [
        { label: "Coordenação NIR" },
        { label: "Direção Técnica" },
      ],
      logoDataUrl: logoData,
      extraStyles,
    });

    openPrintWindow(html, "Preparando relatório NIR…");
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePrint}
      className="h-9 gap-1.5 bg-white/95 text-foreground border-border hover:bg-white hover:text-foreground dark:bg-background dark:text-foreground"
    >
      <Printer className="h-3.5 w-3.5" />
      Exportar PDF
    </Button>
  );
}
