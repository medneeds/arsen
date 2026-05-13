# Validação adaptativa + sugestões evidence-based

## Princípios

1. **Vermelho** = somente itens com campo obrigatório faltando, e o conjunto de obrigatórios depende do **tipo de apresentação** da medicação.
2. **Amarelo** = pendente de validação (default, todos os campos OK).
3. **Verde** = validado.
4. Sugestões de posologia/diluição/via baseadas em evidência (UpToDate, AMIB, bulário) para as 50 medicações mais usadas, exibidas inline no card expandido.

## Matriz de obrigatórios por apresentação

| Apresentação | Dose | Via | Posologia | Diluente | Volume | Tempo infusão | Obs |
|---|---|---|---|---|---|---|---|
| Comprimido / Cápsula / Drágea | ✅ | ✅ (VO/SNG) | ✅ | — | — | — | sem diluição |
| Solução oral / Xarope | ✅ | ✅ (VO) | ✅ | — | — | — | |
| Ampola IV bolus | ✅ | ✅ (EV) | ✅ | opcional | opcional | — | bolus lento se aplicável |
| Ampola IV infusão contínua | ✅ | ✅ (EV-BIC) | ✅ (mL/h ou mcg/kg/min) | ✅ | ✅ | ✅ | ex. noradrenalina, fentanil |
| Ampola IV intermitente | ✅ | ✅ (EV) | ✅ | ✅ | ✅ | ✅ | ex. ATB diluído |
| IM / SC | ✅ | ✅ | ✅ | — | — | — | |
| Inalatório / Nebulização | ✅ | ✅ (INAL) | ✅ | ✅ (SF 0,9%) | ✅ | — | |
| Tópico / Oftálmico / Otológico | ✅ | ✅ | ✅ | — | — | — | |
| Supositório / Retal | ✅ | ✅ (RT) | ✅ | — | — | — | |

## Mudanças de código

### 1. `medicationsDatabase.ts`
- Adicionar campo `presentationType` (enum) e `requiredFields` (array) em cada apresentação.
- Adicionar `evidenceSuggestion` opcional: `{ defaultDose, defaultRoute, defaultPosology, defaultDiluent, defaultVolume, defaultInfusionTime, source }`.

### 2. Top 50 medicações com sugestões evidence-based
Cobertura por classe (referências: UpToDate, AMIB, Sanford, KDIGO, bulários):
- **ATB**: Ceftriaxona, Piperacilina-Tazobactam, Meropenem, Vancomicina, Cefepime, Ampicilina-Sulbactam, Metronidazol, Azitromicina, Clindamicina, Linezolida
- **Vasoativos/Sedação (BIC)**: Noradrenalina, Adrenalina, Dobutamina, Vasopressina, Nitroprussiato, Fentanil, Midazolam, Propofol, Dexmedetomidina, Cisatracúrio
- **Analgesia/Sintomáticos**: Dipirona, Paracetamol, Tramadol, Morfina, Ondansetrona, Bromoprida, Escopolamina, Cetoprofeno
- **Cardio**: AAS, Clopidogrel, Atorvastatina, Enalapril, Losartana, Anlodipino, Carvedilol, Furosemida, Espironolactona, Hidroclorotiazida
- **GI/Profilaxia**: Omeprazol, Pantoprazol, Ranitidina, Enoxaparina, Heparina
- **Endócrino**: Insulina Regular, Insulina NPH, Hidrocortisona, Metilprednisolona, Levotiroxina
- **Outros**: Salbutamol, Ipratrópio, Budesonida, N-acetilcisteína, KCl 19,1%

### 3. `PrescricaoPage.tsx` / lógica de validação
- Função `getRequiredFields(item)` retorna lista por `presentationType`.
- `isItemValid(item)` checa apenas os obrigatórios aplicáveis.
- Status vermelho **só** quando `!isItemValid(item)`.
- Bloqueio de validação global: existe ≥1 item vermelho.

### 4. Card expandido adaptativo
- Renderizar somente os campos relevantes ao `presentationType` (ex.: comprimido oculta diluente/volume/tempo).
- Botão "Sugerir" preenche todos os campos com `evidenceSuggestion` quando disponível, com tooltip indicando a fonte.
- Badge discreto "📚 Evidência: UpToDate/AMIB" no card quando sugestão aplicada.

### 5. Sincronização com Norma Zero (PORT 344)
- Print-only continua puxando dados já validados; quantidade 24h calculada por `posology × dose`; SOS = 1.

## Arquivos afetados
- `src/data/medicationsDatabase.ts` (estrutura + 50 entradas enriquecidas)
- `src/pages/PrescricaoPage.tsx` (validação adaptativa, status vermelho)
- `src/components/prescription/PrescriptionItemExpanded.tsx` (ou equivalente — render condicional + botão Sugerir)
- Helper novo: `src/lib/prescriptionValidation.ts` (`getRequiredFields`, `isItemValid`, `getMissingFields`)

## Fora de escopo
- Não altera fluxo de impressão Portaria 344 (já entregue).
- Não altera ATB Guia (já entregue).
- Não cria nova tabela no banco — tudo no catálogo client-side.
