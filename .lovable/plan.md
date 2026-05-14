## Confirmação prévia

- **Setores que dispararão SAPS 3:** UTI 1, UTI 2 e UCI 2 (UCI 1 e UCC deixam de exigir).
- **Obrigatório para validar:** somente os campos que **pontuam** no SAPS 3 (Box I idade + comorbidades SAPS + LOS + origem + planejada; Box II razão + cirurgia + infecção; Box III consciência + sinais vitais + laboratoriais).
- **Não obrigatórios e não pontuam** (com aviso visual claro): Antecedentes clínicos, Hábitos de vida, Suporte hemodinâmico/Vasoativos.

---

## 1. Reestruturação da ficha SAPS 3 (`src/pages/Saps3Page.tsx`)

### Box I — separar em três blocos visuais

**Bloco 1.A — Comorbidades SAPS 3 (pontuam — obrigatório se aplicável)**
- Mantém os 8 itens atuais (Neoplasia hematológica 10, Câncer metastático 11, HIV/AIDS 8, Cirrose 4, IC NYHA IV 6, DRC 3, Imunossupressão 3, QT recente 3).
- Badge verde com pontuação ao lado do nome.
- Helper: "Marque todas que se aplicam. Estas pontuam no escore SAPS 3."

**Bloco 1.B — Antecedentes clínicos (não pontuam — opcional)**
- Banner âmbar discreto: *"Não obrigatório · Não pontua no SAPS 3 · Útil para perfil epidemiológico"*.
- Lista de checkbox rápidos: HAS, DM2, DM1, DPOC, asma, AVC prévio, IAM prévio, FA, ICC (não NYHA IV), dislipidemia, obesidade, hipotireoidismo, doença de Chagas, epilepsia, depressão/ansiedade, hepatopatia (não cirrótica), DRC não dialítica.
- Campo busca/autocomplete para acrescentar livre (texto livre, normalização NFD).

**Bloco 1.C — Hábitos de vida (não pontuam — opcional)**
- Mesmo banner âmbar.
- Tabagismo: nunca / ex / atual + maços-ano (input opcional).
- Etilismo: nunca / social / abuso / dependência.
- Drogas ilícitas: nunca / ex / atual (lista livre).

### Novo Box — Suporte hemodinâmico na admissão (não pontua — opcional)
- Posicionado entre Box II e Box III, com rótulo destacado e mesmo banner âmbar.
- Switch "Em uso de drogas vasoativas na admissão?".
- Se sim, lista com chips (Noradrenalina, Adrenalina, Vasopressina, Dobutamina, Dopamina, Milrinona) + dose (mcg/kg/min) + tempo de uso (h).
- Helper didático: *"Não entra no escore SAPS 3, mas registra o perfil hemodinâmico para o painel UTI."*

### Persistência
- Adicionar colunas JSONB em `saps3_assessments`: `clinical_history` (antecedentes), `lifestyle_habits` (hábitos), `vasoactive_drugs` (vasoativos).
- Migration cria as colunas com default `'{}'::jsonb` (não quebra registros existentes).
- `buildSapsPayload` passa a serializar os 3 novos campos. `calculateComorbidityScore` continua olhando **somente** `comorbidities` (SAPS oficial) — nada muda no escore.

### Validação no `handleSave`
- Antecedentes/hábitos/vasoativos **nunca** geram toast de erro.
- Mantém validações atuais para os campos que pontuam (consciência, laboratoriais quando preenchidos, etc.).

---

## 2. Restringir SAPS aos setores UTI 1, UTI 2 e UCI 2

Atualizar a função `isUtiSector` / `isUtiAllocation` em:
- `src/components/BedAllocationNotifications.tsx`
- `src/components/AllocationPendingBadge.tsx`

Nova lista: `["UTI 1", "UTI 2", "UCI 2", "red", "yellow", "outside"]` (UCI 1 = `blue` e UCC saem). Remover o regex amplo `^UCI\b` (passa a casar somente UCI 2 explícito).

Em `src/pages/Saps3Page.tsx`, no `UTI_SECTORS`, manter UCI 1 e UCC visíveis na lista do formulário (para casos de pendência histórica), mas o gate automático de "exigir SAPS na admissão" só roda nos 3 setores acima.

---

## 3. Corrigir navegação do alerta SAPS no Painel Clínico

**Sintoma:** ao clicar em "Finalizar SAPS 3" no banner do `/paciente`, a página abre a lista geral em vez do formulário do paciente.

**Causa:** `handleGoSaps` em `PacienteHubPage.tsx` envia apenas `patientId/Name/Bed/Sector`, mas o `useEffect` do `Saps3Page.tsx` só hidrata o formulário quando recebe `completeSapsId` (caminho A) ou `fromAllocation=true` (caminho B). Sem nenhum dos dois, cai no estado vazio.

**Correção em `PacienteHubPage.handleGoSaps`:**
1. Buscar a ficha SAPS pendente do paciente: `select id from saps3_assessments where patient_id = ctx.patientId and status = 'pending' order by created_at desc limit 1`.
2. Se encontrar, navegar com `completeSapsId={id}` + contexto do paciente.
3. Se **não** encontrar (caso raro), navegar com `fromAllocation=true&patientId=...&patientName=...` para forçar o caminho B.

Bônus de robustez no `Saps3Page` useEffect: aceitar `patientNameFromContext` sozinho como gatilho do caminho B (eliminando o requisito explícito de `fromAllocation=true`), garantindo que qualquer link com `?patientId=...&patientName=...` carregue o paciente direto.

---

## 4. Detalhes técnicos resumidos

- Migration: `ALTER TABLE saps3_assessments ADD COLUMN clinical_history jsonb DEFAULT '{}'::jsonb, ADD COLUMN lifestyle_habits jsonb DEFAULT '{}'::jsonb, ADD COLUMN vasoactive_drugs jsonb DEFAULT '{}'::jsonb;`
- Sem quebra de cálculo do escore (mortalidade preditiva permanece idêntica).
- Banner âmbar reutiliza tokens semânticos (`bg-amber-50 border-amber-300 text-amber-900`).
- `buildSapsPayload` passa a incluir os três campos novos; hidratação ao reabrir ficha pendente lê os mesmos campos.
- Toast informativo no salvamento: *"Ficha validada. Antecedentes/hábitos/vasoativos arquivados (não pontuam no SAPS)."*

---

## Confirma para eu implementar?

Posso seguir exatamente este plano, ou quer ajustar algum item antes (ex.: incluir mais comorbidades opcionais, mudar o conjunto de vasoativos, manter UCI 1 também no gate)?