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

// MIGRAÇÃO: module_ip_settings→config_ip_modulo, module_ip_allowlist→config_ip_permitido,
// ip_access_log→log_acesso_ip. Colunas renomeadas para o schema novo (pt-BR).
type Setting = {
  modulo: string;
  exige_ip: boolean;
  ignora_para_admin: boolean;
  descricao: string | null;
};

type AllowEntry = {
  id: string;
  modulo: string;
  ip_cidr: string;
  rotulo: string | null;
  habilitado: boolean;
  criado_em: string;
};

type LogEntry = {
  id: string;
  modulo: string;
  ip: string | null;
  email: string | null;
  permitido: boolean;
  motivo: string | null;
  criado_em: string;
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
      supabase.from("config_ip_modulo").select("*").order("modulo"),
      supabase.from("config_ip_permitido").select("*").order("criado_em", { ascending: false }),
      supabase.from("log_acesso_ip").select("*").order("criado_em", { ascending: false }).limit(50),
    ]);
    setSettings((s.data ?? []) as unknown as Setting[]);
    setAllowlist((a.data ?? []) as unknown as AllowEntry[]);
    setLogs((l.data ?? []) as unknown as LogEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // MIGRAÇÃO: a edge function "check-ip-access" não consta nas functions do backend
    // novo; se não existir, o invoke retorna erro e o "Seu IP" degrada para "—".
    supabase.functions
      .invoke("check-ip-access", { body: { module: "__probe__" } })
      .then(({ data }) => setMyIp((data as any)?.ip ?? null))
      .catch(() => setMyIp(null));
  }, [load]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground uppercase tracking-wider">
        Acesso restrito a administradores.
      </div>
    );
  }

  async function toggleEnforce(key: string, value: boolean) {
    const { error } = await supabase
      .from("config_ip_modulo")
      .update({ exige_ip: value })
      .eq("modulo", key);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  }

  async function toggleBypass(key: string, value: boolean) {
    const { error } = await supabase
      .from("config_ip_modulo")
      .update({ ignora_para_admin: value })
      .eq("modulo", key);
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
    const { error } = await supabase.from("config_ip_permitido").insert({
      modulo: newModule,
      ip_cidr: cidr,
      rotulo: newLabel.trim() || null,
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
    const { error } = await supabase.from("config_ip_permitido").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  }

  async function toggleEntry(id: string, value: boolean) {
    // A funcao de remover, logo acima, ja conferia o erro e avisava; esta nao.
    // Numa allowlist de IP, um toggle que falha em silencio faz o admin pensar
    // que liberou (ou bloqueou) um acesso que na verdade nao mudou.
    const { error } = await supabase.from("config_ip_permitido").update({ habilitado: value }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    load();
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium uppercase tracking-tight flex items-center gap-2">
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
          <CardTitle className="text-base uppercase tracking-wider">Configuração por módulo</CardTitle>
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
                <TableRow key={s.modulo}>
                  <TableCell className="font-mono text-xs">{s.modulo}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.descricao ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={s.exige_ip}
                      onCheckedChange={(v) => toggleEnforce(s.modulo, v)}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={s.ignora_para_admin}
                      onCheckedChange={(v) => toggleBypass(s.modulo, v)}
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
          <CardTitle className="text-base uppercase tracking-wider">Adicionar IP / faixa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs uppercase tracking-wider">Módulo</Label>
              <Select value={newModule} onValueChange={setNewModule}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {settings.map((s) => (
                    <SelectItem key={s.modulo} value={s.modulo}>
                      {s.modulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider">IP ou faixa CIDR</Label>
              <Input
                placeholder="200.10.5.4 ou 200.10.5.0/24"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider">Identificação</Label>
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
          <CardTitle className="text-base uppercase tracking-wider">IPs autorizados</CardTitle>
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
                  <TableCell className="font-mono text-xs">{e.modulo}</TableCell>
                  <TableCell className="font-mono text-xs">{String(e.ip_cidr)}</TableCell>
                  <TableCell className="text-sm">{e.rotulo ?? "—"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={e.habilitado}
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
          <CardTitle className="text-base uppercase tracking-wider">Tentativas recentes (últimas 50)</CardTitle>
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
                    {new Date(l.criado_em).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.modulo}</TableCell>
                  <TableCell className="font-mono text-xs">{l.ip ? String(l.ip) : "—"}</TableCell>
                  <TableCell className="text-xs">{l.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={l.permitido ? "outline" : "destructive"}>
                      {l.permitido ? "permitido" : (l.motivo ?? "bloqueado")}
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
