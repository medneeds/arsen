## Entendimento

Hoje a aba **Mesclagens** do Dev Console mostra só o histórico (`patient_merge_audit`). Você quer um **diagnosticador ativo** dentro dela:

1. **Varrer** prontuários em busca de duplicatas.
2. **Segmentar** o resultado por **setor** (e por critério de match).
3. **Agir** caso a caso (abrir o wizard `/mesclar-prontuarios`) **ou** em bloco quando o match é cirurgicamente seguro.

O wizard de mesclagem que já existe **não muda**. A aba ganha um modo "Diagnóstico" acima do histórico atual.

---

## Contrato (4 camadas)

- **Layout** — só `MergesTab.tsx` (1 arquivo). Ganha 2 sub-abas internas: **Diagnóstico** (novo) e **Histórico** (já existe).
- **Dados** — 1 RPC nova `scan_duplicate_registries(p_sector_code text default null, p_match_mode text default 'strict')` retornando grupos de duplicatas. Zero alteração de tabela, zero coluna nova.
- **Movimentação** — zero. Varredura é só leitura. Ação 1-a-1 redireciona ao wizard. Ação em bloco chama `merge_patient_registries` já existente, 1 mesclagem por vez dentro de uma transação por par.
- **Auditoria** — toda mesclagem (1-a-1 ou bloco) passa pelo RPC `merge_patient_registries`, que já registra `patient_merge_audit` + `patient_registry_edit_history`. Bloco escreve 1 linha extra em `patient_merge_audit` com `action='bulk_merge_batch'` agrupando os pares por `batch_id` para auditoria do lote.

---

## Critérios de match (segmentados, transparentes)

Cada grupo de duplicatas vem **rotulado com a regra** que disparou — o usuário sabe o porquê.

| Regra | Critério | Confiança | Default |
|---|---|---|---|
| **R1 CPF idêntico** | CPF não-nulo + igual entre 2+ registros | Altíssima | ✅ |
| **R2 CNS idêntico** | CNS não-nulo + igual | Altíssima | ✅ |
| **R3 Nome + DOB + Mãe** | nome normalizado (NFD upper) + DOB + nome da mãe normalizado, todos iguais | Alta | ✅ |
| **R4 Nome + DOB** | nome + DOB iguais, sem mãe | Média | ✅ |
| **R5 Prontuário legado igual** | `numero_prontuario_legado` igual entre 2+ | Média (depende da unidade) | ✅ |
| **R6 Nome similar + DOB** | `similarity(nome) ≥ 0.85` + DOB igual (pg_trgm) | Baixa — só sugestão | ⛔ off por padrão |

R6 fica desligada por padrão (toggle "Incluir similaridade fonética"). Sem alucinação.

---

## Segmentação por setor

Filtro de setor lê **o leito ATUAL** de cada registry via `patients.bed_number` → `sector_code`. Opções:

- **Todos os setores** (default — visão global da plataforma)
- **Setor específico** (dropdown reusa `hospitalSectors.ts`)
- **Sem leito ativo** (apenas registries sem `patients` alocado)
- **Apenas ambos com leito** (casos críticos que bloqueiam a mesclagem direta)

O filtro de setor compõe com o filtro de regra (R1…R6) e com busca textual livre.

---

## UX da sub-aba "Diagnóstico"

```text
┌─ Barra de filtros ───────────────────────────────────────────────┐
│ [Setor ▾] [Regras: R1✓ R2✓ R3✓ R4✓ R5✓ R6☐] [□ Sem leito]      │
│ [🔍 Buscar nome/CPF/CNS]              [↻ Rodar varredura]        │
└──────────────────────────────────────────────────────────────────┘

┌─ KPIs do scan ───────────────────────────────────────────────────┐
│ 24 grupos · 53 registros duplicados · 18 com leito · 6 críticos │
└──────────────────────────────────────────────────────────────────┘

┌─ Grupo #1 · R1 CPF idêntico · UTI 2 · 2 registros ─── [Expandir]┐
│ ANTONIO REGINALDO · CPF 123.456.789-00                           │
│ ├─ Registry A · prontuário 178085-1 · leito L15 UTI 2 · ativo   │
│ └─ Registry B · prontuário 1780851 · sem leito · criado 12/03   │
│ [Sugerido: vencedor A (com leito) · arquivar B]                  │
│ [Mesclar agora →]  [Adicionar ao lote ☐]                         │
└──────────────────────────────────────────────────────────────────┘
```

