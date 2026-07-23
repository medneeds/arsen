import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // NOTA (23/07/2026): a regra unused-imports/no-unused-imports foi
      // REMOVIDA daqui porque a devDependency que a fornece dessincronizava o
      // bun.lock — o deploy roda "bun install --frozen-lockfile" e abortava.
      // Os 364 imports ja removidos continuam removidos; falta so a trava
      // automatica. Para reativar: rodar "bun add -d eslint-plugin-unused-imports"
      // (num ambiente com acesso ao registry do projeto, que atualiza bun.lock)
      // e devolver o plugin + a regra aqui.
    },
  },
);
