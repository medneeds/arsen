

## Reformulação da Edição Avançada e Fluxo Vago/Ocupado

### Objetivo
Eliminar gestos manuais que conflitam com o fluxo automatizado de admissão/transferência/alta e reformular o diálogo de "Edição Avançada" para servir apenas de complemento aos campos não-editáveis inline (núcleo administrativo do leito), removendo redundâncias com edição inline.

---

### 1. Remoção do botão "Liberar para Preenchimento"

Hoje existe um botão (e um toggle no canto da linha) que permite manualmente alternar `is_vacant`. Isso conflita com o trigger `auto_vacate_on_discharge` já implementado, que cuida da vaga automaticamente quando o nome é esvaziado (alta) ou preenchido (admissão).

**Onde será removido:**
- `src/components/UtiPatientCard.tsx` — botão "Liberar para Preenchimento" no card de leito vago da UTI (linhas ~1014-1027) e referência interna a `handleToggleVacancy`.
- `src/components/UtiSectorSection.tsx` — toggle redondo `UserPlus`/`DoorOpen` na lateral da linha (linhas ~117-132) e função `handleToggleVacancy`.
- `src/components/PatientCard.tsx` — qualquer entry-point equivalente (se existir, será também escondido).

**Substituição visual:** o card de leito vago continuará mostrando "Leito Vago", mas em vez do botão ocupação manual, oferecerá apenas um atalho contextual:
- **"Admitir paciente"** → abre o fluxo formal (`AdmitPatientDialog` / pré-admissão) — o nome chega via admissão, e o trigger marca `is_vacant=false` automaticamente.
- O `DropdownMenu` "Excluir Leito" permanece (governança de leitos só pelo Dev Console / Personalização).

---

### 2. Reformulação completa do "Edição Avançada" (`EditPatientDialog`)

**Princípio:** o diálogo passa a tratar APENAS dos campos que **não** são editáveis inline. Tudo que já tem inline (diagnóstico, antecedentes, plano, programações, crítico, clínico, história admissional, administrativo) sai do diálogo para evitar duplicidade e confusão.

**Conteúdo novo do diálogo (3 blocos enxutos):**

1. **Identificação do Leito (somente leitura informativa)**
   - Setor, número do leito, prontuário, código de atendimento.
   - Não editável — esses dados vêm da admissão / cadastro.

2. **Dados Administrativos do Atendimento**
   - Responsável médico (link para `MedicalResponsibilityDialog`).
   - Data de admissão no setor (campo controlado, formato DD/MM/AAAA HH:MM).
   - Previsão de alta (mantém obrigatoriedade, conforme memória).
   - Setor de origem (UTI).
   - Status clínico (severidade) — único ponto centralizado.

3. **Ações de Movimentação (atalhos)**
   - Botões para abrir os fluxos formais: Transferência, Alta/Desfecho, Óbito, Reavaliar Admissão.
   - Cada botão dispara o diálogo correspondente já existente (`PatientMovementDialog`, `InternmentStatusDialog`).
   - Estes fluxos é que cuidam de zerar/limpar dados clínicos via trigger.

**Removidos do diálogo (passam a viver SOMENTE inline no card):**
- História Admissional / Anamnese (já é editável inline na seção expansível "História Admissional").
- Diagnósticos, Antecedentes, Exames Relevantes, Pendências, Plano Terapêutico, Programações.
- Dispositivos, Alergias, Culturas/ATB, Especialidades, Quadro Atual (todos já inline no `UtiPatientCard`).
- Botão "Limpar Tudo" — sai por completo. Limpeza só ocorre via fluxo de alta (trigger automático).

---

### 3. Fluxo automático de "Leito Vago"

Nada mais depende de gesto manual:

```text
Admissão formal (AdmitPatientDialog) ─► UPDATE patients SET name=..., ... 
                                        ─► trigger auto_vacate_on_discharge
                                        ─► is_vacant := false

Alta / Transferência / Óbito          ─► UPDATE patients SET name='', ...
   (PatientMovementDialog)            ─► trigger auto_vacate_on_discharge
                                        ─► is_vacant := true + limpa campos clínicos
```

O botão lateral de "alternar vago" sai. O usuário não tem mais como flipar o status diretamente; só os fluxos governados pelo backend mexem nesse estado.

---

### 4. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/EditPatientDialog.tsx` | Reescrita: 3 blocos (identificação, administrativo, ações de movimentação). Remove campos clínicos e botão "Limpar Tudo". |
| `src/components/UtiPatientCard.tsx` | Remove botão "Liberar para Preenchimento" e referências; substitui por atalho "Admitir paciente". |
| `src/components/UtiSectorSection.tsx` | Remove o `Button` toggle de vacância e `handleToggleVacancy`. Mantém checkbox de seleção e DnD desativado. |
| `src/components/PatientCard.tsx` | Remove qualquer trigger manual de `isVacant`; mantém `setIsEditDialogOpen` apontando para o novo diálogo. |
| `src/components/UtiPatientRow.tsx` | Mesmo ajuste do dialog (continua abrindo o `EditPatientDialog`, agora reformulado). |

Sem migrações de banco — o trigger `auto_vacate_on_discharge` já cobre o comportamento automático.

---

### 5. Comportamento esperado pós-mudança

- Usuário **não** consegue mais marcar/desmarcar vago manualmente no mapa.
- Clicar em "Edição Avançada" abre um diálogo curto, focado em metadados administrativos do atendimento e atalhos para os fluxos formais.
- Toda a edição clínica permanece inline no card (conforme memória `painel-clinico/inline-editing-v2`).
- Alta limpa os dados e libera o leito automaticamente; admissão preenche o leito automaticamente.

---

### Confirmações antes de executar
Para evitar retrabalho (preferência do usuário sobre mudanças estruturais), confirme:

1. **Atalho no leito vago:** ok substituir "Liberar para Preenchimento" por **"Admitir paciente"** (abre `AdmitPatientDialog`)? Ou prefere apenas mostrar "Leito Vago" sem nenhum atalho (admissão sempre via fluxo da Recepção)?
2. **Edição Avançada — bloco "Ações de Movimentação":** quer os 4 atalhos (Transferir / Alta / Óbito / Reavaliar) dentro do diálogo, ou prefere manter apenas Identificação + Administrativo e usar o menu `MoreVertical` do card para movimentações?

