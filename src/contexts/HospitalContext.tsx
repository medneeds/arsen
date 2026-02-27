import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export function HospitalProvider({ children }: { children: ReactNode }) {
  const [currentState, setCurrentState] = useState<State | null>(null);
  const [currentHospital, setCurrentHospitalState] = useState<HospitalUnit | null>(null);
  const [states, setStates] = useState<State[]>([]);
  const [hospitals, setHospitals] = useState<HospitalUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatesAndHospitals = async () => {
    try {
      setIsLoading(true);
      
      // Fetch states
      const { data: statesData, error: statesError } = await supabase
        .from('states')
        .select('*')
        .order('name');

      if (statesError) throw statesError;
      setStates(statesData || []);

      // Fetch hospitals
      const { data: hospitalsData, error: hospitalsError } = await supabase
        .from('hospital_units')
        .select('*')
        .order('name');

      if (hospitalsError) throw hospitalsError;
      setHospitals(hospitalsData || []);

      // Try to restore from localStorage or set default
      const storedStateId = localStorage.getItem(STORAGE_KEY_STATE);
      const storedHospitalId = localStorage.getItem(STORAGE_KEY_HOSPITAL);

      if (storedStateId && storedHospitalId) {
        const state = statesData?.find(s => s.id === storedStateId);
        const hospital = hospitalsData?.find(h => h.id === storedHospitalId);
        
        if (state && hospital) {
          setCurrentState(state);
          setCurrentHospitalState(hospital);
          setIsLoading(false);
          return;
        }
      }

      // Set default to Maranhão and first hospital
      const maState = statesData?.find(s => s.abbreviation === 'MA');
      const defaultHospital = hospitalsData?.find(h => h.state_id === maState?.id) || hospitalsData?.[0];

      if (maState && defaultHospital) {
        setCurrentState(maState);
        setCurrentHospitalState(defaultHospital);
        localStorage.setItem(STORAGE_KEY_STATE, maState.id);
        localStorage.setItem(STORAGE_KEY_HOSPITAL, defaultHospital.id);
      }
    } catch (error) {
      console.error('Error fetching states and hospitals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setCurrentHospital = (hospital: HospitalUnit) => {
    setCurrentHospitalState(hospital);
    localStorage.setItem(STORAGE_KEY_HOSPITAL, hospital.id);
    
    // Update state based on hospital
    const state = states.find(s => s.id === hospital.state_id);
    if (state) {
      setCurrentState(state);
      localStorage.setItem(STORAGE_KEY_STATE, state.id);
    }
  };

  useEffect(() => {
    fetchStatesAndHospitals();
  }, []);

  return (
    <HospitalContext.Provider
      value={{
        currentState,
        currentHospital,
        states,
        hospitals,
        isLoading,
        setCurrentHospital,
        fetchStatesAndHospitals,
      }}
    >
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
