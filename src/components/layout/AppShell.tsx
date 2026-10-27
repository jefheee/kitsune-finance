"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/utils/supabase/client";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
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
    { path: "/dashboard", icon: "monitoring", label: "Dashboard" },
    { path: "/kitsune", icon: "auto_awesome", label: "Kitsune AI" },
    { path: "/agents", icon: "hub", label: "Conexões" },
  ];

  const isPublicRoute = pathname === "/login" || pathname === "/signup";

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-dvh w-full bg-[#09090b] overflow-hidden">
      {/* Desktop Sidebar (>= 768px): Escura e retraída */}
      <aside className="hidden md:flex flex-col w-20 border-r border-zinc-800/80 bg-[#0c0c0e] pt-6 pb-4 items-center justify-between relative z-40 shrink-0">
        <div className="flex flex-col items-center gap-8 w-full">
          <Link
            href="/dashboard"
            className="flex items-center justify-center p-2 rounded-full hover:bg-white/5 transition-colors"
          >
            <Image
              src="/assets/logo/logo_sem_fundo.png"
              alt="Logo"
              width={32}
              height={32}
              className="object-contain"
            />
          </Link>

          <nav className="flex flex-col items-center gap-3 w-full px-2.5">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center justify-center w-full h-12 rounded-2xl transition-all duration-200 ${
                    isActive
                      ? "text-kitsune bg-kitsune/12 border border-kitsune/25 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/50"
                  }`}
                  title={item.label}
                >
                  <span
                    className="material-symbols-outlined"
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

        <div
          className="flex flex-col items-center justify-center w-full gap-2 relative"
          ref={settingsRefDesktop}
        >
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="text-zinc-500 hover:text-zinc-100 transition-colors duration-200 w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800/60 cursor-pointer"
          >
            <span className="material-symbols-outlined">settings</span>
          </button>

          {isSettingsOpen && (
            <div className="absolute bottom-12 left-16 w-52 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-xl p-4 flex flex-col gap-3 z-[60] animate-in fade-in zoom-in-95 duration-150">
              <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-zinc-400">
                Preferências
              </h3>
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans text-zinc-300">Tema</span>
                <ThemeToggle />
              </div>
              <div className="h-px bg-zinc-800 w-full my-0.5" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full p-2 -mx-1 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-xs font-sans font-semibold cursor-pointer"
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
      <main className="flex-1 flex flex-col h-full overflow-y-auto pb-20 md:pb-0 relative bg-[#09090b]">
        {/* Mobile Header Compacto */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-[#09090b]/90 backdrop-blur-md sticky top-0 z-40 pt-safe">
          <div className="flex items-center gap-2.5">
            <Image
              src="/assets/logo/logo_sem_fundo.png"
              alt="Logo"
              width={24}
              height={24}
              className="object-contain"
            />
            <span className="font-sans font-bold text-sm text-zinc-100 tracking-tight">
              Kitsune Finance
            </span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-zinc-400 hover:text-white transition-colors p-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">
              more_vert
            </span>
          </button>
        </div>
        {children}
      </main>

      {/* Mobile Floating Bottom Navigation (< 768px) */}
      <nav className="md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm h-14 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl flex items-center justify-around px-2 z-50 pb-safe">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-amber-500/15 text-amber-400 font-semibold"
                  : "text-zinc-400 hover:text-zinc-100"
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
              <span className="text-xs font-sans">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile Settings Sheet */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-6 flex flex-col gap-5 pb-safe">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image
                  src="/assets/logo/logo_sem_fundo.png"
                  alt="Logo"
                  width={22}
                  height={22}
                  className="object-contain"
                />
                <span className="font-sans font-bold text-sm text-white">
                  Menu & Conta
                </span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div
              className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 cursor-pointer"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <div className="flex items-center gap-3 text-sm font-sans font-medium text-zinc-200">
                <span className="material-symbols-outlined text-[20px] text-amber-400">
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
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-sans font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">
                logout
              </span>
              Sair / Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
