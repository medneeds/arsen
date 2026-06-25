## Objetivo

Cadastrar a **Dapagliflozina 10 mg comprimido VO** no catálogo clínico como item "Extra-padronização" (fora da lista oficial HMDM 2026), com evidência farmacêutica preenchida para alimentar o `PosologySuggestionsBar` da prescrição.

## Achados da investigação

- `medication_catalog` não contém nenhum iSGLT2 hoje. Classe "Hipoglicemiante / Insulina" tem só: Glibenclamida, Glicazida, Metformina, Insulinas NPH/Regular.
- Memory `pharmacy-hmdm-2026-catalog` define o padrão dos 222 itens importados (`notes='HMDM 2026'`). Para preservar a integridade dessa lista, novos cadastros fora dela devem ir com `notes='Extra-padronização'`.
- O catálogo já é editável pela tela `/catalogo-medicamentos` (admin + farmácia), via memory `medication-catalog-inline-evidence-edit`.

## O que será feito

### 1. Insert em `medication_catalog` (1 linha)

| Campo | Valor |
|---|---|
| `generic_name` | Dapagliflozina |
| `therapeutic_class` | Hipoglicemiante / Insulina |
| `pharmacological_group` | Inibidor de SGLT2 |
| `controlled` | false |
| `high_alert` | false |
| `requires_dilution` | false |
| `notes` | Extra-padronização |

ID determinístico fora da faixa HMDM (`00000000-0000-4000-8000-000000000001`–`222`) para evitar colisão — usar `gen_random_uuid()` direto.

### 2. Insert em `medication_presentations` (1 linha)

| Campo | Valor |
|---|---|
| `form` | Comprimido |
| `concentration` | 10 mg |
| `unit` | mg |
| `route` | VO |
| `standard_dilution` | — (não se aplica, VO) |
| `max_daily_dose` | 10 mg/dia |
| `infusion_time` | — |
| `iv_bolus` | false |
| `pharmacy_suggestion_enabled` | true |

### 3. Observações clínicas (campo `instructions` do protocolo gerado)

O `presentationToProtocol()` (em `useMedicationProtocols.ts`) já concatena `max_daily_dose` em `instructions`. Para incluir alertas de segurança (TFG, cetoacidose euglicêmica) sem alterar código, vou colocar tudo no campo `max_daily_dose` em formato texto:

> `10 mg 1x/dia · Suspender se TFG<25 (DM2) / <20 (IC) · Alerta: risco de cetoacidose euglicêmica — suspender 3 dias antes de cirurgia/jejum`

Assim a sugestão "Padrão (Comprimido)" aparece na barra de posologia ao adicionar Dapagliflozina, com a observação completa.

## Camadas tocadas

- **Dados**: `medication_catalog` (+1 linha), `medication_presentations` (+1 linha) via `supabase--insert`.
- **Layout / Movimentação / Auditoria**: nenhuma mudança.

## Camadas NÃO tocadas

- Nenhum arquivo de código (`src/**`, `supabase/functions/**`).
- Nenhuma migration de schema.
- Demais itens do catálogo HMDM 2026 permanecem intactos.
- `posologyProtocols.ts` manual não é alterado — sugestão sai do banco via cache do `useMedicationProtocols`.

## Como o médico verá

Ao digitar "dapa" na busca da Prescrição:
1. Aparece "Dapagliflozina" como resultado.
2. Ao adicionar, o `PosologySuggestionsBar` mostra chip **"Padrão (Comprimido)"** com dose máx. e alerta de TFG/cetoacidose.
3. Posologia padrão sugerida: 1 cp VO 1x/dia (médico ajusta).

## Próximos passos (não incluídos neste plano)

Se aprovar, posso depois:
- Cadastrar outros iSGLT2 (Empagliflozina, Canagliflozina) no mesmo padrão.
- Cadastrar análogos GLP-1 (Liraglutida, Semaglutida, Dulaglutida).
- Marcar o item como "uso restrito/compra externa" via novo campo (exige migration — pedirei aprovação separada).