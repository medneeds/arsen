import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseDate, calculateDetailedAge } from "@/utils/pediatricAgeFormat";

export function useAgeCalculator(isPediatric: boolean = false) {
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateAge = async (input: string): Promise<string | null> => {
    if (!input.trim()) return null;

    setIsCalculating(true);
    try {
      // Se não for setor pediátrico, fazer cálculo simples
      if (!isPediatric) {
        const trimmed = input.trim();
        
        // Se for um número, retornar como anos
        if (/^\d+$/.test(trimmed)) {
          const age = parseInt(trimmed);
          return age === 1 ? "1 ano" : `${age} anos`;
        }
        
        // Tentar parsear como data de nascimento
        const birthDate = parseDate(trimmed);
        if (birthDate) {
          const ageData = calculateDetailedAge(birthDate);
          const years = ageData.years || 0;
          return years === 1 ? "1 ANO" : `${years} ANOS`;
        }
        
        // Se não conseguir parsear, retornar como está em uppercase
        return trimmed.toUpperCase();
      }

      // Para setor pediátrico, usar a edge function
      const { data, error } = await supabase.functions.invoke("format-pediatric-age", {
        body: { input: input.trim() },
      });

      if (error) throw error;

      if (data?.formatted_age) {
        console.log("Idade formatada:", data.formatted_age, "Categoria:", data.age_category);
        return data.formatted_age;
      }

      throw new Error("Resposta inválida da formatação de idade");
    } catch (error) {
      console.error("Erro ao formatar idade:", error);
      toast.error("Erro ao formatar idade");
      return null;
    } finally {
      setIsCalculating(false);
    }
  };

  return { calculateAge, isCalculating };
}
