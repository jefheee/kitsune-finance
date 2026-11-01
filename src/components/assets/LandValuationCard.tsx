"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  calculateModelACapitalGain,
  calculateModelBIndexCorrection,
  calculateRealEstateMarketMetrics,
  type ModelACapitalGainResult,
  type ModelBIndexCorrectionResult,
  type LandSurroundingsSummary,
  type RealEstateMarketMetrics,
} from "@/utils/finance/engine/land-valuation";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";

export type PropertySubtype = "house" | "apartment" | "land" | "commercial";

export interface LandFormData {
  name: string;
  category: "land" | "real_estate";
  subtype: PropertySubtype;
  areaSqm: number;
  postalCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  acquisitionDate: string;
  acquisitionValue: number;
  currentValue: number;
  radarScore: number;
  infrastructureClassification: string;
  attractivenessMultiplier: number;
  poiCounts: {
    transport: number;
    health: number;
    education: number;
    commerce: number;
    security: number;
    total: number;
  };
  marketMetrics?: RealEstateMarketMetrics;
}

interface LandValuationCardProps {
  initialData?: Partial<LandFormData>;
  onChange?: (
    data: LandFormData,
    modelA: ModelACapitalGainResult,
    modelB: ModelBIndexCorrectionResult,
    radarSummary: LandSurroundingsSummary | null
  ) => void;
  hideValues?: boolean;
}

