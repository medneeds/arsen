## Objetivo

Bloquear setores que ainda não têm implantação ativa (cadeado cinza elegante, na identidade visual) tanto na tela pós-login (`AccessLimitsScreen`) quanto no `SectorSelector` do Painel Clínico / Mapa, e adicionar uma rotina inteligente que limpa em 24h sinalizações de leito direcionadas a setores bloqueados — preservando o prontuário do paciente.

## Setores

**Liberados (clicáveis):**
- UTI 1, UTI 2, UCI 1, UCI 2, UCC, **Enfermaria de Transição**

**Bloqueados (cadeado cinza, não clicáveis):**
- Enfermarias: Neuro 01, Neuro 02, Clínica Cirúrgica
- Urgência e Emergência (todos): UE Vertical, UE Horizontal, Sala Vermelha, Sala Laranja, Internação UE, Observação Clínica
- Anexo Vascular: Enf. Vascular, RIV
- Centro Cirúrgico: CC Preparo, Bloco Cirúrgico, RPA

## Mudanças

### 1. Lista única de setores bloqueados
Criar `src/config/lockedSectors.ts` exportando `LOCKED_DEPARTMENTS: Set<Department>` com os 12 setores acima e helpers `isDepartmentLocked(d)`. Fonte única de verdade reutilizada por todos os pontos de seleção e pela rotina de limpeza.

### 2. `SectorSelector.tsx` (header — Painel Clínico, Mapa, etc.)
- Em cada botão de setor, se `isDepartmentLocked`: 
  - Renderizar ícone `Lock` (lucide) cinza (`text-muted-foreground/60`) à direita.
  - `disabled`, `cursor-not-allowed`, opacidade reduzida (`opacity-60`), sem hover de seleção.
  - Tooltip: "Setor não habilitado nesta unidade".
- Grupos cujos **todos** os setores estão bloqueados (UE, Anexo Vascular, Centro Cirúrgico) ficam **não-expansíveis**: cabeçalho com cadeado cinza, sem chevron, click bloqueado. Grupo "Enfermarias" continua expansível porque tem itens liberados (Transição, UCC).

### 3. `AccessLimitsScreen.tsx` (pós-login, múltiplos acessos)
- No grid "Direcionar Para", aplicar mesma lógica: cards bloqueados ficam com cadeado cinza + opacidade + `disabled`.
- `selectedSector` inicial pula setores bloqueados (`selectableSectors.find(d => !isDepartmentLocked(d))`).
- Botão "ACESSAR PAINEL" desabilitado se único setor disponível for bloqueado.

### 4. Estilo do cadeado (identidade visual)
- Ícone `Lock` Lucide, `h-3 w-3`, cor `text-muted-foreground/70` (cinza neutro do design system, não cinza puro).
- Em hover sobre item bloqueado: micro-tooltip com `bg-muted text-muted-foreground` + borda sutil.

### 5. Limpeza automática de sinalizações órfãs (24h)
Atualmente uma alta para enfermaria neuro cria registro em `pre_admissions`/`bed_allocation_requests` aguardando admissão. Como o fluxo desses setores não funciona, esses registros acumulam.

- **Migration**: criar função `cleanup_locked_sector_pending_allocations()` em SQL que:
  - Marca como `expired` (ou deleta, conforme schema) registros de `pre_admissions` e `bed_allocation_requests` cujo `target_department`/`destination_sector` esteja na lista bloqueada **e** `created_at < now() - interval '24 hours'` **e** `status` ainda pendente.
  - **Preserva o prontuário do paciente** (não toca em `patient_registry`, `medical_records`, evoluções, etc).
  - Registra em log `locked_sector_cleanup_log` (id, patient_id, sector, cleaned_at) para auditoria.
- Trigger leve via cron `pg_cron` a cada 1h, ou — mais simples e suficiente — chamada idempotente disparada no carregamento do `DashboardPage`/`MovementsPage` (debounce por `localStorage` flag `last_locked_cleanup_at` para rodar no máximo 1x/hora por sessão).
- Vou usar a **abordagem on-load com debounce 1h** para evitar dependência de pg_cron e manter o comportamento previsível.

### 6. Validação opcional na origem (defesa em profundidade)
No diálogo de criação de movimento/alta para outro setor (`BedReleasePreAdmissionDialog`, `MovementsPage`), exibir badge âmbar "Setor sem implantação — sinalização será removida em 24h se não admitida" quando o destino for um setor bloqueado. Não bloquear o fluxo (o usuário pode continuar faturando, conforme pedido).

## Fora de escopo (não tocar)
- Páginas dedicadas (`/ue-vertical`, `/ue-horizontal`) seguem existindo — bloqueio é apenas no seletor.
- Permissionamento por perfil em `user_departments` — não altera.
- Cálculos clínicos, dashboards do Gestor, prontuário — intactos.

## Detalhes técnicos
- Sem mudança em RLS.
- A migration usa `SECURITY DEFINER` na função de cleanup com `search_path = public`.
- Se `bed_allocation_requests` tiver enum `status` sem `expired`, uso `'cancelled'` + coluna `cancellation_reason = 'locked_sector_auto_cleanup'`.

## Confirmação solicitada
1. Confirma a lista de **6 setores liberados** (UTI 1/2, UCI 1/2, UCC, Enf. Transição) e os **12 bloqueados**?
2. Pode aplicar a limpeza automática **24h** com **deleção lógica** (`status='cancelled'` + motivo) em vez de hard delete? Isso preserva auditoria.
3. Pode usar **debounce on-load (1h)** em vez de `pg_cron`?