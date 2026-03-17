import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Tempo de inatividade em minutos (LGPD/CFM recomenda 15-30 minutos)
const INACTIVITY_TIMEOUT_MINUTES = 30;
const WARNING_BEFORE_TIMEOUT_MINUTES = 2;

// Converter para milissegundos
const INACTIVITY_TIMEOUT_MS = INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;
const WARNING_TIMEOUT_MS = (INACTIVITY_TIMEOUT_MINUTES - WARNING_BEFORE_TIMEOUT_MINUTES) * 60 * 1000;

// Eventos que resetam o timer de inatividade
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keypress',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'wheel'
];

export function useSessionTimeout() {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const warningShownRef = useRef<boolean>(false);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    console.log('[SessionTimeout] Sessão expirada por inatividade');
    
    toast({
      title: "Sessão Expirada",
      description: `Sua sessão foi encerrada após ${INACTIVITY_TIMEOUT_MINUTES} minutos de inatividade para proteger os dados dos pacientes.`,
      variant: "destructive",
      duration: 10000,
    });
    
    await signOut();
  }, [signOut, toast]);

  const showWarning = useCallback(() => {
    if (warningShownRef.current) return;
    
    warningShownRef.current = true;
    
    toast({
      title: "⚠️ Sessão Expirando",
      description: `Sua sessão expirará em ${WARNING_BEFORE_TIMEOUT_MINUTES} minutos por inatividade. Mova o mouse ou pressione uma tecla para continuar.`,
      duration: 30000,
    });
    
    console.log('[SessionTimeout] Aviso de expiração exibido');
  }, [toast]);

  const resetTimers = useCallback(() => {
    if (!user) return;
    
    lastActivityRef.current = Date.now();
    warningShownRef.current = false;
    
    clearTimers();
    
    // Timer para mostrar aviso
    warningRef.current = setTimeout(() => {
      showWarning();
    }, WARNING_TIMEOUT_MS);
    
    // Timer para logout automático
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIMEOUT_MS);
    
  }, [user, clearTimers, showWarning, handleLogout]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    
    // Só reseta se passou mais de 1 segundo desde a última atividade
    // Isso evita múltiplos resets em sequência
    if (timeSinceLastActivity > 1000) {
      resetTimers();
    }
  }, [resetTimers]);

  useEffect(() => {
    if (!user) {
      clearTimers();
      return;
    }

    // Iniciar timers
    resetTimers();

    // Adicionar listeners de atividade
    ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Verificar atividade em outras abas (via localStorage)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lastActivity') {
        resetTimers();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Atualizar localStorage quando houver atividade
    const updateStorage = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };
    document.addEventListener('click', updateStorage, { passive: true });

    console.log(`[SessionTimeout] Timeout de sessão ativado (${INACTIVITY_TIMEOUT_MINUTES} min)`);

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('click', updateStorage);
    };
  }, [user, resetTimers, handleActivity, clearTimers]);

  return {
    resetTimers,
    timeoutMinutes: INACTIVITY_TIMEOUT_MINUTES
  };
}
