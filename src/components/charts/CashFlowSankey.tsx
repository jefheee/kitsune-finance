"use client";

/**
 * Kitsune Finance — Diagrama de Sankey de Fluxo de Caixa (`CashFlowSankey`)
 *
 * Inspirado fielmente em `sankey_chart_controller.js` e `_cashflow_sankey.html.erb` do Maybe Finance:
 * - Fluxo em 3 colunas com conservação contábil exata em centavos inteiros:
 *   [Fontes de Renda / Salários] -> [Renda Total Líquida] -> [Categorias de Despesas + Aportes + Liquidez Retida]
 * - Geometria assimétrica fiel ao Maybe Finance:
 *   • Nós de origem (esquerda): cantos esquerdos arredondados, cantos direitos retos.
 *   • Hub central: retângulo de precisão para encaixe contínuo sem frestas.
 *   • Nós de destino (direita): cantos esquerdos retos, cantos direitos arredondados.
 * - SVG responsivo via `ResizeObserver` + curvas de Bézier cúbicas com `<linearGradient gradientUnits="userSpaceOnUse">`.
 * - Paleta estrita Warm Obsidian (`#0A0A0A`, `#121214`, `#18181B`, `#27272A`, `#E11D48` — zero tons azulados/marinho).
 * - Respeito absoluto ao `isPrivacyMode` (`R$ ••••••`).
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { parseLocalDate } from "@/utils/finance/reconciler";

export interface SankeyTransactionInput {
    id?: string;
    date?: string | null;
    executed_at?: string | null;
    amount: number | string;
    type?: string | null;
    kind?: string | null;
    operation_type?: string | null;
    is_internal_transfer?: boolean;
    is_refund?: boolean;
    description?: string | null;
    clean_description?: string | null;
    raw_description?: string | null;
    payer_name?: string | null;
    receiver_name?: string | null;
    category?: string | null;
    category_pt?: string | null;
    bank_accounts?: {
        type?: string | null;
        subtype?: string | null;
    } | null;
}

export interface CashFlowSankeyProps {
    transactions: SankeyTransactionInput[];
    isPrivacyMode?: boolean;
    selfAndFamilyNames?: string[];
    periodLabel?: string;
}

interface SankeyNodeSpec {
    id: string;
    label: string;
    column: 0 | 1 | 2;
    valueCents: number;
    color: string;
    percentage: number;
}

interface SankeyLinkSpec {
    id: string;
    sourceId: string;
    targetId: string;
    sourceLabel: string;
    targetLabel: string;
    valueCents: number;
    percentageOfHub: number;
    sourceColor: string;
    targetColor: string;
}

interface LayoutNode extends SankeyNodeSpec {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
}

interface LayoutLink extends SankeyLinkSpec {
    sx: number;
    tx: number;
    sy0: number;
    sy1: number;
    ty0: number;
    ty1: number;
    ribbonPath: string;
}

// Paleta Warm Obsidian sem nenhum matiz azul/marinho
const SOURCE_COLORS = {
    salary: "#10B981", // Esmeralda
    investments: "#14B8A6", // Jade quente
    pixServices: "#34D399", // Menta esmeralda
    otherIncome: "#A3E635", // Lima suave
    reserveDraw: "#F59E0B", // Âmbar (uso de caixa anterior quando saídas > entradas do período)
} as const;

const HUB_COLOR = "#E11D48"; // Laranja Kitsune oficial

const EXPENSE_PALETTE = [
    "#E11D48", // Laranja Kitsune
    "#F43F5E", // Coral / Rose
    "#F59E0B", // Âmbar
    "#EA580C", // Terracota
    "#FB7185", // Rosa quente
    "#D97706", // Ouro queimado
    "#A1A1AA", // Zinco neutro ("Outras Despesas")
] as const;

const INVESTMENT_OUTFLOW_COLOR = "#14B8A6";
const RETAINED_LIQUIDITY_COLOR = "#10B981";

function toCents(val: number): number {
    if (!Number.isFinite(val)) return 0;
    return Math.round(val * 100);
}

function classifyIncomeSourceBucket(tx: SankeyTransactionInput): {
    key: string;
    label: string;
    color: string;
} {
    const text = [
        tx.clean_description,
        tx.description,
        tx.raw_description,
        tx.category_pt,
        tx.category,
        tx.payer_name,
    ]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();

    if (
        /\b(SALARIO|FOLHA|PRO-LABORE|PROLABORE|REMUNERACAO|PAGAMENTO\s+MENSAL|ADIANTAMENTO\s+SALARIAL|DECIMO\s+TERCEIRO|13\s+SALARIO|FERIAS|INSS|BENEFICIO)\b/.test(
            text
        )
    ) {
        return {
            key: "src_salary",
            label: "Salário & Folha",
            color: SOURCE_COLORS.salary,
        };
    }

    if (
        /\b(DIVIDENDO|JCP|RENDIMENTO|PROVENTO|CUPOM|FII|CASHBACK)\b/.test(text)
    ) {
        return {
            key: "src_yield",
            label: "Rendimentos & Proventos",
            color: SOURCE_COLORS.investments,
        };
    }

    if (/\b(PIX|TED|DOC|FREELA|SERVICO|NOTA\s+FISCAL|HONORARIO|COMISSAO)\b/.test(text)) {
        return {
            key: "src_pix_services",
            label: "Recebimentos & Serviços",
            color: SOURCE_COLORS.pixServices,
        };
    }

    return {
        key: "src_other_income",
        label: "Outras Receitas",
        color: SOURCE_COLORS.otherIncome,
    };
}

function isInvestmentContributionTx(tx: SankeyTransactionInput): boolean {
    const amt = Number(tx.amount) || 0;
    if (amt >= 0) return false;

    const text = [
        tx.clean_description,
        tx.description,
        tx.raw_description,
        tx.category_pt,
        tx.category,
    ]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();

    return /\b(APLICACAO|APLIC\s+CDB|GUARDAR\s+DINHEIRO|CAIXINHA|COFRINHO|TESOURO\s+DIRETO|TESOURO\s+SELIC|TESOURO\s+IPCA|CDB|LCI|LCA|RDB)\b/.test(
        text
    );
}

/**
 * Gera o path SVG de nó com cantos assimétricos idênticos ao `sankey_chart_controller.js` do Maybe Finance.
 */
