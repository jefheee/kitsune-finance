"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  fetchFipeBrands,
  fetchFipeModels,
  fetchFipeYears,
  fetchFipePrice,
  calculateVehicleDepreciation,
  type FipeVehicleType,
  type FipeBrand,
  type FipeModel,
  type FipeYear,
  type FipePriceDetail,
  type VehicleDepreciationResult,
} from "@/utils/finance/engine/fipe";

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

  // 2. Marcas
  const [brands, setBrands] = useState<FipeBrand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<FipeBrand | null>(
    initialData?.brand && initialData?.brandCode
      ? { name: initialData.brand, code: initialData.brandCode }
      : null
  );
  const [brandSearch, setBrandSearch] = useState("");
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);

  // 3. Modelos
  const [models, setModels] = useState<FipeModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<FipeModel | null>(
    initialData?.model && initialData?.modelCode
      ? { name: initialData.model, code: initialData.modelCode }
      : null
  );
  const [modelSearch, setModelSearch] = useState("");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // 4. Anos / Versões
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

  // 5. Cotação FIPE Detalhada
  const [fipeDetail, setFipeDetail] = useState<FipePriceDetail | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);

  // 6. Campos manuais de aquisição do usuário
  const [customName, setCustomName] = useState(initialData?.name || "");
  const [licensePlate, setLicensePlate] = useState(initialData?.licensePlate || "");
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
      setSelectedYear(null);
      setFipeDetail(null);
      return;
    }

    let mounted = true;
    setIsLoadingYears(true);
    fetchFipeYears(vehicleType, selectedBrand.code, selectedModel.code)
      .then((y) => {
        if (!mounted) return;
        setYears(y);
        setIsLoadingYears(false);
      })
      .catch((err) => {
        console.warn("[FIPE] Erro ao carregar anos:", err);
        if (mounted) setIsLoadingYears(false);
      });

    return () => {
      mounted = false;
    };
  }, [vehicleType, selectedBrand, selectedModel]);

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

        // Preenche automaticamente o nome se ainda vazio
        if (!customName.trim()) {
          setCustomName(`${detail.brand} ${detail.model}`);
        }
        // Se valor de aquisição ainda estiver 0, sugere o valor da FIPE
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

  // Filtros de busca em tempo real
  const filteredBrands = useMemo(() => {
    if (!brandSearch.trim()) return brands;
    const term = brandSearch.toLowerCase();
    return brands.filter((b) => b.name.toLowerCase().includes(term));
  }, [brands, brandSearch]);

  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return models;
    const term = modelSearch.toLowerCase();
    return models.filter((m) => m.name.toLowerCase().includes(term));
  }, [models, modelSearch]);

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
      yearName: selectedYear?.name || "",
      yearCode: selectedYear?.code || "",
      modelYear: fipeDetail?.modelYear || selectedYear?.year || 0,
      fuel: fipeDetail?.fuel || selectedYear?.fuel || "",
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
    <div className="space-y-4 text-zinc-100">
      {/* 1. SELETOR RÁPIDO DE CATEGORIA (Carros / Motos / Caminhões) */}
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
          1. Tipo de Veículo
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
                    ? "bg-[#FF8216] text-black shadow-md shadow-[#FF8216]/20"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-[#27272A]/40"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2 & 3. MARCA E MODELO EM CASCATA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Dropdown com Busca: MARCA */}
        <div className="relative">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
            2. Marca / Montadora
          </label>
          <div
            onClick={() => setIsBrandDropdownOpen((prev) => !prev)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 cursor-pointer flex items-center justify-between hover:border-zinc-600 transition-colors"
          >
            <span className={selectedBrand ? "font-medium text-white truncate" : "text-zinc-500"}>
              {isLoadingBrands
                ? "Carregando marcas..."
                : selectedBrand
                  ? selectedBrand.name
                  : "Selecione a montadora..."}
            </span>
            <span className="text-zinc-500 text-[10px]">▼</span>
          </div>

          {/* Menu Dropdown com Busca Instantânea */}
          {isBrandDropdownOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-[#121214] border border-[#27272A] rounded-xl shadow-2xl p-2 max-h-60 flex flex-col">
              <input
                type="text"
                autoFocus
                placeholder="Buscar marca (ex: Toyota, Honda, VW)..."
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#FF8216] mb-2"
              />
              <div className="overflow-y-auto flex-1 space-y-0.5 pr-1">
                {filteredBrands.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 p-2 text-center">Nenhuma marca encontrada</p>
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
                      className="w-full text-left px-3 py-1.5 text-xs rounded-md text-zinc-300 hover:bg-[#18181B] hover:text-[#FF8216] transition-colors"
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
            3. Modelo / Versão
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
                ? "Aguardando marca..."
                : isLoadingModels
                  ? "Carregando modelos..."
                  : selectedModel
                    ? selectedModel.name
                    : "Selecione o modelo..."}
            </span>
            <span className="text-zinc-500 text-[10px]">▼</span>
          </div>

          {/* Menu Dropdown Modelos */}
          {isModelDropdownOpen && selectedBrand && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-[#121214] border border-[#27272A] rounded-xl shadow-2xl p-2 max-h-60 flex flex-col">
              <input
                type="text"
                autoFocus
                placeholder="Buscar modelo ou versão..."
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#FF8216] mb-2"
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
                      className="w-full text-left px-3 py-1.5 text-xs rounded-md text-zinc-300 hover:bg-[#18181B] hover:text-[#FF8216] transition-colors truncate"
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

      {/* 4. ANOS DISPONÍVEIS (Pills / Seletor Rápido) */}
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
          4. Ano do Modelo & Combustível
        </label>
        {!selectedModel ? (
          <p className="text-xs text-zinc-600 bg-[#121214] p-3 rounded-xl border border-[#27272A]/50">
            Selecione uma marca e um modelo para visualizar os anos homologados pela FIPE.
          </p>
        ) : isLoadingYears ? (
          <p className="text-xs text-zinc-400 p-2">Consultando anos disponíveis na Tabela FIPE...</p>
        ) : years.length === 0 ? (
          <p className="text-xs text-zinc-500 p-2">Nenhum ano disponível para esta versão.</p>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 bg-[#121214] border border-[#27272A] rounded-xl">
            {years.map((y) => {
              const active = selectedYear?.code === y.code;
              return (
                <button
                  key={y.code}
                  type="button"
                  onClick={() => setSelectedYear(y)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                    active
                      ? "bg-[#FF8216] text-black font-semibold shadow-sm"
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

      {/* 5. COTAÇÃO FIPE INSTANTÂNEA & CARD DE AUDITORIA */}
      {isLoadingPrice && (
        <div className="p-4 bg-[#18181B] border border-[#27272A] rounded-xl text-center text-xs text-zinc-400 animate-pulse">
          Consultando Tabela FIPE oficial ao vivo na BrasilAPI...
        </div>
      )}

      {fipeDetail && (
        <div className="p-4 bg-gradient-to-br from-[#18181B] to-[#121214] border border-[#FF8216]/40 rounded-xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF8216] block">
                Cotação Oficial FIPE • {fipeDetail.referenceMonth}
              </span>
              <h4 className="text-sm font-semibold text-white mt-0.5">
                {fipeDetail.brand} {fipeDetail.model}
              </h4>
              <p className="text-xs text-zinc-400">
                Ano {fipeDetail.modelYear} • {fipeDetail.fuel} • Código FIPE:{" "}
                <span className="font-mono text-zinc-300">{fipeDetail.fipeCode}</span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-medium text-zinc-400 block uppercase">
                Preço Médio de Mercado
              </span>
              <span className="text-base sm:text-lg font-bold text-[#FF8216] tabular-nums">
                {formatCurrency(fipeDetail.price)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 6. CAMPOS DE DETALHE PATRIMONIAL DO USUÁRIO */}
      <div className="pt-2 border-t border-[#27272A] space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
              Apelido do Veículo / Nome Personalizado
            </label>
            <input
              type="text"
              placeholder="Ex: Minha Amarok 2022"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#FF8216]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
              Placa (Opcional)
            </label>
            <input
              type="text"
              placeholder="ABC-1D23"
              maxLength={8}
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value)}
              className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 uppercase font-mono outline-none focus:border-[#FF8216]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
              Data de Compra / Aquisição
            </label>
            <input
              type="date"
              value={acquisitionDate}
              onChange={(e) => setAcquisitionDate(e.target.value)}
              className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#FF8216]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
              Valor Pago na Compra (R$)
            </label>
            <input
              type="number"
              step="100"
              placeholder="0,00"
              value={acquisitionValue || ""}
              onChange={(e) => setAcquisitionValue(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white tabular-nums outline-none focus:border-[#FF8216]"
            />
          </div>
        </div>
      </div>

      {/* 7. CARD DE DEPRECIAÇÃO OU VALORIZAÇÃO ANUALIZADA */}
      {acquisitionValue > 0 && currentPrice > 0 && (
        <div className="p-3.5 bg-[#18181B]/80 border border-[#27272A] rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Variação Histórica do Bem
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-sm font-bold tabular-nums ${
                  depreciation.status === "appreciated"
                    ? "text-emerald-400"
                    : depreciation.status === "depreciated"
                      ? "text-rose-400"
                      : "text-zinc-300"
                }`}
              >
                {depreciation.nominalDelta >= 0 ? "+" : ""}
                {formatCurrency(depreciation.nominalDelta)} (
                {depreciation.totalVariationPct >= 0 ? "+" : ""}
                {depreciation.totalVariationPct.toFixed(2).replace(".", ",")}%)
              </span>
              <span className="text-zinc-600 text-xs">•</span>
              <span className="text-xs text-zinc-400">
                {depreciation.elapsedYears} {depreciation.elapsedYears === 1 ? "ano" : "anos"}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
              Taxa Anualizada
            </span>
            <span
              className={`text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                depreciation.status === "appreciated"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : depreciation.status === "depreciated"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    : "bg-zinc-800 text-zinc-300"
              }`}
            >
              {depreciation.annualizedVariationPct >= 0 ? "+" : ""}
              {depreciation.annualizedVariationPct.toFixed(2).replace(".", ",")}% a.a.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
