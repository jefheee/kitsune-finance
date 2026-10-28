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
  const { userProfile, user } = useFinanceData();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
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

  const navItems = [
    { path: "/dashboard", icon: "dashboard", label: "Visão Geral" },
    { path: "/kitsune", icon: "auto_awesome", label: "Kitsune IA" },
    { path: "/agents", icon: "hub", label: "Conexões" },
    { path: "/profile", icon: "person", label: "Meu Perfil" },
  ];

  const isPublicRoute = pathname === "/login" || pathname === "/signup";

  if (isPublicRoute) {
    return <>{children}</>;
  }

  const userDisplayName =
    userProfile?.display_name ||
    userProfile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Usuário";

  return (
    <div className="flex h-dvh w-full bg-[#0F141C] text-[#F8FAFC] overflow-hidden">
      {/* Desktop Sidebar (>= 768px): Warm Obsidian Intelligence */}
      <aside className="hidden md:flex flex-col w-20 border-r border-[#263042] bg-[#090E16] pt-6 pb-4 items-center justify-between relative z-40 shrink-0">
        <div className="flex flex-col items-center gap-7 w-full">
          {/* Logo Kitsune */}
          <Link
            href="/dashboard"
            className="flex items-center justify-center p-2 rounded-2xl hover:bg-white/5 transition-all group relative"
            title="Kitsune Finance • Início"
          >
            <div className="absolute inset-0 rounded-2xl bg-[#FF6B00]/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            <Image
              src="/assets/logo/logo_sem_fundo.png"
              alt="Logo Kitsune"
              width={34}
              height={34}
              className="object-contain relative z-10 transition-transform group-hover:scale-105"
            />
          </Link>

          {/* Nav Items */}
          <nav className="flex flex-col items-center gap-2.5 w-full px-2.5">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center justify-center w-full h-12 rounded-2xl transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "text-[#FF6B00] bg-[#FF6B00]/15 border border-[#FF6B00]/30 shadow-[0_0_16px_-2px_rgba(255,107,0,0.3)]"
                      : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#141A24]"
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

        {/* Bottom Section: Profile Avatar & Settings Popup */}
        <div
          className="flex flex-col items-center justify-center w-full gap-3 relative"
          ref={settingsRefDesktop}
        >
          {/* Avatar com link rápido para /profile */}
          <Link
            href="/profile"
            title={`Perfil de ${userDisplayName}`}
            className="w-10 h-10 rounded-xl overflow-hidden border border-[#263042] hover:border-[#FF6B00] bg-[#141A24] flex items-center justify-center transition-all cursor-pointer group"
          >
            {userProfile?.avatar_url ? (
              <img
                src={userProfile.avatar_url}
                alt={userDisplayName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <span className="material-symbols-outlined text-[20px] text-[#94A3B8] group-hover:text-[#FF6B00]">
                person
              </span>
            )}
          </Link>

          {/* Botão de Configurações */}
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="text-[#94A3B8] hover:text-[#F8FAFC] transition-colors w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#141A24] cursor-pointer"
            title="Preferências"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>

          {isSettingsOpen && (
            <div className="absolute bottom-12 left-16 w-56 bg-[#141A24]/95 border border-[#263042] rounded-2xl shadow-2xl backdrop-blur-xl p-3 flex flex-col gap-2.5 z-[60] animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1.5 border-b border-[#263042]/70 flex flex-col">
                <span className="text-xs font-bold text-[#F8FAFC] truncate">
                  {userDisplayName}
                </span>
                <span className="text-[11px] text-[#10B981] font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  Conta Verificada
                </span>
              </div>

              <Link
                href="/profile"
                onClick={() => setIsSettingsOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-[#F8FAFC] hover:bg-[#1C2331] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-[#FF6B00]">
                  account_circle
                </span>
                Editar Meu Perfil
              </Link>

              <div className="flex items-center justify-between px-2.5 py-1">
                <span className="text-xs text-[#94A3B8]">Tema Visual</span>
                <ThemeToggle />
              </div>

              <div className="h-px bg-[#263042] w-full my-0.5" />

              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-xs font-semibold cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  logout
                </span>
                Sair da Conta
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto pb-20 md:pb-0 relative bg-[#0F141C]">
        {/* Mobile Header Compacto */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[#263042] bg-[#0F141C]/90 backdrop-blur-md sticky top-0 z-40 pt-safe">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image
              src="/assets/logo/logo_sem_fundo.png"
              alt="Logo"
              width={26}
              height={26}
              className="object-contain"
            />
            <span className="font-bold text-sm text-[#F8FAFC] tracking-tight">
              Kitsune Finance
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              className="w-8 h-8 rounded-full overflow-hidden border border-[#263042] bg-[#141A24] flex items-center justify-center"
            >
              {userProfile?.avatar_url ? (
                <img
                  src={userProfile.avatar_url}
                  alt={userDisplayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="material-symbols-outlined text-[16px] text-[#94A3B8]">
                  person
                </span>
              )}
            </Link>

            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="text-[#94A3B8] hover:text-[#F8FAFC] p-1.5 rounded-xl hover:bg-[#141A24] transition-colors cursor-pointer"
              aria-label="Abrir menu"
            >
              <span className="material-symbols-outlined text-[22px]">
                more_vert
              </span>
            </button>
          </div>
        </div>

        {children}
      </main>

      {/* Mobile Floating Bottom Navigation (< 768px) */}
      <nav className="md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-sm h-14 bg-[#141A24]/95 backdrop-blur-xl border border-[#263042] rounded-2xl shadow-2xl flex items-center justify-around px-2 z-50 pb-safe">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-[#FF6B00]/15 text-[#FF6B00] font-bold"
                  : "text-[#94A3B8] hover:text-[#F8FAFC]"
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

      {/* Mobile Settings Sheet */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-[#141A24] border-t border-[#263042] rounded-t-3xl p-6 flex flex-col gap-4 pb-safe">
            <div className="flex items-center justify-between border-b border-[#263042] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#263042] bg-[#0F141C] flex items-center justify-center">
                  {userProfile?.avatar_url ? (
                    <img
                      src={userProfile.avatar_url}
                      alt={userDisplayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-xl text-[#94A3B8]">
                      person
                    </span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-[#F8FAFC]">
                    {userDisplayName}
                  </span>
                  <span className="text-xs text-[#10B981] font-medium">
                    Conta Verificada
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-[#94A3B8] hover:text-[#F8FAFC] p-1.5"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <Link
              href="/profile"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#0F141C] border border-[#263042] text-sm font-semibold text-[#F8FAFC]"
            >
              <span className="material-symbols-outlined text-[20px] text-[#FF6B00]">
                account_circle
              </span>
              Gerenciar Perfil & Renda
            </Link>

            <div
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0F141C] border border-[#263042] cursor-pointer"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <div className="flex items-center gap-3 text-sm font-medium text-[#F8FAFC]">
                <span className="material-symbols-outlined text-[20px] text-[#FF6B00]">
                  dark_mode
                </span>
                Alternar Tema
              </div>
              <div className="pointer-events-none">
                <ThemeToggle />
              </div>
            </div>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleLogout();
              }}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold mt-1"
            >
              <span className="material-symbols-outlined text-[18px]">
                logout
              </span>
              Sair da Conta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
