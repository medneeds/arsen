---
name: norma-zero-print-standard
description: Padrão oficial de timbrado Norma Zero (MAN.05-001) para todos os relatórios e documentos impressos da plataforma Arsen. Utilitário compartilhado em src/lib/printNormaZero.ts
type: design
---

# Padrão Norma Zero — Documentos Impressos

Todo relatório/documento PDF da plataforma DEVE seguir o timbrado oficial Norma Zero (MAN.05-001).

## Utilitário compartilhado
`src/lib/printNormaZero.ts` expõe:
- `prepareLogo(src?)` — converte asset em base64 (default: socorrao-cross-logo.png, símbolo da cruz)
- `generateDocCode(prefix)` — gera `{PREFIX}-YYYYMMDD-HHMM`
- `buildNormaZeroDocument(opts)` — monta HTML completo com header, doc-bar, título, corpo, assinaturas, rodapé
- `openPrintWindow(html, splash?)` — abre janela e dispara impressão

## Estrutura visual obrigatória
1. **Header**: grid 68px-1fr-68px (logo símbolo 62×62 + texto institucional centralizado + espaço)
2. **Hierarquia**: PREFEITURA → SECRETARIA → HOSPITAL (Norma Zero `whitelabel.print.institutionalHeader`)
3. **Barra cruz colorida**: 5 cores institucionais (`whitelabel.theme.institutionalColors`) — vermelho/laranja/amarelo/verde/azul
4. **Doc-bar**: código documento · setor · data/hora emissão (cinza-azul claro)
5. **Título**: `h1.nz-title` 14pt caixa-alta + subtítulo opcional com nome do hospital
6. **Seções**: `h2.nz-section` background `#0054A6` branco
7. **Tabelas**: classe `.nz` (cabeçalho `#f1f5f9`, zebra `#fafbfc`, bordas `#e2e8f0`)
8. **Assinaturas**: até 3 blocos lado a lado com linha + label + caption
9. **Rodapé**: HMDM · Arsen 1.0 · MAN.05-001 v05 · LGPD/CFM · timestamp

## Exemplo de uso
```tsx
import { buildNormaZeroDocument, openPrintWindow, prepareLogo } from "@/lib/printNormaZero";

const handlePrint = async () => {
  const logoData = await prepareLogo();
  const html = buildNormaZeroDocument({
    title: "Relatório Operacional — NIR",
    subtitle: "Indicadores em tempo real",
    sectorLabel: "Núcleo Interno de Regulação (NIR)",
    docCodePrefix: "NIR",
    bodyHtml: `<h2 class="nz-section">1. KPIs</h2><table class="nz">...</table>`,
    signatures: [{ label: "Coordenação NIR" }, { label: "Direção Técnica" }],
    logoDataUrl: logoData,
    extraStyles: `.kpi { ... }`, // CSS específico do documento
  });
  openPrintWindow(html, "Preparando relatório NIR…");
};
```

## Já implementado
- `src/components/nir/NirPdfExport.tsx`

## Migração futura (quando o usuário pedir)
- `PrintableDietDocument.tsx`, `PrintableRequisitionGuide.tsx`, `PrintMapPreviewDialog.tsx`,
  `PrintUtiPreviewDialog.tsx`, `PrintPatientPreviewDialog.tsx`, `PatientWristband.tsx`,
  `FichaAtendimentoPage.tsx`, `RequisicaoUnificada/Imagens/Laboratorio/Parecer`, `RoundPage`,
  `EvolucaoPage`, `PrescricaoPage`

## Prefixos de código por documento (sugestão)
- NIR (relatórios NIR), PRESC (prescrições), APAC, FAT (ficha atendimento), DIET, EVOL,
  ROUND, MAPA (mapa de leitos), REQ-LAB / REQ-IMG / REQ-PAR / REQ-UNI, PULS (pulseira)
