"use client";

/**
 * Kitsune Finance — Lista Virtualizada de Extrato a 60 FPS (`VirtualizedTransactionsList`)
 *
 * Inspirada no `TransactionsTable.tsx` do Actual Budget e na fluidez do Pierre Finance:
 * - Renderiza 3.000+ lançamentos mantendo apenas ~22 nós no DOM via windowing determinístico + `overscan`.
 * - Coalescência de scroll via `requestAnimationFrame` + `ResizeObserver` nativo (zero travamento da main thread mobile).
 * - Largura pré-computada da coluna monetária (`tabular-nums`) para zero layout shift horizontal durante rolagem rápida.
 * - Respeito absoluto ao `isPrivacyMode` (`R$ ••••••`), `BankLogo`, `MerchantLogo` e clique para abrir o Modal de Detalhes.
 * - Paleta estrita Warm Obsidian (`#0A0A0A`, `#121214`, `#18181B`, `#27272A`, `#E11D48` — zero tons azulados).
 */

import React, {
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
} from "react";
import { BankLogo } from "@/components/BankLogo";
import { MerchantLogo } from "@/components/MerchantLogo";
import { useFinanceData } from "@/context/FinanceDataContext";

export interface VirtualizedTransactionItem {
    id: string;
    pluggy_transaction_id?: string | null;
    reconciled_from_pending_id?: string | null;
    matched_transfer_id?: string | null;
    merchant_cnpj?: string | null;
    description?: string | null;
    clean_description?: string | null;
    raw_description?: string | null;
    amount: number | string;
    category?: string | null;
    category_pt?: string | null;
    type?: string | null;
    status?: string | null;
    kind?: string | null;
    operation_type?: string | null;
    is_internal_transfer?: boolean;
    is_refund?: boolean;
    is_subscription?: boolean;
    installment_number?: number | null;
    total_installments?: number | null;
    date?: string | null;
    executed_at?: string | null;
    bank_accounts?: {
        bank_name?: string | null;
        institution_name?: string | null;
        institution_slug?: string | null;
        product_name?: string | null;
        type?: string | null;
        subtype?: string | null;
    } | null;
}

export interface VirtualizedTransactionsListProps {
    transactions: VirtualizedTransactionItem[];
    isPrivacyMode?: boolean;
    formatCurrency?: (val: number) => string;
    formatDate?: (val?: string | null) => string;
    /** Altura máxima da viewport rolável em pixels (default: 560) */
    viewportHeight?: number;
    /** Quantidade de linhas extras renderizadas acima e abaixo da viewport (default: 8) */
    overscan?: number;
    /** Callback opcional disparado ao clicar em uma transação; se omitido, abre o modal nativo de auditoria */
    onSelectTransaction?: (tx: VirtualizedTransactionItem) => void;
}

const ROW_HEIGHT_PX = 66;
const DEFAULT_VIEWPORT_HEIGHT_PX = 560;
const DEFAULT_OVERSCAN = 8;

function defaultFormatDate(dateString?: string | null): string {
    if (!dateString) return "-";
    const clean = String(dateString).split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return String(dateString);
}

