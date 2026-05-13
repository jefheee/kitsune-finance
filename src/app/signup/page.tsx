"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { getURL } from "@/utils/url";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingApple, setIsLoadingApple] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleGoogleLogin = async () => {
    setIsLoadingGoogle(true);
    setError(null);
    try {
      await supabase.auth.signInWithOAuth({ 
        provider: 'google', 
        options: { 
          redirectTo: `${getURL()}/auth/callback` 
        } 
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com Google');
      setIsLoadingGoogle(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoadingApple(true);
    setError(null);
    try {
      await supabase.auth.signInWithOAuth({ 
        provider: 'apple', 
        options: { 
          redirectTo: `${getURL()}/auth/callback` 
        } 
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com Apple');
      setIsLoadingApple(false);
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
      
      // Navigate to dashboard or prompt to check email if confirm email is enabled
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro inesperado.");
      setIsLoadingEmail(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-[#0A0A0A] md:bg-gray-50 md:dark:bg-[#0A0A0A] md:p-6 relative overflow-hidden">
      {/* Background glow for aesthetic */}
      <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-kitsune/5 rounded-full blur-[100px] pointer-events-none"></div>
      
      <div className="w-full h-full min-h-screen md:min-h-fit md:max-w-[440px] bg-white dark:bg-[#0A0A0A] md:dark:bg-[#121212] md:border border-gray-200 dark:border-white/5 md:rounded-3xl p-6 md:p-10 md:shadow-sm flex flex-col items-center justify-center relative z-10 md:my-8">
        
        <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-3xl flex items-center justify-center mb-8 shadow-sm border border-gray-100 dark:border-white/5 shrink-0">
          <Image src="/assets/logo/logo_sem_fundo.png" alt="Logo" width={48} height={48} className="object-contain" />
        </div>
        
        <h1 className="text-3xl font-bold font-sans text-gray-900 dark:text-white mb-3 text-center tracking-tight">
          Crie sua Conta
        </h1>
        <p className="text-base font-sans text-gray-500 dark:text-white/50 text-center mb-10">
          Junte-se a nós e gerencie seu patrimônio com a Kitsune AI.
        </p>
        
        {error && (
          <div className="w-full bg-red-50 text-red-600 border border-red-200 rounded-xl p-4 mb-6 text-sm font-medium text-center">
            {error}
          </div>
        )}

        {/* Formulário Email / Senha */}
        <form onSubmit={handleEmailSignup} className="flex flex-col gap-5 w-full mb-8">
          <div className="flex flex-col gap-2">
            <input 
              type="text" 
              placeholder="Nome Completo" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoadingEmail}
              className="w-full h-14 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-2xl px-5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:border-kitsune/50 transition-colors"
            />
          </div>
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
              placeholder="Crie uma senha" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoadingEmail}
              className="w-full h-14 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-2xl px-5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:border-kitsune/50 transition-colors"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoadingEmail || isLoadingGoogle || isLoadingApple}
            className="w-full h-14 flex items-center justify-center gap-3 bg-kitsune text-white rounded-2xl font-sans font-bold hover:bg-kitsune/90 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          >
            {isLoadingEmail ? (
              <span className="material-symbols-outlined animate-spin text-[20px]">refresh</span>
            ) : (
              "Criar Conta"
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
                <span className="material-symbols-outlined animate-spin text-[20px]">refresh</span>
                Conectando...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.67 15.63 16.86 16.8 15.65 17.61V20.34H19.22C21.31 18.42 22.56 15.6 22.56 12.25Z" fill="#4285F4"/>
                  <path d="M12 23C14.97 23 17.46 22.02 19.22 20.34L15.65 17.61C14.7 18.25 13.44 18.63 12 18.63C9.23 18.63 6.88 16.76 6.04 14.25H2.36V17.1C4.14 20.63 7.78 23 12 23Z" fill="#34A853"/>
                  <path d="M6.04 14.25C5.83 13.62 5.71 12.82 5.71 12C5.71 11.18 5.83 10.38 6.04 9.75V6.9H2.36C1.62 8.38 1.2 10.14 1.2 12C1.2 13.86 1.62 15.62 2.36 17.1L6.04 14.25Z" fill="#FBBC05"/>
                  <path d="M12 5.38C13.62 5.38 15.06 5.94 16.2 7.03L19.3 3.93C17.45 2.21 14.97 1.2 12 1.2C7.78 1.2 4.14 3.57 2.36 6.9L6.04 9.75C6.88 7.24 9.23 5.38 12 5.38Z" fill="#EA4335"/>
                </svg>
                Cadastrar com Google
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
                <span className="material-symbols-outlined animate-spin text-[20px]">refresh</span>
                Conectando...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 fill-current text-black dark:text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16.48 10.74C16.44 8.79 18.06 7.82 18.13 7.78C17.22 6.45 15.79 6.24 15.28 6.22C14.07 6.1 12.89 6.94 12.26 6.94C11.64 6.94 10.66 6.24 9.64 6.26C8.36 6.28 7.16 6.96 6.5 8.1C5.16 10.42 6.16 13.84 7.46 15.72C8.1 16.63 8.84 17.65 9.8 17.62C10.74 17.58 11.1 17.01 12.24 17.01C13.38 17.01 13.7 17.62 14.68 17.6C15.68 17.58 16.32 16.65 16.94 15.74C17.68 14.66 17.98 13.62 18 13.56C17.98 13.55 16.52 13 16.48 10.74ZM14.16 4.36C14.68 3.73 15.02 2.86 14.92 2C14.18 2.03 13.26 2.5 12.72 3.12C12.24 3.66 11.84 4.56 11.96 5.4C12.78 5.46 13.64 4.98 14.16 4.36Z" />
                </svg>
                Cadastrar com Apple
              </>
            )}
          </button>
        </div>
        
        <div className="mt-10 text-center">
          <Link href="/login" className="text-sm font-sans font-medium text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors">
            Já tem uma conta? <strong className="font-bold">Entrar</strong>
          </Link>
        </div>
      </div>
    </div>
  );
}
