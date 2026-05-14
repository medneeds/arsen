## Escopo (3 frentes independentes — você pode aprovar todas ou só algumas)

---

### 1) Revisão do PDF gerado ao validar a prescrição

**O que vou fazer:** abrir o `PrintablePrescription` (linha 7242 de `PrescricaoPage.tsx`) e revisar 7 pontos comuns de inconsistência depois das últimas mudanças (insulina, MAV/Port.344, inalatórios, "Única", reconstituição):

- Insulinoterapia: confirmar que o bloco vermelho do PDF não duplica linha "EV contínua" quando o item já é EV via grid normal.
- "Única" (nova posologia): confirmar que renderiza como `Dose · Via · Única` e que não força bloco IV vazio.
- Reconstituição (`reconstitutionVolume`/`reconstitutionSolvent`): hoje **não aparece** no PDF — incluir no bloco "Preparo IV" como `Reconstituir em Xml de SF/AD` antes da diluição final.
- Sítio de infecção (`atbInfectionSite`) e dia de terapia: hoje não saem no PDF do antimicrobiano — incluir uma linha discreta `Sítio: ... · Dia X de Y · Início dd/mm` quando for ATB.
- Chip MAV+PORT.344: validar que o chip violeta não fica "comendo" o nome do medicamento em itens longos (vou medir o `marginRight`).
- Coluna de Aprazamento (230 px fixa): conferir se ainda cabe num A4 com a margem de 186 mm; se estourar, reduzir para 200 px.
- "Suspenso" no PDF: hoje só itens `active` entram, então o badge SUSPENSO está morto — vou removê-lo do código (não chega a ser bug visual, só lixo).

**Entrega:** lista do que estava inconsistente + correções aplicadas. Sem mudança estrutural de layout — só ajustes de conteúdo e duas regras de exibição novas (reconstituição + linha ATB).

---

### 2) Enriquecimento do card "Status" da Guia ATM

Hoje cada antibiótico em curso mostra: nome, dose/via/posologia, sítio, "Dia X de Y", início, previsão fim. Vou adicionar:

- **Barra de progresso** horizontal (lilás, fininha) com % do curso (Dia X / Y), com cor mudando para vermelha quando excedido.
- **Dias restantes** em destaque (`Faltam 3 dias` / `Excedeu há 2 dias`).
- **Aprovação CCIH** se houver (`ccihApproval` na guia salva): badge `CCIH: aprovado/restrito/pendente`.
- **Cultura** (`cultureCollected`/`cultureResult`): badge `Cultura: pendente/coletada/resultado`.
- **Tempo desde o início** em horas para as primeiras 24h (`Iniciado há 8h`), depois vira "Dia 2", etc.
- **Mini-linha de janela**: `Iniciado dd/mm 14:30 → previsto fim dd/mm` no rodapé do card.
- Botão **Suspender** ganha confirmação + motivo curto (já existe padrão MovementConfirm, mas aqui posso usar um inline AlertDialog leve para não inflar).

**Pergunta de implementação:** os campos CCIH/cultura hoje vivem só dentro do `AntimicrobialGuideDialog` (form), não na prescrição. Para o card mostrar isso, precisaria ler do snapshot salvo da última guia (Supabase). Se preferir, faço só o que está disponível no `PrescriptionItem` (progresso + dias restantes + janela + tempo desde início) e deixo CCIH/cultura para uma 2ª iteração quando integrarmos com a guia salva. **Sugestão:** ir só com o que está local agora.

---

### 3) Identidade lilás suave em toda a Guia ATM (`AntimicrobialGuideDialog` + `AtmStatusDialog`)

Hoje os dois dialogs usam **laranja** (`bg-orange-50`, `text-orange-600`, `bg-orange-600 hover:bg-orange-700`, etc.). Vou alinhar com a paleta lilás já usada na seção ATB da prescrição, **sem exageros** e **preservando cores semânticas**:

**Mudanças:**
- Header dos dialogs: ícone `Shield` e fundo do header trocam de `text-orange-600` / `bg-orange-50/40` → `text-violet-600` / `bg-violet-50/40` (mesmo tom da seção ATB). 
- Borda dos cards de item em curso: `border-orange-200` → `border-violet-200/70`.
- Chip "Dia X de Y": `text-orange-700` → `text-violet-700`.
- Botão primário "Continuar"/"Abrir Guia ATM": `bg-orange-600 hover:bg-orange-700` → `bg-violet-600 hover:bg-violet-700` (igual ao botão "Abrir Guia ATM" da seção).
- Aba ativa (Status/Nova) ganha underline lilás suave.
- Radio "Acréscimo": borda/fundo passam de orange → violet.

**Preservados (cores semânticas):**
- Vermelho de "Excedeu duração", "Suspender", radio "Troca/Escalonamento", alerta de CCIH negado.
- Azul do banner informativo no rodapé da aba "Nova" (continua azul porque é informacional, não o tema).
- Verde do badge "Em curso" e do dot de status.
- Âmbar/laranja só fica em alertas pontuais (sem "vazar" no tema do dialog).

**Não vou:** mexer em altura, padding, grid/colunas, abas ou estrutura — apenas tokens de cor.

---

## Pergunta única

Aprova as 3 frentes? Se sim, sigo nesta ordem: (1) PDF, (2) cards Status enriquecidos só com dados locais (deixo CCIH/cultura para depois), (3) repintar Guia ATM em lilás. Se quiser tirar alguma frente, me diz qual.
