import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Settings2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SECTOR_BED_CONFIG } from "@/utils/bedNaming";

interface NirConfigPanelProps {
  /** Leitos existentes no banco, agrupados por código de setor. */
  bedsBySector: Record<string, unknown[]>;
}

/**
 * Configuração — estrutura de leitos por setor.
 *
 * POR QUE ESTE PAINEL COMEÇA COMO DIAGNÓSTICO, E NÃO COMO CADASTRO:
 *
 * A capacidade por setor JÁ EXISTE no código, em `SECTOR_BED_CONFIG`
 * (src/utils/bedNaming.ts): prefixo, quantidade de leitos regulares e número
 * inicial. É ela que governa a numeração quando alguém cria um leito.
 *
 * Mas os LEITOS em si são linhas na tabela `patients` — e as duas coisas podem
 * divergir. Foi exatamente o que apareceu ao liberar os setores novos: o Neuro
 * 01 mostrava dez leitos L01–L10 que ninguém reconhecia como a estrutura real
 * da unidade.
 *
 * Cadastrar leito sem antes ver essa divergência seria construir por cima de
 * um desalinhamento que ninguém mediu. Este painel mede primeiro: mostra, por
 * setor, quantos leitos a configuração prevê e quantos existem de fato.
 *
 * O cadastro e o bloqueio programado entram depois, sobre um retrato confiável.
 */
export function NirConfigPanel({ bedsBySector }: NirConfigPanelProps) {
  const linhas = useMemo(() => {
    const setores = new Set([
      ...Object.keys(SECTOR_BED_CONFIG),
      ...Object.keys(bedsBySector),
    ]);
    return Array.from(setores)
      .map((codigo) => {
        const cfg = SECTOR_BED_CONFIG[codigo];
        const reais = bedsBySector[codigo]?.length ?? 0;
        const previstos = cfg?.maxRegularBeds ?? null;
        return {
          codigo,
          rotulo: cfg?.label ?? codigo,
          prefixo: cfg?.prefix ?? "—",
          inicio: cfg?.startNumber ?? null,
          previstos,
          reais,
          // Extras são legítimos (maca extra); faltar leito é que chama atenção.
          diferenca: previstos === null ? null : reais - previstos,
          semConfig: !cfg,
        };
      })
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  }, [bedsBySector]);

  const divergentes = linhas.filter((l) => l.semConfig || (l.diferenca !== null && l.diferenca !== 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          Configuração — estrutura de leitos
        </h3>
        <Badge variant="outline" className="text-[11px]">
          {divergentes.length === 0
            ? "Todos os setores conferem"
            : `${divergentes.length} setor${divergentes.length > 1 ? "es" : ""} a revisar`}
        </Badge>
      </div>

      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
        <span>
          A capacidade prevista vive na configuração da plataforma; os leitos são
          registros do banco. Quando os dois divergem, o mapa mostra leitos que a
          unidade não reconhece — ou esconde leitos que existem.{" "}
          <strong>Este painel é leitura</strong>: cadastro e bloqueio programado
          entram depois, sobre um retrato conferido.
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left font-medium py-2 px-2">Setor</th>
              <th className="text-left font-medium py-2 px-2">Numeração</th>
              <th className="text-right font-medium py-2 px-2">Previstos</th>
              <th className="text-right font-medium py-2 px-2">Existentes</th>
              <th className="text-left font-medium py-2 px-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const faltando = l.diferenca !== null && l.diferenca < 0;
              const sobrando = l.diferenca !== null && l.diferenca > 0;
              return (
                <tr key={l.codigo} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium text-foreground">{l.rotulo}</td>
                  <td className="py-2 px-2 font-mono text-muted-foreground">
                    {l.prefixo}
                    {l.inicio !== null && (
                      <span className="opacity-60">
                        {String(l.inicio).padStart(2, "0")}…
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                    {l.previstos ?? "—"}
                  </td>
                  <td className={cn(
                    "py-2 px-2 text-right tabular-nums font-medium",
                    faltando && "text-amber-600 dark:text-amber-500",
                    sobrando && "text-sky-600 dark:text-sky-400",
                  )}>
                    {l.reais}
                  </td>
                  <td className="py-2 px-2">
                    {l.semConfig ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
                        <AlertTriangle className="h-3 w-3" /> Sem configuração
                      </span>
                    ) : faltando ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-500">
                        <AlertTriangle className="h-3 w-3" /> Faltam {Math.abs(l.diferenca!)}
                      </span>
                    ) : sobrando ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400">
                        +{l.diferenca} além do previsto
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Confere
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Leitos <strong>além do previsto</strong> costumam ser macas extras, e são
        legítimos. <strong>Faltar</strong> leito significa que o setor tem menos
        registros do que a unidade opera — e é o caso que merece conferência.{" "}
        <strong>Sem configuração</strong> significa que existem leitos gravados
        num setor que a plataforma não conhece.
      </p>
    </div>
  );
}
