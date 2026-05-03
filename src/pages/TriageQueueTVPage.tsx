import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, User, Volume2 } from "lucide-react";
import { whitelabel } from "@/config/whitelabel";
import socorraoLogo from "@/assets/socorrao-logo.jpg";
import socorraoCross from "@/assets/socorrao-cross-logo.png";

interface QueuePatient {
  id: string;
  encounter_code: string;
  patient_name: string;
  triage_status: string;
  destination_sector: string;
  called_at?: string;
  created_at: string;
}

const COLORS = whitelabel.theme.institutionalColors;

const TriageQueueTVPage = () => {
  const { currentHospital } = useHospital();
  const [queue, setQueue] = useState<QueuePatient[]>([]);
  const [calledPatient, setCalledPatient] = useState<QueuePatient | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

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
      .on("postgres_changes", {
        event: "*", schema: "public", table: "patient_encounters",
        filter: `hospital_unit_id=eq.${currentHospital.id}`,
      }, () => loadQueue())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentHospital?.id]);

  const waiting = queue.filter(p => p.triage_status === "aguardando_chamada");

  return (
    <div className="min-h-screen flex flex-col text-white" style={{
      background: `linear-gradient(135deg, ${COLORS.blue} 0%, #002d5c 50%, #001a3d 100%)`,
    }}>
      {/* ─── Header institucional Norma Zero ─── */}
      <header className="bg-white text-slate-900 shadow-lg">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-6 px-8 py-4">
          <img src={socorraoLogo} alt="Socorrão I" className="h-16 w-16 object-contain rounded-md" />
          <div className="text-center leading-tight">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              {whitelabel.institution.prefeitura}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              {whitelabel.institution.secretaria}
            </p>
            <p className="text-xl font-bold uppercase mt-1" style={{ color: COLORS.blue }}>
              {whitelabel.institution.hospitalFullName}
            </p>
          </div>
          <img src={socorraoCross} alt="Cruz HMDM" className="h-16 w-16 object-contain" />
        </div>
        {/* Barra cruz colorida — identidade Norma Zero */}
        <div className="grid grid-cols-5 h-2">
          <div style={{ background: COLORS.red }} />
          <div style={{ background: COLORS.orange }} />
          <div style={{ background: COLORS.yellow }} />
          <div style={{ background: COLORS.green }} />
          <div style={{ background: COLORS.blue }} />
        </div>
      </header>

      {/* ─── Sub-header com título e relógio ─── */}
      <div className="flex items-center justify-between px-8 py-4 bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight uppercase">
            Painel de Chamada — Triagem
          </h1>
          <p className="text-white/60 text-sm uppercase tracking-wider">
            Recepção · Classificação de Risco
          </p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-mono font-bold tabular-nums">
            {format(currentTime, "HH:mm:ss")}
          </p>
          <p className="text-white/60 text-sm uppercase">
            {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* ─── Paciente Chamado ─── */}
      <AnimatePresence mode="wait">
        {calledPatient && (
          <motion.div
            key={calledPatient.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mx-8 mt-6 rounded-2xl overflow-hidden border-2 shadow-2xl"
            style={{ borderColor: COLORS.yellow, background: "rgba(255,255,255,0.06)" }}
          >
            <div className="px-8 py-6">
              <div className="flex items-center gap-3 mb-3">
                <Volume2 className="h-6 w-6 animate-pulse" style={{ color: COLORS.yellow }} />
                <span className="font-bold text-xl uppercase tracking-widest" style={{ color: COLORS.yellow }}>
                  Chamando Agora
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="patient-id text-5xl font-bold uppercase">{calledPatient.patient_name}</p>
                  <p className="text-2xl text-white/70 font-mono mt-2">{calledPatient.encounter_code}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/60 uppercase text-sm tracking-wider">Dirija-se à</p>
                  <p className="text-3xl font-bold uppercase" style={{ color: COLORS.yellow }}>
                    Triagem
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-5 h-1.5">
              <div style={{ background: COLORS.red }} />
              <div style={{ background: COLORS.orange }} />
              <div style={{ background: COLORS.yellow }} />
              <div style={{ background: COLORS.green }} />
              <div style={{ background: COLORS.blue }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Fila de Espera ─── */}
      <div className="flex-1 px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white/80 text-base font-semibold uppercase tracking-widest">
            Fila de Espera
          </h2>
          <span
            className="px-3 py-1 rounded-full text-sm font-bold tabular-nums"
            style={{ background: COLORS.yellow, color: "#1a1a1a" }}
          >
            {waiting.length} {waiting.length === 1 ? "paciente" : "pacientes"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence>
            {waiting.map((patient, index) => (
              <motion.div
                key={patient.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ delay: index * 0.04 }}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl backdrop-blur-sm border",
                  "bg-white/8 border-white/15 hover:bg-white/12 transition-colors"
                )}
              >
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
                  style={{ background: COLORS.blue, color: "white" }}
                >
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="patient-id font-semibold truncate text-lg uppercase">
                    {patient.patient_name}
                  </p>
                  <div className="flex items-center gap-3 text-sm text-white/60">
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

        {waiting.length === 0 && !calledPatient && (
          <div className="text-center py-20 text-white/40">
            <User className="h-20 w-20 mx-auto mb-4 opacity-30" />
            <p className="text-2xl uppercase tracking-wider">Nenhum paciente na fila</p>
          </div>
        )}
      </div>

      {/* ─── Footer institucional ─── */}
      <footer className="px-8 py-3 bg-black/40 border-t border-white/10 flex items-center justify-between text-xs text-white/50 uppercase tracking-wider">
        <span>{whitelabel.institution.hospitalAbbreviation} · {whitelabel.platform.fullName}</span>
        <span>Norma Zero · {whitelabel.compliance.normaZeroCode} v{whitelabel.compliance.normaZeroVersion}</span>
      </footer>
    </div>
  );
};

export default TriageQueueTVPage;
