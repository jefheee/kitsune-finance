"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useFinanceData } from "@/context/FinanceDataContext";
import { createClient } from "@/utils/supabase/client";
import {
  getBiometricSettings,
  saveBiometricSettings,
  verifyBiometricCredential,
  registerBiometricCredential,
  verifySecurityPin,
  saveSecurityPin,
  diagnoseBiometricSupport,
  type BiometricSettings,
  type BiometricSupportDiagnosis,
} from "@/utils/security/biometrics";
import Spinner from "@/components/Spinner";

interface BiometricLockGuardProps {
  children: React.ReactNode;
}

export function BiometricLockGuard({ children }: BiometricLockGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useFinanceData();

  const [settings, setSettings] = useState<BiometricSettings | null>(null);
  const [diagnosis, setDiagnosis] = useState<BiometricSupportDiagnosis | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isCurtainActive, setIsCurtainActive] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);

  // Modal proativo de ativação para novos acessos no celular
  const [showSetupPrompt, setShowSetupPrompt] = useState<boolean>(false);
  const [isPinModeActive, setIsPinModeActive] = useState<boolean>(false);
  const [inputPin, setInputPin] = useState<string>("");
  const [isCreatingPin, setIsCreatingPin] = useState<boolean>(false);
  const [newPinValue, setNewPinValue] = useState<string>("");
  const [confirmPinValue, setConfirmPinValue] = useState<string>("");

  const lastBackgroundTimestamp = useRef<number | null>(null);
  const isAuthenticatingRef = useRef<boolean>(false);
  const recentlyUnlockedRef = useRef<boolean>(false);
  const hasColdStartRunRef = useRef<boolean>(false);
  const userId = user?.id;

  // Detecção precisa de dispositivo móvel (ignora PC/desktop para prompt proativo)
  const isMobileClient = useCallback(() => {
    if (typeof window === "undefined") return false;
    const ua = navigator.userAgent || "";
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const isSmall = window.innerWidth < 768;
    return isMobileUA || (hasTouch && isSmall);
  }, []);

  // Ativação e Desativação Síncrona do Escudo no DOM (0ms Snapshot Masking)
  const applyCurtainClass = useCallback((active: boolean) => {
    if (typeof document === "undefined") return;
    if (active) {
      document.body.classList.add("pwa-privacy-curtain-active");
      document.documentElement.classList.add("pwa-privacy-curtain-active");
    } else {
      document.body.classList.remove("pwa-privacy-curtain-active");
      document.documentElement.classList.remove("pwa-privacy-curtain-active");
    }
  }, []);

  // Carrega diagnóstico de hardware e configurações locais
  useEffect(() => {
    diagnoseBiometricSupport().then((diag) => setDiagnosis(diag));
  }, []);

  useEffect(() => {
    const isAuthPage = pathname === "/login" || pathname === "/signup" || pathname === "/";
    if (!userId || isAuthPage) {
      setSettings(null);
      setIsLocked(false);
      setIsCurtainActive(false);
      applyCurtainClass(false);
      setShowSetupPrompt(false);
      return;
    }

    const currentSettings = getBiometricSettings(userId);
    setSettings(currentSettings);

    const hasProtection = Boolean(currentSettings.enabled || currentSettings.hasPin);

    let hasActiveSessionUnlock = false;
    try {
      const lastUnlockStr = sessionStorage.getItem(`kitsune_${userId}_session_unlocked`);
      if (lastUnlockStr) {
        const lastUnlockTime = parseInt(lastUnlockStr, 10);
        if (Date.now() - lastUnlockTime < 1000 * 60 * 60) {
          hasActiveSessionUnlock = true;
        }
      }
    } catch (_) {}

    // COLD-START LOCK: Roda APENAS UMA VEZ na inicialização do app, NUNCA em trocas de rota ou recarregamento acidental
    if (!hasColdStartRunRef.current) {
      hasColdStartRunRef.current = true;
      if (hasProtection && !hasActiveSessionUnlock && currentSettings.lockOnColdStart !== false) {
        setIsLocked(true);
        setIsCurtainActive(true);
        applyCurtainClass(true);
        return;
      }
    }

    // Modal de ativação proativo: EXCLUSIVO para dispositivos móveis reais (nunca no PC)
    if (!hasProtection && !currentSettings.dismissedPrompt) {
      if (!isMobileClient()) {
        return; // No PC, o usuário configura em /settings se desejar; não exibe modal móvel
      }

      let deviceDismissed = false;
      try {
        deviceDismissed = localStorage.getItem("kitsune_prompt_dismissed_device") === "true";
      } catch (_) {}

      if (!deviceDismissed) {
        const timer = setTimeout(() => {
          setShowSetupPrompt(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [userId, pathname, applyCurtainClass, isMobileClient]);

  // Listener para atualização de preferências entre abas
  useEffect(() => {
    if (!userId) return;
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `kitsune_${userId}_biometric_settings`) {
        const updated = getBiometricSettings(userId);
        setSettings(updated);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [userId]);

  // Sincroniza a classe CSS do body sempre que os estados mudarem
  useEffect(() => {
    const shouldBeActive = Boolean(isLocked || isCurtainActive);
    applyCurtainClass(shouldBeActive);
  }, [isLocked, isCurtainActive, applyCurtainClass]);

  // Desbloqueio com Biometria Nativa (Face ID / Digital sob a tela do A54)
  const handleUnlockWithBiometrics = useCallback(async () => {
    if (!settings?.enabled && !settings?.hasPin) {
      recentlyUnlockedRef.current = true;
      lastBackgroundTimestamp.current = null;
      if (userId) {
        try {
          sessionStorage.setItem(`kitsune_${userId}_session_unlocked`, Date.now().toString());
        } catch (_) {}
      }
      setIsLocked(false);
      setIsCurtainActive(false);
      applyCurtainClass(false);
      setTimeout(() => {
        recentlyUnlockedRef.current = false;
      }, 2000);
      return;
    }

    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    setErrorMessage(null);

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([15]);
    }

    try {
      const result = await verifyBiometricCredential(settings.credentialId);
      if (result.success) {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([25, 40, 25]);
        }
        // Desbloqueio definitivo: reseta timestamp e ativa imunidade contra eventos blur/focus do SO
        recentlyUnlockedRef.current = true;
        lastBackgroundTimestamp.current = null;
        if (userId) {
          try {
            sessionStorage.setItem(`kitsune_${userId}_session_unlocked`, Date.now().toString());
          } catch (_) {}
        }
        setIsLocked(false);
        setIsCurtainActive(false);
        applyCurtainClass(false);
        setFailedAttempts(0);
        setErrorMessage(null);
        setInputPin("");
        setTimeout(() => {
          recentlyUnlockedRef.current = false;
        }, 2000);
      } else {
        const attempts = failedAttempts + 1;
        setFailedAttempts(attempts);
        setErrorMessage(result.error || "Biometria não reconhecida.");
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([60, 80, 60]);
        }
        if (settings.hasPin) {
          setIsPinModeActive(true);
        }
      }
    } catch (err: any) {
      setFailedAttempts((prev) => prev + 1);
      setErrorMessage(err.message || "Falha na validação biométrica.");
    } finally {
      setIsAuthenticating(false);
      // Aguarda janela segura antes de liberar o flag de autenticação
      setTimeout(() => {
        isAuthenticatingRef.current = false;
      }, 500);
    }
  }, [settings, failedAttempts, applyCurtainClass]);

  // Desbloqueio com PIN Numérico Local
  const handleUnlockWithPin = async (pinToVerify?: string) => {
    if (!userId) return;
    const pin = pinToVerify || inputPin;
    if (pin.length < 4) return;

    setIsAuthenticating(true);
    setErrorMessage(null);

    const isValid = await verifySecurityPin(userId, pin);
    if (isValid) {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([25, 40, 25]);
      }
      recentlyUnlockedRef.current = true;
      lastBackgroundTimestamp.current = null;
      if (userId) {
        try {
          sessionStorage.setItem(`kitsune_${userId}_session_unlocked`, Date.now().toString());
        } catch (_) {}
      }
      setIsLocked(false);
      setIsCurtainActive(false);
      applyCurtainClass(false);
      setFailedAttempts(0);
      setInputPin("");
      setIsPinModeActive(false);
      setTimeout(() => {
        recentlyUnlockedRef.current = false;
      }, 2000);
    } else {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      setErrorMessage("PIN incorreto. Tente novamente.");
      setInputPin("");
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([80, 50, 80]);
      }
    }
    setIsAuthenticating(false);
  };

  const handleKeypadPress = (digit: string) => {
    if (inputPin.length >= 6) return;
    const next = inputPin + digit;
    setInputPin(next);
    if (next.length === 4 || next.length === 6) {
      handleUnlockWithPin(next);
    }
  };

  const handleKeypadBackspace = () => {
    setInputPin((prev) => prev.slice(0, -1));
  };

  const handleQuickEnableBiometrics = async () => {
    if (!userId || !user?.email) return;
    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      const res = await registerBiometricCredential(userId, user.email);
      if (res.success) {
        const updated = getBiometricSettings(userId);
        setSettings(updated);
        setShowSetupPrompt(false);
      } else {
        setErrorMessage(res.error || "Não foi possível registrar a biometria neste ambiente.");
      }
    } finally {
      setIsAuthenticating(false);
      setTimeout(() => {
        isAuthenticatingRef.current = false;
      }, 500);
    }
  };

  const handleSaveInitialPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (newPinValue.length < 4) {
      setErrorMessage("O PIN deve ter no mínimo 4 números.");
      return;
    }
    if (newPinValue !== confirmPinValue) {
      setErrorMessage("Os PINs informados não coincidem.");
      return;
    }
    await saveSecurityPin(userId, newPinValue);
    setSettings(getBiometricSettings(userId));
    setIsCreatingPin(false);
    setShowSetupPrompt(false);
    setErrorMessage(null);
  };

  const handleDismissPrompt = () => {
    if (userId) {
      saveBiometricSettings(userId, { dismissedPrompt: true });
      setSettings(getBiometricSettings(userId));
    }
    try {
      localStorage.setItem("kitsune_prompt_dismissed_device", "true");
    } catch (_) {}
    setShowSetupPrompt(false);
  };

  const handleFallbackLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Erro ao desautenticar:", err);
    } finally {
      if (userId) {
        try {
          sessionStorage.removeItem(`kitsune_${userId}_session_unlocked`);
        } catch (_) {}
      }
      lastBackgroundTimestamp.current = null;
      setIsLocked(false);
      setIsCurtainActive(false);
      applyCurtainClass(false);
      setShowSetupPrompt(false);
      router.push("/login");
      router.refresh();
    }
  };

  // CAPTURA INSTANTÂNEA DE MULTITAREFA (0ms Task Switcher Snapshot Masking)
  useEffect(() => {
    if (!userId || (!settings?.enabled && !settings?.hasPin)) return;

    // Disparado no instante em que o usuário toca no botão de multitarefa ou inicia o gesto de arrastar
    const handleImmediateBlur = () => {
      // Ignora o blur se for o próprio diálogo biométrico nativo da plataforma ou se acabou de desbloquear
      if (isAuthenticatingRef.current || recentlyUnlockedRef.current) return;

      // Executa de forma síncrona na mesma thread do browser: esconde saldos antes do snapshot do Android
      applyCurtainClass(true);
      setIsCurtainActive(true);
      lastBackgroundTimestamp.current = Date.now();
    };

    const handleVisibilityChange = () => {
      if (recentlyUnlockedRef.current) return;

      if (document.visibilityState === "hidden") {
        if (!isAuthenticatingRef.current) {
          applyCurtainClass(true);
          setIsCurtainActive(true);
          lastBackgroundTimestamp.current = Date.now();
        }
      } else if (document.visibilityState === "visible") {
        const bgTime = lastBackgroundTimestamp.current;
        if (bgTime !== null) {
          const elapsedSeconds = (Date.now() - bgTime) / 1000;
          const timeout = settings?.lockTimeoutSeconds ?? 15;

          if (elapsedSeconds >= timeout) {
            setIsLocked(true);
            applyCurtainClass(true);
          } else if (!isLocked) {
            // Se voltou antes do timeout e não estava previamente bloqueado
            setIsCurtainActive(false);
            applyCurtainClass(false);
            lastBackgroundTimestamp.current = null;
          }
        }
      }
    };

    const handleFocus = () => {
      if (recentlyUnlockedRef.current) return;

      const bgTime = lastBackgroundTimestamp.current;
      if (bgTime !== null && !isLocked) {
        const elapsedSeconds = (Date.now() - bgTime) / 1000;
        const timeout = settings?.lockTimeoutSeconds ?? 15;
        if (elapsedSeconds < timeout) {
          setIsCurtainActive(false);
          applyCurtainClass(false);
          lastBackgroundTimestamp.current = null;
        } else {
          setIsLocked(true);
          applyCurtainClass(true);
        }
      }
    };

    const handlePageHide = () => {
      if (!isAuthenticatingRef.current && !recentlyUnlockedRef.current) {
        applyCurtainClass(true);
        setIsCurtainActive(true);
        lastBackgroundTimestamp.current = Date.now();
      }
    };

    window.addEventListener("blur", handleImmediateBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleImmediateBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [settings, userId, isLocked, applyCurtainClass]);

  const isProtectionActive = Boolean(settings?.enabled || settings?.hasPin);
  const shouldShowCurtain = isProtectionActive && (isCurtainActive || isLocked);

  return (
    <>
      {/* Contêiner Raiz do App (Borrado e Ocultado Instantaneamente em Multitarefa) */}
      <div id="kitsune-app-root" className="w-full h-full min-h-screen">
        {children}
      </div>

      {/* MODAL PROATIVO DE BOAS-VINDAS: CONVITE DE ATIVAÇÃO DA PROTEÇÃO BIOMÉTRICA */}
      {showSetupPrompt && !shouldShowCurtain && (
        <div className="fixed inset-0 z-[99990] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-[#121214] border border-[#27272A] p-6 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#FF8216]/10 border border-[#FF8216]/30 flex items-center justify-center mx-auto text-[#FF8216]">
              <span className="material-symbols-outlined text-3xl">fingerprint</span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white">
                Proteger com Biometria ou PIN?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Proteja seus saldos e faturas contra visualização indevida ao alternar de tela no seu celular.
              </p>
            </div>

            {diagnosis && !diagnosis.isSecureContext && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[11px] text-left">
                <strong>Atenção:</strong> Conexão HTTP detectada. Para usar o leitor de digital no celular, acesse via HTTPS (ex: Vercel). Você pode usar um <strong>PIN numérico</strong> agora.
              </div>
            )}

            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
                {errorMessage}
              </div>
            )}

            {!isCreatingPin ? (
              <div className="space-y-2.5 pt-1">
                {diagnosis?.isSupported ? (
                  <button
                    type="button"
                    onClick={handleQuickEnableBiometrics}
                    disabled={isAuthenticating}
                    className="w-full h-11 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] text-black font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isAuthenticating ? (
                      <Spinner size={16} className="text-black" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">fingerprint</span>
                        <span>Ativar Face ID / Digital</span>
                      </>
                    )}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setIsCreatingPin(true)}
                  className="w-full h-11 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#FF8216]">pin</span>
                  <span>Criar PIN Numérico (4 Dígitos)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDismissPrompt}
                  className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  Lembrar mais tarde
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveInitialPin} className="space-y-3 pt-1 text-left">
                <div>
                  <label className="text-[11px] text-zinc-400 font-semibold block mb-1">
                    Digite um PIN de 4 a 6 dígitos:
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={newPinValue}
                    onChange={(e) => setNewPinValue(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    className="w-full px-3 py-2 rounded-xl bg-[#18181B] border border-[#27272A] text-white text-center text-lg tracking-[0.4em] font-mono focus:outline-none focus:border-[#FF8216]"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 font-semibold block mb-1">
                    Confirme o PIN:
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmPinValue}
                    onChange={(e) => setConfirmPinValue(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    className="w-full px-3 py-2 rounded-xl bg-[#18181B] border border-[#27272A] text-white text-center text-lg tracking-[0.4em] font-mono focus:outline-none focus:border-[#FF8216]"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingPin(false)}
                    className="flex-1 h-10 rounded-xl bg-[#18181B] border border-[#27272A] text-zinc-400 text-xs font-semibold cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-10 rounded-xl bg-[#FF8216] text-black text-xs font-bold cursor-pointer"
                  >
                    Salvar PIN
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ESCUDO FIXO DE MULTITAREFA PWA (Snapshot Masking 0ms no DOM com Transição Fluida) */}
      <div
        id="pwa-privacy-shield-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Bloqueio de Segurança Biométrico"
        className="fixed inset-0 w-screen h-screen z-[2147483647] flex flex-col items-center justify-between p-6 select-none overflow-hidden"
      >
        {!isLocked ? null : (
          /* TELA DE AUTENTICAÇÃO ATIVA (Exibida quando o usuário retorna e o app está bloqueado) */
          <>
            {/* Topo: Marca e Segurança */}
            <div className="flex items-center gap-2 pt-6">
              <span className="w-2 h-2 rounded-full bg-[#FF8216] animate-pulse" />
              <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-zinc-400 font-bold">
                KITSUNE BIOMETRIC GUARDIAN
              </span>
            </div>

            {/* Centro: Ícone da Raposa e Ação de Desbloqueio */}
            <div className="flex flex-col items-center max-w-sm w-full text-center space-y-5 my-auto px-4">
              <div className="relative flex items-center justify-center">
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

              <div className="space-y-1.5">
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#F4F4F5] tracking-tight">
                  Kitsune Protegido
                </h1>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                  {isPinModeActive
                    ? "Digite seu PIN de 4 a 6 dígitos para acessar sua conta."
                    : "Autenticação biométrica necessária para acessar seus dados patrimoniais."}
                </p>
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-medium w-full animate-in shake duration-300">
                  {errorMessage}
                </div>
              )}

              {!isPinModeActive ? (
                /* MODO BIOMETRIA: Botão ergonômico W3C User Gesture */
                <div className="w-full space-y-3 pt-1">
                  {settings?.enabled ? (
                    <button
                      type="button"
                      onClick={handleUnlockWithBiometrics}
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
                          <span>Desbloquear com Biometria</span>
                        </>
                      )}
                    </button>
                  ) : null}

                  {settings?.hasPin && (
                    <button
                      type="button"
                      onClick={() => setIsPinModeActive(true)}
                      className="w-full h-11 rounded-2xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#FF8216]">pin</span>
                      <span>Desbloquear com PIN</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleFallbackLogout}
                    className="w-full py-2 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">lock_reset</span>
                    <span>Entrar com senha / Trocar de conta</span>
                  </button>
                </div>
              ) : (
                /* MODO PIN: Teclado Numérico Estilo App Bancário */
                <div className="w-full space-y-4 pt-1">
                  {/* Mostrador de Dígitos Mascarados */}
                  <div className="flex items-center justify-center gap-3 py-2">
                    {[0, 1, 2, 3].map((idx) => {
                      const filled = inputPin.length > idx;
                      return (
                        <div
                          key={idx}
                          className={`w-4 h-4 rounded-full border-2 transition-all ${
                            filled
                              ? "bg-[#FF8216] border-[#FF8216] scale-110"
                              : "border-zinc-600 bg-zinc-900"
                          }`}
                        />
                      );
                    })}
                  </div>

                  {/* Keypad Numérico 3x4 */}
                  <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleKeypadPress(num)}
                        className="h-13 rounded-2xl bg-[#18181B] hover:bg-[#27272A] active:bg-[#FF8216]/20 border border-[#27272A] text-xl font-bold font-mono text-white transition-all cursor-pointer"
                      >
                        {num}
                      </button>
                    ))}
                    {settings?.enabled ? (
                      <button
                        type="button"
                        onClick={() => setIsPinModeActive(false)}
                        className="h-13 rounded-2xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] flex items-center justify-center text-[#FF8216] transition-all cursor-pointer"
                        title="Voltar para Biometria"
                      >
                        <span className="material-symbols-outlined text-2xl">fingerprint</span>
                      </button>
                    ) : (
                      <div />
                    )}
                    <button
                      type="button"
                      onClick={() => handleKeypadPress("0")}
                      className="h-13 rounded-2xl bg-[#18181B] hover:bg-[#27272A] active:bg-[#FF8216]/20 border border-[#27272A] text-xl font-bold font-mono text-white transition-all cursor-pointer"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={handleKeypadBackspace}
                      className="h-13 rounded-2xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
                      title="Apagar"
                    >
                      <span className="material-symbols-outlined text-xl">backspace</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-4 pt-1">
                    {settings?.enabled && (
                      <button
                        type="button"
                        onClick={() => setIsPinModeActive(false)}
                        className="text-xs text-[#FF8216] hover:underline cursor-pointer"
                      >
                        Usar Biometria
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleFallbackLogout}
                      className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer"
                    >
                      Sair da conta
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé Seguro */}
            <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 pb-4">
              <span className="material-symbols-outlined text-xs text-emerald-500">verified_user</span>
              <span>Cofre Local Criptografado (Hardware & SHA-256)</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
