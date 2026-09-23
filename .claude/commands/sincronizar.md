---
description: Sincroniza com o origin/staging e relata o que os outros mudaram
---

Sincronize o clone com o remoto e me diga o que mudou. Rode na ordem:

**1. Estado atual, antes de mexer:**
- `git status --porcelain` — há alteração não commitada?
- `git rev-list --left-right --count HEAD...@{u}` — quantos commits à frente e atrás?

Se houver alteração não commitada, **pare e me mostre** antes de qualquer pull. Pode ser trabalho de outra sessão.

**2. Traga o que chegou:**

```
git pull --rebase
```

Use `--rebase`, não merge — mantém os commits locais no topo, sem commit de merge.

Se houver conflito: **pare, não resolva sozinho.** Me mostre quais arquivos conflitaram e o conteúdo do conflito.

**3. Relate o que veio:**

| Item | Resposta |
|---|---|
| Commits novos | quantos, de quem, em que período |
| Arquivos mais tocados | os 5 principais |
| Migrations novas | nomes — e lembre que commitar migration não a aplica |
| `package.json` / `bun.lock` mudaram? | se sim, precisa reinstalar com **bun**, nunca npm |
| Meus commits locais | continuam no topo? |

**4. Se algum dos commits novos tocou arquivo que estamos investigando ou corrigindo**, avise explicitamente e diga o que mudou ali. A base do nosso diagnóstico pode ter mudado.

**5. Revalide.**
Se vieram commits, a linha de base de tipos pode ter mudado. Rode `npx tsc --noEmit -p tsconfig.app.json` e me diga a contagem atual, para sabermos o número certo antes do próximo trabalho.

**Não dê push.** Nunca, sem autorização explícita do Artur, caso a caso.
