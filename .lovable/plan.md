## Objetivo

Tornar a linha EV mais intuitiva, eliminar redundância (campo "quantity") e regenerar o descritivo no formato:

> `1 ampola. 0,05–0,5 mcg/kg/min. Diluir em SG5% 234 mL. Volume total: 234 mL.`

## 1. Remover o campo `quantity` (numérico) da UI

- Some o `Input` de quantidade nas duas linhas (compacta `~1849` e expandida `~1144`).
- Mantém **só `quantityUnit`** (mL, ampola, frasco-ampola, comp, mg, gota…).
- Internamente, `quantity` passa a ser sempre `"1"` por padrão (não exibido). Sem migração de dados — campo continua existindo no tipo, apenas oculto.
- Resultado visual: um único Select "Forma" no lugar dos dois inputs.

## 2. Layout das linhas EV (otimização)

Reagrupar em **3 blocos visuais** com separadores sutis, na ordem clínica natural:

```text
[ Forma ▾ ] [ Dose ____ ]   |   [ Diluente ▾ ] [ Vol dil ___ ]   |   [ Vol total ___ ] [ Correr em __ ▾ ] [ Velocidade ___ ▾ ]
   IDENTIDADE                       DILUIÇÃO                             INFUSÃO
```

- Adiciono `border-l border-border/30 pl-2 ml-1` entre os blocos.
- Labels muted em `text-[10px]` acima de cada campo no modo expandido (já existem parcialmente — uniformizar).
- Modo compacto: mesma ordem, sem labels, com tooltips.

## 3. Obrigatoriedade — saudável e seguro no dia a dia

**Sempre obrigatórios** (bloqueiam validação):
- `name` (medicamento)
- `dose` OU `quantityUnit` (precisa ter pelo menos **uma forma de saber o que vai ser administrado**)
- `route` (já tem default)
- `posology` (frequência) — segurança crítica

**Obrigatórios só quando há diluente**:
- `diluentVolume` (mL do veículo)

**Flexíveis (não bloqueiam)**:
- `volumeTotal` — **deixa de ser obrigatório**. Se `quantityUnit ≠ mL` e usuário não preencheu, validação passa com aviso suave (não erro). Quando o app não consegue calcular (ampola sem volume conhecido), simplesmente não exige.
- `infusionTime` / `infusionRate` — opcional; só obrigatório quando `infusionMode = BIC` **E** o medicamento está marcado como `highAlert` (vasoativo, sedação contínua).
- `accessType`, `concentration` — sempre opcionais.

## 4. Descritivo automático (`buildInstructionFromFields`)

Reescrita para o formato exato do exemplo, com regras:

```text
{quantidade} {unidade}. {dose}. Diluir em {diluente} {volDil}mL. Volume total: {volTotal}mL. Correr em {tempo}{unidade}. Velocidade {rate} {modo}.
```

Regras:
- Quantidade implícita = `1` quando não há valor (ex.: `"1 ampola."`).
- Dose só entra se preenchida (sem ponto duplo).
- Bloco diluição só se `diluent ≠ sem_diluente`.
- "Volume total" só se preenchido **e diferente do volume do diluente** (evita redundância tipo "Diluir em SG5% 234mL. Volume total: 234mL." → vira só "Diluir em SG5% 234mL.").
- "Correr em" e "Velocidade" só se preenchidos.
- Pontuação consistente: cada bloco termina em `.`.

Exemplo final reproduzível:
- Noradrenalina 4mg/4mL: `1 ampola. 0,05–0,5 mcg/kg/min. Diluir em SG5% 234 mL.` (omito "Volume total" porque seria redundante)
- Dipirona: `2 ampolas. 1 g. EV em bolus.` (sem diluente)

## 5. Scroll otimizado nos Selects

- Adicionar `<ScrollArea className="h-64">` dentro de `SelectContent` para `quantityUnit`, `diluent`, `route`, `posology`.
- `SelectContent` recebe `className="max-h-72"` como fallback.

## 6. Cálculo de `volumeTotal` (correção do bug original)

Mantém a lógica atual (que só soma quando unidade = mL), mas:
- Não força recálculo nem bloqueia validação quando não dá pra calcular.
- Tooltip no campo `volumeTotal` explica: "Editável. Auto-calculado quando a forma é em mL."

## Arquivos afetados

- `src/pages/PrescricaoPage.tsx` (única alteração — linhas ~140-200 tipo, ~305-340 calc, ~460-500 buildInstruction, ~1140-1180 linha expandida, ~1840-1910 linha compacta, validação ~em torno de 1559-1600)

## Fora de escopo

- Não mexo em impressão, persistência, schema do banco, regras MAV/Port.344, insulina, inalatório.
- Não removo `quantity` do tipo TS (só da UI) — evita quebrar dados antigos.

---

Confirma que aplico exatamente isso? Se quiser ajustar algum item (ex.: manter algum campo obrigatório a mais, ou mudar a ordem dos blocos), me diz antes.