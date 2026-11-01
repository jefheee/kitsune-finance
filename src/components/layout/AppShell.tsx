"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { useFinanceData } from "@/context/FinanceDataContext";
import { NotificationsModal } from "@/components/NotificationsModal";
import { GlobalFinanceSearchModal } from "@/components/finance/GlobalFinanceSearchModal";
import PluggyConnectModal from "@/components/PluggyConnectModal";
import { AssetModal } from "@/components/assets/AssetModal";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";

const SIDEBAR_STORAGE_KEY = "kitsune_wf_sidebar_collapsed";

function triggerHaptic(ms = 10) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(ms);
    } catch {
      // ignore unsupported devices
    }
  }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    userProfile,
    user,
    transactions,
    familyMembers,
    addFamilyMemberLocal,
    isPrivacyMode,
    togglePrivacyMode,
    formatSensitiveCurrency,
    isRevalidating,
    revalidate,
  } = useFinanceData();

  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  const [isPluggyModalOpen, setIsPluggyModalOpen] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);

  // Rastreamento de gestos de touch para arrastar e fechar (swipe down to dismiss)
  const touchStartY = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent, closeFn: () => void) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 35) {
      triggerHaptic(12);
      closeFn();
    }
  };

  // Restore sidebar state from localStorage
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {
      // ignore storage restrictions
    }
    setHydrated(true);
  }, []);

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Global Ctrl+K / Cmd+K launcher (Wealthfolio AppLauncher behavior)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close mobile drawers on route change
  useEffect(() => {
    setIsQuickActionsOpen(false);
    setIsMoreSheetOpen(false);
  }, [pathname]);

  const fetchUnreadNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setUnreadNotifsCount(data.unreadCount || 0);
      }
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    const isPublic = pathname === "/login" || pathname === "/signup" || pathname === "/";
    if (isPublic) return;
    fetchUnreadNotifs();
    const interval = setInterval(fetchUnreadNotifs, 20000);
    return () => clearInterval(interval);
  }, [fetchUnreadNotifs, pathname]);

  const handleOpenNotifications = useCallback(async () => {
    triggerHaptic(8);
    setIsNotificationsOpen(true);
    setUnreadNotifsCount(0);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // silent fail
    }
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const formatDatePtBr = useCallback((dateString?: string) => {
    if (!dateString) return "-";
    const clean = dateString.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateString;
  }, []);

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

  // Wealthfolio Desktop Navigation Links (Primary + Secondary)
  const primaryNavItems = [
    {
      path: "/dashboard",
      matchPaths: ["/dashboard"],
      label: "Visão Geral",
      Icon: WfIcons.Overview,
    },
    {
      path: "/investments",
      matchPaths: ["/investments", "/holdings"],
      label: "Holdings & Contas",
      Icon: WfIcons.Holdings,
    },
    {
      path: "/insights",
      matchPaths: ["/insights"],
      label: "Insights & Alocação",
      Icon: WfIcons.Insights,
    },
    {
      path: "/transactions",
      matchPaths: ["/transactions"],
      label: "Transações",
      Icon: WfIcons.Transactions,
    },
    {
      path: "/goals",
      matchPaths: ["/goals"],
      label: "Metas",
      Icon: WfIcons.Goals,
    },
    {
      path: "/kitsune",
      matchPaths: ["/kitsune", "/agents"],
      label: "Agentes IA",
      Icon: WfIcons.Agents,
    },
  ];

  const secondaryNavItems = [
    {
      path: "/cards",
      matchPaths: ["/cards"],
      label: "Cartões & Passivos",
      Icon: WfIcons.Cards,
    },
    {
      path: "/connections",
      matchPaths: ["/connections"],
      label: "Open Finance",
      Icon: WfIcons.Connections,
    },
    {
      path: "/shared",
      matchPaths: ["/shared"],
      label: "Compartilhado",
      Icon: WfIcons.Shared,
    },
  ];

  const isItemActive = (matchPaths: string[]) =>
    matchPaths.some((mp) => pathname === mp || pathname.startsWith(`${mp}/`));

  const currentPageLabel = (() => {
    const all = [
      ...primaryNavItems,
      ...secondaryNavItems,
      { matchPaths: ["/settings"], label: "Configurações" },
      { matchPaths: ["/profile"], label: "Meu Perfil" },
    ];
    const match = all.find((item) => isItemActive(item.matchPaths));
    return match?.label || "Kitsune";
  })();

  const isSidebarCollapsed = hydrated ? collapsed : false;

  return (
    <div className="flex min-h-screen w-full bg-[#FAFAFA] dark:bg-[#0A0A0A] text-zinc-900 dark:text-[#F4F4F5] font-sans">
      {/* =====================================================================
          DESKTOP SIDEBAR (>= 768px) — Fiel ao Wealthfolio AppSidebar
         ===================================================================== */}
      <aside
        className={`hidden md:flex flex-col sticky top-0 h-screen shrink-0 z-40 select-none border-r border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0A] transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isSidebarCollapsed ? "w-[68px]" : "w-[228px]"
        }`}
      >
        {/* Top Brand + Ctrl+K Search Launcher */}
        <div className="flex flex-col gap-2.5 px-3 pt-4 pb-2">
          <div
            className={`flex items-center ${
              isSidebarCollapsed ? "justify-center" : "justify-between px-1"
            }`}
          >
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 min-w-0 group"
              title="Kitsune Finance • Wealth OS"
            >
              <div className="w-8 h-8 rounded-xl bg-[#121214] border border-[#27272A] flex items-center justify-center shrink-0 group-hover:border-[#FF8216]/50 transition-colors">
                <Image
                  src="/assets/logo/logo_sem_fundo.png"
                  alt="Kitsune"
                  width={22}
                  height={22}
                  priority
                  className="object-contain transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              {!isSidebarCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-[#F4F4F5] truncate leading-none">
                    Kitsune
                  </span>
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-500 tracking-wide mt-0.5 truncate">
                    Wealth OS
                  </span>
                </div>
              )}
            </Link>

            {!isSidebarCollapsed && (
              <button
                type="button"
                onClick={() => revalidate(true)}
                title="Sincronizar Open Finance"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-[#FF8216] hover:bg-zinc-100 dark:hover:bg-[#121214] transition-colors cursor-pointer"
              >
                <WfIcons.RefreshCw
                  size={14}
                  className={isRevalidating ? "animate-spin text-[#FF8216]" : ""}
                />
              </button>
            )}
          </div>

          {/* Search Launcher Pill (Ctrl+K) */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            title="Buscar no patrimônio e extrato (Ctrl+K)"
            className={`h-9 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-zinc-50 dark:bg-[#121214] hover:border-[#FF8216]/40 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5] transition-all cursor-pointer flex items-center ${
              isSidebarCollapsed ? "justify-center px-0" : "justify-between px-2.5"
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <WfIcons.Search size={15} className="shrink-0 text-zinc-400" />
              {!isSidebarCollapsed && (
                <span className="text-xs font-medium truncate">Buscar...</span>
              )}
            </span>
            {!isSidebarCollapsed && (
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-[#18181B] text-zinc-500 dark:text-zinc-400 border border-zinc-300/50 dark:border-[#27272A]">
                ⌘K
              </kbd>
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2 space-y-4 scrollbar-none">
          {/* Primary Wealthfolio Section */}
          <nav className="flex flex-col gap-0.5" aria-label="Navegação Principal">
            {primaryNavItems.map(({ path, matchPaths, label, Icon }) => {
              const active = isItemActive(matchPaths);
              return (
                <Link
                  key={path}
                  href={path}
                  title={isSidebarCollapsed ? label : undefined}
                  className={`group relative flex items-center h-9 rounded-lg transition-colors duration-150 ${
                    isSidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
                  } ${
                    active
                      ? "bg-zinc-100 dark:bg-[#18181B] text-zinc-900 dark:text-[#F4F4F5] font-semibold"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5] hover:bg-zinc-100/70 dark:hover:bg-[#121214]"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-r-full bg-[#FF8216]" />
                  )}
                  <Icon
                    size={18}
                    className={`shrink-0 transition-colors ${
                      active ? "text-[#FF8216]" : "text-current group-hover:text-zinc-900 dark:group-hover:text-[#F4F4F5]"
                    }`}
                  />
                  {!isSidebarCollapsed && (
                    <span className="text-[13px] truncate">{label}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Secondary Kitsune Ecosystem Section */}
          <div className="pt-2 border-t border-zinc-200/80 dark:border-[#27272A]/70">
            {!isSidebarCollapsed && (
              <span className="px-2.5 pb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                Ecossistema
              </span>
            )}
            <nav className="flex flex-col gap-0.5" aria-label="Ecossistema Open Finance">
              {secondaryNavItems.map(({ path, matchPaths, label, Icon }) => {
                const active = isItemActive(matchPaths);
                return (
                  <Link
                    key={path}
                    href={path}
                    title={isSidebarCollapsed ? label : undefined}
                    className={`group relative flex items-center h-9 rounded-lg transition-colors duration-150 ${
                      isSidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
                    } ${
                      active
                        ? "bg-zinc-100 dark:bg-[#18181B] text-zinc-900 dark:text-[#F4F4F5] font-semibold"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5] hover:bg-zinc-100/70 dark:hover:bg-[#121214]"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-r-full bg-[#FF8216]" />
                    )}
                    <Icon
                      size={18}
                      className={`shrink-0 transition-colors ${
                        active ? "text-[#FF8216]" : "text-current"
                      }`}
                    />
                    {!isSidebarCollapsed && (
                      <span className="text-[13px] truncate">{label}</span>
                    )}
                  </Link>
                );
              })}

              {/* 7 Specialist AI Agents Direct Shortcut */}
              <Link
                href="/agents"
                title={isSidebarCollapsed ? "7 Agentes Especialistas" : undefined}
                className={`group relative flex items-center h-9 rounded-lg transition-colors duration-150 ${
                  isSidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
                } ${
                  pathname.startsWith("/agents")
                    ? "bg-zinc-100 dark:bg-[#18181B] text-zinc-900 dark:text-[#F4F4F5] font-semibold"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5] hover:bg-zinc-100/70 dark:hover:bg-[#121214]"
                }`}
              >
                <WfIcons.BotGrid
                  size={18}
                  className={`shrink-0 ${
                    pathname.startsWith("/agents") ? "text-[#FF8216]" : "text-current"
                  }`}
                />
                {!isSidebarCollapsed && (
                  <span className="text-[13px] truncate flex items-center justify-between flex-1">
                    <span>Squad IA</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/20">
                      7
                    </span>
                  </span>
                )}
              </Link>
            </nav>
          </div>
        </div>

        {/* Bottom Utility Rail (Privacy, Notifications, Settings, Collapse, User) */}
        <div className="px-2.5 pb-3 pt-2 border-t border-zinc-200 dark:border-[#27272A] flex flex-col gap-1">
          {/* Privacy Mode Toggle */}
          <button
            type="button"
            onClick={togglePrivacyMode}
            title={
              isPrivacyMode
                ? "Modo Privacidade Ativo (clique para exibir saldos)"
                : "Ocultar valores sensíveis"
            }
            className={`flex items-center h-9 rounded-lg transition-colors cursor-pointer ${
              isSidebarCollapsed ? "justify-center px-0" : "justify-between px-2.5"
            } ${
              isPrivacyMode
                ? "bg-[#FF8216]/12 text-[#FF8216] border border-[#FF8216]/25"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5] hover:bg-zinc-100 dark:hover:bg-[#121214]"
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              {isPrivacyMode ? <WfIcons.EyeOff size={17} /> : <WfIcons.Eye size={17} />}
              {!isSidebarCollapsed && (
                <span className="text-xs font-medium truncate">
                  {isPrivacyMode ? "Valores Ocultos" : "Valores Visíveis"}
                </span>
              )}
            </span>
            {!isSidebarCollapsed && isPrivacyMode && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FF8216]/20 text-[#FF8216]">
                ON
              </span>
            )}
          </button>

          {/* Notifications + Settings Row */}
          <div
            className={`flex items-center gap-1 ${
              isSidebarCollapsed ? "flex-col" : "flex-row"
            }`}
          >
            <button
              type="button"
              onClick={handleOpenNotifications}
              title="Notificações & Alertas"
              className={`relative flex items-center h-9 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5] hover:bg-zinc-100 dark:hover:bg-[#121214] transition-colors cursor-pointer ${
                isSidebarCollapsed ? "w-full justify-center" : "flex-1 gap-2 px-2.5"
              }`}
            >
              <WfIcons.Bell size={17} className="shrink-0" />
              {!isSidebarCollapsed && <span className="text-xs font-medium">Alertas</span>}
              {unreadNotifsCount > 0 && (
                <span className="ml-auto min-w-[16px] h-4 px-1 rounded-full bg-[#FF8216] text-black text-[9px] font-extrabold flex items-center justify-center">
                  {unreadNotifsCount > 9 ? "9+" : unreadNotifsCount}
                </span>
              )}
            </button>

            <Link
              href="/settings"
              title="Configurações"
              className={`flex items-center justify-center h-9 rounded-lg transition-colors ${
                isSidebarCollapsed ? "w-full" : "w-9 shrink-0"
              } ${
                pathname === "/settings"
                  ? "bg-zinc-100 dark:bg-[#18181B] text-[#FF8216]"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5] hover:bg-zinc-100 dark:hover:bg-[#121214]"
              }`}
            >
              <WfIcons.Settings size={17} />
            </Link>
          </div>

          {/* Collapse Sidebar Toggle */}
          <button
            type="button"
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            className={`flex items-center h-8 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5] hover:bg-zinc-100 dark:hover:bg-[#121214] transition-colors cursor-pointer ${
              isSidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
            }`}
          >
            <WfIcons.PanelLeftOpen
              size={16}
              className={`shrink-0 transition-transform duration-300 ${
                isSidebarCollapsed ? "" : "rotate-180"
              }`}
            />
            {!isSidebarCollapsed && (
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Recolher menu
              </span>
            )}
          </button>

          {/* User Profile Footer */}
          <Link
            href="/profile"
            title={`Perfil: ${userDisplayName}`}
            className={`mt-0.5 flex items-center rounded-xl p-1.5 border border-transparent hover:border-zinc-200 dark:hover:border-[#27272A] hover:bg-zinc-100/70 dark:hover:bg-[#121214] transition-all ${
              isSidebarCollapsed ? "justify-center" : "gap-2.5"
            } ${pathname === "/profile" ? "bg-zinc-100 dark:bg-[#121214] border-[#27272A]" : ""}`}
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-zinc-200 dark:border-[#27272A] bg-zinc-100 dark:bg-[#18181B] flex items-center justify-center shrink-0">
              {userProfile?.avatar_url ? (
                <img
                  src={userProfile.avatar_url}
                  alt={userDisplayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[11px] font-bold text-[#FF8216]">{userInitials}</span>
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-semibold text-zinc-900 dark:text-[#F4F4F5] truncate leading-tight">
                  {userDisplayName}
                </span>
                <span className="text-[10px] text-zinc-500 truncate leading-tight">
                  {user?.email || "Conta Sincronizada"}
                </span>
              </div>
            )}
          </Link>
        </div>
      </aside>

      {/* =====================================================================
          MAIN VIEWPORT AREA + MOBILE TOP BAR (< 768px)
         ===================================================================== */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen pb-[calc(var(--mobile-nav-total-offset)+0.5rem)] md:pb-0 bg-[#FAFAFA] dark:bg-[#0A0A0A] animate-page-enter">
        {/* Mobile Top Bar (< 768px) — Minimalista com Badge de Privacidade */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-13 border-b border-zinc-200 dark:border-[#27272A] bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur-xl pt-safe">
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#121214] border border-[#27272A] flex items-center justify-center shrink-0">
              <Image
                src="/assets/logo/logo_sem_fundo.png"
                alt="Kitsune"
                width={18}
                height={18}
                priority
                className="object-contain"
              />
            </div>
            <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-[#F4F4F5] truncate">
              {currentPageLabel}
            </span>
          </Link>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mobile Privacy Badge Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                togglePrivacyMode();
              }}
              className={`h-8 px-2.5 rounded-full border text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isPrivacyMode
                  ? "bg-[#FF8216]/15 border-[#FF8216]/35 text-[#FF8216]"
                  : "bg-zinc-100 dark:bg-[#121214] border-zinc-200 dark:border-[#27272A] text-zinc-500 dark:text-zinc-400"
              }`}
              title={isPrivacyMode ? "Modo Privacidade Ativo" : "Ocultar valores"}
            >
              {isPrivacyMode ? <WfIcons.EyeOff size={14} /> : <WfIcons.Eye size={14} />}
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {isPrivacyMode ? "Privado" : "Visível"}
              </span>
            </button>

            {/* Mobile Search */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setIsSearchOpen(true);
              }}
              className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] flex items-center justify-center text-zinc-500 dark:text-zinc-400 cursor-pointer"
              aria-label="Buscar"
            >
              <WfIcons.Search size={15} />
            </button>

            {/* Mobile Notifications */}
            <button
              type="button"
              onClick={handleOpenNotifications}
              className="relative w-8 h-8 rounded-full bg-zinc-100 dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] flex items-center justify-center text-zinc-500 dark:text-zinc-400 cursor-pointer"
              aria-label="Notificações"
            >
              <WfIcons.Bell size={15} />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-1 rounded-full bg-[#FF8216] text-black text-[9px] font-black flex items-center justify-center">
                  {unreadNotifsCount > 9 ? "9+" : unreadNotifsCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {children}
      </main>

      {/* =====================================================================
          MOBILE BOTTOM NAVIGATION BAR (< 768px) — Fiel ao Wealthfolio MobileNavbar
          Safe-area iOS/Android, ícones lineares, feedback tátil, badge privacidade e Quick Action
         ===================================================================== */}
      <div
        className="md:hidden fixed inset-x-0 bottom-0 z-40 pointer-events-none px-3 pt-2"
        style={{ paddingBottom: "max(0.65rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <nav
          aria-label="Navegação Mobile"
          className="pointer-events-auto mx-auto max-w-md h-[60px] rounded-full bg-white/92 dark:bg-[#121214]/94 backdrop-blur-2xl border border-zinc-200 dark:border-[#27272A] shadow-[0_14px_38px_rgba(0,0,0,0.65)] flex items-center justify-between px-2 select-none"
        >
          {/* Slot 1: Overview */}
          {[
            { path: "/dashboard", match: ["/dashboard"], label: "Início", Icon: WfIcons.Overview },
            {
              path: "/investments",
              match: ["/investments", "/holdings"],
              label: "Ativos",
              Icon: WfIcons.Holdings,
            },
          ].map(({ path, match, label, Icon }) => {
            const active = isItemActive(match);
            return (
              <Link
                key={path}
                href={path}
                onClick={() => triggerHaptic(10)}
                className={`relative flex-1 h-11 rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active
                    ? "text-[#FF8216]"
                    : "text-zinc-500 dark:text-zinc-400 active:scale-95"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="wf-mobile-nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute inset-x-1.5 inset-y-0.5 rounded-full bg-[#FF8216]/12 border border-[#FF8216]/25"
                  />
                )}
                <Icon size={19} className="relative z-10" />
                <span className="relative z-10 text-[10px] font-semibold leading-none tracking-tight">
                  {label}
                </span>
              </Link>
            );
          })}

          {/* Slot 3 (Center): Quick Action Button (+) */}
          <div className="px-1.5 flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(14);
                setIsQuickActionsOpen((prev) => !prev);
                setIsMoreSheetOpen(false);
              }}
              aria-label="Ações Rápidas"
              className="relative w-11 h-11 rounded-full bg-[#FF8216] hover:bg-[#FFA047] active:scale-92 text-black flex items-center justify-center shadow-[0_4px_20px_rgba(255,130,22,0.4)] transition-transform cursor-pointer"
            >
              <WfIcons.Plus
                size={20}
                className={`transition-transform duration-200 ${
                  isQuickActionsOpen ? "rotate-45" : ""
                }`}
              />
              {isPrivacyMode && (
                <span
                  title="Modo Privacidade Ativo"
                  className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#0A0A0A] border border-[#FF8216] flex items-center justify-center"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF8216]" />
                </span>
              )}
            </button>
          </div>

          {/* Slot 4: Insights */}
          {(() => {
            const active = isItemActive(["/insights"]);
            return (
              <Link
                href="/insights"
                onClick={() => triggerHaptic(10)}
                className={`relative flex-1 h-11 rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active
                    ? "text-[#FF8216]"
                    : "text-zinc-500 dark:text-zinc-400 active:scale-95"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="wf-mobile-nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute inset-x-1.5 inset-y-0.5 rounded-full bg-[#FF8216]/12 border border-[#FF8216]/25"
                  />
                )}
                <WfIcons.Insights size={19} className="relative z-10" />
                <span className="relative z-10 text-[10px] font-semibold leading-none tracking-tight">
                  Insights
                </span>
              </Link>
            );
          })()}

          {/* Slot 5: Mais (Wealthfolio CirclesFour Drawer) */}
          {(() => {
            const moreActive =
              isMoreSheetOpen ||
              isItemActive([
                "/transactions",
                "/goals",
                "/kitsune",
                "/agents",
                "/cards",
                "/connections",
                "/shared",
                "/settings",
                "/profile",
              ]);
            return (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setIsMoreSheetOpen((prev) => !prev);
                  setIsQuickActionsOpen(false);
                }}
                className={`relative flex-1 h-11 rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  moreActive
                    ? "text-[#FF8216]"
                    : "text-zinc-500 dark:text-zinc-400 active:scale-95"
                }`}
              >
                {moreActive && !isMoreSheetOpen && (
                  <motion.span
                    layoutId="wf-mobile-nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute inset-x-1.5 inset-y-0.5 rounded-full bg-[#FF8216]/12 border border-[#FF8216]/25"
                  />
                )}
                <WfIcons.CirclesFour size={19} className="relative z-10" />
                <span className="relative z-10 text-[10px] font-semibold leading-none tracking-tight">
                  Mais
                </span>
              </button>
            );
          })()}
        </nav>
      </div>

      {/* =====================================================================
          MOBILE QUICK ACTIONS SHEET (+) — Wealthfolio MobileActionsMenu
         ===================================================================== */}
      <AnimatePresence>
        {isQuickActionsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setIsQuickActionsOpen(false)}
            className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))" }}
              className="transform-gpu will-change-transform w-full rounded-t-[28px] bg-[#121214] border-t border-[#27272A] px-5 pt-2 shadow-2xl"
            >
              {/* Drag Handle Interativo (Clique ou Arrasto para Baixo para Fechar) */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  triggerHaptic(8);
                  setIsQuickActionsOpen(false);
                }}
                onTouchStart={handleTouchStart}
                onTouchEnd={(e) => handleTouchEnd(e, () => setIsQuickActionsOpen(false))}
                className="w-full h-8 flex items-center justify-center cursor-pointer touch-none select-none active:opacity-60 mb-2"
                aria-label="Fechar ações rápidas"
              >
                <div className="w-12 h-1.5 rounded-full bg-zinc-600 dark:bg-zinc-700 hover:bg-[#FF8216] transition-colors" />
              </div>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#F4F4F5]">Ações Rápidas</h3>
                  <p className="text-[11px] text-zinc-400">
                    Atalhos diretos do seu patrimônio
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(8);
                    togglePrivacyMode();
                  }}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border flex items-center gap-1.5 cursor-pointer ${
                    isPrivacyMode
                      ? "bg-[#FF8216]/15 border-[#FF8216]/35 text-[#FF8216]"
                      : "bg-[#18181B] border-[#27272A] text-zinc-300"
                  }`}
                >
                  {isPrivacyMode ? <WfIcons.EyeOff size={14} /> : <WfIcons.Eye size={14} />}
                  <span>{isPrivacyMode ? "Saldos Ocultos" : "Saldos Visíveis"}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    setIsPluggyModalOpen(true);
                  }}
                  className="p-3.5 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-[#FF8216]/50 text-left flex flex-col gap-2 cursor-pointer"
                >
                  <span className="w-8 h-8 rounded-lg bg-[#FF8216]/15 text-[#FF8216] flex items-center justify-center">
                    <WfIcons.Connections size={17} />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-[#F4F4F5] block">
                      Conectar Banco
                    </span>
                    <span className="text-[10px] text-zinc-400">Open Finance Brasil</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    setIsAssetModalOpen(true);
                  }}
                  className="p-3.5 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-[#FF8216]/50 text-left flex flex-col gap-2 cursor-pointer"
                >
                  <span className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center text-sm">
                    🚗
                  </span>
                  <div>
                    <span className="text-xs font-bold text-[#F4F4F5] block">
                      Novo Ativo Físico
                    </span>
                    <span className="text-[10px] text-zinc-400">Veículo FIPE, Terreno ou FGTS</span>
                  </div>
                </button>

                <Link
                  href="/transactions"
                  onClick={() => setIsQuickActionsOpen(false)}
                  className="p-3.5 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-[#FF8216]/50 text-left flex flex-col gap-2"
                >
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                    <WfIcons.Transactions size={17} />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-[#F4F4F5] block">
                      Extrato & Lançar
                    </span>
                    <span className="text-[10px] text-zinc-400">Ver ou criar transação</span>
                  </div>
                </Link>

                <Link
                  href="/kitsune"
                  onClick={() => setIsQuickActionsOpen(false)}
                  className="p-3.5 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-[#FF8216]/50 text-left flex flex-col gap-2"
                >
                  <span className="w-8 h-8 rounded-lg bg-[#FF8216]/15 text-[#FF8216] flex items-center justify-center">
                    <WfIcons.Agents size={17} />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-[#F4F4F5] block">
                      Consultar Kitsune AI
                    </span>
                    <span className="text-[10px] text-zinc-400">Diagnóstico e consultoria</span>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    revalidate(true);
                  }}
                  className="p-3.5 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-[#FF8216]/50 text-left flex flex-col gap-2 cursor-pointer"
                >
                  <span className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-200 flex items-center justify-center">
                    <WfIcons.RefreshCw
                      size={16}
                      className={isRevalidating ? "animate-spin text-[#FF8216]" : ""}
                    />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-[#F4F4F5] block">
                      Sincronizar Agora
                    </span>
                    <span className="text-[10px] text-zinc-400">Atualizar saldos reais</span>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          MOBILE "MAIS" NAVIGATION DRAWER — Wealthfolio Secondary Pages Sheet
         ===================================================================== */}
      <AnimatePresence>
        {isMoreSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setIsMoreSheetOpen(false)}
            className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))" }}
              className="transform-gpu will-change-transform w-full rounded-t-[28px] bg-[#121214] border-t border-[#27272A] px-5 pt-2 shadow-2xl max-h-[82vh] overflow-y-auto"
            >
              {/* Drag Handle Interativo (Clique ou Arrasto para Baixo para Fechar) */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  triggerHaptic(8);
                  setIsMoreSheetOpen(false);
                }}
                onTouchStart={handleTouchStart}
                onTouchEnd={(e) => handleTouchEnd(e, () => setIsMoreSheetOpen(false))}
                className="w-full h-8 flex items-center justify-center cursor-pointer touch-none select-none active:opacity-60 mb-2"
                aria-label="Fechar menu"
              >
                <div className="w-12 h-1.5 rounded-full bg-zinc-600 dark:bg-zinc-700 hover:bg-[#FF8216] transition-colors" />
              </div>

              {/* User Header */}
              <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-[#27272A]">
                <Link
                  href="/profile"
                  onClick={() => setIsMoreSheetOpen(false)}
                  className="flex items-center gap-3 min-w-0"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-center text-[#FF8216] font-bold text-xs shrink-0 overflow-hidden">
                    {userProfile?.avatar_url ? (
                      <img
                        src={userProfile.avatar_url}
                        alt={userDisplayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      userInitials
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-[#F4F4F5] block truncate">
                      {userDisplayName}
                    </span>
                    <span className="text-[11px] text-zinc-400 block truncate">
                      Ver perfil & objetivos →
                    </span>
                  </div>
                </Link>

                <Link
                  href="/settings"
                  onClick={() => setIsMoreSheetOpen(false)}
                  className="w-9 h-9 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-center text-zinc-300"
                  aria-label="Configurações"
                >
                  <WfIcons.Settings size={17} />
                </Link>
              </div>

              {/* Grid of All Modules */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    href: "/transactions",
                    label: "Transações",
                    sub: "Extrato & filtros",
                    Icon: WfIcons.Transactions,
                  },
                  {
                    href: "/goals",
                    label: "Metas & FIRE",
                    sub: "Reserva & objetivos",
                    Icon: WfIcons.Goals,
                  },
                  {
                    href: "/cards",
                    label: "Cartões & Dívidas",
                    sub: "Faturas & limites",
                    Icon: WfIcons.Cards,
                  },
                  {
                    href: "/kitsune",
                    label: "Kitsune AI",
                    sub: "Copiloto patrimonial",
                    Icon: WfIcons.Agents,
                  },
                  {
                    href: "/agents",
                    label: "7 Agentes IA",
                    sub: "Consultores Especialistas",
                    Icon: WfIcons.BotGrid,
                  },
                  {
                    href: "/connections",
                    label: "Open Finance",
                    sub: "Bancos conectados",
                    Icon: WfIcons.Connections,
                  },
                  {
                    href: "/shared",
                    label: "Compartilhado",
                    sub: "Modo Duo & Família",
                    Icon: WfIcons.Shared,
                  },
                  {
                    href: "/settings",
                    label: "Configurações",
                    sub: "Segurança & conta",
                    Icon: WfIcons.Settings,
                  },
                ].map(({ href, label, sub, Icon }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => {
                        triggerHaptic(8);
                        setIsMoreSheetOpen(false);
                      }}
                      className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${
                        active
                          ? "bg-[#FF8216]/12 border-[#FF8216]/35 text-[#F4F4F5]"
                          : "bg-[#18181B] border-[#27272A] text-zinc-200"
                      }`}
                    >
                      <Icon
                        size={18}
                        className={active ? "text-[#FF8216] shrink-0" : "text-zinc-400 shrink-0"}
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold block truncate">{label}</span>
                        <span className="text-[10px] text-zinc-500 block truncate">{sub}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full mt-4 py-2.5 rounded-xl bg-[#18181B] border border-[#27272A] text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                Encerrar Sessão com Segurança
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modais Globais unificados no AppShell */}
      <GlobalFinanceSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        transactions={transactions as any}
        formatCurrency={formatSensitiveCurrency}
        formatDate={formatDatePtBr}
      />

      <PluggyConnectModal
        isOpen={isPluggyModalOpen}
        onClose={() => setIsPluggyModalOpen(false)}
        familyMembers={familyMembers}
        onMemberCreated={addFamilyMemberLocal}
        onConnectionSuccess={() => {
          setIsPluggyModalOpen(false);
          revalidate(true);
        }}
      />

      <AssetModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => {
          setIsNotificationsOpen(false);
          fetchUnreadNotifs();
        }}
        onRefreshData={fetchUnreadNotifs}
      />
    </div>
  );
}