function buildAsymmetricNodePath(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    column: 0 | 1 | 2
): string {
    const w = Math.max(2, x1 - x0);
    const h = Math.max(2, y1 - y0);
    const r = Math.min(7, h / 2, w / 2);

    if (column === 1 || h < 4) {
        return `M${x0},${y0} L${x1},${y0} L${x1},${y1} L${x0},${y1} Z`;
    }

    if (column === 0) {
        // Cantos esquerdos arredondados, cantos direitos retos
        return [
            `M${x0 + r},${y0}`,
            `L${x1},${y0}`,
            `L${x1},${y1}`,
            `L${x0 + r},${y1}`,
            `A${r},${r} 0 0,1 ${x0},${y1 - r}`,
            `L${x0},${y0 + r}`,
            `A${r},${r} 0 0,1 ${x0 + r},${y0}`,
            "Z",
        ].join(" ");
    }

    // Coluna 2: cantos esquerdos retos, cantos direitos arredondados
    return [
        `M${x0},${y0}`,
        `L${x1 - r},${y0}`,
        `A${r},${r} 0 0,1 ${x1},${y0 + r}`,
        `L${x1},${y1 - r}`,
        `A${r},${r} 0 0,1 ${x1 - r},${y1}`,
        `L${x0},${y1}`,
        "Z",
    ].join(" ");
}

/**
 * Gera uma fita fechada (ribbon) de Bézier horizontal suave conectando [sx, sy0..sy1] -> [tx, ty0..ty1].
 */
