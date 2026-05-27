/**
 * Wrapper para `printRequisitionGuide` que, quando a requisição contém
 * GASOMETRIA (arterial/venosa) **e** outros exames, abre um pop-up
 * perguntando se deve imprimir a gasometria em guia separada
 * (padrão hospitalar — tubo/coleta diferente).
 *
 * Regras decididas com o usuário:
 *  - Sempre perguntar (sem memória de sessão), até equipe estar treinada.
 *  - Separar apenas pelo termo "gasometria" (lactato e demais permanecem
 *    no grupo "outros" — revisão futura do catálogo).
 *  - Não interferir no fluxo de cultura (já roteado em printRequisitionGuide).
 */

import { createRoot } from "react-dom/client";
import React from "react";
import { printRequisitionGuide } from "@/components/PrintableRequisitionGuide";

const GASO_REGEX = /gasometria/i;

function getItemName(it: any): string {
  return typeof it === "string" ? it : (it?.name || String(it ?? ""));
}

function hasGasometriaSplitCandidate(items: any[]): boolean {
  if (!Array.isArray(items) || items.length < 2) return false;
  const gaso = items.filter((it) => GASO_REGEX.test(getItemName(it)));
  const others = items.filter((it) => !GASO_REGEX.test(getItemName(it)));
  return gaso.length >= 1 && others.length >= 1;
}

type SplitChoice = "split" | "compact" | "together" | "cancel";

function askSplitGasometria(items: any[]): Promise<SplitChoice> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    const cleanup = () => {
      try { root.unmount(); } catch { /* noop */ }
      try { host.remove(); } catch { /* noop */ }
    };

    const finish = (choice: SplitChoice) => {
      cleanup();
      resolve(choice);
    };

    const gasoCount = items.filter((it) => GASO_REGEX.test(getItemName(it))).length;
    const otherCount = items.length - gasoCount;

    const overlayStyle: React.CSSProperties = {
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 16,
    };
    const cardStyle: React.CSSProperties = {
      background: "hsl(var(--background, 0 0% 100%))",
      color: "hsl(var(--foreground, 222 47% 11%))",
      borderRadius: 12, maxWidth: 480, width: "100%",
      boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
      padding: "20px 22px 16px",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      border: "1px solid hsl(var(--border, 214 32% 91%))",
    };
    const titleStyle: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 };
    const bodyStyle: React.CSSProperties = { fontSize: 13.5, lineHeight: 1.5, color: "hsl(var(--muted-foreground, 215 16% 47%))", marginBottom: 14 };
    const infoStyle: React.CSSProperties = { fontSize: 12, marginBottom: 14, padding: "8px 10px", background: "hsl(var(--muted, 210 40% 96%))", borderRadius: 6, color: "hsl(var(--foreground, 222 47% 11%))" };
    const rowStyle: React.CSSProperties = { display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" };
    const btnBase: React.CSSProperties = {
      padding: "8px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600,
      cursor: "pointer", border: "1px solid transparent", textTransform: "uppercase", letterSpacing: 0.3,
    };
    const btnGhost: React.CSSProperties = {
      ...btnBase,
      background: "transparent",
      color: "hsl(var(--muted-foreground, 215 16% 47%))",
      border: "1px solid hsl(var(--border, 214 32% 91%))",
    };
    const btnSecondary: React.CSSProperties = {
      ...btnBase,
      background: "hsl(var(--secondary, 210 40% 96%))",
      color: "hsl(var(--secondary-foreground, 222 47% 11%))",
    };
    const btnPrimary: React.CSSProperties = {
      ...btnBase,
      background: "hsl(var(--primary, 222 47% 11%))",
      color: "hsl(var(--primary-foreground, 210 40% 98%))",
    };

    const Modal = () =>
      React.createElement(
        "div",
        { style: overlayStyle, onClick: () => finish("cancel") },
        React.createElement(
          "div",
          { style: cardStyle, onClick: (e: any) => e.stopPropagation() },
          React.createElement("h2", { style: titleStyle }, "Como imprimir a gasometria?"),
          React.createElement(
            "p",
            { style: bodyStyle },
            "Gasometria usa tubo/seringa específico. Escolha como imprimir:",
          ),
          React.createElement(
            "div",
            { style: { fontSize: 12, marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 } },
            React.createElement(
              "div",
              { style: { padding: "7px 10px", background: "hsl(var(--muted, 210 40% 96%))", borderRadius: 6, color: "hsl(var(--foreground, 222 47% 11%))" } },
              `📄 2 guias separadas — uma só com gasometria (${gasoCount} item), outra com os demais (${otherCount} exame${otherCount > 1 ? "s" : ""}).`,
            ),
            React.createElement(
              "div",
              { style: { padding: "7px 10px", background: "hsl(var(--muted, 210 40% 96%))", borderRadius: 6, color: "hsl(var(--foreground, 222 47% 11%))" } },
              "🗜️ Compacto (1 página) — gasometria e demais exames lado a lado em paisagem, 2 vias com linha de corte. Economiza papel.",
            ),
            React.createElement(
              "div",
              { style: { padding: "7px 10px", background: "hsl(var(--muted, 210 40% 96%))", borderRadius: 6, color: "hsl(var(--foreground, 222 47% 11%))" } },
              "📋 Tudo junto — uma única guia com todos os exames.",
            ),
          ),
          React.createElement(
            "div",
            { style: rowStyle },
            React.createElement("button", { style: btnGhost, onClick: () => finish("cancel") }, "Cancelar"),
            React.createElement("button", { style: btnSecondary, onClick: () => finish("together") }, "Não, imprimir tudo junto"),
            React.createElement("button", { style: btnPrimary, onClick: () => finish("split") }, "Sim, imprimir 2 guias"),
            React.createElement(
              "button",
              {
                style: { ...btnPrimary, opacity: 0.85 },
                onClick: () => finish("compact"),
              },
              "Compacto — 1 página",
            ),
          ),
        ),
      );

    root.render(React.createElement(Modal));
  });
}

