"use client";

/**
 * Utilitários puros para autenticação biométrica WebAuthn W3C (Passkey / Face ID / Touch ID / Digital Android)
 * e proteção local com PIN criptografado (SHA-256).
 * Compatível com iOS Safari, Android Chrome (Samsung, Pixel, Xiaomi), Windows Hello e macOS Touch ID.
 */

export interface BiometricSettings {
  enabled: boolean;
  hasPin: boolean;
  pinHash?: string | null;
  lockTimeoutSeconds: number; // 0 = imediato, 15, 60, 300
  credentialId: string | null;
  registeredAt?: string | null;
  dismissedPrompt?: boolean;
  lockOnColdStart: boolean;
}

const DEFAULT_SETTINGS: BiometricSettings = {
  enabled: false,
  hasPin: false,
  pinHash: null,
  lockTimeoutSeconds: 15,
  credentialId: null,
  registeredAt: null,
  dismissedPrompt: false,
  lockOnColdStart: true,
};

/**
 * Converte ArrayBuffer em Base64URL string (RFC 4648 §5).
 */
export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Converte Base64URL string em ArrayBuffer.
 */
export function base64UrlToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Gera hash SHA-256 em formato hexadecimal de uma string (usado para validação determinística de PIN).
 */
export async function hashStringSHA256(text: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    // Fallback simples caso subtle crypto não esteja disponível
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Diagnóstico abrangente de suporte à biometria e ambiente de execução.
 */
export interface BiometricSupportDiagnosis {
  isSupported: boolean;
  isSecureContext: boolean;
  isIpAddress: boolean;
  hostname: string;
  hasPlatformAuthenticator: boolean;
  reason?: string;
}

export async function diagnoseBiometricSupport(): Promise<BiometricSupportDiagnosis> {
  if (typeof window === "undefined") {
    return {
      isSupported: false,
      isSecureContext: false,
      isIpAddress: false,
      hostname: "",
      hasPlatformAuthenticator: false,
      reason: "Ambiente não é um navegador cliente.",
    };
  }

  const hostname = window.location.hostname;
  const isSecureContext = Boolean(window.isSecureContext);
  const isIpAddress = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === "::1";

  const hasCredentialsAPI = Boolean(navigator.credentials);
  const hasPublicKey = Boolean(window.PublicKeyCredential);

  let hasPlatformAuthenticator = false;
  if (
    hasPublicKey &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
  ) {
    try {
      hasPlatformAuthenticator =
        await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      hasPlatformAuthenticator = false;
    }
  }

  if (!isSecureContext && hostname !== "localhost") {
    return {
      isSupported: false,
      isSecureContext,
      isIpAddress,
      hostname,
      hasPlatformAuthenticator,
      reason:
        "O WebAuthn (Face ID / Digital) exige HTTPS oficial (ex: Vercel) ou localhost. Em conexões HTTP por IP de rede local, use o PIN numérico.",
    };
  }

  if (!hasCredentialsAPI || !hasPublicKey) {
    return {
      isSupported: false,
      isSecureContext,
      isIpAddress,
      hostname,
      hasPlatformAuthenticator,
      reason: "Navegador não possui suporte à API WebAuthn.",
    };
  }

  return {
    isSupported: hasPlatformAuthenticator,
    isSecureContext,
    isIpAddress,
    hostname,
    hasPlatformAuthenticator,
    reason: hasPlatformAuthenticator
      ? undefined
      : "Nenhum autenticador de plataforma com biometria (Face ID / Digital) ativado neste aparelho.",
  };
}

/**
 * Verifica se a plataforma e o navegador suportam autenticação biométrica via hardware local.
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  const diagnosis = await diagnoseBiometricSupport();
  return diagnosis.isSupported;
}

/**
 * Obtém as configurações biométricas do usuário armazenadas localmente.
 */
export function getBiometricSettings(userId: string): BiometricSettings {
  if (typeof window === "undefined" || !userId) return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(`kitsune_${userId}_biometric_settings`);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      hasPin: Boolean(parsed.hasPin),
      pinHash: parsed.pinHash || null,
      lockTimeoutSeconds: typeof parsed.lockTimeoutSeconds === "number" ? parsed.lockTimeoutSeconds : 15,
      credentialId: parsed.credentialId || null,
      registeredAt: parsed.registeredAt || null,
      dismissedPrompt: Boolean(parsed.dismissedPrompt),
      lockOnColdStart: parsed.lockOnColdStart !== false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Salva as configurações biométricas do usuário.
 */
export function saveBiometricSettings(
  userId: string,
  settings: Partial<BiometricSettings>
): BiometricSettings {
  if (typeof window === "undefined" || !userId) return DEFAULT_SETTINGS;
  const current = getBiometricSettings(userId);
  const updated: BiometricSettings = {
    ...current,
    ...settings,
  };
  try {
    window.localStorage.setItem(
      `kitsune_${userId}_biometric_settings`,
      JSON.stringify(updated)
    );
  } catch (err) {
    console.error("[Biometrics] Erro ao salvar configurações:", err);
  }
  return updated;
}

/**
 * Cadastra ou altera o PIN numérico do cofre local.
 */
export async function saveSecurityPin(userId: string, pin: string): Promise<boolean> {
  if (!userId || !pin || pin.length < 4) return false;
  const hash = await hashStringSHA256(`kitsune_salt_${userId}_${pin}`);
  saveBiometricSettings(userId, {
    hasPin: true,
    pinHash: hash,
    enabled: true, // Ativa proteção geral
  });
  return true;
}

/**
 * Valida o PIN numérico digitado pelo usuário.
 */
export async function verifySecurityPin(userId: string, inputPin: string): Promise<boolean> {
  if (!userId || !inputPin) return false;
  const settings = getBiometricSettings(userId);
  if (!settings.hasPin || !settings.pinHash) return false;

  const inputHash = await hashStringSHA256(`kitsune_salt_${userId}_${inputPin}`);
  return inputHash === settings.pinHash;
}

/**
 * Registra uma nova credencial biométrica na plataforma (Face ID / Touch ID / Digital Android).
 */
export async function registerBiometricCredential(
  userId: string,
  email: string
): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  if (typeof window === "undefined" || !navigator.credentials) {
    return { success: false, error: "WebAuthn não é suportado neste navegador." };
  }

  const diagnosis = await diagnoseBiometricSupport();
  if (!diagnosis.isSupported) {
    return {
      success: false,
      error: diagnosis.reason || "Sensor biométrico não disponível neste aparelho ou ambiente.",
    };
  }

  try {
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const userHandle = new TextEncoder().encode(userId);
    const hostname = window.location.hostname;

    // A especificação WebAuthn proíbe IPs literais no rp.id (RFC 5280).
    // Se for IP, o navegador deve inferir ou usar rp sem id explícito.
    const isIp = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    const rpConfig: PublicKeyCredentialRpEntity = {
      name: "Kitsune Finance",
      ...(isIp ? {} : { id: hostname }),
    };

    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: rpConfig,
      user: {
        id: userHandle,
        name: email,
        displayName: email.split("@")[0] || "Investidor Kitsune",
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },   // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, error: "Falha ao gerar credencial biométrica." };
    }

    const credentialId = bufferToBase64Url(credential.rawId);

    saveBiometricSettings(userId, {
      enabled: true,
      credentialId,
      registeredAt: new Date().toISOString(),
      dismissedPrompt: true,
    });

    return { success: true, credentialId };
  } catch (err: any) {
    console.error("[Biometrics] Erro no registro biométrico:", err);
    if (err.name === "NotAllowedError") {
      return { success: false, error: "Registro biométrico cancelado ou recusado pelo usuário." };
    }
    if (err.name === "InvalidStateError") {
      return { success: false, error: "Esta chave biométrica já está registrada para este aparelho." };
    }
    return { success: false, error: err.message || "Erro desconhecido ao registrar biometria." };
  }
}

