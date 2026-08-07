/**
 * CompoundedTabletFields
 * Alerta de segurança para comprimidos/cápsulas administrados via sonda
 * enteral (SNG / SNE / GTT / Jejunostomia).
 *
 * Aparece automaticamente quando:
 *   presentation = comprimido | cápsula | drágea
 *   E route = enteral | sng | sne | gtt | sonda | gastrostomia | jejunostomia
 *
 * Enxugado em 16/07/2026 (pedido do gestor: "esse fluxo de detalhamento
 * poluiu mais do que ajudou, deixar mais parecido com o modo oral"):
 *   - Removidos os 3 campos numéricos (diluir/lavagem pré/pós), o toggle
 *     "administrar separadamente" e o botão "Aplicar à instrução" — a
 *     instrução no padrão ISMP-Brasil (ou a técnica específica do
 *     medicamento, quando existe) é gerada automaticamente no impresso via
 *     buildPrepSegments (isOralSolidEnteral), sem precisar ser gravada em
 *     instructions.
 *   - Preservado o que é segurança do paciente, não burocracia: o alerta
 *     vermelho bloqueante (NÃO TRITURAR sem técnica viável) e o resumo da
 *     técnica específica (ex.: omeprazol — abrir cápsula e dispersar em
 *     suco) continuam visíveis, em formato compacto e somente leitura.
 *
 * BUGFIX (07/08/2026): o useEffect que preenchia instructions automaticamente
 * foi removido. O autofill gerava dois problemas:
 *   1. Poluição visual: o texto de trituração aparecia nas "Observações" do
 *      item, ao lado da quantidade, mesmo sendo redundante com o compacto.
 *   2. Persistente: ao navegar para outro item e voltar, o componente era
 *      remontado e o autoFilledRef perdia o valor — o texto voltava mesmo
 *      depois de o médico ter apagado manualmente.
 * A instrução de trituração já sai no impresso e no compacto via
 * buildPrepSegments (isOralSolidEnteral + enteralDilutionVolume), sem
 * depender do campo instructions. O campo fica livre para observações reais.
 */
import { cn } from "@/lib/utils";
import { AlertTriangle, Pill } from "lucide-react";
import { findNotCrushable } from "@/data/notCrushableMedications";

interface PrescriptionLikeItem {
  id: string;
  name: string;
  presentation?: string;
  route?: string;
  instructions?: string;
}

interface Props {
  item: PrescriptionLikeItem;
  onUpdate: (id: string, field: 'instructions', value: string) => void;
}

export function CompoundedTabletFields({ item }: Props) {
  const block = findNotCrushable(item.name, item.presentation);
  const hasTechnique = !!block?.technique;
  const hardBlock = !!block && !hasTechnique;

  // Nem bloqueio nem técnica específica → nada a exibir (igual ao modo oral;
  // a instrução já foi preenchida em segundo plano pelo efeito acima).
  if (!hardBlock && !hasTechnique) return null;

  return (
    <div
      className={cn(
        "rounded-md border px-2 py-1.5 mt-1 text-[11px] leading-relaxed",
        hardBlock
          ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 border-l-[3px] border-l-rose-500"
          : "bg-amber-50/60 dark:bg-amber-950/25 border-amber-300/70 dark:border-amber-800/50 border-l-[3px] border-l-amber-500"
      )}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <div
          className={cn(
            "flex items-center justify-center h-4 w-4 rounded text-white shrink-0",
            hardBlock ? "bg-rose-600" : "bg-amber-600"
          )}
        >
          {hardBlock ? <AlertTriangle className="h-2.5 w-2.5" /> : <Pill className="h-2.5 w-2.5" />}
        </div>
        <span className={cn(
          "text-[10px] font-bold uppercase tracking-[0.08em]",
          hardBlock ? "text-rose-800 dark:text-rose-200" : "text-amber-800 dark:text-amber-200"
        )}>
          {hardBlock ? 'NÃO TRITURAR — administração por sonda inviável' : 'NÃO TRITURAR — técnica específica aplicada'}
        </span>
      </div>

      {hardBlock ? (
        <div className="text-rose-900 dark:text-rose-100 space-y-0.5">
          <p><strong>Motivo:</strong> {block!.reason}</p>
          {block!.alternative && <p><strong>Sugestão:</strong> {block!.alternative}</p>}
          <p className="text-[10px] text-rose-700/80 dark:text-rose-300/80 italic">
            Considere trocar a apresentação ou a via antes de prescrever.
          </p>
        </div>
      ) : (
        <div className="text-amber-900 dark:text-amber-100 space-y-0.5">
          <p><strong>Técnica:</strong> {block!.technique!.label}</p>
          <p className="text-[10px]"><strong>Motivo:</strong> {block!.reason}</p>
          <p className="text-[10px] text-amber-700/80 dark:text-amber-300/70">
            Instrução aplicada automaticamente — ajuste em "Observações adicionais" se necessário.
          </p>
        </div>
      )}
    </div>
  );
}