Cada grupo expandido mostra **lado-a-lado todos os campos divergentes** (mesma `CompareRegistriesTable` do wizard), com a **sugestão didática** do vencedor (heurística: tem leito ativo > mais campos preenchidos > mais antigo).

---

## Ações

### 1-a-1 (sempre disponível)
Botão **"Mesclar agora"** → abre `/mesclar-prontuarios` já com os 2 IDs pré-selecionados (via querystring `?a=<uuid>&b=<uuid>`). Fluxo completo do wizard, sem atalho.

### Em bloco (apenas para matches R1/R2 com sugestão clara)
- Checkbox **"Adicionar ao lote"** em cada grupo.
- Bloqueado para grupos onde **ambos têm leito ativo** (precisa decisão humana) ou onde a sugestão é ambígua.
- Barra fixa no rodapé: `12 grupos selecionados · [Revisar lote] [Executar lote]`.
- **Revisar lote** abre `BulkMergeReviewDialog`: lista todos os pares + motivo único obrigatório (≥20 chars) + checkbox "Entendo que isto é irreversível e auditado".
- **Executar lote** chama `merge_patient_registries` em loop sequencial, mostrando progresso (✓ / ✗ por par). Se 1 falhar, segue os outros e relata no final.

---

## Arquivos tocados

- `src/components/dev/MergesTab.tsx` — adiciona sub-abas Diagnóstico/Histórico, mantém histórico atual intacto.
- `src/components/dev/merges/DiagnosticPanel.tsx` *(novo)* — filtros + lista de grupos + barra de lote.
- `src/components/dev/merges/DuplicateGroupCard.tsx` *(novo)* — card expansível por grupo, reusa `CompareRegistriesTable`.
- `src/components/dev/merges/BulkMergeReviewDialog.tsx` *(novo)* — pop-up de confirmação do lote (padrão `MovementConfirmDialog`).
- `src/pages/MergeRegistriesPage.tsx` — ler `?a=&b=` da URL para pré-selecionar (já existe a UI, só faltava o atalho).
- 1 migration: RPC `scan_duplicate_registries(p_sector_code, p_match_mode, p_include_similarity)` SECURITY DEFINER, restrita a admin+dev.

---

## Arquivos que NÃO serão tocados

- `merge_patient_registries` (RPC já existente, não rescrevo).
- `patient_merge_audit`, `patient_registry`, `medical_records`, `patient_registry_edit_history` — zero alteração de schema.
- `MergeRegistriesPage` apenas lê novos query params; o wizard em si (`MergeWizard`, `CompareRegistriesTable`) **não muda**.
- Nenhum fluxo clínico, nenhum print, nenhum fluxo de leito/admissão/transferência.
- Aba Histórico atual da MergesTab — preservada como está.

---

## 3 pontos a confirmar antes de eu executar

1. **R6 similaridade fonética** — ok deixar como toggle opt-in (off por padrão) ou prefere nem expor por enquanto?
2. **Bloco automatizado** — restringir só a **R1 (CPF idêntico)** ou liberar também **R2 (CNS idêntico)**? R3+ sempre exige decisão humana 1-a-1.
3. **Heurística do vencedor** — "tem leito ativo > mais campos preenchidos > mais antigo" te parece a ordem certa, ou prefere "tem leito ativo > mais recente > mais campos"?

Aguardo "ok" + respostas dos 3 pontos.