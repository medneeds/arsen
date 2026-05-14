import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Activity, TrendingUp, Bed, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface SapsConfirmationProps {
  patientName: string;
  bedNumber: string;
  sectorLabel: string;
  totalScore: number;
  predictedMortality: number;
  patientId?: string | null;
  sectorCode?: string;
  age?: string | null;
  mode?: "admission" | "validation";
  onComplete: () => void;
}

export function SapsConfirmationScreen({
  patientName,
  bedNumber,
  sectorLabel,
  totalScore,
  predictedMortality,
  patientId,
  sectorCode,
  age,
  mode = "admission",
  onComplete,
}: SapsConfirmationProps) {
  const navigate = useNavigate();
  const isValidation = mode === "validation";
  const [countdown, setCountdown] = useState(3);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 100 / 30; // 30 ticks in 3 seconds
      });
    }, 100);

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const timeout = setTimeout(() => {
      if (patientId) {
        const params = new URLSearchParams({
          patientId,
          patientName,
          patientBed: bedNumber,
        });
        if (sectorCode) params.set("patientSector", sectorCode);
        if (age) params.set("patientAge", age);
        navigate(`/paciente?${params.toString()}`);
      } else {
        navigate("/painel-clinico");
      }
      onComplete();
    }, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(countdownInterval);
      clearTimeout(timeout);
    };
  }, [navigate, onComplete, patientId, patientName, bedNumber, sectorCode, age]);

  const getMortalityColor = (m: number) => {
    if (m < 10) return "text-emerald-500";
    if (m < 25) return "text-yellow-500";
    if (m < 50) return "text-orange-500";
    return "text-red-500";
  };

  const getMortalityBg = (m: number) => {
    if (m < 10) return "bg-emerald-500/10 border-emerald-500/20";
    if (m < 25) return "bg-yellow-500/10 border-yellow-500/20";
    if (m < 50) return "bg-orange-500/10 border-orange-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  const getSeverityLabel = (m: number) => {
    if (m < 10) return "Baixo risco";
    if (m < 25) return "Risco moderado";
    if (m < 50) return "Alto risco";
    return "Risco muito alto";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center gap-6 max-w-md w-full px-6"
        >
          {/* Success icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <div className="rounded-full bg-primary/10 p-4">
              <CheckCircle2 className="h-16 w-16 text-primary" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-center"
          >
            <h2 className="text-2xl font-bold text-foreground">Paciente pré-admitido</h2>
            <p className="text-muted-foreground mt-1">{patientName}</p>
          </motion.div>

          {/* Bed info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex items-center gap-4 bg-card border rounded-xl px-6 py-4 w-full"
          >
            <div className="flex items-center gap-2">
              <Bed className="h-5 w-5 text-primary" />
              <span className="font-mono font-bold text-lg text-foreground">{bedNumber}</span>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{sectorLabel}</span>
            </div>
          </motion.div>

          {/* SAPS Score Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className={`w-full rounded-xl border p-6 ${getMortalityBg(predictedMortality)}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">SAPS 3</p>
                  <p className="text-3xl font-bold text-foreground">{totalScore}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">Mortalidade predita</p>
                <p className={`text-3xl font-bold ${getMortalityColor(predictedMortality)}`}>
                  {predictedMortality}%
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <TrendingUp className={`h-4 w-4 ${getMortalityColor(predictedMortality)}`} />
              <Badge variant="outline" className="text-xs">
                {getSeverityLabel(predictedMortality)}
              </Badge>
            </div>
          </motion.div>

          {/* Redirect progress */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="w-full space-y-2"
          >
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-center text-muted-foreground">
              {patientId ? `Abrindo painel clínico em ${countdown}s...` : `Abrindo painel clínico em ${countdown}s...`}
            </p>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
