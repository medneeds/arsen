---
name: hospital-sectors-and-beds
description: Quantitativo oficial de leitos do Hospital Municipal Djalma Marques (Socorrão I) — 322 leitos fixos populados em bed_census
type: feature
---
# Quantitativo de Leitos — Socorrão I

**Total: 322 leitos fixos** (todos pré-populados em `bed_census` como `vago`, prontos para alocação).

## Críticos (69)
- **UTI 1** (`red`) — 8 leitos · L01–L08
- **UTI 2** (`yellow`) — 10 leitos · L09–L18
- **UCI 1** (`blue`) — 6 leitos · L01–L06
- **UCI 2** (`outside`) — 8 leitos · L07–L14
- **UCC** (`ucc`) — 37 leitos · L01–L37 (35 regulares + L36/L37 estabilização)

## Enfermarias (165)
- **Neuro 01** (`neuro_01`) — 10 leitos · L01–L10
- **Neuro 02** (`neuro_02`) — 10 leitos · L11–L20
- **Clínica Cirúrgica** (`clinica_cirurgica`) — 40 leitos · L01–L40
- **Enf. Transição** (`enfermaria_transicao`) — 10 leitos · L37–L46 (sobreposição numérica intencional com Cir.)
- **Enf. Vascular** (`enfermaria_vascular`) — 95 leitos · L01–L95

## Urgência & Emergência (78)
- **Sala Vermelha** (`sala_vermelha`) — 6 leitos · SV01–SV06
- **Sala Laranja** (`sala_laranja`) — 12 leitos · OL01–OL12
- **Obs. Clínica** (`observacao_clinica`) — 20 leitos · OC01–OC20
- **UE Vertical** (`ue_vertical`) — 20 leitos · EV01–EV20
- **UE Horizontal** (`ue_horizontal`) — 20 leitos · EH01–EH20

## Outros (10)
- **RIV** (`riv`) — 10 leitos · RV01–RV10

## Notas
- Fonte de verdade do código: `src/utils/bedNaming.ts` (`SECTOR_BED_CONFIG`).
- Leitos `EXTRA` (Maca Extra) são criados dinamicamente quando o setor atinge lotação máxima.
- `bed_census` é a tabela canônica do censo realtime (todos os 322 leitos populados em 2026-04 com status `vago`).
- O NIR e admins gerenciam mudanças de status (vago/ocupado/bloqueado/reservado).
