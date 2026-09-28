import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { DepartmentProvider } from "./contexts/DepartmentContext";
import { HospitalProvider } from "./contexts/HospitalContext";
import App from "./App.tsx";
import "./index.css";

// Carimbo de build: mostra no console qual commit esta efetivamente no ar e
// deixa o dado em window.__ARSEN_BUILD__ para conferencia rapida.
// Serve para separar "a correcao nao funciona" de "a correcao nao subiu".
const buildInfo = { commit: __ARSEN_COMMIT__, buildTime: __ARSEN_BUILD_TIME__ };
(window as unknown as { __ARSEN_BUILD__: typeof buildInfo }).__ARSEN_BUILD__ = buildInfo;
console.info(`[Arsen] build ${buildInfo.commit} — ${buildInfo.buildTime}`);

// Tema: o app NASCE claro (defaultTheme="light") e so vai para o escuro por
// ESCOLHA explicita do usuario, via toggle no PlatformHeader. enableSystem
// fica FALSE de proposito — seguir o modo escuro do sistema operacional
// surpreendia quem nunca pediu (motivo de o dark ter sido desligado antes).
// disableTransitionOnChange evita o flash de cores ao alternar.
createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
    <BrowserRouter>
      <AuthProvider>
        <HospitalProvider>
          <DepartmentProvider>
            <App />
          </DepartmentProvider>
        </HospitalProvider>
      </AuthProvider>
    </BrowserRouter>
  </ThemeProvider>
);
