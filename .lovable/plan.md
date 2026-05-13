# Fluxo Pré-admissão → Admissão Hospitalar

## Conceito

Separar dois momentos hoje fundidos em "admitir":

1. **Pré-admissão** (Mapa de Pacientes): aloca o paciente no leito + inicia SAPS 3 (quando UTI/UCI). Status: `pre_admitido`.
2. **Admissão Hospitalar** (Painel Clínico): médico assistente preenche a admissão clínica completa. Status: `admitido`. Conta como **D0** de internação.

## 1. Mapa de Pacientes — renomear

- Botão/ação "Admitir em leito" → **"Pré-admitir em leito"**
- Dialog mantém escolha de leito + abre SAPS 3 parcial se setor ∈ {UTI, UCI, Neuro}
- Ao confirmar: cria registro com `admission_status = 'pre_admitido'`, sem D0, sem liberar prescrição/evolução de rotina
- Toast: "Paciente PRÉ-ADMITIDO no leito X. Conclua a admissão pelo Painel Clínico."

## 2. Painel Clínico — estado pré-admitido

Quando `admission_status === 'pre_admitido'`:

- **Header sticky**: banner âmbar pulsante "PRÉ-ADMITIDO — admissão hospitalar pendente" + botão primário grande **"ADMITIR PACIENTE"** (verde esmeralda).
- **Overlay bloqueante** sobre os cards: Prescrição, Diagnósticos, Previsão de alta, Dia de internação, Pendências, Plano terapêutico. Cada card recebe um overlay translúcido com cadeado + texto "Disponível após admissão hospitalar" + CTA "Admitir agora".
- Permanecem acessíveis: Identidade, SAPS 3 (para finalizar), Documentos (uploads), Sinais vitais admissionais.
- Tipo de admissão é **derivado do setor do leito**: setor ∈ UTI/UCI → form UTI; demais → form Enfermaria.

## 3. Formulário de Admissão Hospitalar

Aberto pelo botão "ADMITIR PACIENTE". Dialog full-screen com tabs.

### Seções comuns (UTI e Enfermaria)

- Data/hora da admissão (default: agora)
- HDA — História da Doença Atual
- AMP — Antecedentes Mórbidos Pessoais
- MUC — Medicamentos de Uso Contínuo
- Alergias medicamentosas
- Antropometria (peso, altura)
- SSVV admissionais (PA, FC, FR, SatO₂, Tax, Dx)
- Exame físico dirigido (estado geral, CV, resp, abdome, extremidades)
- Exames lab/imagem disponíveis na admissão
- Pareceres
- Plano terapêutico inicial
- **CID primário** (obrigatório) + secundários
- **Previsão de alta** (obrigatório)
- Responsável médico (auto-preenchido)

### Extras UTI/UCI

- Motivo de internação UTI
- Origem (setor anterior)
- Dispositivos invasivos
- Culturas pendentes / antibióticos em curso
- Especialidades em conjunto
- Confirmação SAPS 3 finalizado (link para preencher se faltar)

### Validações

- Bloqueia salvar sem: HDA, exame físico, plano, CID primário, previsão de alta
- Em UTI: bloqueia também sem SAPS 3 finalizado

## 4. Persistência da Admissão

Salvar grava em **duas estruturas**:

1. `admission_histories` (estrutura clínica completa para reuso/relatórios) — já existe, ampliar campos JSONB.
2. `clinical_evolutions` com novo `evolution_type = 'admission'`:
   - Aparece como **primeiro registro** na timeline
   - Rótulo: **"ADMISSÃO HOSPITALAR"**
   - Visual distinto: cor verde-esmeralda, ícone hospital, badge "D0"
   - Status: `validated` ao assinar
   - **Pode ser suspensa** com justificativa obrigatória (mesmo padrão das evoluções) → ao suspender, paciente volta para `pre_admitido` e nova admissão pode ser criada
   - Não-editável após assinar (apenas adendo + suspensão+nova)

Ao salvar com sucesso:
- `admission_status = 'admitido'`
- `admission_at = now()` (origem do D0)
- Overlays liberados, cards normais
- Toast: "Admissão hospitalar registrada — paciente ADMITIDO."

## 5. Detalhes técnicos

### Banco
- `bed_census` / patient registry: adicionar coluna `admission_status text default 'pre_admitido'` com check ('pre_admitido','admitido','suspenso')
- `admission_histories`: adicionar campos JSONB para HDA estruturada, exame físico, antropometria, SSVV admissionais, dispositivos, culturas (compatibilizar com texto livre existente)
- `clinical_evolutions.soap_data` ganha `evolution_type` ('soap'|'admission'); ou nova coluna dedicada
- Trigger: ao inserir evolution_type='admission' validated → atualizar admission_status do paciente
- Trigger: ao suspender evolution_type='admission' → reverter para 'pre_admitido'

### Frontend
- Novo componente `AdmissionDialog` (form completo, tabs UTI/Enfermaria derivados do setor)
- Novo componente `PreAdmissionOverlay` para os cards bloqueados
- `PainelClinicoPage`: ler `admission_status` e ramificar render
- Renomear textos no Mapa: "Admitir" → "Pré-admitir em leito"
- Hook `useAdmissionStatus(patientId)` central
- `EvolutionTimeline`: renderizar tipo "admission" com estilo próprio + badge D0 + ação "Suspender admissão"

### Memória
- Atualizar `mem://features/admission-workflow-logic` e criar `mem://features/admission-pre-vs-hospitalar` documentando o fluxo em 2 etapas.

## Entregáveis em ordem

1. Migração de schema (admission_status, evolution_type, triggers)
2. Renomeação no Mapa + ajuste do dialog de pré-admissão
3. Detecção de status no Painel Clínico + overlays bloqueantes + botão Admitir
4. AdmissionDialog (UTI + Enfermaria) com persistência dupla
5. Timeline de evoluções com tipo "admission" + suspensão com justificativa
6. Atualização de memórias

## Confirmar antes de executar

- OK começar por (1) migração + (2) renomeação como primeiro PR, depois seguir para os demais?
- Algum campo da admissão que você quer adicionar/remover do que listei acima?
