"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
  const userId = user?.id;

  // Carrega diagnóstico e configurações do usuário
  useEffect(() => {
    diagnoseBiometricSupport().then((diag) => setDiagnosis(diag));
  }, []);

  useEffect(() => {
    if (!userId) {
      setSettings(null);
      setIsLocked(false);
      setIsCurtainActive(false);
      setShowSetupPrompt(false);
      return;
    }

    const currentSettings = getBiometricSettings(userId);
    setSettings(currentSettings);

    // COLD-START LOCK: Se a proteção está habilitada, bloqueia imediatamente ao abrir/recarregar a tela
    if ((currentSettings.enabled || currentSettings.hasPin) && currentSettings.lockOnColdStart !== false) {
      setIsLocked(true);
    } else if (!currentSettings.enabled && !currentSettings.hasPin && !currentSettings.dismissedPrompt) {
      // Se ainda não configurou e não dispensou, abre o prompt proativo após 1.5s
      const timer = setTimeout(() => {
        setShowSetupPrompt(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [userId]);

  // Listener para atualização de preferências de biometria entre abas
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

  // Desbloqueio com Biometria Nativa (Face ID / Digital do celular)
  const handleUnlockWithBiometrics = useCallback(async () => {
    if (!settings?.enabled && !settings?.hasPin) {
      setIsLocked(false);
      setIsCurtainActive(false);
      return;
    }

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
        setIsLocked(false);
        setIsCurtainActive(false);
        setFailedAttempts(0);
        setErrorMessage(null);
        setInputPin("");
      } else {
        const attempts = failedAttempts + 1;
        setFailedAttempts(attempts);
        setErrorMessage(result.error || "Biometria não reconhecida.");
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([60, 80, 60]);
        }
        // Se houver PIN cadastrado ou falhou 2x, sugere o PIN
        if (settings.hasPin) {
          setIsPinModeActive(true);
        }
      }
    } catch (err: any) {
      setFailedAttempts((prev) => prev + 1);
      setErrorMessage(err.message || "Falha na validação biométrica.");
    } finally {
      setIsAuthenticating(false);
    }
  }, [settings, failedAttempts]);

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
      setIsLocked(false);
      setIsCurtainActive(false);
      setFailedAttempts(0);
      setInputPin("");
      setIsPinModeActive(false);
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

  // Digitação rápida no teclado numérico estilo banco
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

  // Ativação rápida pelo Prompt de Boas-Vindas
  const handleQuickEnableBiometrics = async () => {
    if (!userId || !user?.email) return;
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      const res = await registerBiometricCredential(userId, user.email);
      if (res.success) {
        setSettings(getBiometricSettings(userId));
        setShowSetupPrompt(false);
      } else {
        setErrorMessage(res.error || "Não foi possível registrar a biometria neste ambiente.");
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Criação de PIN pelo Prompt
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
    setShowSetupPrompt(false);
  };

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

  // Page Lifecycle API: Bloqueio e Cortina de Privacidade
  useEffect(() => {
    if (!userId || (!settings?.enabled && !settings?.hasPin)) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Cortina instantânea de multitarefa para blindar saldos no Task Switcher
        setIsCurtainActive(true);
        lastBackgroundTimestamp.current = Date.now();
      } else if (document.visibilityState === "visible") {
        const bgTime = lastBackgroundTimestamp.current;
        if (bgTime !== null) {
          const elapsedSeconds = (Date.now() - bgTime) / 1000;
          const timeout = settings?.lockTimeoutSeconds ?? 15;

          if (elapsedSeconds >= timeout) {
            setIsLocked(true);
          } else {
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

  const isProtectionActive = Boolean(settings?.enabled || settings?.hasPin);
  const shouldShowCurtain = isProtectionActive && (isCurtainActive || isLocked);

  return (
    <>
      {children}

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

      {/* CORTINA DE PRIVACIDADE & BARREIRA BIOMÉTRICA/PIN WARM OBSIDIAN */}
      {shouldShowCurtain && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bloqueio de Segurança Biométrico"
          className="fixed inset-0 z-[99999] bg-[#0A0A0A] flex flex-col items-center justify-between p-6 sm:p-10 select-none animate-in fade-in duration-200"
        >
          {/* Topo: Marca e Segurança */}
          <div className="flex items-center gap-2 pt-2">
            <span className="w-2 h-2 rounded-full bg-[#FF8216] animate-pulse" />
            <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-zinc-400 font-bold">
              KITSUNE BIOMETRIC GUARDIAN
            </span>
          </div>

          {/* Centro: Ícone da Raposa e Ação de Desbloqueio */}
          <div className="flex flex-col items-center max-w-sm w-full text-center space-y-5 my-auto">
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
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 pb-2">
            <span className="material-symbols-outlined text-xs text-emerald-500">verified_user</span>
            <span>Cofre Local Criptografado (Hardware & SHA-256)</span>
          </div>
        </div>
      )}
    </>
  );
}
