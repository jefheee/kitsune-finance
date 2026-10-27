"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import GoogleIcon from "@/components/GoogleIcon";
export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingApple, setIsLoadingApple] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  const handleGoogleLogin = async () => {
    setIsLoadingGoogle(true);
    setError(null);
    try {
      await supabase.auth.signInWithOAuth({ 
        provider: 'google', 
        options: { 
          redirectTo: `${window.location.origin}/auth/callback` 
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
          redirectTo: `${window.location.origin}/auth/callback` 
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
      
      setSuccess("Conta criada! Redirecionando...");
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro inesperado.");
      setIsLoadingEmail(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen relative w-full overflow-x-hidden">
      <div className="w-full h-full min-h-screen md:min-h-fit md:max-w-[440px] bg-white dark:bg-[#121212] border border-gray-200 dark:border-white/5 md:rounded-3xl p-6 md:p-10 shadow-xl flex flex-col items-center justify-center relative z-10 md:my-8">
        
        
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

        {success && (
          <div className="w-full bg-green-50 text-green-600 border border-green-200 rounded-xl p-4 mb-6 text-sm font-medium text-center">
            {success}
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
            className="w-full h-14 flex items-center justify-center gap-3 bg-[#FF7A00] hover:bg-[#E56E00] text-white rounded-2xl font-sans font-bold transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed mt-2"
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
                <GoogleIcon />
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
                <svg viewBox="0 0 384 512" className="w-5 h-5 shrink-0 fill-current text-black dark:text-white" xmlns="http://www.w3.org/2000/svg">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
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
