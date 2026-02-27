import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function usePendingPasswordResets() {
  const { user, role } = useAuth();
  
  // Check if user has admin access
  const isAdmin = role === "admin" || user?.email === "coordenador@sistema.local" || user?.email === "artur.batista@sistema.local";

  const { data: pendingCount = 0, refetch } = useQuery({
    queryKey: ["pending-password-resets-count"],
    queryFn: async () => {
      if (!isAdmin) return 0;
      
      const { count, error } = await supabase
        .from("password_reset_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      if (error) {
        console.error("Error fetching pending password resets:", error);
        return 0;
      }

      return count || 0;
    },
    enabled: isAdmin,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  return {
    pendingCount,
    refetch,
    isAdmin,
  };
}
