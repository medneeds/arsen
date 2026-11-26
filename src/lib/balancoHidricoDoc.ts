/**
 * Corpo do PDF ENF-BH (balanco hidrico 24h, A4 paisagem). Puro: recebe o
 * resultado de computeFluidBalance (o MESMO numero da tela) e devolve HTML.
 * Total do PDF = total da tela = valor lido pela nutricao (aceite da 4a).
 */
import { BH_CATEGORIAS, categoriaLabel, formatMl, type FluidBalanceResult, type Lancamento } from "./fluidBalance.ts";
import { fortalezaParts } from "./docPrefixes.ts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const pad = (n: number) => String(n).padStart(2, "0");
const n1 = (v: number) => (v === 0 ? "" : (Math.round(v * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

export type StatusBH = "aberto" | "fechado" | "validado";

export interface BalancoDocInput {
  result: FluidBalanceResult;
  lancamentos: Lancamento[];
  periodoInicio: Date;
  pesoTexto: string;
  incluirInsensiveis: boolean;
  status: StatusBH;
  fechadoPor?: string | null;
  validadoPor?: string | null;
  validadoEm?: string | null;
}

export function buildBalancoHidricoBody(d: BalancoDocInput): string {
  const validos = d.lancamentos.filter((l) => !l.anulado);
  const usadas = BH_CATEGORIAS.filter((c) => validos.some((l) => l.categoria === c.key && l.sentido === c.sentido));
  const ganhosCats = usadas.filter((c) => c.sentido === "ganho");
  const perdasCats = usadas.filter((c) => c.sentido === "perda");
  const t0 = d.periodoInicio.getTime();
  const cell = (hourIdx: number, cat: string, sentido: string) => {
    const v = validos
      .filter((l) => l.categoria === cat && l.sentido === sentido && Math.min(23, Math.floor((l.dataHora.getTime() - t0) / 3_600_000)) === hourIdx)
      .reduce((s, l) => s + l.volumeMl, 0);
    return n1(v);
  };
  let acumulado = 0;
  const linhas = d.result.porHora.map((h, i) => {
    acumulado += h.saldo;
    const sep = i === 6 || i === 12 ? ' class="bh-sep"' : "";
    return `<tr${sep}><th>${pad(h.hora)}h</th>`
      + ganhosCats.map((c) => `<td>${cell(i, c.key, "ganho")}</td>`).join("")
      + `<td class="bh-tot">${n1(h.ganhos)}</td>`
      + perdasCats.map((c) => `<td>${cell(i, c.key, "perda")}</td>`).join("")
      + `<td class="bh-tot">${n1(h.perdas)}</td>`
      + `<td class="bh-saldo">${h.saldo === 0 ? "" : formatMl(h.saldo, true).replace(" mL", "")}</td>`
      + `<td class="bh-saldo">${formatMl(acumulado, true).replace(" mL", "")}</td></tr>`;
  }).join("");

  const tot = (sentido: "ganho" | "perda", key: string) => n1(d.result.porCategoria[`${sentido}:${key}`] ?? 0);
  const totRow = `<tr class="bh-total"><th>Total</th>`
    + ganhosCats.map((c) => `<td>${tot("ganho", c.key)}</td>`).join("")
    + `<td class="bh-tot">${n1(d.result.ganhos)}</td>`
    + perdasCats.map((c) => `<td>${tot("perda", c.key)}</td>`).join("")
    + `<td class="bh-tot">${n1(d.result.perdas)}</td><td colspan="2">${formatMl(d.result.ganhos - d.result.perdas, true)}</td></tr>`;

  const p = fortalezaParts(d.periodoInicio);
  const pf = fortalezaParts(new Date(d.periodoInicio.getTime() + 86_400_000));
  const periodo = `${pad(p.day)}/${pad(p.month)}/${p.year} 07h → ${pad(pf.day)}/${pad(pf.month)} 07h`;
  const statusTxt = d.status === "validado"
    ? `Validado por ${esc(d.validadoPor || "—")}`
    : d.status === "fechado" ? "Fechado — aguardando validação do enfermeiro" : "PARCIAL — balanço ainda não fechado";

  const resumo = [
    ["Período", periodo],
    ["Peso", d.pesoTexto || "—"],
    ["Ganhos", formatMl(d.result.ganhos)],
    ["Perdas", formatMl(d.result.perdas)],
    ["Insensíveis", d.incluirInsensiveis ? (d.result.insensiveis != null ? formatMl(d.result.insensiveis) : "peso não registrado") : "não incluídas"],
    ["Balanço 24h", formatMl(d.result.balanco, true)],
    ["Diurese", d.result.diureseMlKgH != null ? `${formatMl(d.result.diureseMl)} · ${String(d.result.diureseMlKgH).replace(".", ",")} mL/kg/h` : formatMl(d.result.diureseMl)],
    ["Parciais", `07–13h ${formatMl(d.result.parciais.t07_13, true)} · 13–19h ${formatMl(d.result.parciais.t13_19, true)} · 19–07h ${formatMl(d.result.parciais.t19_07, true)}`],
    ["Situação", statusTxt],
  ].map(([k, v]) => `<div class="bh-kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("");

  const alertas = d.result.alertas.length
    ? `<div class="bh-alertas">${d.result.alertas.map((a) => `<div>⚠ ${esc(a.mensagem)}</div>`).join("")}</div>`
    : "";

  const semDados = usadas.length === 0
    ? `<p class="bh-vazio">Nenhum lançamento no período.</p>`
    : `<table class="bh-grid">
        <thead>
          <tr><th rowspan="2">Hora</th>
            ${ganhosCats.length ? `<th colspan="${ganhosCats.length + 1}" class="bh-g">Ganhos (mL)</th>` : `<th class="bh-g">Ganhos</th>`}
            ${perdasCats.length ? `<th colspan="${perdasCats.length + 1}" class="bh-p">Perdas (mL)</th>` : `<th class="bh-p">Perdas</th>`}
            <th rowspan="2">Saldo</th><th rowspan="2">Acumulado</th></tr>
          <tr>${ganhosCats.map((c) => `<th>${esc(c.label)}</th>`).join("")}<th>Total</th>${perdasCats.map((c) => `<th>${esc(c.label)}</th>`).join("")}<th>Total</th></tr>
        </thead>
        <tbody>${linhas}${totRow}</tbody>
      </table>`;

  return `<div class="bh-resumo">${resumo}</div>${alertas}${semDados}`;
}

export const BALANCO_HIDRICO_STYLES = `
  .bh-resumo { display: grid; grid-template-columns: 1.6fr 1fr .9fr .9fr 1fr 1fr 1.3fr 2.1fr 1.6fr; gap: 3pt; margin: 4pt 0; }
  .bh-kv { border: .75pt solid #cbd5e1; border-radius: 3pt; padding: 2pt 4pt; background: #f8fafc; }
  .bh-kv span { display: block; font-size: 6pt; text-transform: uppercase; letter-spacing: .2pt; color: #64748b; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bh-kv b { font-size: 7.5pt; line-height: 1.2; display: block; }
  .bh-alertas { border: .75pt solid #f59e0b; background: #fffbeb; color: #92400e; border-radius: 3pt; padding: 2pt 6pt; font-size: 7.5pt; margin-bottom: 3pt; }
  table.bh-grid { width: 100%; border-collapse: collapse; font-size: 7pt; table-layout: fixed; line-height: 1.1; }
  table.bh-grid th, table.bh-grid td { border: .5pt solid #cbd5e1; padding: .1pt 3pt; text-align: center; }
  table.bh-grid thead th { background: #f1f5f9; font-size: 6.3pt; text-transform: uppercase; padding: 1.2pt 3pt; }
  table.bh-grid th.bh-g { background: #e0f2fe; } table.bh-grid th.bh-p { background: #fef3c7; }
  table.bh-grid tbody th { background: #f8fafc; font-weight: 700; }
  table.bh-grid td.bh-tot { font-weight: 700; background: #f8fafc; }
  table.bh-grid td.bh-saldo { font-weight: 700; }
  table.bh-grid tr.bh-sep th, table.bh-grid tr.bh-sep td { border-top: 1.5pt solid #64748b; }
  table.bh-grid tr.bh-total th, table.bh-grid tr.bh-total td { font-weight: 700; background: #e2e8f0; border-top: 1.5pt solid #334155; }
  .bh-vazio { font-size: 9pt; color: #64748b; padding: 8pt 0; }
  /* Uma folha A4 paisagem: assinatura e rodape mais proximos (so neste documento). */
  .nz-signature-area { margin-top: 8pt; padding-top: 4pt; }
  .nz-sig .nz-line { height: 22pt; }
  .nz-footer { margin-top: 6pt; }
`;

/** Rotulo da categoria (reexporta para a tela). */
export { categoriaLabel };
