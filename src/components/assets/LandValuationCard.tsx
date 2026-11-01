"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  calculateModelACapitalGain,
  calculateModelBIndexCorrection,
  type ModelACapitalGainResult,
  type ModelBIndexCorrectionResult,
  type LandSurroundingsSummary,
} from "@/utils/finance/engine/land-valuation";

export interface LandFormData {
  name: string;
  category: "land" | "real_estate";
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
  const [name, setName] = useState(initialData?.name || "Terreno / Imóvel");
  const [category, setCategory] = useState<"land" | "real_estate">(
    initialData?.category || "land"
  );
  const [areaSqm, setAreaSqm] = useState<number>(initialData?.areaSqm || 360);
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

  // Estado do Radar Overpass
  const [radarSummary, setRadarSummary] = useState<LandSurroundingsSummary | null>(null);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isLoadingRadar, setIsLoadingRadar] = useState(false);
  const [radarError, setRadarError] = useState<string | null>(null);

  // Consulta CEP via BrasilAPI v2 (com coordenadas geográficas)
  const handleCepLookup = useCallback(async (cepInput: string) => {
    const cleanCep = cepInput.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setIsLoadingCep(true);
    setRadarError(null);

    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
      if (!res.ok) {
        throw new Error("CEP não encontrado na base cartográfica.");
      }
      const data = await res.json();

      if (data.street) setStreet(data.street);
      if (data.neighborhood) setNeighborhood(data.neighborhood);
      if (data.city) setCity(data.city);
      if (data.state) setState(data.state);

      if (data.location?.coordinates?.latitude && data.location?.coordinates?.longitude) {
        const lat = parseFloat(data.location.coordinates.latitude);
        const lng = parseFloat(data.location.coordinates.longitude);
        setLatitude(lat);
        setLongitude(lng);

        // Dispara análise do radar geográfico
        triggerRadarAnalysis(lat, lng);
      }
    } catch (err: unknown) {
      console.warn("[LandValuation] Falha no CEP:", err);
    } finally {
      setIsLoadingCep(false);
    }
  }, []);

  // Executa o radar de POIs num raio de 2km
  const triggerRadarAnalysis = async (lat: number, lng: number) => {
    setIsLoadingRadar(true);
    setRadarError(null);

    try {
      const res = await fetch("/api/assets/radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, radiusMeters: 2000 }),
      });

      if (!res.ok) {
        throw new Error("Não foi possível consultar os pontos de interesse no raio de 2km.");
      }

      const summary = (await res.json()) as LandSurroundingsSummary;
      setRadarSummary(summary);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro no radar geográfico";
      setRadarError(msg);
    } finally {
      setIsLoadingRadar(false);
    }
  };

  // Modelos Determinísticos A e B
  const modelA = useMemo(() => {
    return calculateModelACapitalGain(acquisitionValue, currentValue);
  }, [acquisitionValue, currentValue]);

  const modelB = useMemo(() => {
    return calculateModelBIndexCorrection(acquisitionValue, acquisitionDate);
  }, [acquisitionValue, acquisitionDate]);

  // Dispara callback ao pai
  useEffect(() => {
    if (!onChange) return;
    const payload: LandFormData = {
      name: name || "Terreno / Imóvel",
      category,
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
        "Infraestrutura moderada",
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
    };
    onChange(payload, modelA, modelB, radarSummary);
  }, [
    name,
    category,
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
    <div className="space-y-4 text-zinc-100">
      {/* CABEÇALHO DO ATIVO: NOME E TIPO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Nome do Terreno ou Imóvel
          </label>
          <input
            type="text"
            placeholder="Ex: Terreno Jardim Europa, Lote 42"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#FF8216]"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Tipo do Ativo
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-[#18181B] p-1 rounded-xl border border-[#27272A]">
            <button
              type="button"
              onClick={() => setCategory("land")}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                category === "land"
                  ? "bg-[#FF8216] text-black shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Terreno
            </button>
            <button
              type="button"
              onClick={() => setCategory("real_estate")}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                category === "real_estate"
                  ? "bg-[#FF8216] text-black shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Imóvel
            </button>
          </div>
        </div>
      </div>

      {/* LOCALIZAÇÃO & CEP INTELIGENTE (BrasilAPI v2) */}
      <div className="p-3.5 bg-[#18181B] border border-[#27272A] rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF8216]">
            Localização & Geocodificação
          </span>
          {isLoadingCep && (
            <span className="text-[11px] text-zinc-400 animate-pulse">
              Buscando logradouro e coordenadas...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <div>
            <label className="text-[10px] uppercase font-medium text-zinc-400 block mb-1">
              CEP (com auto-preenchimento)
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
              className="w-full bg-[#121214] border border-[#27272A] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#FF8216]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[10px] uppercase font-medium text-zinc-400 block mb-1">
              Rua / Logradouro
            </label>
            <input
              type="text"
              placeholder="Rua / Avenida"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="w-full bg-[#121214] border border-[#27272A] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#FF8216]"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-medium text-zinc-400 block mb-1">
              Bairro / Cidade
            </label>
            <input
              type="text"
              placeholder="Bairro, Cidade - UF"
              value={neighborhood ? `${neighborhood}, ${city} - ${state}` : city}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="w-full bg-[#121214] border border-[#27272A] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#FF8216]"
            />
          </div>
        </div>

        {latitude && longitude && (
          <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
            <span>
              Coordenadas: <span className="font-mono text-zinc-300">{latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
            </span>
            <button
              type="button"
              onClick={() => triggerRadarAnalysis(latitude, longitude)}
              disabled={isLoadingRadar}
              className="text-[#FF8216] hover:underline font-semibold cursor-pointer disabled:opacity-50"
            >
              {isLoadingRadar ? "Atualizando radar..." : "Re-escanear 2km Overpass"}
            </button>
          </div>
        )}
      </div>

      {/* METRAGEM & VALORES DE AQUISIÇÃO / ATUAL */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Área Total (m²)
          </label>
          <input
            type="number"
            step="1"
            placeholder="360"
            value={areaSqm || ""}
            onChange={(e) => setAreaSqm(parseFloat(e.target.value) || 0)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white tabular-nums outline-none focus:border-[#FF8216]"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Valor de Aquisição (Pago)
          </label>
          <input
            type="number"
            step="1000"
            placeholder="250.000,00"
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
            step="1000"
            placeholder="380.000,00"
            value={currentValue || ""}
            onChange={(e) => setCurrentValue(parseFloat(e.target.value) || 0)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white tabular-nums outline-none focus:border-[#FF8216]"
          />
        </div>
      </div>

      {/* ABAS COMPARATIVAS: MODELO A (CUSTO), MODELO B (ÍNDICES) E MODELO C (RADAR LOCAL) */}
      <div className="pt-2">
        <div className="flex items-center gap-1.5 border-b border-[#27272A] pb-2">
          {(
            [
              { id: "custo", label: "Aba Custo (IRPF)" },
              { id: "indices", label: "Aba Índices (IPCA vs IGP-M)" },
              { id: "radar", label: "Aba Radar Local (2km POIs)" },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? "bg-[#27272A] text-[#FF8216] border border-[#FF8216]/40"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-[#18181B]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* CONTEÚDO DA ABA SELECIONADA */}
        <div className="pt-3">
          {/* ABA CUSTO (MODELO A - CUSTO CONTÁBIL & IRPF) */}
          {activeTab === "custo" && (
            <div className="p-4 bg-[#18181B] border border-[#27272A] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Modelo A: Custo Histórico & Simulação IRPF
                  </span>
                  <h4 className="text-sm font-semibold text-white">
                    Ganho de Capital Tributável (Lei 13.259/16)
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-zinc-400 block">Valor Líquido em Mãos</span>
                  <span className="text-sm sm:text-base font-bold text-emerald-400 tabular-nums">
                    {formatCurrency(modelA.netLiquidProceeds)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-[#27272A]">
                <div className="p-2.5 bg-[#121214] rounded-lg border border-[#27272A]/60">
                  <span className="text-[10px] text-zinc-500 block uppercase">Custo de Aquisição</span>
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
                  <span className="text-[10px] text-zinc-500 block uppercase">Alíquota IRPF</span>
                  <span className="text-xs font-semibold tabular-nums text-[#FF8216]">
                    {modelA.effectiveTaxRatePct.toFixed(1).replace(".", ",")}%
                  </span>
                </div>

                <div className="p-2.5 bg-[#121214] rounded-lg border border-[#27272A]/60">
                  <span className="text-[10px] text-zinc-500 block uppercase">Imposto Estimado</span>
                  <span className="text-xs font-semibold tabular-nums text-rose-400">
                    -{formatCurrency(modelA.estimatedTaxDue)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ABA ÍNDICES (MODELO B - IPCA vs IGP-M) */}
          {activeTab === "indices" && (
            <div className="p-4 bg-[#18181B] border border-[#27272A] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Modelo B: Reposição da Inflação
                  </span>
                  <h4 className="text-sm font-semibold text-white">
                    Correção Macroeconômica desde {acquisitionDate}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-zinc-400 block">Período Decorrido</span>
                  <span className="text-xs font-semibold text-zinc-300">
                    {modelB.elapsedYears} anos (~{modelB.elapsedMonths} meses)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#27272A]">
                {/* Cartão IPCA */}
                <div className="p-3 bg-[#121214] rounded-xl border border-blue-500/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-blue-400">
                      IPCA Acumulado (+{modelB.ipcaAccumulatedPct.toFixed(1)}%)
                    </span>
                    <span className="text-xs font-bold text-blue-400 tabular-nums">
                      {formatCurrency(modelB.correctedValueIPCA)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Ganho de correção monetária pura:{" "}
                    <span className="text-zinc-200 font-semibold">{formatCurrency(modelB.ipcaGain)}</span>
                  </p>
                </div>

                {/* Cartão IGP-M */}
                <div className="p-3 bg-[#121214] rounded-xl border border-amber-500/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-amber-400">
                      IGP-M Acumulado (+{modelB.igpmAccumulatedPct.toFixed(1)}%)
                    </span>
                    <span className="text-xs font-bold text-amber-400 tabular-nums">
                      {formatCurrency(modelB.correctedValueIGPM)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Descolamento IGP-M vs IPCA:{" "}
                    <span className="text-zinc-200 font-semibold">+{formatCurrency(modelB.comparisonDelta)}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ABA RADAR LOCAL (MODELO C - OVERPASS 2KM) */}
          {activeTab === "radar" && (
            <div className="p-4 bg-[#18181B] border border-[#27272A] rounded-xl space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF8216] block">
                    Modelo C: Radar Geográfico de Infraestrutura (2km)
                  </span>
                  <h4 className="text-sm font-semibold text-white">
                    {radarSummary?.classification || "Score de Infraestrutura Urbana"}
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-400 uppercase block">Infrastructure Score</span>
                    <span className="text-base sm:text-lg font-black text-[#FF8216] tabular-nums">
                      {radarSummary?.score ?? 78}/100
                    </span>
                  </div>
                </div>
              </div>

              {/* Multiplicador de Atratividade por m² */}
              <div className="p-3 bg-[#121214] rounded-xl border border-[#27272A] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase block font-semibold">
                    Multiplicador de Atratividade m²
                  </span>
                  <span className="text-xs text-zinc-300">
                    Fator aplicado sobre o custo base da região
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-emerald-400">
                    {(radarSummary?.attractivenessMultiplier ?? 1.25).toFixed(2)}x
                  </span>
                  <span className="text-[10px] text-zinc-500 block">
                    ~{formatCurrency(Math.round((currentValue / (areaSqm || 1))))}/m²
                  </span>
                </div>
              </div>

              {/* Categorias de Serviços no Raio de 2km */}
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

              {/* Principais POIs Próximos */}
              {radarSummary && radarSummary.keyNearbyPois.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Serviços mais próximos identificados no raio de 2km:
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {radarSummary.keyNearbyPois.slice(0, 6).map((poi) => (
                      <div
                        key={poi.id}
                        className="px-2.5 py-1.5 bg-[#121214] rounded-md text-[11px] flex items-center justify-between text-zinc-300"
                      >
                        <span className="truncate pr-2">{poi.name}</span>
                        <span className="font-mono text-[10px] text-zinc-500 shrink-0">
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
