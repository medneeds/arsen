import { ReactNode } from "react";

/**
 * Transição entre páginas.
 *
 * POR QUE SEM FRAMER-MOTION (16/09/2026)
 * Este componente era o ÚNICO ponto do grafo de importação ansioso que usava
 * framer-motion — e, por estar dentro do MainLayout, arrastava 127 KB da
 * biblioteca para o caminho crítico de toda a aplicação, só para fazer um
 * fade de opacidade.
 *
 * Havia ainda uma variante `exit` que nunca rodava: exit só dispara dentro de
 * um <AnimatePresence>, que não existe em lugar nenhum. Era código morto
 * custando peso de biblioteca.
 *
 * A duração caiu de 250 ms para 120 ms. Um fade longo em navegação interna não
 * é sofisticação: é a tela demorando a aparecer. Em plantão, o que se quer é a
 * informação na frente, não o efeito.
 *
 * Respeita prefers-reduced-motion: quem pediu menos movimento no sistema vê a
 * troca sem animação nenhuma.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return <div className="h-full animate-page-in">{children}</div>;
}
