"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import GoogleIcon from "@/components/GoogleIcon";
import Spinner from "@/components/Spinner";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(true);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError("Preencha todos os campos.");
      return;
    }
    
    setIsLoadingEmail(true);
    setError(null);
    setSuccess(null);
    
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (error) {
        setError(error.message || "Erro ao criar conta. Tente novamente.");
        setIsLoadingEmail(false);
        return;
      }
      
      setSuccess("Conta criada com sucesso! Redirecionando...");
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro inesperado.");
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
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-[#FF8216] dark:text-zinc-400 dark:hover:text-[#FF8216] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Voltar ao início</span>
          </Link>

          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/assets/logo/logo_sem_fundo.png"
              alt="Logo Kitsune"
              width={32}
              height={32}
              priority
              className="object-contain drop-shadow-[0_2px_8px_rgba(255,130,22,0.25)]"
            />
          </Link>
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-extrabold font-sans text-gray-900 dark:text-white mb-2 text-center tracking-tight">
          Crie sua Conta
        </h1>
        <p className="text-sm font-sans text-zinc-500 dark:text-zinc-400 text-center mb-8">
          Junte-se à Kitsune Finance e gerencie seu patrimônio com IA e Open Finance.
        </p>
        
        {error && (
          <div className="w-full bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 rounded-xl p-3.5 mb-6 text-xs font-medium text-center leading-relaxed">
            {error}
          </div>
        )}

        {success && (
          <div className="w-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 rounded-xl p-3.5 mb-6 text-xs font-medium text-center">
            {success}
          </div>
        )}

        {/* OPÇÃO PRIORITÁRIA PRINCIPAL: CADASTRAR COM GOOGLE */}
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
                <span>Cadastrar com Google</span>
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
            className="text-[11px] font-semibold text-zinc-400 hover:text-[#FF8216] dark:hover:text-[#FF8216] transition-colors cursor-pointer flex items-center gap-1 uppercase tracking-wider"
          >
            <span>{showEmailForm ? "Ocultar cadastro por e-mail" : "ou criar com e-mail manualmente"}</span>
            <span className="material-symbols-outlined text-xs">
              {showEmailForm ? "expand_less" : "expand_more"}
            </span>
          </button>
          <div className="flex-1 h-px bg-gray-200 dark:bg-[#27272A]"></div>
        </div>

        {/* Formulário Manual Email / Senha */}
        {showEmailForm && (
          <form onSubmit={handleEmailSignup} className="flex flex-col gap-3.5 w-full mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Nome Completo
              </label>
              <input 
                type="text" 
                placeholder="Seu nome" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoadingEmail}
                className="w-full h-11 bg-gray-50 dark:bg-[#18181B] border border-gray-200 dark:border-[#27272A] rounded-xl px-4 text-sm text-gray-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-[#FF8216] transition-colors"
                autoComplete="name"
              />
            </div>
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
                className="w-full h-11 bg-gray-50 dark:bg-[#18181B] border border-gray-200 dark:border-[#27272A] rounded-xl px-4 text-sm text-gray-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-[#FF8216] transition-colors"
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Senha
              </label>
              <input 
                type="password" 
                placeholder="Crie uma senha forte" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoadingEmail}
                className="w-full h-11 bg-gray-50 dark:bg-[#18181B] border border-gray-200 dark:border-[#27272A] rounded-xl px-4 text-sm text-gray-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-[#FF8216] transition-colors"
                autoComplete="new-password"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoadingEmail || isLoadingGoogle}
              className="w-full h-11 flex items-center justify-center gap-2 bg-[#FF8216] hover:bg-[#FFA047] active:bg-[#E66E08] text-black rounded-xl font-bold text-xs transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed mt-1 cursor-pointer"
            >
              {isLoadingEmail ? (
                <div className="flex items-center gap-2">
                  <Spinner size={16} className="text-black" />
                  <span>Criando conta...</span>
                </div>
              ) : (
                "Criar Conta Manualmente"
              )}
            </button>
          </form>
        )}
        
        <div className="mt-4 text-center">
          <Link href="/login" className="text-xs font-sans text-zinc-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            Já possui uma conta? <strong className="font-bold text-[#FF8216] hover:underline">Entre aqui</strong>
          </Link>
        </div>
      </div>
    </div>
  );
}
