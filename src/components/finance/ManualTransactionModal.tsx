"use client";

import React, { useState, useRef } from "react";
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
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState(2);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Leitura inteligente de Comprovante ou Nota Fiscal via IA
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("O documento excede o limite de 10 MB.");
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);
    setScanSuccess(false);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const res = await fetch("/api/ai/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: base64Data,
          mimeType: file.type || "image/jpeg",
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Não foi possível ler o comprovante.");
      }

      if (resData.data) {
        const d = resData.data;
        if (d.description) setDescription(d.description);
        if (d.amount > 0) setAmountStr(d.amount.toFixed(2).replace(".", ","));
        if (d.date) setDate(d.date);
        if (d.category) setCategory(d.category);
        if (d.type) setType(d.type);
        if (d.isInstallment && d.totalInstallments > 1) {
          setIsInstallment(true);
          setInstallmentsCount(d.totalInstallments);
        }
        setScanSuccess(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao analisar o documento.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
          isInstallment,
          installmentsCount: isInstallment ? installmentsCount : 1,
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
      <div className="w-full max-w-lg rounded-3xl bg-[#121214] border border-[#27272A] p-6 shadow-2xl space-y-5 text-left my-8">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E11D48]/10 text-[#E11D48] border border-[#E11D48]/25 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Lançamento Financeiro Manual</h3>
              <p className="text-[11px] text-zinc-400">
                Dinheiro físico, comprovantes Pix, notas fiscais ou contas avulsas
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

        {/* ÁREA DE IMPORTAÇÃO / LEITURA INTELIGENTE POR IA */}
        <div className="p-3.5 rounded-2xl bg-[#18181B]/80 border border-dashed border-[#27272A] hover:border-[#E11D48]/50 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileUpload}
            className="hidden"
            id="receipt-file-input"
            disabled={isScanning || isLoading}
          />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#E11D48]/10 text-[#E11D48] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px]">document_scanner</span>
              </div>
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Ler Comprovante com IA</span>
                  {scanSuccess && (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                      ✓ Preenchido
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-zinc-400">
                  Foto de cupom, comprovante Pix, nota fiscal ou fatura (extrai dados na hora)
                </p>
              </div>
            </div>

            <label
              htmlFor="receipt-file-input"
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                isScanning
                  ? "bg-zinc-700 text-zinc-300 cursor-not-allowed"
                  : "bg-white hover:bg-zinc-200 text-black shadow-xs"
              }`}
            >
              {isScanning ? (
                <>
                  <Spinner size={13} className="text-zinc-300" />
                  <span>Analisando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[15px]">upload_file</span>
                  <span>Anexar</span>
                </>
              )}
            </label>
          </div>
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
                className="w-full h-11 pl-11 pr-4 rounded-xl bg-[#18181B] border border-[#27272A] text-white text-lg font-bold font-mono focus:outline-none focus:border-[#E11D48] transition-colors"
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-[11px] font-medium text-zinc-400 block mb-1">
              Descrição / Estabelecimento
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Almoço no Restaurante, Combustível, Pix João..."
              required
              className="w-full h-10 px-3.5 rounded-xl bg-[#18181B] border border-[#27272A] text-white text-xs focus:outline-none focus:border-[#E11D48] transition-colors"
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
                className="w-full h-10 px-3 rounded-xl bg-[#18181B] border border-[#27272A] text-white text-xs focus:outline-none focus:border-[#E11D48] transition-colors"
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
                Data do Pagamento
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#18181B] border border-[#27272A] text-white text-xs focus:outline-none focus:border-[#E11D48] transition-colors"
              />
            </div>
          </div>

          {/* Conta de Origem / Destino */}
          <div>
            <label className="text-[11px] font-medium text-zinc-400 block mb-1">
              Origem dos Fundos
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#18181B] border border-[#27272A] text-white text-xs focus:outline-none focus:border-[#E11D48] transition-colors"
            >
              <option value="">Carteira / Dinheiro em Espécie (Físico)</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.bank_name || acc.institution_name} • {acc.product_name || acc.name} (Saldo: R$ {(Number(acc.balance) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                </option>
              ))}
            </select>
          </div>

          {/* Opção de Compra Parcelada */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isInstallment}
                onChange={(e) => setIsInstallment(e.target.checked)}
                className="w-4 h-4 rounded border-[#27272A] bg-[#18181B] text-[#E11D48] focus:ring-0 cursor-pointer"
              />
              <span className="text-xs text-zinc-300 font-medium">
                Compra ou entrada parcelada
              </span>
            </label>

            {isInstallment && (
              <div className="mt-2 pl-6 flex items-center gap-2 animate-in fade-in">
                <span className="text-xs text-zinc-400">Dividido em:</span>
                <select
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(Number(e.target.value))}
                  className="h-8 px-2.5 rounded-lg bg-[#18181B] border border-[#27272A] text-white text-xs"
                >
                  {Array.from({ length: 47 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>
                      {n}x de R${" "}
                      {(
                        (parseFloat(amountStr.replace(/\./g, "").replace(",", ".")) || 0) /
                        n
                      ).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading || isScanning}
              className="flex-1 h-10 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-zinc-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || isScanning}
              className="flex-1 h-10 rounded-xl bg-white hover:bg-zinc-200 active:bg-zinc-300 text-black text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
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
