import {
  COMORBIDADES, milParaContagem, formatarContagem,
  LOCAL_ANTES_UTI, STATUS_CIRURGICO, SITIO_CIRURGICO, INFECCAO,
  IDADE, DIAS_ANTES_UTI, PLANEJADA, MOTIVO, GLASGOW, VASOATIVO,
  FC, PAS, TEMPERATURA, BILIRRUBINA, CREATININA, LEUCOCITOS, PLAQUETAS, PH, OXIGENACAO,
} from "@/lib/saps3";
import type { SapsRow } from "@/components/saps3/SapsView";
import { sectorLabelFromCode } from "@/lib/hospitalSectors";

// Faixa gravada (ex.: "lt120") -> rotulo PT (saps3.ts). Fallback para o codigo.
const labelFrom = (faixas: { id: string; rotulo: string }[], code?: string | null): string => {
  const c = String(code ?? "").trim();
  if (!c) return "";
  return faixas.find((f) => f.id === c)?.rotulo ?? c;
};

/**
 * Impressao da ficha SAPS 3 validada (helper HTML + janela, mesmo padrao de
 * printAdmission/printEvolution). O chamador so deve invocar quando
 * status === 'validada' (ficha nao validada nao tem escore para imprimir).
 */

const esc = (s?: string | null) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const num = (v?: number | null, suf = "") => (v == null || Number.isNaN(Number(v)) ? "" : `${v}${suf}`);

const field = (label: string, value?: string) => {
  const v = String(value ?? "").trim();
  if (!v) return "";
  return `<div class="f"><div class="l">${esc(label)}</div><div class="v">${esc(v)}</div></div>`;
};

const comorbLabels = (raw: unknown): string => {
  const arr = Array.isArray(raw) ? (raw as string[]) : [];
  return arr.map((id) => COMORBIDADES.find((c) => c.id === id)?.rotulo ?? id).join(" · ");
};

export interface PrintSapsIdentity {
  patientName?: string | null;
  patientBed?: string | null;
  patientSector?: string | null;
  hospitalName?: string | null;
}

