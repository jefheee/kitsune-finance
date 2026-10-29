"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import Spinner from "@/components/Spinner";
import { BankLogo } from "@/components/BankLogo";
import { getBankCatalogBySlugOrName } from "@/utils/pluggy/bank-resolver";
import { useFinanceData } from "@/context/FinanceDataContext";

const PluggyConnect = dynamic(
    () => import("react-pluggy-connect").then((mod) => mod.PluggyConnect),
    { ssr: false }
);

const SECURITY_FAQS = [
    {
        question: "A Kitsune Finance pode realizar transferências ou movimentar meu dinheiro?",
        answer:
            "Absolutamente não. A integração com o Open Finance Brasil opera sob permissão restrita de somente-leitura. Nosso sistema não possui capacidade técnica, credenciais nem autorização bancária para movimentar fundos ou criar débitos.",
    },
    {
        question: "Minha senha ou chave de segurança do banco fica salva?",
        answer:
            "Nunca. Toda a autenticação é realizada diretamente no ambiente seguro do seu próprio banco (via aplicativo oficial ou biometria). A Kitsune recebe apenas um token criptografado temporário homologado pelo Banco Central.",
    },
    {
        question: "Como funciona a criptografia e isolamento das minhas contas?",
        answer:
            "Seus dados bancários e de cartões trafegam via conexões TLS 1.3 criptografadas e são armazenados com isolamento estrito de nível bancário (Row-Level Security). Nenhum outro usuário ou terceiro tem acesso aos seus extratos.",
    },
    {
        question: "Como revogar o acesso de uma instituição conectada?",
        answer:
            "Você tem controle absoluto. Ao clicar em 'Desconectar' em qualquer instituição listada, o token de acesso é revogado imediatamente na Pluggy e todos os dados de saldos e transações locais são eliminados.",
    },
];

