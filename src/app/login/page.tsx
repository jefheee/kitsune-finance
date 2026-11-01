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
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  
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
      
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro no login.");
      setIsLoadingEmail(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen relative w-full overflow-x-hidden p-4 bg-[#FAFAFA] dark:bg-[#0A0A0A]">
      <div className="w-full h-full min-h-screen md:min-h-fit md:max-w-[440px] bg-white dark:bg-[#121214] border border-gray-200 dark:border-[#27272A] md:rounded-3xl p-6 md:p-10 shadow-xl flex flex-col items-center justify-center relative z-10 md:my-8">
        {/* Link de Retorno à Landing Page */}
        <div className="w-full flex items-center justify-between mb-8">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-white dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Voltar ao início</span>
          </Link>

          <Link href="/" className="flex items-center">
            <Image
              src="/assets/logo/logo-horizontal-transparent.png"
              alt="Kitsune Finance"
              width={112}
              height={28}
              priority
              className="object-contain"
            />
          </Link>
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-extrabold font-sans text-gray-900 dark:text-white mb-2 text-center tracking-tight">
          Acesse sua Conta
        </h1>
        <p className="text-sm font-sans text-zinc-500 dark:text-zinc-400 text-center mb-8">
          Gerencie seu patrimônio e acompanhe seus investimentos no padrão Kitsune.
        </p>
        
        {error && (
          <div className="w-full bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 rounded-xl p-3.5 mb-6 text-xs font-medium text-center leading-relaxed">
            {error}
          </div>
        )}

        {/* OPÇÃO PRIORITÁRIA PRINCIPAL: CONTINUAR COM GOOGLE */}
        <div className="w-full space-y-4">
          <button 
            type="button"
            onClick={handleGoogleLogin} 
            disabled={isLoadingEmail || isLoadingGoogle}
            className="w-full h-13 px-4 flex items-center justify-center gap-3 bg-white dark:bg-[#18181B] hover:bg-gray-50 dark:hover:bg-[#27272A] active:scale-[0.99] border border-gray-300 dark:border-[#27272A] rounded-2xl text-gray-900 dark:text-white text-sm font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
          >
            {isLoadingGoogle ? (
              <>
                <Spinner size={18} className="text-gray-900 dark:text-white" />
                <span>Conectando com Google...</span>
              </>
            ) : (
              <>
                <GoogleIcon className="w-5 h-5 transition-transform group-hover:scale-105" />
                <span>Continuar com Google</span>
              </>
            )}
          </button>
        </div>

        {/* DIVISOR DE OPÇÃO SECUNDÁRIA MANUAL */}
        <div className="w-full flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-200 dark:bg-[#27272A]"></div>
          <button
            type="button"
            onClick={() => setShowEmailForm((prev) => !prev)}
            className="text-[11px] font-semibold text-zinc-400 hover:text-white dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1 uppercase tracking-wider"
          >
            <span>{showEmailForm ? "Ocultar e-mail" : "ou entrar com e-mail e senha"}</span>
            <span className="material-symbols-outlined text-xs">
              {showEmailForm ? "expand_less" : "expand_more"}
            </span>
          </button>
          <div className="flex-1 h-px bg-gray-200 dark:bg-[#27272A]"></div>
        </div>

        {/* FORMULÁRIO SECUNDÁRIO EMAIL / SENHA */}
        {showEmailForm && (
          <form onSubmit={handleEmailLogin} className="flex flex-col gap-3.5 w-full mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                E-mail
              </label>
              <input 
                type="email" 
                placeholder="seu@email.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoadingEmail}
                className="w-full h-11 bg-gray-50 dark:bg-[#18181B] border border-gray-200 dark:border-[#27272A] rounded-xl px-4 text-sm text-gray-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-white transition-colors"
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Senha
              </label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoadingEmail}
                className="w-full h-11 bg-gray-50 dark:bg-[#18181B] border border-gray-200 dark:border-[#27272A] rounded-xl px-4 text-sm text-gray-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-white transition-colors"
                autoComplete="current-password"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoadingEmail || isLoadingGoogle}
              className="w-full h-11 flex items-center justify-center gap-2 bg-white hover:bg-zinc-200 active:bg-zinc-300 text-black rounded-xl font-bold text-xs transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed mt-1 cursor-pointer"
            >
              {isLoadingEmail ? (
                <div className="flex items-center gap-2">
                  <Spinner size={16} className="text-black" />
                  <span>Entrando...</span>
                </div>
              ) : (
                "Entrar com E-mail"
              )}
            </button>
          </form>
        )}
        
        {/* LINK PARA CRIAR CONTA MANUAL */}
        <div className="mt-4 text-center">
          <Link href="/signup" className="text-xs font-sans text-zinc-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            Não tem uma conta? <strong className="font-bold text-white hover:underline">Cadastre-se manualmente</strong>
          </Link>
        </div>
      </div>
    </div>
  );
}
