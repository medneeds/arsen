import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, ArrowRight, BedDouble, UserSearch } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import {
  SECTOR_TO_DEPARTMENT,
  SECTOR_DISPLAY,
  type Department,
} from "@/contexts/DepartmentContext";
import { formatBedDisplay } from "@/utils/bedNaming";
import { formatAge } from "@/lib/patientAge";

export interface PacienteEncontrado {
  id: string;
  name: string;
  bedNumber: string;
  sectorCode: string;
  sectorLabel: string;
  department: Department;
  medicalRecord: string | null;
  age: string | null;
}

interface Props {
  /** Entrar no setor do paciente, sem abrir o painel dele. */
  onIrParaSetor: (paciente: PacienteEncontrado) => void;
  /** Entrar direto no painel clinico daquele paciente. */
  onIrParaPaciente: (paciente: PacienteEncontrado) => void;
}

/**
 * Busca de paciente internado a partir da tela de entrada.
 *
 * Existe porque a pergunta real do plantonista muitas vezes nao e "em que setor
 * eu vou atuar", e sim "onde esta o paciente X". Sem isso ele teria de adivinhar
 * o setor, entrar, procurar no mapa e sair de novo se errasse.
 *
 * Consulta so dispara a partir de 3 caracteres e com debounce: a tela abre
 * instantanea e o banco so e consultado quando alguem realmente digita.
 *
 * Busca apenas LEITOS OCUPADOS. Um paciente que ja teve alta nao tem setor para
 * onde direcionar, e oferecer um destino invalido seria pior que nao achar.
 */
export function PatientQuickSearch({ onIrParaSetor, onIrParaPaciente }: Props) {
  const { currentHospital, currentState } = useHospital();
  const [termo, setTermo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<PacienteEncontrado[]>([]);
  const [buscou, setBuscou] = useState(false);
  const pedidoRef = useRef(0);

  const termoLimpo = termo.trim();
  const ativo = termoLimpo.length >= 3;

  useEffect(() => {
    if (!ativo || !currentHospital || !currentState) {
      setResultados([]);
      setBuscou(false);
      return;
    }

    const meuPedido = ++pedidoRef.current;
    setBuscando(true);

    const timer = window.setTimeout(async () => {
      // MIGRAÇÃO: patients (morta) → internacoes ativas + pacientes/leitos/setores.
      // Filtro OR entre colunas de tabelas unidas é frágil no PostgREST — busca
      // as internações ativas do hospital e filtra nome/prontuário no cliente.
      const termoLower = termoLimpo.toLowerCase();
      const { data, error } = await (supabase
        .from("internacoes")
        .select(`
          id, status,
          paciente:pacientes ( nome_completo, prontuario, data_nascimento ),
          leito:leitos!inner (
            numero,
            setor:setores!inner (
              tipo, nome,
              ala:alas!inner ( hospital_id )
            )
          )
        `) as any)
        .eq("status", "ativa")
        .eq("leito.setor.ala.hospital_id", currentHospital.id)
        .limit(200);

      // Resposta atrasada de uma busca antiga nao pode sobrescrever a atual.
      if (meuPedido !== pedidoRef.current) return;

      if (error) {
        console.error("[PatientQuickSearch] falha na busca:", error);
        setResultados([]);
      } else {
        const filtrados = (data ?? []).filter((p: any) => {
          const nome = (p.paciente?.nome_completo ?? "").toLowerCase();
          const prontuario = (p.paciente?.prontuario ?? "").toLowerCase();
          return nome.includes(termoLower) || prontuario.includes(termoLower);
        }).slice(0, 8);
        setResultados(
          filtrados.map((p: any) => {
            const codigo = (p.leito?.setor?.tipo as string) ?? "";
            return {
              id: p.id as string,
              name: (p.paciente?.nome_completo as string) || "Sem nome",
              bedNumber: (p.leito?.numero as string) ?? "",
              sectorCode: codigo,
              sectorLabel: p.leito?.setor?.nome || SECTOR_DISPLAY[codigo] || codigo,
              department: (SECTOR_TO_DEPARTMENT[codigo] ?? "") as Department,
              medicalRecord: (p.paciente?.prontuario as string) ?? null,
              age: formatAge(p.paciente?.data_nascimento) ?? null,
            };
          }),
        );
      }
      setBuscando(false);
      setBuscou(true);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [termoLimpo, ativo, currentHospital, currentState]);

  const dica = useMemo(() => {
    if (!termoLimpo) return null;
    if (!ativo) return "Digite ao menos 3 caracteres";
    return null;
  }, [termoLimpo, ativo]);

  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg flex items-center justify-center bg-primary/10 flex-shrink-0">
            <UserSearch className="h-4 w-4 text-primary" aria-hidden />
          </span>
          <label htmlFor="busca-paciente" className="preserve-case cursor-text">
            Procurar um paciente
          </label>
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="busca-paciente"
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Nome ou prontuário"
          autoComplete="off"
          className="h-11 pl-8 pr-8"
        />
        {buscando && (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-label="Buscando"
          />
        )}
      </div>

      {dica && <p className="mt-2 text-xs text-muted-foreground">{dica}</p>}

      {ativo && buscou && resultados.length === 0 && !buscando && (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhum paciente internado com esse nome ou prontuário. A busca cobre
          apenas leitos ocupados.
        </p>
      )}

      {resultados.length > 0 && (
        <ul className="mt-3 space-y-2">
          {resultados.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="preserve-case truncate text-sm font-medium text-foreground">
                    {p.name}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <BedDouble className="h-3.5 w-3.5" aria-hidden />
                      {formatBedDisplay(p.bedNumber)}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{p.sectorLabel}</span>
                    {p.medicalRecord && (
                      <>
                        <span aria-hidden>·</span>
                        <span>Prontuário {p.medicalRecord}</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => onIrParaSetor(p)}
                  >
                    Abrir {p.sectorLabel}
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => onIrParaPaciente(p)}
                  >
                    Painel do paciente
                    <ArrowRight className="h-3.5 w-3.5 ml-2" aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      </CardContent>
    </Card>
  );
}
