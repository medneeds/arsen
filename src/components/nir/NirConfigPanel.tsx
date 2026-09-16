import { useMemo } from "react";
import { Settings2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BedLike {
  status?: string | null;
  bed_number?: string | null;
  bedNumber?: string | null;
}

interface NirConfigPanelProps {
  /** Leitos existentes no banco, agrupados pelo NOME REAL do setor (setores.nome). */
  bedsBySector: Record<string, BedLike[]>;
}

// Rótulos e ordem de exibição dos status do banco (CHECK leitos.status).
const STATUS_ORDER = ["livre", "ocupado", "higienizacao", "bloqueado", "reservado"] as const;
const STATUS_LABEL: Record<string, string> = {
  livre: "Livres",
  ocupado: "Ocupados",
  higienizacao: "Higienização",
  bloqueado: "Bloqueados",
  reservado: "Reservados",
};
const STATUS_CLASS: Record<string, string> = {
  livre: "text-emerald-600 dark:text-emerald-400",
  ocupado: "text-sky-600 dark:text-sky-400",
  higienizacao: "text-amber-600 dark:text-amber-500",
  bloqueado: "text-destructive",
  reservado: "text-violet-600 dark:text-violet-400",
};

const isExtra = (b: BedLike) =>
  ((b.bed_number || b.bedNumber || "") as string).toString().toUpperCase().startsWith("EXTRA");

/**
 * Configuração — estrutura de leitos por setor.
 *
 * MIGRAÇÃO: este painel comparava a capacidade prevista em `SECTOR_BED_CONFIG`
 * (hardcoded, com os códigos antigos red/yellow/ucc/neuro_01…) contra os leitos
 * existentes. No schema novo os leitos vivem em `leitos` agrupados pelo NOME
 * real do setor (alas → setores), e `setores` NÃO tem coluna de capacidade
 * prevista — então aquela comparação nunca casava (mostrava todo setor como
 * "Faltam N" ou "Sem configuração") e passou a ser lixo.
 *
 * A "capacidade prevista" foi DEGRADADA (não há fonte no banco). O painel agora
 * é um RETRATO FIEL da estrutura real: por setor, quantos leitos existem e como
 * estão distribuídos por status. É leitura — cadastro/bloqueio entram depois.
 */
export function NirConfigPanel({ bedsBySector }: NirConfigPanelProps) {
  const linhas = useMemo(() => {
    return Object.entries(bedsBySector)
      .filter(([nome]) => nome) // ignora chave vazia (leito sem setor)
      .map(([nome, leitos]) => {
        const regulares = leitos.filter((b) => !isExtra(b));
        const extras = leitos.length - regulares.length;
        const porStatus: Record<string, number> = {};
        for (const b of regulares) {
          const s = (b.status || "").toString();
          porStatus[s] = (porStatus[s] ?? 0) + 1;
        }
        return { nome, total: regulares.length, extras, porStatus };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [bedsBySector]);

  const totalLeitos = useMemo(
    () => linhas.reduce((acc, l) => acc + l.total + l.extras, 0),
    [linhas],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          Configuração — estrutura de leitos
        </h3>
        <Badge variant="outline" className="text-[11px]">
          {linhas.length === 0
            ? "Nenhum leito cadastrado"
            : `${linhas.length} setor${linhas.length > 1 ? "es" : ""} · ${totalLeitos} leito${totalLeitos !== 1 ? "s" : ""}`}
        </Badge>
      </div>

      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
        <span>
          Estrutura real dos leitos por setor, direto do banco (alas → setores →
          leitos). <strong>Este painel é leitura</strong>: cadastro e bloqueio
          programado entram depois, sobre um retrato conferido.
        </span>
      </div>

      {linhas.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          Nenhum leito encontrado para os setores deste hospital.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium py-2 px-2">Setor</th>
                <th className="text-right font-medium py-2 px-2">Leitos</th>
                {STATUS_ORDER.map((s) => (
                  <th key={s} className="text-right font-medium py-2 px-2">{STATUS_LABEL[s]}</th>
                ))}
                <th className="text-right font-medium py-2 px-2">Extras</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.nome} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium text-foreground">{l.nome}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-medium text-foreground">{l.total}</td>
                  {STATUS_ORDER.map((s) => {
                    const n = l.porStatus[s] ?? 0;
                    return (
                      <td
                        key={s}
                        className={cn(
                          "py-2 px-2 text-right tabular-nums",
                          n > 0 ? STATUS_CLASS[s] : "text-muted-foreground/40",
                        )}
                      >
                        {n}
                      </td>
                    );
                  })}
                  <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                    {l.extras > 0 ? `+${l.extras}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        <strong>Leitos</strong> conta os regulares do setor. <strong>Extras</strong>{" "}
        são macas adicionais (numeração EXTRA), legítimas em sobrecarga. A soma por
        status reflete a ocupação atual: leito ocupado deriva de internação ativa.
      </p>
    </div>
  );
}
