import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type IpAccessResult = {
  loading: boolean;
  allowed: boolean;
  ip: string | null;
  reason: string | null;
};

const cache = new Map<string, { at: number; result: IpAccessResult }>();
const TTL = 60_000; // 60s

export function useIpAccess(moduleKey: string | null | undefined): IpAccessResult {
  const [state, setState] = useState<IpAccessResult>({
    loading: true,
    allowed: false,
    ip: null,
    reason: null,
  });

  useEffect(() => {
    if (!moduleKey) {
      setState({ loading: false, allowed: true, ip: null, reason: "no_module" });
      return;
    }
    let cancelled = false;

    const cached = cache.get(moduleKey);
    if (cached && Date.now() - cached.at < TTL) {
      setState(cached.result);
      return;
    }

    setState((s) => ({ ...s, loading: true }));
    supabase.functions
      .invoke("check-ip-access", { body: { module: moduleKey } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          const r: IpAccessResult = {
            loading: false,
            allowed: false,
            ip: null,
            reason: "request_failed",
          };
          setState(r);
          return;
        }
        const r: IpAccessResult = {
          loading: false,
          allowed: !!data?.allowed,
          ip: data?.ip ?? null,
          reason: data?.reason ?? null,
        };
        cache.set(moduleKey, { at: Date.now(), result: r });
        setState(r);
      });

    return () => {
      cancelled = true;
    };
  }, [moduleKey]);

  return state;
}
