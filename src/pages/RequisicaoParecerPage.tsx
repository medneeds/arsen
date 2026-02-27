import { UserCheck } from "lucide-react";

const RequisicaoParecerPage = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <UserCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Requisição — Parecer</h1>
          <p className="text-sm text-muted-foreground">Solicitação de pareceres de especialistas</p>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">Requisição de Parecer</p>
        <p className="text-sm mt-1">Em breve: solicite pareceres de especialidades médicas</p>
      </div>
    </div>
  );
};

export default RequisicaoParecerPage;
