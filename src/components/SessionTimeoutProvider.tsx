import { useSessionTimeout } from '@/hooks/useSessionTimeout';

interface SessionTimeoutProviderProps {
  children: React.ReactNode;
}

/**
 * Componente que ativa o timeout de sessão para conformidade LGPD/CFM.
 * Deve ser usado dentro de um contexto autenticado.
 * 
 * A sessão expira automaticamente após 15 minutos de inatividade,
 * conforme recomendação da Resolução CFM 1.821/2007 e LGPD.
 */
export function SessionTimeoutProvider({ children }: SessionTimeoutProviderProps) {
  // Ativar o hook de timeout
  useSessionTimeout();
  
  return <>{children}</>;
}
