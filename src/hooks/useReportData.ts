import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { MARANHAO_MACRO_REGIONS } from "@/data/reportDefinitions";

export interface ReportResult {
  columns: string[];
  rows: Record<string, any>[];
  summary?: Record<string, any>;
}

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

async function executeQuery(
  queryType: string, start: string, end: string, hospitalId: string, stateId: string
): Promise<ReportResult> {
  const endFull = end + "T23:59:59";
  const startFull = start + "T00:00:00";

  switch (queryType) {
    case 'encounters_list': {
      const { data } = await supabase.from('patient_encounters')
        .select('*')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull)
        .order('created_at', { ascending: false });
      return {
        columns: ['Código', 'Paciente', 'Status', 'Setor Destino', 'Entrada', 'Triagem'],
        rows: (data || []).map(r => ({
          'Código': r.encounter_code,
          'Paciente': r.patient_name,
          'Status': r.status,
          'Setor Destino': r.destination_sector || '-',
          'Entrada': formatDate(r.created_at),
          'Triagem': r.triage_status || '-',
        })),
      };
    }

    case 'encounters_compiled': {
      const { data } = await supabase.from('patient_encounters')
        .select('*')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull)
        .order('created_at', { ascending: false });
      return {
        columns: ['Código', 'Paciente', 'Entrada', 'Chamado', 'Status Triagem', 'Setor Destino', 'Desfecho'],
        rows: (data || []).map(r => ({
          'Código': r.encounter_code,
          'Paciente': r.patient_name,
          'Entrada': formatDate(r.created_at),
          'Chamado': r.called_at ? formatDate(r.called_at) : '-',
          'Status Triagem': r.triage_status || '-',
          'Setor Destino': r.destination_sector || '-',
          'Desfecho': (r as any).outcome || '-',
        })),
      };
    }

    case 'encounters_daily_count': {
      const { data } = await supabase.from('patient_encounters')
        .select('created_at')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const byDay: Record<string, number> = {};
      (data || []).forEach(r => {
        const day = r.created_at.substring(0, 10);
        byDay[day] = (byDay[day] || 0) + 1;
      });
      return {
        columns: ['Data', 'Total de Fichas'],
        rows: Object.entries(byDay).sort().map(([d, c]) => ({ 'Data': d, 'Total de Fichas': c })),
        summary: { 'Total Geral': Object.values(byDay).reduce((a, b) => a + b, 0) },
      };
    }

    case 'encounters_shift': {
      const { data } = await supabase.from('patient_encounters')
        .select('created_at')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const sd: Record<string, number> = {};
      const sn: Record<string, number> = {};
      (data || []).forEach(r => {
        const dt = new Date(r.created_at);
        const h = dt.getHours();
        const day = r.created_at.substring(0, 10);
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
      const { data } = await supabase.from('pre_admissions')
        .select('sex')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const counts: Record<string, number> = {};
      (data || []).forEach(r => {
        const s = r.sex || 'Não informado';
        counts[s] = (counts[s] || 0) + 1;
      });
      return {
        columns: ['Sexo', 'Quantidade', '%'],
        rows: Object.entries(counts).map(([s, c]) => ({
          'Sexo': s === 'M' ? 'Masculino' : s === 'F' ? 'Feminino' : s,
          'Quantidade': c,
          '%': ((c / (data?.length || 1)) * 100).toFixed(1) + '%',
        })),
        summary: { Total: data?.length || 0 },
      };
    }

    case 'encounters_by_age_sex': {
      const { data } = await supabase.from('pre_admissions')
        .select('sex, birth_date')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
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
      (data || []).forEach(r => {
        if (!r.birth_date) return;
        const age = Math.floor((Date.now() - new Date(r.birth_date).getTime()) / 31557600000);
        const range = getRange(age);
        const sex = r.sex === 'M' ? 'M' : r.sex === 'F' ? 'F' : 'O';
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
      const { data } = await supabase.from('pre_admissions')
        .select('risk_classification')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull)
        .not('risk_classification', 'is', null);
      const counts: Record<string, number> = {};
      (data || []).forEach(r => {
        const c = r.risk_classification || 'Não classificado';
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
          '%': ((n / (data?.length || 1)) * 100).toFixed(1) + '%',
        })),
        summary: { Total: data?.length || 0 },
      };
    }

    case 'risk_colors_detailed': {
      const { data } = await supabase.from('pre_admissions')
        .select('patient_name, risk_classification, risk_classified_at, chief_complaint, destination_sector, status')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull)
        .not('risk_classification', 'is', null);
      return {
        columns: ['Paciente', 'Classificação', 'Queixa', 'Data Classificação', 'Destino', 'Status'],
        rows: (data || []).map(r => ({
          'Paciente': r.patient_name,
          'Classificação': r.risk_classification,
          'Queixa': r.chief_complaint || '-',
          'Data Classificação': r.risk_classified_at ? formatDate(r.risk_classified_at) : '-',
          'Destino': r.destination_sector || '-',
          'Status': r.status,
        })),
      };
    }

    case 'avg_triage_time': {
      const { data } = await supabase.from('pre_admissions')
        .select('created_at, risk_classified_at, risk_classification')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull)
        .not('risk_classified_at', 'is', null);
      const byColor: Record<string, number[]> = {};
      (data || []).forEach(r => {
        const diff = (new Date(r.risk_classified_at!).getTime() - new Date(r.created_at).getTime()) / 60000;
        const c = r.risk_classification || 'outros';
        if (!byColor[c]) byColor[c] = [];
        byColor[c].push(diff);
      });
      return {
        columns: ['Classificação', 'Qtd', 'Tempo Médio (min)', 'Mínimo (min)', 'Máximo (min)'],
        rows: Object.entries(byColor).map(([c, times]) => ({
          'Classificação': c,
          'Qtd': times.length,
          'Tempo Médio (min)': (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1),
          'Mínimo (min)': Math.min(...times).toFixed(1),
          'Máximo (min)': Math.max(...times).toFixed(1),
        })),
      };
    }

    case 'door_to_doctor':
    case 'first_attendance_duration':
    case 'avg_first_attendance':
    case 'avg_return_attendance':
    case 'total_stay': {
      const { data } = await supabase.from('patient_encounters')
        .select('*')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const rows = (data || []).filter(r => {
        const enc = r as any;
        if (queryType === 'door_to_doctor') return enc.first_medical_attendance_at;
        if (queryType === 'total_stay') return enc.outcome_date;
        return enc.first_medical_attendance_at;
      }).map(r => {
        const enc = r as any;
        if (queryType === 'door_to_doctor') {
          const diff = (new Date(enc.first_medical_attendance_at).getTime() - new Date(r.created_at).getTime()) / 60000;
          return { 'Paciente': r.patient_name, 'Código': r.encounter_code, 'Tempo (min)': diff.toFixed(1) };
        }
        if (queryType === 'total_stay') {
          const diff = (new Date(enc.outcome_date).getTime() - new Date(r.created_at).getTime()) / 60000;
          return { 'Paciente': r.patient_name, 'Código': r.encounter_code, 'Permanência (min)': diff.toFixed(1), 'Desfecho': enc.outcome || '-' };
        }
        return { 'Paciente': r.patient_name, 'Código': r.encounter_code };
      });
      const colMap: Record<string, string[]> = {
        door_to_doctor: ['Paciente', 'Código', 'Tempo (min)'],
        total_stay: ['Paciente', 'Código', 'Permanência (min)', 'Desfecho'],
        first_attendance_duration: ['Paciente', 'Código'],
        avg_first_attendance: ['Paciente', 'Código'],
        avg_return_attendance: ['Paciente', 'Código'],
      };
      if (rows.length === 0) {
        return { columns: ['Info'], rows: [{ Info: 'Nenhum registro com dados de tempo médico no período. Preencha os campos de atendimento médico nos encounters.' }] };
      }
      return { columns: colMap[queryType] || ['Paciente', 'Código'], rows };
    }

    case 'los_with_admission':
    case 'los_without_admission':
    case 'los_with_admission_detailed':
    case 'los_without_admission_detailed': {
      const { data } = await supabase.from('patient_encounters')
        .select('*')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const isAdmission = queryType.includes('with');
      const isDetailed = queryType.includes('detailed');
      const filtered = (data || []).filter(r => {
        const enc = r as any;
        if (!enc.outcome_date) return false;
        return isAdmission ? enc.outcome === 'internacao' : enc.outcome !== 'internacao';
      });
      const times = filtered.map(r => {
        const enc = r as any;
        return {
          name: r.patient_name,
          code: r.encounter_code,
          los: (new Date(enc.outcome_date).getTime() - new Date(r.created_at).getTime()) / 60000,
          outcome: enc.outcome,
        };
      });
      if (isDetailed) {
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

    case 'diagnosis_count':
    case 'diagnosis_avc':
    case 'diagnosis_iam': {
      const { data } = await supabase.from('admission_histories')
        .select('cid_primary, cid_secondary, diagnostic_hypothesis, department')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      if (queryType === 'diagnosis_count') {
        const cidCounts: Record<string, number> = {};
        (data || []).forEach(r => {
          [r.cid_primary, r.cid_secondary].filter(Boolean).forEach(c => {
            cidCounts[c!] = (cidCounts[c!] || 0) + 1;
          });
        });
        return {
          columns: ['CID', 'Quantidade'],
          rows: Object.entries(cidCounts).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ 'CID': c, 'Quantidade': n })),
        };
      }
      const keyword = queryType === 'diagnosis_avc' ? 'avc|acidente vascular|isquem' : 'iam|infarto|miocárdio';
      const regex = new RegExp(keyword, 'i');
      const filtered = (data || []).filter(r =>
        regex.test(r.diagnostic_hypothesis || '') || regex.test(r.cid_primary || '') || regex.test(r.cid_secondary || '')
      );
      return {
        columns: ['CID Primário', 'CID Secundário', 'Hipótese Diagnóstica'],
        rows: filtered.map(r => ({
          'CID Primário': r.cid_primary || '-',
          'CID Secundário': r.cid_secondary || '-',
          'Hipótese Diagnóstica': r.diagnostic_hypothesis || '-',
        })),
        summary: { Total: filtered.length },
      };
    }

    case 'outcomes':
    case 'outcomes_detailed':
    case 'deaths':
    case 'evasions': {
      const { data } = await supabase.from('patient_encounters')
        .select('*')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      let filtered = data || [];
      if (queryType === 'deaths') filtered = filtered.filter(r => (r as any).outcome === 'obito');
      if (queryType === 'evasions') filtered = filtered.filter(r => (r as any).outcome === 'evasao');

      if (queryType === 'outcomes') {
        const counts: Record<string, number> = {};
        filtered.forEach(r => {
          const o = (r as any).outcome || 'Sem desfecho';
          counts[o] = (counts[o] || 0) + 1;
        });
        const labelMap: Record<string, string> = {
          alta: 'Alta', obito: 'Óbito', evasao: 'Evasão', internacao: 'Internação',
          transferencia: 'Transferência', desistencia: 'Desistência', 'Sem desfecho': 'Sem desfecho',
        };
        return {
          columns: ['Desfecho', 'Quantidade', '%'],
          rows: Object.entries(counts).map(([o, n]) => ({
            'Desfecho': labelMap[o] || o,
            'Quantidade': n,
            '%': ((n / filtered.length) * 100).toFixed(1) + '%',
          })),
          summary: { Total: filtered.length },
        };
      }
      return {
        columns: ['Código', 'Paciente', 'Entrada', 'Desfecho', 'Data Desfecho'],
        rows: filtered.map(r => ({
          'Código': r.encounter_code,
          'Paciente': r.patient_name,
          'Entrada': formatDate(r.created_at),
          'Desfecho': (r as any).outcome || '-',
          'Data Desfecho': (r as any).outcome_date ? formatDate((r as any).outcome_date) : '-',
        })),
      };
    }

    case 'admissions': {
      const { data } = await supabase.from('patients')
        .select('name, bed_number, sector, internment_status, admission_date, clinical_status')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .not('internment_status', 'is', null)
        .gte('created_at', startFull).lte('created_at', endFull);
      const statusMap: Record<string, string> = {
        SOLICITACAO_PENDENTE: 'Solicitação Pendente',
        PSM_FAVORAVEL: 'PSM Favorável',
        AGUARDANDO_VAGA: 'Aguardando Vaga',
        IR_PARA_UTI: 'Ir para UTI',
        IR_PARA_ENFERMARIA: 'Ir para Enfermaria',
      };
      return {
        columns: ['Paciente', 'Leito', 'Setor', 'Status Internação', 'Status Clínico', 'Data Admissão'],
        rows: (data || []).map(r => ({
          'Paciente': r.name, 'Leito': r.bed_number, 'Setor': r.sector,
          'Status Internação': statusMap[r.internment_status || ''] || r.internment_status || '-',
          'Status Clínico': r.clinical_status || '-',
          'Data Admissão': r.admission_date ? formatDate(r.admission_date) : '-',
        })),
      };
    }

    case 'origin_city': {
      const { data } = await supabase.from('pre_admissions')
        .select('city')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const counts: Record<string, number> = {};
      (data || []).forEach(r => {
        const c = r.city || 'Não informado';
        counts[c] = (counts[c] || 0) + 1;
      });
      return {
        columns: ['Cidade', 'Quantidade', '%'],
        rows: Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({
          'Cidade': c, 'Quantidade': n,
          '%': ((n / (data?.length || 1)) * 100).toFixed(1) + '%',
        })),
        summary: { Total: data?.length || 0 },
      };
    }

    case 'macro_regions':
    case 'macro_regions_detailed':
    case 'health_macro_regions':
    case 'health_regions': {
      const { data } = await supabase.from('pre_admissions')
        .select('city, patient_name')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const regionCounts: Record<string, number> = {};
      (data || []).forEach(r => {
        const city = r.city || '';
        let found = false;
        for (const [region, cities] of Object.entries(MARANHAO_MACRO_REGIONS)) {
          if (cities.some(c => city.toLowerCase().includes(c.toLowerCase()))) {
            regionCounts[region] = (regionCounts[region] || 0) + 1;
            found = true;
            break;
          }
        }
        if (!found) regionCounts['Outros'] = (regionCounts['Outros'] || 0) + 1;
      });
      return {
        columns: ['Macrorregião', 'Quantidade', '%'],
        rows: Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).map(([r, n]) => ({
          'Macrorregião': r, 'Quantidade': n,
          '%': ((n / (data?.length || 1)) * 100).toFixed(1) + '%',
        })),
        summary: { Total: data?.length || 0 },
      };
    }

    case 'conversion_by_city':
    case 'conversion_by_sector': {
      const { data } = await supabase.from('patient_encounters')
        .select('*')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const groupKey = queryType === 'conversion_by_sector' ? 'destination_sector' : 'destination_sector';
      const groups: Record<string, { total: number; converted: number }> = {};
      (data || []).forEach(r => {
        const key = (r as any)[groupKey] || 'Não definido';
        if (!groups[key]) groups[key] = { total: 0, converted: 0 };
        groups[key].total++;
        if ((r as any).outcome === 'internacao') groups[key].converted++;
      });
      return {
        columns: ['Setor/Município', 'Total Atendimentos', 'Internações', 'Taxa Conversão'],
        rows: Object.entries(groups).map(([k, v]) => ({
          'Setor/Município': k,
          'Total Atendimentos': v.total,
          'Internações': v.converted,
          'Taxa Conversão': ((v.converted / v.total) * 100).toFixed(1) + '%',
        })),
      };
    }

    case 'exams_summary': {
      const { data } = await supabase.from('exam_requests')
        .select('category, status, priority')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const byCat: Record<string, number> = {};
      (data || []).forEach(r => { byCat[r.category] = (byCat[r.category] || 0) + 1; });
      return {
        columns: ['Categoria', 'Quantidade'],
        rows: Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ 'Categoria': c, 'Quantidade': n })),
        summary: { Total: data?.length || 0 },
      };
    }

    case 'exams_detailed': {
      const { data } = await supabase.from('exam_requests')
        .select('patient_name, patient_bed, patient_sector, category, items, priority, status, created_at')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull)
        .order('created_at', { ascending: false });
      return {
        columns: ['Paciente', 'Leito', 'Setor', 'Categoria', 'Prioridade', 'Status', 'Data'],
        rows: (data || []).map(r => ({
          'Paciente': r.patient_name, 'Leito': r.patient_bed || '-', 'Setor': r.patient_sector || '-',
          'Categoria': r.category, 'Prioridade': r.priority, 'Status': r.status,
          'Data': formatDate(r.created_at),
        })),
      };
    }

    case 'ct_scans': {
      const { data } = await supabase.from('exam_requests')
        .select('patient_name, patient_bed, items, status, created_at')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .eq('category', 'imagem')
        .gte('created_at', startFull).lte('created_at', endFull);
      const filtered = (data || []).filter(r => {
        const items = JSON.stringify(r.items || []).toLowerCase();
        return items.includes('tomografia') || items.includes('tc ') || items.includes('ct ');
      });
      return {
        columns: ['Paciente', 'Leito', 'Status', 'Data'],
        rows: filtered.map(r => ({
          'Paciente': r.patient_name, 'Leito': r.patient_bed || '-',
          'Status': r.status, 'Data': formatDate(r.created_at),
        })),
        summary: { Total: filtered.length },
      };
    }

    case 'traffic_accidents':
    case 'firearm_injuries':
    case 'falls':
    case 'burns':
    case 'flu_syndrome': {
      const keywordMap: Record<string, string[]> = {
        traffic_accidents: ['acidente', 'trânsito', 'colisão', 'atropel', 'capotamento', 'moto', 'veículo', 'carro'],
        firearm_injuries: ['paf', 'arma de fogo', 'projétil', 'tiro', 'bala'],
        falls: ['queda', 'própria altura', 'caiu'],
        burns: ['queimadura', 'queimado', 'escaldad'],
        flu_syndrome: [],
      };

      if (queryType === 'flu_syndrome') {
        const { data } = await supabase.from('pre_admissions')
          .select('patient_name, chief_complaint, flu_symptoms, flu_symptoms_detail, created_at')
          .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
          .eq('flu_symptoms', true)
          .gte('created_at', startFull).lte('created_at', endFull);
        return {
          columns: ['Paciente', 'Queixa', 'Detalhes Gripais', 'Data'],
          rows: (data || []).map(r => ({
            'Paciente': r.patient_name, 'Queixa': r.chief_complaint || '-',
            'Detalhes Gripais': r.flu_symptoms_detail || '-', 'Data': formatDate(r.created_at),
          })),
          summary: { Total: data?.length || 0 },
        };
      }

      const keywords = keywordMap[queryType];
      const { data } = await supabase.from('pre_admissions')
        .select('patient_name, chief_complaint, risk_classification, created_at')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const filtered = (data || []).filter(r => {
        const text = (r.chief_complaint || '').toLowerCase();
        return keywords.some(k => text.includes(k));
      });
      return {
        columns: ['Paciente', 'Queixa Principal', 'Classificação', 'Data'],
        rows: filtered.map(r => ({
          'Paciente': r.patient_name, 'Queixa Principal': r.chief_complaint || '-',
          'Classificação': r.risk_classification || '-', 'Data': formatDate(r.created_at),
        })),
        summary: { Total: filtered.length },
      };
    }

    case 'arrival_average': {
      const { data } = await supabase.from('patient_encounters')
        .select('created_at')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const byHour: Record<number, number> = {};
      for (let i = 0; i < 24; i++) byHour[i] = 0;
      const days = new Set<string>();
      (data || []).forEach(r => {
        const dt = new Date(r.created_at);
        byHour[dt.getHours()]++;
        days.add(r.created_at.substring(0, 10));
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
      const { data } = await supabase.from('pre_admissions')
        .select('chief_complaint')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const counts: Record<string, number> = {};
      (data || []).forEach(r => {
        const c = r.chief_complaint || 'Não informado';
        counts[c] = (counts[c] || 0) + 1;
      });
      return {
        columns: ['Queixa/Motivo', 'Quantidade'],
        rows: Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ 'Queixa/Motivo': c, 'Quantidade': n })),
      };
    }

    case 'entry_type': {
      const { data } = await supabase.from('patient_encounters')
        .select('*')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const counts: Record<string, number> = {};
      const typeLabels: Record<string, string> = {
        espontaneo: 'Espontâneo', samu: 'SAMU', bombeiro: 'Bombeiro',
        policia: 'Polícia', transferencia: 'Transferência', outros: 'Outros',
      };
      (data || []).forEach(r => {
        const t = (r as any).entry_type || 'espontaneo';
        counts[t] = (counts[t] || 0) + 1;
      });
      return {
        columns: ['Tipo de Entrada', 'Quantidade', '%'],
        rows: Object.entries(counts).map(([t, n]) => ({
          'Tipo de Entrada': typeLabels[t] || t,
          'Quantidade': n,
          '%': ((n / (data?.length || 1)) * 100).toFixed(1) + '%',
        })),
        summary: { Total: data?.length || 0 },
      };
    }

    case 'readmissions': {
      const { data } = await supabase.from('patient_encounters')
        .select('patient_name, encounter_code, created_at')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull)
        .order('patient_name');
      const byPatient: Record<string, { codes: string[]; dates: string[] }> = {};
      (data || []).forEach(r => {
        const name = r.patient_name.trim().toLowerCase();
        if (!byPatient[name]) byPatient[name] = { codes: [], dates: [] };
        byPatient[name].codes.push(r.encounter_code);
        byPatient[name].dates.push(formatDate(r.created_at));
      });
      const repeaters = Object.entries(byPatient).filter(([, v]) => v.codes.length > 1);
      return {
        columns: ['Paciente', 'Nº Atendimentos', 'Códigos', 'Datas'],
        rows: repeaters.map(([name, v]) => ({
          'Paciente': name, 'Nº Atendimentos': v.codes.length,
          'Códigos': v.codes.join(', '), 'Datas': v.dates.join(', '),
        })),
        summary: { 'Pacientes reincidentes': repeaters.length },
      };
    }

    case 'lean_indicators': {
      const { data: encounters } = await supabase.from('patient_encounters')
        .select('*')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const { data: triage } = await supabase.from('pre_admissions')
        .select('created_at, risk_classified_at')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull)
        .not('risk_classified_at', 'is', null);
      const triageTimes = (triage || []).map(r =>
        (new Date(r.risk_classified_at!).getTime() - new Date(r.created_at).getTime()) / 60000
      );
      const avgTriage = triageTimes.length ? triageTimes.reduce((a, b) => a + b, 0) / triageTimes.length : 0;
      const enc = encounters || [];
      const withOutcome = enc.filter(r => (r as any).outcome_date);
      const losTimes = withOutcome.map(r =>
        (new Date((r as any).outcome_date).getTime() - new Date(r.created_at).getTime()) / 60000
      );
      const avgLos = losTimes.length ? losTimes.reduce((a, b) => a + b, 0) / losTimes.length : 0;

      return {
        columns: ['Indicador', 'Valor'],
        rows: [
          { 'Indicador': 'Total de atendimentos', 'Valor': enc.length },
          { 'Indicador': 'Tempo médio classificação (min)', 'Valor': avgTriage.toFixed(1) },
          { 'Indicador': 'LOS médio (min)', 'Valor': avgLos.toFixed(1) },
          { 'Indicador': 'LOS médio (h)', 'Valor': (avgLos / 60).toFixed(1) },
          { 'Indicador': 'Fichas com desfecho', 'Valor': withOutcome.length },
          { 'Indicador': 'Fichas sem desfecho', 'Valor': enc.length - withOutcome.length },
        ],
      };
    }

    case 'gestao_occupancy_by_sector': {
      const { data } = await supabase.from('bed_census')
        .select('sector, status')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId);
      const bySector: Record<string, Record<string, number>> = {};
      (data || []).forEach(r => {
        if (!bySector[r.sector]) bySector[r.sector] = { total: 0, ocupado: 0, vago: 0, bloqueado: 0, reservado: 0, outros: 0 };
        bySector[r.sector].total++;
        const k = ['ocupado', 'vago', 'bloqueado', 'reservado'].includes(r.status) ? r.status : 'outros';
        bySector[r.sector][k]++;
      });
      return {
        columns: ['Setor', 'Total', 'Ocupados', 'Vagos', 'Bloqueados', 'Reservados', 'Ocupação %'],
        rows: Object.entries(bySector).sort().map(([s, v]) => ({
          'Setor': s, 'Total': v.total,
          'Ocupados': v.ocupado, 'Vagos': v.vago,
          'Bloqueados': v.bloqueado, 'Reservados': v.reservado,
          'Ocupação %': ((v.ocupado / Math.max(v.total, 1)) * 100).toFixed(1) + '%',
        })),
        summary: { Setores: Object.keys(bySector).length, 'Total leitos': (data || []).length },
      };
    }

    case 'gestao_stay_by_sector': {
      const { data } = await supabase.from('patient_encounters')
        .select('destination_sector, created_at, outcome_date, outcome')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull)
        .not('outcome_date', 'is', null);
      const bySector: Record<string, number[]> = {};
      (data || []).forEach(r => {
        const sec = r.destination_sector || 'Não definido';
        const mins = (new Date((r as any).outcome_date).getTime() - new Date(r.created_at).getTime()) / 60000;
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

    case 'gestao_discharge_death_rate': {
      const { data } = await supabase.from('patient_encounters')
        .select('outcome')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull)
        .not('outcome', 'is', null);
      const counts: Record<string, number> = {};
      (data || []).forEach(r => {
        const o = (r as any).outcome || 'Sem desfecho';
        counts[o] = (counts[o] || 0) + 1;
      });
      const total = (data || []).length || 1;
      const labelMap: Record<string, string> = {
        alta: 'Alta', obito: 'Óbito', evasao: 'Evasão',
        internacao: 'Internação', transferencia: 'Transferência', desistencia: 'Desistência',
      };
      return {
        columns: ['Desfecho', 'Quantidade', 'Taxa %'],
        rows: Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([o, n]) => ({
          'Desfecho': labelMap[o] || o,
          'Quantidade': n,
          'Taxa %': ((n / total) * 100).toFixed(2) + '%',
        })),
        summary: {
          Total: total,
          'Taxa Óbito': (((counts.obito || 0) / total) * 100).toFixed(2) + '%',
          'Taxa Alta': (((counts.alta || 0) / total) * 100).toFixed(2) + '%',
        },
      };
    }

    case 'gestao_production_per_doctor': {
      const { data: enc } = await supabase.from('patient_encounters')
        .select('attending_doctor_name, outcome')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull)
        .not('attending_doctor_name', 'is', null);
      const { data: evo } = await supabase.from('clinical_evolutions')
        .select('created_by_name')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const byDoc: Record<string, { atendimentos: number; evolucoes: number; altas: number; obitos: number }> = {};
      (enc || []).forEach(r => {
        const d = (r as any).attending_doctor_name || 'Não informado';
        if (!byDoc[d]) byDoc[d] = { atendimentos: 0, evolucoes: 0, altas: 0, obitos: 0 };
        byDoc[d].atendimentos++;
        if ((r as any).outcome === 'alta') byDoc[d].altas++;
        if ((r as any).outcome === 'obito') byDoc[d].obitos++;
      });
      (evo || []).forEach(r => {
        const d = r.created_by_name || 'Não informado';
        if (!byDoc[d]) byDoc[d] = { atendimentos: 0, evolucoes: 0, altas: 0, obitos: 0 };
        byDoc[d].evolucoes++;
      });
      return {
        columns: ['Médico', 'Atendimentos', 'Evoluções', 'Altas', 'Óbitos'],
        rows: Object.entries(byDoc).sort((a, b) => b[1].atendimentos - a[1].atendimentos).map(([d, v]) => ({
          'Médico': d, 'Atendimentos': v.atendimentos, 'Evoluções': v.evolucoes,
          'Altas': v.altas, 'Óbitos': v.obitos,
        })),
        summary: { Médicos: Object.keys(byDoc).length },
      };
    }

    case 'gestao_nir_queue': {
      const { data } = await supabase.from('bed_allocation_requests')
        .select('*')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull)
        .order('created_at', { ascending: false });
      const SLA_MIN = 120;
      const rows = (data || []).map(r => {
        const ageMin = (Date.now() - new Date(r.created_at).getTime()) / 60000;
        const slaOk = ageMin <= SLA_MIN;
        return {
          'Status': r.status,
          'Setor Solicitado': r.requested_sector,
          'Leito': r.requested_bed || '-',
          'Médico': r.requesting_doctor_name || '-',
          'Aberta em': formatDate(r.created_at),
          'Idade (h)': (ageMin / 60).toFixed(1),
          'SLA (≤2h)': slaOk ? '✅' : '❌',
        };
      });
      const counts: Record<string, number> = {};
      (data || []).forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
      return {
        columns: ['Status', 'Setor Solicitado', 'Leito', 'Médico', 'Aberta em', 'Idade (h)', 'SLA (≤2h)'],
        rows,
        summary: { Total: (data || []).length, ...counts },
      };
    }

    case 'gestao_triage_sla': {
      const { data } = await supabase.from('pre_admissions')
        .select('patient_name, created_at, risk_classified_at, risk_classification')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const SLA_BY_COLOR: Record<string, number> = {
        vermelho: 0, laranja: 10, amarelo: 60, verde: 120, azul: 240,
      };
      let dentro = 0, fora = 0, semClass = 0;
      const rows = (data || []).map(r => {
        if (!r.risk_classified_at) {
          semClass++;
          return {
            'Paciente': r.patient_name,
            'Classificação': '-',
            'Tempo (min)': '-',
            'SLA (min)': '-',
            'Status': 'Sem classificação',
          };
        }
        const mins = (new Date(r.risk_classified_at).getTime() - new Date(r.created_at).getTime()) / 60000;
        const sla = SLA_BY_COLOR[r.risk_classification || ''] ?? 60;
        const ok = mins <= sla;
        if (ok) dentro++; else fora++;
        return {
          'Paciente': r.patient_name,
          'Classificação': r.risk_classification || '-',
          'Tempo (min)': mins.toFixed(1),
          'SLA (min)': sla,
          'Status': ok ? '✅ Dentro' : '❌ Fora',
        };
      });
      const total = dentro + fora || 1;
      return {
        columns: ['Paciente', 'Classificação', 'Tempo (min)', 'SLA (min)', 'Status'],
        rows,
        summary: {
          Total: (data || []).length,
          'Dentro do SLA': dentro,
          'Fora do SLA': fora,
          'Sem classificação': semClass,
          Aderência: ((dentro / total) * 100).toFixed(1) + '%',
        },
      };
    }


    case 'gestao_readmission_30d': {
      const startDate = new Date(startFull);
      const lookback = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from('patient_encounters')
        .select('patient_name, patient_id, encounter_code, created_at, outcome, outcome_date')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', lookback).lte('created_at', endFull)
        .order('created_at', { ascending: true });
      const byPatient: Record<string, any[]> = {};
      (data || []).forEach(r => {
        const key = r.patient_id || r.patient_name.trim().toLowerCase();
        if (!byPatient[key]) byPatient[key] = [];
        byPatient[key].push(r);
      });
      const readmissions: any[] = [];
      Object.values(byPatient).forEach(list => {
        for (let i = 1; i < list.length; i++) {
          const prev = list[i - 1];
          const curr = list[i];
          if (!prev.outcome_date) continue;
          const gapDays = (new Date(curr.created_at).getTime() - new Date(prev.outcome_date).getTime()) / 86400000;
          if (gapDays >= 0 && gapDays <= 30 && new Date(curr.created_at) >= startDate) {
            readmissions.push({
              'Paciente': curr.patient_name,
              'Atendimento Anterior': prev.encounter_code,
              'Desfecho Anterior': prev.outcome || '-',
              'Reentrada': formatDate(curr.created_at),
              'Novo Atendimento': curr.encounter_code,
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

    case 'gestao_uti_mortality': {
      const { data } = await supabase.from('patient_encounters')
        .select('patient_name, encounter_code, destination_sector, outcome, outcome_date, created_at')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const utiAll = (data || []).filter(r => /uti/i.test(r.destination_sector || ''));
      const utiDeaths = utiAll.filter(r => (r as any).outcome === 'obito');
      return {
        columns: ['Paciente', 'Código', 'Setor', 'Entrada', 'Óbito em'],
        rows: utiDeaths.map(r => ({
          'Paciente': r.patient_name,
          'Código': r.encounter_code,
          'Setor': r.destination_sector || '-',
          'Entrada': formatDate(r.created_at),
          'Óbito em': (r as any).outcome_date ? formatDate((r as any).outcome_date) : '-',
        })),
        summary: {
          'Total UTI': utiAll.length,
          Óbitos: utiDeaths.length,
          'Mortalidade UTI': ((utiDeaths.length / Math.max(utiAll.length, 1)) * 100).toFixed(2) + '%',
        },
      };
    }

    case 'gestao_transfers': {
      const { data } = await supabase.from('patient_encounters')
        .select('patient_name, encounter_code, destination_sector, outcome_date, created_at')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .eq('outcome', 'transferencia')
        .gte('created_at', startFull).lte('created_at', endFull);
      const bySector: Record<string, number> = {};
      (data || []).forEach(r => {
        const s = r.destination_sector || 'Não definido';
        bySector[s] = (bySector[s] || 0) + 1;
      });
      return {
        columns: ['Setor de Origem', 'Transferências'],
        rows: Object.entries(bySector).sort((a, b) => b[1] - a[1]).map(([s, n]) => ({
          'Setor de Origem': s, 'Transferências': n,
        })),
        summary: { Total: (data || []).length },
      };
    }

    case 'gestao_top_diagnoses': {
      const { data } = await supabase.from('admission_histories')
        .select('cid_primary, cid_secondary')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .gte('created_at', startFull).lte('created_at', endFull);
      const counts: Record<string, number> = {};
      (data || []).forEach(r => {
        [r.cid_primary, r.cid_secondary].filter(Boolean).forEach(c => {
          counts[c!] = (counts[c!] || 0) + 1;
        });
      });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
      const total = sorted.reduce((a, [, n]) => a + n, 0) || 1;
      return {
        columns: ['Posição', 'CID', 'Quantidade', '% do Top 20'],
        rows: sorted.map(([c, n], i) => ({
          'Posição': i + 1, 'CID': c, 'Quantidade': n,
          '% do Top 20': ((n / total) * 100).toFixed(1) + '%',
        })),
        summary: { 'CIDs únicos': Object.keys(counts).length },
      };
    }

    case 'gestao_nir_rejections': {
      const { data } = await supabase.from('bed_allocation_requests')
        .select('patient_id, requested_sector, requested_bed, requesting_doctor_name, rejection_reason, reviewed_at, created_at, status')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .eq('status', 'rejected')
        .gte('created_at', startFull).lte('created_at', endFull)
        .order('reviewed_at', { ascending: false });
      const motivos: Record<string, number> = {};
      (data || []).forEach(r => {
        const m = r.rejection_reason || 'Sem motivo';
        motivos[m] = (motivos[m] || 0) + 1;
      });
      return {
        columns: ['Setor Solicitado', 'Leito', 'Médico', 'Motivo', 'Aberta em', 'Rejeitada em'],
        rows: (data || []).map(r => ({
          'Setor Solicitado': r.requested_sector,
          'Leito': r.requested_bed || '-',
          'Médico': r.requesting_doctor_name || '-',
          'Motivo': r.rejection_reason || '-',
          'Aberta em': formatDate(r.created_at),
          'Rejeitada em': r.reviewed_at ? formatDate(r.reviewed_at) : '-',
        })),
        summary: { Total: (data || []).length, ...motivos },
      };
    }

    case 'gestao_cleaning_time': {
      const { data } = await supabase.from('bed_census')
        .select('sector, bed_number, cleaning_started_at, cleaning_finished_at')
        .eq('hospital_unit_id', hospitalId).eq('state_id', stateId)
        .not('cleaning_started_at', 'is', null)
        .not('cleaning_finished_at', 'is', null)
        .gte('cleaning_started_at', startFull).lte('cleaning_started_at', endFull);
      const bySector: Record<string, number[]> = {};
      (data || []).forEach(r => {
        const mins = (new Date(r.cleaning_finished_at!).getTime() - new Date(r.cleaning_started_at!).getTime()) / 60000;
        if (mins < 0 || mins > 24 * 60) return;
        if (!bySector[r.sector]) bySector[r.sector] = [];
        bySector[r.sector].push(mins);
      });
      return {
        columns: ['Setor', 'Limpezas', 'Tempo Médio (min)', 'Mínimo (min)', 'Máximo (min)'],
        rows: Object.entries(bySector).map(([s, t]) => ({
          'Setor': s, 'Limpezas': t.length,
          'Tempo Médio (min)': (t.reduce((a, b) => a + b, 0) / t.length).toFixed(1),
          'Mínimo (min)': Math.min(...t).toFixed(1),
          'Máximo (min)': Math.max(...t).toFixed(1),
        })),
        summary: { 'Total limpezas': (data || []).length },
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