export function LandValuationCard({
  initialData,
  onChange,
  hideValues = false,
}: LandValuationCardProps) {
  const [activeTab, setActiveTab] = useState<"custo" | "indices" | "radar">("custo");

  // Dados Cadastrais
  const [name, setName] = useState(initialData?.name || "");
  const [subtype, setSubtype] = useState<PropertySubtype>(
    initialData?.subtype || (initialData?.category === "land" ? "land" : "house")
  );
  const [areaSqm, setAreaSqm] = useState<number>(initialData?.areaSqm || 250);
  const [postalCode, setPostalCode] = useState(initialData?.postalCode || "");
  const [street, setStreet] = useState(initialData?.street || "");
  const [neighborhood, setNeighborhood] = useState(initialData?.neighborhood || "");
  const [city, setCity] = useState(initialData?.city || "");
  const [state, setState] = useState(initialData?.state || "");
  const [latitude, setLatitude] = useState<number | null>(initialData?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(initialData?.longitude ?? null);

  const [acquisitionDate, setAcquisitionDate] = useState(
    initialData?.acquisitionDate || "2021-01-15"
  );
  const [acquisitionValue, setAcquisitionValue] = useState<number>(
    initialData?.acquisitionValue || 250000
  );
  const [currentValue, setCurrentValue] = useState<number>(
    initialData?.currentValue || 380000
  );

  // Estado do Radar Overpass e Mercado Imobiliário
  const [radarSummary, setRadarSummary] = useState<LandSurroundingsSummary | null>(null);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isLoadingRadar, setIsLoadingRadar] = useState(false);
  const [radarError, setRadarError] = useState<string | null>(null);

  // Executa o radar de POIs e análise imobiliária
  const triggerRadarAnalysis = useCallback(
    async (lat: number, lng: number, uf = state, cityName = city) => {
      setIsLoadingRadar(true);
      setRadarError(null);

      try {
        const res = await fetch("/api/assets/radar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat,
            lng,
            radiusMeters: 2000,
            areaSqm,
            state: uf,
            city: cityName,
            propertyType: subtype,
          }),
        });

        if (!res.ok) {
          throw new Error("Não foi possível carregar a análise da região.");
        }

        const summary = (await res.json()) as LandSurroundingsSummary;
        setRadarSummary(summary);

        // Se o valor atual estimado estiver no padrão e o radar sugeriu preço de mercado
        if (summary.marketMetrics?.estimatedTotalMarketValue && (!currentValue || currentValue === 380000)) {
          setCurrentValue(summary.marketMetrics.estimatedTotalMarketValue);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro no radar geográfico";
        setRadarError(msg);
      } finally {
        setIsLoadingRadar(false);
      }
    },
    [areaSqm, state, city, subtype, currentValue]
  );

  // Consulta CEP via BrasilAPI v2 (com coordenadas geográficas)
  const handleCepLookup = useCallback(
    async (cepInput: string) => {
      const cleanCep = cepInput.replace(/\D/g, "");
      if (cleanCep.length !== 8) return;

      setIsLoadingCep(true);
      setRadarError(null);

      try {
        const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
        if (!res.ok) {
          throw new Error("CEP não encontrado.");
        }
        const data = await res.json();

        if (data.street) setStreet(data.street);
        if (data.neighborhood) setNeighborhood(data.neighborhood);
        if (data.city) setCity(data.city);
        if (data.state) setState(data.state);

        if (!name.trim()) {
          const autoName = `${subtype === "land" ? "Terreno" : subtype === "apartment" ? "Apartamento" : "Casa"} ${data.neighborhood || data.city || ""}`.trim();
          setName(autoName);
        }

        if (data.location?.coordinates?.latitude && data.location?.coordinates?.longitude) {
          const lat = parseFloat(data.location.coordinates.latitude);
          const lng = parseFloat(data.location.coordinates.longitude);
          setLatitude(lat);
          setLongitude(lng);

          triggerRadarAnalysis(lat, lng, data.state, data.city);
        }
      } catch (err: unknown) {
        console.warn("[LandValuation] Falha no CEP:", err);
      } finally {
        setIsLoadingCep(false);
      }
    },
    [name, subtype, triggerRadarAnalysis]
  );

  // Modelos Determinísticos A e B
  const modelA = useMemo(() => {
    return calculateModelACapitalGain(acquisitionValue, currentValue);
  }, [acquisitionValue, currentValue]);

  const modelB = useMemo(() => {
    return calculateModelBIndexCorrection(acquisitionValue, acquisitionDate);
  }, [acquisitionValue, acquisitionDate]);

  // Métricas do mercado imobiliário regional (FipeZAP)
  const localMarketMetrics = useMemo(() => {
    const mult = radarSummary?.attractivenessMultiplier ?? 1.15;
    return calculateRealEstateMarketMetrics(areaSqm, state, city, subtype, mult);
  }, [areaSqm, state, city, subtype, radarSummary]);

  // Sincronização com o componente pai
  useEffect(() => {
    if (!onChange) return;
    const cat = subtype === "land" ? "land" : "real_estate";
    const payload: LandFormData = {
      name: name.trim() || (subtype === "land" ? "Terreno" : "Imóvel Residencial"),
      category: cat,
      subtype,
      areaSqm,
      postalCode,
      street,
      neighborhood,
      city,
      state,
      latitude,
      longitude,
      acquisitionDate,
      acquisitionValue,
      currentValue,
      radarScore: radarSummary?.score ?? initialData?.radarScore ?? 75,
      infrastructureClassification:
        radarSummary?.classification ??
        initialData?.infrastructureClassification ??
        "Região consolidada",
      attractivenessMultiplier:
        radarSummary?.attractivenessMultiplier ??
        initialData?.attractivenessMultiplier ??
        1.15,
      poiCounts: {
        transport: radarSummary?.categoryBreakdown.transport.count || 0,
        health: radarSummary?.categoryBreakdown.health.count || 0,
        education: radarSummary?.categoryBreakdown.education.count || 0,
        commerce: radarSummary?.categoryBreakdown.commerce.count || 0,
        security: radarSummary?.categoryBreakdown.security.count || 0,
        total: radarSummary?.totalPoisFound || 0,
      },
      marketMetrics: radarSummary?.marketMetrics || localMarketMetrics,
    };
    onChange(payload, modelA, modelB, radarSummary);
  }, [
    name,
    subtype,
    areaSqm,
    postalCode,
    street,
    neighborhood,
    city,
    state,
    latitude,
    longitude,
    acquisitionDate,
    acquisitionValue,
    currentValue,
    radarSummary,
    localMarketMetrics,
    modelA,
    modelB,
    initialData,
    onChange,
  ]);

  const formatCurrency = (val: number) => {
    if (hideValues) return "R$ ••••••";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  return (
    <div className="space-y-4 text-zinc-100 font-sans">
      {/* 1. NOME E SUBTIPO DO IMÓVEL */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
          Subtipo do Imóvel
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#18181B] p-1 rounded-xl border border-[#27272A]">
          {(
            [
              { id: "house", label: "Casa" },
              { id: "apartment", label: "Apartamento" },
              { id: "land", label: "Terreno / Lote" },
              { id: "commercial", label: "Comercial / Sala" },
            ] as const
          ).map((t) => {
            const active = subtype === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubtype(t.id)}
                className={`py-2 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center ${
                  active
                    ? "bg-[#FF8216] text-black shadow-xs font-bold"
                    : "text-zinc-400 hover:text-white hover:bg-[#27272A]/40"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Nome ou Identificação do Bem
          </label>
          <input
            type="text"
            placeholder="Ex: Apartamento Jardins, Terreno Lote 12"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#FF8216]"
          />
        </div>
      </div>

      {/* 2. LOCALIZAÇÃO E CEP INTELIGENTE (SEM TRUNCAMENTO) */}
      <div className="p-4 bg-[#18181B] border border-[#27272A] rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-zinc-200">
            Localização & Endereço
          </span>
          {isLoadingCep && (
            <span className="text-[11px] text-[#FF8216] animate-pulse">
              Buscando endereço pelo CEP...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
              CEP
            </label>
            <input
              type="text"
              maxLength={9}
              placeholder="01452-000"
              value={postalCode}
              onChange={(e) => {
                const val = e.target.value;
                setPostalCode(val);
                if (val.replace(/\D/g, "").length === 8) {
                  handleCepLookup(val);
                }
              }}
              className="w-full bg-[#121214] border border-[#27272A] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#FF8216] font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
              Bairro & Cidade
            </label>
            <input
              type="text"
              placeholder="Bairro, Cidade - UF"
              value={neighborhood ? `${neighborhood}, ${city} - ${state}` : city}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="w-full bg-[#121214] border border-[#27272A] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#FF8216]"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
            Logradouro / Rua
          </label>
          <input
            type="text"
            placeholder="Avenida / Rua / Número"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            className="w-full bg-[#121214] border border-[#27272A] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#FF8216]"
          />
        </div>

        {latitude && longitude && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-[#27272A]/70 gap-1.5">
            <span>
              Coordenadas: <span className="font-mono text-zinc-300">{latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
            </span>
            <button
              type="button"
              onClick={() => triggerRadarAnalysis(latitude, longitude)}
              disabled={isLoadingRadar}
              className="text-[#FF8216] hover:underline font-semibold cursor-pointer disabled:opacity-50 self-start sm:self-auto"
            >
              {isLoadingRadar ? "Consultando serviços..." : "Atualizar Radar 2km"}
            </button>
          </div>
        )}
      </div>

      {/* 3. METRAGEM & VALORES DE AQUISIÇÃO / ATUAL */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Área Total (m²)
          </label>
          <input
            type="number"
            step="1"
            placeholder="250"
            value={areaSqm || ""}
            onChange={(e) => setAreaSqm(parseFloat(e.target.value) || 0)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white tabular-nums outline-none focus:border-[#FF8216]"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Valor de Compra (Pago)
          </label>
          <input
            type="number"
            step="5000"
            placeholder="250000"
            value={acquisitionValue || ""}
            onChange={(e) => setAcquisitionValue(parseFloat(e.target.value) || 0)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white tabular-nums outline-none focus:border-[#FF8216]"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Valor Atual Estimado
          </label>
          <input
            type="number"
            step="5000"
            placeholder="380000"
            value={currentValue || ""}
            onChange={(e) => setCurrentValue(parseFloat(e.target.value) || 0)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white tabular-nums outline-none focus:border-[#FF8216]"
          />
        </div>
      </div>

      {/* 4. ABAS DE ANÁLISE PATRIMONIAL */}
      <div className="pt-1">
        <div className="flex items-center gap-1.5 border-b border-[#27272A] pb-2 overflow-x-auto scrollbar-none">
          {(
            [
              { id: "custo", label: "Valor Contábil & IRPF" },
              { id: "indices", label: "Correção por Inflação" },
              { id: "radar", label: "Radar de Região & Serviços" },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? "bg-[#27272A] text-[#FF8216] border border-[#FF8216]/30 shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-[#18181B]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* CONTEÚDO DAS ABAS */}
        <div className="pt-3">
          {/* ABA 1: VALOR CONTÁBIL & IRPF */}
          {activeTab === "custo" && (
            <div className="p-4 bg-[#18181B] border border-[#27272A] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
                    Ganho de Capital Tributável (Lei 13.259/16)
                  </span>
                  <h4 className="text-sm font-semibold text-white">
                    Simulação de Alienação & Tributação
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-zinc-400 block">Valor Líquido Estimado</span>
                  <span className="text-sm sm:text-base font-bold text-emerald-400 tabular-nums">
                    {formatCurrency(modelA.netLiquidProceeds)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-[#27272A]">
                <div className="p-2.5 bg-[#121214] rounded-lg border border-[#27272A]/60">
                  <span className="text-[10px] text-zinc-500 block uppercase">Custo de Compra</span>
                  <span className="text-xs font-semibold tabular-nums text-zinc-200">
                    {formatCurrency(modelA.acquisitionValue)}
                  </span>
                </div>

                <div className="p-2.5 bg-[#121214] rounded-lg border border-[#27272A]/60">
                  <span className="text-[10px] text-zinc-500 block uppercase">Lucro Patrimonial</span>
                  <span className="text-xs font-semibold tabular-nums text-emerald-400">
                    +{formatCurrency(modelA.grossCapitalGain)}
                  </span>
                </div>

                <div className="p-2.5 bg-[#121214] rounded-lg border border-[#27272A]/60">
                  <span className="text-[10px] text-zinc-500 block uppercase">Alíquota Efetiva</span>
                  <span className="text-xs font-semibold tabular-nums text-amber-400">
                    {modelA.effectiveTaxRatePct.toFixed(1)}%
                  </span>
                </div>

                <div className="p-2.5 bg-[#121214] rounded-lg border border-[#27272A]/60">
                  <span className="text-[10px] text-zinc-500 block uppercase">Imposto Previsto</span>
                  <span className="text-xs font-semibold tabular-nums text-rose-400">
                    -{formatCurrency(modelA.estimatedTaxDue)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: CORREÇÃO POR INFLAÇÃO */}
          {activeTab === "indices" && (
            <div className="p-4 bg-[#18181B] border border-[#27272A] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
                    Correção por Inflação Acumulada
                  </span>
                  <h4 className="text-sm font-semibold text-white">
                    IPCA Oficial vs. IGP-M Mercado
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-zinc-400 block">Período Decorrido</span>
                  <span className="text-xs font-bold text-zinc-200">
                    {modelB.elapsedYears.toFixed(1)} anos ({modelB.elapsedDays} dias)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#27272A]">
                <div className="p-3 bg-[#121214] rounded-xl border border-[#27272A]/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#FF8216]">Corrigido pelo IPCA</span>
                    <span className="text-[10px] text-zinc-400">+{modelB.ipcaAccumulatedPct.toFixed(1)}%</span>
                  </div>
                  <div className="text-base font-bold text-white tabular-nums">
                    {formatCurrency(modelB.correctedValueIPCA)}
                  </div>
                  <span className="text-[10px] text-zinc-500 block">
                    Ganho inflacionário: +{formatCurrency(modelB.ipcaGain)}
                  </span>
                </div>

                <div className="p-3 bg-[#121214] rounded-xl border border-[#27272A]/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-400">Corrigido pelo IGP-M</span>
                    <span className="text-[10px] text-zinc-400">+{modelB.igpmAccumulatedPct.toFixed(1)}%</span>
                  </div>
                  <div className="text-base font-bold text-white tabular-nums">
                    {formatCurrency(modelB.correctedValueIGPM)}
                  </div>
                  <span className="text-[10px] text-zinc-500 block">
                    Ganho imobiliário: +{formatCurrency(modelB.igpmGain)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ABA 3: RADAR DE REGIÃO & SERVIÇOS (COM LOCAIS IDENTIFICADOS E PREÇOS DE MERCADO) */}
          {activeTab === "radar" && (
            <div className="p-4 bg-[#18181B] border border-[#27272A] rounded-xl space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF8216] block">
                    Radar de Infraestrutura Urbana (Raio 2km)
                  </span>
                  <h4 className="text-sm font-semibold text-white">
                    {radarSummary?.classification || "Score de Infraestrutura da Região"}
                  </h4>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-zinc-400 uppercase block">Infrastructure Score</span>
                  <span className="text-base sm:text-lg font-black text-[#FF8216] tabular-nums">
                    {radarSummary?.score ?? 78}/100
                  </span>
                </div>
              </div>

              {/* CARD DE ESTIMATIVA DE MERCADO REGIONAL (FIPEZAP / REGIÃO DO CEP) */}
              <div className="p-3.5 bg-[#121214] rounded-xl border border-[#27272A] space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#27272A]/70 pb-2">
                  <span className="text-[11px] font-bold text-zinc-200">
                    Panorama Imobiliário da Região ({state || "BR"})
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {localMarketMetrics.marketBenchmarkSource}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
                  <div className="p-2 bg-[#18181B] rounded-lg">
                    <span className="text-[10px] text-zinc-400 block uppercase">M² Médio Venda</span>
                    <span className="text-xs font-bold text-white tabular-nums">
                      {formatCurrency(localMarketMetrics.adjustedSalePricePerSqm)}/m²
                    </span>
                  </div>

                  <div className="p-2 bg-[#18181B] rounded-lg">
                    <span className="text-[10px] text-zinc-400 block uppercase">M² Médio Aluguel</span>
                    <span className="text-xs font-bold text-zinc-200 tabular-nums">
                      {formatCurrency(localMarketMetrics.adjustedRentPricePerSqm)}/m²
                    </span>
                  </div>

                  <div className="p-2 bg-[#18181B] rounded-lg">
                    <span className="text-[10px] text-zinc-400 block uppercase">Aluguel Estimado</span>
                    <span className="text-xs font-bold text-emerald-400 tabular-nums">
                      {formatCurrency(localMarketMetrics.estimatedMonthlyRent)}/mês
                    </span>
                  </div>

                  <div className="p-2 bg-[#18181B] rounded-lg">
                    <span className="text-[10px] text-zinc-400 block uppercase">Rental Yield Estimado</span>
                    <span className="text-xs font-bold text-amber-400 tabular-nums">
                      {localMarketMetrics.estimatedAnnualRentalYieldPct.toFixed(2)}% a.a.
                    </span>
                  </div>
                </div>
              </div>

              {/* RESUMO DOS SERVIÇOS NO RAIO DE 2KM */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                <div className="p-2 bg-[#121214] rounded-lg border border-[#27272A]/70">
                  <span className="text-xs">🚌</span>
                  <span className="text-[10px] text-zinc-400 uppercase block mt-0.5">Transporte</span>
                  <span className="text-xs font-bold text-white tabular-nums">
                    {radarSummary?.categoryBreakdown.transport.count ?? 8} locais
                  </span>
                </div>

                <div className="p-2 bg-[#121214] rounded-lg border border-[#27272A]/70">
                  <span className="text-xs">🏥</span>
                  <span className="text-[10px] text-zinc-400 uppercase block mt-0.5">Saúde</span>
                  <span className="text-xs font-bold text-white tabular-nums">
                    {radarSummary?.categoryBreakdown.health.count ?? 3} locais
                  </span>
                </div>

                <div className="p-2 bg-[#121214] rounded-lg border border-[#27272A]/70">
                  <span className="text-xs">🎓</span>
                  <span className="text-[10px] text-zinc-400 uppercase block mt-0.5">Educação</span>
                  <span className="text-xs font-bold text-white tabular-nums">
                    {radarSummary?.categoryBreakdown.education.count ?? 4} locais
                  </span>
                </div>

                <div className="p-2 bg-[#121214] rounded-lg border border-[#27272A]/70">
                  <span className="text-xs">🛒</span>
                  <span className="text-[10px] text-zinc-400 uppercase block mt-0.5">Comércio</span>
                  <span className="text-xs font-bold text-white tabular-nums">
                    {radarSummary?.categoryBreakdown.commerce.count ?? 11} locais
                  </span>
                </div>

                <div className="p-2 bg-[#121214] rounded-lg border border-[#27272A]/70 col-span-2 sm:col-span-1">
                  <span className="text-xs">🛡️</span>
                  <span className="text-[10px] text-zinc-400 uppercase block mt-0.5">Segurança</span>
                  <span className="text-xs font-bold text-white tabular-nums">
                    {radarSummary?.categoryBreakdown.security.count ?? 1} local
                  </span>
                </div>
              </div>

              {/* LOCAIS REAIS IDENTIFICADOS COM NOME E DISTÂNCIA */}
              {radarSummary && radarSummary.keyNearbyPois.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Pontos de Interesse Identificados no Raio de 2km:
                  </span>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                    {radarSummary.keyNearbyPois.map((poi) => (
                      <div
                        key={poi.id}
                        className="px-2.5 py-1.5 bg-[#121214] rounded-lg text-xs flex items-center justify-between text-zinc-300 border border-[#27272A]/50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs shrink-0">
                            {poi.category === "transport"
                              ? "🚌"
                              : poi.category === "health"
                              ? "🏥"
                              : poi.category === "education"
                              ? "🎓"
                              : poi.category === "commerce"
                              ? "🛒"
                              : "🛡️"}
                          </span>
                          <span className="truncate text-[11px] font-medium text-zinc-200">
                            {poi.name}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-[#FF8216] shrink-0 pl-2">
                          {poi.distanceMeters}m
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
