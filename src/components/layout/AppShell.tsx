"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/utils/supabase/client";
import { useFinanceData } from "@/context/FinanceDataContext";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { userProfile, user, isPrivacyMode, togglePrivacyMode } = useFinanceData();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const settingsRefDesktop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isSettingsOpen &&
        settingsRefDesktop.current &&
        !settingsRefDesktop.current.contains(event.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSettingsOpen]);

  // Sidebar Desktop: Rotas operacionais dedicadas e organizadas
  const desktopNavItems = [
    { path: "/dashboard", icon: "dashboard", label: "Dashboard" },
    { path: "/kitsune", icon: "auto_awesome", label: "Kitsune AI" },
    { path: "/cards", icon: "wallet", label: "Cartões" },
    { path: "/investments", icon: "trending_up", label: "Investimentos" },
    { path: "/agents", icon: "smart_toy", label: "Agentes" },
    { path: "/connections", icon: "account_balance", label: "Bancos" },
  ];

  // Mobile Bottom Bar
  const mobileNavItems = [
    { path: "/dashboard", icon: "dashboard", label: "Início" },
    { path: "/kitsune", icon: "auto_awesome", label: "Kitsune AI" },
    { path: "/cards", icon: "wallet", label: "Cartões" },
    { path: "/investments", icon: "trending_up", label: "Investir" },
    { path: "/profile", icon: "person", label: "Perfil" },
  ];

  const isPublicRoute = pathname === "/login" || pathname === "/signup" || pathname === "/";

  if (isPublicRoute) {
    return <>{children}</>;
  }

  const userDisplayName =
    userProfile?.display_name ||
    userProfile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Investidor";

  const userInitials = userDisplayName.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-dvh w-full bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-[#F8FAFC] overflow-hidden font-sans">
      {/* Desktop Sidebar (>= 768px): Minimalista & Elegante */}
      <aside className="hidden md:flex flex-col w-20 border-r border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#101012] pt-6 pb-4 items-center justify-between relative z-40 shrink-0 select-none">
        <div className="flex flex-col items-center gap-7 w-full">
          {/* Logo Kitsune */}
          <Link
            href="/dashboard"
            className="flex items-center justify-center p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all group relative"
            title="Kitsune Finance • Início"
          >
            <Image
              src="/assets/logo/logo_sem_fundo.png"
              alt="Logo Kitsune"
              width={34}
              height={34}
              priority
              className="object-contain relative z-10 transition-transform group-hover:scale-105"
            />
          </Link>

          {/* Nav Items */}
          <nav className="flex flex-col items-center gap-2.5 w-full px-2.5">
            {desktopNavItems.map((item) => {
              const isActive = pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center justify-center w-full h-12 rounded-2xl transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "text-[#FF8216] bg-[#FF8216]/12 border border-[#FF8216]/25"
                      : "text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#161618]"
                  }`}
                  title={item.label}
                >
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={{
                      fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                    }}
                  >
                    {item.icon}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Privacy, Settings & Avatar do Usuário */}
        <div
          className="flex flex-col items-center justify-center w-full gap-3 relative"
          ref={settingsRefDesktop}
        >
          {/* Botão Modo Privacidade (Ocultar Valores Sensíveis) */}
          <button
            type="button"
            onClick={togglePrivacyMode}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
              isPrivacyMode
                ? "text-[#FF8216] bg-[#FF8216]/15 border border-[#FF8216]/30 shadow-xs"
                : "text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161618]"
            }`}
            title={
              isPrivacyMode
                ? "Modo Privacidade Ativo: Valores ocultos. Clique para exibir."
                : "Modo Privacidade Desativado: Clique para ocultar valores."
            }
          >
            <span className="material-symbols-outlined text-[20px]">
              {isPrivacyMode ? "visibility_off" : "visibility"}
            </span>
          </button>

          {/* Botão de Configurações */}
          <Link
            href="/settings"
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
              pathname === "/settings"
                ? "text-[#FF8216] bg-[#FF8216]/12 border border-[#FF8216]/25"
                : "text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#161618]"
            }`}
            title="Configurações & Preferências"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </Link>

          {/* Avatar com link para /profile */}
          <Link
            href="/profile"
            title={`Meu Perfil: ${userDisplayName}`}
            className={`w-10 h-10 rounded-xl overflow-hidden border transition-all cursor-pointer group flex items-center justify-center ${
              pathname === "/profile"
                ? "border-[#FF8216] ring-2 ring-[#FF8216]/30"
                : "border-slate-200 dark:border-[#27272A] hover:border-[#FF8216] bg-slate-100 dark:bg-[#18181B]"
            }`}
          >
            {userProfile?.avatar_url ? (
              <img
                src={userProfile.avatar_url}
                alt={userDisplayName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#FF8216]/20 to-[#FF8216]/5 text-[#FF8216] font-bold text-xs">
                {userInitials}
              </div>
            )}
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto pb-24 md:pb-0 relative bg-slate-50 dark:bg-[#0A0A0A] animate-page-enter">
        {/* Mobile Header Compacto (< 768px) */}
        <div className="md:hidden flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-[#27272A] bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur-md sticky top-0 z-40 pt-safe">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/assets/logo/logo_sem_fundo.png"
              alt="Logo"
              width={26}
              height={26}
              priority
              className="object-contain"
            />
            <span className="font-extrabold text-sm text-slate-900 dark:text-[#F8FAFC] tracking-tight">
              Kitsune
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Botão Modo Privacidade Mobile */}
            <button
              type="button"
              onClick={togglePrivacyMode}
              className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                isPrivacyMode
                  ? "text-[#FF8216] bg-[#FF8216]/15 border-[#FF8216]/30"
                  : "text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-[#161618]"
              }`}
              title={isPrivacyMode ? "Valores ocultos" : "Ocultar valores"}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isPrivacyMode ? "visibility_off" : "visibility"}
              </span>
            </button>

            <ThemeToggle />

            <Link
              href="/profile"
              className="w-8 h-8 rounded-xl overflow-hidden border border-slate-200 dark:border-[#27272A] bg-slate-100 dark:bg-[#18181B] flex items-center justify-center"
            >
              {userProfile?.avatar_url ? (
                <img
                  src={userProfile.avatar_url}
                  alt={userDisplayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[11px] font-bold text-[#FF8216]">
                  {userInitials}
                </span>
              )}
            </Link>

            <Link
              href="/settings"
              className="text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#161618] transition-colors"
              title="Configurações"
            >
              <span className="material-symbols-outlined text-[20px]">
                settings
              </span>
            </Link>
          </div>
        </div>

        {children}
      </main>

      {/* Mobile Floating Bottom Navigation (< 768px) */}
      <nav className="md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-sm h-14 bg-white/95 dark:bg-[#121214]/95 backdrop-blur-xl border border-slate-200 dark:border-[#27272A] rounded-2xl shadow-xl flex items-center justify-around px-2 z-50 pb-safe select-none">
        {mobileNavItems.map((item) => {
          const isActive = pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-[#FF8216]/12 text-[#FF8216] font-bold"
                  : "text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]"
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{
                  fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {item.icon}
              </span>
              <span className="text-[11px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
