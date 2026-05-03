import { useEffect, useState } from "react";
import { whitelabel } from "@/config/whitelabel";
import { motion } from "framer-motion";
import { Shield, Clock, UserCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export function PendingApprovalScreen() {
  const { signOut, user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Get username from user metadata
  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Usuário';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 max-w-lg w-full"
      >
        {/* Glass card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-8 shadow-2xl">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-4xl font-black bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent tracking-tight">
                {whitelabel.platform.name}
              </span>
              <span className="text-xs font-medium text-cyan-400 bg-cyan-400/20 px-2 py-0.5 rounded-full">
                {whitelabel.platform.version}
              </span>
            </div>
            <p className="text-sm text-blue-200/80 italic">
              {whitelabel.platform.slogan}
            </p>
            <p className="text-[11px] text-white/50 mt-2 uppercase tracking-wider">
              {whitelabel.institution.hospitalShortName}
            </p>
          </motion.div>

          {/* Status icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            className="flex justify-center mb-6"
          >
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center border-2 border-amber-400/50">
                <Clock className="h-12 w-12 text-amber-400" />
              </div>
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-amber-400/30"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
            </div>
          </motion.div>

          {/* Welcome message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center mb-6"
          >
            <h2 className="text-xl font-bold text-white mb-2">
              Olá, <span className="text-cyan-400">{username}</span>!
            </h2>
            <p className="text-white/70 text-sm">
              Seu cadastro foi recebido com sucesso
            </p>
          </motion.div>

          {/* Info box */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 mb-6"
          >
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <UserCheck className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-amber-300 font-semibold mb-1">
                  Aguardando Aprovação
                </h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  Seu acesso ao sistema está sendo analisado pelo <strong className="text-white">Coordenador/Administrador</strong>. 
                  Assim que for aprovado, você terá acesso completo aos dados e funcionalidades.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="space-y-3 mb-8"
          >
            <div className="flex items-center gap-3 text-white/60 text-sm">
              <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">1</div>
              <span>Aguarde o contato do administrador</span>
            </div>
            <div className="flex items-center gap-3 text-white/60 text-sm">
              <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">2</div>
              <span>Após aprovação, faça login novamente</span>
            </div>
            <div className="flex items-center gap-3 text-white/60 text-sm">
              <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">3</div>
              <span>Acesse todas as funcionalidades do sistema</span>
            </div>
          </motion.div>

          {/* Logout button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <Button
              onClick={signOut}
              variant="outline"
              className="w-full bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair e Tentar Novamente
            </Button>
          </motion.div>

          {/* Security badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center justify-center gap-2 mt-6 text-white/40 text-xs"
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Conforme Lei 13.709/2018 (LGPD)</span>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-center mt-6"
        >
          <p className="text-white/30 text-xs">
            {whitelabel.credits.developerLabel} <span className="text-cyan-400/60 font-medium">{whitelabel.credits.developerName}</span>
          </p>
          <p className="text-white/20 text-[10px] mt-1">
            {currentTime.toLocaleDateString('pt-BR')} • {currentTime.toLocaleTimeString('pt-BR')}
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}