import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Trash2, Plus, RefreshCw } from "lucide-react";

type Setting = {
  module_key: string;
  enforce: boolean;
  bypass_for_admin: boolean;
  description: string | null;
};

type AllowEntry = {
  id: string;
  module_key: string;
  ip_cidr: string;
  label: string | null;
  enabled: boolean;
  created_at: string;
};

type LogEntry = {
  id: string;
  module_key: string;
  ip: string | null;
  user_email: string | null;
  allowed: boolean;
  reason: string | null;
  created_at: string;
};

export default function IpAllowlistPage() {
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [allowlist, setAllowlist] = useState<AllowEntry[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [myIp, setMyIp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Novo IP
  const [newModule, setNewModule] = useState<string>("");
  const [newIp, setNewIp] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [s, a, l] = await Promise.all([
      supabase.from("module_ip_settings").select("*").order("module_key"),
      supabase.from("module_ip_allowlist").select("*").order("created_at", { ascending: false }),
      supabase.from("ip_access_log").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setSettings((s.data ?? []) as Setting[]);
    setAllowlist((a.data ?? []) as AllowEntry[]);
    setLogs((l.data ?? []) as LogEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // descobrir IP atual via edge function (módulo qualquer com enforce off retorna IP)
    supabase.functions
      .invoke("check-ip-access", { body: { module: "__probe__" } })
      .then(({ data }) => setMyIp(data?.ip ?? null));
  }, [load]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground uppercase">
        Acesso restrito a administradores.
      </div>
    );
  }

  async function toggleEnforce(key: string, value: boolean) {
    const { error } = await supabase
      .from("module_ip_settings")
      .update({ enforce: value })
      .eq("module_key", key);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  }

  async function toggleBypass(key: string, value: boolean) {
    const { error } = await supabase
      .from("module_ip_settings")
      .update({ bypass_for_admin: value })
      .eq("module_key", key);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  }

  async function addEntry() {
    if (!newModule || !newIp.trim()) {
      toast({ title: "Preencha módulo e IP", variant: "destructive" });
      return;
    }
    let cidr = newIp.trim();
    if (!cidr.includes("/")) cidr = `${cidr}/32`;
    const { error } = await supabase.from("module_ip_allowlist").insert({
      module_key: newModule,
      ip_cidr: cidr,
      label: newLabel.trim() || null,
    });
    if (error) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
      return;
    }
    setNewIp("");
    setNewLabel("");
    load();
  }

  async function removeEntry(id: string) {
    if (!confirm("Remover este IP da allowlist?")) return;
    const { error } = await supabase.from("module_ip_allowlist").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  }

  async function toggleEntry(id: string, value: boolean) {
    await supabase.from("module_ip_allowlist").update({ enabled: value }).eq("id", id);
    load();
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold uppercase tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Restrição de Acesso por IP
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure quais módulos exigem IP autorizado e cadastre os IPs/faixas das estações do hospital.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono">
            Seu IP: {myIp ?? "—"}
          </Badge>
          <Button variant="ghost" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base uppercase">Configuração por módulo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-32">Exigir IP</TableHead>
                <TableHead className="w-40">Admin sempre passa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.map((s) => (
                <TableRow key={s.module_key}>
                  <TableCell className="font-mono text-xs">{s.module_key}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={s.enforce}
                      onCheckedChange={(v) => toggleEnforce(s.module_key, v)}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={s.bypass_for_admin}
                      onCheckedChange={(v) => toggleBypass(s.module_key, v)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base uppercase">Adicionar IP / faixa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs uppercase">Módulo</Label>
              <Select value={newModule} onValueChange={setNewModule}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {settings.map((s) => (
                    <SelectItem key={s.module_key} value={s.module_key}>
                      {s.module_key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase">IP ou faixa CIDR</Label>
              <Input
                placeholder="200.10.5.4 ou 200.10.5.0/24"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs uppercase">Identificação</Label>
              <Input
                placeholder="Ex.: Farmácia central – PC 02"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <Button onClick={addEntry} className="gap-2">
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base uppercase">IPs autorizados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead>IP / Faixa</TableHead>
                <TableHead>Identificação</TableHead>
                <TableHead className="w-24">Ativo</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allowlist.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-6">
                    Nenhum IP cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {allowlist.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.module_key}</TableCell>
                  <TableCell className="font-mono text-xs">{e.ip_cidr}</TableCell>
                  <TableCell className="text-sm">{e.label ?? "—"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={e.enabled}
                      onCheckedChange={(v) => toggleEntry(e.id, v)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => removeEntry(e.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base uppercase">Tentativas recentes (últimas 50)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Quando</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-6">
                    Sem registros.
                  </TableCell>
                </TableRow>
              )}
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.module_key}</TableCell>
                  <TableCell className="font-mono text-xs">{l.ip ?? "—"}</TableCell>
                  <TableCell className="text-xs">{l.user_email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={l.allowed ? "outline" : "destructive"}>
                      {l.allowed ? "permitido" : (l.reason ?? "bloqueado")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
