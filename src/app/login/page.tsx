"use client";

import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({ 
      provider: 'google', 
      options: { 
        redirectTo: `${window.location.origin}/auth/callback` 
      } 
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-[#0A0A0A] p-4 relative overflow-hidden">
      {/* Background glow for aesthetic */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-kitsune/5 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="w-full max-w-md bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-8 shadow-sm flex flex-col items-center relative z-10">
        <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-gray-100 dark:border-white/5">
          <Image src="/assets/logo/logo_sem_fundo.png" alt="Logo" width={40} height={40} className="object-contain" />
        </div>
        
        <h1 className="text-2xl font-bold font-sans text-gray-900 dark:text-white mb-2 text-center tracking-tight">
          Bem-vindo
        </h1>
        <p className="text-sm font-sans text-gray-500 dark:text-white/50 text-center mb-8">
          Acesse sua conta para visualizar seu patrimônio e interagir com a inteligência artificial.
        </p>
        
        <div className="flex flex-col gap-4 w-full">
          {/* Google Button */}
          <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-3xl p-4 text-gray-900 dark:text-white font-sans font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-sm">
            <span className="font-bold text-lg leading-none" style={{ background: 'linear-gradient(45deg, #4285F4, #34A853, #FBBC05, #EA4335)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>G</span>
            Continuar com Google
          </button>
          
          {/* Apple Button */}
          <button className="w-full flex items-center justify-center gap-3 bg-gray-900 dark:bg-white border border-transparent rounded-3xl p-4 text-white dark:text-gray-900 font-sans font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-sm">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>apple</span>
            Continuar com Apple
          </button>
        </div>
        
        <div className="mt-8 text-center">
          <Link href="/dashboard" className="text-sm font-sans text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white transition-colors">
            Voltar para o Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
