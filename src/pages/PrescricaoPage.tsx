import { Pill } from "lucide-react";

const PrescricaoPage = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Pill className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prescrição</h1>
          <p className="text-sm text-muted-foreground">Prescrição médica digital</p>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        <Pill className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">Módulo de Prescrição</p>
        <p className="text-sm mt-1">Em breve: prescrição médica com templates e protocolos integrados</p>
      </div>
    </div>
  );
};

export default PrescricaoPage;
