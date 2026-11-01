"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { WfIcons } from "@/components/wealthfolio/WealthfolioIcons";
import Spinner from "@/components/Spinner";

interface ManualTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: any[];
  onSuccess?: () => void;
}

const COMMON_CATEGORIES = [
  "Alimentação & Restaurantes",
  "Supermercado",
  "Transporte & Combustível",
  "Moradia & Contas",
  "Saúde & Farmácia",
  "Lazer & Entretenimento",
  "Compras & Vestuário",
  "Serviços & Assinaturas",
  "Rendimento & Vendas",
  "Outros",
];

export function ManualTransactionModal({
  isOpen,
  onClose,
  accounts,
  onSuccess,
}: ManualTransactionModalProps) {
  const [type, setType] = useState<"DEBIT" | "CREDIT">("DEBIT");
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [category, setCategory] = useState("Alimentação & Restaurantes");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanAmount = amountStr.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleanAmount);
    if (!description.trim() || isNaN(num) || num <= 0) {
      setErrorMessage("Informe uma descrição e um valor válido maior que zero.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/transactions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          amount: num,
          type,
          category,
          accountId: accountId || null,
          date,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao registrar lançamento.");
      }

      // Limpa os campos e fecha
      setDescription("");
      setAmountStr("");
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || "Falha na gravação.");
    } finally {
      setIsLoading(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="w-full max-w-md rounded-3xl bg-[#121214] border border-[#27272A] p-6 shadow-2xl space-y-5 text-left">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FF8216]/10 text-[#FF8216] border border-[#FF8216]/25 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">payments</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Novo Lançamento Manual</h3>
              <p className="text-[11px] text-zinc-400">
                Gasto em dinheiro físico ou entrada sem Open Finance
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <WfIcons.Close size={16} />
          </button>
        </div>

        {/* Tipo de Transação (Despesa vs Receita) */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#18181B] border border-[#27272A]">
          <button
            type="button"
            onClick={() => setType("DEBIT")}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              type === "DEBIT"
                ? "bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">arrow_downward</span>
            <span>Gasto / Saída</span>
          </button>
          <button
            type="button"
            onClick={() => setType("CREDIT")}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              type === "CREDIT"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">arrow_upward</span>
            <span>Entrada / Receita</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Valor */}
          <div>
            <label className="text-[11px] font-medium text-zinc-400 block mb-1">
              Valor (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value.replace(/[^\d,.]/g, ""))}
                placeholder="0,00"
                required
                className="w-full h-11 pl-11 pr-4 rounded-xl bg-[#18181B] border border-[#27272A] text-white text-lg font-bold font-mono focus:outline-none focus:border-[#FF8216] transition-colors"
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-[11px] font-medium text-zinc-400 block mb-1">
              Descrição do Lançamento
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Padaria em dinheiro, Feira, Gorjeta..."
              required
              className="w-full h-10 px-3.5 rounded-xl bg-[#18181B] border border-[#27272A] text-white text-xs focus:outline-none focus:border-[#FF8216] transition-colors"
            />
          </div>

          {/* Categoria e Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#18181B] border border-[#27272A] text-white text-xs focus:outline-none focus:border-[#FF8216] transition-colors"
              >
                {COMMON_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                Data
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#18181B] border border-[#27272A] text-white text-xs focus:outline-none focus:border-[#FF8216] transition-colors"
              />
            </div>
          </div>

          {/* Conta de Origem / Destino */}
          <div>
            <label className="text-[11px] font-medium text-zinc-400 block mb-1">
              Conta de Origem
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#18181B] border border-[#27272A] text-white text-xs focus:outline-none focus:border-[#FF8216] transition-colors"
            >
              <option value="">Carteira / Dinheiro em Espécie (Físico)</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.bank_name || acc.institution_name} • {acc.product_name || acc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 h-10 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-zinc-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 h-10 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] text-black text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                <Spinner size={16} className="text-black" />
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Salvar Lançamento</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}
