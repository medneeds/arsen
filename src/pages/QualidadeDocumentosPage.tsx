import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FolderOpen, FileText, FileSpreadsheet, FileType, Image as ImageIcon, Upload, Search,
  Building2, ClipboardList, Download, RefreshCw, Info, Folder,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { QualidadeShell } from "@/components/QualidadeShell";
import { supabase } from "@/integrations/supabase/client";

interface DocRow {
  id: string;
  pasta_id: string | null;
  categoria: string;
  titulo: string;
  descricao: string | null;
  storage_path: string;
  tipo_arquivo: string | null;
  tamanho_bytes: number | null;
  competencia: string | null;
  criado_em: string;
}

const CATEGORIAS = [
  { id: "institucional", label: "Documentação Institucional", icon: Building2, hint: "Políticas, relatórios e documentos institucionais da qualidade." },
  { id: "fluxos_manuais", label: "Fluxos Manuais", icon: ClipboardList, hint: "POPs, padronização e ações clínicas de fluxos ainda não automatizados." },
] as const;

const iconForType = (t: string | null) => {
  const x = (t || "").toLowerCase();
  if (x.includes("sheet") || x === "xlsx" || x === "csv") return FileSpreadsheet;
  if (x.includes("word") || x === "docx" || x === "doc") return FileType;
  if (x.includes("image") || ["png", "jpg", "jpeg", "webp"].includes(x)) return ImageIcon;
  return FileText;
};

const fmtSize = (b: number | null) => {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

export default function QualidadeDocumentosPage() {
  const [categoria, setCategoria] = useState<string>("institucional");
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<string>("todos");
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => { select: (c: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: DocRow[] | null; error: { message: string } | null }> } };
      })
        .from("qualidade_documentos")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) {
        setNotConfigured(true);
        setDocs([]);
      } else {
        setNotConfigured(false);
        setDocs((data ?? []) as DocRow[]);
      }
    } catch {
      setNotConfigured(true);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const tipos = useMemo(() => {
    const s = new Set<string>();
    for (const d of docs) if (d.tipo_arquivo) s.add(d.tipo_arquivo);
    return Array.from(s).sort();
  }, [docs]);

  const filtered = useMemo(() => {
    const qn = q.trim().toLowerCase();
    return docs.filter((d) => {
      if (d.categoria !== categoria) return false;
      if (tipo !== "todos" && d.tipo_arquivo !== tipo) return false;
      if (qn && !`${d.titulo} ${d.descricao ?? ""}`.toLowerCase().includes(qn)) return false;
      return true;
    });
  }, [docs, categoria, tipo, q]);

  const catDef = CATEGORIAS.find((c) => c.id === categoria)!;

  return (
    <QualidadeShell
      title="Repositório de Documentos — Qualidade"
      subtitle="Documentação institucional e fluxos manuais (POPs, padronizações, ações clínicas)."
      icon={FolderOpen}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9 gap-2 border-white/40 bg-white/95 text-foreground shadow-sm hover:bg-white hover:text-primary">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Atualizar
          </Button>
          <Button size="sm" className="h-9 gap-2" disabled={notConfigured} title={notConfigured ? "Ambiente em configuração" : undefined}>
            <Upload className="h-4 w-4" /> Enviar documento
          </Button>
        </>
      }
    >
      {notConfigured && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">Ambiente em configuração</p>
              <p className="mt-1 text-muted-foreground">
                O repositório está pronto no layout, mas o armazenamento ainda não foi provisionado no banco
                (bucket <code className="font-mono">qualidade-docs</code> + tabelas <code className="font-mono">qualidade_pastas</code>/<code className="font-mono">qualidade_documentos</code> + regras de acesso).
                Assim que aplicado, criar pastas, enviar arquivos (planilha/PDF/Word), filtrar por tipo e data ficam ativos aqui.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categorias (abas) */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIAS.map((c) => {
          const Icon = c.icon;
          const active = c.id === categoria;
          return (
            <button
              key={c.id}
              onClick={() => setCategoria(c.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                active ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" /> {c.label}
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label className="text-xs">Buscar</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Título ou descrição" className="h-9 pl-8 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de documentos */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <catDef.icon className="h-4 w-4" /> <span className="font-medium text-foreground">{catDef.label}</span>
        <span className="text-xs">· {catDef.hint}</span>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Folder className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">Nenhum documento {notConfigured ? "" : "nesta categoria"}</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {notConfigured
                ? "Assim que o armazenamento for configurado, os documentos enviados aparecerão aqui, organizados por pasta e data."
                : "Envie o primeiro documento ou ajuste os filtros."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => {
            const Icon = iconForType(d.tipo_arquivo);
            return (
              <Card key={d.id} className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{d.titulo}</p>
                    {d.descricao && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{d.descricao}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {d.tipo_arquivo && <Badge variant="outline" className="text-[10px] uppercase">{d.tipo_arquivo}</Badge>}
                      <span className="text-[11px] text-muted-foreground">{fmtSize(d.tamanho_bytes)}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {d.competencia ? format(new Date(d.competencia), "MM/yyyy", { locale: ptBR }) : format(new Date(d.criado_em), "dd/MM/yy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Baixar">
                    <Download className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </QualidadeShell>
  );
}
