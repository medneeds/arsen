# Memory: index.md
Updated: just now

# Project Memory

## Core
- **PRINCÍPIOS IMUTÁVEIS** (mem://preferences/immutable-principles): 4 camadas separadas (Layout / Dados / Movimentação / Auditoria). Pedido em uma camada NUNCA toca outra. Antes de mudança não-trivial: repetir entendimento + listar arquivos tocados + listar o que NÃO será tocado + aguardar "ok". Questionar pedidos vagos/destrutivos. Nunca apagar dado clínico — arquivar via `archive_bed_history`.
- Global uppercase (except inputs, textareas, pre, code) for institutional standardization.
- NFD normalization for search inputs (ignore accents and special characters).
- URL `searchParams` pass patient context (ID, name, bed, sector) between clinical modules.
- `DepartmentContext` (localStorage) scopes UI, dashboards, and maps to the active sector.
- Supabase JSONB persistence with `parent_id` versioning for prescriptions.
- Print layouts use React Portal, are strictly A4 (Portrait for clinical, Landscape for management).
- Clean aesthetic: "dark glass morphism", slate-50/blue-50, with HMDM institutional colors.

## Memories
- [Patient Context Persistence](mem://features/patient-context-persistence) — URL-based state management for patient identification across modules.
- [Bed Management System](mem://features/bed-management) — Real-time status tracking for hospital beds with sector-based filtering.
- [Prescription Versioning](mem://features/prescription-versioning) — Immutable history tracking using JSONB snapshots and parent-child linking.
- [Internal Transfer Unified Flow](mem://features/internal-transfer-unified-flow) — Fluxo 2 etapas (signal+complete) coexistindo com transferência direta; fila virtual via internal_transfer_requests; escalada crítica → SAPS pendente após alocação; encounter preservado
