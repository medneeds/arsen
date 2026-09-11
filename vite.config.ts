import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";
import { componentTagger } from "lovable-tagger";

// Carimbo de build — permite saber QUAL commit esta no ar.
// Sem isso nao havia como distinguir "o fix nao funciona" de "o fix nao subiu",
// e deploys silenciosamente cancelados no Dokploy passavam despercebidos.
// A ordem cobre os diferentes ambientes de build; nenhuma etapa pode derrubar
// o build, por isso tudo dentro de try/catch.
function resolveCommit(): string {
  const doEnv =
    process.env.SOURCE_COMMIT ||
    process.env.GIT_COMMIT ||
    process.env.COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA;
  if (doEnv) return doEnv.slice(0, 8);
  try {
    return execSync("git rev-parse --short=8 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "desconhecido";
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __ARSEN_COMMIT__: JSON.stringify(resolveCommit()),
    __ARSEN_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // O build estava sendo morto por falta de memória no servidor de deploy
    // (SIGKILL na etapa "rendering chunks" — o momento de maior consumo de
    // RAM do Rollup/esbuild). Vários chunks passavam de 900KB (PrescricaoPage,
    // index principal), forçando o minificador a processar blocos enormes
    // de uma vez. Separar as dependências pesadas em chunks próprios reduz
    // o pico de memória por chunk processado — não resolve por si só se o
    // servidor tiver RAM muito abaixo do necessário, mas alivia bastante.
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-charts": ["recharts"],
          "vendor-pdf": ["pdfjs-dist"],
          "vendor-motion": ["framer-motion"],
          "vendor-markdown": ["react-markdown"],
          "vendor-dnd": ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
          "vendor-radix": [
            "@radix-ui/react-accordion", "@radix-ui/react-alert-dialog", "@radix-ui/react-aspect-ratio",
            "@radix-ui/react-avatar", "@radix-ui/react-checkbox", "@radix-ui/react-collapsible",
            "@radix-ui/react-context-menu", "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-hover-card", "@radix-ui/react-label", "@radix-ui/react-menubar",
            "@radix-ui/react-navigation-menu", "@radix-ui/react-popover", "@radix-ui/react-progress",
            "@radix-ui/react-radio-group", "@radix-ui/react-scroll-area", "@radix-ui/react-select",
            "@radix-ui/react-separator", "@radix-ui/react-slider", "@radix-ui/react-slot",
            "@radix-ui/react-switch", "@radix-ui/react-tabs", "@radix-ui/react-toast",
            "@radix-ui/react-toggle", "@radix-ui/react-toggle-group", "@radix-ui/react-tooltip",
          ],
        },
      },
    },
  },
}));
