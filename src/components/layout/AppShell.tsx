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
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };
  
  const settingsRefDesktop = useRef<HTMLDivElement>(null);
  const settingsRefMobile = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const isOutsideDesktop = settingsRefDesktop.current && !settingsRefDesktop.current.contains(event.target as Node);
      const isOutsideMobile = settingsRefMobile.current && !settingsRefMobile.current.contains(event.target as Node);
      
      if (isSettingsOpen) {
        if ((!settingsRefDesktop.current || isOutsideDesktop) && (!settingsRefMobile.current || isOutsideMobile)) {
          setIsSettingsOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSettingsOpen]);

  const navItems = [
    { path: "/dashboard", icon: "monitoring", label: "Dashboard" },
    { path: "/kitsune", icon: "auto_awesome", label: "Kitsune AI" },
    { path: "/agents", icon: "hub", label: "Agents" },
  ];

  const isPublicRoute = pathname === '/login' || pathname === '/signup';

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-full bg-[url('/assets/background.jpg')] bg-cover bg-center bg-fixed overflow-hidden">
      {/* Desktop Sidebar (Minimalist) */}
      <aside className="hidden md:flex flex-col w-20 border-r border-white/10 bg-[#0A0A0A]/70 backdrop-blur-2xl pt-6 pb-4 items-center justify-between">
        <div className="flex flex-col items-center gap-8 w-full">
          <Link href="/dashboard" className="flex items-center justify-center p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
            <Image src="/assets/logo/logo_sem_fundo.png" alt="Logo" width={32} height={32} className="object-contain" />
          </Link>

          <nav className="flex flex-col items-center gap-4 w-full px-2">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center justify-center w-full h-12 rounded-xl transition-all duration-300 ${
                    isActive ? "text-kitsune bg-kitsune/10" : "text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                  }`}
                  title={item.label}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                    {item.icon}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="flex flex-col items-center justify-center w-full gap-2 relative" ref={settingsRefDesktop}>
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/5"
          >
            <span className="material-symbols-outlined">settings</span>
          </button>
          
          {/* Desktop Settings Menu */}
          {isSettingsOpen && (
            <div className="absolute bottom-12 left-16 w-48 bg-white dark:bg-[#121212] border border-gray-200 dark:border-white/5 rounded-2xl shadow-xl p-4 flex flex-col gap-4 z-50 animate-in fade-in zoom-in duration-200">
              <h3 className="text-sm font-sans font-bold text-gray-900 dark:text-white mb-2">Configurações</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm font-sans text-gray-500 dark:text-white/70">Tema</span>
                <ThemeToggle />
              </div>
              <div className="h-px bg-gray-200 dark:bg-white/10 w-full my-1"></div>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 w-full p-2 -mx-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-sm font-sans font-medium"
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
                  logout
                </span>
                Sair / Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto pb-20 md:pb-0 relative bg-white/80 dark:bg-black/40">
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/5 bg-white/80 dark:bg-[#121212]/80 backdrop-blur-md sticky top-0 z-50">
          <Image src="/assets/logo/logo_sem_fundo.png" alt="Logo" width={24} height={24} className="object-contain" />
          <span className="font-sans font-semibold text-gray-900 dark:text-white/90">Kitsune Finance</span>
          <div className="flex items-center gap-2 relative">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
          </div>
        </div>
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full h-16 bg-[#0A0A0A]/70 backdrop-blur-2xl border-t border-white/10 flex items-center justify-around z-50 pb-safe">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors duration-200 ${
                isActive ? "text-kitsune" : "text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                {item.icon}
              </span>
              <span className="text-[10px] font-sans font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile Fullscreen Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-lg z-[100] flex flex-col animate-in fade-in duration-300">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/5">
            <div className="flex items-center gap-2">
              <Image src="/assets/logo/logo_sem_fundo.png" alt="Logo" width={24} height={24} className="object-contain" />
              <span className="font-sans font-semibold text-gray-900 dark:text-white">Navegação</span>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="flex flex-col p-6 gap-6">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-4 text-xl font-sans font-medium transition-colors duration-200 ${
                    isActive ? "text-kitsune" : "text-gray-500 dark:text-white/70 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
            
            <div className="h-px bg-gray-200 dark:bg-white/10 w-full my-2"></div>
            
            <div 
              className="flex items-center justify-between mt-2 cursor-pointer p-2 -mx-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <div className="flex items-center gap-4 text-xl font-sans font-medium text-gray-500 dark:text-white/70">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
                  dark_mode
                </span>
                Tema
              </div>
              <div className="pointer-events-none">
                <ThemeToggle />
              </div>
            </div>

            <Link
              href="/settings"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-4 text-xl font-sans font-medium text-gray-500 dark:text-white/70 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 mt-2 p-2 -mx-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
                settings
              </span>
              Configurações
            </Link>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleLogout();
              }}
              className="flex items-center gap-4 text-xl font-sans font-medium text-red-500 hover:text-red-600 transition-colors duration-200 mt-2 p-2 -mx-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
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
