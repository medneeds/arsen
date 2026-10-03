import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { UFS, normalizeUf } from "@/lib/ufBrasil";
import { useCidadesIBGE } from "@/hooks/useCidadesIBGE";
import type { AddressValue } from "@/lib/address";

/**
 * Campos de endereco reutilizaveis (cadastro novo e ficha cadastral):
 *   - CEP (NAO obrigatorio): ao completar 8 digitos, busca no ViaCEP e preenche
 *     logradouro, bairro, cidade e UF automaticamente.
 *   - UF: Select (lista estatica), escolhida PRIMEIRO.
 *   - Cidade: combobox filtrado pela UF, carregado do IBGE. Em falha de rede,
 *     degrada para texto livre (hospital com rede instavel nao pode travar).
 *   - Logradouro e Bairro: texto livre.
 *
 * Observacao de dados: a tabela `pacientes` so tem a coluna `endereco`. Este
 * componente trabalha com as partes em memoria; a persistencia (concatenacao em
 * `endereco`) e feita por quem usa — ver buildEnderecoLine.
 */
function maskCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

interface AddressFieldsProps {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  disabled?: boolean;
  idPrefix?: string;
  className?: string;
}

export function AddressFields({
  value,
  onChange,
  disabled,
  idPrefix = "addr",
  className,
}: AddressFieldsProps) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const lastCepFetched = useRef<string>("");

  const { data: cidades, isLoading: cidadesLoading, isError: cidadesError } =
    useCidadesIBGE(value.state);
  const cidadesList = cidades ?? [];
  // Combobox so quando ha UF e a lista do IBGE veio; senao cidade em texto livre.
  const useCombobox = !!value.state && !cidadesError;

  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });

  // ViaCEP: ao completar 8 digitos, preenche os demais campos. Nao obrigatorio.
  useEffect(() => {
    const digits = value.cep.replace(/\D/g, "");
    if (digits.length !== 8 || digits === lastCepFetched.current) return;
    lastCepFetched.current = digits;
    let cancelled = false;
    (async () => {
      setCepLoading(true);
      try {
        const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        if (!resp.ok) throw new Error(`ViaCEP ${resp.status}`);
        const d = (await resp.json()) as {
          logradouro?: string;
          bairro?: string;
          localidade?: string;
          uf?: string;
          erro?: boolean;
        };
        if (cancelled) return;
        if (d.erro) {
          toast.error("CEP nao encontrado");
          return;
        }
        onChange({
          ...value,
          cep: maskCep(digits),
          address: d.logradouro || value.address,
          neighborhood: d.bairro || value.neighborhood,
          city: d.localidade || value.city,
          state: normalizeUf(d.uf) || value.state,
        });
      } catch {
        if (!cancelled) {
          toast.error("Nao foi possivel buscar o CEP — preencha manualmente");
        }
      } finally {
        if (!cancelled) setCepLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // value e usado dentro do efeito, mas o gatilho e apenas a mudanca do CEP.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.cep]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* CEP (opcional) — autofill */}
      <div className="max-w-[220px]">
        <Label htmlFor={`${idPrefix}-cep`} className="text-xs">
          CEP <span className="text-muted-foreground font-normal">(opcional — preenche o resto)</span>
        </Label>
        <div className="relative mt-1">
          <Input
            id={`${idPrefix}-cep`}
            inputMode="numeric"
            placeholder="00000-000"
            value={value.cep}
            disabled={disabled}
            onChange={(e) => set({ cep: maskCep(e.target.value) })}
          />
          {cepLoading && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* UF (primeiro) + Cidade (filtrada pela UF) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">UF</Label>
          <Select
            value={value.state || undefined}
            disabled={disabled}
            onValueChange={(uf) => set({ state: uf, city: "" })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione a UF" />
            </SelectTrigger>
            <SelectContent>
              {UFS.map((uf) => (
                <SelectItem key={uf.sigla} value={uf.sigla}>
                  {uf.sigla} — {uf.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor={`${idPrefix}-city`} className="text-xs">
            Cidade
          </Label>
          {useCombobox ? (
            <Popover open={cityOpen} onOpenChange={setCityOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={cityOpen}
                  disabled={disabled || !value.state}
                  className="mt-1 w-full justify-between font-normal"
                >
                  <span className={cn("truncate", !value.city && "text-muted-foreground")}>
                    {value.city || "Selecione a cidade"}
                  </span>
                  {cidadesLoading ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-70" />
                  ) : (
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cidade..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                    <CommandGroup>
                      {cidadesList.map((c) => (
                        <CommandItem
                          key={c}
                          value={c}
                          onSelect={() => {
                            set({ city: c });
                            setCityOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value.city === c ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {c}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (
            // Degradacao: sem UF ou IBGE indisponivel -> cidade em texto livre.
            <Input
              id={`${idPrefix}-city`}
              className="mt-1"
              placeholder={value.state ? "Cidade" : "Escolha a UF primeiro"}
              value={value.city}
              disabled={disabled}
              onChange={(e) => set({ city: e.target.value })}
            />
          )}
          {cidadesError && value.state && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Lista de cidades indisponivel — digite manualmente.
            </p>
          )}
        </div>
      </div>

      {/* Logradouro + Bairro (texto livre, ou preenchidos pelo CEP) */}
      <div>
        <Label htmlFor={`${idPrefix}-address`} className="text-xs">
          Endereço (logradouro, número)
        </Label>
        <Input
          id={`${idPrefix}-address`}
          className="mt-1"
          placeholder="Rua, número, complemento"
          value={value.address}
          disabled={disabled}
          onChange={(e) => set({ address: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-neighborhood`} className="text-xs">
          Bairro
        </Label>
        <Input
          id={`${idPrefix}-neighborhood`}
          className="mt-1"
          placeholder="Bairro"
          value={value.neighborhood}
          disabled={disabled}
          onChange={(e) => set({ neighborhood: e.target.value })}
        />
      </div>
    </div>
  );
}
