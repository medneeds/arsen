# CLAUDE.md — Arsen

Instruções permanentes para trabalho neste repositório.

## Contexto crítico

Arsen é o prontuário eletrônico do **Hospital Municipal Djalma Marques (Socorrão I)**, São Luís/MA. Está em **uso clínico real, à beira do leito**. Erro de software vira erro assistencial.

- Product owner e diretor clínico: **Artur Batista**, médico. Ele aprova antes da execução.
- Branch de trabalho: **`staging`** (é a que o Dokploy puxa para `dev.arsen.com.br`). A `main` está centenas de commits atrás — **não use a `main` como referência do estado atual**.
- Outros desenvolvedores commitam na mesma branch. **Sempre `git fetch` antes de escrever.**

## Regras não negociáveis

1. **Nunca rode migration.** O Supabase é self-hosted em `api.arsen.com.br`. Toda migration é aplicada pelo Artur, manualmente, pelo SQL Editor. Você pode escrever o arquivo `.sql` e explicar; não pode aplicar.
2. **Antes de propor qualquer mudança de banco** (tabela, coluna, RLS, trigger), pare e avise: o que muda, por quê, risco, reversibilidade. Espere aval.
3. **Prefira solução sem banco.** Verifique se o modelo atual já suporta o que se quer antes de propor mudança estrutural.
4. **Nunca commite nem dê push sem autorização explícita, caso a caso.**
5. **Um commit por correção**, escopo restrito ao alvo, mensagem descritiva (o quê, causa raiz, correção, escopo preservado, resultado do build). Sem acentos nem crases na mensagem.
6. **Commite por caminho explícito.** Nunca `git add -A` — há sessões paralelas na mesma árvore.
7. **Dose, via, diluição, identificação de paciente e documento clínico** exigem simulação de casos de borda antes de qualquer push.

## Validação obrigatória antes de cada commit

```bash
npx tsc --noEmit -p tsconfig.app.json   # o -p é OBRIGATORIO
npx vite build
npx tsx src/tests/<arquivo>.test.ts     # os testes relevantes ao que mudou
npx eslint <arquivos alterados>
```

**Armadilha grave:** `npx tsc --noEmit` **sem o `-p`** não checa nada. O `tsconfig.json` da raiz tem `"files": []` + `"references"` (estilo solution) e o comando sai com exit 0 em ~0s sem olhar um arquivo. Isso já deixou passar uma regressão real por cinco commits.

`vite build` **não** é rede de proteção para tipos — o esbuild remove tipos sem checá-los.

**A meta não é zerar os erros de tipo — é não aumentar.** Baseline em 18/09/2026: **14 diagnósticos / 32 linhas de saída**. Compare antes/depois com `git stash` e verifique se algum erro novo aponta para arquivo que você tocou. Mesmo critério para o ESLint.

> **Atenção à métrica.** O número antigo aqui ("41 erros", 16/09) era contagem de **linhas de saída**, não de diagnósticos — vários erros do Supabase ocupam 3 a 5 linhas cada. Conte com `| grep -c "error TS"` e diga qual das duas métricas está usando. A queda para 14 veio da correção do import duplicado em `PatientCockpit` e da blindagem do `DrugInteractionDialog`.

## Gerenciador de pacotes

- O projeto vive de **bun**. Dependência se adiciona com `bun`, **nunca com npm**.
- `npm install` comum mexe nos lockfiles e já quebrou o deploy cinco vezes. Se precisar instalar para rodar o typecheck em ambiente que não tem bun, use `npm install --no-package-lock --no-audit --no-fund` e confira o md5 de `package.json`, `package-lock.json`, `bun.lock` e `bun.lockb` antes e depois.

## Suíte de testes

45 arquivos `.test.ts` em `src/tests/`. São scripts autocontidos, que podem ser rodados um a um via `npx tsx <arquivo>`.

**Agora existe runner** (18/09/2026), porque a ausência dele deixou um teste quebrado passar despercebido por dias:

```bash
npm run test              # roda todos e sai com código 1 se algum falhar
npm run test prescricao   # roda só os que casam com o filtro
npm run typecheck         # atalho para o tsc com o -p correto
```

**Continua não havendo CI** — se você não rodar, ninguém roda.

Convenção: import **relativo com extensão `.ts`** (`"../lib/x.ts"`), nunca o alias `@/` — o tsx roda sem a resolução de alias do Vite.

Rode os testes que cobrem o que você mudou. Se nenhum cobrir e a mudança tocar fluxo clínico, diga isso em vez de omitir.

## Arquitetura de dados — leia antes de qualquer query

Três níveis:

| Tabela | O que é |
|---|---|
| `patient_registry` | identidade permanente da pessoa / prontuário |
| `patient_encounters` | atendimento/internação; abre na entrada, fecha na alta/óbito/transferência externa |
| `patients` | **LEITOS**, não pessoas (nome historicamente enganoso; tem `bed_number`, `is_vacant`) |

- **Todo dado clínico ancora em `encounter_id`**, nunca no id da linha de leito — senão há vazamento de dado ao reusar ou transferir leito.
- `patient_id` muda a cada transferência; `patient_registry_id` / `registry_id` acompanham a pessoa. Filtrar por `patient_id` onde se quer a pessoa já causou bug de reabertura de atendimento.

