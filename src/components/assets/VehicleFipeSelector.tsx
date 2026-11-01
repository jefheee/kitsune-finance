"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  fetchFipeBrands,
  fetchFipeModels,
  fetchFipeYears,
  fetchFipePrice,
  calculateVehicleDepreciation,
  fuzzyMatches,
  DEFAULT_VEHICLE_YEARS,
  type FipeVehicleType,
  type FipeBrand,
  type FipeModel,
  type FipeYear,
  type FipePriceDetail,
  type VehicleDepreciationResult,
} from "@/utils/finance/engine/fipe";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";

export interface VehicleFormData {
  name: string;
  vehicleType: FipeVehicleType;
  brand: string;
  brandCode: string;
  model: string;
  modelCode: string;
  yearName: string;
  yearCode: string;
  modelYear: number;
  fuel: string;
  fipeCode: string;
  currentFipePrice: number;
  referenceMonth: string;
  licensePlate: string;
  acquisitionDate: string;
  acquisitionValue: number;
}

interface VehicleFipeSelectorProps {
  initialData?: Partial<VehicleFormData>;
  onChange?: (data: VehicleFormData, depreciation: VehicleDepreciationResult) => void;
  hideValues?: boolean;
}

export function VehicleFipeSelector({
  initialData,
  onChange,
  hideValues = false,
}: VehicleFipeSelectorProps) {
  // 1. Tipo de Veículo
  const [vehicleType, setVehicleType] = useState<FipeVehicleType>(
    initialData?.vehicleType || "carros"
  );

  // 2. Consulta por Placa
  const [licensePlate, setLicensePlate] = useState(initialData?.licensePlate || "");
  const [isConsultingPlate, setIsConsultingPlate] = useState(false);
  const [plateMessage, setPlateMessage] = useState<string | null>(null);

  // 3. Marcas
  const [brands, setBrands] = useState<FipeBrand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<FipeBrand | null>(
    initialData?.brand && initialData?.brandCode
      ? { name: initialData.brand, code: initialData.brandCode }
      : null
  );
  const [brandSearch, setBrandSearch] = useState("");
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);

  // 4. Modelos
  const [models, setModels] = useState<FipeModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<FipeModel | null>(
    initialData?.model && initialData?.modelCode
      ? { name: initialData.model, code: initialData.modelCode }
      : null
  );
  const [modelSearch, setModelSearch] = useState("");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // 5. Ano Preferencial do Usuário (pode ser selecionado ANTES de escolher o modelo)
  const [preferredYear, setPreferredYear] = useState<number | null>(
    initialData?.modelYear || null
  );

  // 6. Anos / Versões Homologadas
  const [years, setYears] = useState<FipeYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<FipeYear | null>(
    initialData?.yearCode && initialData?.yearName
      ? {
          code: initialData.yearCode,
          name: initialData.yearName,
          year: initialData.modelYear || 0,
          fuel: initialData.fuel || "",
        }
      : null
  );
  const [isLoadingYears, setIsLoadingYears] = useState(false);

  // 7. Cotação FIPE Detalhada
  const [fipeDetail, setFipeDetail] = useState<FipePriceDetail | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);

  // 8. Campos manuais de aquisição do usuário
  const [customName, setCustomName] = useState(initialData?.name || "");
  const [acquisitionDate, setAcquisitionDate] = useState(
    initialData?.acquisitionDate || new Date().toISOString().slice(0, 10)
  );
  const [acquisitionValue, setAcquisitionValue] = useState<number>(
    initialData?.acquisitionValue || 0
  );

  // Carrega Marcas quando muda o vehicleType
  useEffect(() => {
    let mounted = true;
    setIsLoadingBrands(true);
    fetchFipeBrands(vehicleType)
      .then((b) => {
        if (!mounted) return;
        setBrands(b);
        setIsLoadingBrands(false);
      })
      .catch((err) => {
        console.warn("[FIPE] Erro ao carregar marcas:", err);
        if (mounted) setIsLoadingBrands(false);
      });

    return () => {
      mounted = false;
    };
  }, [vehicleType]);

  // Carrega Modelos quando uma Marca é selecionada
  useEffect(() => {
    if (!selectedBrand?.code) {
      setModels([]);
      setSelectedModel(null);
      setYears([]);
      setSelectedYear(null);
      setFipeDetail(null);
      return;
    }

    let mounted = true;
    setIsLoadingModels(true);
    fetchFipeModels(vehicleType, selectedBrand.code)
      .then((m) => {
        if (!mounted) return;
        setModels(m);
        setIsLoadingModels(false);
      })
      .catch((err) => {
        console.warn("[FIPE] Erro ao carregar modelos:", err);
        if (mounted) setIsLoadingModels(false);
      });

    return () => {
      mounted = false;
    };
  }, [vehicleType, selectedBrand]);

  // Carrega Anos quando um Modelo é selecionado
  useEffect(() => {
    if (!selectedBrand?.code || !selectedModel?.code) {
      setYears([]);
      return;
    }

    let mounted = true;
    setIsLoadingYears(true);
    fetchFipeYears(vehicleType, selectedBrand.code, selectedModel.code)
      .then((y) => {
        if (!mounted) return;
        const availableYears = y.length > 0 ? y : DEFAULT_VEHICLE_YEARS.slice(0, 12);
        setYears(availableYears);
        setIsLoadingYears(false);

        // Se o usuário já escolheu um ano preferencial antes do modelo, tenta casar automaticamente!
        if (preferredYear) {
          const match = availableYears.find((item) => item.year === preferredYear);
          if (match) {
            setSelectedYear(match);
          } else if (availableYears.length > 0) {
            setSelectedYear(availableYears[0]);
          }
        }
      })
      .catch((err) => {
        console.warn("[FIPE] Erro ao carregar anos:", err);
        if (mounted) {
          setYears(DEFAULT_VEHICLE_YEARS.slice(0, 12));
          setIsLoadingYears(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [vehicleType, selectedBrand, selectedModel, preferredYear]);

  // Carrega Preço FIPE instantâneo quando o Ano é selecionado
  useEffect(() => {
    if (!selectedBrand?.code || !selectedModel?.code || !selectedYear?.code) {
      return;
    }

    let mounted = true;
    setIsLoadingPrice(true);
    fetchFipePrice(vehicleType, selectedBrand.code, selectedModel.code, selectedYear.code)
      .then((detail) => {
        if (!mounted) return;
        setFipeDetail(detail);
        setIsLoadingPrice(false);

        if (!customName.trim()) {
          setCustomName(`${detail.brand} ${detail.model}`);
        }
        if (acquisitionValue === 0) {
          setAcquisitionValue(detail.price);
        }
      })
      .catch((err) => {
        console.warn("[FIPE] Erro ao carregar preço FIPE:", err);
        if (mounted) setIsLoadingPrice(false);
      });

    return () => {
      mounted = false;
    };
  }, [vehicleType, selectedBrand, selectedModel, selectedYear]);

  // Filtros de busca flexíveis (fuzzy matching sem acento e por termos parciais)
  const filteredBrands = useMemo(() => {
    if (!brandSearch.trim()) return brands;
    return brands.filter((b) => fuzzyMatches(b.name, brandSearch));
  }, [brands, brandSearch]);

  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return models;
    return models.filter((m) => fuzzyMatches(m.name, modelSearch));
  }, [models, modelSearch]);

  // Anos exibidos para escolha (se ainda não escolheu modelo, mostra os anos universais)
  const displayYears = useMemo(() => {
    if (years.length > 0) return years;
    return DEFAULT_VEHICLE_YEARS.slice(0, 16);
  }, [years]);

  // Consulta por Placa
  const handleConsultPlate = async () => {
    const clean = licensePlate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (clean.length < 7) {
      setPlateMessage("Digite a placa completa com 7 caracteres (ex: ABC1D23 ou ABC1234).");
      return;
    }

    setIsConsultingPlate(true);
    setPlateMessage(null);

    try {
      const res = await fetch("/api/assets/vehicle-plate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: clean }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPlateMessage(data.error || "Não foi possível consultar a placa.");
        return;
      }

      setPlateMessage(data.message);

      // Se a API comercial retornou montadora e modelo
      if (data.brand) {
        const foundBrand = brands.find((b) => fuzzyMatches(b.name, data.brand));
        if (foundBrand) {
          setSelectedBrand(foundBrand);
        }
      }

      if (data.year) {
        setPreferredYear(data.year);
      }
    } catch {
      setPlateMessage("Falha de rede ao consultar placa veicular.");
    } finally {
      setIsConsultingPlate(false);
    }
  };

  // Cálculo determinístico de depreciação/valorização em tempo real
  const currentPrice = fipeDetail?.price || initialData?.currentFipePrice || 0;
  const depreciation = useMemo(() => {
    return calculateVehicleDepreciation(acquisitionValue, acquisitionDate, currentPrice);
  }, [acquisitionValue, acquisitionDate, currentPrice]);

  // Notifica o componente pai sobre mudanças
  useEffect(() => {
    if (!onChange) return;
    const payload: VehicleFormData = {
      name: customName || (fipeDetail ? `${fipeDetail.brand} ${fipeDetail.model}` : "Veículo FIPE"),
      vehicleType,
      brand: selectedBrand?.name || "",
      brandCode: selectedBrand?.code || "",
      model: selectedModel?.name || "",
      modelCode: selectedModel?.code || "",
      yearName: selectedYear?.name || (preferredYear ? String(preferredYear) : ""),
      yearCode: selectedYear?.code || (preferredYear ? `${preferredYear}-1` : ""),
      modelYear: fipeDetail?.modelYear || selectedYear?.year || preferredYear || 0,
      fuel: fipeDetail?.fuel || selectedYear?.fuel || "Gasolina / Flex",
      fipeCode: fipeDetail?.fipeCode || "",
      currentFipePrice: currentPrice,
      referenceMonth: fipeDetail?.referenceMonth || "",
      licensePlate: licensePlate.toUpperCase().trim(),
      acquisitionDate,
      acquisitionValue,
    };
    onChange(payload, depreciation);
  }, [
    customName,
    vehicleType,
    selectedBrand,
    selectedModel,
    selectedYear,
    preferredYear,
    fipeDetail,
    currentPrice,
    licensePlate,
    acquisitionDate,
    acquisitionValue,
    depreciation,
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
      {/* 1. SELEÇÃO DE TIPO DE VEÍCULO */}
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
          Tipo de Veículo
        </label>
        <div className="grid grid-cols-3 gap-2 bg-[#18181B] p-1 rounded-xl border border-[#27272A]">
          {(
            [
              { id: "carros", label: "Carros" },
              { id: "motos", label: "Motos" },
              { id: "caminhoes", label: "Caminhões" },
            ] as const
          ).map((t) => {
            const active = vehicleType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setVehicleType(t.id);
                  setSelectedBrand(null);
                  setSelectedModel(null);
                  setSelectedYear(null);
                  setFipeDetail(null);
                }}
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center ${
                  active
                    ? "bg-white text-black shadow-xs font-bold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-[#27272A]/40"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. CONSULTA RÁPIDA POR PLACA (OPCIONAL) */}
      <div className="p-3 bg-[#18181B] border border-[#27272A] rounded-xl space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold text-zinc-300 block">
              Placa do Veículo (Opcional)
            </span>
            <span className="text-[10px] text-zinc-400">
              Padrão Mercosul ou cinza tradicional
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              maxLength={8}
              placeholder="BRA2E19"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
              className="w-32 bg-[#121214] border border-[#27272A] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono uppercase tracking-wider outline-none focus:border-[#E11D48]"
            />
            <button
              type="button"
              onClick={handleConsultPlate}
              disabled={isConsultingPlate}
              className="h-8 px-3 rounded-lg bg-[#27272A] hover:bg-[#323238] text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isConsultingPlate ? (
                <span>Buscando...</span>
              ) : (
                <>
                  <WfIcons.Search className="w-3.5 h-3.5 text-[#E11D48]" />
                  <span>Consultar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {plateMessage && (
          <p className="text-[11px] text-zinc-400 bg-[#121214] p-2 rounded-lg border border-[#27272A] leading-relaxed">
            {plateMessage}
          </p>
        )}
      </div>

      {/* 3 & 4. MARCA E MODELO COM BUSCA FLEXÍVEL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Dropdown com Busca: MARCA */}
        <div className="relative">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
            Marca / Montadora
          </label>
          <div
            onClick={() => setIsBrandDropdownOpen((prev) => !prev)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 cursor-pointer flex items-center justify-between hover:border-zinc-600 transition-colors"
          >
            <span className={selectedBrand ? "font-medium text-white truncate" : "text-zinc-500"}>
              {isLoadingBrands
                ? "Carregando montadoras..."
                : selectedBrand
                  ? selectedBrand.name
                  : "Selecione a montadora..."}
            </span>
            <span className="text-zinc-500 text-[10px]">▼</span>
          </div>

          {isBrandDropdownOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-[#121214] border border-[#27272A] rounded-xl shadow-2xl p-2 max-h-60 flex flex-col">
              <input
                type="text"
                autoFocus
                placeholder="Busca flexível (ex: volks, vw, toyota, honda)..."
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#E11D48] mb-2"
              />
              <div className="overflow-y-auto flex-1 space-y-0.5 pr-1">
                {filteredBrands.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 p-2 text-center">Nenhuma montadora encontrada</p>
                ) : (
                  filteredBrands.map((b) => (
                    <button
                      key={b.code}
                      type="button"
                      onClick={() => {
                        setSelectedBrand(b);
                        setIsBrandDropdownOpen(false);
                        setBrandSearch("");
                        setSelectedModel(null);
                        setSelectedYear(null);
                        setFipeDetail(null);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs rounded-md text-zinc-300 hover:bg-[#18181B] hover:text-[#E11D48] transition-colors"
                    >
                      {b.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dropdown com Busca: MODELO / VERSÃO */}
        <div className="relative">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
            Modelo / Versão
          </label>
          <div
            onClick={() => {
              if (selectedBrand) setIsModelDropdownOpen((prev) => !prev);
            }}
            className={`w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs flex items-center justify-between transition-colors ${
              selectedBrand
                ? "cursor-pointer hover:border-zinc-600 text-zinc-200"
                : "opacity-40 cursor-not-allowed text-zinc-600"
            }`}
          >
            <span className={selectedModel ? "font-medium text-white truncate" : "text-zinc-500 truncate"}>
              {!selectedBrand
                ? "Selecione a montadora primeiro..."
                : isLoadingModels
                  ? "Carregando modelos..."
                  : selectedModel
                    ? selectedModel.name
                    : "Selecione o modelo..."}
            </span>
            <span className="text-zinc-500 text-[10px]">▼</span>
          </div>

          {isModelDropdownOpen && selectedBrand && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-[#121214] border border-[#27272A] rounded-xl shadow-2xl p-2 max-h-60 flex flex-col">
              <input
                type="text"
                autoFocus
                placeholder="Busca tolerante (ex: gol g6, cross, tdi, 2.0)..."
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#E11D48] mb-2"
              />
              <div className="overflow-y-auto flex-1 space-y-0.5 pr-1">
                {filteredModels.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 p-2 text-center">Nenhum modelo encontrado</p>
                ) : (
                  filteredModels.map((m) => (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => {
                        setSelectedModel(m);
                        setIsModelDropdownOpen(false);
                        setModelSearch("");
                        setSelectedYear(null);
                        setFipeDetail(null);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs rounded-md text-zinc-300 hover:bg-[#18181B] hover:text-[#E11D48] transition-colors truncate"
                    >
                      {m.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. SELEÇÃO DE ANO DO MODELO (FLEXÍVEL — DISPONÍVEL A QUALQUER MOMENTO) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Ano do Modelo & Fabricação
          </label>
          {preferredYear && (
            <span className="text-[10px] text-[#E11D48] font-semibold">
              Ano selecionado: {preferredYear}
            </span>
          )}
        </div>

        {isLoadingYears ? (
          <p className="text-xs text-zinc-400 p-2">Consultando tabela oficial FIPE...</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-[#121214] border border-[#27272A] rounded-xl scrollbar-thin">
            {displayYears.map((y) => {
              const active = selectedYear?.code === y.code || preferredYear === y.year;
              return (
                <button
                  key={y.code}
                  type="button"
                  onClick={() => {
                    setPreferredYear(y.year);
                    setSelectedYear(y);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                    active
                      ? "bg-white text-black font-bold shadow-xs"
                      : "bg-[#18181B] text-zinc-300 hover:bg-[#27272A] hover:text-white"
                  }`}
                >
                  {y.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. COTAÇÃO FIPE INSTANTÂNEA */}
      {isLoadingPrice && (
        <div className="p-3.5 bg-[#18181B] border border-[#27272A] rounded-xl text-center text-xs text-zinc-400 animate-pulse">
          Consultando Tabela FIPE oficial ao vivo...
        </div>
      )}

      {fipeDetail && (
        <div className="p-4 bg-gradient-to-br from-[#18181B] to-[#121214] border border-[#E11D48]/40 rounded-xl space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#E11D48] block">
                Cotação FIPE de Referência • {fipeDetail.referenceMonth}
              </span>
              <h4 className="text-sm font-semibold text-white mt-0.5">
                {fipeDetail.brand} {fipeDetail.model}
              </h4>
              <p className="text-xs text-zinc-400">
                Ano {fipeDetail.modelYear} • {fipeDetail.fuel} • Código FIPE:{" "}
                <span className="font-mono text-zinc-300">{fipeDetail.fipeCode}</span>
              </p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <span className="text-[10px] font-medium text-zinc-400 block uppercase">
                Preço Médio FIPE
              </span>
              <span className="text-base sm:text-lg font-bold text-[#E11D48] tabular-nums">
                {formatCurrency(fipeDetail.price)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 7. DADOS DE AQUISIÇÃO DO USUÁRIO & DEPRECIAÇÃO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Nome do Veículo
          </label>
          <input
            type="text"
            placeholder="Ex: Meu Amarok, Carro da Família"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#E11D48]"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Valor de Aquisição (Pago)
          </label>
          <input
            type="number"
            step="500"
            placeholder="80000"
            value={acquisitionValue || ""}
            onChange={(e) => setAcquisitionValue(parseFloat(e.target.value) || 0)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white tabular-nums outline-none focus:border-[#E11D48]"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Data de Aquisição
          </label>
          <input
            type="date"
            value={acquisitionDate}
            onChange={(e) => setAcquisitionDate(e.target.value)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#E11D48]"
          />
        </div>
      </div>

      {/* Depreciação / Valorização Calculada */}
      {acquisitionValue > 0 && currentPrice > 0 && (
        <div className="p-3 bg-[#121214] border border-[#27272A] rounded-xl flex items-center justify-between text-xs">
          <div>
            <span className="text-zinc-400 block">Variação Histórica Acumulada:</span>
            <span className="text-[11px] text-zinc-500">
              {depreciation.elapsedDays} dias desde a compra
            </span>
          </div>
          <div className="text-right">
            <span
              className={`font-bold tabular-nums ${
                depreciation.totalVariationPct >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {depreciation.totalVariationPct >= 0 ? "+" : ""}
              {depreciation.totalVariationPct.toFixed(2)}% (
              {formatCurrency(depreciation.nominalDelta)})
            </span>
            <span className="text-[10px] text-zinc-500 block">
              {depreciation.annualizedVariationPct.toFixed(2)}% a.a.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
