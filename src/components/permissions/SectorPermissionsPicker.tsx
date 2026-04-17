import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, CheckCircle2 } from "lucide-react";
import { SECTOR_GROUPS } from "@/config/userProfiles";
import { DEPARTMENTS } from "@/contexts/DepartmentContext";

interface SectorPermissionsPickerProps {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export function SectorPermissionsPicker({ selected, onChange }: SectorPermissionsPickerProps) {
  const toggleDept = (dept: string) => {
    const next = new Set(selected);
    if (next.has(dept)) next.delete(dept);
    else next.add(dept);
    onChange(next);
  };

  const toggleGroup = (depts: readonly string[]) => {
    const allSelected = depts.every((d) => selected.has(d));
    const next = new Set(selected);
    if (allSelected) depts.forEach((d) => next.delete(d));
    else depts.forEach((d) => next.add(d));
    onChange(next);
  };

  const selectAll = () => onChange(new Set(DEPARTMENTS));
  const clearAll = () => onChange(new Set());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" /> Setores Acessíveis
        </label>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {selected.size} de {DEPARTMENTS.length}
          </Badge>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={selectAll}>
            Selecionar todos
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={clearAll}>
            Limpar
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {SECTOR_GROUPS.map((group) => {
          const allChecked = group.departments.every((d) => selected.has(d));
          const someChecked = group.departments.some((d) => selected.has(d));
          const count = group.departments.filter((d) => selected.has(d)).length;
          return (
            <div key={group.id} className="rounded-lg border border-border/40 bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGroup(group.departments)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Checkbox
                    checked={allChecked}
                    data-state={allChecked ? "checked" : someChecked ? "indeterminate" : "unchecked"}
                    onCheckedChange={() => toggleGroup(group.departments)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex flex-col items-start text-left min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {group.description}
                    </span>
                  </div>
                </div>
                <Badge variant={count > 0 ? "default" : "outline"} className="text-[10px] shrink-0">
                  {count}/{group.departments.length}
                </Badge>
              </button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-2">
                {group.departments.map((dept) => {
                  const checked = selected.has(dept);
                  return (
                    <label
                      key={dept}
                      className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/50 cursor-pointer text-xs transition-colors"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleDept(dept)} />
                      <span className="truncate flex-1">{dept}</span>
                      {checked && <CheckCircle2 className="h-3 w-3 text-primary" />}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
