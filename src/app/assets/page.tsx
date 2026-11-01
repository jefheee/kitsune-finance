"use client";

import React, { useState, useMemo } from "react";
import { useFinanceData } from "@/context/FinanceDataContext";
import { AssetModal } from "@/components/assets/AssetModal";
import { VehicleFipeSelector } from "@/components/assets/VehicleFipeSelector";
import { LandValuationCard } from "@/components/assets/LandValuationCard";
import { FgtsCalculatorCard } from "@/components/assets/FgtsCalculatorCard";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";
import type { CustomAsset } from "@/types/finance";
import { calculateVehicleDepreciation } from "@/utils/finance/engine/fipe";
import { calculateModelACapitalGain, calculateModelBIndexCorrection } from "@/utils/finance/engine/land-valuation";
import { simulateFgtsProjection } from "@/utils/finance/engine/fgts";

type AssetsTab = "all" | "vehicles" | "real_estate" | "fgts";

export default function AssetsPage() {
  const {
    customAssets,
    isPrivacyMode,
    formatSensitiveCurrency,
  } = useFinanceData();

  const [activeTab, setActiveTab] = useState<AssetsTab>("all");
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [selectedAssetToEdit, setSelectedAssetToEdit] = useState<CustomAsset | null>(null);

  // Filtros por categoria
  const vehicleAssets = useMemo(
    () => customAssets.filter((a) => a.category === "vehicle"),
    [customAssets]
  );
  const realEstateAssets = useMemo(
    () => customAssets.filter((a) => a.category === "land" || a.category === "real_estate"),
    [customAssets]
  );
  const fgtsAssets = useMemo(
    () => customAssets.filter((a) => a.category === "fgts"),
    [customAssets]
  );
  const otherAssets = useMemo(
    () => customAssets.filter((a) => a.category === "other"),
    [customAssets]
  );

  // Totais determinísticos
  const vehiclesTotal = useMemo(
    () => vehicleAssets.reduce((sum, a) => sum + (Number(a.current_value) || 0), 0),
    [vehicleAssets]
  );
  const realEstateTotal = useMemo(
    () => realEstateAssets.reduce((sum, a) => sum + (Number(a.current_value) || 0), 0),
    [realEstateAssets]
  );
  const fgtsTotal = useMemo(
    () => fgtsAssets.reduce((sum, a) => sum + (Number(a.current_value) || 0), 0),
    [fgtsAssets]
  );
  const totalPhysicalAssets = useMemo(
    () => customAssets.reduce((sum, a) => sum + (Number(a.current_value) || 0), 0),
    [customAssets]
  );

  const formatCurrency = (val: number) => {
    if (isPrivacyMode) return "R$ ••••••";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* CABEÇALHO DO MÓDULO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#27272A] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF8216]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF8216]">
              Patrimônio Imobilizado & Físico
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F4F4F5] mt-1">
            Ativos Físicos, FIPE & Imóveis
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Veículos com FIPE ao vivo, FGTS determinístico Caixa e radar geográfico de terrenos (Modelos A, B e C).
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedAssetToEdit(null);
            setIsAssetModalOpen(true);
          }}
          className="h-9 px-4 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] text-black text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-[#FF8216]/20 shrink-0"
        >
          <WfIcons.Plus size={16} />
          <span>Novo Ativo</span>
        </button>
      </div>

      {/* 4 CARDS DE KPI WEALTHFOLIO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Consolidado */}
        <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Patrimônio Físico Total
          </span>
          <div className="text-lg sm:text-xl font-bold text-white tabular-nums">
            {formatCurrency(totalPhysicalAssets)}
          </div>
          <span className="text-[11px] text-zinc-500 block">
            {customAssets.length} {customAssets.length === 1 ? "ativo cadastrado" : "ativos cadastrados"}
          </span>
        </div>

        {/* Veículos FIPE */}
        <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
              Veículos (FIPE)
            </span>
            <span className="text-xs">🚗</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-white tabular-nums">
            {formatCurrency(vehiclesTotal)}
          </div>
          <span className="text-[11px] text-zinc-500 block">
            {vehicleAssets.length} {vehicleAssets.length === 1 ? "veículo monitorado" : "veículos monitorados"}
          </span>
        </div>

        {/* Imóveis & Terrenos */}
        <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              Imóveis & Terrenos
            </span>
            <span className="text-xs">🏢</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-white tabular-nums">
            {formatCurrency(realEstateTotal)}
          </div>
          <span className="text-[11px] text-zinc-500 block">
            {realEstateAssets.length} {realEstateAssets.length === 1 ? "propriedade" : "propriedades"} (Radar 2km)
          </span>
        </div>

        {/* FGTS Caixa */}
        <div className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">
              FGTS Caixa (CLT)
            </span>
            <span className="text-xs">🏛️</span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-white tabular-nums">
            {formatCurrency(fgtsTotal)}
          </div>
          <span className="text-[11px] text-zinc-500 block">
            Correção TR + 3% a.a.
          </span>
        </div>
      </div>

      {/* SELETOR DE ABAS TEMÁTICAS */}
      <div className="flex items-center gap-2 border-b border-[#27272A] pb-3 overflow-x-auto">
        {(
          [
            { id: "all", label: "Todos os Ativos", count: customAssets.length },
            { id: "vehicles", label: "🚗 Veículos FIPE", count: vehicleAssets.length },
            { id: "real_estate", label: "🏢 Imóveis & Terrenos", count: realEstateAssets.length },
            { id: "fgts", label: "🏛️ FGTS Caixa", count: fgtsAssets.length },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                active
                  ? "bg-[#FF8216] text-black shadow-md shadow-[#FF8216]/20 font-bold"
                  : "bg-[#18181B] text-zinc-400 hover:text-white hover:bg-[#27272A]"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  active ? "bg-black/20 text-black" : "bg-[#27272A] text-zinc-400"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* EMPTY STATE ELEGANTE CASO NÃO HAJA ATIVOS */}
      {customAssets.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-2xl bg-[#121214] border border-[#27272A] text-center space-y-6">
          <div className="max-w-md mx-auto space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#FF8216]/10 border border-[#FF8216]/20 text-[#FF8216] flex items-center justify-center mx-auto text-xl">
              📦
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Nenhum ativo físico cadastrado ainda
            </h3>
            <p className="text-xs text-zinc-400">
              Monitore a depreciação do seu carro pela FIPE ao vivo, calcule a valorização do seu terreno com radar de serviços em 2km e projete seu FGTS.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto pt-2">
            <button
              type="button"
              onClick={() => {
                setSelectedAssetToEdit(null);
                setIsAssetModalOpen(true);
              }}
              className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-[#FF8216]/60 text-left transition-all cursor-pointer group"
            >
              <span className="text-xl block mb-1">🚗</span>
              <h4 className="text-xs font-bold text-white group-hover:text-[#FF8216] transition-colors">
                Cadastrar Veículo
              </h4>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Busca de preço automático na Tabela FIPE oficial.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedAssetToEdit(null);
                setIsAssetModalOpen(true);
              }}
              className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-[#FF8216]/60 text-left transition-all cursor-pointer group"
            >
              <span className="text-xl block mb-1">📐</span>
              <h4 className="text-xs font-bold text-white group-hover:text-[#FF8216] transition-colors">
                Cadastrar Terreno / Imóvel
              </h4>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Radar geográfico 2km com cálculo de IRPF e IPCA.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedAssetToEdit(null);
                setIsAssetModalOpen(true);
              }}
              className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-[#FF8216]/60 text-left transition-all cursor-pointer group"
            >
              <span className="text-xl block mb-1">🏛️</span>
              <h4 className="text-xs font-bold text-white group-hover:text-[#FF8216] transition-colors">
                Cadastrar Conta FGTS
              </h4>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Projeção Caixa TR+3% e poder real de Fisher.
              </p>
            </button>
          </div>
        </div>
      ) : (
        /* CONTEÚDO DAS ABAS */
        <div className="space-y-4">
          {/* ABA: TODOS OS ATIVOS */}
          {activeTab === "all" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customAssets.map((asset) => {
                const curPrice = Number(asset.current_value) || 0;
                const acqPrice = Number(asset.acquisition_value) || 0;
                const delta = curPrice - acqPrice;
                const deltaPct = acqPrice > 0 ? (delta / acqPrice) * 100 : 0;

                const icon =
                  asset.category === "vehicle"
                    ? "🚗"
                    : asset.category === "land"
                      ? "📐"
                      : asset.category === "real_estate"
                        ? "🏢"
                        : asset.category === "fgts"
                          ? "🏛️"
                          : "📦";

                const categoryLabel =
                  asset.category === "vehicle"
                    ? "Veículo (FIPE)"
                    : asset.category === "land"
                      ? "Terreno"
                      : asset.category === "real_estate"
                        ? "Imóvel"
                        : asset.category === "fgts"
                          ? "FGTS Caixa"
                          : "Outro";

                return (
                  <div
                    key={asset.id}
                    onClick={() => {
                      setSelectedAssetToEdit(asset);
                      setIsAssetModalOpen(true);
                    }}
                    className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] hover:border-[#FF8216]/40 transition-all cursor-pointer space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#18181B] border border-[#27272A] text-lg flex items-center justify-center shrink-0">
                          {icon}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF8216] block">
                            {categoryLabel}
                          </span>
                          <h4 className="text-sm font-bold text-white truncate">{asset.name}</h4>
                          <span className="text-[11px] text-zinc-400 block truncate">
                            {asset.category === "vehicle"
                              ? `Ano ${asset.metadata?.model_year || ""} • FIPE: ${asset.metadata?.fipe_code || "BrasilAPI"}`
                              : asset.category === "land" || asset.category === "real_estate"
                                ? `${asset.metadata?.area_m2 ? `${asset.metadata.area_m2} m² • ` : ""}${asset.metadata?.city || ""}`
                                : asset.category === "fgts"
                                  ? `${asset.metadata?.company_name || "Vínculo CLT"}`
                                  : "Ativo alternativo"}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm sm:text-base font-bold text-white tabular-nums block">
                          {formatCurrency(curPrice)}
                        </span>
                        {acqPrice > 0 && asset.category !== "fgts" && (
                          <span
                            className={`text-[10px] font-semibold tabular-nums ${
                              delta >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {delta >= 0 ? "+" : ""}
                            {deltaPct.toFixed(1).replace(".", ",")}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rodapé com badges informativos */}
                    <div className="pt-2 border-t border-[#27272A]/70 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>
                        {asset.acquisition_date
                          ? `Adquirido em ${asset.acquisition_date}`
                          : "Valor de avaliação atualizado"}
                      </span>
                      {asset.metadata?.radar_score !== undefined && (
                        <span className="text-[#FF8216] font-semibold">
                          Radar {String(asset.metadata.radar_score)}/100
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ABA: VEÍCULOS (FIPE AO VIVO) */}
          {activeTab === "vehicles" && (
            <div className="space-y-4">
              {vehicleAssets.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 bg-[#121214] rounded-2xl border border-[#27272A]">
                  Nenhum veículo cadastrado. Clique em &quot;Novo Ativo&quot; para consultar a FIPE ao vivo.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vehicleAssets.map((veh) => {
                    const curPrice = Number(veh.current_value) || 0;
                    const acqPrice = Number(veh.acquisition_value) || 0;
                    const dep = calculateVehicleDepreciation(
                      acqPrice,
                      veh.acquisition_date,
                      curPrice
                    );

                    return (
                      <div
                        key={veh.id}
                        onClick={() => {
                          setSelectedAssetToEdit(veh);
                          setIsAssetModalOpen(true);
                        }}
                        className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] hover:border-[#FF8216]/50 transition-all cursor-pointer space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">
                              Tabela FIPE Oficial
                            </span>
                            <h4 className="text-sm font-bold text-white">{veh.name}</h4>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              Ano {veh.metadata?.model_year || ""} • {veh.metadata?.fuel || "Gasolina"}
                              {veh.metadata?.license_plate
                                ? ` • Placa: ${veh.metadata.license_plate}`
                                : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm sm:text-base font-bold text-white tabular-nums block">
                              {formatCurrency(curPrice)}
                            </span>
                            <span className="text-[10px] text-zinc-500 block">
                              Custo: {formatCurrency(acqPrice)}
                            </span>
                          </div>
                        </div>

                        {/* Barra de Depreciação */}
                        <div className="p-2.5 bg-[#18181B] rounded-xl border border-[#27272A] flex items-center justify-between text-xs">
                          <span className="text-zinc-400 text-[11px]">Variação Anualizada:</span>
                          <span
                            className={`font-bold tabular-nums ${
                              dep.status === "appreciated"
                                ? "text-emerald-400"
                                : dep.status === "depreciated"
                                  ? "text-rose-400"
                                  : "text-zinc-300"
                            }`}
                          >
                            {dep.annualizedVariationPct >= 0 ? "+" : ""}
                            {dep.annualizedVariationPct.toFixed(2).replace(".", ",")}% a.a.
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ABA: TERRENOS & IMÓVEIS (MODELOS A, B E C) */}
          {activeTab === "real_estate" && (
            <div className="space-y-4">
              {realEstateAssets.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 bg-[#121214] rounded-2xl border border-[#27272A]">
                  Nenhum imóvel ou terreno cadastrado. Clique em &quot;Novo Ativo&quot; para escanear a infraestrutura via OpenStreetMap em 2km.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {realEstateAssets.map((re) => {
                    const curPrice = Number(re.current_value) || 0;
                    const acqPrice = Number(re.acquisition_value) || 0;
                    const modelA = calculateModelACapitalGain(acqPrice, curPrice);
                    const modelB = calculateModelBIndexCorrection(acqPrice, re.acquisition_date);

                    return (
                      <div
                        key={re.id}
                        onClick={() => {
                          setSelectedAssetToEdit(re);
                          setIsAssetModalOpen(true);
                        }}
                        className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] hover:border-[#FF8216]/50 transition-all cursor-pointer space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                              {re.category === "land" ? "Terreno / Lote" : "Imóvel Urbano"}
                            </span>
                            <h4 className="text-sm font-bold text-white">{re.name}</h4>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              {re.metadata?.area_m2 ? `${re.metadata.area_m2} m² • ` : ""}
                              {re.metadata?.street ? `${re.metadata.street}, ` : ""}
                              {re.metadata?.city || "Brasil"}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm sm:text-base font-bold text-white tabular-nums block">
                              {formatCurrency(curPrice)}
                            </span>
                            <span className="text-[10px] text-zinc-500 block">
                              Líquido IRPF: {formatCurrency(modelA.netLiquidProceeds)}
                            </span>
                          </div>
                        </div>

                        {/* Comparativo Modelos A, B e C */}
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div className="p-2 bg-[#18181B] rounded-lg border border-[#27272A] text-center">
                            <span className="text-[9px] text-zinc-500 uppercase block">Ganho IRPF</span>
                            <span className="text-xs font-semibold text-emerald-400 tabular-nums">
                              +{formatCurrency(modelA.grossCapitalGain)}
                            </span>
                          </div>

                          <div className="p-2 bg-[#18181B] rounded-lg border border-[#27272A] text-center">
                            <span className="text-[9px] text-zinc-500 uppercase block">IPCA Acum.</span>
                            <span className="text-xs font-semibold text-blue-400 tabular-nums">
                              {formatCurrency(modelB.correctedValueIPCA)}
                            </span>
                          </div>

                          <div className="p-2 bg-[#18181B] rounded-lg border border-[#27272A] text-center">
                            <span className="text-[9px] text-zinc-500 uppercase block">Radar 2km</span>
                            <span className="text-xs font-bold text-[#FF8216] tabular-nums">
                              {String(re.metadata?.radar_score ?? 75)}/100
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ABA: FGTS CAIXA (CLT) */}
          {activeTab === "fgts" && (
            <div className="space-y-4">
              {fgtsAssets.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 bg-[#121214] rounded-2xl border border-[#27272A]">
                  Nenhuma conta vinculada do FGTS cadastrada. Clique em &quot;Novo Ativo&quot; para simular sua projeção oficial Caixa.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fgtsAssets.map((fg) => {
                    const curPrice = Number(fg.current_value) || 0;
                    const salary = Number(fg.metadata?.gross_salary) || 8000;
                    const sim = simulateFgtsProjection(curPrice, salary, 12);

                    return (
                      <div
                        key={fg.id}
                        onClick={() => {
                          setSelectedAssetToEdit(fg);
                          setIsAssetModalOpen(true);
                        }}
                        className="p-4 rounded-2xl bg-[#121214] border border-[#27272A] hover:border-[#FF8216]/50 transition-all cursor-pointer space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                              Caixa Econômica Federal
                            </span>
                            <h4 className="text-sm font-bold text-white">{fg.name}</h4>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              {fg.metadata?.company_name || "CLT Ativo"} • Salário Base: {formatCurrency(salary)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm sm:text-base font-bold text-white tabular-nums block">
                              {formatCurrency(curPrice)}
                            </span>
                            <span className="text-[10px] text-emerald-400 font-semibold block">
                              +8% mensal: {formatCurrency(salary * 0.08)}
                            </span>
                          </div>
                        </div>

                        <div className="p-2.5 bg-[#18181B] rounded-xl border border-[#27272A] flex items-center justify-between text-xs">
                          <span className="text-zinc-400 text-[11px]">Projeção 12 meses (TR+3%):</span>
                          <span className="font-bold text-purple-300 tabular-nums">
                            {formatCurrency(sim.finalNominalBalance)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE ATIVOS */}
      <AssetModal
        isOpen={isAssetModalOpen}
        onClose={() => {
          setIsAssetModalOpen(false);
          setSelectedAssetToEdit(null);
        }}
        assetToEdit={selectedAssetToEdit}
      />
    </div>
  );
}
