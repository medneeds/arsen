import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const { pathname } = useLocation();
  const isPrescription = pathname.startsWith("/prescricao");

  useEffect(() => {
    const scrollContainer = document.querySelector("main.flex-1.overflow-auto");
    if (!scrollContainer) return;

    const handleScroll = () => {
      setIsVisible(scrollContainer.scrollTop > 400);
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    const scrollContainer = document.querySelector("main.flex-1.overflow-auto");
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={scrollToTop}
      className={cn(
        "fixed right-6 z-[80] h-10 w-10 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 border-0 transition-all duration-300 print:hidden",
        isPrescription ? "bottom-16" : "bottom-16",
        isVisible
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-4 scale-75 pointer-events-none"
      )}
      title="Voltar ao topo"
    >
      <ArrowUp className="h-4 w-4" />
    </Button>
  );
}
