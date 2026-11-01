"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { BankLogo } from "@/components/BankLogo";
import { WfIcons } from "./WealthfolioIcons";
import type { CustomAsset } from "@/types/finance";

interface GroupedAccountsListProps {
  accounts: any[];
  investments: any[];
  loans: any[];
  customAssets?: CustomAsset[];
  formatCurrency: (val: number) => string;
  hideValues: boolean;
  onConnectBank?: () => void;
  onAddAsset?: () => void;
  onEditAsset?: (asset: CustomAsset) => void;
  monthlyCDIFactor?: number;
}

export function GroupedAccountsList({
  accounts,
  investments,
  loans,
  customAssets = [],
  formatCurrency,
  hideValues,
  onConnectBank,
  onAddAsset,
  onEditAsset,
  monthlyCDIFactor = 0.0085,
}: GroupedAccountsListProps) {
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    banking: true,
    investments: true,
    vehicles: true,
    real_estate: true,
    fgts: true,
    other: true,
    liabilities: true,
  });


  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const {
    bankAccounts,
    activeInvestments,
    creditAccounts,
    activeLoans,
    vehicleAssets,
    realEstateAssets,
    fgtsAssets,
    otherAssets,
    bankingTotal,
    investmentsTotal,
    vehiclesTotal,
    realEstateTotal,
    fgtsTotal,
    othersTotal,
    liabilitiesTotal,
    grossAssetsTotal,
    netWorthTotal,
  } = useMemo(() => {
    const bankAccs: any[] = [];
    const credAccs: any[] = [];
    let bTotal = 0;
    let cTotal = 0;

    for (const acc of accounts) {
      const bal = Number(acc.balance) || 0;
      const isCredit =
        acc.type === "CREDIT" ||
        acc.type === "CREDIT_CARD" ||
        acc.subtype === "CREDIT_CARD";
      if (isCredit) {
        credAccs.push(acc);
        cTotal += Math.abs(bal);
      } else {
        bankAccs.push(acc);
        bTotal += bal;
      }
    }

    const actInvs = investments
      .filter((i) => (Number(i.balance) || 0) > 0.05 && i.status !== "TOTAL_WITHDRAWAL")
      .sort((a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0));

    const iTotal = actInvs.reduce((s, i) => s + (Number(i.balance) || 0), 0);

    const actLoans = loans.filter((l) => (Number(l.outstanding_balance) || 0) > 0);
    const lTotal = actLoans.reduce((s, l) => s + (Number(l.outstanding_balance) || 0), 0);

    // Ativos Físicos e Imobilizados (Kitsune Engine)
    const vehAssets = (customAssets || []).filter((a) => a.category === "vehicle");
    const reAssets = (customAssets || []).filter(
      (a) => a.category === "land" || a.category === "real_estate"
    );
    const fgAssets = (customAssets || []).filter((a) => a.category === "fgts");
    const otAssets = (customAssets || []).filter((a) => a.category === "other");

    const vTotal = vehAssets.reduce((s, a) => s + (Number(a.current_value) || 0), 0);
    const reTotal = reAssets.reduce((s, a) => s + (Number(a.current_value) || 0), 0);
    const fgTotal = fgAssets.reduce((s, a) => s + (Number(a.current_value) || 0), 0);
    const otTotal = otAssets.reduce((s, a) => s + (Number(a.current_value) || 0), 0);
    const physicalTotal = vTotal + reTotal + fgTotal + otTotal;

    const liabTotal = cTotal + lTotal;
    const grossTotal = Math.max(0, bTotal) + iTotal + physicalTotal;

    return {
      bankAccounts: bankAccs.sort((a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0)),
      activeInvestments: actInvs,
      creditAccounts: credAccs.sort(
        (a, b) => Math.abs(Number(b.balance) || 0) - Math.abs(Number(a.balance) || 0)
      ),
      activeLoans: actLoans,
      vehicleAssets: vehAssets,
      realEstateAssets: reAssets,
      fgtsAssets: fgAssets,
      otherAssets: otAssets,
      bankingTotal: bTotal,
      investmentsTotal: iTotal,
      vehiclesTotal: vTotal,
      realEstateTotal: reTotal,
      fgtsTotal: fgTotal,
      othersTotal: otTotal,
      liabilitiesTotal: liabTotal,
      grossAssetsTotal: grossTotal,
      netWorthTotal: bTotal + iTotal + physicalTotal - liabTotal,
    };
  }, [accounts, investments, loans, customAssets]);

  // Agrupa investimentos por corretora/banco para densidade estilo Wealthfolio
  const investmentsByInstitution = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        slug: string;
        count: number;
        balance: number;
        topRate: string | null;
      }
    >();

    for (const inv of activeInvestments) {
      const name = inv.institution_name || inv.bank_name || inv.issuer || "Custódia";
      const slug = inv.institution_slug || name;
      const key = name.toLowerCase().trim();
      const bal = Number(inv.balance) || 0;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.balance += bal;
        if (!existing.topRate && inv.rate) {
          existing.topRate = `${inv.rate}% ${inv.rate_type || "CDI"}`;
        }
      } else {
        map.set(key, {
          key,
          name,
          slug,
          count: 1,
          balance: bal,
          topRate: inv.rate ? `${inv.rate}% ${inv.rate_type || "CDI"}` : null,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.balance - a.balance);
  }, [activeInvestments]);

  const bankingSharePct =
    grossAssetsTotal > 0 ? Math.max(0, (Math.max(0, bankingTotal) / grossAssetsTotal) * 100) : 0;
  const invSharePct =
    grossAssetsTotal > 0 ? Math.max(0, (investmentsTotal / grossAssetsTotal) * 100) : 0;
  const vehiclesSharePct =
    grossAssetsTotal > 0 ? Math.max(0, (vehiclesTotal / grossAssetsTotal) * 100) : 0;
  const realEstateSharePct =
    grossAssetsTotal > 0 ? Math.max(0, (realEstateTotal / grossAssetsTotal) * 100) : 0;
  const fgtsSharePct =
    grossAssetsTotal > 0 ? Math.max(0, (fgtsTotal / grossAssetsTotal) * 100) : 0;

  const totalPositionsCount =
    bankAccounts.length +
    activeInvestments.length +
    creditAccounts.length +
    activeLoans.length +
    vehicleAssets.length +
    realEstateAssets.length +
    fgtsAssets.length +
    otherAssets.length;

  const isEmpty = totalPositionsCount === 0;

  return (
    <section className="rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] overflow-hidden">
      {/* Header + View Mode Toggle + Action Buttons */}
      <div className="px-5 py-4 border-b border-zinc-100 dark:border-[#27272A] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Contas, Custódia & Patrimônio Total
          </h3>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
            {totalPositionsCount} posições consolidadas no balanço
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="inline-flex items-center rounded-lg bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grouped")}
              title="Visão Agrupada (Wealthfolio)"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === "grouped"
                  ? "bg-white dark:bg-[#27272A] text-[#FF8216]"
                  : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              <WfIcons.Layers size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("flat")}
              title="Lista Plana Ordenada"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === "flat"
                  ? "bg-white dark:bg-[#27272A] text-[#FF8216]"
                  : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              <WfIcons.List size={14} />
            </button>
          </div>

          {onAddAsset && (
            <button
              type="button"
              onClick={onAddAsset}
              title="Adicionar Veículo FIPE, Terreno/Imóvel ou FGTS"
              className="h-7 px-2.5 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-[#FF8216]/40 text-[#FF8216] text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <WfIcons.Plus size={13} />
              <span>Ativo Físico</span>
            </button>
          )}

          {onConnectBank && (
            <button
              type="button"
              onClick={onConnectBank}
              title="Conectar nova instituição via Open Finance"
              className="h-7 px-2.5 rounded-lg bg-[#FF8216] hover:bg-[#FFA047] text-black text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <WfIcons.Plus size={13} />
              <span className="hidden sm:inline">Conta</span>
            </button>
          )}
        </div>
      </div>

      {/* Slim Stacked Composition Bar (Wealthfolio Net Worth Bar) */}
      {grossAssetsTotal > 0 && (
        <div className="px-5 py-3 bg-zinc-50/70 dark:bg-[#18181B]/45 border-b border-zinc-100 dark:border-[#27272A]">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-[#27272A]">
            {invSharePct > 0 && (
              <div
                style={{ width: `${invSharePct}%` }}
                className="h-full bg-[#FF8216] transition-all duration-500"
                title={`Investimentos: ${invSharePct.toFixed(1)}%`}
              />
            )}
            {bankingSharePct > 0 && (
              <div
                style={{
                  width: `${bankingSharePct}%`,
                  marginLeft: invSharePct > 0 ? "2px" : "0px",
                }}
                className="h-full bg-emerald-500 transition-all duration-500"
                title={`Contas Bancárias: ${bankingSharePct.toFixed(1)}%`}
              />
            )}
            {vehiclesSharePct > 0 && (
              <div
                style={{
                  width: `${vehiclesSharePct}%`,
                  marginLeft: "2px",
                }}
                className="h-full bg-blue-500 transition-all duration-500"
                title={`Veículos: ${vehiclesSharePct.toFixed(1)}%`}
              />
            )}
            {realEstateSharePct > 0 && (
              <div
                style={{
                  width: `${realEstateSharePct}%`,
                  marginLeft: "2px",
                }}
                className="h-full bg-amber-500 transition-all duration-500"
                title={`Imóveis/Terrenos: ${realEstateSharePct.toFixed(1)}%`}
              />
            )}
            {fgtsSharePct > 0 && (
              <div
                style={{
                  width: `${fgtsSharePct}%`,
                  marginLeft: "2px",
                }}
                className="h-full bg-purple-500 transition-all duration-500"
                title={`FGTS: ${fgtsSharePct.toFixed(1)}%`}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Contas ({hideValues ? "••%" : `${bankingSharePct.toFixed(1)}%`})</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FF8216]" />
                <span>Investimentos ({hideValues ? "••%" : `${invSharePct.toFixed(1)}%`})</span>
              </span>
              {vehiclesSharePct > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Veículos ({hideValues ? "••%" : `${vehiclesSharePct.toFixed(1)}%`})</span>
                </span>
              )}
              {realEstateSharePct > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Imóveis ({hideValues ? "••%" : `${realEstateSharePct.toFixed(1)}%`})</span>
                </span>
              )}
              {fgtsSharePct > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>FGTS ({hideValues ? "••%" : `${fgtsSharePct.toFixed(1)}%`})</span>
                </span>
              )}
            </div>
            {liabilitiesTotal > 0 && (
              <span className="inline-flex items-center gap-1.5 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Passivos: -{formatCurrency(liabilitiesTotal)}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="p-8 text-center flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] flex items-center justify-center text-[#FF8216]">
            <WfIcons.Connections size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F5]">
              Nenhuma conta conectada neste escopo
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-xs">
              Vincule seus bancos e corretoras via Open Finance Brasil para consolidar seu balanço.
            </p>
          </div>
          {onConnectBank && (
            <button
              type="button"
              onClick={onConnectBank}
              className="mt-1 px-4 py-2 rounded-lg bg-[#FF8216] hover:bg-[#FFA047] text-black text-xs font-bold cursor-pointer"
            >
              Conectar Instituição
            </button>
          )}
        </div>
      ) : viewMode === "grouped" ? (
        <div className="divide-y divide-zinc-100 dark:divide-[#27272A]">
          {/* =================================================================
              GRUPO 1: CONTAS BANCÁRIAS (LIQUIDEZ)
             ================================================================= */}
          <div>
            <button
              type="button"
              onClick={() => toggleGroup("banking")}
              className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-[#18181B]/60 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <WfIcons.ChevronRight
                  size={15}
                  className={`text-zinc-400 shrink-0 transition-transform duration-200 ${
                    expandedGroups.banking ? "rotate-90" : ""
                  }`}
                />
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F5] truncate">
                  Contas Bancárias
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-500 dark:text-zinc-400">
                  {bankAccounts.length}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline text-xs text-zinc-400 tabular-nums">
                  {hideValues ? "••%" : `${bankingSharePct.toFixed(1)}%`}
                </span>
                <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-[#F4F4F5]">
                  {formatCurrency(bankingTotal)}
                </span>
              </div>
            </button>

            {expandedGroups.banking && bankAccounts.length > 0 && (
              <div className="bg-zinc-50/40 dark:bg-[#0E0E10] border-t border-zinc-100 dark:border-[#27272A]/70 divide-y divide-zinc-100 dark:divide-[#27272A]/50">
                {bankAccounts.map((acc) => {
                  const instName =
                    acc.institution_name || acc.bank_name || "Instituição";
                  const prodName = acc.product_name || acc.bank_name || "Conta Corrente";
                  const slug = acc.institution_slug || instName;
                  const bal = Number(acc.balance) || 0;
                  const isSavings = acc.subtype === "SAVINGS_ACCOUNT" || acc.type === "SAVINGS";

                  return (
                    <div
                      key={acc.id}
                      className="pl-10 pr-5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-100/60 dark:hover:bg-[#18181B]/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <BankLogo bank={slug} size="xs" />
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 block truncate">
                            {prodName}
                          </span>
                          <span className="text-[11px] text-zinc-500 block truncate">
                            {instName} • {isSavings ? "Poupança" : "Conta Corrente"}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm font-semibold tabular-nums text-zinc-900 dark:text-[#F4F4F5] shrink-0">
                        {formatCurrency(bal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* =================================================================
              GRUPO 2: INVESTIMENTOS & CORRETORAS
             ================================================================= */}
          <div>
            <button
              type="button"
              onClick={() => toggleGroup("investments")}
              className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-[#18181B]/60 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <WfIcons.ChevronRight
                  size={15}
                  className={`text-zinc-400 shrink-0 transition-transform duration-200 ${
                    expandedGroups.investments ? "rotate-90" : ""
                  }`}
                />
                <span className="w-2 h-2 rounded-full bg-[#FF8216] shrink-0" />
                <span className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F5] truncate">
                  Investimentos & Custódia
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-500 dark:text-zinc-400">
                  {activeInvestments.length}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline text-xs text-zinc-400 tabular-nums">
                  {hideValues ? "••%" : `${invSharePct.toFixed(1)}%`}
                </span>
                <span className="text-sm font-semibold tabular-nums text-emerald-500">
                  {formatCurrency(investmentsTotal)}
                </span>
              </div>
            </button>

            {expandedGroups.investments && investmentsByInstitution.length > 0 && (
              <div className="bg-zinc-50/40 dark:bg-[#0E0E10] border-t border-zinc-100 dark:border-[#27272A]/70 divide-y divide-zinc-100 dark:divide-[#27272A]/50">
                {investmentsByInstitution.map((inst) => {
                  const estYield = inst.balance * monthlyCDIFactor;
                  return (
                    <Link
                      key={inst.key}
                      href="/investments"
                      className="pl-10 pr-5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-100/60 dark:hover:bg-[#18181B]/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <BankLogo bank={inst.slug} size="xs" />
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 block truncate">
                            {inst.name}
                          </span>
                          <span className="text-[11px] text-zinc-500 block truncate">
                            {inst.count} ativo(s)
                            {inst.topRate ? ` • ${inst.topRate}` : ""}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs sm:text-sm font-semibold tabular-nums text-zinc-900 dark:text-[#F4F4F5] block">
                          {formatCurrency(inst.balance)}
                        </span>
                        <span className="text-[10px] font-medium tabular-nums text-emerald-500 block">
                          +{formatCurrency(estYield)}/mês
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* =================================================================
              GRUPO: VEÍCULOS (FIPE AO VIVO)
             ================================================================= */}
          {vehicleAssets.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => toggleGroup("vehicles")}
                className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-[#18181B]/60 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <WfIcons.ChevronRight
                    size={15}
                    className={`text-zinc-400 shrink-0 transition-transform duration-200 ${
                      expandedGroups.vehicles ? "rotate-90" : ""
                    }`}
                  />
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F5] truncate">
                    Veículos (FIPE ao Vivo)
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-500 dark:text-zinc-400">
                    {vehicleAssets.length}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-[#F4F4F5]">
                    {formatCurrency(vehiclesTotal)}
                  </span>
                </div>
              </button>

              {expandedGroups.vehicles && (
                <div className="bg-zinc-50/40 dark:bg-[#0E0E10] border-t border-zinc-100 dark:border-[#27272A]/70 divide-y divide-zinc-100 dark:divide-[#27272A]/50">
                  {vehicleAssets.map((veh) => {
                    const curPrice = Number(veh.current_value) || 0;
                    const acqPrice = Number(veh.acquisition_value) || 0;
                    const delta = curPrice - acqPrice;
                    const deltaPct = acqPrice > 0 ? (delta / acqPrice) * 100 : 0;
                    const fipeCode = veh.metadata?.fipe_code as string | undefined;
                    const year = veh.metadata?.model_year as number | undefined;

                    return (
                      <div
                        key={veh.id}
                        onClick={() => onEditAsset?.(veh)}
                        className="pl-10 pr-5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-100/60 dark:hover:bg-[#18181B]/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs shrink-0">
                            🚗
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 block truncate">
                              {veh.name}
                            </span>
                            <span className="text-[11px] text-zinc-500 block truncate">
                              {year ? `Ano ${year} • ` : ""}
                              {fipeCode ? `FIPE: ${fipeCode}` : "Cotação BrasilAPI"}
                              {acqPrice > 0 && (
                                <span
                                  className={`ml-1.5 font-semibold ${
                                    delta >= 0 ? "text-emerald-500" : "text-rose-400"
                                  }`}
                                >
                                  {deltaPct >= 0 ? "+" : ""}
                                  {deltaPct.toFixed(1).replace(".", ",")}%
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs sm:text-sm font-semibold tabular-nums text-zinc-900 dark:text-[#F4F4F5] shrink-0">
                          {formatCurrency(curPrice)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              GRUPO: IMÓVEIS & TERRENOS (MODELOS A, B E C)
             ================================================================= */}
          {realEstateAssets.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => toggleGroup("real_estate")}
                className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-[#18181B]/60 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <WfIcons.ChevronRight
                    size={15}
                    className={`text-zinc-400 shrink-0 transition-transform duration-200 ${
                      expandedGroups.real_estate ? "rotate-90" : ""
                    }`}
                  />
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F5] truncate">
                    Imóveis & Terrenos (Radar Local)
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-500 dark:text-zinc-400">
                    {realEstateAssets.length}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-[#F4F4F5]">
                    {formatCurrency(realEstateTotal)}
                  </span>
                </div>
              </button>

              {expandedGroups.real_estate && (
                <div className="bg-zinc-50/40 dark:bg-[#0E0E10] border-t border-zinc-100 dark:border-[#27272A]/70 divide-y divide-zinc-100 dark:divide-[#27272A]/50">
                  {realEstateAssets.map((re) => {
                    const curPrice = Number(re.current_value) || 0;
                    const area = re.metadata?.area_m2 as number | undefined;
                    const city = re.metadata?.city as string | undefined;
                    const state = re.metadata?.state as string | undefined;
                    const score = re.metadata?.radar_score as number | undefined;

                    return (
                      <div
                        key={re.id}
                        onClick={() => onEditAsset?.(re)}
                        className="pl-10 pr-5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-100/60 dark:hover:bg-[#18181B]/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-xs shrink-0">
                            {re.category === "land" ? "📐" : "🏢"}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 block truncate">
                              {re.name}
                            </span>
                            <span className="text-[11px] text-zinc-500 block truncate">
                              {area ? `${area} m² • ` : ""}
                              {city ? `${city}${state ? ` - ${state}` : ""}` : "Patrimônio Imobiliário"}
                              {score !== undefined && (
                                <span className="ml-1.5 px-1 py-0.2 rounded text-[9px] font-semibold bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/20">
                                  Radar {score}/100
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs sm:text-sm font-semibold tabular-nums text-zinc-900 dark:text-[#F4F4F5] shrink-0">
                          {formatCurrency(curPrice)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              GRUPO: FGTS CAIXA (CLT)
             ================================================================= */}
          {fgtsAssets.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => toggleGroup("fgts")}
                className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-[#18181B]/60 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <WfIcons.ChevronRight
                    size={15}
                    className={`text-zinc-400 shrink-0 transition-transform duration-200 ${
                      expandedGroups.fgts ? "rotate-90" : ""
                    }`}
                  />
                  <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                  <span className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F5] truncate">
                    FGTS (Caixa Econômica Federal)
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-500 dark:text-zinc-400">
                    {fgtsAssets.length}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-[#F4F4F5]">
                    {formatCurrency(fgtsTotal)}
                  </span>
                </div>
              </button>

              {expandedGroups.fgts && (
                <div className="bg-zinc-50/40 dark:bg-[#0E0E10] border-t border-zinc-100 dark:border-[#27272A]/70 divide-y divide-zinc-100 dark:divide-[#27272A]/50">
                  {fgtsAssets.map((fg) => {
                    const curPrice = Number(fg.current_value) || 0;
                    const comp = fg.metadata?.company_name as string | undefined;
                    const dep = fg.metadata?.monthly_deposit as number | undefined;

                    return (
                      <div
                        key={fg.id}
                        onClick={() => onEditAsset?.(fg)}
                        className="pl-10 pr-5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-100/60 dark:hover:bg-[#18181B]/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center text-xs shrink-0">
                            🏛️
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 block truncate">
                              {fg.name}
                            </span>
                            <span className="text-[11px] text-zinc-500 block truncate">
                              {comp || "Conta Vinculada"} • TR + 3% a.a.
                              {dep ? ` • Depósito 8%: ${formatCurrency(dep)}` : ""}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs sm:text-sm font-semibold tabular-nums text-zinc-900 dark:text-[#F4F4F5] shrink-0">
                          {formatCurrency(curPrice)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              GRUPO: OUTROS ATIVOS ALTERNATIVOS
             ================================================================= */}
          {otherAssets.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => toggleGroup("other")}
                className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-[#18181B]/60 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <WfIcons.ChevronRight
                    size={15}
                    className={`text-zinc-400 shrink-0 transition-transform duration-200 ${
                      expandedGroups.other ? "rotate-90" : ""
                    }`}
                  />
                  <span className="w-2 h-2 rounded-full bg-zinc-400 shrink-0" />
                  <span className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F5] truncate">
                    Outros Ativos Alternativos
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-500 dark:text-zinc-400">
                    {otherAssets.length}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-[#F4F4F5]">
                    {formatCurrency(othersTotal)}
                  </span>
                </div>
              </button>

              {expandedGroups.other && (
                <div className="bg-zinc-50/40 dark:bg-[#0E0E10] border-t border-zinc-100 dark:border-[#27272A]/70 divide-y divide-zinc-100 dark:divide-[#27272A]/50">
                  {otherAssets.map((ot) => {
                    const curPrice = Number(ot.current_value) || 0;
                    return (
                      <div
                        key={ot.id}
                        onClick={() => onEditAsset?.(ot)}
                        className="pl-10 pr-5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-100/60 dark:hover:bg-[#18181B]/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 flex items-center justify-center text-xs shrink-0">
                            📦
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 block truncate">
                              {ot.name}
                            </span>
                            <span className="text-[11px] text-zinc-500 block truncate">
                              {(ot.metadata?.notes as string) || "Ativo alternativo imobilizado"}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs sm:text-sm font-semibold tabular-nums text-zinc-900 dark:text-[#F4F4F5] shrink-0">
                          {formatCurrency(curPrice)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() => toggleGroup("liabilities")}
              className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-[#18181B]/60 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <WfIcons.ChevronRight
                  size={15}
                  className={`text-zinc-400 shrink-0 transition-transform duration-200 ${
                    expandedGroups.liabilities ? "rotate-90" : ""
                  }`}
                />
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <span className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F5] truncate">
                  Cartões & Passivos
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] text-zinc-500 dark:text-zinc-400">
                  {creditAccounts.length + activeLoans.length}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold tabular-nums text-rose-400">
                  {liabilitiesTotal > 0
                    ? `-${formatCurrency(liabilitiesTotal)}`
                    : formatCurrency(0)}
                </span>
              </div>
            </button>

            {expandedGroups.liabilities &&
              (creditAccounts.length > 0 || activeLoans.length > 0) && (
                <div className="bg-zinc-50/40 dark:bg-[#0E0E10] border-t border-zinc-100 dark:border-[#27272A]/70 divide-y divide-zinc-100 dark:divide-[#27272A]/50">
                  {creditAccounts.map((card) => {
                    const instName =
                      card.institution_name || card.bank_name || "Cartão";
                    const prodName =
                      card.product_name || card.bank_name || "Cartão de Crédito";
                    const slug = card.institution_slug || instName;
                    const invoice = Math.abs(Number(card.balance) || 0);
                    const limit = Number(card.credit_limit) || 0;
                    const utilPct = limit > 0 ? Math.min(100, Math.round((invoice / limit) * 100)) : 0;

                    return (
                      <Link
                        key={card.id}
                        href="/cards"
                        className="pl-10 pr-5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-100/60 dark:hover:bg-[#18181B]/60 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <BankLogo bank={slug} size="xs" />
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 block truncate">
                              {prodName}
                            </span>
                            <span className="text-[11px] text-zinc-500 block truncate">
                              {instName}
                              {limit > 0
                                ? ` • ${hideValues ? "••%" : `${utilPct}%`} do limite`
                                : " • Fatura aberta"}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs sm:text-sm font-semibold tabular-nums text-[#FF8216] block">
                            -{formatCurrency(invoice)}
                          </span>
                          {limit > 0 && (
                            <span className="text-[10px] text-zinc-500 tabular-nums block">
                              Lim: {formatCurrency(limit)}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}

                  {activeLoans.map((loan) => {
                    const instName = loan.institution_name || "Contrato";
                    const slug = loan.institution_slug || instName;
                    const outBal = Number(loan.outstanding_balance) || 0;
                    return (
                      <Link
                        key={loan.id}
                        href="/cards"
                        className="pl-10 pr-5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-100/60 dark:hover:bg-[#18181B]/60 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <BankLogo bank={slug} size="xs" />
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 block truncate">
                              {loan.product_name || "Empréstimo / Financiamento"}
                            </span>
                            <span className="text-[11px] text-zinc-500 block truncate">
                              {instName} • Saldo devedor
                            </span>
                          </div>
                        </div>
                        <span className="text-xs sm:text-sm font-semibold tabular-nums text-rose-400 shrink-0">
                          -{formatCurrency(outBal)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
      ) : (
        /* VISÃO EM LISTA PLANA DENSA (Flat Mode) */
        <div className="divide-y divide-zinc-100 dark:divide-[#27272A]">
          {[
            ...bankAccounts.map((a) => ({
              id: `acc-${a.id}`,
              title: a.product_name || a.bank_name || "Conta Bancária",
              sub: `${a.institution_name || a.bank_name || "Banco"} • Liquidez`,
              slug: a.institution_slug || a.institution_name || a.bank_name,
              amount: Number(a.balance) || 0,
              kind: "asset" as const,
            })),
            ...investmentsByInstitution.map((i) => ({
              id: `inv-${i.key}`,
              title: `${i.name} (${i.count} títulos)`,
              sub: `Investimentos${i.topRate ? ` • ${i.topRate}` : ""}`,
              slug: i.slug,
              amount: i.balance,
              kind: "investment" as const,
            })),
            ...creditAccounts.map((c) => ({
              id: `cc-${c.id}`,
              title: c.product_name || c.bank_name || "Cartão de Crédito",
              sub: `${c.institution_name || c.bank_name || "Cartão"} • Fatura`,
              slug: c.institution_slug || c.institution_name || c.bank_name,
              amount: -Math.abs(Number(c.balance) || 0),
              kind: "liability" as const,
            })),
            ...vehicleAssets.map((v) => ({
              id: `veh-${v.id}`,
              title: v.name,
              sub: `Veículo (FIPE)${v.metadata?.model_year ? ` • Ano ${v.metadata.model_year}` : ""}`,
              slug: "fipe",
              amount: Number(v.current_value) || 0,
              kind: "asset" as const,
              asset: v,
            })),
            ...realEstateAssets.map((r) => ({
              id: `re-${r.id}`,
              title: r.name,
              sub: `${r.category === "land" ? "Terreno" : "Imóvel"}${r.metadata?.area_m2 ? ` • ${r.metadata.area_m2}m²` : ""}${r.metadata?.radar_score ? ` • Radar ${r.metadata.radar_score}/100` : ""}`,
              slug: "real_estate",
              amount: Number(r.current_value) || 0,
              kind: "asset" as const,
              asset: r,
            })),
            ...fgtsAssets.map((f) => ({
              id: `fgts-${f.id}`,
              title: f.name,
              sub: `FGTS Caixa • ${f.metadata?.company_name || "CLT"}`,
              slug: "caixa",
              amount: Number(f.current_value) || 0,
              kind: "asset" as const,
              asset: f,
            })),
            ...otherAssets.map((o) => ({
              id: `ot-${o.id}`,
              title: o.name,
              sub: "Ativo Alternativo",
              slug: "generic",
              amount: Number(o.current_value) || 0,
              kind: "asset" as const,
              asset: o,
            })),
          ]
            .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
            .map((row) => (
              <div
                key={row.id}
                onClick={() => (row as any).asset && onEditAsset?.((row as any).asset)}
                className={`px-5 py-3 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-[#18181B]/60 transition-colors ${(row as any).asset ? "cursor-pointer" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BankLogo bank={row.slug} size="xs" />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-[#F4F4F5] block truncate">
                      {row.title}
                    </span>
                    <span className="text-[11px] text-zinc-500 block truncate">
                      {row.sub}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-xs sm:text-sm font-semibold tabular-nums shrink-0 ${
                    row.kind === "liability"
                      ? "text-rose-400"
                      : row.kind === "investment"
                        ? "text-emerald-500"
                        : "text-zinc-900 dark:text-[#F4F4F5]"
                  }`}
                >
                  {row.amount < 0
                    ? `-${formatCurrency(Math.abs(row.amount))}`
                    : formatCurrency(row.amount)}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Rodapé de Conciliação Contábil (= Patrimônio Líquido) — Fiel ao BreakdownTable do Wealthfolio */}
      {!isEmpty && (
        <div className="px-5 py-3.5 bg-zinc-50 dark:bg-[#18181B]/70 border-t border-zinc-200 dark:border-[#27272A] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-[#FF8216]/15 text-[#FF8216] font-mono text-xs font-bold flex items-center justify-center">
              =
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
              Patrimônio Líquido Consolidado
            </span>
          </div>
          <span className="text-sm sm:text-base font-bold tabular-nums text-zinc-900 dark:text-[#F4F4F5]">
            {formatCurrency(netWorthTotal)}
          </span>
        </div>
      )}
    </section>
  );
}
