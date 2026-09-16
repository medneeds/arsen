import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { MARANHAO_MACRO_REGIONS } from "@/data/reportDefinitions";

export interface ReportResult {
  columns: string[];
  rows: Record<string, any>[];
  summary?: Record<string, any>;
}

// MIGRAÇÃO: este hook foi reescrito do schema antigo (patient_encounters, pre_admissions,
// bed_census, admission_histories, bed_allocation_requests, exam_requests, clinical_evolutions,
// saps3_assessments, patients) para o schema novo (internacoes + pacientes + leitos + setores +
// pre_admissoes + solicitacoes_exame + solicitacoes_leito + evolucoes + transferencias +
// avaliacoes_saps3). Ver supabase/MIGRACAO_DEGRADACOES.md.
//
// MIGRAÇÃO (escopo por hospital/estado): as tabelas clínicas novas (internacoes, pacientes,
// leitos, setores, evolucoes, solicitacoes_exame, solicitacoes_leito, pre_admissoes,
// transferencias, avaliacoes_saps3) NÃO possuem colunas hospital_unit_id / state_id. O filtro
// `.eq('hospital_unit_id', ...).eq('state_id', ...)` foi REMOVIDO de todas as queries — os
// relatórios passam a agregar sobre o schema inteiro. Degradação registrada no log.

export function useReportData() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const { currentHospital, currentState } = useHospital();

  const runReport = async (queryType: string, startDate: string, endDate: string) => {
    if (!currentHospital || !currentState) return;
    setLoading(true);
    try {
      const hId = currentHospital.id;
      const sId = currentState.id;
      const data = await executeQuery(queryType, startDate, endDate, hId, sId);
      setResult(data);
    } catch (e) {
      console.error("Report error:", e);
      setResult({ columns: ['Erro'], rows: [{ Erro: 'Erro ao gerar relatório' }] });
    } finally {
      setLoading(false);
    }
  };

  return { loading, result, runReport, setResult };
}

// MIGRAÇÃO: helper para relatórios cuja métrica dependia de colunas que não existem no schema
// novo (desfecho/outcome, tempos de triagem, cidade de origem, entry_type, etc.). Mantém o
// shape ReportResult estável exibindo um aviso em vez de inventar dados.
function migracaoIndisponivel(motivo: string): ReportResult {
  console.warn(`[MIGRAÇÃO][useReportData] Relatório degradado: ${motivo}`);
  return { columns: ['Info'], rows: [{ Info: motivo }] };
}

// Extratores dos joins de internacoes(+pacientes,+leitos,+setores)
const pacNome = (r: any) => r?.paciente?.nome_social || r?.paciente?.nome_completo || '-';
const setorNome = (r: any) => r?.leito?.setor?.nome || '-';
const leitoNum = (r: any) => r?.leito?.numero || '-';

