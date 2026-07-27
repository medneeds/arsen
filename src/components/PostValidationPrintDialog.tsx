import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer } from "lucide-react";
import { formatValidationMoment } from "@/lib/formatValidationMoment";

/** Item selecionável na etapa de impressão. */
export interface PrintOption {
  id: string;
  label: string;
  description?: string;
  /** Vem marcado ao abrir. O documento principal costuma vir; guias, não. */
  defaultChecked?: boolean;
}

interface PostValidationPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Evolução" | "Prescrição" — usado no título e no rótulo do botão. */
  documentLabel: string;
  /** Quem validou. Omitido se não disponível. */
  validatedByName?: string | null;
  /** Momento da validação. Aceita Date ou ISO. */
  validatedAt?: Date | string | null;
  /** Observação extra. NÃO usar para prometer comportamento — ver onPrint. */
  note?: string;
  /**
   * Opções de impressão. Quando presentes, a etapa exibe as caixas e o usuário
   * ESCOLHE o que sai — nunca se assume que guia regulatória acompanha o
   * documento principal. Ausente = um documento só, botão direto.
   */
  options?: PrintOption[];
  /**
   * Disparado pelo clique no botão — é ESTE gesto que libera window.open.
   * Recebe os ids marcados (vazio quando não há opções).
   */
  onPrint: (selectedIds: string[]) => void;
}

/**
 * Check desenhado — o círculo se fecha e o traço risca em seguida.
 *
 * SVG puro com keyframes em vez de biblioteca: são 20 linhas, não acrescenta
 * dependência e o traço "escrevendo" comunica conclusão melhor que um ícone
 * que simplesmente aparece.
 *
 * Respeita prefers-reduced-motion: quem pediu menos movimento vê o check
 * pronto, sem animação. Num sistema usado em plantão de madrugada isso não é
 * detalhe — movimento inesperado incomoda, e há quem tenha sensibilidade
 * vestibular.
 */
function AnimatedCheck() {
  return (
    <>
      <style>{`
        @keyframes pvdCircle { to { stroke-dashoffset: 0; } }
        @keyframes pvdCheck  { to { stroke-dashoffset: 0; } }
        @keyframes pvdPop    { 0% { transform: scale(.82); } 60% { transform: scale(1.04); } 100% { transform: scale(1); } }
        .pvd-svg    { animation: pvdPop .45s cubic-bezier(.22,1,.36,1) both; }
        .pvd-circle { stroke-dasharray: 151; stroke-dashoffset: 151; animation: pvdCircle .5s cubic-bezier(.65,0,.45,1) forwards; }
        .pvd-check  { stroke-dasharray: 36;  stroke-dashoffset: 36;  animation: pvdCheck .28s cubic-bezier(.65,0,.45,1) .38s forwards; }
        @media (prefers-reduced-motion: reduce) {
          .pvd-svg, .pvd-circle, .pvd-check { animation: none; stroke-dashoffset: 0; }
        }
      `}</style>
      <svg
        viewBox="0 0 52 52"
        className="pvd-svg h-10 w-10 shrink-0 text-emerald-600 dark:text-emerald-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle className="pvd-circle" cx="26" cy="26" r="24" opacity="0.9" />
        <path className="pvd-check" d="M15 27l7.5 7.5L37 20" />
      </svg>
    </>
  );
}

/**
 * Etapa explícita após a validação com senha.
 *
 * POR QUE ISTO EXISTE, e não uma janela que abre sozinha:
 * PasswordConfirmDialog verifica a senha com `await supabase.functions.invoke`.
 * Quando a validação termina, já estamos vários awaits longe do clique do
 * usuário, e o navegador bloqueia `window.open` fora da pilha do gesto (Safari
 * é o mais rígido). A alternativa seria pré-abrir a janela ANTES de saber se a
 * senha está certa — o que faz piscar uma janela em branco a cada senha errada.
 *
 * Aqui o botão Imprimir é um clique de verdade, então window.open funciona sem
 * truque. E o passo tem mérito próprio em prontuário: a pessoa vê o que validou
 * antes de mandar ao papel.
 *
 * NÃO tem timeout. A etapa anterior na evolução era um banner que sumia sozinho
 * em 30s — quem se distraísse perdia o acesso ao documento recém-validado e
 * precisava caçá-lo na lista.
 */
export function PostValidationPrintDialog({
  open,
  onOpenChange,
  documentLabel,
  validatedByName,
  validatedAt,
  note,
  options,
  onPrint,
}: PostValidationPrintDialogProps) {
  const moment = formatValidationMoment(validatedAt);
  const quem = validatedByName?.trim();
  const temOpcoes = !!options && options.length > 0;

  const [marcados, setMarcados] = useState<string[]>([]);

  // Reidrata os padrões a cada abertura. Sem isto, uma escolha feita numa
  // validação anterior vazaria para a próxima — e "imprimiu junto da última
  // vez" é justamente o que não pode acontecer sozinho.
  useEffect(() => {
    if (!open) return;
    setMarcados((options ?? []).filter((o) => o.defaultChecked).map((o) => o.id));
  }, [open, options]);

  const alternar = (id: string) =>
    setMarcados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const nadaMarcado = temOpcoes && marcados.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex flex-col items-center gap-2.5 pt-1 pb-0.5">
            <AnimatedCheck />
            <DialogTitle className="text-base font-semibold">
              {documentLabel} validada com sucesso
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-center">
            {quem && moment
              ? `Validada por ${quem} em ${moment}.`
              : quem
                ? `Validada por ${quem}.`
                : moment
                  ? `Validada em ${moment}.`
                  : "Validação concluída."}
          </DialogDescription>
        </DialogHeader>

        {note && (
          <p className="text-xs text-muted-foreground leading-relaxed text-center">{note}</p>
        )}

        {temOpcoes && (
          <div className="space-y-2 pt-1">
            {options!.map((opt) => (
              <label
                key={opt.id}
                className="flex items-start gap-2.5 p-2.5 rounded-md border border-border hover:bg-muted/30 cursor-pointer"
              >
                <Checkbox
                  checked={marcados.includes(opt.id)}
                  onCheckedChange={() => alternar(opt.id)}
                  className="mt-0.5"
                />
                <div className="text-xs leading-snug">
                  <div className="font-semibold">{opt.label}</div>
                  {opt.description && (
                    <div className="text-muted-foreground">{opt.description}</div>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              // Fecha ANTES de imprimir: handlePrint da prescrição pode abrir o
              // diálogo de seleção de guias (ATM / Psicotrópicos), e dois
              // diálogos abertos disputam o foco. Ambos seguem no mesmo tick do
              // clique, então window.open continua liberado pelo navegador.
              onOpenChange(false);
              onPrint(marcados);
            }}
            disabled={nadaMarcado}
            className="gap-1.5 text-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            {temOpcoes ? "Imprimir selecionados" : `Imprimir ${documentLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