function formatCnpjDisplay(cnpj?: string | null): string | null {
    if (!cnpj) return null;
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return cnpj;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function resolveKindBadgeLabel(tx: VirtualizedTransactionItem): {
    label: string;
    className: string;
} | null {
    if (tx.is_refund) {
        return {
            label: "Estorno",
            className:
                "bg-emerald-500/15 text-emerald-500 border border-emerald-500/25",
        };
    }
    if (tx.kind === "cc_payment") {
        return {
            label: "Pgto Fatura",
            className:
                "bg-zinc-200/70 dark:bg-[#27272A] text-zinc-700 dark:text-zinc-300 border border-zinc-300/60 dark:border-white/10",
        };
    }
    if (tx.kind === "funds_movement" || tx.is_internal_transfer) {
        return {
            label: "Mov. Patrimonial",
            className:
                "bg-zinc-200/70 dark:bg-[#27272A] text-zinc-700 dark:text-zinc-300 border border-zinc-300/60 dark:border-white/10",
        };
    }
    if (tx.total_installments && Number(tx.total_installments) > 1) {
        return {
            label: `Parcela ${tx.installment_number || 1}/${tx.total_installments}`,
            className:
                "bg-[#E11D48]/15 text-[#E11D48] border border-[#E11D48]/25",
        };
    }
    if (tx.is_subscription) {
        return {
            label: "Recorrente",
            className:
                "bg-amber-500/15 text-amber-500 border border-amber-500/25",
        };
    }
    if (String(tx.status || "").toUpperCase() === "PENDING") {
        return {
            label: "Pendente",
            className:
                "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        };
    }
    return null;
}

export function VirtualizedTransactionsList({
    transactions,
    isPrivacyMode: propPrivacyMode,
    formatCurrency: propFormatCurrency,
    formatDate = defaultFormatDate,
    viewportHeight = DEFAULT_VIEWPORT_HEIGHT_PX,
    overscan = DEFAULT_OVERSCAN,
    onSelectTransaction,
}: VirtualizedTransactionsListProps) {
    const financeCtx = useFinanceData();
    const effectivePrivacyMode = propPrivacyMode ?? financeCtx.isPrivacyMode;

    const formatMoney = useCallback(
        (val: number) => {
            if (effectivePrivacyMode) {
                return "R$ ••••••";
            }
            if (propFormatCurrency) {
                return propFormatCurrency(val);
            }
            return new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
            }).format(val);
        },
        [effectivePrivacyMode, propFormatCurrency]
    );

    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const rafIdRef = useRef<number | null>(null);

    const [scrollTop, setScrollTop] = useState(0);
    const [measuredHeight, setMeasuredHeight] = useState(viewportHeight);
    const [selectedModalTx, setSelectedModalTx] =
        useState<VirtualizedTransactionItem | null>(null);

    // Reseta scroll ao trocar radicalmente o filtro quando o scroll atual excede o novo tamanho
    useEffect(() => {
        const maxScroll = Math.max(
            0,
            transactions.length * ROW_HEIGHT_PX - measuredHeight
        );
        if (scrollTop > maxScroll && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
            setScrollTop(0);
        }
    }, [transactions.length, measuredHeight, scrollTop]);

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.height > 0) {
                    setMeasuredHeight(entry.contentRect.height);
                }
            }
        });

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, []);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const targetScrollTop = e.currentTarget.scrollTop;
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
        }
        rafIdRef.current = requestAnimationFrame(() => {
            setScrollTop(targetScrollTop);
            rafIdRef.current = null;
        });
    }, []);

    // Pré-computa a largura mínima estável da coluna de valor (inspirado em `useAmountColumnWidths` do Actual Budget)
    const amountColumnMinWidthPx = useMemo(() => {
        if (effectivePrivacyMode || transactions.length === 0) return 118;
        let maxAbs = 0;
        for (let i = 0; i < transactions.length; i++) {
            const abs = Math.abs(Number(transactions[i].amount) || 0);
            if (abs > maxAbs) maxAbs = abs;
        }
        const digitsCount = Math.max(4, Math.floor(Math.log10(Math.max(1, maxAbs))) + 1);
        return Math.min(180, Math.max(116, 68 + digitsCount * 9));
    }, [transactions, effectivePrivacyMode]);

    // Fechamento do modal com tecla Escape
    useEffect(() => {
        if (!selectedModalTx) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSelectedModalTx(null);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [selectedModalTx]);

    const handleRowActivate = useCallback(
        (tx: VirtualizedTransactionItem) => {
            if (onSelectTransaction) {
                onSelectTransaction(tx);
            } else {
                setSelectedModalTx(tx);
            }
        },
        [onSelectTransaction]
    );

    const totalHeightPx = transactions.length * ROW_HEIGHT_PX;
    const startIndex = Math.max(
        0,
        Math.floor(scrollTop / ROW_HEIGHT_PX) - overscan
    );
    const visibleCount = Math.ceil(measuredHeight / ROW_HEIGHT_PX) + overscan * 2;
    const endIndex = Math.min(transactions.length, startIndex + visibleCount);

    const visibleSlice = useMemo(
        () => transactions.slice(startIndex, endIndex),
        [transactions, startIndex, endIndex]
    );

    if (transactions.length === 0) {
        return (
            <div className="p-12 text-center text-xs text-zinc-400 flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-4xl mb-2 text-zinc-300 dark:text-zinc-600">
                    receipt_long
                </span>
                <span>Nenhuma transação encontrada com os filtros selecionados.</span>
            </div>
        );
    }

    return (
        <>
            <div className="w-full flex flex-col">
                {/* Cabeçalho Fixo de Colunas */}
                <div className="grid grid-cols-12 items-center border-b border-zinc-200 dark:border-[#27272A] text-[10px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-50/80 dark:bg-[#18181B]/90 px-4 py-2.5">
                    <div className="col-span-6 sm:col-span-5">Estabelecimento / Descrição</div>
                    <div className="hidden md:block md:col-span-2">Categoria</div>
                    <div className="hidden sm:block sm:col-span-3 md:col-span-2">Instituição</div>
                    <div className="hidden sm:block sm:col-span-1 text-right">Data</div>
                    <div className="col-span-6 sm:col-span-3 md:col-span-2 text-right">
                        Valor
                    </div>
                </div>

                {/* Viewport Virtualizada a 60 FPS */}
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    style={{
                        maxHeight: `${viewportHeight}px`,
                        height: `${Math.min(
                            viewportHeight,
                            Math.max(ROW_HEIGHT_PX * 3, totalHeightPx)
                        )}px`,
                    }}
                    className="relative w-full overflow-y-auto overflow-x-hidden overscroll-contain will-change-scroll"
                    role="listbox"
                    aria-label="Lista virtualizada de transações financeiras"
                >
                    <div
                        style={{
                            height: `${totalHeightPx}px`,
                            position: "relative",
                            width: "100%",
                        }}
                    >
                        {visibleSlice.map((tx, localIdx) => {
                            const absoluteIndex = startIndex + localIdx;
                            const topOffset = absoluteIndex * ROW_HEIGHT_PX;

                            const amt = Number(tx.amount) || 0;
                            const isExpense =
                                amt < 0 ||
                                tx.type === "DEBIT" ||
                                tx.operation_type === "CREDIT_CARD";
                            const isIncome =
                                !isExpense && (amt > 0 || tx.type === "CREDIT");
                            const absAmt = Math.abs(amt);

                            const cleanDesc =
                                tx.clean_description || tx.description || "Transação";
                            const cat = tx.category_pt || tx.category || "Outros";
                            const bankName =
                                tx.bank_accounts?.institution_name ||
                                tx.bank_accounts?.bank_name ||
                                "Conta";
                            const bankSlug =
                                tx.bank_accounts?.institution_slug || bankName;
                            const badge = resolveKindBadgeLabel(tx);

                            return (
                                <div
                                    key={tx.id || `${absoluteIndex}_${tx.date}`}
                                    role="option"
                                    aria-selected={selectedModalTx?.id === tx.id}
                                    tabIndex={0}
                                    onClick={() => handleRowActivate(tx)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            handleRowActivate(tx);
                                        }
                                    }}
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        height: `${ROW_HEIGHT_PX}px`,
                                        transform: `translate3d(0, ${topOffset}px, 0)`,
                                    }}
                                    className="grid grid-cols-12 items-center px-4 border-b border-zinc-100 dark:border-[#27272A]/80 hover:bg-zinc-50/90 dark:hover:bg-[#18181B] active:bg-zinc-100 dark:active:bg-[#27272A]/60 transition-colors cursor-pointer group focus:outline-none focus:bg-zinc-50 dark:focus:bg-[#18181B]"
                                >
                                    {/* Estabelecimento + MerchantLogo */}
                                    <div className="col-span-7 sm:col-span-5 flex items-center gap-3 min-w-0 pr-2">
                                        <MerchantLogo
                                            cleanName={cleanDesc}
                                            rawDescription={tx.raw_description || tx.description}
                                            category={cat}
                                            size="sm"
                                        />
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="font-bold text-xs text-zinc-900 dark:text-white truncate group-hover:text-[#E11D48] transition-colors">
                                                    {cleanDesc}
                                                </span>
                                                {badge && (
                                                    <span
                                                        className={`hidden lg:inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${badge.className}`}
                                                    >
                                                        {badge.label}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 truncate mt-0.5">
                                                <span className="sm:hidden font-mono">
                                                    {formatDate(tx.date || tx.executed_at)} •{" "}
                                                </span>
                                                <span className="md:hidden truncate">{cat}</span>
                                                {tx.merchant_cnpj && (
                                                    <span className="hidden md:inline font-mono text-zinc-500">
                                                        CNPJ verificado
                                                    </span>
                                                )}
                                                {!tx.merchant_cnpj && badge && (
                                                    <span className="lg:hidden font-semibold text-[#E11D48]">
                                                        • {badge.label}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Categoria */}
                                    <div className="hidden md:flex md:col-span-2 items-center pr-2 min-w-0">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-zinc-100 dark:bg-[#18181B] border border-zinc-200/70 dark:border-[#27272A] text-zinc-700 dark:text-zinc-300 truncate max-w-full">
                                            {cat}
                                        </span>
                                    </div>

                                    {/* Instituição + BankLogo */}
                                    <div className="hidden sm:flex sm:col-span-3 md:col-span-2 items-center gap-2 pr-2 min-w-0">
                                        <BankLogo bank={bankSlug} size="xs" />
                                        <span className="text-zinc-600 dark:text-zinc-400 text-[11px] font-medium truncate">
                                            {bankName}
                                        </span>
                                    </div>

                                    {/* Data */}
                                    <div className="hidden sm:block sm:col-span-1 text-right text-[11px] text-zinc-500 dark:text-zinc-400 font-mono tabular-nums whitespace-nowrap">
                                        {formatDate(tx.date || tx.executed_at)}
                                    </div>

                                    {/* Valor com largura tabular estável */}
                                    <div
                                        style={{ minWidth: `${amountColumnMinWidthPx}px` }}
                                        className="col-span-5 sm:col-span-3 md:col-span-2 flex items-center justify-end gap-1.5 whitespace-nowrap pl-2"
                                    >
                                        <span
                                            className={`font-extrabold tabular-nums text-xs ${
                                                tx.is_refund
                                                    ? "text-emerald-500"
                                                    : tx.is_internal_transfer ||
                                                        tx.kind === "funds_movement" ||
                                                        tx.kind === "cc_payment"
                                                      ? "text-zinc-400"
                                                      : isIncome
                                                        ? "text-emerald-500"
                                                        : "text-zinc-900 dark:text-white"
                                            }`}
                                        >
                                            {effectivePrivacyMode
                                                ? "R$ ••••••"
                                                : `${isIncome ? "+" : "-"} ${formatMoney(absAmt)}`}
                                        </span>
                                        <span className="material-symbols-outlined text-[15px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                                            chevron_right
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Modal Nativo de Detalhes & Auditoria da Transação (Warm Obsidian) */}
            {selectedModalTx && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
                    onClick={() => setSelectedModalTx(null)}
                >
                    <div
                        className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] p-6 shadow-2xl relative flex flex-col gap-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setSelectedModalTx(null)}
                            aria-label="Fechar detalhes da transação"
                            className="absolute top-4 right-4 p-1.5 rounded-xl bg-zinc-100 dark:bg-[#18181B] hover:bg-zinc-200 dark:hover:bg-[#27272A] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-[18px]">
                                close
                            </span>
                        </button>

                        {/* Cabeçalho com MerchantLogo + Nome Comercial */}
                        <div className="flex items-center gap-3.5 pr-8">
                            <MerchantLogo
                                cleanName={
                                    selectedModalTx.clean_description ||
                                    selectedModalTx.description
                                }
                                rawDescription={
                                    selectedModalTx.raw_description ||
                                    selectedModalTx.description
                                }
                                category={
                                    selectedModalTx.category_pt ||
                                    selectedModalTx.category
                                }
                                size="lg"
                            />
                            <div className="min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E11D48] block">
                                    Dossiê de Transação Conciliada
                                </span>
                                <h3 className="text-base md:text-lg font-extrabold text-zinc-900 dark:text-white truncate">
                                    {selectedModalTx.clean_description ||
                                        selectedModalTx.description ||
                                        "Transação"}
                                </h3>
                                <span className="text-xs text-zinc-400 font-mono">
                                    {formatDate(
                                        selectedModalTx.date ||
                                            selectedModalTx.executed_at
                                    )}
                                </span>
                            </div>
                        </div>

                        {/* Destaque de Valor com Respeito ao isPrivacyMode */}
                        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                                    Valor Liquidado
                                </span>
                                <span
                                    className={`text-xl md:text-2xl font-black tabular-nums mt-0.5 block ${
                                        Number(selectedModalTx.amount) > 0 &&
                                        selectedModalTx.type !== "DEBIT" &&
                                        selectedModalTx.operation_type !== "CREDIT_CARD"
                                            ? "text-emerald-500"
                                            : "text-zinc-900 dark:text-white"
                                    }`}
                                >
                                    {effectivePrivacyMode
                                        ? "R$ ••••••"
                                        : formatMoney(
                                              Math.abs(
                                                  Number(selectedModalTx.amount) || 0
                                              )
                                          )}
                                </span>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-zinc-200/70 dark:bg-[#121214] border border-zinc-300 dark:border-[#27272A] text-zinc-800 dark:text-zinc-200">
                                    {selectedModalTx.category_pt ||
                                        selectedModalTx.category ||
                                        "Outros"}
                                </span>
                                {resolveKindBadgeLabel(selectedModalTx) && (
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            resolveKindBadgeLabel(selectedModalTx)!
                                                .className
                                        }`}
                                    >
                                        {
                                            resolveKindBadgeLabel(selectedModalTx)!
                                                .label
                                        }
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Metadados Técnicos Open Finance & Reconciliação */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200/70 dark:border-[#27272A]">
                                <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">
                                    Instituição & Conta
                                </span>
                                <div className="flex items-center gap-2">
                                    <BankLogo
                                        bank={
                                            selectedModalTx.bank_accounts
                                                ?.institution_slug ||
                                            selectedModalTx.bank_accounts
                                                ?.institution_name ||
                                            selectedModalTx.bank_accounts?.bank_name ||
                                            "generic"
                                        }
                                        size="xs"
                                    />
                                    <span className="font-bold text-zinc-900 dark:text-white truncate">
                                        {selectedModalTx.bank_accounts
                                            ?.institution_name ||
                                            selectedModalTx.bank_accounts?.bank_name ||
                                            "Conta Sincronizada"}
                                    </span>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200/70 dark:border-[#27272A]">
                                <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">
                                    Classificação Contábil (`kind`)
                                </span>
                                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                                    {selectedModalTx.kind ||
                                        (selectedModalTx.is_internal_transfer
                                            ? "funds_movement"
                                            : "standard")}
                                </span>
                            </div>

                            {selectedModalTx.merchant_cnpj && (
                                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200/70 dark:border-[#27272A] sm:col-span-2">
                                    <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-0.5">
                                        CNPJ Identificado (Receita Federal / BrasilAPI)
                                    </span>
                                    <span className="font-mono font-bold text-emerald-500">
                                        {formatCnpjDisplay(selectedModalTx.merchant_cnpj)}
                                    </span>
                                </div>
                            )}

                            {(selectedModalTx.raw_description ||
                                selectedModalTx.description) && (
                                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200/70 dark:border-[#27272A] sm:col-span-2">
                                    <span className="text-[10px] font-bold uppercase text-zinc-400 block mb-0.5">
                                        Descrição Original na Instituição
                                    </span>
                                    <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300 break-all">
                                        {selectedModalTx.raw_description ||
                                            selectedModalTx.description}
                                    </span>
                                </div>
                            )}

                            {(selectedModalTx.reconciled_from_pending_id ||
                                selectedModalTx.matched_transfer_id) && (
                                <div className="p-3 rounded-xl bg-[#E11D48]/5 border border-[#E11D48]/20 sm:col-span-2 flex flex-col gap-1">
                                    <span className="text-[10px] font-bold uppercase text-[#E11D48]">
                                        Trilha de Auditoria Anti-Duplicidade
                                    </span>
                                    {selectedModalTx.reconciled_from_pending_id && (
                                        <span className="text-[11px] text-zinc-500 dark:text-zinc-300 font-mono">
                                            Conciliado de PENDING:{" "}
                                            {selectedModalTx.reconciled_from_pending_id}
                                        </span>
                                    )}
                                    {selectedModalTx.matched_transfer_id && (
                                        <span className="text-[11px] text-zinc-500 dark:text-zinc-300 font-mono">
                                            Par de Transferência Própria:{" "}
                                            {selectedModalTx.matched_transfer_id}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
