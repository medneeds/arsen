---
name: pis-import-hardening
description: PisImportDialog robustecido — PDF lido no client via pdfjs (rawText), 4 MB cap, mime inferido por extensão, FileReader assíncrono, erro real do edge desempacotado
type: feature
---
- **PDF**: extraído no client com `pdfjs-dist` (lazy import + worker via CDN) e enviado como `rawText` para `extract-patient-data`. Gemini não aceita PDF via `image_url`, então só imagem (PNG/JPG/WEBP) usa `imageBase64`.
- **PDF escaneado** (sem texto): toast pede para anexar foto/print como imagem.
- **Limite**: 4 MB (antes 10 MB) — coerente com teto de body do Edge Function (~6 MB JSON após base64 +33%).
- **Mime ausente** (drag-and-drop em alguns browsers): inferido pela extensão. `accept` agora restrito a `application/pdf,image/png,image/jpeg,image/webp`.
- **FileReader.readAsDataURL**: substitui o loop `String.fromCharCode + btoa` que travava UI em arquivos >2 MB.
- **Erro real do edge** desempacotado de `response.error.context.body` (supabase-js não faz por padrão), expondo "Limite de requisições excedido", "Créditos insuficientes" etc. em vez do genérico "non-2xx status code".
- Edge `extract-patient-data` permanece igual (caminhos `imageBase64` e `rawText` já existentes).
