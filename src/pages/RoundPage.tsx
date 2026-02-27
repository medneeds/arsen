import { FileText } from "lucide-react";

const RoundPage = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Round</h1>
          <p className="text-sm text-muted-foreground">Documentação de rounds médicos</p>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">Módulo de Round</p>
        <p className="text-sm mt-1">Em breve: registro e acompanhamento de rounds médicos</p>
      </div>
    </div>
  );
};

export default RoundPage;