/**
 * Realiza a verificação biométrica do usuário usando hardware da plataforma.
 * Exige User Gesture obrigatório pelo W3C (disparado diretamente por clique ou toque do usuário).
 */
export async function verifyBiometricCredential(
  credentialId?: string | null
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === "undefined" || !navigator.credentials) {
    return { success: false, error: "WebAuthn não suportado." };
  }

  try {
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const hostname = window.location.hostname;
    const isIp = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);

    const allowCredentials: PublicKeyCredentialDescriptor[] = [];
    if (credentialId) {
      try {
        allowCredentials.push({
          id: base64UrlToBuffer(credentialId),
          type: "public-key",
          transports: ["internal"],
        });
      } catch {
        // Ignora erro e tenta via autenticador residente
      }
    }

    const getOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      ...(isIp ? {} : { rpId: hostname }),
      userVerification: "required",
      ...(allowCredentials.length > 0 ? { allowCredentials } : {}),
    };

    const assertion = (await navigator.credentials.get({
      publicKey: getOptions,
    })) as PublicKeyCredential | null;

    if (!assertion) {
      return { success: false, error: "Autenticação biométrica não concluída." };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[Biometrics] Erro na verificação biométrica:", err);
    if (err.name === "NotAllowedError") {
      return { success: false, error: "Biometria cancelada ou não reconhecida." };
    }
    return { success: false, error: err.message || "Falha na verificação de identidade." };
  }
}