export function printSapsDocument(row: SapsRow, id: PrintSapsIdentity = {}) {
  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) {
    alert("Por favor, permita pop-ups para imprimir a ficha SAPS 3.");
    return;
  }
  const leuco = row.leucocitos != null ? formatarContagem(milParaContagem(row.leucocitos)) : "";
  const plaq = row.plaquetas_mais_baixas != null ? formatarContagem(milParaContagem(row.plaquetas_mais_baixas)) : "";

  // Respostas por faixa (formato atual) — fonte primaria; colunas como fallback.
  const r: Record<string, unknown> =
    row.respostas && typeof row.respostas === "object" && !Array.isArray(row.respostas)
      ? (row.respostas as Record<string, unknown>)
      : {};
  const code = (k: string): string => (typeof r[k] === "string" ? (r[k] as string) : "");
  const fx = (def: { faixas: { id: string; rotulo: string }[] }, key: string, fallback = ""): string =>
    labelFrom(def.faixas, code(key)) || fallback;
  const comorbRaw = Array.isArray(r.comorbidades) ? r.comorbidades : row.comorbidades;

  const boxI = [
    field("Idade", fx(IDADE, "idade", num(row.idade, " anos"))),
    field("Dias no hospital antes da UTI", fx(DIAS_ANTES_UTI, "dias", num(row.dias_hospital_antes_uti))),
    field("Origem", fx(LOCAL_ANTES_UTI, "local", labelFrom(LOCAL_ANTES_UTI.faixas, row.origem_admissao))),
    field("Comorbidades", comorbLabels(comorbRaw)),
    field("Admissao planejada", fx(PLANEJADA, "planejada", row.admissao_planejada == null ? "" : row.admissao_planejada ? "Planejada" : "Nao planejada")),
  ].join("");
  const boxII = [
    field("Motivo", (row.motivo_admissao_detalhe || "").trim() || fx(MOTIVO, "motivo") || row.motivo_admissao || ""),
    field("Status cirurgico", fx(STATUS_CIRURGICO, "statusCirurgico", labelFrom(STATUS_CIRURGICO.faixas, row.status_cirurgico))),
    field("Tipo de cirurgia", fx(SITIO_CIRURGICO, "sitioCirurgico", labelFrom(SITIO_CIRURGICO.faixas, row.tipo_cirurgia))),
    field("Infeccao na admissao", fx(INFECCAO, "infeccao", labelFrom(INFECCAO.faixas, row.infeccao_na_admissao))),
  ].join("");
  const boxIII = [
    field("Glasgow", fx(GLASGOW, "glasgow", num(row.escore_glasgow))),
    field("FC (mais alta)", fx(FC, "fc", num(row.fc_mais_alta, " bpm"))),
    field("PAS (mais baixa)", fx(PAS, "pas", num(row.pas_mais_baixa, " mmHg"))),
    field("Temperatura (mais baixa)", fx(TEMPERATURA, "temperatura", num(row.temperatura_mais_baixa, " C"))),
    field("Bilirrubina (mais alta)", fx(BILIRRUBINA, "bilirrubina", num(row.bilirrubina_mais_alta, " mg/dL"))),
    field("Creatinina (mais alta)", fx(CREATININA, "creatinina", num(row.creatinina_mais_alta, " mg/dL"))),
    field("Leucocitos", fx(LEUCOCITOS, "leucocitos", leuco ? `${leuco} /mm3` : "")),
    field("Plaquetas", fx(PLAQUETAS, "plaquetas", plaq ? `${plaq} /mm3` : "")),
    field("pH (mais baixo)", fx(PH, "ph", num(row.ph_mais_baixo))),
    field("Oxigenacao (PaO2/FiO2)", fx(OXIGENACAO, "oxigenacao", num(row.relacao_pao2_fio2))),
    field("Ventilacao mecanica", row.ventilacao_mecanica == null ? "" : row.ventilacao_mecanica ? "Sim" : "Nao"),
    field("Droga vasoativa (antes da UTI)", fx(VASOATIVO, "vasoativo")),
  ].join("");

  const ident = [
    field("Paciente", id.patientName ?? ""),
    field("Leito", id.patientBed ?? ""),
    field("Setor", id.patientSector ? sectorLabelFromCode(id.patientSector) : ""),
  ].join("");

  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Ficha SAPS 3 — ${esc(id.patientName ?? "")}</title>
    <style>
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#111; margin:0; padding:16px 20px; }
      h1 { font-size:16px; margin:0 0 2px; }
      .sub { font-size:11px; color:#555; margin-bottom:10px; }
      .score { border:1px solid #cbd5e1; border-radius:6px; background:#f8fafc; padding:8px 12px; display:flex; gap:28px; align-items:flex-end; margin-bottom:12px; }
      .score .big { font-size:26px; font-weight:700; font-family:ui-monospace,Menlo,monospace; }
      .score .k { font-size:8px; text-transform:uppercase; letter-spacing:.4px; color:#64748b; font-weight:700; }
      .sec { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#0054A6; border-bottom:1px solid #0054A6; margin:12px 0 6px; padding-bottom:2px; }
      .grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px 16px; }
      .f .l { font-size:8px; text-transform:uppercase; letter-spacing:.3px; color:#64748b; font-weight:700; }
      .f .v { font-size:11px; color:#0a1628; }
      @page { size:A4; margin:12mm; }
    </style></head><body>
    <h1>Ficha SAPS 3</h1>
    <div class="sub">${esc(id.hospitalName ?? "")}</div>
    <div class="grid">${ident}</div>
    <div class="score">
      <div><div class="k">Escore total</div><div class="big">${num(row.escore_total) || "—"}</div></div>
      <div><div class="k">Mortalidade prevista</div><div class="big">${row.mortalidade_prevista != null ? row.mortalidade_prevista + "%" : "—"}</div></div>
      <div style="font-size:11px;color:#475569">Box I ${num(row.escore_box1) || "—"} · Box II ${num(row.escore_box2) || "—"} · Box III ${num(row.escore_box3) || "—"}</div>
    </div>
    <div class="sec">Box I — Condicoes previas</div><div class="grid">${boxI}</div>
    <div class="sec">Box II — Circunstancias da admissao</div><div class="grid">${boxII}</div>
    <div class="sec">Box III — Fisiologia</div><div class="grid">${boxIII}</div>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}
