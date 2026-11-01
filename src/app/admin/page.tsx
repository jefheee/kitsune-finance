"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";
import { createClient } from "@/utils/supabase/client";

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

export default function AdminControlPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Formulário para novo membro
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "member">("member");
  const [newNotes, setNewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/members");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível carregar a lista de membros.");
      }
      setMembers(data.members || []);
    } catch (err: any) {
      setError(err.message || "Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
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
      if (!res.ok) {
        throw new Error(data.error || "Erro ao cadastrar novo usuário.");
      }

      setSuccess(`Acesso concedido com sucesso para ${newEmail}!`);
      setNewEmail("");
      setNewNotes("");
      setNewRole("member");
      loadMembers();
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

      setSuccess("Status do usuário atualizado com sucesso!");
      loadMembers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteMember = async (id: string, email: string) => {
    if (!confirm(`Tem certeza que deseja revogar definitivamente o acesso de ${email}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/members?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess(`Acesso de ${email} revogado e removido.`);
      loadMembers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-[1380px] mx-auto p-4 md:p-7 pb-28 md:pb-10 font-sans space-y-6">
      {/* Header Canônico Wealthfolio */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-[#27272A]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#E11D48]/15 border border-[#E11D48]/30 flex items-center justify-center text-[#E11D48]">
              <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
            </span>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-[#F4F4F5]">
              Painel de Governança & Acessos
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Controle mestre de quem pode acessar este ambiente de produção na Vercel e no Supabase.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="h-9 px-3.5 rounded-xl border border-zinc-200 dark:border-[#27272A] hover:bg-zinc-100 dark:hover:bg-[#18181B] text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-2 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          <span>Voltar ao Dashboard</span>
        </Link>
      </div>

      {/* Alertas de Feedback */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-zinc-400 hover:text-white">✕</button>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-zinc-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Estatísticas Rápidas de Segurança */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Modo de Segurança</span>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-base font-bold text-white">Allowlist Estrita Ativa</span>
          </div>
          <span className="text-[10px] text-zinc-500 mt-1">Desconhecidos são bloqueados no login</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Membros Autorizados</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-extrabold font-mono text-white">{members.length}</span>
            <span className="text-xs text-zinc-400">contas com acesso</span>
          </div>
          <span className="text-[10px] text-zinc-500 mt-1">Protegido por Supabase FORCE RLS</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Master Owner</span>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-bold text-white truncate">jnnebu@gmail.com</span>
          </div>
          <span className="text-[10px] text-zinc-500 mt-1">Permissão perpétua e imutável</span>
        </div>
      </div>

      {/* Formulário: Conceder Novo Acesso */}
      <div className="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-[#E11D48] text-lg">person_add</span>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Conceder Novo Acesso</h2>
        </div>

        <form onSubmit={handleAddMember} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5 flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-400">E-mail do Usuário (Google ou Login)</label>
            <input
              type="email"
              required
              placeholder="exemplo@gmail.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="h-10 px-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white transition-colors"
            />
          </div>

          <div className="sm:col-span-3 flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-400">Papel / Nível</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
              className="h-10 px-3 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-white focus:outline-none focus:border-white transition-colors cursor-pointer"
            >
              <option value="member">Membro (Uso Financeiro Pessoal)</option>
              <option value="admin">Administrador (Pode gerenciar acessos)</option>
            </select>
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-400">Observação (Opcional)</label>
            <input
              type="text"
              placeholder="Ex: Família, Parceiro..."
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="h-10 px-3 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white transition-colors"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 px-4 rounded-xl bg-white hover:bg-zinc-200 active:bg-zinc-300 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>Autorizar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Tabela de Membros Autorizados */}
      <div className="rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] overflow-hidden shadow-xs">
        <div className="p-4 md:px-6 border-b border-zinc-200 dark:border-[#27272A] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Usuários com Acesso Autorizado</h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Qualquer tentativa de login fora desta lista é barrada no middleware antes de chegar ao app.
            </p>
          </div>
          <button
            onClick={loadMembers}
            className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-[#27272A] text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span>Atualizar</span>
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-400">Carregando governança...</div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400">Nenhum membro encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-[#27272A] bg-zinc-50/50 dark:bg-[#18181B]/40 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4 md:px-6">Usuário / E-mail</th>
                  <th className="py-3 px-4">Papel</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Notas</th>
                  <th className="py-3 px-4 text-right pr-4 md:pr-6">Ações Administrativas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-[#27272A]">
                {members.map((m) => {
                  const isOwner = m.role === "owner";
                  return (
                    <tr key={m.id} className="hover:bg-zinc-50 dark:hover:bg-[#18181B]/30 transition-colors">
                      <td className="py-3.5 px-4 md:px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] flex items-center justify-center font-bold text-[11px] text-white">
                            {m.email.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-semibold text-zinc-900 dark:text-white">{m.email}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isOwner
                              ? "bg-[#E11D48]/20 text-[#E11D48] border border-[#E11D48]/30"
                              : m.role === "admin"
                              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                              : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                          }`}
                        >
                          {m.role}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            m.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : m.status === "suspended"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
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

                      <td className="py-3.5 px-4 text-zinc-400">
                        {m.notes || <span className="text-zinc-600">—</span>}
                      </td>

                      <td className="py-3.5 px-4 text-right pr-4 md:pr-6">
                        {isOwner ? (
                          <span className="text-[10px] text-zinc-500 italic">Protegido (Master)</span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            {m.status === "active" ? (
                              <button
                                onClick={() => handleUpdateStatus(m.id, "suspended")}
                                title="Suspender temporariamente o acesso"
                                className="px-2 py-1 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-[10px] font-semibold transition-colors cursor-pointer"
                              >
                                Suspender
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateStatus(m.id, "active")}
                                title="Reativar acesso"
                                className="px-2 py-1 rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-[10px] font-semibold transition-colors cursor-pointer"
                              >
                                Reativar
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteMember(m.id, m.email)}
                              title="Remover definitivamente da lista"
                              className="px-2 py-1 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-[10px] font-semibold transition-colors cursor-pointer"
                            >
                              Remover
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

