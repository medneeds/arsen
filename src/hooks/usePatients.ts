// @ts-ignore - React module/types are resolved by the app build environment
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Patient, SectorType, isSectorType } from "@/types/patient";
import { useToast } from "@/hooks/use-toast";
import { Department } from "@/contexts/DepartmentContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useAuth } from "@/contexts/AuthContext";
import { isExtraBed } from "@/utils/bedNaming";
import { formatAge } from "@/lib/patientAge";

export const GHOST_PREFIXES = ['ARQ-', 'ARCHIVED-', '_GHOST_'];

/** Leito residual/arquivado que nunca deve aparecer em listas ou mapas.
 *  (A policy RLS "Ghost beds hidden from clients" já os esconde no banco;
 *  este helper é defesa em profundidade para dados em cache.) */
export const isGhostBed = (bedNumber?: string | null) => {
  const bn = (bedNumber || '').toUpperCase();
  return GHOST_PREFIXES.some(prefix => bn.startsWith(prefix));
};

// MIGRAÇÃO: campos multilinha do modelo antigo eram texto separado por '\n'.
// As colunas equivalentes em `internacoes` mantêm o mesmo formato.
const splitLines = (value?: string | null): string[] =>
  value ? value.split('\n').filter(Boolean) : [];

export function usePatients(department?: Department, sector?: string) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { currentState, currentHospital } = useHospital();
  const { user } = useAuth();

  // MIGRAÇÃO (profissionais.id ≠ auth.uid): resolve o id do profissional a
  // partir do user_id do Auth, necessário para colunas *_por (FK profissionais).
  const resolveProfissionalId = async (userId?: string | null): Promise<string | null> => {
    if (!userId) return null;
    const { data } = await supabase
      .from('profissionais')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    return (data as any)?.id ?? null;
  };

  // MIGRAÇÃO central: o "paciente" do mapa de leitos é, na prática, o cruzamento
  // leito × internação ativa. Cada leito do hospital vira UMA entrada Patient
  // (ocupada, se houver internação com data_alta IS NULL; senão, vaga).
  const mapLeitoToPatient = (leito: any): Patient => {
    const setor = leito?.setor ?? null;
    const internacoes: any[] = Array.isArray(leito?.internacoes) ? leito.internacoes : [];
    // Internação ativa = data_alta ainda nula (seleção em JS para não depender de
    // filtro em recurso aninhado).
    const active = internacoes.find((i) => i && i.data_alta == null) ?? null;
    const pac = active?.paciente ?? null;

    // MIGRAÇÃO: Patient.sector é SectorType (código). setores.tipo carrega o
    // código do tipo de setor; setores.nome é rótulo de exibição. Usamos `tipo`
    // (cai para nome só se por acaso já for um SectorType válido).
    const sectorCode = (isSectorType(setor?.tipo)
      ? setor.tipo
      : (isSectorType(setor?.nome) ? setor.nome : setor?.tipo)) as SectorType;

    return {
      id: active ? active.id : leito.id, // ocupado → internacoes.id; vago → leitos.id
      bedNumber: leito.numero,
      name: pac ? (pac.nome_social || pac.nome_completo || '') : '',
      registryId: pac?.id ?? null, // MIGRAÇÃO: registryId aponta para pacientes.id (patient_registry morto)
      age: formatAge(pac?.data_nascimento) || '',
      sector: sectorCode,
      sectorName: setor?.nome ?? undefined, // MIGRAÇÃO: nome real do setor (filtro do mapa por setor do banco)
      diagnoses: splitLines(active?.hipotese_diagnostica),
      medicalHistory: splitLines(active?.historia_clinica),
      relevantExams: splitLines(active?.exames_relevantes),
      pendencies: splitLines(active?.pendencias),
      highlightedPendencies: [], // MIGRAÇÃO: sem coluna de destaques no schema novo
      highlightedDiagnoses: [], // MIGRAÇÃO: idem
      highlightedMedicalHistory: [], // MIGRAÇÃO: idem
      highlightedConducts: [], // MIGRAÇÃO: idem
      schedule: splitLines(active?.agenda),
      admissionHistory: '', // MIGRAÇÃO: sem coluna equivalente → default vazio
      admissionDate: active?.data_entrada || '',
      medicalResponsibility: undefined, // MIGRAÇÃO: sem coluna equivalente
      displayOrder: 0, // MIGRAÇÃO: sem coluna display_order no schema novo
      createdBy: undefined, // MIGRAÇÃO: internacoes.registrado_por é profissionais.id, não user_id → não exposto como createdBy
      internmentStatus: (active?.status as Patient['internmentStatus']) ?? null,
      internmentNotes: null, // MIGRAÇÃO: sem coluna equivalente
      isDoorPatient: false, // MIGRAÇÃO: sem coluna equivalente
      allocationStatus: null, // MIGRAÇÃO: sem coluna equivalente
      // MIGRAÇÃO: bloco uti_* inteiro sem colunas no schema novo → default vazio.
      utiAdmissionDate: [],
      utiDischargePrediction: [],
      utiAllergies: [],
      utiAdmissionReason: [],
      utiCurrentStatus: [],
      utiDevices: [],
      utiCulturesAntibiotics: [],
      utiSpecialties: [],
      utiOriginSector: [],
      utiDailyConducts: [],
      psmStatus: null, // MIGRAÇÃO: sem coluna equivalente
      clinicalStatus: active ? 'regular' : null, // MIGRAÇÃO: sem coluna → default "regular" (spec)
      isVacant: !active,
      admissionStatus: undefined, // MIGRAÇÃO: sem coluna equivalente
      admittedAt: active?.data_entrada ?? null,
    };
  };

  const fetchPatients = async () => {
    try {
      if (!currentHospital || !currentState) {
        setIsLoading(false);
        return;
      }

      // Bed map = leitos do hospital (via setores → alas → hospitais), cada um
      // com sua internação ativa (data_alta IS NULL), se houver.
      // (cast por causa do filtro em caminho aninhado — padrão do projeto.)
      const { data, error } = await (supabase
        .from('leitos')
        .select(`
          id, numero, status, tipo, setor_id, motivo_bloqueio,
          setor:setores!inner (
            id, nome, tipo, ala_id,
            ala:alas!inner ( id, hospital_id )
          ),
          internacoes (
            id, status, data_entrada, data_alta, queixa_principal, historia_clinica,
            hipotese_diagnostica, conduta_inicial, exames_relevantes, pendencias, agenda,
            setor_classificacao_id, leito_id, paciente_id, registrado_por,
            paciente:pacientes (
              id, nome_completo, nome_social, cpf, cns, data_nascimento, sexo,
              nome_mae, telefone, endereco, tipo_sanguineo, alergias, comorbidades, prontuario
            )
          )
        `) as any)
        .eq('setor.ala.hospital_id', currentHospital.id);

      if (error) throw error;

      let rows = (data || []) as any[];

      // MIGRAÇÃO: o filtro antigo por `sector` (código) / `department` (rótulo)
      // não tem coluna direta. Filtramos pelo setor do leito: por `tipo` (código
      // SectorType) ou `nome`. Quando só há `department`, tentamos casar por
      // setores.nome (best-effort — não há coluna department no schema novo).
      if (sector) {
        rows = rows.filter(
          (r) => r.setor?.tipo === sector || r.setor?.nome === sector,
        );
      } else if (department) {
        rows = rows.filter((r) => r.setor?.nome === department);
      }

      const mappedPatients: Patient[] = rows
        .filter((leito) => !isGhostBed(leito.numero))
        .map(mapLeitoToPatient);

      // Ordena por número do leito (numérico). MIGRAÇÃO: sem display_order.
      const extractNumber = (bedNumber: string) => {
        const match = (bedNumber || '').match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      const sortedPatients = mappedPatients.sort(
        (a, b) => extractNumber(a.bedNumber) - extractNumber(b.bedNumber),
      );

      setPatients(sortedPatients);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast({
        title: "Erro ao carregar pacientes",
        description: `Não foi possível carregar os dados dos pacientes.${error instanceof Error && error.message ? ` Motivo: ${error.message}` : ''}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePatient = async (patientId: string, updates: Partial<Patient>) => {
    try {
      const target = patients.find((p) => p.id === patientId);

      // Campos clínicos da internação.
      const internacaoUpdates: Record<string, any> = {};
      if (updates.diagnoses !== undefined) internacaoUpdates.hipotese_diagnostica = updates.diagnoses.join('\n');
      if (updates.medicalHistory !== undefined) internacaoUpdates.historia_clinica = updates.medicalHistory.join('\n');
      if (updates.relevantExams !== undefined) internacaoUpdates.exames_relevantes = updates.relevantExams.join('\n');
      if (updates.pendencies !== undefined) internacaoUpdates.pendencias = updates.pendencies.join('\n');
      if (updates.schedule !== undefined) internacaoUpdates.agenda = updates.schedule.join('\n');
      if (updates.internmentStatus !== undefined) internacaoUpdates.status = updates.internmentStatus;

      // Campos de cadastro do paciente.
      const pacienteUpdates: Record<string, any> = {};
      // MIGRAÇÃO: `name` é derivado (nome_social || nome_completo); ao gravar,
      // atualizamos nome_completo.
      if (updates.name !== undefined) pacienteUpdates.nome_completo = updates.name;

      // Campos do leito.
      const leitoUpdates: Record<string, any> = {};
      if (updates.bedNumber !== undefined) leitoUpdates.numero = updates.bedNumber;

      // MIGRAÇÃO: campos sem coluna no schema novo — NÃO gravados (mantidos só no
      // estado local para a UI): age, highlighted*, medicalResponsibility,
      // displayOrder, todo o bloco uti_*, psmStatus, clinicalStatus, isVacant,
      // admissionHistory, sector, allocationStatus, isDoorPatient.
      // admission_date permanece IMUTÁVEL via updatePatient (regra pré-migração).

      const isOccupied = target ? !target.isVacant : true;

      if (isOccupied && Object.keys(internacaoUpdates).length > 0) {
        const { error } = await supabase
          .from('internacoes')
          .update(internacaoUpdates)
          .eq('id', patientId); // patientId = internacoes.id quando ocupado
        if (error) throw error;
      }

      if (
        isOccupied &&
        (Object.keys(pacienteUpdates).length > 0 || Object.keys(leitoUpdates).length > 0)
      ) {
        // Precisamos de paciente_id / leito_id — não estão no view-model Patient.
        const { data: intc } = await supabase
          .from('internacoes')
          .select('paciente_id, leito_id')
          .eq('id', patientId)
          .maybeSingle();
        const paciente_id = (intc as any)?.paciente_id;
        const leito_id = (intc as any)?.leito_id;
        if (paciente_id && Object.keys(pacienteUpdates).length > 0) {
          const { error } = await supabase.from('pacientes').update(pacienteUpdates).eq('id', paciente_id);
          if (error) throw error;
        }
        if (leito_id && Object.keys(leitoUpdates).length > 0) {
          const { error } = await supabase.from('leitos').update(leitoUpdates).eq('id', leito_id);
          if (error) throw error;
        }
      }

      if (!isOccupied && Object.keys(leitoUpdates).length > 0) {
        // Leito vago: patientId = leitos.id.
        const { error } = await supabase.from('leitos').update(leitoUpdates).eq('id', patientId);
        if (error) throw error;
      }

      console.log('Updating patient:', patientId); // dados clínicos NÃO são logados (LGPD)

      setPatients(prev => prev.map(p =>
        p.id === patientId ? { ...p, ...updates } : p
      ));

      toast({
        title: "Paciente atualizado",
        description: "As informações foram salvas com sucesso.",
      });
    } catch (error) {
      console.error('Error updating patient:', error);
      toast({
        title: "Erro ao atualizar",
        description: `Não foi possível salvar as alterações.${error instanceof Error && error.message ? ` Motivo: ${error.message}` : ''}`,
        variant: "destructive",
      });
      throw error;
    }
  };

  const createPatient = async (patient: Omit<Patient, 'id'>, _departmentValue?: Department) => {
    try {
      if (!currentHospital || !currentState) {
        throw new Error('Hospital unit and state must be selected');
      }

      // Resolve o setor (do hospital atual) que corresponde ao código/rótulo do leito.
      const { data: setoresData, error: setoresError } = await (supabase
        .from('setores')
        .select('id, nome, tipo, ala:alas!inner(hospital_id)') as any)
        .eq('ala.hospital_id', currentHospital.id);
      if (setoresError) throw setoresError;

      const wanted = patient.sector as string;
      const setorMatch = ((setoresData || []) as any[]).find(
        (s) => s.tipo === wanted || s.nome === wanted,
      );
      if (!setorMatch) {
        throw new Error(`Setor "${wanted}" não encontrado no hospital atual.`);
      }

      const criadoPor = await resolveProfissionalId(user?.id);

      // MIGRAÇÃO: createPatient agora cria um LEITO (leitos são a nova unidade
      // física). A admissão clínica (paciente + internação) NÃO é criada aqui —
      // pacientes.prontuario é obrigatório e não há gerador de prontuário
      // disponível neste hook; a admissão pertence ao fluxo dedicado. Os campos
      // clínicos recebidos em `patient` NÃO são persistidos (só ecoados na UI).
      const { data: leito, error } = await supabase
        .from('leitos')
        .insert({
          numero: patient.bedNumber,
          setor_id: setorMatch.id,
          status: 'livre',
          tipo: 'comum', // MIGRAÇÃO: sem mapeamento de tipo de leito → default "comum"
          criado_por: criadoPor,
        })
        .select()
        .single();

      if (error) throw error;

      const newPatient: Patient = {
        // Leito recém-criado (vago): id = leitos.id.
        ...(patient as Patient),
        id: (leito as any).id,
        bedNumber: (leito as any).numero,
        sector: patient.sector,
        isVacant: true,
        createdBy: user?.id || undefined,
      };

      setPatients(prev => [...prev, newPatient]);

      toast({
        title: "Leito criado",
        description: `Leito ${newPatient.bedNumber} adicionado com sucesso.`,
      });

      return newPatient;
    } catch (error) {
      console.error('Error creating patient:', error);
      toast({
        title: "Erro ao criar leito",
        description: `Não foi possível adicionar o leito.${error instanceof Error && error.message ? ` Motivo: ${error.message}` : ''}`,
        variant: "destructive",
      });
      throw error;
    }
  };

  // IMPORTANT: leitos são fixos. "Excluir" um leito fixo não remove a linha —
  // encerra a internação ativa (data_alta) e devolve o leito à higienização,
  // mantendo-o disponível como vago no mapa. Leitos EXTRA (macas) são removidos.
  const deletePatient = async (patientId: string, options = { showToast: true, updateLocalState: true }) => {
    try {
      const target = patients.find((p) => p.id === patientId);
      const bedNumberUpper = (target?.bedNumber || '').toUpperCase();
      const isExtra = target
        ? (isExtraBed(target.bedNumber)
            || bedNumberUpper.startsWith('_GHOST_')
            || bedNumberUpper.startsWith('ARCHIVED-'))
        : false;

      // MIGRAÇÃO: a RPC `archive_patient_bed_data` e as checagens em
      // `patient_encounters` / `patient_movements` (tabelas mortas) foram
      // removidas. O histórico clínico agora fica preservado na própria
      // internação encerrada (data_alta preenchida) e nas tabelas filhas
      // (evolucoes, sinais_vitais, ...) que continuam apontando para ela.

      if (target && !target.isVacant) {
        // Ocupado → patientId = internacoes.id. Encerra a internação e obtém o leito.
        const { data: closed, error } = await supabase
          .from('internacoes')
          .update({ data_alta: new Date().toISOString(), status: 'alta' })
          .eq('id', patientId)
          .select('leito_id')
          .maybeSingle();
        if (error) throw error;

        const leitoId = (closed as any)?.leito_id;
        if (leitoId) {
          if (isExtra) {
            // Leito extra: libera e remove a linha do leito.
            await supabase.from('leitos').delete().eq('id', leitoId);
          } else {
            await supabase.from('leitos').update({ status: 'higienizacao' }).eq('id', leitoId);
          }
        }
      } else if (isExtra) {
        // Leito extra VAGO → patientId = leitos.id: remove a linha do leito.
        const { error } = await supabase.from('leitos').delete().eq('id', patientId);
        if (error) throw error;
      } else {
        // Leito fixo já vago → apenas garante status vago (patientId = leitos.id).
        const { error } = await supabase.from('leitos').update({ status: 'livre' }).eq('id', patientId);
        if (error) throw error;
      }

      if (options.updateLocalState) {
        if (isExtra) {
          setPatients(prev => prev.filter(p => p.id !== patientId));
        } else {
          setPatients(prev => prev.map(p => (
            p.id === patientId
              ? ({
                  ...p,
                  name: '',
                  diagnoses: [],
                  medicalHistory: [],
                  relevantExams: [],
                  pendencies: [],
                  schedule: [],
                  admissionHistory: '',
                  isVacant: true,
                } as unknown as Patient)
              : p
          )));
        }
      }

      if (options.showToast) {
        toast({
          title: isExtra ? "Leito extra excluído" : "Leito desocupado",
          description: isExtra
            ? `${target?.bedNumber ?? 'Leito'} foi removido do setor.`
            : "Os dados do paciente foram removidos. O leito permanece disponível no mapa.",
        });
      }
    } catch (error) {
      console.error('Error vacating/deleting bed:', error);
      if (options.showToast) {
        toast({
          title: "Erro ao excluir",
          description: `Não foi possível excluir o leito.${error instanceof Error && error.message ? ` Motivo: ${error.message}` : ''}`,
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  /**
   * Libera o leito de um paciente pré-admissão / pós-alta sinalizada.
   * MIGRAÇÃO: a auditoria em `patient_movements` (tabela morta) foi trocada por
   * um registro em `logs_auditoria`. A RPC `archive_patient_bed_data` e a
   * ramificação por `patients.admission_status` (coluna inexistente) foram
   * removidas — a função encerra a internação, libera o leito e audita.
   */
  const releaseBedPreAdmission = async (
    patientId: string,
    opts: { reason?: string; reasonNote?: string } = {},
  ) => {
    try {
      if (!currentHospital || !currentState) {
        throw new Error('Hospital e estado precisam estar selecionados.');
      }
      const target = patients.find((p) => p.id === patientId);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const profissionalId = await resolveProfissionalId(authUser?.id);

      let leitoId: string | null = null;
      let pacienteId: string | null = null;

      if (target && !target.isVacant) {
        // Ocupado → patientId = internacoes.id. Encerra a internação.
        const { data: closed, error } = await supabase
          .from('internacoes')
          .update({ data_alta: new Date().toISOString(), status: 'alta' })
          .eq('id', patientId)
          .select('leito_id, paciente_id')
          .maybeSingle();
        if (error) throw error;
        leitoId = (closed as any)?.leito_id ?? null;
        pacienteId = (closed as any)?.paciente_id ?? null;
      } else {
        // Vago → patientId = leitos.id.
        leitoId = patientId;
      }

      if (leitoId) {
        const { error: leitoErr } = await supabase.from('leitos').update({ status: 'livre' }).eq('id', leitoId);
        if (leitoErr) throw leitoErr;
      }

      // Auditoria da liberação em logs_auditoria.
      const motivo = [opts.reason || 'Liberação de leito', opts.reasonNote]
        .filter(Boolean)
        .join(' — ');
      await supabase.from('logs_auditoria').insert({
        tipo_evento: 'liberacao_leito',
        nome_tabela: 'internacoes',
        registro_id: patientId,
        internacao_id: target && !target.isVacant ? patientId : null,
        paciente_id: pacienteId,
        ator_user_id: authUser?.id ?? null,
        profissional_id: profissionalId,
        motivo: motivo || null,
        hospital_id: currentHospital.id,
      } as any);

      setPatients((prev) =>
        prev.map((p) =>
          p.id === patientId
            ? ({
                ...p,
                name: '',
                diagnoses: [],
                medicalHistory: [],
                relevantExams: [],
                pendencies: [],
                schedule: [],
                admissionHistory: '',
                age: '',
                medicalResponsibility: undefined,
                utiAdmissionDate: [],
                utiDischargePrediction: [],
                utiAllergies: [],
                utiAdmissionReason: [],
                utiCurrentStatus: [],
                utiDevices: [],
                utiCulturesAntibiotics: [],
                utiSpecialties: [],
                utiOriginSector: [],
                utiDailyConducts: [],
                psmStatus: null,
                clinicalStatus: null,
                admissionDate: '',
                admissionStatus: undefined,
                admittedAt: null,
                isVacant: true,
              } as unknown as Patient)
            : p,
        ),
      );

      toast({
        title: 'Leito liberado',
        description: 'Leito desocupado no mapa. O prontuário do paciente foi preservado no histórico.',
      });
    } catch (error) {
      console.error('Error releasing pre-admission bed:', error);
      toast({
        title: 'Erro ao liberar leito',
        description: 'Não foi possível liberar a pré-admissão.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const reorderPatients = async (reorderedPatients: Patient[]) => {
    // MIGRAÇÃO: não existe coluna display_order no schema novo. A reordenação
    // passa a ser apenas otimista/local (não persistida). Assinatura preservada.
    const updates = reorderedPatients.map((patient, index) => ({
      id: patient.id,
      display_order: index,
    }));

    setPatients(prev => {
      const updatedPatients = prev.map(p => {
        const orderUpdate = updates.find(u => u.id === p.id);
        return orderUpdate ? { ...p, displayOrder: orderUpdate.display_order } : p;
      });
      return updatedPatients.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    });
  };

  useEffect(() => {
    if (!currentHospital || !currentState) return;

    fetchPatients();

    // PERF: a query do mapa (leitos + joins) custa ~1s por request contra o
    // gateway (HTTP/1.1 + TLS caro na VPS). Antes, CADA evento de realtime
    // disparava um refetch imediato — numa operação ativa (várias internações/
    // leitos mudando) isso recarregava o mapa a cada segundo, travando a tela.
    // Agora os eventos são COALESCIDOS: uma rajada de mudanças vira um único
    // refetch após um curto intervalo de silêncio (debounce).
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        fetchPatients();
      }, 800);
    };

    // MIGRAÇÃO realtime: canal antigo em `patients` trocado por `internacoes` +
    // `leitos`. O payload não traz os joins (setor/paciente), então cada evento
    // agenda um refetch debounced (mais simples e robusto que o mapper incremental).
    const channelName = `patients-changes-${currentHospital.id}-${sector || department || 'all'}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internacoes' },
        () => { scheduleRefetch(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leitos' },
        () => { scheduleRefetch(); },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[usePatients] Realtime SUBSCRIBED — mapa atualiza em tempo real');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[usePatients] Realtime problema:', status, '— fazendo refetch manual');
          scheduleRefetch();
        }
      });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [department, sector, currentHospital, currentState]);

  return {
    patients,
    isLoading,
    updatePatient,
    createPatient,
    deletePatient,
    releaseBedPreAdmission,
    reorderPatients,
    refetch: fetchPatients,
  };
}