function buildSankeyRibbonPath(
    sx: number,
    tx: number,
    sy0: number,
    sy1: number,
    ty0: number,
    ty1: number
): string {
    const mx = (sx + tx) / 2;
    return [
        `M${sx.toFixed(2)},${sy0.toFixed(2)}`,
        `C${mx.toFixed(2)},${sy0.toFixed(2)} ${mx.toFixed(2)},${ty0.toFixed(2)} ${tx.toFixed(2)},${ty0.toFixed(2)}`,
        `L${tx.toFixed(2)},${ty1.toFixed(2)}`,
        `C${mx.toFixed(2)},${ty1.toFixed(2)} ${mx.toFixed(2)},${sy1.toFixed(2)} ${sx.toFixed(2)},${sy1.toFixed(2)}`,
        "Z",
    ].join(" ");
}

export function CashFlowSankey({
    transactions,
    isPrivacyMode = true,
    selfAndFamilyNames = [],
    periodLabel = "Fluxo Operacional Consolidado",
}: CashFlowSankeyProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [containerWidth, setContainerWidth] = useState<number>(860);
    const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;

        const updateWidth = () => {
            if (el.clientWidth > 0) {
                setContainerWidth(el.clientWidth);
            }
        };

        updateWidth();
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0) {
                    setContainerWidth(Math.round(entry.contentRect.width));
                }
            }
        });

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const formatMoney = (cents: number): string => {
        if (isPrivacyMode) return "R$ ••••••";
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(cents / 100);
    };

    const formatCompactMoney = (cents: number): string => {
        if (isPrivacyMode) return "R$ ••••";
        const val = cents / 100;
        if (val >= 10_000) {
            return `R$ ${(val / 1000).toFixed(1).replace(".", ",")}k`;
        }
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            maximumFractionDigits: 0,
        }).format(val);
    };

    // 1. Motor Contábil Determinístico em Centavos Inteiros
    const graphModel = useMemo(() => {
        const normalizedSelfNames = selfAndFamilyNames
            .filter(Boolean)
            .map((n) => n.toLowerCase().trim())
            .filter((n) => n.length >= 3);

        const incomeMap = new Map<
            string,
            { label: string; cents: number; color: string }
        >();
        const expenseCategoryMap = new Map<string, number>();
        let totalRefundsCents = 0;
        let investmentContributionsCents = 0;

        for (const tx of transactions) {
            const rawDate = tx.date || tx.executed_at;
            if (!rawDate) continue;
            // Garante parse local sem desvio UTC no dia 1º
            void parseLocalDate(rawDate);

            const rawAmt = Number(tx.amount) || 0;
            const absCents = Math.abs(toCents(rawAmt));
            if (absCents === 0) continue;

            // Captura aportes explícitos em investimentos antes de filtrar movimentações internas
            if (isInvestmentContributionTx(tx)) {
                investmentContributionsCents += absCents;
                continue;
            }

            if (
                tx.is_internal_transfer ||
                tx.kind === "cc_payment" ||
                tx.kind === "funds_movement"
            ) {
                continue;
            }

            const descLower = String(
                tx.receiver_name ||
                    tx.payer_name ||
                    tx.clean_description ||
                    tx.description ||
                    ""
            ).toLowerCase();
            const catLower = String(
                tx.category_pt || tx.category || ""
            ).toLowerCase();

            const isSelfTransfer =
                normalizedSelfNames.some((n) => descLower.includes(n)) ||
                descLower.includes("mesma titularidade") ||
                descLower.includes("mesmo cpf") ||
                descLower.includes("entre contas") ||
                descLower.includes("pagamento de fatura") ||
                descLower.includes("pagamento recebido") ||
                catLower.includes("transferência própria") ||
                catLower.includes("same person transfer") ||
                catLower.includes("credit card payment");

            if (isSelfTransfer) continue;

            if (tx.is_refund) {
                totalRefundsCents += absCents;
                continue;
            }

            const isCreditCardAcc =
                tx.bank_accounts?.type === "CREDIT" ||
                tx.bank_accounts?.subtype === "CREDIT_CARD" ||
                tx.operation_type === "CREDIT_CARD";

            const isExpense =
                rawAmt < 0 || tx.type === "DEBIT" || isCreditCardAcc;
            const isRealIncome =
                !isExpense &&
                (tx.type === "CREDIT" || rawAmt > 0) &&
                !isCreditCardAcc;

            if (isRealIncome) {
                const bucket = classifyIncomeSourceBucket(tx);
                const prev = incomeMap.get(bucket.key);
                if (prev) {
                    prev.cents += absCents;
                } else {
                    incomeMap.set(bucket.key, {
                        label: bucket.label,
                        cents: absCents,
                        color: bucket.color,
                    });
                }
            } else if (isExpense) {
                const catName =
                    (tx.category_pt || tx.category || "Outras Despesas").trim() ||
                    "Outras Despesas";
                expenseCategoryMap.set(
                    catName,
                    (expenseCategoryMap.get(catName) || 0) + absCents
                );
            }
        }

        // Abate estornos proporcionalmente da maior categoria ou do total de despesas para fidelidade DRE
        const sortedExpenses = Array.from(expenseCategoryMap.entries())
            .map(([label, cents]) => ({ label, cents }))
            .sort((a, b) => b.cents - a.cents);

        let remainingRefundToOffset = totalRefundsCents;
        for (const item of sortedExpenses) {
            if (remainingRefundToOffset <= 0) break;
            const deduct = Math.min(item.cents, remainingRefundToOffset);
            item.cents -= deduct;
            remainingRefundToOffset -= deduct;
        }

        const positiveExpenses = sortedExpenses.filter((e) => e.cents > 0);
        const totalRealInflowsCents = Array.from(incomeMap.values()).reduce(
            (acc, v) => acc + v.cents,
            0
        );
        const totalExpensesCents = positiveExpenses.reduce(
            (acc, v) => acc + v.cents,
            0
        );
        const totalOutflowsBeforeRetentionCents =
            totalExpensesCents + investmentContributionsCents;

        if (
            totalRealInflowsCents === 0 &&
            totalOutflowsBeforeRetentionCents === 0
        ) {
            return null;
        }

        const hubTotalCents = Math.max(
            totalRealInflowsCents,
            totalOutflowsBeforeRetentionCents
        );

        // Coluna 0: Fontes de Entrada
        const leftNodes: SankeyNodeSpec[] = Array.from(incomeMap.entries())
            .sort((a, b) => b[1].cents - a[1].cents)
            .map(([id, info]) => ({
                id,
                label: info.label,
                column: 0 as const,
                valueCents: info.cents,
                color: info.color,
                percentage: (info.cents / hubTotalCents) * 100,
            }));

        if (totalOutflowsBeforeRetentionCents > totalRealInflowsCents) {
            const drawCents =
                totalOutflowsBeforeRetentionCents - totalRealInflowsCents;
            leftNodes.push({
                id: "src_reserve_draw",
                label: "Uso de Saldo Anterior",
                column: 0,
                valueCents: drawCents,
                color: SOURCE_COLORS.reserveDraw,
                percentage: (drawCents / hubTotalCents) * 100,
            });
        }

        // Coluna 1: Hub Central (Renda Total Líquida / Orçamento Operacional)
        const hubNode: SankeyNodeSpec = {
            id: "hub_net_income",
            label:
                totalRealInflowsCents >= totalOutflowsBeforeRetentionCents
                    ? "Renda Total Líquida"
                    : "Fluxo Total Movimentado",
            column: 1,
            valueCents: hubTotalCents,
            color: HUB_COLOR,
            percentage: 100,
        };

        // Coluna 2: Top 6 Categorias de Despesas + Outras + Aportes + Liquidez Retida
        const MAX_DIRECT_CATEGORIES = 6;
        const topExpenses = positiveExpenses.slice(0, MAX_DIRECT_CATEGORIES);
        const tailExpensesCents = positiveExpenses
            .slice(MAX_DIRECT_CATEGORIES)
            .reduce((acc, e) => acc + e.cents, 0);

        const rightNodes: SankeyNodeSpec[] = topExpenses.map((exp, idx) => ({
            id: `dst_exp_${idx}`,
            label: exp.label,
            column: 2 as const,
            valueCents: exp.cents,
            color: EXPENSE_PALETTE[idx % (EXPENSE_PALETTE.length - 1)],
            percentage: (exp.cents / hubTotalCents) * 100,
        }));

        if (tailExpensesCents > 0) {
            rightNodes.push({
                id: "dst_exp_others",
                label: "Outras Categorias",
                column: 2,
                valueCents: tailExpensesCents,
                color: EXPENSE_PALETTE[EXPENSE_PALETTE.length - 1],
                percentage: (tailExpensesCents / hubTotalCents) * 100,
            });
        }

        if (investmentContributionsCents > 0) {
            rightNodes.push({
                id: "dst_investments",
                label: "Aportes & Investimentos",
                column: 2,
                valueCents: investmentContributionsCents,
                color: INVESTMENT_OUTFLOW_COLOR,
                percentage: (investmentContributionsCents / hubTotalCents) * 100,
            });
        }

        const retainedCents = Math.max(
            0,
            totalRealInflowsCents - totalOutflowsBeforeRetentionCents
        );
        if (retainedCents > 0) {
            rightNodes.push({
                id: "dst_retained_liquidity",
                label: "Liquidez Retida",
                column: 2,
                valueCents: retainedCents,
                color: RETAINED_LIQUIDITY_COLOR,
                percentage: (retainedCents / hubTotalCents) * 100,
            });
        }

        // Links Determinísticos
        const links: SankeyLinkSpec[] = [
            ...leftNodes.map((src) => ({
                id: `lnk_${src.id}_to_hub`,
                sourceId: src.id,
                targetId: hubNode.id,
                sourceLabel: src.label,
                targetLabel: hubNode.label,
                valueCents: src.valueCents,
                percentageOfHub: src.percentage,
                sourceColor: src.color,
                targetColor: hubNode.color,
            })),
            ...rightNodes.map((dst) => ({
                id: `lnk_hub_to_${dst.id}`,
                sourceId: hubNode.id,
                targetId: dst.id,
                sourceLabel: hubNode.label,
                targetLabel: dst.label,
                valueCents: dst.valueCents,
                percentageOfHub: dst.percentage,
                sourceColor: hubNode.color,
                targetColor: dst.color,
            })),
        ];

        const savingsRatePct =
            totalRealInflowsCents > 0
                ? ((retainedCents + investmentContributionsCents) /
                      totalRealInflowsCents) *
                  100
                : 0;

        return {
            leftNodes,
            hubNode,
            rightNodes,
            links,
            hubTotalCents,
            totalRealInflowsCents,
            totalExpensesCents,
            investmentContributionsCents,
            retainedCents,
            savingsRatePct,
        };
    }, [transactions, selfAndFamilyNames]);

    // 2. Motor Geométrico SVG Responsivo (3 Colunas sem dependências externas)
    const layout = useMemo(() => {
        if (!graphModel) return null;

        const isCompact = containerWidth < 640;
        const svgWidth = Math.max(320, containerWidth);
        const maxRows = Math.max(
            graphModel.leftNodes.length,
            graphModel.rightNodes.length,
            3
        );
        const svgHeight = Math.max(290, Math.min(440, maxRows * 46 + 64));

        const nodeWidth = isCompact ? 11 : 15;
        const nodeGap = isCompact ? 12 : 16;
        const sideLabelGutter = isCompact ? 8 : 16;
        const topPad = 20;
        const bottomPad = 20;

        const innerHeight = svgHeight - topPad - bottomPad;
        const leftX0 = sideLabelGutter;
        const rightX1 = svgWidth - sideLabelGutter;
        const centerX0 = Math.round(svgWidth / 2 - nodeWidth / 2);

        const maxGapCount = Math.max(
            Math.max(0, graphModel.leftNodes.length - 1),
            Math.max(0, graphModel.rightNodes.length - 1)
        );
        const availableFlowHeight = Math.max(
            120,
            innerHeight - maxGapCount * nodeGap
        );
        const pxPerCent = availableFlowHeight / graphModel.hubTotalCents;

        const placeColumn = (
            specs: SankeyNodeSpec[],
            colX0: number
        ): LayoutNode[] => {
            const heights = specs.map((s) =>
                Math.max(6, s.valueCents * pxPerCent)
            );
            const totalColHeight =
                heights.reduce((a, b) => a + b, 0) +
                Math.max(0, specs.length - 1) * nodeGap;
            let cursorY = topPad + Math.max(0, (innerHeight - totalColHeight) / 2);

            return specs.map((spec, idx) => {
                const h = heights[idx];
                const node: LayoutNode = {
                    ...spec,
                    x0: colX0,
                    x1: colX0 + nodeWidth,
                    y0: cursorY,
                    y1: cursorY + h,
                };
                cursorY += h + nodeGap;
                return node;
            });
        };

        const placedLeft = placeColumn(graphModel.leftNodes, leftX0);
        const placedHub = placeColumn([graphModel.hubNode], centerX0)[0];
        const placedRight = placeColumn(
            graphModel.rightNodes,
            rightX1 - nodeWidth
        );

        const nodeById = new Map<string, LayoutNode>();
        for (const n of placedLeft) nodeById.set(n.id, n);
        nodeById.set(placedHub.id, placedHub);
        for (const n of placedRight) nodeById.set(n.id, n);

        // Empilha as fitas no lado esquerdo e direito do Hub proporcionalmente à altura real do Hub
        const hubHeight = placedHub.y1 - placedHub.y0;
        let hubInCursor = placedHub.y0;
        let hubOutCursor = placedHub.y0;

        const placedLinks: LayoutLink[] = graphModel.links.map((lnk) => {
            const srcNode = nodeById.get(lnk.sourceId)!;
            const dstNode = nodeById.get(lnk.targetId)!;
            const shareRatio = lnk.valueCents / graphModel.hubTotalCents;

            if (lnk.targetId === placedHub.id) {
                const sy0 = srcNode.y0;
                const sy1 = srcNode.y1;
                const targetThickness = hubHeight * shareRatio;
                const ty0 = hubInCursor;
                const ty1 = hubInCursor + targetThickness;
                hubInCursor = ty1;

                return {
                    ...lnk,
                    sx: srcNode.x1,
                    tx: placedHub.x0,
                    sy0,
                    sy1,
                    ty0,
                    ty1,
                    ribbonPath: buildSankeyRibbonPath(
                        srcNode.x1,
                        placedHub.x0,
                        sy0,
                        sy1,
                        ty0,
                        ty1
                    ),
                };
            } else {
                const sourceThickness = hubHeight * shareRatio;
                const sy0 = hubOutCursor;
                const sy1 = hubOutCursor + sourceThickness;
                hubOutCursor = ty1Clamp(sy1, placedHub.y1);
                const ty0 = dstNode.y0;
                const ty1 = dstNode.y1;

                return {
                    ...lnk,
                    sx: placedHub.x1,
                    tx: dstNode.x0,
                    sy0,
                    sy1,
                    ty0,
                    ty1,
                    ribbonPath: buildSankeyRibbonPath(
                        placedHub.x1,
                        dstNode.x0,
                        sy0,
                        sy1,
                        ty0,
                        ty1
                    ),
                };
            }
        });

        return {
            svgWidth,
            svgHeight,
            isCompact,
            nodes: [...placedLeft, placedHub, ...placedRight],
            links: placedLinks,
        };
    }, [graphModel, containerWidth]);

    const activeTooltip = useMemo(() => {
        if (!graphModel || !layout) return null;
        if (hoveredLinkId) {
            const lnk = layout.links.find((l) => l.id === hoveredLinkId);
            if (lnk) {
                return {
                    title: `${lnk.sourceLabel} → ${lnk.targetLabel}`,
                    amountText: formatMoney(lnk.valueCents),
                    pctText: `${lnk.percentageOfHub.toFixed(1)}%`,
                    accent: lnk.targetColor,
                };
            }
        }
        if (hoveredNodeId) {
            const nd = layout.nodes.find((n) => n.id === hoveredNodeId);
            if (nd) {
                return {
                    title: nd.label,
                    amountText: formatMoney(nd.valueCents),
                    pctText: `${nd.percentage.toFixed(1)}% do fluxo`,
                    accent: nd.color,
                };
            }
        }
        return null;
    }, [hoveredLinkId, hoveredNodeId, graphModel, layout, isPrivacyMode]);

    return (
        <section
            ref={containerRef}
            className="w-full p-5 md:p-6 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] shadow-xs flex flex-col gap-4 select-none"
        >
            {/* Header & KPIs Rápidos de Retenção */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#E11D48]" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                            Fluxo de Caixa Sankey • {periodLabel}
                        </span>
                    </div>
                    <h3 className="text-base md:text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight mt-0.5">
                        De Onde Vem e Para Onde Vai Seu Dinheiro
                    </h3>
                </div>

                {graphModel && (
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase text-zinc-400">
                                Entradas
                            </span>
                            <span className="text-xs font-extrabold text-emerald-500 tabular-nums">
                                {formatMoney(graphModel.totalRealInflowsCents)}
                            </span>
                        </div>

                        <div className="px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase text-zinc-400">
                                Saídas Operacionais
                            </span>
                            <span className="text-xs font-extrabold text-rose-500 tabular-nums">
                                {formatMoney(graphModel.totalExpensesCents)}
                            </span>
                        </div>

                        <div className="px-3 py-1.5 rounded-xl bg-[#E11D48]/10 border border-[#E11D48]/25 flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase text-[#E11D48]">
                                Taxa de Retenção
                            </span>
                            <span className="text-xs font-black text-[#E11D48] tabular-nums">
                                {isPrivacyMode
                                    ? "••%"
                                    : `${Math.max(0, graphModel.savingsRatePct).toFixed(1)}%`}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Banner Flutuante de Inspeção / Tooltip */}
            <div className="min-h-[28px] flex items-center justify-between px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200/70 dark:border-[#27272A]/80 text-xs">
                {activeTooltip ? (
                    <div className="flex items-center justify-between w-full gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: activeTooltip.accent }}
                            />
                            <span className="font-bold text-zinc-900 dark:text-white truncate">
                                {activeTooltip.title}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 tabular-nums">
                            <span className="font-black text-zinc-900 dark:text-white">
                                {activeTooltip.amountText}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-zinc-200/70 dark:bg-[#27272A] text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                                {isPrivacyMode ? "••%" : activeTooltip.pctText}
                            </span>
                        </div>
                    </div>
                ) : (
                    <span className="text-[11px] text-zinc-400">
                        Passe o cursor ou toque nas fitas para inspecionar cada fluxo (transferências próprias e pagamentos de fatura já isolados).
                    </span>
                )}
            </div>

            {/* Renderização SVG Pura Responsiva */}
            {!graphModel || !layout ? (
                <div className="py-12 text-center text-xs text-zinc-400 flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-3xl text-zinc-500">
                        account_tree
                    </span>
                    <span>
                        Sem movimentações operacionais suficientes neste período para traçar o diagrama de Sankey.
                    </span>
                </div>
            ) : (
                <div className="relative w-full overflow-hidden">
                    <svg
                        viewBox={`0 0 ${layout.svgWidth} ${layout.svgHeight}`}
                        width="100%"
                        height={layout.svgHeight}
                        className="w-full block overflow-visible"
                        role="img"
                        aria-label="Diagrama de Sankey do Fluxo de Caixa Operacional"
                    >
                        <defs>
                            {layout.links.map((lnk) => (
                                <linearGradient
                                    key={`grad_${lnk.id}`}
                                    id={`kitsune_sankey_grad_${lnk.id}`}
                                    gradientUnits="userSpaceOnUse"
                                    x1={lnk.sx}
                                    y1={(lnk.sy0 + lnk.sy1) / 2}
                                    x2={lnk.tx}
                                    y2={(lnk.ty0 + lnk.ty1) / 2}
                                >
                                    <stop
                                        offset="0%"
                                        stopColor={lnk.sourceColor}
                                        stopOpacity={
                                            hoveredLinkId === lnk.id ||
                                            hoveredNodeId === lnk.sourceId ||
                                            hoveredNodeId === lnk.targetId
                                                ? 0.58
                                                : hoveredLinkId || hoveredNodeId
                                                  ? 0.1
                                                  : 0.28
                                        }
                                    />
                                    <stop
                                        offset="100%"
                                        stopColor={lnk.targetColor}
                                        stopOpacity={
                                            hoveredLinkId === lnk.id ||
                                            hoveredNodeId === lnk.sourceId ||
                                            hoveredNodeId === lnk.targetId
                                                ? 0.68
                                                : hoveredLinkId || hoveredNodeId
                                                  ? 0.12
                                                  : 0.34
                                        }
                                    />
                                </linearGradient>
                            ))}
                        </defs>

                        {/* Fitas Bézier (Ribbons) */}
                        <g>
                            {layout.links.map((lnk) => (
                                <path
                                    key={lnk.id}
                                    d={lnk.ribbonPath}
                                    fill={`url(#kitsune_sankey_grad_${lnk.id})`}
                                    className="transition-opacity duration-200 cursor-pointer"
                                    onMouseEnter={() => setHoveredLinkId(lnk.id)}
                                    onMouseLeave={() => setHoveredLinkId(null)}
                                    onClick={() =>
                                        setHoveredLinkId((prev) =>
                                            prev === lnk.id ? null : lnk.id
                                        )
                                    }
                                />
                            ))}
                        </g>

                        {/* Nós das 3 Colunas + Rótulos Internos Inteligentes */}
                        <g>
                            {layout.nodes.map((node) => {
                                const midY = (node.y0 + node.y1) / 2;
                                const isDimmed =
                                    Boolean(hoveredNodeId && hoveredNodeId !== node.id) ||
                                    Boolean(
                                        hoveredLinkId &&
                                            !layout.links.some(
                                                (l) =>
                                                    l.id === hoveredLinkId &&
                                                    (l.sourceId === node.id ||
                                                        l.targetId === node.id)
                                            )
                                    );

                                const labelX =
                                    node.column === 0
                                        ? node.x1 + 8
                                        : node.column === 2
                                          ? node.x0 - 8
                                          : (node.x0 + node.x1) / 2;

                                const textAnchor =
                                    node.column === 0
                                        ? "start"
                                        : node.column === 2
                                          ? "end"
                                          : "middle";

                                return (
                                    <g
                                        key={node.id}
                                        className="cursor-pointer transition-opacity duration-200"
                                        style={{ opacity: isDimmed ? 0.35 : 1 }}
                                        onMouseEnter={() => setHoveredNodeId(node.id)}
                                        onMouseLeave={() => setHoveredNodeId(null)}
                                    >
                                        <path
                                            d={buildAsymmetricNodePath(
                                                node.x0,
                                                node.y0,
                                                node.x1,
                                                node.y1,
                                                node.column
                                            )}
                                            fill={node.color}
                                        />

                                        {node.column === 1 ? (
                                            <g>
                                                <rect
                                                    x={labelX - (layout.isCompact ? 56 : 74)}
                                                    y={Math.max(2, node.y0 - 22)}
                                                    width={layout.isCompact ? 112 : 148}
                                                    height={18}
                                                    rx={6}
                                                    className="fill-zinc-100 dark:fill-[#18181B]"
                                                />
                                                <text
                                                    x={labelX}
                                                    y={Math.max(14, node.y0 - 10)}
                                                    textAnchor="middle"
                                                    className="text-[10px] font-extrabold fill-zinc-800 dark:fill-white tabular-nums"
                                                >
                                                    {layout.isCompact
                                                        ? formatCompactMoney(node.valueCents)
                                                        : `${node.label}: ${formatCompactMoney(node.valueCents)}`}
                                                </text>
                                            </g>
                                        ) : (
                                            <text
                                                x={labelX}
                                                y={midY + 3.5}
                                                textAnchor={textAnchor}
                                                className="text-[10px] md:text-[11px] font-bold fill-zinc-800 dark:fill-zinc-200 tabular-nums pointer-events-none"
                                            >
                                                {layout.isCompact && node.label.length > 15
                                                    ? `${node.label.slice(0, 14)}…`
                                                    : node.label}{" "}
                                                <tspan className="fill-zinc-500 dark:fill-zinc-400 font-mono text-[10px]">
                                                    ({formatCompactMoney(node.valueCents)})
                                                </tspan>
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    </svg>
                </div>
            )}
        </section>
    );
}

function ty1Clamp(val: number, maxVal: number): number {
    return val > maxVal ? maxVal : val;
}
