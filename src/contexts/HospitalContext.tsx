import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeSetItem } from "@/lib/safeStorage";
import { useAuth } from "@/contexts/AuthContext";

export interface State {
  id: string;
  name: string;
  abbreviation: string;
}

export interface HospitalUnit {
  id: string;
  name: string;
  state_id: string;
  address: string | null;
}

interface HospitalContextType {
  currentState: State | null;
  currentHospital: HospitalUnit | null;
  states: State[];
  hospitals: HospitalUnit[];
  isLoading: boolean;
  setCurrentHospital: (hospital: HospitalUnit) => void;
  fetchStatesAndHospitals: () => Promise<void>;
}

const HospitalContext = createContext<HospitalContextType | undefined>(undefined);

const STORAGE_KEY_STATE = "selected_state_id";
const STORAGE_KEY_HOSPITAL = "selected_hospital_id";

// MIGRAÇÃO: o schema novo não tem tabela de estados geográficos (`states`/`estados`) nem
// coluna de estado em `hospitais`. A interface exportada (State, currentState, states, HospitalUnit)
// é mantida idêntica porque ~100 consumidores dependem dela. `states` degrada para [] e
// `currentState` recebe um placeholder não-nulo para não quebrar consumidores que fazem
// `currentState.id` sem guarda. `HospitalUnit.state_id` passa a apontar para esse placeholder.
const DEFAULT_STATE: State = { id: "default", name: "Brasil", abbreviation: "BR" };

export function HospitalProvider({ children }: { children: ReactNode }) {
  // Reage à sessão: a query de `hospitais` depende de RLS (sessão autenticada).
  const { user } = useAuth();
  const [currentState, setCurrentState] = useState<State | null>(DEFAULT_STATE);
  const [currentHospital, setCurrentHospitalState] = useState<HospitalUnit | null>(null);
  const [states, setStates] = useState<State[]>([]);
  const [hospitals, setHospitals] = useState<HospitalUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatesAndHospitals = useCallback(async () => {
    try {
      setIsLoading(true);

      // MIGRAÇÃO: `states` não existe no schema novo — mantido vazio (degradado).
      setStates([]);
      setCurrentState(DEFAULT_STATE);

      // hospital_units → hospitais. Mapeia colunas novas (nome, endereco) para os
      // nomes de campo antigos (name, address) que a interface expõe.
      const { data: hospitaisData, error: hospitaisError } = await supabase
        .from("hospitais")
        .select("id, nome, endereco, ativo")
        .eq("ativo", true)
        .order("nome");

      if (hospitaisError) throw hospitaisError;

      const mappedHospitals: HospitalUnit[] = (hospitaisData || []).map((h) => ({
        id: h.id,
        name: h.nome,
        state_id: DEFAULT_STATE.id, // MIGRAÇÃO: sem estado no schema novo
        address: h.endereco,
      }));
      setHospitals(mappedHospitals);

      // Restaura o hospital selecionado do localStorage, ou usa o primeiro.
      const storedHospitalId = localStorage.getItem(STORAGE_KEY_HOSPITAL);
      const restored = storedHospitalId
        ? mappedHospitals.find((h) => h.id === storedHospitalId)
        : undefined;
      const defaultHospital = restored || mappedHospitals[0];

      if (defaultHospital) {
        setCurrentHospitalState(defaultHospital);
        safeSetItem(STORAGE_KEY_HOSPITAL, defaultHospital.id);
        safeSetItem(STORAGE_KEY_STATE, DEFAULT_STATE.id);
      }
    } catch (error) {
      console.error("Error fetching hospitals:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setCurrentHospital = useCallback((hospital: HospitalUnit) => {
    setCurrentHospitalState(hospital);
    safeSetItem(STORAGE_KEY_HOSPITAL, hospital.id);
    // MIGRAÇÃO: sem estado por hospital — currentState permanece no placeholder.
    setCurrentState(DEFAULT_STATE);
    safeSetItem(STORAGE_KEY_STATE, DEFAULT_STATE.id);
  }, []);

  // BUGFIX (primeiro login): antes buscava hospitais 1x no mount — que ocorre no
  // LOAD do app (o provider envolve a página de login), ANTES da sessão existir.
  // A query caía na RLS sem sessão e voltava vazia → currentHospital ficava null
  // e o mapa/painel giravam pra sempre, só destravando no reload (sessão já
  // persistida). Agora rebusca QUANDO o usuário autentica (user.id muda de null
  // para um id). Sem sessão, não há o que buscar — não deixa o loading preso.
  useEffect(() => {
    if (user) {
      fetchStatesAndHospitals();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Memoizado: criado inline, o objeto era novo a cada render e os 70
  // consumidores de useHospital re-renderizavam junto sem motivo.
  const valor = useMemo(
    () => ({ currentState, currentHospital, states, hospitals, isLoading, setCurrentHospital, fetchStatesAndHospitals }),
    [currentState, currentHospital, states, hospitals, isLoading, setCurrentHospital, fetchStatesAndHospitals],
  );

  return (
    <HospitalContext.Provider value={valor}>
      {children}
    </HospitalContext.Provider>
  );
}

export function useHospital() {
  const context = useContext(HospitalContext);
  if (context === undefined) {
    throw new Error("useHospital must be used within a HospitalProvider");
  }
  return context;
}
