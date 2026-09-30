import { useRef } from "react";
import type { Patient } from "@/types/patient";
import { Button } from "@/components/ui/button";
import { X, Printer, ClipboardList } from "lucide-react";
import { getMainPageTitle } from "@/config/whitelabel";
import { getSectorDisplayLabel } from "@/utils/bedNaming";

/**
 * Folha de PASSAGEM DE PLANTAO do setor inteiro: preview na tela + impressao.
 *
 * Renderiza, para cada paciente ativo do setor, quatro blocos clinicos
 * (Hipoteses/Diagnosticos, Antecedentes/Comorbidades, Plano Terapeutico,
 * Programacoes/Pendencias). So leitura — nao grava nada.
 *
 * O MESMO CSS (HANDOVER_CSS, classes .pdp-*) estiliza o preview e a janela de
 * impressao: o preview injeta um <style> e a impressao clona o printRef
 * (outerHTML) para uma janela nova com o mesmo CSS — assim o que se ve e o que
 * sai no papel. As classes Tailwind ficam so na "moldura" (toolbar), que nao e
 * impressa.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pacientes do setor atual, ja filtrados pelo chamador (Painel Clinico). */
  patients: Patient[];
  /** Rotulo do setor para o cabecalho da folha. */
  sectorLabel?: string;
}

const HANDOVER_CSS = `
  .pdp-root { width: 100%; max-width: 900px; margin: 0 auto; background: #fff; color: #111;
    font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding: 20px 22px; }
  .pdp-head { display: flex; justify-content: space-between; align-items: flex-end;
    border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
  .pdp-head h1 { font-size: 15px; font-weight: 700; letter-spacing: .3px; }
  .pdp-head .pdp-sub { font-size: 11px; color: #444; margin-top: 2px; }
  .pdp-head .pdp-meta { font-size: 11px; color: #444; text-align: right; }
  .pdp-patient { border: 1px solid #c9c9c9; border-radius: 6px; margin-bottom: 12px;
    padding: 8px 10px; page-break-inside: avoid; break-inside: avoid; }
  .pdp-patient-head { display: flex; align-items: baseline; gap: 8px; font-size: 12px;
    font-weight: 700; border-bottom: 1px solid #e2e2e2; padding-bottom: 5px; margin-bottom: 7px; }
  .pdp-bed { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f1f1f1;
    border: 1px solid #ddd; border-radius: 4px; padding: 1px 6px; font-size: 11px; }
  .pdp-age { font-size: 11px; font-weight: 400; color: #555; }
  .pdp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .pdp-block { border: 1px solid #ededed; border-radius: 4px; padding: 6px 8px; }
  .pdp-block-title { font-size: 9.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .4px; color: #555; margin-bottom: 4px; }
  .pdp-list { margin: 0; padding-left: 16px; }
  .pdp-list li { font-size: 11px; line-height: 1.35; margin-bottom: 2px; }
  .pdp-empty { font-size: 11px; color: #999; }
  .pdp-none { font-size: 12px; color: #777; padding: 24px 0; text-align: center; }
  @media print {
    @page { size: A4; margin: 12mm; }
    body { background: #fff !important; }
    .pdp-root { max-width: none; padding: 0; }
  }
`;

function Block({ title, items }: { title: string; items?: string[] }) {
  const list = (items ?? []).map((t) => t?.trim()).filter(Boolean) as string[];
  return (
    <div className="pdp-block">
      <div className="pdp-block-title">{title}</div>
      {list.length > 0 ? (
        <ol className="pdp-list">
          {list.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      ) : (
        <div className="pdp-empty">—</div>
      )}
    </div>
  );
}

export function PassagemPlantaoDialog({ open, onClose, patients, sectorLabel }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  if (!open) return null;

  // Pacientes ativos do setor (com nome e leito ocupado).
  const eligible = patients.filter((p) => !p.isVacant && p.name?.trim() && p.bedNumber);
  const dateStr = new Date().toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open("", "_blank", "width=1200,height=800");
    if (!w) {
      alert("Por favor, permita pop-ups para imprimir a passagem de plantao.");
      return;
    }
    w.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/>` +
        `<title>Passagem de Plantao — ${sectorLabel || "Setor"}</title>` +
        `<style>${HANDOVER_CSS}</style></head><body>${el.outerHTML}</body></html>`,
    );
    w.document.close();
    w.focus();
    // pequeno atraso para o layout assentar antes de imprimir
    setTimeout(() => { w.print(); }, 250);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/60">
      <style>{HANDOVER_CSS}</style>

      {/* Moldura (nao impressa) */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-background border-b shrink-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground min-w-0">
          <ClipboardList className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate">
            Passagem de Plantão — {sectorLabel || "Setor"} · {eligible.length} paciente{eligible.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={handlePrint} disabled={eligible.length === 0}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-1" /> Fechar
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-auto p-4">
        <div ref={printRef} className="pdp-root">
          <div className="pdp-head">
            <div>
              <h1>Passagem de Plantão</h1>
              <div className="pdp-sub">{getMainPageTitle()} · {sectorLabel || "Setor"}</div>
            </div>
            <div className="pdp-meta">
              {dateStr}<br />
              {eligible.length} paciente{eligible.length !== 1 ? "s" : ""}
            </div>
          </div>

          {eligible.length === 0 ? (
            <div className="pdp-none">Nenhum paciente ativo neste setor.</div>
          ) : (
            eligible.map((p) => (
              <section className="pdp-patient" key={p.id}>
                <div className="pdp-patient-head">
                  <span className="pdp-bed">{p.bedNumber}</span>
                  <span>{p.name}</span>
                  {p.age ? <span className="pdp-age">{p.age}</span> : null}
                  <span className="pdp-age" style={{ marginLeft: "auto" }}>
                    {getSectorDisplayLabel(p.sector) || p.sectorName || ""}
                  </span>
                </div>
                <div className="pdp-grid">
                  <Block title="Hipóteses / Diagnósticos" items={p.diagnoses} />
                  <Block title="Antecedentes / Comorbidades" items={p.medicalHistory} />
                  <Block title="Plano Terapêutico" items={p.therapeuticPlan} />
                  <Block title="Programações / Pendências" items={p.pendencies} />
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default PassagemPlantaoDialog;