/**
 * Imprime a guia respeitando o split de gasometria.
 * - Se NÃO houver gasometria + outros itens, comporta-se exatamente como `printRequisitionGuide`.
 * - Se houver e o usuário escolher "Sim", gera 2 guias sequenciais
 *   (1ª gasometria; 2ª demais).
 */
export async function printRequisitionGuideWithGasometriaPrompt(
  request: any,
  sectorLabel?: (s: string | null) => string,
): Promise<void> {
  const items = Array.isArray(request?.items) ? request.items : [];

  // Só perguntamos quando faz sentido (laboratório com gaso + outros).
  // Cultura segue seu fluxo dedicado dentro de printRequisitionGuide.
  if (!hasGasometriaSplitCandidate(items)) {
    return printRequisitionGuide(request, sectorLabel);
  }

  const choice = await askSplitGasometria(items);
  if (choice === "cancel") return;
  if (choice === "together") {
    return printRequisitionGuide(request, sectorLabel);
  }

  const gasoItems = items.filter((it: any) => GASO_REGEX.test(getItemName(it)));
  const otherItems = items.filter((it: any) => !GASO_REGEX.test(getItemName(it)));

  if (choice === "compact") {
    return printRequisitionGuide(
      { ...request, items: gasoItems },
      sectorLabel,
      { compactDuo: { otherItems, otherLabel: "Exames Laboratoriais", gasoLabel: "Gasometria" } },
    );
  }

  // Split (2 janelas sequenciais)
  await printRequisitionGuide({ ...request, items: gasoItems }, sectorLabel);
  // Pequeno respiro para o navegador abrir a segunda janela sem bloquear pop-up.
  await new Promise((r) => setTimeout(r, 350));
  await printRequisitionGuide({ ...request, items: otherItems }, sectorLabel);
}