## Padrões de falha recorrentes neste projeto

- **Falha silenciosa** é o modo de falha dominante: política RLS bloqueando escrita sem erro na UI, guard bloqueando re-hidratação, coluna ausente na query. Considere sempre essa hipótese ao diagnosticar.
- **Uma tela sabe algo que a outra não sabe.** A correção quase nunca é comportamento novo — é fazer as telas lerem a **mesma fonte**. Quando aparece uma tela nova de paciente, a pergunta útil é "o que as outras têm que esta não tem?".
- **Card ou tela que mostra estado derivado do banco precisa nascer com o gatilho de atualização junto** — informação clínica desatualizada é pior que informação nenhuma.
- **git ≠ banco.** Commitar migration não a aplica. Nunca conclua o estado do banco lendo `supabase/migrations`.

## Impressão — duas arquiteturas convivem

- `src/lib/print*.ts` — helpers que montam HTML e abrem janela (evolução, prescrição, admissão)
- `src/components/Printable*.tsx` — React com `@media print` (requisição, cultura, hemocomponente)

O layout da AIH só existe no DOM com o diálogo aberto: extrair o print root para fora quebra a impressão do APAC.

`buildNutritionParts` (`src/lib/nutritionHydration.ts`) é **fonte única** da tela compacta e dos dois impressos — correção ali vale para as três superfícies.

## Arquivos de alta colisão

`src/pages/PrescricaoPage.tsx` concentra quase tudo e colide entre sessões paralelas. Divida frentes por **arquivo**, não por assunto. A frente de banco/migrations **nunca** paraleliza (migration é ordenada por timestamp no nome).

## Comunicação

- Português do Brasil. Direto, sem enrolação, sem autoelogio, sem "missão cumprida".
- **Diagnóstico antes de plano, plano antes de execução.** Leia o código real antes de afirmar qualquer coisa; nunca diagnostique de memória.
- Diga a **causa raiz**, o mecanismo exato no código — não o sintoma.
- **Declare o risco** de cada mudança: baixo/médio/alto e por quê. Se não há risco, diga que não há.
- Aponte acoplamentos: quando uma mudança pode afetar outro fluxo.
- Honestidade acima de agradar. Se o pedido tem uma falha, diga.
- Em caso de dúvida, errar para o lado seguro: menos invasivo, mais reversível, preservando a continuidade do processo clínico.
- Artur comunica por voz transcrita, às vezes truncada — interprete a intenção e confirme antes de executar quando houver ambiguidade.

## O que só o Artur pode validar

Nada visual é verificável por você: interface, layout de impressão, comportamento de diálogo. Entregue com a lista explícita do que ele precisa testar em `dev.arsen.com.br`.

## Banco de dados — o fluxo, sem exceção

Você **não tem** e **não deve ter** acesso de escrita ao banco. O Supabase é self-hosted em `api.arsen.com.br`, e quem aplica qualquer coisa é o Artur, pelo SQL Editor do Studio.

O fluxo é este:

1. Você escreve o SQL e explica o que faz, qual o risco e se é reversível.
2. O Artur revisa e roda no Studio.
3. Ele cola o retorno aqui.
4. Só então você conclui qualquer coisa sobre o estado do banco.

**Nunca conclua o estado do banco lendo `supabase/migrations`.** Commitar migration não a aplica. Este projeto já teve os dois desvios: migration no git nunca aplicada, e função criada direto no banco sem migration nenhuma.

Quando precisar saber algo do banco, escreva a consulta para o Artur rodar. Regras para essas consultas:

- **Uma consulta por vez.** O SQL Editor mostra apenas o resultado da última quando se roda várias juntas.
- `"Success. No rows returned"` é ambíguo: pode ser DDL sem retorno, ou tabela/coluna inexistente. Desempate com uma consulta isolada.
- Para inspecionar função: `pg_get_functiondef(oid)`, não `prosrc` — o `prosrc` omite assinatura, `SECURITY DEFINER`, `search_path` e grants.

**Antes de propor qualquer migration**, verifique se o modelo de dados atual já resolve o problema. Solução na camada de apresentação ou lógica é sempre preferível a mudança estrutural.

**`CREATE OR REPLACE FUNCTION` sobrescreve em silêncio.** Se a versão no banco divergiu do git, aplicar o arquivo do git reverte a correção sem emitir aviso. Antes de propor aplicar qualquer função, peça a definição atual do banco.

## Comandos disponíveis

- `/diagnosticar <problema>` — investigação de causa raiz, somente leitura
- `/validar` — bateria completa antes de commit
- `/sincronizar` — pull do staging e relatório do que mudou

## Regras de commit e push

- Commite **por caminho explícito**. Nunca `git add -A`.
- Um commit por correção.
- Mensagem sem acentos e sem crases, descrevendo: o quê, causa raiz, correção, escopo preservado, resultado do build.
- **Push só com autorização explícita do Artur, caso a caso.** Não peça autorização genérica "para os próximos"; peça a cada vez.
