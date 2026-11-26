/**
 * Corpos dos PDFs ENF-EVO (evolucao do enfermeiro) e ENF-SBAR (passagem de
 * plantao), A4 retrato. Puros: recebem o MESMO conteudo gravado e devolvem HTML.
 */
import type { SecaoTexto, SbarLeito } from "./anotacoesEnfermagem.ts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export function buildEvolucaoEnfermagemBody(secoes: SecaoTexto[], meta: { dataHora: string; status: string }): string {
  const blocos = secoes.map((s) => `<section class="ee-sec"><h4>${esc(s.titulo)}</h4>${
    s.linhas.length > 1 ? `<ul>${s.linhas.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : `<p>${esc(s.linhas[0] ?? "—")}</p>`
  }</section>`).join("");
  return `<div class="ee-meta">Registrada em ${esc(meta.dataHora)} · ${esc(meta.status)}</div>${blocos}`;
}

export const EVOLUCAO_ENFERMAGEM_STYLES = `
  .ee-meta { font-size: 7.5pt; color: #475569; margin: 3pt 0 5pt; }
  .ee-sec { border: .75pt solid #cbd5e1; border-radius: 3pt; padding: 3pt 6pt; margin-bottom: 4pt; break-inside: avoid; }
  .ee-sec h4 { margin: 0 0 2pt; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .3pt; color: #334155; }
  .ee-sec p { margin: 0; font-size: 8.5pt; line-height: 1.35; white-space: pre-wrap; }
  .ee-sec ul { margin: 0; padding-left: 12pt; font-size: 8.5pt; line-height: 1.35; }
`;

export function buildSbarBody(leitos: SbarLeito[], meta: { turno: string; setor: string; observacoes?: string }): string {
  const col = (letra: string, titulo: string, linhas: string[]) =>
    `<div class="sb-col"><div class="sb-h"><b>${letra}</b> ${esc(titulo)}</div><ul>${linhas.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>`;
  const cards = leitos.map((l) => `<section class="sb-card${l.alerta ? " sb-alerta" : ""}">
      <div class="sb-top"><span class="sb-leito">${esc(l.leito)}</span><span class="sb-pac">${esc(l.paciente)}</span>${l.alerta ? '<span class="sb-tag">ATENÇÃO</span>' : ""}</div>
      <div class="sb-grid">${col("S", "Situação", l.s)}${col("B", "Breve histórico", l.b)}${col("A", "Avaliação", l.a)}${col("R", "Recomendação", l.r)}</div>
    </section>`).join("");
  const obs = meta.observacoes?.trim() ? `<div class="sb-obs"><b>Observações gerais:</b> ${esc(meta.observacoes.trim())}</div>` : "";
  return `<div class="sb-meta">${esc(meta.setor)} · ${esc(meta.turno)} · ${leitos.length} leito(s)</div>${obs}${cards || '<p class="sb-vazio">Nenhum leito incluído.</p>'}`;
}

export const SBAR_STYLES = `
  .sb-meta { font-size: 8pt; color: #475569; margin: 3pt 0 4pt; }
  .sb-obs { font-size: 8pt; border: .75pt solid #cbd5e1; border-radius: 3pt; padding: 3pt 6pt; margin-bottom: 4pt; }
  .sb-card { border: .75pt solid #cbd5e1; border-radius: 3pt; margin-bottom: 4pt; break-inside: avoid; }
  .sb-card.sb-alerta { border-color: #dc2626; }
  .sb-top { display: flex; gap: 6pt; align-items: baseline; background: #f1f5f9; padding: 2pt 6pt; border-bottom: .75pt solid #cbd5e1; }
  .sb-alerta .sb-top { background: #fef2f2; }
  .sb-leito { font-weight: 800; font-size: 9pt; } .sb-pac { font-weight: 700; font-size: 8.5pt; flex: 1; }
  .sb-tag { font-size: 6.5pt; font-weight: 800; color: #b91c1c; border: .75pt solid #b91c1c; border-radius: 2pt; padding: 0 2pt; }
  .sb-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; }
  .sb-col { padding: 2pt 5pt; border-right: .5pt solid #e2e8f0; } .sb-col:last-child { border-right: none; }
  .sb-h { font-size: 6.5pt; text-transform: uppercase; color: #334155; margin-bottom: 1pt; } .sb-h b { font-size: 8pt; color: #1e3a8a; }
  .sb-col ul { margin: 0; padding-left: 9pt; font-size: 7.3pt; line-height: 1.3; }
  .sb-vazio { font-size: 9pt; color: #64748b; }
`;
