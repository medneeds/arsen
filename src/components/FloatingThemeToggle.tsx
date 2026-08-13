import { HelpCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botão flutuante global de Dúvidas Frequentes.
 * Fica fixo no canto inferior direito em todas as telas, oculto na impressão.
 * Em /prescricao sobe para não colidir com a toolbar fixa do rodapé.
 * O controle de tema foi movido para o footer da sidebar.
 */
export function FloatingThemeToggle() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isPrescription = pathname.startsWith("/prescricao");
  const isAjuda = pathname === "/ajuda";

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Dúvidas Frequentes"
      title="Dúvidas Frequentes — Guias didáticos"
      onClick={() => navigate("/ajuda")}
      className={cn(
        "fixed right-4 z-[80] h-10 w-10 rounded-full shadow-lg",
        isPrescription ? "bottom-3" : "bottom-4",
        "bg-background/90 backdrop-blur border-border",
        "hover:bg-primary/10 hover:text-primary hover:border-primary/40",
        isAjuda && "bg-primary/10 text-primary border-primary/40",
        "print:hidden"
      )}
    >
      <HelpCircle className="h-4 w-4" />
      <span className="sr-only">Dúvidas Frequentes</span>
    </Button>
  );
}
