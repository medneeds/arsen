import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Mapa de Leitos", path: "/", icon: LayoutDashboard },
  { label: "Painel Clínico", path: "/painel-clinico", icon: ClipboardCheck },
];

export function ClinicalNavTabs() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
