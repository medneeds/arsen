/**
 * Marca do Arsen.
 *
 * Substitui o PNG de 849 kB que existia antes — um bitmap com fundo escuro
 * embutido, que nao funcionava sobre fundo claro, nao escalava e pesava mais
 * que o maior arquivo de codigo do projeto.
 *
 * O DESENHO
 * O "A" tem alto contraste entre as hastes (a esquerda quase um fio, a direita
 * engrossando ao descer), serifas em lamina fina e, no alto, uma FENDA: as duas
 * hastes se aproximam e nao se tocam.
 *
 * A fenda e o unico gesto da marca, e carrega o que o Arsen faz:
 *   - e uma passagem — o arco por onde o medico entra no setor e o paciente
 *     atravessa a internacao;
 *   - e o caso que nao se encerra — no hospital o plantao passa, a evolucao
 *     continua, a proxima equipe assume. Um apice fechado diria "concluido";
 *   - e o juizo que fica com o medico — o sistema organiza, calcula e alerta,
 *     mas nao fecha a decisao. O vertice permanece aberto para quem assina.
 *
 * Em uma frase: o Arsen estrutura sem fechar.
 *
 * AS DUAS VERSOES
 * Alto contraste e elegante e fragil: abaixo de ~24px o fio da haste esquerda
 * e a fenda desaparecem. Por isso ha a variante "compacta" — mesma letra com
 * haste engrossada, travessao encorpado e sem serifas. Nao e outra marca; e o
 * mesmo desenho ajustado para sobreviver ao tamanho, como uma fonte de texto
 * difere da mesma familia em tamanho de titulo.
 *
 * Regra: elegante a partir de 24px; compacta abaixo disso (favicon, avatar,
 * icone de aba).
 *
 * A cor vem de currentColor, entao a marca herda o contexto — navy sobre claro,
 * branco sobre a faixa institucional, preto no impresso.
 */

interface ArsenMarkProps {
  /** Altura em pixels. Abaixo de 24 use variant="compact". */
  size?: number;
  variant?: "elegant" | "compact";
  className?: string;
  /** Marca decorativa ao lado de texto que ja diz "Arsen" — dispensa rotulo. */
  decorative?: boolean;
}

export function ArsenMark({
  size = 32,
  variant = "elegant",
  className,
  decorative = false,
}: ArsenMarkProps) {
  const rotulo = decorative ? {} : { role: "img", "aria-label": "Arsen" };
  return (
    <svg
      viewBox="0 0 68 82"
      height={size}
      width={(size * 68) / 82}
      fill="currentColor"
      className={className}
      aria-hidden={decorative || undefined}
      {...rotulo}
    >
      {variant === "elegant" ? (
        <>
          <path d="M25.6,18 L29.25,18 L12,76 L6,76 Z" />
          <path d="M33,2 L37.5,2 L62,76 L49,76 Z" />
          <rect x="18" y="50" width="27" height="3.2" rx="1.6" />
          <rect x="1.5" y="76" width="15" height="3.4" rx="1.2" />
          <rect x="47" y="76" width="19" height="3.4" rx="1.2" />
        </>
      ) : (
        <>
          <path d="M24.4,24 L29.8,24 L12,79 L4.5,79 Z" />
          <path d="M32.5,2 L38.5,2 L63,79 L48,79 Z" />
          <rect x="18" y="49" width="28" height="5" rx="2.5" />
        </>
      )}
    </svg>
  );
}

interface ArsenLockupProps {
  /** horizontal: marca a esquerda do nome. vertical: marca acima. */
  orientation?: "horizontal" | "vertical";
  size?: number;
  /** Exibe "Plataforma clínica" sob o nome. */
  descriptor?: boolean;
  className?: string;
}

/**
 * Conjunto de marca e nome.
 *
 * O nome vai em caixa baixa com inicial maiuscula, e nao em caixa alta como no
 * logotipo antigo: caixa alta compete com o simbolo e envelhece pior. O
 * espacamento entre letras e generoso para acompanhar a leveza da letra.
 */
export function ArsenLockup({
  orientation = "horizontal",
  size = 32,
  descriptor = false,
  className,
}: ArsenLockupProps) {
  const vertical = orientation === "vertical";
  return (
    <div
      className={[
        "flex text-primary",
        vertical ? "flex-col items-center gap-2" : "flex-row items-center gap-3",
        className ?? "",
      ].join(" ")}
    >
      <ArsenMark size={size} decorative />
      <div className={vertical ? "text-center" : ""}>
        <span
          className="preserve-case block font-normal leading-none tracking-[0.06em]"
          style={{ fontSize: size * 0.72 }}
        >
          Arsen
        </span>
        {descriptor && (
          <span
            className="preserve-case mt-1 block leading-none tracking-[0.18em] text-muted-foreground"
            style={{ fontSize: Math.max(9, size * 0.24) }}
          >
            Plataforma clínica
          </span>
        )}
      </div>
    </div>
  );
}

export default ArsenMark;
