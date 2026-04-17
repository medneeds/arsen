import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2 } from "lucide-react";

interface HospitalUnit {
  id: string;
  name: string;
}

interface HospitalUnitPickerProps {
  units: HospitalUnit[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export function HospitalUnitPicker({ units, selected, onChange }: HospitalUnitPickerProps) {
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" /> Unidades Hospitalares
        </label>
        <Badge variant="outline" className="text-[10px]">
          {selected.size} de {units.length}
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 rounded-lg bg-muted/30 border border-border/40">
        {units.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma unidade cadastrada.</p>
        ) : (
          units.map((unit) => {
            const checked = selected.has(unit.id);
            return (
              <label
                key={unit.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-background cursor-pointer transition-colors"
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(unit.id)} />
                <span className="text-sm flex-1 truncate">{unit.name}</span>
                {checked && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
