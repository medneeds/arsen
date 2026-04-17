import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Clock, User, Volume2 } from "lucide-react";

interface QueuePatient {
  id: string;
  encounter_code: string;
  patient_name: string;
  triage_status: string;
  destination_sector: string;
  called_at?: string;
  created_at: string;
}

const TriageQueueTVPage = () => {
  const { currentHospital } = useHospital();
  const [queue, setQueue] = useState<QueuePatient[]>([]);
  const [calledPatient, setCalledPatient] = useState<QueuePatient | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load queue and subscribe to realtime
  useEffect(() => {
    if (!currentHospital?.id) return;

    const loadQueue = async () => {
      const { data } = await supabase
        .from("patient_encounters")
        .select("id, encounter_code, patient_name, triage_status, destination_sector, called_at, created_at")
        .eq("hospital_unit_id", currentHospital.id)
        .eq("destination_sector", "triagem")
        .in("triage_status", ["aguardando_chamada", "chamado"])
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(20);

      if (data) {
        setQueue(data as QueuePatient[]);
        const called = (data as QueuePatient[]).find(p => p.triage_status === "chamado");
        if (called) setCalledPatient(called);
      }
    };

    loadQueue();

    const channel = supabase
      .channel("triage-queue-tv")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patient_encounters",
          filter: `hospital_unit_id=eq.${currentHospital.id}`,
        },
        () => loadQueue()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentHospital?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-black/30">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Painel de Chamada — Triagem</h1>
            <p className="text-white/50 text-sm">{currentHospital?.name || "Hospital"}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-mono font-bold tabular-nums">
            {format(currentTime, "HH:mm:ss")}
          </p>
          <p className="text-white/50 text-sm">
            {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
      </header>

      {/* Called Patient - Featured */}
      <AnimatePresence mode="wait">
        {calledPatient && (
          <motion.div
            key={calledPatient.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="mx-8 mt-6 p-8 rounded-2xl bg-gradient-to-r from-primary/30 to-primary/10 border-2 border-primary/40"
          >
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="h-5 w-5 text-primary animate-pulse" />
              <span className="text-primary font-semibold text-lg">CHAMANDO</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="patient-id text-4xl font-bold">{calledPatient.patient_name}</p>
                <p className="text-xl text-white/60 font-mono mt-1">{calledPatient.encounter_code}</p>
              </div>
              <div className="text-right">
                <p className="text-white/50">Dirija-se à</p>
                <p className="text-2xl font-bold text-primary">TRIAGEM</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Queue List */}
      <div className="flex-1 px-8 py-6">
        <h2 className="text-white/40 text-sm font-semibold uppercase tracking-widest mb-4">
          Fila de Espera ({queue.filter(p => p.triage_status === "aguardando_chamada").length} pacientes)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence>
            {queue
              .filter(p => p.triage_status === "aguardando_chamada")
              .map((patient, index) => (
                <motion.div
                  key={patient.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-lg font-bold">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="patient-id font-semibold truncate">{patient.patient_name}</p>
                    <div className="flex items-center gap-2 text-sm text-white/40">
                      <span className="font-mono">{patient.encounter_code}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(patient.created_at), "HH:mm")}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
          </AnimatePresence>
        </div>

        {queue.filter(p => p.triage_status === "aguardando_chamada").length === 0 && !calledPatient && (
          <div className="text-center py-20 text-white/30">
            <User className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-xl">Nenhum paciente na fila</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TriageQueueTVPage;
