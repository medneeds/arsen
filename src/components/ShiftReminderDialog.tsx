import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ShiftReminderDialog() {
  const [open, setOpen] = useState(false);
  const [shiftTime, setShiftTime] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Check if it's 6:45, 12:45, or 18:45
      if (minutes === 45 && (hours === 6 || hours === 12 || hours === 18)) {
        const shift = hours === 6 ? "MATUTINO" : hours === 12 ? "VESPERTINO" : "NOTURNO";
        setShiftTime(shift);
        setOpen(true);
      }
    };

    // Check immediately
    checkTime();

    // Check every minute
    const interval = setInterval(checkTime, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleSaveVersion = () => {
    setOpen(false);
    navigate("/");
    // Trigger save version action - you might want to emit an event or use a global state
  };

  const handleDismiss = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="uppercase flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
            Lembrete de Passagem de Plantão
          </DialogTitle>
          <DialogDescription className="uppercase text-base pt-4">
            Faltam 15 minutos para a passagem do plantão <span className="font-bold text-primary">{shiftTime}</span>.
            <br /><br />
            Não esqueça de salvar uma versão do mapa de pacientes antes da passagem!
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="uppercase"
          >
            Dispensar
          </Button>
          <Button
            onClick={handleSaveVersion}
            className="uppercase gap-2"
          >
            <Save className="h-4 w-4" />
            Salvar Versão Agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
