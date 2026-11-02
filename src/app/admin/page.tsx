"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";
import Spinner from "@/components/Spinner";

interface Member {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  status: "active" | "suspended" | "revoked";
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface SystemTelemetry {
  database: { status: string; provider: string; region: string };
  aiPool: { status: string; gemini: string; groq: string };
  openFinance: { status: string; provider: string; totalConnections: number };
  metrics: {
    totalMembers: number;
    totalAccounts: number;
    totalTransactions: number;
    totalAssets: number;
  };
  environment: { platform: string; domain: string; securityMode: string };
}

interface ApiTestResult {
  name: string;
  ok: boolean;
  latencyMs?: number;
  info: string;
}

export default function AdminControlPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [apiTests, setApiTests] = useState<ApiTestResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTestingApis, setIsTestingApis] = useState(false);
  const [isPurgingCache, setIsPurgingCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Formulário para novo membro
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "member">("member");
  const [newNotes, setNewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, telemetryRes] = await Promise.all([
        fetch("/api/admin/members"),
        fetch("/api/admin/system"),
      ]);

      const [membersData, telemetryData] = await Promise.all([
        membersRes.json(),
        telemetryRes.json(),
      ]);

      if (!membersRes.ok) throw new Error(membersData.error || "Erro ao carregar membros.");
      setMembers(membersData.members || []);

      if (telemetryRes.ok && telemetryData.data) {
        setTelemetry(telemetryData.data);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          role: newRole,
          notes: newNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao conceder acesso.");

      setSuccess(`Acesso concedido com sucesso para ${newEmail}!`);
      setNewEmail("");
      setNewNotes("");
      setNewRole("member");
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: "active" | "suspended" | "revoked") => {
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess("Status atualizado com sucesso!");
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteMember = async (id: string, email: string) => {
    if (!confirm(`Tem certeza que deseja revogar definitivamente o acesso de ${email}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/members?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess(`Acesso de ${email} revogado e removido com sucesso.`);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePurgeAiCache = async () => {
    setIsPurgingCache(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purge_ai_cache" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(data.message || "Cache de IA invalidado.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPurgingCache(false);
    }
  };

  const handleTestApis = async () => {
    setIsTestingApis(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_apis" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApiTests(data.tests || []);
      setSuccess("Teste de conectividade concluído.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsTestingApis(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-7">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272A]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E11D48]/10 border border-[#E11D48]/30 flex items-center justify-center text-[#E11D48]">
              <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-[#F4F4F5] tracking-tight">
                Painel de Governança & Engenharia
              </h1>
              <p className="text-xs text-zinc-400">
                Controle soberano de acessos, telemetria de infraestrutura e ações administrativas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="h-9 px-4 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">arrow_back</span>
              <span>Dashboard</span>
            </Link>
          </div>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">✕</button>
          </div>
        )}
        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {/* CARDS DE TELEMETRIA & VOLUME GLOBAL */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] space-y-1">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] font-medium">
              <span>Membros com Acesso</span>
              <span className="material-symbols-outlined text-[14px] text-emerald-400">verified_user</span>
            </div>
            <p className="text-2xl font-black text-white font-mono">
              {telemetry?.metrics.totalMembers ?? members.length}
            </p>
            <p className="text-[10px] text-zinc-500">Allowlist Estrita Ativa</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] space-y-1">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] font-medium">
              <span>Transações na Base</span>
              <span className="material-symbols-outlined text-[14px] text-[#E11D48]">receipt</span>
            </div>
            <p className="text-2xl font-black text-white font-mono">
              {telemetry?.metrics.totalTransactions ?? "—"}
            </p>
            <p className="text-[10px] text-zinc-500">Conciliação Determinística</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] space-y-1">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] font-medium">
              <span>Contas & Carteiras</span>
              <span className="material-symbols-outlined text-[14px] text-blue-400">account_balance</span>
            </div>
            <p className="text-2xl font-black text-white font-mono">
              {telemetry?.metrics.totalAccounts ?? "—"}
            </p>
            <p className="text-[10px] text-zinc-500">Open Finance + Manual</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] space-y-1">
            <div className="flex items-center justify-between text-zinc-400 text-[11px] font-medium">
              <span>Ativos Físicos</span>
              <span className="material-symbols-outlined text-[14px] text-purple-400">directions_car</span>
            </div>
            <p className="text-2xl font-black text-white font-mono">
              {telemetry?.metrics.totalAssets ?? "—"}
            </p>
            <p className="text-[10px] text-zinc-500">FIPE, Imóveis e FGTS</p>
          </div>
        </div>

        {/* STATUS DOS SERVIÇOS & AÇÕES RÁPIDAS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Status dos Serviços */}
          <div className="lg:col-span-2 p-5 rounded-2xl bg-[#121214] border border-[#27272A] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Status de Conectividade e APIs</span>
              </h2>
              <button
                type="button"
                onClick={handleTestApis}
                disabled={isTestingApis}
                className="px-3 py-1.5 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-[11px] font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isTestingApis ? <Spinner size={12} className="text-white" /> : <span className="material-symbols-outlined text-[14px]">bolt</span>}
                <span>Testar APIs</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#18181B] border border-[#27272A] space-y-1">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="font-semibold text-white">Banco PostgreSQL</span>
                  <span className="text-[10px] text-emerald-400 font-bold">ONLINE</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-mono">Supabase PostgreSQL 17 (us-east-1)</p>
              </div>

              <div className="p-3 rounded-xl bg-[#18181B] border border-[#27272A] space-y-1">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="font-semibold text-white">Pool Kitsune IA</span>
                  <span className="text-[10px] text-emerald-400 font-bold">ONLINE</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-mono">Gemini 3.8 Flash + Groq Llama 3.3</p>
              </div>

              <div className="p-3 rounded-xl bg-[#18181B] border border-[#27272A] space-y-1">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="font-semibold text-white">Open Finance</span>
                  <span className="text-[10px] text-emerald-400 font-bold">CONECTADO</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-mono">Pluggy Brasil (140+ Instituições)</p>
              </div>

              <div className="p-3 rounded-xl bg-[#18181B] border border-[#27272A] space-y-1">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="font-semibold text-white">Borda e Produção</span>
                  <span className="text-[10px] text-emerald-400 font-bold">ATIVO</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-mono">mykitsune.vercel.app</p>
              </div>
            </div>

            {/* Resultado do Teste de APIs */}
            {apiTests && (
              <div className="pt-2 border-t border-[#27272A] space-y-2">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Diagnóstico Recente de Conectividade:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {apiTests.map((t) => (
                    <div key={t.name} className="p-2.5 rounded-lg bg-[#0A0A0A] border border-[#27272A] flex items-center justify-between text-[11px]">
                      <span className="text-zinc-300 font-medium">{t.name}</span>
                      <span className={`font-mono font-bold ${t.ok ? "text-emerald-400" : "text-rose-400"}`}>
                        {t.ok ? `✓ ${t.info}` : "✕ Falha"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Central de Ações Rápidas */}
          <div className="p-5 rounded-2xl bg-[#121214] border border-[#27272A] space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#E11D48]">tune</span>
                <span>Ações do Administrador</span>
              </h2>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Manutenção preventiva de memória, limpeza de sessões antigas de IA e sincronizações.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handlePurgeAiCache}
                disabled={isPurgingCache}
                className="w-full h-10 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isPurgingCache ? <Spinner size={14} className="text-white" /> : <span className="material-symbols-outlined text-[16px]">refresh</span>}
                <span>Limpar Cache de Dossiês IA</span>
              </button>

              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="w-full h-10 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {loading ? <Spinner size={14} className="text-black" /> : <span className="material-symbols-outlined text-[16px]">sync</span>}
                <span>Atualizar Telemetria</span>
              </button>
            </div>
          </div>
        </div>

        {/* FORMULÁRIO DE NOVO ACESSO */}
        <div className="p-6 rounded-3xl bg-[#121214] border border-[#27272A] space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#E11D48]">person_add</span>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Conceder Novo Acesso ao Sistema
            </h2>
          </div>

          <form onSubmit={handleAddMember} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <input
                type="email"
                placeholder="E-mail do Usuário (Google ou Login)"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="w-full h-11 px-4 rounded-xl bg-[#18181B] border border-[#27272A] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#E11D48] transition-colors"
              />
            </div>

            <div>
              <select
                value={newRole}
                onChange={(e: any) => setNewRole(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-[#18181B] border border-[#27272A] text-xs text-white focus:outline-none focus:border-[#E11D48] transition-colors"
              >
                <option value="member">Membro (Uso Pessoal)</option>
                <option value="admin">Administrador Secundário</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting || !newEmail.trim()}
                className="w-full h-11 rounded-xl bg-white hover:bg-zinc-200 text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Spinner size={16} className="text-black" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    <span>Autorizar Acesso</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* TABELA DE MEMBROS AUTORIZADOS */}
        <div className="p-6 rounded-3xl bg-[#121214] border border-[#27272A] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#27272A]">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Contas com Permissão Ativa
              </h2>
              <p className="text-[11px] text-zinc-400">
                Qualquer login fora desta lista é bloqueado e expurgado antes de tocar no banco.
              </p>
            </div>
            <button
              onClick={loadData}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">refresh</span>
              <span>Atualizar</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#27272A] text-zinc-500 font-mono uppercase text-[10px]">
                  <th className="py-3 px-2">Usuário / E-mail</th>
                  <th className="py-3 px-2">Papel</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2">Acesso Desde</th>
                  <th className="py-3 px-2 text-right">Ações Administrativas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                      <Spinner size={20} className="mx-auto text-zinc-400 mb-2" />
                      Carregando governança...
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                      Nenhum membro autorizado cadastrado.
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-2 font-medium text-white flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#18181B] border border-[#27272A] flex items-center justify-center text-[10px] font-bold text-zinc-300">
                          {m.email.substring(0, 2).toUpperCase()}
                        </span>
                        <span>{m.email}</span>
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider font-mono ${
                            m.role === "owner"
                              ? "bg-[#E11D48]/20 text-[#E11D48] border border-[#E11D48]/30"
                              : m.role === "admin"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                          }`}
                        >
                          {m.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            m.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : m.status === "suspended"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-rose-500/10 text-rose-400"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              m.status === "active"
                                ? "bg-emerald-400"
                                : m.status === "suspended"
                                ? "bg-amber-400"
                                : "bg-rose-400"
                            }`}
                          />
                          {m.status}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-zinc-400 font-mono text-[11px]">
                        {new Date(m.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {m.role === "owner" ? (
                          <span className="text-[11px] text-zinc-500 font-italic">Protegido (Master)</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {m.status === "active" ? (
                              <button
                                onClick={() => handleUpdateStatus(m.id, "suspended")}
                                className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                Suspender
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateStatus(m.id, "active")}
                                className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                Reativar
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteMember(m.id, m.email)}
                              className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              Remover
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
