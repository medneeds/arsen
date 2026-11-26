/**
 * Corpo do PDF ENF-APZ (aprazamento e checagem, A4 paisagem). Puro: recebe as
 * linhas ja montadas pela tela (mesma fonte: aprazamentos + administracoes) e
 * devolve HTML. Grade de 24 colunas na ordem da vigencia (12h -> 11h).
 */
import { VALIDITY_HOURS } from "./prescriptionValidity.ts";
import type { StatusDose } from "./aprazamentoItens.ts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const pad = (n: number) => String(n).padStart(2, "0");

export interface DoseDoc {
  hora: number;
  minuto: number;
  status: StatusDose;
  /** "14:05" quando checada */
  checadoAs?: string | null;
  /** iniciais/nome curto de quem checou */
  por?: string | null;
  duplaPendente?: boolean;
}

export interface LinhaDoc {
  nome: string;
  resumo: string;
  mav: boolean;
  /** "S/N", "Contínuo" etc. quando o item nao tem grade */
  observacao?: string | null;
  doses: DoseDoc[];
}

export interface OcorrenciaDoc { quando: string; item: string; texto: string; por: string }

export interface AprazamentoDocInput {
  vigencia: string;
  linhas: LinhaDoc[];
  ocorrencias: OcorrenciaDoc[];
  aprazadoPor?: string | null;
}

const SIMBOLO: Record<StatusDose, string> = {
  pendente: "", proxima: "", atrasada: "!", realizada: "✓", nao_realizada: "✗", cancelada: "",
};

function celula(ds: DoseDoc[]): string {
  if (!ds.length) return "<td></td>";
  const partes = ds.map((d) => {
    const hm = `${pad(d.hora)}${d.minuto ? `:${pad(d.minuto)}` : "h"}`;
    if (d.status === "cancelada") return `<s>${hm}</s>`;
    const chk = d.status === "realizada" || d.status === "nao_realizada"
      ? `<span class="apz-${d.status}">${SIMBOLO[d.status]}${d.checadoAs ? ` ${esc(d.checadoAs)}` : ""}</span>${d.por ? `<i>${esc(d.por)}</i>` : ""}${d.duplaPendente ? `<i class="apz-dc">DC pend.</i>` : ""}`
      : `<span class="apz-${d.status}">${SIMBOLO[d.status]}</span>`;
    return `<b>${hm}</b>${chk}`;
  });
  const cls = ds.some((d) => d.status === "nao_realizada") ? ' class="apz-x"' : ds.some((d) => d.status === "realizada") ? ' class="apz-ok"' : "";
  return `<td${cls}>${partes.join("<br>")}</td>`;
}

export function buildAprazamentoBody(d: AprazamentoDocInput): string {
  const head = `<tr><th class="apz-item">Item prescrito</th>${VALIDITY_HOURS.map((h) => `<th${h === 0 ? ' class="apz-meia"' : ""}>${pad(h)}</th>`).join("")}</tr>`;
  const linhas = d.linhas.map((l) => {
    const porHora = new Map<number, DoseDoc[]>();
    for (const ds of l.doses) porHora.set(ds.hora, [...(porHora.get(ds.hora) ?? []), ds]);
    const obs = l.observacao ? ` <em>${esc(l.observacao)}</em>` : "";
    return `<tr><th class="apz-item">${l.mav ? '<span class="apz-mav">MAV</span> ' : ""}<b>${esc(l.nome)}</b>${obs}<small>${esc(l.resumo)}</small></th>`
      + VALIDITY_HOURS.map((h) => celula(porHora.get(h) ?? [])).join("") + "</tr>";
  }).join("");
  const tabela = d.linhas.length
    ? `<table class="apz-grid"><thead>${head}</thead><tbody>${linhas}</tbody></table>`
    : `<p class="apz-vazio">Nenhum item aprazado nesta vigência.</p>`;
  const ocorr = d.ocorrencias.length
    ? `<div class="apz-ocorr"><h4>Ocorrências (não realizadas, doses S/N e avulsas, cancelamentos)</h4><table><tbody>${d.ocorrencias.map((o) => `<tr><td>${esc(o.quando)}</td><td><b>${esc(o.item)}</b></td><td>${esc(o.texto)}</td><td>${esc(o.por)}</td></tr>`).join("")}</tbody></table></div>`
    : "";
  const legenda = `<div class="apz-legenda">Vigência ${esc(d.vigencia)} · <b>HHh</b> aprazado · ✓ realizado (hora e quem checou) · ✗ não realizado · ! atrasado · <s>riscado</s> cancelado · MAV: alta vigilância, dupla checagem${d.aprazadoPor ? ` · Aprazado por ${esc(d.aprazadoPor)}` : ""}</div>`;
  return `${legenda}${tabela}${ocorr}`;
}

export const APRAZAMENTO_STYLES = `
  .apz-legenda { font-size: 7pt; color: #475569; margin: 3pt 0 4pt; }
  table.apz-grid { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 6.4pt; line-height: 1.15; }
  table.apz-grid th, table.apz-grid td { border: .5pt solid #cbd5e1; padding: 1pt 1.5pt; text-align: center; vertical-align: top; word-break: break-word; }
  table.apz-grid thead th { background: #f1f5f9; font-size: 6.5pt; }
  table.apz-grid th.apz-meia, table.apz-grid td:nth-child(14) { border-left: 1.5pt solid #64748b; }
  table.apz-grid th.apz-item { width: 19%; text-align: left; font-weight: 400; background: #f8fafc; }
  table.apz-grid th.apz-item b { font-size: 7pt; }
  table.apz-grid th.apz-item small { display: block; color: #475569; font-size: 6pt; }
  table.apz-grid th.apz-item em { font-style: normal; font-weight: 700; color: #92400e; font-size: 6pt; }
  table.apz-grid td b { display: block; font-size: 6.6pt; }
  table.apz-grid td i { display: block; font-style: normal; color: #475569; font-size: 5.6pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; word-break: normal; }
  table.apz-grid td i.apz-dc { color: #b45309; font-weight: 700; }
  table.apz-grid td.apz-ok { background: #f0fdf4; } table.apz-grid td.apz-x { background: #fef2f2; }
  .apz-realizada { color: #166534; font-weight: 700; } .apz-nao_realizada { color: #991b1b; font-weight: 700; } .apz-atrasada { color: #b45309; font-weight: 700; }
  .apz-mav { display: inline-block; border: .75pt solid #b91c1c; color: #b91c1c; border-radius: 2pt; padding: 0 1.5pt; font-size: 5.6pt; font-weight: 700; }
  .apz-ocorr { margin-top: 5pt; } .apz-ocorr h4 { font-size: 7.5pt; margin: 0 0 2pt; }
  .apz-ocorr table { width: 100%; border-collapse: collapse; font-size: 6.8pt; }
  .apz-ocorr td { border: .5pt solid #e2e8f0; padding: 1pt 3pt; }
  .apz-vazio { font-size: 9pt; color: #64748b; padding: 8pt 0; }
  .nz-signature-area { margin-top: 8pt; padding-top: 4pt; }
  .nz-sig .nz-line { height: 22pt; }
`;
