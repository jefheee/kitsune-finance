"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useFinanceData } from "@/context/FinanceDataContext";
import { createClient } from "@/utils/supabase/client";
import {
  getBiometricSettings,
  verifyBiometricCredential,
  type BiometricSettings,
} from "@/utils/security/biometrics";
import Spinner from "@/components/Spinner";

interface BiometricLockGuardProps {
  children: React.ReactNode;
}

export function BiometricLockGuard({ children }: BiometricLockGuardProps) {
  const router = useRouter();
  const { user } = useFinanceData();

  const [settings, setSettings] = useState<BiometricSettings | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isCurtainActive, setIsCurtainActive] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);

  const lastBackgroundTimestamp = useRef<number | null>(null);
  const userId = user?.id;

  // Carrega configurações biométricas ao inicializar ou mudar usuário
  useEffect(() => {
    if (!userId) {
      setSettings(null);
      setIsLocked(false);
      setIsCurtainActive(false);
      return;
    }
    const userSettings = getBiometricSettings(userId);
    setSettings(userSettings);
  }, [userId]);

  // Listener para atualização de preferências de biometria entre abas ou na mesma janela
  useEffect(() => {
    if (!userId) return;
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `kitsune_${userId}_biometric_settings`) {
        setSettings(getBiometricSettings(userId));
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [userId]);

  // Desbloqueio com gesto explícito do usuário (W3C User Gesture)
  const handleUnlock = useCallback(async () => {
    if (!settings?.enabled) {
      setIsLocked(false);
      setIsCurtainActive(false);
      return;
    }

    setIsAuthenticating(true);
    setErrorMessage(null);

    // Feedback háptico se disponível no dispositivo
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([15]);
    }

    try {
      const result = await verifyBiometricCredential(settings.credentialId);
      if (result.success) {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([30, 50, 30]);
        }
        setIsLocked(false);
        setIsCurtainActive(false);
        setFailedAttempts(0);
        setErrorMessage(null);
      } else {
        const attempts = failedAttempts + 1;
        setFailedAttempts(attempts);
        setErrorMessage(result.error || "Biometria não reconhecida. Tente novamente.");
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([50, 80, 50]);
        }
      }
    } catch (err: any) {
      setFailedAttempts((prev) => prev + 1);
      setErrorMessage(err.message || "Erro na validação biométrica.");
    } finally {
      setIsAuthenticating(false);
    }
  }, [settings, failedAttempts]);

  // Fallback: Logout e redirecionamento para login com senha
  const handleFallbackLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Erro ao desautenticar:", err);
    } finally {
      setIsLocked(false);
      setIsCurtainActive(false);
      router.push("/login");
      router.refresh();
    }
  };

  // Implementação robusta do Page Lifecycle API
  useEffect(() => {
    if (!settings?.enabled || !userId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Ativa Cortina de Privacidade IMEDIATAMENTE para prevenir captura do Task Switcher do iOS/Android
        setIsCurtainActive(true);
        lastBackgroundTimestamp.current = Date.now();
      } else if (document.visibilityState === "visible") {
        const bgTime = lastBackgroundTimestamp.current;
        if (bgTime !== null) {
          const elapsedSeconds = (Date.now() - bgTime) / 1000;
          const timeout = settings.lockTimeoutSeconds;

          // Se ficou fora por mais tempo que a tolerância (ex: 15s ou 0s se imediato), bloqueia
          if (elapsedSeconds >= timeout) {
            setIsLocked(true);
          } else {
            // Se voltou antes do timeout, remove a cortina de privacidade
            setIsCurtainActive(false);
          }
        }
      }
    };

    const handlePageHide = () => {
      setIsCurtainActive(true);
      lastBackgroundTimestamp.current = Date.now();
    };

    const handlePageShow = () => {
      if (document.visibilityState === "visible") {
        handleVisibilityChange();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [settings, userId]);

  const shouldShowCurtain = settings?.enabled && (isCurtainActive || isLocked);

  return (
    <>
      {children}

      {/* Cortina de Privacidade & Bloqueio Biométrico Warm Obsidian */}
      {shouldShowCurtain && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bloqueio de Segurança Biométrico"
          className="fixed inset-0 z-[99999] bg-[#0A0A0A] flex flex-col items-center justify-between p-6 sm:p-10 select-none animate-in fade-in duration-200"
        >
          {/* Topo: Marca e Segurança */}
          <div className="flex items-center gap-2 pt-4">
            <span className="w-2 h-2 rounded-full bg-[#FF8216] animate-pulse" />
            <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-zinc-400 font-bold">
              KITSUNE BIOMETRIC GUARDIAN
            </span>
          </div>

          {/* Centro: Ícone da Raposa com Anéis de Pulso e Ação */}
          <div className="flex flex-col items-center max-w-sm w-full text-center space-y-6">
            <div className="relative flex items-center justify-center">
              {/* Anel de Pulso Warm Obsidian */}
              <div className="absolute w-28 h-28 rounded-full bg-[#FF8216]/10 animate-ping" />
              <div className="w-24 h-24 rounded-3xl bg-[#121214] border-2 border-[#FF8216]/40 flex items-center justify-center shadow-[0_0_40px_rgba(255,130,22,0.18)] relative z-10">
                <Image
                  src="/assets/logo/logo_sem_fundo.png"
                  alt="Kitsune Finance"
                  width={56}
                  height={56}
                  className="w-14 h-14 object-contain drop-shadow-[0_4px_12px_rgba(255,130,22,0.35)]"
                  priority
                />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#F4F4F5] tracking-tight">
                Kitsune Protegido
              </h1>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                Autenticação biométrica necessária para acessar seus saldos, faturas e inteligência patrimonial.
              </p>
            </div>

            {/* Mensagem de Erro com Alerta Amigável */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-medium w-full animate-in shake duration-300">
                {errorMessage}
              </div>
            )}

            {/* Botão de Desbloqueio Biométrico Ergonômico (User Gesture W3C) */}
            <div className="w-full space-y-3 pt-2">
              <button
                type="button"
                onClick={handleUnlock}
                disabled={isAuthenticating}
                className="w-full h-13 px-6 rounded-2xl bg-[#FF8216] hover:bg-[#FFA047] active:bg-[#E66E08] text-black font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(255,130,22,0.3)] transition-all cursor-pointer disabled:opacity-50"
              >
                {isAuthenticating ? (
                  <>
                    <Spinner size={18} className="text-black" />
                    <span>Validando Biometria...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[22px]">fingerprint</span>
                    <span>Desbloquear com Face ID / Biometria</span>
                  </>
                )}
              </button>

              {/* Opção de Fallback após Falhas ou por Escolha do Usuário */}
              {(failedAttempts >= 2 || !isAuthenticating) && (
                <button
                  type="button"
                  onClick={handleFallbackLogout}
                  className="w-full py-2.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">lock_reset</span>
                  <span>Entrar com senha / Trocar de conta</span>
                </button>
              )}
            </div>
          </div>

          {/* Rodapé Seguro */}
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 pb-2">
            <span className="material-symbols-outlined text-xs text-emerald-500">verified_user</span>
            <span>Chave Criptográfica Local Segura (WebAuthn W3C)</span>
          </div>
        </div>
      )}
    </>
  );
}
