import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Mapa de Leitos", path: "/", icon: LayoutDashboard },
  { label: "Painel Clínico", path: "/painel-clinico", icon: ClipboardCheck },
];

interface ClinicalNavTabsProps {
  variant?: "default" | "dark";
}

export function ClinicalNavTabs({ variant = "default" }: ClinicalNavTabsProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className={cn(
      "flex gap-0.5 rounded-lg p-0.5",
      variant === "dark" ? "bg-white/10" : "bg-muted/50"
    )}>
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
              variant === "dark"
                ? isActive
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/10"
                : isActive
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
