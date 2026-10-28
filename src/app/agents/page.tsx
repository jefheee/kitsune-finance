"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import Spinner from "@/components/Spinner";
import { useFinanceData } from "@/context/FinanceDataContext";

const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((mod) => mod.PluggyConnect),
  { ssr: false }
);

interface BankTile {
  id: string;
  name: string;
  shortName: string;
  badge?: string;
  color: string;
  bgGradient: string;
  iconName: string;
}

const POPULAR_BANKS: BankTile[] = [
  { id: "nubank", name: "Nubank", shortName: "Nu", badge: "Mais Popular", color: "#8A05BE", bgGradient: "from-purple-900/20 to-purple-800/10", iconName: "credit_card" },
  { id: "itau", name: "Itaú Unibanco", shortName: "Itaú", color: "#EC7000", bgGradient: "from-orange-950/20 to-amber-900/10", iconName: "account_balance" },
  { id: "bradesco", name: "Bradesco", shortName: "Bradesco", color: "#CC092F", bgGradient: "from-red-950/20 to-rose-900/10", iconName: "account_balance" },
  { id: "bb", name: "Banco do Brasil", shortName: "BB", color: "#0038A8", bgGradient: "from-blue-950/20 to-sky-900/10", iconName: "account_balance" },
  { id: "santander", name: "Santander", shortName: "Santander", color: "#EC0000", bgGradient: "from-red-950/20 to-orange-900/10", iconName: "account_balance" },
  { id: "inter", name: "Banco Inter", shortName: "Inter", badge: "0 Tarifas", color: "#FF7A00", bgGradient: "from-amber-950/20 to-orange-900/10", iconName: "bolt" },
  { id: "c6", name: "C6 Bank", shortName: "C6", color: "#2E2E2E", bgGradient: "from-neutral-800/20 to-neutral-700/10", iconName: "credit_card" },
  { id: "btg", name: "BTG Pactual", shortName: "BTG", badge: "Investimentos", color: "#001E62", bgGradient: "from-blue-950/20 to-indigo-900/10", iconName: "trending_up" },
];

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

  // Agrupa contas por item_id para exibir o nome real da instituição (ex: Nubank) e quantidade de produtos vinculados
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

  const resolveDisplayInstitution = (conn: any) => {
    const linkedAccounts = accountsByItem.get(conn.item_id) || [];
    const rawProvider = (conn.provider_name || "").trim();

    if (
      rawProvider &&
      rawProvider.toLowerCase() !== "pluggy" &&
      rawProvider.toLowerCase() !== "meu pluggy" &&
      rawProvider.toLowerCase() !== "instituição conectada"
    ) {
      return rawProvider;
    }

    const bankAcc = linkedAccounts.find(
      (a) =>
        a.bank_name &&
        (a.bank_name.toLowerCase().includes("nu pagamentos") ||
          a.bank_name.toLowerCase().includes("nubank"))
    );
    if (bankAcc) return "Nubank";

    const primaryAcc = linkedAccounts.find((a) => a.type === "BANK") || linkedAccounts[0];
    if (primaryAcc?.bank_name) {
      return primaryAcc.bank_name;
    }

    return rawProvider || "Instituição Conectada";
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
          providerName: conn.provider_name,
          familyMemberId: conn.family_member_id || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao sincronizar conexão");
      }

      setSuccess(
        `Sincronização concluída: ${data.accountsSynced} conta(s) e ${data.transactionsSynced} transação(ões) atualizadas.`
      );
      await revalidate(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncingItemId(null);
    }
  };

  const handleDisconnectItem = async (conn: any) => {
    const institutionLabel = resolveDisplayInstitution(conn);
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

  const totalProducts = accounts.length;

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 max-w-6xl mx-auto w-full font-sans">
      {/* Header com Design Warm Obsidian */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-100 dark:border-[#263042]">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-[#FF6B00]/10 text-[#FF6B00] border border-[#FF6B00]/20">
              Open Finance Brasil
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Regulado pelo Bacen
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-[#FF6B00]/10 flex items-center justify-center text-[#FF6B00] border border-[#FF6B00]/20">
              <span className="material-symbols-outlined text-2xl">account_balance</span>
            </span>
            Conexões Bancárias
          </h1>
          <p className="text-sm text-gray-500 dark:text-white/60 max-w-2xl">
            Sincronização automática e leitura regulamentada pelo Banco Central. Seus saldos e extratos consolidados com segurança e privacidade total.
          </p>
        </div>

        <button
          onClick={handleAddConnection}
          disabled={isLoadingToken}
          className="h-12 px-6 flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#FF6B00] to-[#E05300] hover:from-[#FF7A1A] hover:to-[#FF6B00] text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-[#FF6B00]/20 active:scale-95 disabled:opacity-70 cursor-pointer self-start md:self-auto shrink-0"
        >
          {isLoadingToken ? (
            <Spinner size={18} className="text-white" />
          ) : (
            <span className="material-symbols-outlined text-[20px]">add_link</span>
          )}
          <span>{isLoadingToken ? "Iniciando Open Finance..." : "Conectar Nova Instituição"}</span>
        </button>
      </header>

      {/* Alertas de Notificação */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-red-500 bg-red-500/10 p-4 rounded-2xl border border-red-500/20 flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-red-500">error</span>
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-xs font-bold text-red-500 hover:underline ml-4 cursor-pointer"
            >
              Fechar
            </button>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-emerald-400 bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-emerald-400">check_circle</span>
              <span>{success}</span>
            </div>
            <button
              onClick={() => setSuccess(null)}
              className="text-xs font-bold text-emerald-400 hover:underline ml-4 cursor-pointer"
            >
              Fechar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Widget Modal Pluggy Connect */}
      {connectToken && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#141A24] rounded-3xl overflow-hidden shadow-2xl border border-gray-100 dark:border-[#263042]">
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

      {/* Security Assurance Banner (3 Pilares de Confiança) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-3xl bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-[#141A24] dark:via-[#171F2C] dark:to-[#141A24] border border-gray-100 dark:border-[#263042]">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <span className="material-symbols-outlined text-[20px]">lock</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              100% Somente-Leitura
            </h4>
            <p className="text-[12px] text-gray-500 dark:text-white/60 leading-relaxed">
              Apenas leitura de saldos e extratos. Nenhuma transação ou pagamento é permitido pelo sistema.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5 border-t md:border-t-0 md:border-l border-gray-100 dark:border-white/5 pt-3 md:pt-0 md:pl-4">
          <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/10 text-[#FF6B00] flex items-center justify-center shrink-0 border border-[#FF6B00]/20">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Regulação Bacen
            </h4>
            <p className="text-[12px] text-gray-500 dark:text-white/60 leading-relaxed">
              Operamos via Open Finance oficial do Banco Central (Resolução BCB nº 1/2020) com consentimento revogável.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5 border-t md:border-t-0 md:border-l border-gray-100 dark:border-white/5 pt-3 md:pt-0 md:pl-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 border border-blue-500/20">
            <span className="material-symbols-outlined text-[20px]">shield</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Criptografia de Ponta
            </h4>
            <p className="text-[12px] text-gray-500 dark:text-white/60 leading-relaxed">
              Tráfego TLS 1.3 blindado e isolamento estrito de dados. Suas senhas nunca passam por nossos servidores.
            </p>
          </div>
        </div>
      </section>

      {/* KPI Metrics Bar */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#141A24] border border-gray-100 dark:border-[#263042] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 dark:text-white/50 uppercase tracking-wider">
              Instituições Ativas
            </span>
            <div className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1 tabular-nums">
              {connections.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-600 dark:text-white/70">
            <span className="material-symbols-outlined">hub</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#141A24] border border-gray-100 dark:border-[#263042] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 dark:text-white/50 uppercase tracking-wider">
              Produtos & Contas
            </span>
            <div className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1 tabular-nums">
              {totalProducts}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-600 dark:text-white/70">
            <span className="material-symbols-outlined">credit_score</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#141A24] border border-gray-100 dark:border-[#263042] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 dark:text-white/50 uppercase tracking-wider">
              Status da Conexão
            </span>
            <div className="text-sm font-bold text-emerald-500 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Rede Operacional
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
            <span className="material-symbols-outlined">wifi_protected_setup</span>
          </div>
        </div>
      </section>

      {/* Listagem de Instituições Vinculadas */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Suas Instituições Vinculadas
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/70">
              {connections.length}
            </span>
          </div>
          <span className="text-xs text-gray-400 dark:text-white/40 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">shield</span>
            Privacidade Blindada
          </span>
        </div>

        {isInitialLoading && connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-[#141A24] rounded-3xl border border-gray-100 dark:border-[#263042] gap-3">
            <Spinner size={32} className="text-[#FF6B00]" />
            <p className="text-xs text-gray-400 dark:text-white/50 font-medium">
              Carregando conexões do Open Finance...
            </p>
          </div>
        ) : connections.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {connections.map((conn) => {
              const institutionName = resolveDisplayInstitution(conn);
              const linkedAccounts = accountsByItem.get(conn.item_id) || [];
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
                  className="flex flex-col justify-between bg-white dark:bg-[#141A24] border border-gray-100 dark:border-[#263042] rounded-3xl p-6 shadow-sm hover:border-[#FF6B00]/40 transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#FF6B00]/10 flex items-center justify-center text-[#FF6B00] border border-[#FF6B00]/20 group-hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-2xl">account_balance</span>
                      </div>
                      <span
                        className={`px-3 py-1 text-[11px] font-bold rounded-full flex items-center gap-1.5 ${
                          isConnected
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : isError
                            ? "bg-red-500/10 text-red-500 border border-red-500/20"
                            : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/70"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isConnected
                              ? "bg-emerald-500"
                              : isError
                              ? "bg-red-500"
                              : "bg-gray-400"
                          }`}
                        />
                        {isConnected ? "Sincronizado" : isError ? "Requer Atenção" : conn.status}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                      {institutionName}
                    </h3>

                    <p className="text-xs text-gray-500 dark:text-white/50 mb-4">
                      {linkedAccounts.length > 0
                        ? `${linkedAccounts.length} produto(s) monitorado(s)`
                        : "Vínculo Open Finance ativo"}
                    </p>

                    {linkedAccounts.length > 0 && (
                      <div className="flex flex-col gap-2 mb-4 p-3.5 rounded-2xl bg-gray-50 dark:bg-[#0F141C] border border-gray-100 dark:border-[#263042]/60">
                        {linkedAccounts.map((acc) => (
                          <div
                            key={acc.id}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-gray-600 dark:text-white/70 truncate max-w-[160px] flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[15px] text-[#FF6B00]">
                                {acc.type === "CREDIT" || acc.type === "CREDIT_CARD"
                                  ? "credit_card"
                                  : "account_balance_wallet"}
                              </span>
                              {acc.type === "CREDIT" || acc.type === "CREDIT_CARD"
                                ? "Cartão de Crédito"
                                : "Conta Corrente"}
                            </span>
                            <span className="font-bold tabular-nums text-gray-900 dark:text-white">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: acc.currency || "BRL",
                              }).format(Number(acc.balance) || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 text-[11px] text-gray-400 dark:text-white/40 mb-5">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        <span>Última atualização: {lastUpdatedFormatted}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">verified</span>
                        <span>Vínculo seguro: •••• {conn.item_id?.slice(-6) || "ativo"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="pt-4 border-t border-gray-100 dark:border-[#263042] flex items-center gap-2">
                    <button
                      onClick={() => handleManualSync(conn)}
                      disabled={isSyncing || isDeleting}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-800 dark:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isSyncing ? (
                        <>
                          <Spinner size={14} className="text-[#FF6B00]" />
                          <span>Atualizando...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">refresh</span>
                          <span>Atualizar</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDisconnectItem(conn)}
                      disabled={isDeleting || isSyncing}
                      className="py-2.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Revogar acesso e remover dados"
                    >
                      {isDeleting ? (
                        <Spinner size={14} className="text-red-500" />
                      ) : (
                        <span className="material-symbols-outlined text-[16px]">link_off</span>
                      )}
                      <span>{isDeleting ? "Revogando..." : "Desconectar"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center bg-white dark:bg-[#141A24] rounded-3xl border border-gray-100 dark:border-[#263042] flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-[#FF6B00]/10 flex items-center justify-center text-[#FF6B00] border border-[#FF6B00]/20">
              <span className="material-symbols-outlined text-3xl">account_balance</span>
            </div>
            <div className="flex flex-col gap-1 max-w-md">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Nenhum banco ou cartão conectado
              </h3>
              <p className="text-xs text-gray-500 dark:text-white/60 leading-relaxed">
                Conecte seu primeiro banco abaixo para que a Kitsune AI analise seus saldos, faturas e fluxo de caixa automaticamente.
              </p>
            </div>
            <button
              onClick={handleAddConnection}
              disabled={isLoadingToken}
              className="mt-2 h-11 px-6 bg-[#FF6B00] hover:bg-[#E05300] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-[#FF6B00]/20 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_link</span>
              <span>Conectar Instituição Agora</span>
            </button>
          </div>
        )}
      </section>

      {/* Instituições Homologadas (Quick Bank Grid) */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Instituições Homologadas no Open Finance
          </h2>
          <p className="text-xs text-gray-500 dark:text-white/50">
            Selecione seu banco para iniciar a conexão segura com 1 clique:
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {POPULAR_BANKS.map((b) => (
            <button
              key={b.id}
              onClick={handleAddConnection}
              disabled={isLoadingToken}
              className="p-4 rounded-2xl bg-white dark:bg-[#141A24] hover:bg-gray-50 dark:hover:bg-[#171F2C] border border-gray-100 dark:border-[#263042] hover:border-[#FF6B00]/40 transition-all flex flex-col items-start justify-between gap-3 text-left group cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-xs shadow-sm transition-transform group-hover:scale-105"
                  style={{
                    backgroundColor: `${b.color}20`,
                    color: b.color,
                    border: `1px solid ${b.color}40`,
                  }}
                >
                  {b.shortName}
                </div>
                {b.badge && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF6B00]/10 text-[#FF6B00] border border-[#FF6B00]/20">
                    {b.badge}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-[#FF6B00] transition-colors">
                  {b.name}
                </span>
                <span className="material-symbols-outlined text-[16px] text-gray-400 group-hover:text-[#FF6B00] group-hover:translate-x-0.5 transition-all">
                  arrow_forward
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* FAQ & Segurança Accordion */}
      <section className="flex flex-col gap-3 rounded-3xl bg-white dark:bg-[#141A24] border border-gray-100 dark:border-[#263042] p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-[#FF6B00]">help_outline</span>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            Perguntas Frequentes sobre Privacidade & Open Finance
          </h3>
        </div>

        <div className="flex flex-col divide-y divide-gray-100 dark:divide-[#263042]">
          {SECURITY_FAQS.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div key={idx} className="py-3.5 first:pt-0 last:pb-0">
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 text-left font-semibold text-xs md:text-sm text-gray-800 dark:text-white/90 hover:text-[#FF6B00] dark:hover:text-[#FF6B00] transition-colors cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <span className="material-symbols-outlined text-[18px] shrink-0 text-gray-400 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                    expand_more
                  </span>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-gray-500 dark:text-white/60 leading-relaxed mt-2.5 pr-6"
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