async function executeQuery(
  queryType: string, start: string, end: string, hospitalId: string, stateId: string
): Promise<ReportResult> {
  const endFull = end + "T23:59:59";
  const startFull = start + "T00:00:00";

  switch (queryType) {
    case 'encounters_list': {
      // MIGRAÇÃO: patient_encounters → internacoes (join pacientes/leitos/setores).
      const { data } = await supabase.from('internacoes')
        .select('id, status, data_entrada, paciente:pacientes(nome_completo, nome_social), leito:leitos(numero, setor:setores(nome))')
        .gte('data_entrada', startFull).lte('data_entrada', endFull)
        .order('data_entrada', { ascending: false });
      const rows: any[] = (data as any) || [];
      return {
        columns: ['Código', 'Paciente', 'Status', 'Setor Destino', 'Entrada', 'Triagem'],
        rows: rows.map(r => ({
          // MIGRAÇÃO: encounter_code não existe no schema novo → '-'.
          'Código': '-',
          'Paciente': pacNome(r),
          'Status': r.status,
          'Setor Destino': setorNome(r),
          'Entrada': formatDate(r.data_entrada),
          // MIGRAÇÃO: triage_status não existe no schema novo → '-'.
          'Triagem': '-',
        })),
      };
    }

    case 'encounters_compiled': {
      // MIGRAÇÃO: patient_encounters → internacoes. Chamado/Status Triagem/Desfecho degradados.
      const { data } = await supabase.from('internacoes')
        .select('id, status, data_entrada, paciente:pacientes(nome_completo, nome_social), leito:leitos(numero, setor:setores(nome))')
        .gte('data_entrada', startFull).lte('data_entrada', endFull)
        .order('data_entrada', { ascending: false });
      const rows: any[] = (data as any) || [];
      return {
        columns: ['Código', 'Paciente', 'Entrada', 'Chamado', 'Status Triagem', 'Setor Destino', 'Desfecho'],
        rows: rows.map(r => ({
          'Código': '-', // MIGRAÇÃO: encounter_code inexistente.
          'Paciente': pacNome(r),
          'Entrada': formatDate(r.data_entrada),
          'Chamado': '-', // MIGRAÇÃO: called_at inexistente.
          'Status Triagem': '-', // MIGRAÇÃO: triage_status inexistente.
          'Setor Destino': setorNome(r),
          'Desfecho': '-', // MIGRAÇÃO: outcome inexistente.
        })),
      };
    }

    case 'encounters_daily_count': {
      // MIGRAÇÃO: patient_encounters → internacoes (created_at → data_entrada).
      const { data } = await supabase.from('internacoes')
        .select('data_entrada')
        .gte('data_entrada', startFull).lte('data_entrada', endFull);
      const rows: any[] = (data as any) || [];
      const byDay: Record<string, number> = {};
      rows.forEach(r => {
        const day = (r.data_entrada || '').substring(0, 10);
        byDay[day] = (byDay[day] || 0) + 1;
      });
      return {
        columns: ['Data', 'Total de Fichas'],
        rows: Object.entries(byDay).sort().map(([d, c]) => ({ 'Data': d, 'Total de Fichas': c })),
        summary: { 'Total Geral': Object.values(byDay).reduce((a, b) => a + b, 0) },
      };
    }

    case 'encounters_shift': {
      // MIGRAÇÃO: patient_encounters → internacoes (created_at → data_entrada).
      const { data } = await supabase.from('internacoes')
        .select('data_entrada')
        .gte('data_entrada', startFull).lte('data_entrada', endFull);
      const rows: any[] = (data as any) || [];
      const sd: Record<string, number> = {};
      const sn: Record<string, number> = {};
      rows.forEach(r => {
        const dt = new Date(r.data_entrada);
        const h = dt.getHours();
        const day = (r.data_entrada || '').substring(0, 10);
        if (h >= 7 && h < 19) { sd[day] = (sd[day] || 0) + 1; }
        else { sn[day] = (sn[day] || 0) + 1; }
      });
      const allDays = [...new Set([...Object.keys(sd), ...Object.keys(sn)])].sort();
      return {
        columns: ['Data', 'SD (07-19h)', 'SN (19-07h)', 'Total'],
        rows: allDays.map(d => ({
          'Data': d,
          'SD (07-19h)': sd[d] || 0,
          'SN (19-07h)': sn[d] || 0,
          'Total': (sd[d] || 0) + (sn[d] || 0),
        })),
      };
    }

    case 'encounters_by_sex': {
      // MIGRAÇÃO: pre_admissions.sex não existe. Usa internacoes → pacientes.sexo (dado real).
      const { data } = await supabase.from('internacoes')
        .select('data_entrada, paciente:pacientes(sexo)')
        .gte('data_entrada', startFull).lte('data_entrada', endFull);
      const rows: any[] = (data as any) || [];
      const counts: Record<string, number> = {};
      rows.forEach(r => {
        const s = r?.paciente?.sexo || 'Não informado';
        counts[s] = (counts[s] || 0) + 1;
      });
      return {
        columns: ['Sexo', 'Quantidade', '%'],
        rows: Object.entries(counts).map(([s, c]) => ({
          'Sexo': s === 'M' ? 'Masculino' : s === 'F' ? 'Feminino' : s,
          'Quantidade': c,
          '%': ((c / (rows.length || 1)) * 100).toFixed(1) + '%',
        })),
        summary: { Total: rows.length },
      };
    }

    case 'encounters_by_age_sex': {
      // MIGRAÇÃO: pre_admissions → internacoes + pacientes (sexo, data_nascimento reais).
      const { data } = await supabase.from('internacoes')
        .select('data_entrada, paciente:pacientes(sexo, data_nascimento)')
        .gte('data_entrada', startFull).lte('data_entrada', endFull);
      const rows: any[] = (data as any) || [];
      const ranges = ['0-14', '15-29', '30-44', '45-59', '60-74', '75+'];
      const getRange = (age: number) => {
        if (age < 15) return '0-14';
        if (age < 30) return '15-29';
        if (age < 45) return '30-44';
        if (age < 60) return '45-59';
        if (age < 75) return '60-74';
        return '75+';
      };
      const matrix: Record<string, { M: number; F: number; O: number }> = {};
      ranges.forEach(r => matrix[r] = { M: 0, F: 0, O: 0 });
      rows.forEach(r => {
        const birth = r?.paciente?.data_nascimento;
        if (!birth) return;
        const age = Math.floor((Date.now() - new Date(birth).getTime()) / 31557600000);
        const range = getRange(age);
        const sx = r?.paciente?.sexo;
        const sex = sx === 'M' ? 'M' : sx === 'F' ? 'F' : 'O';
        matrix[range][sex]++;
      });
      return {
        columns: ['Faixa Etária', 'Masculino', 'Feminino', 'Outros', 'Total'],
        rows: ranges.map(r => ({
          'Faixa Etária': r,
          'Masculino': matrix[r].M,
          'Feminino': matrix[r].F,
          'Outros': matrix[r].O,
          'Total': matrix[r].M + matrix[r].F + matrix[r].O,
        })),
      };
    }

    case 'encounters_by_priority':
    case 'risk_colors': {
      // MIGRAÇÃO: pre_admissions → pre_admissoes (risk_classification → classificacao_risco).
      const { data } = await supabase.from('pre_admissoes')
        .select('classificacao_risco')
        .gte('data_hora', startFull).lte('data_hora', endFull)
        .not('classificacao_risco', 'is', null);
      const rows: any[] = (data as any) || [];
      const counts: Record<string, number> = {};
      rows.forEach(r => {
        const c = r.classificacao_risco || 'Não classificado';
        counts[c] = (counts[c] || 0) + 1;
      });
      const colorMap: Record<string, string> = {
        vermelho: '🔴 Vermelho (Emergência)',
        laranja: '🟠 Laranja (Muito Urgente)',
        amarelo: '🟡 Amarelo (Urgente)',
        verde: '🟢 Verde (Pouco Urgente)',
        azul: '🔵 Azul (Não Urgente)',
      };
      return {
        columns: ['Classificação', 'Quantidade', '%'],
        rows: Object.entries(counts).map(([c, n]) => ({
          'Classificação': colorMap[c] || c,
          'Quantidade': n,
          '%': ((n / (rows.length || 1)) * 100).toFixed(1) + '%',
        })),
        summary: { Total: rows.length },
      };
    }

    case 'risk_colors_detailed': {
      // MIGRAÇÃO: pre_admissions → pre_admissoes. chief_complaint e risk_classified_at inexistentes.
      const { data } = await supabase.from('pre_admissoes')
        .select('nome_paciente, classificacao_risco, status, setor_destino:setores(nome)')
        .gte('data_hora', startFull).lte('data_hora', endFull)
        .not('classificacao_risco', 'is', null);
      const rows: any[] = (data as any) || [];
      return {
        columns: ['Paciente', 'Classificação', 'Queixa', 'Data Classificação', 'Destino', 'Status'],
        rows: rows.map(r => ({
          'Paciente': r.nome_paciente,
          'Classificação': r.classificacao_risco,
          'Queixa': '-', // MIGRAÇÃO: chief_complaint inexistente em pre_admissoes.
          'Data Classificação': '-', // MIGRAÇÃO: risk_classified_at inexistente.
          'Destino': r?.setor_destino?.nome || '-',
          'Status': r.status,
        })),
      };
    }

    case 'avg_triage_time':
      // MIGRAÇÃO: pre_admissoes não tem risk_classified_at → tempo de triagem não é calculável.
      return migracaoIndisponivel('Tempo de triagem indisponível: pre_admissoes não possui data de classificação de risco (risk_classified_at) no schema novo.');

    case 'total_stay': {
      // MIGRAÇÃO: patient_encounters.outcome_date → internacoes.data_alta (permanência real).
      const { data } = await supabase.from('internacoes')
        .select('data_entrada, data_alta, status, paciente:pacientes(nome_completo, nome_social)')
        .gte('data_entrada', startFull).lte('data_entrada', endFull);
      const rows: any[] = ((data as any) || []).filter((r: any) => r.data_alta);
      if (rows.length === 0) {
        return { columns: ['Info'], rows: [{ Info: 'Nenhuma internação com alta registrada no período.' }] };
      }
      return {
        columns: ['Paciente', 'Código', 'Permanência (min)', 'Desfecho'],
        rows: rows.map(r => {
          const diff = (new Date(r.data_alta).getTime() - new Date(r.data_entrada).getTime()) / 60000;
          return {
            'Paciente': pacNome(r),
            'Código': '-', // MIGRAÇÃO: encounter_code inexistente.
            'Permanência (min)': diff.toFixed(1),
            'Desfecho': r.status || '-', // MIGRAÇÃO: outcome inexistente → usa internacoes.status.
          };
        }),
      };
    }

    case 'door_to_doctor':
    case 'first_attendance_duration':
    case 'avg_first_attendance':
    case 'avg_return_attendance':
      // MIGRAÇÃO: first_medical_attendance_at não existe → tempos porta-médico não calculáveis.
      return migracaoIndisponivel('Tempos de atendimento médico (porta-médico / primeiro atendimento) indisponíveis: internacoes não registra horário de atendimento médico no schema novo.');

    case 'los_with_admission':
    case 'los_with_admission_detailed': {
      // MIGRAÇÃO: no schema novo toda internacao É uma admissão. LOS = data_alta - data_entrada.
      const { data } = await supabase.from('internacoes')
        .select('data_entrada, data_alta, status, paciente:pacientes(nome_completo, nome_social)')
        .gte('data_entrada', startFull).lte('data_entrada', endFull);
      const filtered: any[] = ((data as any) || []).filter((r: any) => r.data_alta);
      const times = filtered.map((r: any) => ({
        name: pacNome(r),
        code: '-', // MIGRAÇÃO: encounter_code inexistente.
        los: (new Date(r.data_alta).getTime() - new Date(r.data_entrada).getTime()) / 60000,
        outcome: r.status,
      }));
      if (queryType.includes('detailed')) {
        return {
          columns: ['Paciente', 'Código', 'LOS (min)', 'LOS (h)', 'Desfecho'],
          rows: times.map(t => ({
            'Paciente': t.name, 'Código': t.code,
            'LOS (min)': t.los.toFixed(0),
            'LOS (h)': (t.los / 60).toFixed(1),
            'Desfecho': t.outcome || '-',
          })),
        };
      }
      const avg = times.length ? times.reduce((a, b) => a + b.los, 0) / times.length : 0;
      return {
        columns: ['Indicador', 'Valor'],
        rows: [
          { 'Indicador': 'Total de fichas', 'Valor': times.length },
          { 'Indicador': 'LOS Médio (min)', 'Valor': avg.toFixed(1) },
          { 'Indicador': 'LOS Médio (h)', 'Valor': (avg / 60).toFixed(1) },
          { 'Indicador': 'LOS Mínimo (min)', 'Valor': times.length ? Math.min(...times.map(t => t.los)).toFixed(1) : '-' },
          { 'Indicador': 'LOS Máximo (min)', 'Valor': times.length ? Math.max(...times.map(t => t.los)).toFixed(1) : '-' },
        ],
      };
    }

    case 'los_without_admission':
    case 'los_without_admission_detailed':
      // MIGRAÇÃO: não existe o conceito de atendimento "sem internação" (patient_encounters morto).
      return migracaoIndisponivel('LOS sem internação indisponível: o schema novo só registra internacoes (não há fichas de atendimento sem internação).');

    case 'diagnosis_count':
    case 'diagnosis_avc':
    case 'diagnosis_iam': {
      // MIGRAÇÃO: admission_histories → internacoes. cid_primary/cid_secondary/department
      // inexistentes; usa apenas hipotese_diagnostica (texto livre).
      const { data } = await supabase.from('internacoes')
        .select('hipotese_diagnostica')
        .gte('data_entrada', startFull).lte('data_entrada', endFull);
      const rows: any[] = (data as any) || [];
      if (queryType === 'diagnosis_count') {
        const counts: Record<string, number> = {};
        rows.forEach(r => {
          const h = (r.hipotese_diagnostica || '').trim();
          if (!h) return;
          counts[h] = (counts[h] || 0) + 1;
        });
        return {
          // MIGRAÇÃO: coluna 'CID' passa a exibir a hipótese diagnóstica (não há códigos CID).
          columns: ['CID', 'Quantidade'],
          rows: Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ 'CID': c, 'Quantidade': n })),
        };
      }
      const keyword = queryType === 'diagnosis_avc' ? 'avc|acidente vascular|isquem' : 'iam|infarto|miocárdio';
      const regex = new RegExp(keyword, 'i');
      const filtered = rows.filter(r => regex.test(r.hipotese_diagnostica || ''));
      return {
        columns: ['CID Primário', 'CID Secundário', 'Hipótese Diagnóstica'],
        rows: filtered.map(r => ({
          'CID Primário': '-', // MIGRAÇÃO: cid_primary inexistente.
          'CID Secundário': '-', // MIGRAÇÃO: cid_secondary inexistente.
          'Hipótese Diagnóstica': r.hipotese_diagnostica || '-',
        })),
        summary: { Total: filtered.length },
      };
    }

    case 'outcomes':
    case 'outcomes_detailed':
    case 'deaths':
    case 'evasions':
      // MIGRAÇÃO: patient_encounters.outcome / outcome_date não existem no schema novo. O conceito
      // de desfecho de atendimento (alta/óbito/evasão/transferência) não tem coluna equivalente.
      return migracaoIndisponivel('Desfechos de atendimento (alta/óbito/evasão) indisponíveis: internacoes não possui campo de desfecho (outcome) no schema novo.');

    case 'admissions': {
      // MIGRAÇÃO: patients → internacoes + pacientes + leitos + setores.
      const { data } = await supabase.from('internacoes')
        .select('status, data_entrada, paciente:pacientes(nome_completo, nome_social), leito:leitos(numero, setor:setores(nome))')
        .gte('data_entrada', startFull).lte('data_entrada', endFull);
      const rows: any[] = (data as any) || [];
      const statusMap: Record<string, string> = {
        SOLICITACAO_PENDENTE: 'Solicitação Pendente',
        PSM_FAVORAVEL: 'PSM Favorável',
        AGUARDANDO_VAGA: 'Aguardando Vaga',
        IR_PARA_UTI: 'Ir para UTI',
        IR_PARA_ENFERMARIA: 'Ir para Enfermaria',
      };
      return {
        columns: ['Paciente', 'Leito', 'Setor', 'Status Internação', 'Status Clínico', 'Data Admissão'],
        rows: rows.map(r => ({
          'Paciente': pacNome(r), 'Leito': leitoNum(r), 'Setor': setorNome(r),
          'Status Internação': statusMap[r.status || ''] || r.status || '-',
          'Status Clínico': '-', // MIGRAÇÃO: clinical_status não tem coluna nova (default degradado).
          'Data Admissão': r.data_entrada ? formatDate(r.data_entrada) : '-',
        })),
      };
    }

    case 'origin_city':
      // MIGRAÇÃO: pre_admissoes não tem coluna city → cidade de origem indisponível.
      return migracaoIndisponivel('Cidade de origem indisponível: pre_admissoes não possui coluna de município (city) no schema novo.');

    case 'macro_regions':
    case 'macro_regions_detailed':
    case 'health_macro_regions':
    case 'health_regions':
      // MIGRAÇÃO: derivava macrorregião de pre_admissions.city (inexistente). Mantém import
      // MARANHAO_MACRO_REGIONS referenciado para não quebrar dependências.
      void MARANHAO_MACRO_REGIONS;
      return migracaoIndisponivel('Macrorregiões indisponíveis: dependem do município de origem (pre_admissoes.city), que não existe no schema novo.');

    case 'conversion_by_city':
    case 'conversion_by_sector':
      // MIGRAÇÃO: taxa de conversão dependia de patient_encounters.outcome (inexistente).
      return migracaoIndisponivel('Taxa de conversão indisponível: depende do desfecho (outcome) de atendimentos, que não existe no schema novo.');

    case 'exams_summary': {
      // MIGRAÇÃO: exam_requests → solicitacoes_exame (created_at → criado_em).
      const { data } = await supabase.from('solicitacoes_exame')
        .select('categoria, status, prioridade')
        .gte('criado_em', startFull).lte('criado_em', endFull);
      const rows: any[] = (data as any) || [];
      const byCat: Record<string, number> = {};
      rows.forEach(r => { byCat[r.categoria] = (byCat[r.categoria] || 0) + 1; });
      return {
        columns: ['Categoria', 'Quantidade'],
        rows: Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ 'Categoria': c, 'Quantidade': n })),
        summary: { Total: rows.length },
      };
    }

    case 'exams_detailed': {
      // MIGRAÇÃO: exam_requests → solicitacoes_exame. patient_name/bed/sector via join internacoes.
      const { data } = await supabase.from('solicitacoes_exame')
        .select('categoria, prioridade, status, criado_em, internacao:internacoes(paciente:pacientes(nome_completo, nome_social), leito:leitos(numero, setor:setores(nome)))')
        .gte('criado_em', startFull).lte('criado_em', endFull)
        .order('criado_em', { ascending: false });
      const rows: any[] = (data as any) || [];
      return {
        columns: ['Paciente', 'Leito', 'Setor', 'Categoria', 'Prioridade', 'Status', 'Data'],
        rows: rows.map(r => ({
          'Paciente': pacNome(r?.internacao),
          'Leito': leitoNum(r?.internacao),
          'Setor': setorNome(r?.internacao),
          'Categoria': r.categoria, 'Prioridade': r.prioridade, 'Status': r.status,
          'Data': formatDate(r.criado_em),
        })),
      };
    }

    case 'ct_scans': {
      // MIGRAÇÃO: exam_requests → solicitacoes_exame (category → categoria='imagem', items → itens).
      const { data } = await supabase.from('solicitacoes_exame')
        .select('itens, status, criado_em, internacao:internacoes(paciente:pacientes(nome_completo, nome_social), leito:leitos(numero))')
        .eq('categoria', 'imagem')
        .gte('criado_em', startFull).lte('criado_em', endFull);
      const rows: any[] = (data as any) || [];
      const filtered = rows.filter(r => {
        const items = JSON.stringify(r.itens || []).toLowerCase();
        return items.includes('tomografia') || items.includes('tc ') || items.includes('ct ');
      });
      return {
        columns: ['Paciente', 'Leito', 'Status', 'Data'],
        rows: filtered.map(r => ({
          'Paciente': pacNome(r?.internacao),
          'Leito': leitoNum(r?.internacao),
          'Status': r.status, 'Data': formatDate(r.criado_em),
        })),
        summary: { Total: filtered.length },
      };
    }

    case 'traffic_accidents':
    case 'firearm_injuries':
    case 'falls':
    case 'burns':
    case 'flu_syndrome':
      // MIGRAÇÃO: filtravam pre_admissions por chief_complaint / flu_symptoms (inexistentes em
      // pre_admissoes). Sem campo de queixa na pré-admissão, esses recortes não são possíveis.
      return migracaoIndisponivel('Recorte por queixa/sintoma indisponível: pre_admissoes não possui chief_complaint nem flu_symptoms no schema novo.');

    case 'arrival_average': {
      // MIGRAÇÃO: patient_encounters → internacoes (created_at → data_entrada).
      const { data } = await supabase.from('internacoes')
        .select('data_entrada')
        .gte('data_entrada', startFull).lte('data_entrada', endFull);
      const rows: any[] = (data as any) || [];
      const byHour: Record<number, number> = {};
      for (let i = 0; i < 24; i++) byHour[i] = 0;
      const days = new Set<string>();
      rows.forEach(r => {
        const dt = new Date(r.data_entrada);
        byHour[dt.getHours()]++;
        days.add((r.data_entrada || '').substring(0, 10));
      });
      const numDays = Math.max(days.size, 1);
      return {
        columns: ['Hora', 'Total', 'Média/dia'],
        rows: Object.entries(byHour).map(([h, n]) => ({
          'Hora': `${h.toString().padStart(2, '0')}:00`,
          'Total': n,
          'Média/dia': (n / numDays).toFixed(1),
        })),
      };
    }

    case 'entry_reason': {
      // MIGRAÇÃO: pre_admissions.chief_complaint → internacoes.queixa_principal (dado real).
      const { data } = await supabase.from('internacoes')
        .select('queixa_principal')
        .gte('data_entrada', startFull).lte('data_entrada', endFull);
      const rows: any[] = (data as any) || [];
      const counts: Record<string, number> = {};
      rows.forEach(r => {
        const c = r.queixa_principal || 'Não informado';
        counts[c] = (counts[c] || 0) + 1;
      });
      return {
        columns: ['Queixa/Motivo', 'Quantidade'],
        rows: Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ 'Queixa/Motivo': c, 'Quantidade': n })),
      };
    }

    case 'entry_type':
      // MIGRAÇÃO: patient_encounters.entry_type (espontâneo/SAMU/...) não tem coluna equivalente.
      return migracaoIndisponivel('Tipo de entrada indisponível: internacoes não possui campo entry_type (espontâneo/SAMU/bombeiro/...) no schema novo.');

    case 'readmissions': {
      // MIGRAÇÃO: patient_encounters → internacoes. Agrupa por paciente_id; encounter_code → '-'.
      const { data } = await supabase.from('internacoes')
        .select('paciente_id, data_entrada, paciente:pacientes(nome_completo, nome_social)')
        .gte('data_entrada', startFull).lte('data_entrada', endFull)
        .order('paciente_id');
      const rows: any[] = (data as any) || [];
      const byPatient: Record<string, { name: string; dates: string[] }> = {};
      rows.forEach(r => {
        const key = r.paciente_id || pacNome(r);
        if (!byPatient[key]) byPatient[key] = { name: pacNome(r), dates: [] };
        byPatient[key].dates.push(formatDate(r.data_entrada));
      });
      const repeaters = Object.values(byPatient).filter(v => v.dates.length > 1);
      return {
        columns: ['Paciente', 'Nº Atendimentos', 'Códigos', 'Datas'],
        rows: repeaters.map(v => ({
          'Paciente': v.name, 'Nº Atendimentos': v.dates.length,
          'Códigos': '-', // MIGRAÇÃO: encounter_code inexistente.
          'Datas': v.dates.join(', '),
        })),
        summary: { 'Pacientes reincidentes': repeaters.length },
      };
    }

    case 'lean_indicators': {
      // MIGRAÇÃO: patient_encounters → internacoes; LOS via data_alta. Tempo de triagem degradado
      // (pre_admissoes não tem risk_classified_at).
      const { data: internacoes } = await supabase.from('internacoes')
        .select('data_entrada, data_alta')
        .gte('data_entrada', startFull).lte('data_entrada', endFull);
      const enc: any[] = (internacoes as any) || [];
      const avgTriage = 0; // MIGRAÇÃO: tempo médio de classificação indisponível (sem risk_classified_at).
      const withOutcome = enc.filter(r => r.data_alta);
      const losTimes = withOutcome.map(r =>
        (new Date(r.data_alta).getTime() - new Date(r.data_entrada).getTime()) / 60000
      );
      const avgLos = losTimes.length ? losTimes.reduce((a, b) => a + b, 0) / losTimes.length : 0;

      return {
        columns: ['Indicador', 'Valor'],
        rows: [
          { 'Indicador': 'Total de atendimentos', 'Valor': enc.length },
          { 'Indicador': 'Tempo médio classificação (min)', 'Valor': avgTriage.toFixed(1) }, // MIGRAÇÃO: degradado → 0.
          { 'Indicador': 'LOS médio (min)', 'Valor': avgLos.toFixed(1) },
          { 'Indicador': 'LOS médio (h)', 'Valor': (avgLos / 60).toFixed(1) },
          { 'Indicador': 'Fichas com desfecho', 'Valor': withOutcome.length },
          { 'Indicador': 'Fichas sem desfecho', 'Valor': enc.length - withOutcome.length },
        ],
      };
    }

    case 'gestao_occupancy_by_sector': {
      // MIGRAÇÃO: bed_census → leitos (join setores para nome do setor). Sem escopo por hospital.
      const { data } = await supabase.from('leitos')
        .select('status, setor:setores(nome)');
      const rows: any[] = (data as any) || [];
      const bySector: Record<string, Record<string, number>> = {};
      rows.forEach(r => {
        const sec = r?.setor?.nome || 'Não definido';
        if (!bySector[sec]) bySector[sec] = { total: 0, ocupado: 0, livre: 0, higienizacao: 0, bloqueado: 0, reservado: 0, outros: 0 };
        bySector[sec].total++;
        const k = ['ocupado', 'livre', 'higienizacao', 'bloqueado', 'reservado'].includes(r.status) ? r.status : 'outros';
        bySector[sec][k]++;
      });
      return {
        columns: ['Setor', 'Total', 'Ocupados', 'Livres', 'Bloqueados', 'Reservados', 'Ocupação %'],
        rows: Object.entries(bySector).sort().map(([s, v]) => ({
          'Setor': s, 'Total': v.total,
          'Ocupados': v.ocupado, 'Livres': v.livre,
          'Bloqueados': v.bloqueado, 'Reservados': v.reservado,
          'Ocupação %': ((v.ocupado / Math.max(v.total, 1)) * 100).toFixed(1) + '%',
        })),
        summary: { Setores: Object.keys(bySector).length, 'Total leitos': rows.length },
      };
    }

    case 'gestao_stay_by_sector': {
      // MIGRAÇÃO: patient_encounters → internacoes. LOS = data_alta - data_entrada; setor via join.
      const { data } = await supabase.from('internacoes')
        .select('data_entrada, data_alta, leito:leitos(setor:setores(nome))')
        .gte('data_entrada', startFull).lte('data_entrada', endFull)
        .not('data_alta', 'is', null);
      const rows: any[] = (data as any) || [];
      const bySector: Record<string, number[]> = {};
      rows.forEach(r => {
        const sec = setorNome(r);
        const mins = (new Date(r.data_alta).getTime() - new Date(r.data_entrada).getTime()) / 60000;
        if (!bySector[sec]) bySector[sec] = [];
        bySector[sec].push(mins);
      });
      return {
        columns: ['Setor', 'Qtd', 'LOS Médio (h)', 'LOS Mínimo (h)', 'LOS Máximo (h)'],
        rows: Object.entries(bySector).map(([s, t]) => ({
          'Setor': s, 'Qtd': t.length,
          'LOS Médio (h)': (t.reduce((a, b) => a + b, 0) / t.length / 60).toFixed(1),
          'LOS Mínimo (h)': (Math.min(...t) / 60).toFixed(1),
          'LOS Máximo (h)': (Math.max(...t) / 60).toFixed(1),
        })),
      };
    }

    case 'gestao_discharge_death_rate':
      // MIGRAÇÃO: taxa de alta/óbito dependia de patient_encounters.outcome (inexistente).
      return migracaoIndisponivel('Taxa de alta/óbito indisponível: internacoes não possui campo de desfecho (outcome) no schema novo.');

    case 'gestao_production_per_doctor': {
      // MIGRAÇÃO: clinical_evolutions → evolucoes (created_by_name → join profissionais.nome).
      // Atendimentos/altas/óbitos por médico dependiam de patient_encounters (inexistente) → 0.
      const { data: evo } = await supabase.from('evolucoes')
        .select('profissional:profissionais(nome)')
        .gte('data_hora', startFull).lte('data_hora', endFull);
      const rows: any[] = (evo as any) || [];
      const byDoc: Record<string, { atendimentos: number; evolucoes: number; altas: number; obitos: number }> = {};
      rows.forEach(r => {
        const d = r?.profissional?.nome || 'Não informado';
        if (!byDoc[d]) byDoc[d] = { atendimentos: 0, evolucoes: 0, altas: 0, obitos: 0 };
        byDoc[d].evolucoes++;
      });
      return {
        columns: ['Médico', 'Atendimentos', 'Evoluções', 'Altas', 'Óbitos'],
        rows: Object.entries(byDoc).sort((a, b) => b[1].evolucoes - a[1].evolucoes).map(([d, v]) => ({
          'Médico': d,
          'Atendimentos': v.atendimentos, // MIGRAÇÃO: sem patient_encounters → 0.
          'Evoluções': v.evolucoes,
          'Altas': v.altas, // MIGRAÇÃO: sem outcome → 0.
          'Óbitos': v.obitos, // MIGRAÇÃO: sem outcome → 0.
        })),
        summary: { Médicos: Object.keys(byDoc).length },
      };
    }

    case 'gestao_nir_queue': {
      // MIGRAÇÃO: bed_allocation_requests → solicitacoes_leito. requested_sector via join;
      // requested_bed inexistente; requesting_doctor_name via join profissionais.
      const { data } = await supabase.from('solicitacoes_leito')
        .select('status, criado_em, setor_solicitado:setores(nome), solicitante:profissionais!solicitacoes_leito_solicitado_por_fkey(nome)')
        .gte('criado_em', startFull).lte('criado_em', endFull)
        .order('criado_em', { ascending: false });
      const rows: any[] = (data as any) || [];
      const SLA_MIN = 120;
      const outRows = rows.map(r => {
        const ageMin = (Date.now() - new Date(r.criado_em).getTime()) / 60000;
        const slaOk = ageMin <= SLA_MIN;
        return {
          'Status': r.status,
          'Setor Solicitado': r?.setor_solicitado?.nome || '-',
          'Leito': '-', // MIGRAÇÃO: requested_bed inexistente em solicitacoes_leito.
          'Médico': r?.solicitante?.nome || '-',
          'Aberta em': formatDate(r.criado_em),
          'Idade (h)': (ageMin / 60).toFixed(1),
          'SLA (≤2h)': slaOk ? '✅' : '❌',
        };
      });
      const counts: Record<string, number> = {};
      rows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
      return {
        columns: ['Status', 'Setor Solicitado', 'Leito', 'Médico', 'Aberta em', 'Idade (h)', 'SLA (≤2h)'],
        rows: outRows,
        summary: { Total: rows.length, ...counts },
      };
    }

    case 'gestao_triage_sla':
      // MIGRAÇÃO: aderência de SLA de triagem dependia de risk_classified_at (inexistente).
      return migracaoIndisponivel('SLA de triagem indisponível: pre_admissoes não possui data de classificação de risco (risk_classified_at) no schema novo.');

    case 'gestao_readmission_30d': {
      // MIGRAÇÃO: patient_encounters → internacoes. patient_id → paciente_id; outcome_date → data_alta.
      const startDate = new Date(startFull);
      const lookback = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from('internacoes')
        .select('paciente_id, data_entrada, data_alta, paciente:pacientes(nome_completo, nome_social)')
        .gte('data_entrada', lookback).lte('data_entrada', endFull)
        .order('data_entrada', { ascending: true });
      const rows: any[] = (data as any) || [];
      const byPatient: Record<string, any[]> = {};
      rows.forEach(r => {
        const key = r.paciente_id || pacNome(r);
        if (!byPatient[key]) byPatient[key] = [];
        byPatient[key].push(r);
      });
      const readmissions: any[] = [];
      Object.values(byPatient).forEach(list => {
        for (let i = 1; i < list.length; i++) {
          const prev = list[i - 1];
          const curr = list[i];
          if (!prev.data_alta) continue;
          const gapDays = (new Date(curr.data_entrada).getTime() - new Date(prev.data_alta).getTime()) / 86400000;
          if (gapDays >= 0 && gapDays <= 30 && new Date(curr.data_entrada) >= startDate) {
            readmissions.push({
              'Paciente': pacNome(curr),
              'Atendimento Anterior': '-', // MIGRAÇÃO: encounter_code inexistente.
              'Desfecho Anterior': '-', // MIGRAÇÃO: outcome inexistente.
              'Reentrada': formatDate(curr.data_entrada),
              'Novo Atendimento': '-', // MIGRAÇÃO: encounter_code inexistente.
              'Intervalo (dias)': gapDays.toFixed(1),
            });
          }
        }
      });
      return {
        columns: ['Paciente', 'Atendimento Anterior', 'Desfecho Anterior', 'Reentrada', 'Novo Atendimento', 'Intervalo (dias)'],
        rows: readmissions,
        summary: { 'Readmissões 30d': readmissions.length },
      };
    }

    case 'gestao_uti_mortality':
      // MIGRAÇÃO: mortalidade UTI dependia de patient_encounters.outcome='obito' (inexistente).
      return migracaoIndisponivel('Mortalidade UTI indisponível: internacoes não possui campo de desfecho/óbito (outcome) no schema novo.');

    case 'gestao_transfers': {
      // MIGRAÇÃO: patient_encounters(outcome='transferencia') → tabela transferencias. Setor de
      // origem via join do leito de origem (FK transferencias_leito_origem_id_fkey).
      const { data } = await supabase.from('transferencias')
        .select('data_hora, origem:leitos!transferencias_leito_origem_id_fkey(setor:setores(nome))')
        .gte('data_hora', startFull).lte('data_hora', endFull);
      const rows: any[] = (data as any) || [];
      const bySector: Record<string, number> = {};
      rows.forEach(r => {
        const s = r?.origem?.setor?.nome || 'Não definido';
        bySector[s] = (bySector[s] || 0) + 1;
      });
      return {
        columns: ['Setor de Origem', 'Transferências'],
        rows: Object.entries(bySector).sort((a, b) => b[1] - a[1]).map(([s, n]) => ({
          'Setor de Origem': s, 'Transferências': n,
        })),
        summary: { Total: rows.length },
      };
    }

    case 'gestao_top_diagnoses': {
      // MIGRAÇÃO: admission_histories → internacoes. Sem CID → agrupa por hipotese_diagnostica.
      const { data } = await supabase.from('internacoes')
        .select('hipotese_diagnostica')
        .gte('data_entrada', startFull).lte('data_entrada', endFull);
      const rows: any[] = (data as any) || [];
      const counts: Record<string, number> = {};
      rows.forEach(r => {
        const h = (r.hipotese_diagnostica || '').trim();
        if (!h) return;
        counts[h] = (counts[h] || 0) + 1;
      });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
      const total = sorted.reduce((a, [, n]) => a + n, 0) || 1;
      return {
        // MIGRAÇÃO: coluna 'CID' passa a exibir a hipótese diagnóstica (não há códigos CID).
        columns: ['Posição', 'CID', 'Quantidade', '% do Top 20'],
        rows: sorted.map(([c, n], i) => ({
          'Posição': i + 1, 'CID': c, 'Quantidade': n,
          '% do Top 20': ((n / total) * 100).toFixed(1) + '%',
        })),
        summary: { 'CIDs únicos': Object.keys(counts).length },
      };
    }

    case 'gestao_nir_rejections': {
      // MIGRAÇÃO: bed_allocation_requests → solicitacoes_leito. rejection_reason → motivo_rejeicao;
      // requested_sector via join; requested_bed e reviewed_at inexistentes.
      const { data } = await supabase.from('solicitacoes_leito')
        .select('motivo_rejeicao, criado_em, status, setor_solicitado:setores(nome), solicitante:profissionais!solicitacoes_leito_solicitado_por_fkey(nome)')
        .eq('status', 'rejected')
        .gte('criado_em', startFull).lte('criado_em', endFull)
        .order('criado_em', { ascending: false });
      const rows: any[] = (data as any) || [];
      const motivos: Record<string, number> = {};
      rows.forEach(r => {
        const m = r.motivo_rejeicao || 'Sem motivo';
        motivos[m] = (motivos[m] || 0) + 1;
      });
      return {
        columns: ['Setor Solicitado', 'Leito', 'Médico', 'Motivo', 'Aberta em', 'Rejeitada em'],
        rows: rows.map(r => ({
          'Setor Solicitado': r?.setor_solicitado?.nome || '-',
          'Leito': '-', // MIGRAÇÃO: requested_bed inexistente.
          'Médico': r?.solicitante?.nome || '-',
          'Motivo': r.motivo_rejeicao || '-',
          'Aberta em': formatDate(r.criado_em),
          'Rejeitada em': '-', // MIGRAÇÃO: reviewed_at inexistente em solicitacoes_leito.
        })),
        summary: { Total: rows.length, ...motivos },
      };
    }

    case 'gestao_cleaning_time':
      // MIGRAÇÃO: bed_census.cleaning_started_at/finished_at não existem em leitos → tempo de
      // limpeza de leito não é calculável no schema novo.
      return migracaoIndisponivel('Tempo de limpeza de leito indisponível: leitos não possui cleaning_started_at/cleaning_finished_at no schema novo.');

    case 'gestao_saps3_adherence': {
      // MIGRAÇÃO: patients(UTI) → internacoes filtradas por setor ILIKE %uti% (em JS via join);
      // saps3_assessments → avaliacoes_saps3 (patient_id → internacao_id, created_at → criado_em,
      // total_score → escore_total). Sem coluna status → todas as avaliações contam.
      const { data: internacoesUti } = await supabase.from('internacoes')
        .select('id, data_entrada, paciente:pacientes(nome_completo, nome_social), leito:leitos(numero, setor:setores(nome))')
        .not('data_entrada', 'is', null)
        .gte('data_entrada', startFull).lte('data_entrada', endFull);
      const utiPatients: any[] = ((internacoesUti as any) || []).filter((r: any) => /uti/i.test(setorNome(r)));

      const ids = utiPatients.map(p => p.id);
      const { data: sapsList } = ids.length
        ? await supabase.from('avaliacoes_saps3')
            .select('internacao_id, criado_em, escore_total')
            .in('internacao_id', ids)
        : { data: [] as any[] };

      const sapsByPatient: Record<string, any[]> = {};
      ((sapsList as any) || []).forEach((s: any) => {
        if (!sapsByPatient[s.internacao_id]) sapsByPatient[s.internacao_id] = [];
        sapsByPatient[s.internacao_id].push(s);
      });

      let dentro = 0, fora = 0, sem = 0;
      const rows = utiPatients.map(p => {
        // MIGRAÇÃO: avaliacoes_saps3 não tem coluna status → considera todas as avaliações.
        const list = (sapsByPatient[p.id] || []).slice();
        list.sort((a: any, b: any) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());
        const first = list[0];
        let status = 'Sem SAPS 3', tempoH: string | number = '-', score: any = '-';
        if (!first) { sem++; }
        else {
          const h = (new Date(first.criado_em).getTime() - new Date(p.data_entrada).getTime()) / 3600000;
          tempoH = h.toFixed(1);
          score = first.escore_total ?? '-';
          if (h <= 24 && h >= 0) { dentro++; status = '✅ Dentro 24h'; }
          else { fora++; status = '❌ Fora 24h'; }
        }
        return {
          'Paciente': pacNome(p),
          'Setor': setorNome(p),
          'Leito': leitoNum(p),
          'Admissão': formatDate(p.data_entrada),
          'Tempo até SAPS 3 (h)': tempoH,
          'Score': score,
          'Status': status,
        };
      });
      const total = utiPatients.length || 1;
      return {
        columns: ['Paciente', 'Setor', 'Leito', 'Admissão', 'Tempo até SAPS 3 (h)', 'Score', 'Status'],
        rows,
        summary: {
          'Admissões UTI': utiPatients.length,
          'Dentro 24h': dentro,
          'Fora 24h': fora,
          'Sem SAPS 3': sem,
          Aderência: ((dentro / total) * 100).toFixed(1) + '%',
        },
      };
    }

    default:
      return { columns: ['Info'], rows: [{ Info: 'Relatório em desenvolvimento' }] };
  }
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return d;
  }
}
