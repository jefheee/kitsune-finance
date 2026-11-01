"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  simulateFgtsProjection,
  type FgtsSimulationResult,
} from "@/utils/finance/engine/fgts";

export interface FgtsFormData {
  name: string;
  companyName: string;
  grossSalary: number;
  currentBalance: number;
  monthlyDeposit: number;
  projectionMonths: number;
}

interface FgtsCalculatorCardProps {
  initialData?: Partial<FgtsFormData>;
  onChange?: (data: FgtsFormData, simulation: FgtsSimulationResult) => void;
  hideValues?: boolean;
}

export function FgtsCalculatorCard({
  initialData,
  onChange,
  hideValues = false,
}: FgtsCalculatorCardProps) {
  const [companyName, setCompanyName] = useState(
    initialData?.companyName || "Empresa Atual (CLT)"
  );
  const [grossSalary, setGrossSalary] = useState<number>(
    initialData?.grossSalary || 8500
  );
  const [currentBalance, setCurrentBalance] = useState<number>(
    initialData?.currentBalance || 35000
  );
  const [projectionMonths, setProjectionMonths] = useState<number>(
    initialData?.projectionMonths || 12
  );

  const simulation = useMemo(() => {
    return simulateFgtsProjection(currentBalance, grossSalary, projectionMonths, {
      depositRate: 0.08,
      trAnnualPct: 1.15,
      ipcaAnnualPct: 4.83,
      cdiAnnualPct: 14.15,
    });
  }, [currentBalance, grossSalary, projectionMonths]);

  useEffect(() => {
    if (!onChange) return;
    const monthlyDeposit = Math.round(grossSalary * 0.08 * 100) / 100;
    onChange(
      {
        name: `FGTS • ${companyName}`,
        companyName,
        grossSalary,
        currentBalance,
        monthlyDeposit,
        projectionMonths,
      },
      simulation
    );
  }, [companyName, grossSalary, currentBalance, projectionMonths, simulation, onChange]);

  const formatCurrency = (val: number) => {
    if (hideValues) return "R$ ••••••";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  return (
    <div className="space-y-4 text-zinc-100">
      {/* IDENTIFICAÇÃO DO VÍNCULO CLT */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Empresa Empregadora / Vínculo
          </label>
          <input
            type="text"
            placeholder="Ex: Empresa X Ltda"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#E11D48]"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Horizonte de Projeção
          </label>
          <select
            value={projectionMonths}
            onChange={(e) => setProjectionMonths(parseInt(e.target.value, 10))}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#E11D48]"
          >
            <option value={12}>12 meses (1 ano)</option>
            <option value={24}>24 meses (2 anos)</option>
            <option value={36}>36 meses (3 anos)</option>
            <option value={60}>60 meses (5 anos)</option>
          </select>
        </div>
      </div>

      {/* SALÁRIO BRUTO E SALDO ATUAL FGTS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Salário Bruto Registrado (R$)
          </label>
          <input
            type="number"
            step="100"
            placeholder="8.500,00"
            value={grossSalary || ""}
            onChange={(e) => setGrossSalary(parseFloat(e.target.value) || 0)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white tabular-nums outline-none focus:border-[#E11D48]"
          />
          <span className="text-[10px] text-zinc-500 mt-1 block">
            Aporte compulsório mensal (8% CLT):{" "}
            <span className="text-zinc-300 font-semibold">{formatCurrency(grossSalary * 0.08)}</span>
          </span>
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Saldo Atual na Conta Caixa (R$)
          </label>
          <input
            type="number"
            step="100"
            placeholder="35.000,00"
            value={currentBalance || ""}
            onChange={(e) => setCurrentBalance(parseFloat(e.target.value) || 0)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white tabular-nums outline-none focus:border-[#E11D48]"
          />
          <span className="text-[10px] text-zinc-500 mt-1 block">
            Corrigido todo dia 10 por (1+TR) × (1+0,002466)
          </span>
        </div>
      </div>

      {/* RESUMO DETERMINÍSTICO DA PROJEÇÃO OFICIAL CAIXA */}
      <div className="p-4 bg-gradient-to-br from-[#18181B] to-[#121214] border border-[#27272A] rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#E11D48] block">
              Projeção Caixa • {projectionMonths} Meses
            </span>
            <h4 className="text-sm font-semibold text-white">Saldo Nominal Projetado</h4>
          </div>
          <div className="text-right">
            <span className="text-base sm:text-lg font-bold text-white tabular-nums">
              {formatCurrency(simulation.finalNominalBalance)}
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold block">
              +{formatCurrency(simulation.totalInterestEarned)} de juros TR+3%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#27272A]">
          <div className="p-2 bg-[#121214] rounded-lg border border-[#27272A]/70">
            <span className="text-[10px] text-zinc-500 uppercase block">Total Aportado</span>
            <span className="text-xs font-semibold tabular-nums text-zinc-200">
              {formatCurrency(simulation.totalDeposited)}
            </span>
          </div>

          <div className="p-2 bg-[#121214] rounded-lg border border-[#27272A]/70">
            <span className="text-[10px] text-zinc-500 uppercase block">Poder Real (Fisher)</span>
            <span className="text-xs font-semibold tabular-nums text-blue-400">
              {formatCurrency(simulation.realPurchasingPower)}
            </span>
          </div>

          <div className="p-2 bg-[#121214] rounded-lg border border-[#27272A]/70">
            <span className="text-[10px] text-zinc-500 uppercase block">Perda Inflacionária</span>
            <span className="text-xs font-semibold tabular-nums text-rose-400">
              -{formatCurrency(simulation.realInflationLoss)}
            </span>
          </div>

          <div className="p-2 bg-[#121214] rounded-lg border border-[#27272A]/70">
            <span className="text-[10px] text-zinc-500 uppercase block">Custo Oportunidade CDI</span>
            <span className="text-xs font-semibold tabular-nums text-amber-400">
              {formatCurrency(simulation.cdiOpportunityCostBalance)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
