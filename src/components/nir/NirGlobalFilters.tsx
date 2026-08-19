import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Calendar, Building2, RefreshCw } from "lucide-react";
import type { NirFilters, NirPeriod, SectorScope } from "@/hooks/useNirMetrics";

interface Props {
  filters: NirFilters;
  onChange: (next: NirFilters) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

const PERIODS: { key: NirPeriod; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
];

const SCOPES: { key: SectorScope; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "uti", label: "UTI/UCI" },
  { key: "enfermaria", label: "Enfermaria" },
  { key: "emergencia", label: "Emergência" },
];


export function NirGlobalFilters({ filters, onChange, onRefresh, isLoading }: Props) {
  return (
    /*
      Encostado nos KPIs de propósito: borda superior removida e cantos de cima
      retos, para ler como o RODAPÉ DE CONTROLE da faixa de indicadores, e não
      como mais um bloco solto da página. Era isso que fazia os filtros
      parecerem sem dono.
    */
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-b-lg border border-t-0 bg-card -mt-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden sm:inline">
        Recortar indicadores:
      </span>
      {/* Período */}
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Período:</span>
        <div className="flex rounded-md border overflow-hidden">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => onChange({ ...filters, period: p.key })}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium transition-colors",
                filters.period === p.key ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/*
        Estes controles recortam os INDICADORES acima — não a página.

        A PRIORIDADE saiu: dos oito KPIs, ela tocava apenas "Pendentes"; os
        outros sete vêm de LEITOS, não de solicitações. Ou seja, mexer nela
        parecia recortar o painel e quase nada mudava. E a fila de solicitações,
        que é onde prioridade importa de verdade, já tem abas próprias por tipo.

        Ficam os dois recortes que o gestor descreveu: PERÍODO (comportamento do
        hospital no tempo) e ESCOPO (por natureza de setor).
      */}
      {/*
        "Escopo", não "Setor".

        O cabeçalho ganhou o seletor HIERÁRQUICO, que escolhe UM setor
        específico. Este controle é outra coisa: agrupa por natureza
        assistencial (UTI/UCI, Enfermaria, Emergência) para recortar os
        indicadores. Dois controles chamados "Setor" na mesma tela é o que
        tornava o cabeçalho confuso — são granularidades diferentes e agora
        dizem isso no rótulo.
      */}
      <div className="flex items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Escopo:</span>
        <div className="flex rounded-md border overflow-hidden">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              onClick={() => onChange({ ...filters, sectorScope: s.key })}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium transition-colors",
                filters.sectorScope === s.key ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>


      <div className="flex-1" />

      <Badge variant="outline" className="text-[10px] gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Atualização automática 60s
      </Badge>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading} className="h-7">
        <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isLoading && "animate-spin")} />
        Atualizar
      </Button>
    </div>
  );
}
