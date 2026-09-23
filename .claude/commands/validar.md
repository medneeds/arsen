---
description: Roda a bateria de validacao obrigatoria antes de qualquer commit
---

Rode a bateria de validação completa e me entregue o resultado em tabela. Não commite nada.

**1. Typecheck — com o `-p`, sempre:**

```
npx tsc --noEmit -p tsconfig.app.json
```

Sem o `-p` este comando não checa nada: o `tsconfig.json` da raiz tem `"files": []` e sai com exit 0 em zero segundo. Se você rodar sem o `-p`, o resultado é inútil.

Conte os erros. **A meta não é zerar — é não aumentar.** Compare com a linha de base e, principalmente, verifique se **algum erro novo aponta para arquivo que você tocou**. Se apontar, é regressão sua: pare e corrija antes de seguir.

**2. Build:**

```
npx vite build
```

O `vite build` pega erros de JSX que o `tsc` não pega, mas **não** é rede de proteção para tipos — o esbuild remove tipos sem checá-los. Os dois são necessários. Avisos de chunk maior que 500 kB são conhecidos e não são regressão.

**3. Testes relevantes.**
Identifique quais arquivos em `src/tests/` cobrem o que você mudou e rode um a um:

```
npx tsx src/tests/<arquivo>.test.ts
```

Não há runner nem CI — se você não rodar, ninguém roda. Se nenhum teste cobrir a mudança e ela tocar fluxo clínico, diga isso em vez de omitir.

**4. Lint apenas nos arquivos alterados:**

```
npx eslint <arquivos alterados>
```

Mesmo critério: não aumentar.

**5. Casos de borda**, se a mudança tocar dose, via, diluição, identificação de paciente ou documento impresso. Descreva os casos que você simulou mentalmente e o que aconteceria em cada um.

**Entregue assim:**

| Etapa | Resultado | Regressão? |
|---|---|---|
| tsc | N erros (base: M) | sim/não — qual arquivo |
| vite build | ok / falhou | |
| testes | quais rodaram, quais passaram | |
| eslint | N problemas (base: M) | |

Se algo falhou, **não proponha commit**. Diga o que quebrou e espere.
