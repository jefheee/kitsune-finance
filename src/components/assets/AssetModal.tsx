"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { VehicleFipeSelector, type VehicleFormData } from "./VehicleFipeSelector";
import { LandValuationCard, type LandFormData } from "./LandValuationCard";
import { FgtsCalculatorCard, type FgtsFormData } from "./FgtsCalculatorCard";
import type { CustomAsset, CustomAssetCategory } from "@/types/finance";
import { useFinanceData } from "@/context/FinanceDataContext";

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetToEdit?: CustomAsset | null;
}

export function AssetModal({ isOpen, onClose, assetToEdit }: AssetModalProps) {
  const { addCustomAssetLocal, updateCustomAssetLocal, removeCustomAssetLocal, isPrivacyMode } =
    useFinanceData();

  const [category, setCategory] = useState<CustomAssetCategory>(
    assetToEdit?.category || "vehicle"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados dos formulários filhos
  const [vehicleData, setVehicleData] = useState<VehicleFormData | null>(null);
  const [landData, setLandData] = useState<LandFormData | null>(null);
  const [fgtsData, setFgtsData] = useState<FgtsFormData | null>(null);

  // Outros Ativos
  const [otherName, setOtherName] = useState(assetToEdit?.name || "");
  const [otherValue, setOtherValue] = useState<number>(
    assetToEdit?.current_value || 0
  );
  const [otherNotes, setOtherNotes] = useState<string>(
    (assetToEdit?.metadata?.notes as string) || ""
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let name = "";
      let acquisitionDate: string | null = null;
      let acquisitionValue = 0;
      let currentValue = 0;
      let metadata: Record<string, unknown> = {};

      if (category === "vehicle") {
        if (!vehicleData) throw new Error("Preencha os dados do veículo.");
        name = vehicleData.name;
        acquisitionDate = vehicleData.acquisitionDate;
        acquisitionValue = vehicleData.acquisitionValue;
        currentValue = vehicleData.currentFipePrice || vehicleData.acquisitionValue;
        metadata = {
          vehicle_type: vehicleData.vehicleType,
          brand: vehicleData.brand,
          brand_code: vehicleData.brandCode,
          model: vehicleData.model,
          model_code: vehicleData.modelCode,
          year_name: vehicleData.yearName,
          year_code: vehicleData.yearCode,
          model_year: vehicleData.modelYear,
          fuel: vehicleData.fuel,
          fipe_code: vehicleData.fipeCode,
          reference_month: vehicleData.referenceMonth,
          license_plate: vehicleData.licensePlate,
        };
      } else if (category === "land" || category === "real_estate") {
        if (!landData) throw new Error("Preencha os dados do terreno ou imóvel.");
        name = landData.name;
        acquisitionDate = landData.acquisitionDate;
        acquisitionValue = landData.acquisitionValue;
        currentValue = landData.currentValue;
        metadata = {
          area_m2: landData.areaSqm,
          postal_code: landData.postalCode,
          street: landData.street,
          neighborhood: landData.neighborhood,
          city: landData.city,
          state: landData.state,
          latitude: landData.latitude,
          longitude: landData.longitude,
          radar_score: landData.radarScore,
          infrastructure_classification: landData.infrastructureClassification,
          sqm_attractiveness_multiplier: landData.attractivenessMultiplier,
          poi_counts: landData.poiCounts,
        };
      } else if (category === "fgts") {
        if (!fgtsData) throw new Error("Preencha os dados da conta FGTS.");
        name = fgtsData.name;
        acquisitionDate = new Date().toISOString().slice(0, 10);
        acquisitionValue = fgtsData.currentBalance;
        currentValue = fgtsData.currentBalance;
        metadata = {
          company_name: fgtsData.companyName,
          gross_salary: fgtsData.grossSalary,
          monthly_deposit: fgtsData.monthlyDeposit,
          projection_months: fgtsData.projectionMonths,
        };
      } else {
        if (!otherName.trim()) throw new Error("Informe o nome do ativo.");
        name = otherName.trim();
        acquisitionValue = otherValue;
        currentValue = otherValue;
        metadata = { notes: otherNotes };
      }

      const method = assetToEdit ? "PUT" : "POST";
      const payload: Record<string, unknown> = {
        name,
        category,
        acquisition_date: acquisitionDate,
        acquisition_value: acquisitionValue,
        current_value: currentValue,
        metadata,
      };

      if (assetToEdit) {
        payload.id = assetToEdit.id;
      }

      const res = await fetch("/api/assets", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Falha ao salvar ativo no cofre patrimonial.");
      }

      const result = await res.json();
      const savedAsset: CustomAsset = result.asset;

      if (assetToEdit) {
        updateCustomAssetLocal(savedAsset);
      } else {
        addCustomAssetLocal(savedAsset);
      }

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido ao salvar";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!assetToEdit) return;
    if (!confirm("Tem certeza que deseja excluir este ativo do seu patrimônio?")) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/assets?id=${assetToEdit.id}`, { method: "DELETE" });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Falha ao excluir ativo");
      }
      removeCustomAssetLocal(assetToEdit.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao remover ativo";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#121214] border border-[#27272A] rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Cabeçalho do Modal */}
        <div className="px-5 py-4 border-b border-[#27272A] flex items-center justify-between bg-[#18181B]/80">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF8216]">
              Patrimônio Imobilizado & Físico
            </span>
            <h3 className="text-base font-bold text-white">
              {assetToEdit ? "Editar Ativo Patrimonial" : "Novo Ativo no Patrimônio"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#27272A] text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Seleção de Categoria de Ativo */}
        {!assetToEdit && (
          <div className="px-5 pt-4">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
              Selecione a Categoria do Bem
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: "vehicle", label: "Veículo (FIPE)", icon: "🚗" },
                  { id: "land", label: "Terreno (Modelos A/B/C)", icon: "📐" },
                  { id: "real_estate", label: "Imóvel / Casa", icon: "🏢" },
                  { id: "fgts", label: "FGTS Caixa (CLT)", icon: "🏛️" },
                ] as const
              ).map((cat) => {
                const active = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      active
                        ? "bg-[#18181B] border-[#FF8216] shadow-sm text-white"
                        : "bg-[#18181B]/40 border-[#27272A] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                  >
                    <span className="text-base block mb-0.5">{cat.icon}</span>
                    <span className="text-xs font-semibold block">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Corpo do Formulário */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium">
              {errorMessage}
            </div>
          )}

          {category === "vehicle" && (
            <VehicleFipeSelector
              hideValues={isPrivacyMode}
              initialData={{
                name: assetToEdit?.name,
                brand: assetToEdit?.metadata?.brand as string,
                brandCode: assetToEdit?.metadata?.brand_code as string,
                model: assetToEdit?.metadata?.model as string,
                modelCode: assetToEdit?.metadata?.model_code as string,
                yearCode: assetToEdit?.metadata?.year_code as string,
                yearName: assetToEdit?.metadata?.year_name as string,
                fipeCode: assetToEdit?.metadata?.fipe_code as string,
                modelYear: assetToEdit?.metadata?.model_year as number,
                fuel: assetToEdit?.metadata?.fuel as string,
                licensePlate: assetToEdit?.metadata?.license_plate as string,
                acquisitionDate: assetToEdit?.acquisition_date || undefined,
                acquisitionValue: assetToEdit?.acquisition_value,
                currentFipePrice: assetToEdit?.current_value,
              }}
              onChange={(data) => setVehicleData(data)}
            />
          )}

          {(category === "land" || category === "real_estate") && (
            <LandValuationCard
              hideValues={isPrivacyMode}
              initialData={{
                name: assetToEdit?.name,
                category: category as "land" | "real_estate",
                areaSqm: assetToEdit?.metadata?.area_m2 as number,
                postalCode: assetToEdit?.metadata?.postal_code as string,
                street: assetToEdit?.metadata?.street as string,
                neighborhood: assetToEdit?.metadata?.neighborhood as string,
                city: assetToEdit?.metadata?.city as string,
                state: assetToEdit?.metadata?.state as string,
                latitude: assetToEdit?.metadata?.latitude as number,
                longitude: assetToEdit?.metadata?.longitude as number,
                acquisitionDate: assetToEdit?.acquisition_date || undefined,
                acquisitionValue: assetToEdit?.acquisition_value,
                currentValue: assetToEdit?.current_value,
                radarScore: assetToEdit?.metadata?.radar_score as number,
                infrastructureClassification:
                  assetToEdit?.metadata?.infrastructure_classification as string,
                attractivenessMultiplier:
                  assetToEdit?.metadata?.sqm_attractiveness_multiplier as number,
              }}
              onChange={(data) => setLandData(data)}
            />
          )}

          {category === "fgts" && (
            <FgtsCalculatorCard
              hideValues={isPrivacyMode}
              initialData={{
                name: assetToEdit?.name,
                companyName: assetToEdit?.metadata?.company_name as string,
                grossSalary: assetToEdit?.metadata?.gross_salary as number,
                currentBalance: assetToEdit?.current_value,
                projectionMonths: assetToEdit?.metadata?.projection_months as number,
              }}
              onChange={(data) => setFgtsData(data)}
            />
          )}

          {category === "other" && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                  Nome do Ativo Alternativo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Reserva em Ouro Físico, Coleção de Arte"
                  value={otherName}
                  onChange={(e) => setOtherName(e.target.value)}
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#FF8216]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                  Valor Estimado de Avaliação (R$)
                </label>
                <input
                  type="number"
                  step="100"
                  placeholder="0,00"
                  value={otherValue || ""}
                  onChange={(e) => setOtherValue(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white tabular-nums outline-none focus:border-[#FF8216]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                  Notas / Detalhes de Custódia
                </label>
                <textarea
                  rows={3}
                  placeholder="Detalhes adicionais de localização, certificado de autenticidade ou liquidez..."
                  value={otherNotes}
                  onChange={(e) => setOtherNotes(e.target.value)}
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl p-3 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#FF8216]"
                />
              </div>
            </div>
          )}

          {/* Rodapé com Ações */}
          <div className="pt-4 border-t border-[#27272A] flex items-center justify-between gap-3">
            {assetToEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-3.5 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Excluir Ativo
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-[#FF8216] hover:bg-[#e57413] text-black text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-md shadow-[#FF8216]/20 disabled:opacity-50"
              >
                {isSubmitting
                  ? "Salvando..."
                  : assetToEdit
                    ? "Salvar Alterações"
                    : "Adicionar ao Patrimônio"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}
