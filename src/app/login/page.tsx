"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import GoogleIcon from "@/components/GoogleIcon";
import Spinner from "@/components/Spinner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingApple, setIsLoadingApple] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const desc = params.get("error_description");
      const err = params.get("error");
      if (desc) {
        if (desc.includes("Unable to exchange external code")) {
          setError("Erro na troca de código com o Google: a chave secreta (Client Secret) do Google OAuth precisa ser atualizada no Supabase.");
        } else {
          setError(decodeURIComponent(desc.replace(/\+/g, " ")));
        }
      } else if (err === "true" || (err && err !== "server_error")) {
        setError("Não foi possível autenticar. Tente novamente.");
      }
    }
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoadingGoogle(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider: 'google', 
        options: { 
          redirectTo: `${window.location.origin}/auth/callback` 
        } 
      });
      if (error) {
        setError(error.message || 'Erro ao conectar com Google');
        setIsLoadingGoogle(false);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com Google');
      setIsLoadingGoogle(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoadingApple(true);
    setError(null);
    try {
      // Verificar se o provedor Apple está ativo antes de tentar redirecionar
      const check = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/authorize?provider=apple`,
        { method: "GET" }
      ).catch(() => null);

      if (check && check.status >= 400) {
        const data = await check.json().catch(() => ({}));
        if (data?.msg?.includes("provider is not enabled") || data?.error_code === "validation_failed") {
          setError("O login com Apple ainda não está configurado no painel do Supabase. Utilize o Google ou e-mail/senha.");
          setIsLoadingApple(false);
          return;
        }
      }

      const { error } = await supabase.auth.signInWithOAuth({ 
        provider: 'apple', 
        options: { 
          redirectTo: `${window.location.origin}/auth/callback` 
        } 
      });
      if (error) {
        setError(error.message || 'Erro ao conectar com Apple');
        setIsLoadingApple(false);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com Apple');
      setIsLoadingApple(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Preencha todos os campos.");
      return;
    }
    
    setIsLoadingEmail(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError("Credenciais inválidas. Tente novamente.");
        setIsLoadingEmail(false);
        return;
      }
      
      // The middleware or an auth listener should redirect the user.
      // Alternatively, we can force a redirect here:
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro no login.");
      setIsLoadingEmail(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen relative w-full overflow-x-hidden p-4">
      <div className="w-full h-full min-h-screen md:min-h-fit md:max-w-[440px] bg-white dark:bg-[#121212] border border-gray-200 dark:border-white/5 md:rounded-3xl p-6 md:p-10 shadow-xl flex flex-col items-center justify-center relative z-10 md:my-8">
        {/* Link de Retorno à Landing Page */}
        <div className="w-full flex items-center justify-between mb-8">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#FF8216] dark:text-slate-400 dark:hover:text-[#FF8216] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Voltar ao início</span>
          </Link>

          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/assets/logo/logo_sem_fundo.png"
              alt="Logo Kitsune"
              width={28}
              height={28}
              priority
              className="object-contain"
            />
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold font-sans text-gray-900 dark:text-white mb-3 text-center tracking-tight">
          Acesse sua Conta
        </h1>
        <p className="text-base font-sans text-gray-500 dark:text-white/50 text-center mb-10">
          Gerencie seu patrimônio e interaja com a inteligência artificial Kitsune.
        </p>
        
        {error && (
          <div className="w-full bg-red-50 text-red-600 border border-red-200 rounded-xl p-4 mb-6 text-sm font-medium text-center">
            {error}
          </div>
        )}

        {/* Formulário Email / Senha */}
        <form onSubmit={handleEmailLogin} className="flex flex-col gap-5 w-full mb-8">
          <div className="flex flex-col gap-2">
            <input 
              type="email" 
              placeholder="Seu e-mail" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoadingEmail}
              className="w-full h-14 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-2xl px-5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:border-kitsune/50 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-2">
            <input 
              type="password" 
              placeholder="Sua senha" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoadingEmail}
              className="w-full h-14 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-2xl px-5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:border-kitsune/50 transition-colors"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoadingEmail || isLoadingGoogle || isLoadingApple}
            className="w-full h-14 flex items-center justify-center gap-3 bg-[#FF8216] hover:bg-[#FFA047] active:bg-[#E66E08] text-white rounded-2xl font-sans font-bold transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          >
            {isLoadingEmail ? (
              <div className="flex items-center gap-2">
                <Spinner size={20} className="text-white" />
                <span>Entrando...</span>
              </div>
            ) : (
              "Entrar com E-mail"
            )}
          </button>
        </form>

        <div className="w-full flex items-center gap-4 mb-8 opacity-60">
          <div className="flex-1 h-px bg-gray-300 dark:bg-white/20"></div>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-widest">ou</span>
          <div className="flex-1 h-px bg-gray-300 dark:bg-white/20"></div>
        </div>
        
        <div className="flex flex-col gap-4 w-full">
          {/* Google Button */}
          <button 
            onClick={handleGoogleLogin} 
            disabled={isLoadingEmail || isLoadingGoogle || isLoadingApple}
            className="w-full h-14 flex items-center justify-center gap-3 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-2xl text-gray-900 dark:text-white text-sm font-sans font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoadingGoogle ? (
              <>
                <Spinner size={20} className="text-gray-900 dark:text-white" />
                <span>Conectando com Google...</span>
              </>
            ) : (
              <>
                <GoogleIcon />
                <span>Continuar com Google</span>
              </>
            )}
          </button>
          
          {/* Apple Button */}
          <button 
            onClick={handleAppleLogin}
            disabled={isLoadingEmail || isLoadingGoogle || isLoadingApple}
            className="w-full h-14 flex items-center justify-center gap-3 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-2xl text-gray-900 dark:text-white text-sm font-sans font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoadingApple ? (
              <>
                <Spinner size={20} className="text-gray-900 dark:text-white" />
                <span>Conectando com Apple...</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 384 512" className="w-5 h-5 shrink-0 fill-current text-black dark:text-white" xmlns="http://www.w3.org/2000/svg">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                </svg>
                <span>Continuar com Apple</span>
              </>
            )}
          </button>
        </div>
        
        <div className="mt-10 text-center">
          <Link href="/signup" className="text-sm font-sans font-medium text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors">
            Não tem uma conta? <strong className="font-bold">Cadastre-se</strong>
          </Link>
        </div>
      </div>
    </div>
  );
}
