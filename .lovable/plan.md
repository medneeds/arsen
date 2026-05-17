## Objetivo

Adicionar uma nova seção colapsável **"Dispositivos & Culturas"** no formulário de Evolução (`EvolutionForm`), posicionada **imediatamente antes** da seção "Evolução". Os dados ficam no JSONB da evolução (sem nova tabela) e a última evolução é refletida no **Cockpit** em realtime (leitura).

## Entendimento (contrato)

- **Camada Layout**: nova seção dentro do accordion existente. Não mexo em Diagnósticos, Evolução, Exames Complementares, Plano nem Revisão.
- **Camada Dados**: dois novos campos no payload da evolução (`devices[]` e `cultures_html`). Sem migração — JSONB já aceita.
- **Camada Movimentação**: nenhuma. Não toco em fluxo de leito/admissão/transferência.
- **Camada Auditoria**: nenhuma tabela imutável nova — versionamento já existe via `parent_id` da evolução.

## Escopo funcional

### 1. Seção "Dispositivos" (lista fixa + "Outro")
Lista institucional padrão, cada linha com checkbox + date picker (DD/MM/AAAA com máscara BR) + badge "D{n}" calculado automaticamente em relação a hoje:

- CVC (Cateter Venoso Central)
- PICC
- Cateter de Diálise / Shilley
- SVD (Sonda Vesical de Demora)
- SNE / SOG
- IOT (Intubação Orotraqueal)
- TQT (Traqueostomia)
- PAI (Pressão Arterial Invasiva)
- Dreno (torácico/abdominal)
- **+ Outro** (campo livre + data) — pode adicionar múltiplos

Cálculo: reusar `parseAdmissionDate` + `calcDIH` de `src/lib/dihCalc.ts` (já existe, BR + ISO, clampa futuro). Badge cor âmbar a partir de D7, vermelha a partir de D14 (sinalização institucional para revisão de dispositivos invasivos).

### 2. Campo "Resultado de Culturas"
RichTextEditor (mesmo componente já usado em Evolução/Plano/Exames Complementares — B/I/U + Enter→`<p>`, sanitização DOMPurify). Placeholder didático: "Ex.: Hemocultura 2 amostras (12/05) — pendente | Urocultura (10/05) — E. coli sensível a ceftriaxona | Ponta de cateter (11/05) — negativa."

### 3. Persistência (sem migração)
Campos no payload JSONB existente da evolução:
```
{
  devices: [
    { id: 'cvc', label: 'CVC', insertedAt: '2026-05-10', days: 7 },
    { id: 'custom-uuid', label: 'PAM Femoral D', insertedAt: '2026-05-15', days: 2, custom: true }
  ],
  cultures_html: '<p>...</p>'
}
```
`days` é recalculado em tempo de leitura (não confiar no salvo).

### 4. Cockpit (leitura realtime)
Em `PatientCockpit` → aba **Exames** → novo bloco "Dispositivos Ativos" abaixo de "Dispositivos" existente (se houver) ou como bloco único. Mostra os dispositivos da **última evolução** com badge "D{n}" recalculado. Adicionar mini-bloco "Últimas culturas" exibindo `cultures_html` da última evolução (renderização sanitizada, somente leitura). Realtime já garantido pelo hook `useEvolutions` / `useLatestEvolution`.

## Arquivos tocados

- `src/components/evolution/EvolutionForm.tsx` — nova `SectionItem` "Dispositivos & Culturas" antes de "Evolução"; estado `devices`, `culturesHtml`; inclui no submit.
- `src/components/evolution/DevicesCulturesSection.tsx` *(novo)* — UI da seção (lista de dispositivos + RichTextEditor de culturas).
- `src/lib/devicesCatalog.ts` *(novo)* — lista fixa institucional dos dispositivos.
- `src/components/PatientCockpit.tsx` (ou subcomponente da aba Exames) — bloco de leitura "Dispositivos Ativos" + "Últimas Culturas" a partir de `useLatestEvolution`.
- `src/hooks/useEvolutions.ts` / `useLatestEvolution.ts` — apenas tipagem dos novos campos no payload (sem mudar lógica).

## Arquivos que NÃO serão tocados

- Nenhuma migração Supabase.
- Não toco em `printEvolution.ts`, `printAdmission.ts`, `PrescricaoPage.tsx`, `PacienteHubPage.tsx`, fluxos de leito, SAPS, prescrição, validação farmacêutica.
- Não toco em `EditPatientDialog.tsx` nem `PatientIdentityHeader.tsx`.
- Não removo nem renomeio campos existentes em outras seções da evolução.

## Pontos a confirmar antes de implementar

1. **Inclusão na impressão da evolução (`printEvolution`)**: incluir Dispositivos+Culturas no PDF impresso, ou somente em tela por ora?
2. **Limite institucional dos badges D7/D14**: aceita esses limiares (CDC/ANVISA — risco de IRAS) ou prefere outros valores?
3. **Cockpit aba "Exames"** é o destino correto, ou prefere mover para aba "Resumo" (mais visível)?

Aguardo "ok" + respostas dos 3 pontos para executar.