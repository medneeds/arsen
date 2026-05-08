import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Printer, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import type { Patient } from "@/types/patient";
import { getSectorDisplayLabel } from "@/utils/bedNaming";
import PrintableRoundMulti, { type RoundPrintItem } from "./PrintableRoundMulti";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lista de pacientes ativos do setor atual (já filtrados pelo chamador). */
  patients: Patient[];
  /** Nome do setor para exibir no cabeçalho do dialog. */
  sectorLabel?: string;
}

/**
 * Pop-up que lista todos os leitos ativos do setor com checkboxes para o usuário
 * selecionar quais imprimir. Gera 1 PDF único multipáginas (1 leito/página) com a
 * folha do Round em branco — apenas identificação preenchida.
 */
export function RoundSectorPrintDialog({ open, onOpenChange, patients, sectorLabel }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [roundDate, setRoundDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [printing, setPrinting] = useState(false);

  // Pacientes elegíveis: têm nome e leito
  const eligible = useMemo(
    () => patients.filter((p) => p.name?.trim() && p.bedNumber),
    [patients]
  );

  // Ao abrir, marca todos por padrão
  useEffect(() => {
    if (open) setSelected(new Set(eligible.map((p) => p.id)));
  }, [open, eligible]);

  const allChecked = selected.size === eligible.length && eligible.length > 0;
  const someChecked = selected.size > 0 && selected.size < eligible.length;

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(eligible.map((p) => p.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const items: RoundPrintItem[] = useMemo(() => {
    return eligible
      .filter((p) => selected.has(p.id))
      .map((p) => ({
        patientName: p.name,
        patientSector: getSectorDisplayLabel(p.sector) || String(p.sector),
        patientBed: p.bedNumber,
        patientAge: p.age != null ? String(p.age) : null,
        roundDate,
      }));
  }, [eligible, selected, roundDate]);

  const handlePrint = async () => {
    if (items.length === 0) {
      toast.error("Selecione ao menos um leito para imprimir.");
      return;
    }
    setPrinting(true);
    // Aguarda o portal renderizar antes de chamar print
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrinting(false), 500);
    }, 100);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Imprimir Round Multiprofissional — {sectorLabel || "Setor"}
            </DialogTitle>
            <DialogDescription>
              Selecione os leitos para gerar a folha do Round em branco (apenas identificação preenchida).
              Será gerado <strong>1 PDF único</strong> com 1 leito por página.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 px-1">
            <label className="text-xs font-medium text-muted-foreground">Data do round:</label>
            <Input
              type="date"
              value={roundDate}
              onChange={(e) => setRoundDate(e.target.value)}
              className="h-8 w-44"
            />
            <div className="ml-auto text-xs text-muted-foreground">
              {selected.size} de {eligible.length} selecionado(s)
            </div>
          </div>

          <div className="border rounded-md">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b">
              <Checkbox
                checked={allChecked ? true : someChecked ? "indeterminate" : false}
                onCheckedChange={toggleAll}
              />
              <span className="text-xs font-semibold uppercase tracking-wide">Selecionar todos</span>
            </div>
            <ScrollArea className="h-[320px]">
              {eligible.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum leito ativo neste setor.
                </div>
              ) : (
                <ul className="divide-y">
                  {eligible.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30">
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggleOne(p.id)}
                        id={`round-print-${p.id}`}
                      />
                      <label htmlFor={`round-print-${p.id}`} className="flex-1 flex items-center gap-3 cursor-pointer">
                        <span className="font-mono font-bold text-sm w-16 shrink-0">{p.bedNumber}</span>
                        <span className="text-sm flex-1 truncate">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          {getSectorDisplayLabel(p.sector) || p.sector}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handlePrint} disabled={selected.size === 0 || printing}>
              <Printer className="h-4 w-4 mr-2" />
              Gerar PDF ({selected.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Render fora do Dialog para que o @media print veja o conteúdo. */}
      {printing && <PrintableRoundMulti items={items} blank />}
    </>
  );
}

export default RoundSectorPrintDialog;
