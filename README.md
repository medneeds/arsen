# Arsen

Prontuário eletrônico do **Hospital Municipal Djalma Marques (Socorrão I)**, São Luís/MA.

> ⚠️ **Sistema em uso clínico real, à beira do leito.** Erro de software vira erro
> assistencial. Dose, via, diluição, identificação de paciente e documento clínico
> exigem cuidado redobrado e simulação de casos de borda antes de qualquer alteração.

"Mapeando cuidados, salvando vidas."

## Tecnologias

- **Vite** + **React** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **Supabase self-hosted** (Postgres 15.8, GoTrue, Storage, PostgREST, Realtime, Edge Functions)
- **bun** como gerenciador de pacotes
- **Dokploy** para build e deploy

## Pré-requisitos

- [bun](https://bun.sh) instalado.
- O projeto **vive de bun**. Dependência se adiciona com `bun`, **nunca com `npm install`**
  (mexe nos lockfiles e já quebrou o deploy várias vezes).

## Rodando localmente

```sh
# 1. Clonar
git clone https://github.com/medneeds/arsen.git
cd arsen

# 2. Instalar dependências
bun install

# 3. Variáveis de ambiente (ver .env.example / peça ao time os valores)
cp .env.example .env   # e preencha VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY

# 4. Subir o dev server
bun run dev
```

Em produção/dev as variáveis `VITE_*` vêm dos **build args do Dokploy**, não do `.env` do
repositório — o `.env` do repo não afeta o build.

## Validação obrigatória antes de cada commit

```sh
npx tsc --noEmit -p tsconfig.app.json   # o -p é OBRIGATORIO (sem ele, nao checa nada)
npx vite build
npm run test                            # roda a suite (src/tests/*.test.ts)
npx eslint <arquivos alterados>
```

`vite build` **não** valida tipos (esbuild remove tipos sem checar). A meta não é zerar os
erros de tipo — é **não aumentar** o baseline.

## Banco de dados

O Supabase é **self-hosted**. Toda migration é aplicada **manualmente** pelo responsável
(SQL Editor do Studio) — **não rode migrations** a partir do repositório. `git ≠ banco`:
commitar um arquivo em `supabase/migrations` **não** o aplica.

## Branches e ambientes

| Branch | Ambiente | Deploy (Dokploy) |
|---|---|---|
| `main` | Produção | frontend (`hmdm.arsen.com.br`) + backend `supabase.arsen.com.br` |
| `staging` | Desenvolvimento | frontend (`dev.arsen.com.br`) + backend `api.arsen.com.br` |
| `versao-estavel` | Marcador de versão estável | — |
| `site` | Landing page | `arsen.com.br` |

Deploy é feito pelo **Dokploy** (build por branch). Outros desenvolvedores trabalham na
mesma branch — **sempre `git fetch` antes de escrever**.

## Contribuindo

- Português do Brasil, direto ao ponto.
- **Commit por caminho explícito** (nunca `git add -A`), **um commit por correção**,
  mensagem sem acentos/crases descrevendo o quê, a causa raiz e a correção.
- **Push só com autorização explícita, caso a caso.**

As regras completas de trabalho neste repositório estão em [`CLAUDE.md`](./CLAUDE.md).
