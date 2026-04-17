import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useHospital } from "@/contexts/HospitalContext";
import { whitelabel } from "@/config/whitelabel";
import socorraoLogo from "@/assets/socorrao-cross-logo.png";
import type { NirMetrics } from "@/hooks/useNirMetrics";
import type { DischargePrediction } from "@/hooks/useDischargePredictions";

interface Props {
  metrics: NirMetrics;
  predictions?: DischargePrediction[];
}

const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

// Convert image asset to base64 so the popup window can render it offline
const imageToDataUrl = async (src: string): Promise<string> => {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
};

export function NirPdfExport({ metrics, predictions = [] }: Props) {
  const { currentHospital } = useHospital();

  const handlePrint = async () => {
    const printWindow = window.open("", "_blank", "width=1024,height=768");
    if (!printWindow) return;

    // Loading splash while we prepare the assets
    printWindow.document.write(
      `<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#475569">Preparando relatório…</body></html>`,
    );

    const logoData = await imageToDataUrl(socorraoLogo);
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR");
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const docNo = `NIR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

    const hospitalName = currentHospital?.name || whitelabel.institution.hospitalFullName;
    const inst = whitelabel.print.institutionalHeader;
    const colors = whitelabel.theme.institutionalColors;

    const sectorRows = metrics.occupancyBySector
      .map(
        (s) =>
          `<tr><td style="text-transform:capitalize">${s.sector}</td><td class="c">${s.occupied}/${s.total}</td><td class="r" style="font-weight:700;color:${
            s.rate >= 95 ? "#dc2626" : s.rate >= 80 ? "#d97706" : "#059669"
          }">${s.rate}%</td><td class="r"><div class="bar"><div style="width:${s.rate}%;background:${
            s.rate >= 95 ? "#dc2626" : s.rate >= 80 ? "#d97706" : "#059669"
          }"></div></div></td></tr>`,
      )
      .join("");

    const next72 = predictions.filter((p) => p.bucket === "today" || p.bucket === "tomorrow" || p.bucket === "48_72h");
    const dischargeRows = next72
      .map(
        (p) =>
          `<tr><td style="font-weight:600">${p.name}</td><td style="text-transform:capitalize">${p.sector || "—"}</td><td class="c">${
            p.bed_number || "—"
          }</td><td>${p.uti_discharge_prediction || ""}</td><td class="c"><span class="pill pill-${p.bucket}">${
            { today: "Hoje", tomorrow: "Amanhã", "48_72h": "48–72h", week: "Semana", later: "Futuro", unparsed: "—" }[p.bucket]
          }</span></td></tr>`,
      )
      .join("");

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Relatório NIR — ${docNo}</title>
    <style>
      @page { size: A4 portrait; margin: 12mm 14mm 16mm; }
      @media print {
        .header, .footer { position: fixed; left: 0; right: 0; }
        .header { top: 0; }
        .footer { bottom: 0; }
        body { margin: 0; }
      }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; font-size: 9.5pt; line-height: 1.35; }

      /* === TIMBRADO INSTITUCIONAL (Norma Zero MAN.05-001) === */
      .header { background: #fff; border-bottom: 2.5pt solid #0054A6; padding: 10pt 0 8pt; margin-bottom: 8pt; }
      .header-inner { display: grid; grid-template-columns: 96px 1fr 96px; align-items: center; gap: 16pt; }
      .logo-wrap { display: flex; align-items: center; justify-content: center; }
      .logo { height: 88px; width: 88px; object-fit: contain; }
      .h-text { text-align: center; }
      .h-line1, .h-line2 { font-size: 8.5pt; font-weight: 600; color: #475569; letter-spacing: 0.5pt; text-transform: uppercase; }
      .h-line3 { font-size: 11.5pt; font-weight: 700; color: #0a1628; margin-top: 3pt; letter-spacing: 0.3pt; }
      .h-tag { font-size: 7.5pt; color: #64748b; font-style: italic; margin-top: 3pt; }
      .cruz-bar { display: flex; height: 4pt; margin-top: 6pt; border-radius: 2pt; overflow: hidden; }
      .cruz-bar > div { flex: 1; }

      /* === MARCAÇÃO DOCUMENTO === */
      .doc-bar { display: flex; justify-content: space-between; align-items: center; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 4pt 8pt; font-size: 8pt; margin-bottom: 8pt; border-radius: 3pt; }
      .doc-bar b { color: #0a1628; }

      /* === TÍTULO === */
      h1 { font-size: 14pt; margin: 4pt 0 2pt; color: #0a1628; text-align: center; letter-spacing: 0.4pt; }
      .subtitle { text-align: center; color: #64748b; font-size: 8.5pt; margin-bottom: 10pt; }

      /* === SEÇÕES === */
      h2 { font-size: 10pt; margin: 12pt 0 4pt; padding: 3pt 6pt; background: #0054A6; color: #fff; border-radius: 3pt 3pt 0 0; letter-spacing: 0.5pt; text-transform: uppercase; }

      /* === KPI GRID === */
      .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4pt; margin-top: 4pt; }
      .kpi { border: 1px solid #e2e8f0; border-left: 3pt solid #0054A6; padding: 4pt 6pt; border-radius: 2pt; background: #fafbfc; }
      .kpi.warn { border-left-color: #d97706; }
      .kpi.danger { border-left-color: #dc2626; }
      .kpi.success { border-left-color: #059669; }
      .kpi .label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.4pt; color: #64748b; font-weight: 600; }
      .kpi .value { font-size: 15pt; font-weight: 700; color: #0a1628; line-height: 1.1; margin-top: 1pt; }
      .kpi .sub { font-size: 7pt; color: #64748b; margin-top: 1pt; }

      /* === ALERTAS === */
      .alerts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4pt; }
      .alert { border-left: 3pt solid; padding: 4pt 6pt; font-size: 8pt; border-radius: 2pt; }
      .alert b { display: block; font-size: 13pt; font-weight: 700; line-height: 1; margin-bottom: 1pt; }
      .alert.red { border-color: #dc2626; background: #fef2f2; color: #7f1d1d; }
      .alert.amber { border-color: #d97706; background: #fffbeb; color: #78350f; }
      .alert.purple { border-color: #9333ea; background: #faf5ff; color: #581c87; }
      .alert.orange { border-color: #ea580c; background: #fff7ed; color: #7c2d12; }

      /* === TABELAS === */
      table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
      th { background: #f1f5f9; font-weight: 700; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.4pt; padding: 4pt 6pt; text-align: left; border-bottom: 1.5pt solid #cbd5e1; color: #334155; }
      td { padding: 3.5pt 6pt; border-bottom: 0.5pt solid #e2e8f0; }
      tr:nth-child(even) td { background: #fafbfc; }
      .c { text-align: center; }
      .r { text-align: right; }
      .bar { width: 100%; height: 4pt; background: #e2e8f0; border-radius: 2pt; overflow: hidden; }
      .bar > div { height: 100%; border-radius: 2pt; }

      .pill { display: inline-block; font-size: 7pt; padding: 1pt 5pt; border-radius: 8pt; font-weight: 600; }
      .pill-today { background: #d1fae5; color: #065f46; }
      .pill-tomorrow { background: #cffafe; color: #155e75; }
      .pill-48_72h { background: #dbeafe; color: #1e40af; }

      /* === RODAPÉ === */
      .footer { border-top: 1pt solid #cbd5e1; padding-top: 4pt; margin-top: 14pt; font-size: 7pt; color: #64748b; display: flex; justify-content: space-between; align-items: center; }
      .footer .left { display: flex; align-items: center; gap: 4pt; }
      .signature-area { margin-top: 24pt; padding-top: 12pt; border-top: 1pt dashed #94a3b8; display: grid; grid-template-columns: 1fr 1fr; gap: 30pt; }
      .sig { text-align: center; font-size: 8pt; }
      .sig .line { border-top: 1pt solid #475569; margin-bottom: 3pt; height: 30pt; }
      .sig b { display: block; color: #0a1628; }
      .sig span { color: #64748b; font-size: 7pt; }

      .empty { text-align: center; color: #94a3b8; font-style: italic; padding: 12pt; }
    </style></head><body>
      <div class="header">
        <div class="header-inner">
          ${logoData ? `<img src="${logoData}" class="logo" alt="${whitelabel.institution.hospitalAbbreviation}"/>` : `<div class="logo" style="background:#0054A6;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;border-radius:6pt">${whitelabel.institution.hospitalAbbreviation}</div>`}
          <div class="h-text">
            <div class="h-line1">${inst.line1}</div>
            <div class="h-line2">${inst.line2}</div>
            <div class="h-line3">${inst.line3}</div>
            <div class="h-tag">${whitelabel.institution.address}</div>
          </div>
          <div style="width:56px"></div>
        </div>
        <div class="cruz-bar">
          <div style="background:${colors.red}"></div>
          <div style="background:${colors.orange}"></div>
          <div style="background:${colors.yellow}"></div>
          <div style="background:${colors.green}"></div>
          <div style="background:${colors.blue}"></div>
        </div>
      </div>

      <div class="doc-bar">
        <span><b>Documento:</b> ${docNo}</span>
        <span><b>Setor:</b> Núcleo Interno de Regulação (NIR)</span>
        <span><b>Emissão:</b> ${dateStr} às ${timeStr}</span>
      </div>

      <h1>RELATÓRIO OPERACIONAL — NIR</h1>
      <div class="subtitle">${hospitalName} • Indicadores em tempo real</div>

      <h2>1. Indicadores Principais</h2>
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

      <h2>2. Alertas Críticos</h2>
      <div class="alerts">
        <div class="alert red"><b>${metrics.stuck24h.length}</b>Aguardando vaga +24h</div>
        <div class="alert red"><b>${metrics.stuck48hUti.length}</b>UTI aguardando +48h</div>
        <div class="alert orange"><b>${metrics.longCleaning.length}</b>Higienização +4h</div>
        <div class="alert purple"><b>${metrics.sisregStuck.length}</b>SISREG sem resposta +12h</div>
      </div>

      <h2>3. Ocupação por Setor</h2>
      <table><thead><tr><th>Setor</th><th class="c">Ocupados/Total</th><th class="r">Taxa</th><th class="r" style="width:30%">Distribuição</th></tr></thead><tbody>${
        sectorRows || '<tr><td colspan="4" class="empty">Nenhum setor com dados de ocupação</td></tr>'
      }</tbody></table>

      <h2>4. Previsão de Altas — Próximas 72h (${next72.length})</h2>
      <table><thead><tr><th>Paciente</th><th>Setor</th><th class="c">Leito</th><th>Previsão</th><th class="c">Janela</th></tr></thead><tbody>${
        dischargeRows || '<tr><td colspan="5" class="empty">Nenhuma previsão de alta registrada nas próximas 72h</td></tr>'
      }</tbody></table>

      <div class="signature-area">
        <div class="sig"><div class="line"></div><b>Coordenação NIR</b><span>Carimbo e assinatura</span></div>
        <div class="sig"><div class="line"></div><b>Direção Técnica</b><span>Carimbo e assinatura</span></div>
      </div>

      <div class="footer">
        <div class="left">
          <span><b>${whitelabel.institution.hospitalAbbreviation}</b> — ${whitelabel.platform.fullName}</span>
        </div>
        <div>${whitelabel.compliance.normaZeroCode} v${whitelabel.compliance.normaZeroVersion} • ${whitelabel.compliance.legalReferences}</div>
        <div>${dateStr} ${timeStr} • Pág. <span class="pageNumber"></span></div>
      </div>

      <script>
        window.onload = () => { setTimeout(() => window.print(), 350); };
      </script>
    </body></html>`;

    printWindow.document.open();
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
