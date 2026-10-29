"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Spinner from "@/components/Spinner";
import { BankLogo } from "@/components/BankLogo";
import { getBankCatalogBySlugOrName } from "@/utils/pluggy/bank-resolver";
import { useFinanceData } from "@/context/FinanceDataContext";

const PluggyConnect = dynamic(
    () => import("react-pluggy-connect").then((mod) => mod.PluggyConnect),
    { ssr: false }
);

export default function ConnectionsPage() {
    const {
        connections,
        accounts,
        investments,
        isInitialLoading,
        revalidate,
        removeConnectionLocal,
    } = useFinanceData();

    const [isLoadingToken, setIsLoadingToken] = useState(false);
    const [connectToken, setConnectToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
    const [syncingItemId, setSyncingItemId] = useState<string | null>(null);

    const accountsByItem = useMemo(() => {
        const map = new Map<string, any[]>();
        accounts.forEach((acc) => {
            const itemId = acc.item_id;
            if (!itemId) return;
            if (!map.has(itemId)) map.set(itemId, []);
            map.get(itemId)!.push(acc);
        });
        return map;
    }, [accounts]);

    const investmentsByItem = useMemo(() => {
        const map = new Map<string, any[]>();
        investments.forEach((inv) => {
            const itemId = inv.item_id;
            if (!itemId) return;
            if (!map.has(itemId)) map.set(itemId, []);
            map.get(itemId)!.push(inv);
        });
        return map;
    }, [investments]);

    const resolveDisplayInstitution = (conn: any) => {
        const linkedAccounts = accountsByItem.get(conn.item_id) || [];

        if (conn.institution_slug && conn.institution_slug !== "generic") {
            const catalog = getBankCatalogBySlugOrName(conn.institution_slug);
            return { name: conn.institution_name || catalog.name, slug: catalog.slug };
        }

        if (
            conn.institution_name &&
            !conn.institution_name.toLowerCase().includes("pluggy") &&
            conn.institution_name !== "Instituição Conectada"
        ) {
            const catalog = getBankCatalogBySlugOrName(conn.institution_name);
            return { name: conn.institution_name, slug: catalog.slug };
        }

        for (const acc of linkedAccounts) {
            const candidate = acc.institution_slug || acc.institution_name || acc.bank_name;
            const catalog = getBankCatalogBySlugOrName(candidate);
            if (catalog.slug !== "generic") {
                return { name: catalog.name, slug: catalog.slug };
            }
        }

        return { name: "Instituição Financeira", slug: "generic" };
    };

    // Ordenação decrescente por relevância patrimonial
    const sortedConnections = useMemo(() => {
        return [...connections].sort((a, b) => {
            const aAccs = accountsByItem.get(a.item_id) || [];
            const bAccs = accountsByItem.get(b.item_id) || [];
            const aInvs = investmentsByItem.get(a.item_id) || [];
            const bInvs = investmentsByItem.get(b.item_id) || [];

            const aTotal =
                aAccs.reduce((s, acc) => s + (acc.subtype !== "CREDIT_CARD" ? Number(acc.balance) || 0 : 0), 0) +
                aInvs.reduce((s, inv) => s + (Number(inv.balance) || 0), 0);
            const bTotal =
                bAccs.reduce((s, acc) => s + (acc.subtype !== "CREDIT_CARD" ? Number(acc.balance) || 0 : 0), 0) +
                bInvs.reduce((s, inv) => s + (Number(inv.balance) || 0), 0);

            return bTotal - aTotal;
        });
    }, [connections, accountsByItem, investmentsByItem]);

    const handleAddConnection = async () => {
        setIsLoadingToken(true);
        setError(null);
        try {
            const res = await fetch("/api/pluggy/connect-token", { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Falha ao iniciar conexão segura.");
            setConnectToken(data.accessToken);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoadingToken(false);
        }
    };

    const handleSyncItem = async (itemId: string) => {
        setSyncingItemId(itemId);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch("/api/pluggy/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ itemId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao sincronizar instituição.");
            setSuccess("Sincronização concluída com sucesso!");
            await revalidate();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSyncingItemId(null);
        }
    };

    const handleDisconnectItem = async (conn: any) => {
        const inst = resolveDisplayInstitution(conn);
        if (!confirm(`Deseja revogar o acesso do ${inst.name}? Seus dados sincronizados serão removidos.`)) {
            return;
        }

        setDeletingItemId(conn.item_id);
        setError(null);
        try {
            const res = await fetch(`/api/pluggy/items/${conn.item_id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Falha ao desconectar instituição.");
            removeConnectionLocal(conn.item_id);
            setSuccess(`${inst.name} desconectado com sucesso.`);
            await revalidate();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setDeletingItemId(null);
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-12 animate-fade-in">
            {/* Header da Página */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[#FF8216]">account_balance</span>
                        Conexões Bancárias & Open Finance
                    </h1>
                    <p className="text-xs md:text-sm text-slate-400 mt-1">
                        Gerencie suas instituições vinculadas via Open Finance Brasil oficial com segurança e controle total.
                    </p>
                </div>

                <button
                    onClick={handleAddConnection}
                    disabled={isLoadingToken}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] text-black font-semibold text-xs md:text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                    {isLoadingToken ? (
                        <>
                            <Spinner size={16} />
                            <span>Iniciando Conexão...</span>
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-[18px]">add_link</span>
                            <span>Conectar Nova Conta</span>
                        </>
                    )}
                </button>
            </div>

            {/* Mensagens de Alerta */}
            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs md:text-sm text-red-400 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    <span>{error}</span>
                </div>
            )}
            {success && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs md:text-sm text-emerald-400 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>{success}</span>
                </div>
            )}

            {/* Banner de Segurança & Privacidade */}
            <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">verified_user</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">Ambiente 100% Somente-Leitura</h3>
                        <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                            Criptografia TLS 1.3 de nível bancário e isolamento rigoroso por RLS. O sistema não tem permissão para movimentar seu dinheiro.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Open Finance Ativo</span>
                </div>
            </div>

            {/* Modal do Pluggy Connect */}
            {connectToken && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-[#12161F] border border-white/10 rounded-2xl p-6 shadow-2xl relative">
                        <button
                            onClick={() => setConnectToken(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            ✕
                        </button>
                        <h3 className="text-lg font-bold text-white mb-4">Conectar com Open Finance</h3>
                        <PluggyConnect
                            connectToken={connectToken}
                            includeSandbox={false}
                            onSuccess={async (itemData) => {
                                setConnectToken(null);
                                setSuccess("Instituição conectada com sucesso!");
                                try {
                                    await fetch("/api/pluggy/save-item", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ item: itemData.item }),
                                    });
                                    await revalidate();
                                } catch (e) {
                                    console.error(e);
                                }
                            }}
                            onError={(err) => {
                                setError("Erro no processo de conexão do banco.");
                                setConnectToken(null);
                            }}
                            onClose={() => setConnectToken(null)}
                        />
                    </div>
                </div>
            )}

            {/* Lista de Instituições Vinculadas */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                        Instituições Vinculadas ({sortedConnections.length})
                    </h2>
                    <span className="text-xs text-slate-500">Ordenadas por relevância patrimonial</span>
                </div>

                {isInitialLoading ? (
                    <div className="p-12 text-center bg-[#12161F] rounded-2xl border border-white/5 flex flex-col items-center gap-3">
                        <Spinner size={24} />
                        <span className="text-xs text-slate-400">Carregando suas conexões bancárias...</span>
                    </div>
                ) : sortedConnections.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sortedConnections.map((conn) => {
                            const inst = resolveDisplayInstitution(conn);
                            const linkedAccounts = accountsByItem.get(conn.item_id) || [];
                            const linkedInvestments = investmentsByItem.get(conn.item_id) || [];
                            const isSyncing = syncingItemId === conn.item_id;
                            const isDeleting = deletingItemId === conn.item_id;

                            const totalBalance = linkedAccounts.reduce(
                                (acc, curr) => acc + (curr.subtype !== "CREDIT_CARD" ? Number(curr.balance) || 0 : 0),
                                0
                            );

                            return (
                                <div
                                    key={conn.id || conn.item_id}
                                    className="p-5 rounded-2xl bg-gradient-to-b from-[#18181B] to-[#121215] border border-white/10 shadow-md flex flex-col justify-between gap-5 transition-all hover:border-white/20"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3.5">
                                            <BankLogo
                                                bank={inst.slug}
                                                logoUrl={conn.institution_logo_url}
                                                size="md"
                                            />
                                            <div>
                                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                                    {inst.name}
                                                </h3>
                                                <p className="text-xs text-slate-400">
                                                    {linkedAccounts.length} conta(s) • {linkedInvestments.length} investimento(s)
                                                </p>
                                            </div>
                                        </div>

                                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            {conn.status || "Ativo"}
                                        </span>
                                    </div>

                                    {/* Resumo Financeiro da Instituição */}
                                    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                        <div>
                                            <span className="text-[11px] text-slate-500 block">Saldo em Contas</span>
                                            <span className="text-sm font-semibold text-white font-mono">
                                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalBalance)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[11px] text-slate-500 block">Última Sincronização</span>
                                            <span className="text-xs text-slate-300">
                                                {conn.updated_at ? new Date(conn.updated_at).toLocaleDateString("pt-BR") : "Recente"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Ações */}
                                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                                        <button
                                            onClick={() => handleSyncItem(conn.item_id)}
                                            disabled={isSyncing || isDeleting}
                                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                                        >
                                            {isSyncing ? (
                                                <>
                                                    <Spinner size={12} />
                                                    <span>Sincronizando...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-[15px]">sync</span>
                                                    <span>Sincronizar</span>
                                                </>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => handleDisconnectItem(conn)}
                                            disabled={isDeleting || isSyncing}
                                            className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                                        >
                                            {isDeleting ? (
                                                <>
                                                    <Spinner size={12} className="text-red-500" />
                                                    <span>Revogando...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-[15px]">link_off</span>
                                                    <span>Desconectar</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-10 text-center bg-[#12161F] rounded-2xl border border-white/5 flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-4xl text-slate-500">account_balance</span>
                        <h3 className="text-base font-bold text-white">Nenhum banco ou cartão conectado</h3>
                        <p className="text-xs text-slate-400 max-w-sm">
                            Conecte sua instituição financeira para que a Kitsune IA analise seus saldos e faturas automaticamente.
                        </p>
                        <button
                            onClick={handleAddConnection}
                            disabled={isLoadingToken}
                            className="mt-2 px-5 py-2.5 bg-[#FF8216] hover:bg-[#FFA047] text-black rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
                        >
                            <span className="material-symbols-outlined text-[16px]">add_link</span>
                            <span>Conectar Instituição Agora</span>
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
}
