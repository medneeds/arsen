import { useState, useMemo } from "react";
import { FileBarChart, Download, Search, Filter, Table2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { REPORT_DEFINITIONS, REPORT_CATEGORIES, ReportCategory, ReportDefinition } from "@/data/reportDefinitions";
import { useReportData, ReportResult } from "@/hooks/useReportData";

const RelatorioPage = () => {
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState<ReportDefinition | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [openCategories, setOpenCategories] = useState<Set<ReportCategory>>(new Set(['atendimento']));
  const { loading, result, runReport, setResult } = useReportData();

  const filteredReports = useMemo(() => {
    if (!search) return REPORT_DEFINITIONS;
    const s = search.toLowerCase();
    return REPORT_DEFINITIONS.filter(r =>
      r.name.toLowerCase().includes(s) || r.description.toLowerCase().includes(s)
    );
  }, [search]);

  const groupedReports = useMemo(() => {
    const groups: Record<ReportCategory, ReportDefinition[]> = {} as any;
    Object.keys(REPORT_CATEGORIES).forEach(k => { groups[k as ReportCategory] = []; });
    filteredReports.forEach(r => { groups[r.category].push(r); });
    return groups;
  }, [filteredReports]);

  const toggleCategory = (cat: ReportCategory) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const handleRun = (report: ReportDefinition) => {
    setSelectedReport(report);
    runReport(report.queryType, startDate, endDate);
  };

  const exportCSV = (result: ReportResult, name: string) => {
    const header = result.columns.join(';');
    const rows = result.rows.map(r => result.columns.map(c => `"${r[c] ?? ''}"`).join(';'));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name}_${startDate}_${endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileBarChart className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">{REPORT_DEFINITIONS.length} relatórios disponíveis</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Buscar relatório</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data Início</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-[150px]" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data Fim</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-[150px]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Categories */}
      <div className="space-y-2">
        {(Object.entries(REPORT_CATEGORIES) as [ReportCategory, { label: string; color: string }][]).map(([cat, meta]) => {
          const reports = groupedReports[cat];
          if (reports.length === 0) return null;
          const isOpen = openCategories.has(cat);
          return (
            <Collapsible key={cat} open={isOpen} onOpenChange={() => toggleCategory(cat)}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div className={`w-3 h-3 rounded-full ${meta.color}`} />
                  <span className="font-semibold text-sm">{meta.label}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">{reports.length}</Badge>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-2 pl-6">
                  {reports.map(report => (
                    <button
                      key={report.id}
                      onClick={() => handleRun(report)}
                      className="text-left p-3 rounded-lg border bg-card hover:bg-accent/30 hover:border-primary/30 transition-all group"
                    >
                      <div className="flex items-start gap-2">
                        <Table2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0 group-hover:text-primary transition-colors" />
                        <div>
                          <p className="text-sm font-medium leading-tight group-hover:text-primary transition-colors">{report.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{report.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      {/* Report Result Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={open => { if (!open) { setSelectedReport(null); setResult(null); } }}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileBarChart className="h-5 w-5 text-primary" />
              {selectedReport?.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">{startDate} a {endDate}</p>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Gerando relatório...</span>
              </div>
            ) : result ? (
              <div className="space-y-3">
                {result.summary && (
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(result.summary).map(([k, v]) => (
                      <div key={k} className="px-3 py-1.5 rounded-lg bg-primary/10 text-sm">
                        <span className="text-muted-foreground">{k}:</span>{' '}
                        <span className="font-bold text-primary">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border rounded-lg overflow-auto max-h-[60vh]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        {result.columns.map(c => (
                          <th key={c} className="px-3 py-2 text-left font-semibold text-xs whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.length === 0 ? (
                        <tr><td colSpan={result.columns.length} className="px-3 py-8 text-center text-muted-foreground">Nenhum registro encontrado no período</td></tr>
                      ) : result.rows.map((row, i) => (
                        <tr key={i} className="border-t hover:bg-accent/20">
                          {result.columns.map(c => (
                            <td key={c} className="px-3 py-1.5 whitespace-nowrap">{row[c]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{result.rows.length} registro(s)</span>
                  <Button size="sm" variant="outline" onClick={() => exportCSV(result, selectedReport?.id || 'relatorio')}>
                    <Download className="h-4 w-4 mr-1" /> Exportar CSV
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RelatorioPage;
