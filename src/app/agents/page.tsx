"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Spinner from "@/components/Spinner";
import { useFinanceData } from "@/context/FinanceDataContext";

const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((mod) => mod.PluggyConnect),
  { ssr: false }
);

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
      `Deseja desconectar "${institutionLabel}"?\n\nIsso removerá a conexão na Pluggy e excluirá em cascata todas as contas e transações associadas a este vínculo.`
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

      // Atualização otimista imediata no estado global + revalidação
      removeConnectionLocal(conn.item_id);
      setSuccess(`Conexão com "${institutionLabel}" removida com sucesso.`);
      revalidate(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingItemId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 max-w-6xl mx-auto w-full">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-white/5 pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold font-sans text-gray-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-kitsune">hub</span>
            Conexões Bancárias (Open Finance)
          </h1>
          <p className="text-gray-500 dark:text-white/50 text-sm font-sans">
            Gerencie suas instituições conectadas com isolamento multi-tenant estrito e revogação em cascata.
          </p>
        </div>

        <button
          onClick={handleAddConnection}
          disabled={isLoadingToken}
          className="h-11 px-5 flex items-center justify-center gap-2 bg-kitsune text-white rounded-full font-sans text-sm font-bold hover:bg-kitsune/90 transition-colors shadow-md shadow-kitsune/20 disabled:opacity-70 cursor-pointer self-start md:self-auto"
        >
          {isLoadingToken ? (
            <Spinner size={18} className="text-white" />
          ) : (
            <span className="material-symbols-outlined text-[18px]">add_link</span>
          )}
          <span>{isLoadingToken ? "Gerando Token..." : "Conectar Nova Instituição"}</span>
        </button>
      </header>

      {error && (
        <div className="text-sm font-sans text-red-500 bg-red-50 dark:bg-red-500/10 p-4 rounded-2xl border border-red-200 dark:border-red-500/20 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline ml-4 cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {success && (
        <div className="text-sm font-sans text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 p-4 rounded-2xl border border-green-200 dark:border-green-500/20 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-xs underline ml-4 cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {connectToken && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
          <PluggyConnect
            connectToken={connectToken}
            selectedConnectorId={200}
            connectorIds={[200]}
            includeSandbox={false}
            onSuccess={handlePluggySuccess}
            onError={(err) => {
              setError(err?.message || "Erro no widget Pluggy");
              setConnectToken(null);
            }}
            onClose={() => setConnectToken(null)}
          />
        </div>
      )}

      {/* Listagem de Instituições Conectadas do Usuário Autenticado */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold font-sans text-gray-900 dark:text-white">
            Instituições Vinculadas ({connections.length})
          </h2>
          <span className="text-xs text-gray-400 font-sans">
            Protegido por Row Level Security (auth.uid)
          </span>
        </div>

        {isInitialLoading && connections.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <Spinner size={28} className="text-kitsune" />
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
                    year: "numeric",
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
                  className="flex flex-col justify-between bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm hover:border-kitsune/30 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-kitsune/10 flex items-center justify-center text-kitsune">
                        <span className="material-symbols-outlined">account_balance</span>
                      </div>
                      <span
                        className={`px-2.5 py-1 text-[10px] font-sans font-bold uppercase tracking-wider rounded-full flex items-center gap-1 ${
                          isConnected
                            ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
                            : isError
                            ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                            : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/70"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isConnected
                              ? "bg-green-500"
                              : isError
                              ? "bg-red-500"
                              : "bg-gray-400"
                          }`}
                        />
                        {isConnected ? "Sincronizado" : isError ? "Erro" : conn.status}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold font-sans text-gray-900 dark:text-white mb-1">
                      {institutionName}
                    </h3>

                    <p className="text-xs font-sans text-gray-500 dark:text-white/50 mb-3">
                      {linkedAccounts.length > 0
                        ? `${linkedAccounts.length} produto(s) financeiro(s) vinculado(s)`
                        : "Vínculo Open Finance ativo"}
                    </p>

                    {linkedAccounts.length > 0 && (
                      <div className="flex flex-col gap-1.5 mb-4 p-3 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
                        {linkedAccounts.map((acc) => (
                          <div
                            key={acc.id}
                            className="flex items-center justify-between text-xs font-sans"
                          >
                            <span className="text-gray-600 dark:text-white/70 truncate max-w-[160px]">
                              {acc.type === "CREDIT" || acc.type === "CREDIT_CARD"
                                ? "Cartão de Crédito"
                                : "Conta Corrente"}
                            </span>
                            <span className="font-mono font-semibold text-gray-900 dark:text-white">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: acc.currency || "BRL",
                              }).format(Number(acc.balance) || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col gap-1 text-[11px] font-sans text-gray-400 dark:text-white/40 mb-5">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        <span>Última atualização: {lastUpdatedFormatted}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">fingerprint</span>
                        <span className="font-mono truncate">Item: {conn.item_id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ações: Atualizar e Desconectar / Excluir */}
                  <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex items-center gap-2">
                    <button
                      onClick={() => handleManualSync(conn)}
                      disabled={isSyncing || isDeleting}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-800 dark:text-white text-xs font-sans font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isSyncing ? (
                        <>
                          <Spinner size={14} className="text-kitsune" />
                          <span>Sincronizando...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">refresh</span>
                          <span>Sincronizar</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDisconnectItem(conn)}
                      disabled={isDeleting || isSyncing}
                      className="py-2.5 px-3.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-sans font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Desconectar na Pluggy e excluir dados locais em cascata"
                    >
                      {isDeleting ? (
                        <Spinner size={14} className="text-red-500" />
                      ) : (
                        <span className="material-symbols-outlined text-[16px]">link_off</span>
                      )}
                      <span>{isDeleting ? "Excluindo..." : "Desconectar / Excluir"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-10 text-center text-gray-500 font-sans bg-white dark:bg-[#121212] rounded-3xl border border-gray-100 dark:border-white/5 flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-white/20">
              account_balance
            </span>
            <p className="font-semibold text-gray-800 dark:text-white">
              Nenhuma instituição conectada no momento.
            </p>
            <p className="text-xs text-gray-400 max-w-md">
              Clique em &ldquo;Conectar Nova Instituição&rdquo; acima para vincular seu banco via Open Finance.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
