# Processo Padrão de Auditoria e Correção de Bugs — Arsen

Este documento define o fluxo que seguimos para investigar, corrigir e
documentar problemas no sistema, do primeiro sintoma até o merge. Foi
consolidado a partir da investigação do bug de cadastro de paciente Não
Identificado (ver estudo de caso na seção 8).

## 1. Triagem

Antes de qualquer código, entender o problema:

- **Sintoma exato**: mensagem de erro completa (print/texto), não paráfrase.
- **Escopo**: acontece sempre ou só em certas condições? Só para um tipo de
  usuário/registro (ex: paciente NI) ou em geral?
- **Reprodutibilidade**: passos exatos para reproduzir.

Regra prática: **nunca assumir que o escopo do sintoma relatado é o escopo
real do bug.** No caso do NI, o segundo bug encontrado (extensão `unaccent`)
afetava todo cadastro, não só o fluxo NI — só ficou claro depois de corrigir
o primeiro problema e testar de novo.

## 2. Diagnóstico

Ordem de investigação, do mais barato ao mais caro:

1. **Análise estática do código**: seguir o caminho exato de execução
   (função de submit → chamadas de API/RPC → validações) para a condição
   específica do bug.
2. **Comparação de padrões do projeto**: bugs de configuração (permissões,
   migrations, constraints) costumam ser desvios de um padrão que o resto
   do projeto segue consistentemente. Comparar a migration/arquivo suspeito
   com equivalentes já validados no mesmo repositório é a forma mais rápida
   de achar a peça faltante (ex: toda função RPC do projeto tem
   `GRANT EXECUTE`, exceto a que dava erro).
3. **Diagnóstico direto no banco**: quando a causa pode estar no estado real
   do banco (não só no código/migrations), rodar queries de inspeção
   (`pg_extension`, `pg_ts_dict`, `information_schema`, etc.) antes de propor
   qualquer correção. Migration em código ≠ estado real do banco já
   provisionado — sempre confirmar o estado atual antes de agir.

Regra prática: **formular a hipótese, depois validar** — não aplicar
correção especulativa sem antes confirmar a causa com uma consulta ou teste.

## 3. Hipótese e plano de correção

Documentar em uma frase: "o problema é X, porque Y, evidenciado por Z".
Se não for possível preencher essa frase com uma evidência concreta (não uma
suposição), voltar para o diagnóstico.

## 4. Correção

- Mudanças de schema/permissão de banco → sempre como **migration versionada**
  no repositório (nunca só rodar SQL solto no painel sem versionar).
- Migrations devem ser **idempotentes** sempre que possível
  (`IF NOT EXISTS`, `IF EXISTS` nos `DO` blocks) para poder rodar de novo com
  segurança.
- Cada migration carrega um comentário no topo explicando o bug que corrige
  e por quê (contexto para quem ler depois, incluindo o próprio time no
  futuro).
- Rodar typecheck/build local antes de commitar qualquer mudança de código.

## 5. Aplicação

Dois passos **sempre separados**, nunca um sem o outro:

1. **Código**: commit + push da migration/alteração para o repositório
   (branch de trabalho, ex: `staging`).
2. **Banco**: aplicar a migration no projeto Supabase correspondente
   (SQL Editor ou pipeline de deploy). Ter uma migration no Git não altera
   um banco já provisionado — isso precisa ser feito explicitamente.

## 6. Validação final

- Testar o cenário exato que originou o chamado, na tela real do sistema.
- Testar também cenários adjacentes que dependem do mesmo componente
  (ex: cadastro normal, não só o NI), já que causas raiz de infraestrutura
  costumam ter alcance maior que o sintoma original.

## 7. Relatório

Todo ciclo de correção termina em um relatório técnico curto, com:

- Sintoma reportado
- Estratégia de investigação (o que foi checado e em que ordem)
- Causa raiz (ou causas, se mais de uma)
- Correção aplicada (arquivos/migrations)
- Linha do tempo (tabela: etapa → ação → resultado)
- Recomendação para evitar recorrência

## 8. Estudo de caso: cadastro de paciente Não Identificado (16/07/2026)

| Etapa | O que foi feito |
|---|---|
| Triagem | Sintoma inicial: erro/crash ao salvar cadastro NI |
| Diagnóstico | Análise estática do `handleSave`; comparação com padrão de `GRANT EXECUTE` do projeto → achado bug #1 |
| Correção #1 | Migration adicionando grants faltantes em 4 funções RPC do fluxo NI |
| Validação | Teste real revelou novo erro (`unaccent`), escopo maior que o esperado |
| Diagnóstico #2 | Consulta a `pg_extension`/`pg_ts_dict` no banco → extensão nunca foi criada |
| Correção #2 | Migration criando a extensão explicitamente no schema correto |
| Aplicação | Ambas migrations commitadas/enviadas ao GitHub *e* aplicadas manualmente no banco de staging |
| Relatório | Relatório técnico entregue ao time (`relatorio-bug-cadastro-paciente-ni.md`) |

Esse caso é a referência prática para este processo: ele mostra por que a
ordem diagnóstico → hipótese → validação → correção importa, e por que
sempre vale re-testar depois de cada correção em vez de assumir que resolveu.
