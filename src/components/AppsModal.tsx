"use client";

import { useState } from "react";

interface AppsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AppEntry {
  id: string;
  name: string;
  category: "SUGESTÕES PARA VOCÊ" | "POPULARES" | "FINANÇAS";
  description: string;
  icon: string;
  actionType: "sheets_export" | "link" | "connected";
  connected: boolean;
}

export function AppsModal({ isOpen, onClose }: AppsModalProps) {
  const [search, setSearch] = useState("");
  const [connectedApps, setConnectedApps] = useState<Record<string, boolean>>({
    sheets: false,
    drive: false,
    calendar: false,
  });

  if (!isOpen) return null;

  const apps: AppEntry[] = [
    {
      id: "sheets",
      name: "Google Sheets",
      category: "SUGESTÕES PARA VOCÊ",
      description: "Organizar e exportar seus extratos e orçamentos em planilhas.",
      icon: "table_chart",
      actionType: "sheets_export",
      connected: connectedApps["sheets"] || false,
    },
    {
      id: "calendar",
      name: "Google Calendar",
      category: "SUGESTÕES PARA VOCÊ",
      description: "Criar lembretes e alertas de vencimento de faturas no calendário.",
      icon: "calendar_today",
      actionType: "link",
      connected: connectedApps["calendar"] || false,
    },
    {
      id: "drive",
      name: "Google Drive",
      category: "SUGESTÕES PARA VOCÊ",
      description: "Salvar relatórios patrimoniais e comprovantes financeiros na nuvem.",
      icon: "cloud_upload",
      actionType: "link",
      connected: connectedApps["drive"] || false,
    },
    {
      id: "notion",
      name: "Notion",
      category: "SUGESTÕES PARA VOCÊ",
      description: "Sincronizar acompanhamento de metas patrimoniais e orçamentos.",
      icon: "description",
      actionType: "link",
      connected: false,
    },
    {
      id: "github",
      name: "GitHub",
      category: "POPULARES",
      description: "Integração para desenvolvedores e sincronização de dados abertos.",
      icon: "code",
      actionType: "link",
      connected: false,
    },
    {
      id: "slack",
      name: "Slack",
      category: "POPULARES",
      description: "Receber notificações de anomalias e fechamento de faturas no seu workspace.",
      icon: "chat",
      actionType: "link",
      connected: false,
    },
  ];

  const filteredApps = apps.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleAction = (app: AppEntry) => {
    if (app.id === "sheets") {
      // Exporta imediatamente a planilha em CSV compatível com Google Sheets
      window.open("/api/export/spreadsheet", "_blank");
      setConnectedApps((prev) => ({ ...prev, sheets: true }));
    } else {
      setConnectedApps((prev) => ({ ...prev, [app.id]: !prev[app.id] }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FF8216]/10 text-[#FF8216] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">extension</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Apps & Conexões
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1A202C] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#0E121A]/50">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar aplicativo..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-[#161B26] border border-slate-200 dark:border-[#262E3D] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#FF8216]"
            />
          </div>
        </div>

        {/* Apps List */}
        <div className="p-4 overflow-y-auto flex flex-col gap-2.5">
          {filteredApps.map((app) => {
            const isConnected = connectedApps[app.id];
            return (
              <div
                key={app.id}
                className="p-3 rounded-2xl bg-slate-50/70 dark:bg-[#161B26]/70 border border-slate-200/70 dark:border-[#262E3D]/70 flex items-center justify-between gap-3 hover:border-[#FF8216]/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E2533] border border-slate-200 dark:border-white/10 flex items-center justify-center text-[#FF8216] shrink-0">
                    <span className="material-symbols-outlined text-xl">{app.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                      {app.name}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block">
                      {app.description}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAction(app)}
                  className={`h-8 px-3 rounded-xl text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                    isConnected
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      : app.id === "sheets"
                      ? "bg-[#FF8216] hover:bg-[#FFA047] text-white"
                      : "bg-white dark:bg-[#1E2533] hover:bg-slate-100 dark:hover:bg-[#252E3E] text-slate-700 dark:text-white border border-slate-200 dark:border-[#262E3D]"
                  }`}
                >
                  {isConnected
                    ? "Conectado"
                    : app.id === "sheets"
                    ? "Gerar Planilha"
                    : "Conectar"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