export default function AgentsPage() {
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
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

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

        const fallbackCatalog = getBankCatalogBySlugOrName(conn.provider_name);
        return {
            name:
                fallbackCatalog.slug !== "generic"
                    ? fallbackCatalog.name
                    : "Instituição Conectada",
            slug: fallbackCatalog.slug,
        };
    };

    const handleAddConnection = async () => {
        setIsLoadingToken(true);
        setError(null);
        setSuccess(null);
        setConnectToken(null);

        try {
            const res = await fetch("/api/pluggy/connect-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Erro ao obter token de conexão");
            }

            setConnectToken(data.accessToken || data.connectToken);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoadingToken(false);
        }
    };

    const handlePluggySuccess = async (itemData: any) => {
        const itemId = itemData?.item?.id;
        const providerName = itemData?.item?.connector?.name || "Instituição Conectada";

        if (!itemId) {
            setError("ID do item não retornado pelo widget.");
            return;
        }

        try {
            setSyncingItemId(itemId);
            const res = await fetch("/api/pluggy/save-item", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    itemId,
                    providerName,
                }),
            });

            const saveData = await res.json();
            if (!res.ok) {
                throw new Error(saveData.error || "Falha ao salvar e sincronizar a conexão");
            }

            setConnectToken(null);
            setSuccess(
                `Instituição (${saveData.institutionName || providerName}) conectada e sincronizada com sucesso!`
            );
            await revalidate(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSyncingItemId(null);
        }
    };

    const handleManualSync = async (conn: any) => {
        setError(null);
        setSuccess(null);
        setSyncingItemId(conn.item_id);

        try {
            const res = await fetch("/api/pluggy/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    itemId: conn.item_id,
                    providerName: conn.institution_name || conn.provider_name,
                    familyMemberId: conn.family_member_id || null,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Erro ao sincronizar conexão");
            }

            setSuccess(
                `Sincronização concluída (${data.institutionName || "Banco"}): ${data.accountsSynced} conta(s) e ${data.transactionsSynced} transação(ões) conciliadas.`
            );
            await revalidate(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSyncingItemId(null);
        }
    };

    const handleDisconnectItem = async (conn: any) => {
        const { name: institutionLabel } = resolveDisplayInstitution(conn);
        const confirmed = window.confirm(
            `Deseja desconectar "${institutionLabel}"?\n\nIsso removerá a conexão oficial na Pluggy e excluirá em cascata todas as contas e transações associadas a este vínculo localmente.`
        );
        if (!confirmed) return;

        setError(null);
        setSuccess(null);
        setDeletingItemId(conn.item_id);

        try {
            const res = await fetch(`/api/pluggy/items/${encodeURIComponent(conn.item_id)}`, {
                method: "DELETE",
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Erro ao desconectar instituição");
            }

            removeConnectionLocal(conn.item_id);
            setSuccess(`Conexão com "${institutionLabel}" revogada e dados excluídos com sucesso.`);
            revalidate(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setDeletingItemId(null);
        }
    };

    const totalProducts = accounts.length + investments.length;

    return (
        <div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 max-w-6xl mx-auto w-full font-sans">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#262E3D]">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/20">
                            Open Finance Brasil
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Regulado pelo Bacen
                        </span>
                    </div>
                    <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[#FF8216] text-2xl">
                            account_balance
                        </span>
                        Conexões Bancárias
                    </h1>
                    <p className="text-xs md:text-sm text-slate-500 dark:text-[#94A3B8] max-w-2xl">
                        Sincronização automática e leitura regulamentada pelo Banco Central. Seus saldos, faturas, investimentos e perfil cadastral consolidados com segurança.
                    </p>
                </div>

                <button
                    onClick={handleAddConnection}
                    disabled={isLoadingToken}
                    className="h-11 px-5 flex items-center justify-center gap-2 bg-[#FF8216] hover:bg-[#FFA047] active:bg-[#E66E08] text-white rounded-xl font-bold text-xs transition-all shadow-sm disabled:opacity-70 cursor-pointer self-stretch sm:self-auto shrink-0"
                >
                    {isLoadingToken ? (
                        <Spinner size={16} className="text-white" />
                    ) : (
                        <span className="material-symbols-outlined text-[18px]">add_link</span>
                    )}
                    <span>
                        {isLoadingToken
                            ? "Iniciando Open Finance..."
                            : "Conectar Nova Instituição"}
                    </span>
                </button>
            </header>

            {/* Alertas */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 p-3.5 rounded-xl border border-red-500/20 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            <span>{error}</span>
                        </div>
                        <button
                            onClick={() => setError(null)}
                            className="text-xs font-bold hover:underline cursor-pointer"
                        >
                            Fechar
                        </button>
                    </motion.div>
                )}

                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-500/20 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">
                                check_circle
                            </span>
                            <span>{success}</span>
                        </div>
                        <button
                            onClick={() => setSuccess(null)}
                            className="text-xs font-bold hover:underline cursor-pointer"
                        >
                            Fechar
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Widget Modal Pluggy Connect */}
            {connectToken && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="relative w-full max-w-lg bg-white dark:bg-[#12161F] rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-[#262E3D]">
                        <PluggyConnect
                            connectToken={connectToken}
                            selectedConnectorId={200}
                            connectorIds={[200]}
                            includeSandbox={false}
                            onSuccess={handlePluggySuccess}
                            onError={(err) => {
                                setError(err?.message || "Erro no fluxo de autenticação Pluggy");
                                setConnectToken(null);
                            }}
                            onClose={() => setConnectToken(null)}
                        />
                    </div>
                </div>
            )}

            {/* Security Assurance Banner */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 md:p-5 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] shadow-xs">
                <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                        <span className="material-symbols-outlined text-[18px]">lock</span>
                    </div>
                    <div className="flex flex-col">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                            100% Somente-Leitura
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] leading-relaxed mt-0.5">
                            Apenas leitura de saldos e extratos. Nenhuma transação ou pagamento é permitido pelo sistema.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3 border-t md:border-t-0 md:border-l border-slate-100 dark:border-white/5 pt-3 md:pt-0 md:pl-4">
                    <div className="w-9 h-9 rounded-xl bg-[#FF8216]/10 text-[#FF8216] flex items-center justify-center shrink-0 border border-[#FF8216]/20">
                        <span className="material-symbols-outlined text-[18px]">verified_user</span>
                    </div>
                    <div className="flex flex-col">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                            Regulação Bacen
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] leading-relaxed mt-0.5">
                            Protocolo oficial do Open Finance Brasil (Resolução BCB nº 1/2020) com consentimento revogável.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3 border-t md:border-t-0 md:border-l border-slate-100 dark:border-white/5 pt-3 md:pt-0 md:pl-4">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1A202C] text-slate-600 dark:text-[#94A3B8] flex items-center justify-center shrink-0 border border-slate-200 dark:border-white/5">
                        <span className="material-symbols-outlined text-[18px]">shield</span>
                    </div>
                    <div className="flex flex-col">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                            Criptografia & RLS
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] leading-relaxed mt-0.5">
                            Tráfego blindado e isolamento estrito de dados (FORCE RLS). Suas credenciais nunca passam pelos nossos servidores.
                        </p>
                    </div>
                </div>
            </section>

            {/* Métricas Rápidas */}
            <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Instituições Ativas
                        </span>
                        <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                            {connections.length}
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1A202C] flex items-center justify-center text-slate-600 dark:text-[#94A3B8]">
                        <span className="material-symbols-outlined text-[18px]">hub</span>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Contas, Cartões & Títulos
                        </span>
                        <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                            {totalProducts}
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1A202C] flex items-center justify-center text-slate-600 dark:text-[#94A3B8]">
                        <span className="material-symbols-outlined text-[18px]">credit_score</span>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] col-span-2 sm:col-span-1 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Status da Conexão
                        </span>
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Rede Operacional
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <span className="material-symbols-outlined text-[18px]">
                            wifi_protected_setup
                        </span>
                    </div>
                </div>
            </section>

            {/* Listagem de Instituições Vinculadas */}
            <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                            Instituições Vinculadas
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-[#1A202C] text-slate-600 dark:text-slate-300">
                            {connections.length}
                        </span>
                    </div>
                </div>

                {isInitialLoading && connections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-[#12161F] rounded-2xl border border-slate-200 dark:border-[#262E3D] gap-2">
                        <Spinner size={24} className="text-[#FF8216]" />
                        <p className="text-xs text-slate-400 font-medium">
                            Carregando conexões do Open Finance...
                        </p>
                    </div>
                ) : connections.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {connections.map((conn) => {
                            const { name: institutionName, slug: institutionSlug } =
                                resolveDisplayInstitution(conn);
                            const linkedAccounts = accountsByItem.get(conn.item_id) || [];
                            const linkedInvestments = investmentsByItem.get(conn.item_id) || [];
                            const totalInvBalance = linkedInvestments.reduce(
                                (sum, inv) => sum + (Number(inv.balance) || 0),
                                0
                            );

                            const lastUpdatedRaw =
                                conn.updated_at ||
                                linkedAccounts[0]?.updated_at ||
                                conn.created_at;
                            const lastUpdatedFormatted = lastUpdatedRaw
                                ? new Date(lastUpdatedRaw).toLocaleString("pt-BR", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                  })
                                : "Recente";

                            const isConnected = conn.status === "CONNECTED";
                            const isError = conn.status === "ERROR";
                            const isDeleting = deletingItemId === conn.item_id;
                            const isSyncing = syncingItemId === conn.item_id;

                            return (
                                <div
                                    key={conn.id}
                                    className="flex flex-col justify-between bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] rounded-2xl p-5 shadow-xs hover:border-[#FF8216]/40 transition-all"
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <BankLogo bank={institutionSlug} size="lg" />
                                            <span
                                                className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full flex items-center gap-1.5 ${
                                                    isConnected
                                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                                        : isError
                                                          ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                                          : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/70"
                                                }`}
                                            >
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full ${
                                                        isConnected
                                                            ? "bg-emerald-500"
                                                            : isError
                                                              ? "bg-red-500"
                                                              : "bg-slate-400"
                                                    }`}
                                                />
                                                {isConnected
                                                    ? "Sincronizado"
                                                    : isError
                                                      ? "Atenção"
                                                      : conn.status}
                                            </span>
                                        </div>

                                        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-0.5">
                                            {institutionName}
                                        </h3>

                                        <p className="text-xs text-slate-500 dark:text-[#94A3B8] mb-3">
                                            {linkedAccounts.length} conta(s)/cartão(ões)
                                            {linkedInvestments.length > 0
                                                ? ` • ${linkedInvestments.length} investimento(s)`
                                                : ""}
                                        </p>

                                        {(linkedAccounts.length > 0 ||
                                            linkedInvestments.length > 0) && (
                                            <div className="flex flex-col gap-1.5 mb-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#0E121A] border border-slate-200/80 dark:border-[#262E3D]/80">
                                                {linkedAccounts.map((acc) => {
                                                    const isCredit =
                                                        acc.type === "CREDIT" ||
                                                        acc.subtype === "CREDIT_CARD";
                                                    return (
                                                        <div
                                                            key={acc.id}
                                                            className="flex items-center justify-between text-xs gap-2"
                                                        >
                                                            <span className="text-slate-600 dark:text-slate-300 truncate flex items-center gap-1.5">
                                                                <span className="material-symbols-outlined text-[14px] text-[#FF8216]">
                                                                    {isCredit
                                                                        ? "credit_card"
                                                                        : "account_balance_wallet"}
                                                                </span>
                                                                <span className="truncate">
                                                                    {acc.product_name ||
                                                                        acc.bank_name}
                                                                </span>
                                                            </span>
                                                            <span
                                                                className={`font-bold tabular-nums shrink-0 ${
                                                                    isCredit
                                                                        ? "text-[#FF8216]"
                                                                        : "text-slate-900 dark:text-white"
                                                                }`}
                                                            >
                                                                {new Intl.NumberFormat("pt-BR", {
                                                                    style: "currency",
                                                                    currency: acc.currency || "BRL",
                                                                }).format(
                                                                    Math.abs(
                                                                        Number(acc.balance) || 0
                                                                    )
                                                                )}
                                                            </span>
                                                        </div>
                                                    );
                                                })}

                                                {linkedInvestments.length > 0 && (
                                                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-white/5">
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[14px]">
                                                                trending_up
                                                            </span>
                                                            {linkedInvestments.length} CDB(s) / Títulos
                                                        </span>
                                                        <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                                            {new Intl.NumberFormat("pt-BR", {
                                                                style: "currency",
                                                                currency: "BRL",
                                                            }).format(totalInvBalance)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex flex-col gap-1 text-[11px] text-slate-400 mb-4">
                                            <div className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[13px]">
                                                    schedule
                                                </span>
                                                <span>Atualizado: {lastUpdatedFormatted}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ações */}
                                    <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center gap-2">
                                        <button
                                            onClick={() => handleManualSync(conn)}
                                            disabled={isSyncing || isDeleting}
                                            className="flex-1 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1A202C] dark:hover:bg-[#222A3A] text-slate-800 dark:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                                        >
                                            {isSyncing ? (
                                                <>
                                                    <Spinner size={12} className="text-[#FF8216]" />
                                                    <span>Atualizando...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-[15px]">
                                                        refresh
                                                    </span>
                                                    <span>Atualizar</span>
                                                </>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => handleDisconnectItem(conn)}
                                            disabled={isDeleting || isSyncing}
                                            className="py-2 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                                            title="Revogar acesso"
                                        >
                                            {isDeleting ? (
                                                <Spinner size={12} className="text-red-500" />
                                            ) : (
                                                <span className="material-symbols-outlined text-[15px]">
                                                    link_off
                                                </span>
                                            )}
                                            <span>
                                                {isDeleting ? "Excluindo..." : "Desconectar"}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-8 text-center bg-white dark:bg-[#12161F] rounded-2xl border border-slate-200 dark:border-[#262E3D] flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-3xl text-slate-400">
                            account_balance
                        </span>
                        <div className="flex flex-col gap-0.5 max-w-sm">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                Nenhum banco ou cartão conectado
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
                                Conecte sua instituição financeira para que a Kitsune IA analise seus saldos e faturas automaticamente.
                            </p>
                        </div>
                        <button
                            onClick={handleAddConnection}
                            disabled={isLoadingToken}
                            className="mt-1 h-10 px-5 bg-[#FF8216] hover:bg-[#FFA047] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-[16px]">add_link</span>
                            <span>Conectar Instituição Agora</span>
                        </button>
                    </div>
                )}
            </section>

            {/* FAQ & Segurança Accordion */}
            <section className="flex flex-col gap-3 rounded-2xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-[#262E3D] p-5 shadow-xs">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#FF8216]">help_outline</span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Perguntas Frequentes sobre Privacidade & Open Finance
                    </h3>
                </div>

                <div className="flex flex-col divide-y divide-slate-100 dark:divide-white/5">
                    {SECURITY_FAQS.map((faq, idx) => {
                        const isOpen = openFaqIndex === idx;
                        return (
                            <div key={idx} className="py-3 first:pt-1 last:pb-0">
                                <button
                                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                                    className="w-full flex items-center justify-between gap-3 text-left font-semibold text-xs md:text-sm text-slate-800 dark:text-slate-200 hover:text-[#FF8216] dark:hover:text-[#FF8216] transition-colors cursor-pointer"
                                >
                                    <span>{faq.question}</span>
                                    <span
                                        className="material-symbols-outlined text-[18px] shrink-0 text-slate-400 transition-transform duration-200"
                                        style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                                    >
                                        expand_more
                                    </span>
                                </button>
                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.p
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="text-xs text-slate-500 dark:text-[#94A3B8] leading-relaxed mt-2 pr-4"
                                        >
                                            {faq.answer}
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
