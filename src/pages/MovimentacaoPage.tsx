import { useEffect } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { MovimentacaoForm } from "@/components/movimentacao/MovimentacaoForm";
import type { Patient } from "@/types/patient";
import type { AnyMovementType } from "@/data/movementFlow";

/**
 * Perfis claramente NAO clinicos (porta / recepcao / administrativo) nao podem
 * sinalizar uma movimentacao/desfecho clinico. MESMO criterio da AdmissaoPage:
 * bloqueia so o que e inequivocamente de porta/recepcao e permite todos os
 * demais perfis que hoje ja conseguem sinalizar pelo Painel Clinico / Hub.
 */
const DENIED_ACCESS_PROFILES = ["administrativo", "porta", "recepcao"];

interface MovimentacaoLocationState {
  /**
   * Snapshot COMPLETO do paciente. A escrita da movimentacao consome o objeto
   * inteiro (grava `patient_snapshot: patient` em logs_auditoria e le
   * admissionStatus para o painel de sinalizacao), entao os search params
   * sozinhos nao bastam. Sem este snapshot (F5 / deep-link) a pagina volta,
   * em vez de reconstruir um paciente parcial — lado seguro.
   */
  patient?: Patient;
  /** Subtipo pre-selecionado (ex.: aberto ja no formulario de um subtipo). */
  subtype?: AnyMovementType | null;
  returnTo?: string;
}

export default function MovimentacaoPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const queryClient = useQueryClient();

  // ─── Contexto do paciente — os MESMOS search params das outras paginas de
  // modulo (patientSector = CODIGO do setor). Servem para as abas / usePatientKey.
  const patientId = searchParams.get("patientId") || "";
  const state = (location.state ?? null) as MovimentacaoLocationState | null;
  const patient = state?.patient ?? null;

  // ─── Guarda de permissao — MESMO mecanismo da AdmissaoPage (access_profile em
  // localStorage) + role do AuthContext. Perfil de porta/recepcao nao sinaliza.
  const accessProfile = typeof window !== "undefined"
    ? (localStorage.getItem("access_profile") || "medico")
    : "medico";
  const denied = DENIED_ACCESS_PROFILES.includes(accessProfile) || role === "porta";

  const returnTo = state?.returnTo || (patientId ? `/paciente?patientId=${patientId}` : "/mapa");

  // ─── Guarda de permissao: perfil de porta/recepcao -> acesso negado
  useEffect(() => {
    if (denied) {
      toast.error("Acesso negado: seu perfil não pode sinalizar movimentações clínicas");
      navigate(returnTo, { replace: true });
    }
  }, [denied, navigate, returnTo]);

  // ─── Guarda de contexto: sem o snapshot COMPLETO do paciente (F5 / deep-link)
  // a pagina volta. A escrita depende do objeto inteiro; reconstruir parcial dos
  // params vazaria snapshot incompleto para a auditoria — lado seguro.
  useEffect(() => {
    if (!denied && !patient) {
      toast.info("Abra a movimentação pelo painel do paciente");
      navigate(returnTo, { replace: true });
    }
  }, [denied, patient, navigate, returnTo]);

  if (denied || !patient) return null;

  return (
    <div className="mx-auto w-full max-w-[55rem] px-4 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(returnTo)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-released/15 text-released-on-soft">
            <ArrowRightLeft className="h-4 w-4" />
          </span>
          <h1 className="text-lg font-semibold uppercase tracking-wider text-foreground">Movimentação</h1>
        </div>
      </div>

      <div className="rounded-lg border bg-background overflow-hidden">
        <MovimentacaoForm
          patient={patient}
          movementType={state?.subtype ?? null}
          onClose={() => navigate(returnTo)}
          onSuccess={() => {
            // Preserva o comportamento pos-sinalizacao dos gatilhos originais
            // (cockpit / hub): invalida as MESMAS chaves que o dialog invalidava
            // no onSuccess, para que a tela de origem — cockpit ao lado, mapa —
            // nao volte com status defasado (react-query aqui tem refetchOnMount
            // false + staleTime 5min). Nenhuma escrita nova: so refresh de cache.
            queryClient.invalidateQueries({ queryKey: ["discharge-docs"] });
            queryClient.invalidateQueries({ queryKey: ["patients"] });
            queryClient.invalidateQueries({ queryKey: ["patient-movements"] });
            queryClient.invalidateQueries({ queryKey: ["internal-transfer-requests"] });
          }}
        />
      </div>
    </div>
  );
}
