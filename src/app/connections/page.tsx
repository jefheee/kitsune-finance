"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Spinner from "@/components/Spinner";
import { BankLogo } from "@/components/BankLogo";
import { getBankCatalogBySlugOrName } from "@/utils/pluggy/bank-resolver";
import { useFinanceData } from "@/context/FinanceDataContext";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";

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
    formatSensitiveCurrency,
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

  const sortedConnections = useMemo(() => {
    return [...connections].sort((a, b) => {
      const aAccs = accountsByItem.get(a.item_id) || [];
      const bAccs = accountsByItem.get(b.item_id) || [];
      const aInvs = investmentsByItem.get(a.item_id) || [];
      const bInvs = investmentsByItem.get(b.item_id) || [];

      const aTotal =
        aAccs.reduce(
          (s, acc) => s + (acc.subtype !== "CREDIT_CARD" ? Number(acc.balance) || 0 : 0),
          0
        ) + aInvs.reduce((s, inv) => s + (Number(inv.balance) || 0), 0);
      const bTotal =
        bAccs.reduce(
          (s, acc) => s + (acc.subtype !== "CREDIT_CARD" ? Number(acc.balance) || 0 : 0),
          0
        ) + bInvs.reduce((s, inv) => s + (Number(inv.balance) || 0), 0);

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
      await revalidate(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncingItemId(null);
    }
  };

  const handleDisconnectItem = async (conn: any) => {
    const inst = resolveDisplayInstitution(conn);
    if (
      !confirm(
        `Deseja revogar o acesso do ${inst.name}? Seus dados sincronizados serão removidos.`
      )
    ) {
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
      await revalidate(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingItemId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-7 pb-28 md:pb-10 max-w-[1380px] mx-auto w-full font-sans">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-[#27272A]">
        <div>
          <div className="flex items-center gap-2">
            <WfIcons.Connections className="w-5 h-5 text-[#E11D48]" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-[#F4F4F5]">
              Conexões Bancárias & Open Finance Brasil
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Gerencie consentimentos regulados pelo BACEN com sincronização em tempo real e criptografia ponta a ponta.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddConnection}
          disabled={isLoadingToken}
          className="h-9 px-4 rounded-xl bg-white hover:bg-zinc-200 active:bg-zinc-300 text-black font-semibold text-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer self-start md:self-auto"
        >
          {isLoadingToken ? (
            <>
              <Spinner size={14} />
              <span>Iniciando...</span>
            </>
          ) : (
            <>
              <WfIcons.Plus className="w-3.5 h-3.5" />
              <span>Conectar Nova Instituição</span>
            </>
          )}
        </button>
      </header>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-400">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400">
          {success}
        </div>
      )}

      {connectToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] rounded-2xl p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setConnectToken(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
            >
              <WfIcons.Close className="w-4 h-4" />
            </button>
            <h3 className="text-base font-bold text-zinc-900 dark:text-[#F4F4F5] mb-4">
              Conectar com Open Finance
            </h3>
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
                  await revalidate(true);
                } catch (e) {
                  console.error(e);
                }
              }}
              onError={() => {
                setError("Erro no processo de conexão do banco.");
                setConnectToken(null);
              }}
              onClose={() => setConnectToken(null)}
            />
          </div>
        </div>
      )}

      {/* Lista Densa Estilo Wealthfolio */}
      <section className="rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-[#27272A] flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Instituições Vinculadas ({sortedConnections.length})
          </h2>
          <span className="text-[11px] text-zinc-500">
            Ordenadas por volume sob custódia
          </span>
        </div>

        {isInitialLoading ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <Spinner size={22} />
            <span className="text-xs text-zinc-400">Carregando conexões...</span>
          </div>
        ) : sortedConnections.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center gap-3">
            <WfIcons.Connections className="w-8 h-8 text-zinc-500" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5]">
              Nenhuma instituição conectada
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm">
              Conecte seus bancos e corretoras para consolidar contas, cartões e investimentos automaticamente.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-[#27272A]">
            {sortedConnections.map((conn) => {
              const inst = resolveDisplayInstitution(conn);
              const linkedAccounts = accountsByItem.get(conn.item_id) || [];
              const linkedInvestments = investmentsByItem.get(conn.item_id) || [];
              const isSyncing = syncingItemId === conn.item_id;
              const isDeleting = deletingItemId === conn.item_id;

              const totalLiquidity = linkedAccounts.reduce(
                (acc, curr) =>
                  acc + (curr.subtype !== "CREDIT_CARD" ? Number(curr.balance) || 0 : 0),
                0
              );
              const totalInvested = linkedInvestments.reduce(
                (acc, curr) => acc + (Number(curr.balance) || 0),
                0
              );

              return (
                <div
                  key={conn.id || conn.item_id}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-[#18181B]/60 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <BankLogo
                      bank={inst.slug}
                      logoUrl={conn.institution_logo_url}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5] truncate">
                          {inst.name}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/12 text-emerald-400 border border-emerald-500/25">
                          {conn.status || "Ativo"}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {linkedAccounts.length} conta(s) • {linkedInvestments.length} posição(ões) • Sync{" "}
                        {conn.updated_at
                          ? new Date(conn.updated_at).toLocaleDateString("pt-BR")
                          : "Recente"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <div className="text-left sm:text-right font-mono tabular-nums">
                      <span className="text-sm font-bold text-zinc-900 dark:text-[#F4F4F5] block">
                        {formatSensitiveCurrency(totalLiquidity + totalInvested)}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        Total consolidado
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSyncItem(conn.item_id)}
                        disabled={isSyncing || isDeleting}
                        className="h-8 px-3 rounded-lg bg-zinc-100 dark:bg-[#18181B] hover:bg-zinc-200 dark:hover:bg-[#27272A] border border-zinc-200 dark:border-[#27272A] text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <WfIcons.RefreshCw
                          className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-[#E11D48]" : ""}`}
                        />
                        <span>{isSyncing ? "Sync..." : "Sync"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDisconnectItem(conn)}
                        disabled={isDeleting || isSyncing}
                        className="h-8 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-xs font-medium text-rose-400 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {isDeleting ? "Revogando..." : "Revogar"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
