"use client";

/**
 * Utilitários puros para autenticação biométrica WebAuthn W3C (Passkey / Face ID / Touch ID / Digital Android).
 * Compatível com iOS Safari, Android Chrome, Windows Hello e macOS Touch ID.
 */

export interface BiometricSettings {
  enabled: boolean;
  lockTimeoutSeconds: number;
  credentialId: string | null;
  registeredAt?: string | null;
}

const DEFAULT_SETTINGS: BiometricSettings = {
  enabled: false,
  lockTimeoutSeconds: 15,
  credentialId: null,
  registeredAt: null,
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
 * Verifica se a plataforma e o navegador suportam autenticação biométrica via hardware local.
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const hasWebAuthn =
    Boolean(window.PublicKeyCredential) &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function";

  if (!hasWebAuthn) return false;

  try {
    const isAvailable =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return Boolean(isAvailable);
  } catch (err) {
    console.warn("[Biometrics] Falha ao verificar autenticador da plataforma:", err);
    return false;
  }
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
      lockTimeoutSeconds: typeof parsed.lockTimeoutSeconds === "number" ? parsed.lockTimeoutSeconds : 15,
      credentialId: parsed.credentialId || null,
      registeredAt: parsed.registeredAt || null,
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
    console.error("[Biometrics] Erro ao salvar configurações biométricas:", err);
  }
  return updated;
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

  const isAvailable = await isBiometricsAvailable();
  if (!isAvailable) {
    return {
      success: false,
      error: "Nenhum sensor biométrico (Face ID, Touch ID ou leitor de digital) disponível neste aparelho.",
    };
  }

  try {
    // Desafio de segurança aleatório de 32 bytes
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const userHandle = new TextEncoder().encode(userId);

    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: "Kitsune Finance",
        id: window.location.hostname,
      },
      user: {
        id: userHandle,
        name: email,
        displayName: email.split("@")[0] || "Investidor Kitsune",
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },   // ES256 (Padrão recomendado WebAuthn)
        { alg: -257, type: "public-key" }, // RS256 (Fallback Windows Hello / RSA)
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

    // Salva configuração local do usuário
    saveBiometricSettings(userId, {
      enabled: true,
      credentialId,
      registeredAt: new Date().toISOString(),
    });

    return { success: true, credentialId };
  } catch (err: any) {
    console.error("[Biometrics] Erro no registro biométrico:", err);
    if (err.name === "NotAllowedError") {
      return { success: false, error: "Registro biométrico cancelado ou recusado pelo usuário." };
    }
    if (err.name === "InvalidStateError") {
      return { success: false, error: "Esta chave biométrica já está registrada para este dispositivo." };
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

    const allowCredentials: PublicKeyCredentialDescriptor[] = [];
    if (credentialId) {
      try {
        allowCredentials.push({
          id: base64UrlToBuffer(credentialId),
          type: "public-key",
          transports: ["internal"],
        });
      } catch {
        // Se a conversão falhar, prossegue sem allowCredentials para autenticador residente
      }
    }

    const getOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      rpId: window.location.hostname,
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
