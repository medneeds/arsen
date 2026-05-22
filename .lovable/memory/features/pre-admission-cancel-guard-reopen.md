---
name: pre-admission-cancel-guard-reopen
description: Cancelamento de pré-admissão didático + aba "Canceladas" com reabrir para devolver paciente à fila sem recadastrar
type: feature
---
# Pré-admissão — Guarda de Cancelamento + Reabrir

Arquivo único: `src/components/PreAdmissionSection.tsx` (camadas Layout + Movimentação; nada na camada de Dados/Schema).

## Cancelar (guarda didática)
- AlertDialog reformulado: ícone de alerta, descrição do impacto (paciente sai de todas as filas), bloco âmbar listando o que acontece (prontuário intacto, leito não fica ocupado, pode ser reaberto), e footer com "Manter na fila" / "Sim, cancelar pré-admissão".
- Continua chamando `UPDATE pre_admissions SET status='cancelado'` (auditado pelo trigger já existente em `audit_logs`).

## Aba "Canceladas"
- Botão `<History/> Canceladas` no header da seção, ao lado de "Cadastrar Paciente". Toggle abre bloco recolhível dentro do `CollapsibleContent`.
- `fetchCancelled()` busca os últimos 30 `status='cancelado'` filtrando por `destination_sector=sectorFilterLabel` OU `destination_sector IS NULL` quando há filtro de setor; sem filtro mostra todos.
- Realtime do canal `pre_admissions_*` também chama `fetchCancelled()` quando o bloco está aberto.
- Cada card cancelado mostra nome, idade/sexo/prontuário, destino original e botão **"Reabrir pré-admissão"** (verde, outline).

## Reabrir
- AlertDialog próprio com bloco verde explicando: volta para `aguardando_leito`, preserva cadastro/prontuário, mantém destino original mas permite trocar no `AdmitPatientDialog`, limpa `destination_bed`.
- `handleReopen()` executa `UPDATE pre_admissions SET status='aguardando_leito', destination_bed=null`. Não toca `destination_sector` (usuário troca pelo dropdown "Alterar setor" no AdmitPatientDialog se quiser).
- Auditoria automática via trigger existente.

## Por que existe
Caso ANA LUCIA FERREIRA (UCI 1): pré-admissão foi cancelada e a paciente sumiu de todas as filas — usuário relatou "não permite admitir em Maca Extra" porque o card simplesmente não aparecia. Sem esta guarda+reabrir, o resgate dependia de SQL manual.
