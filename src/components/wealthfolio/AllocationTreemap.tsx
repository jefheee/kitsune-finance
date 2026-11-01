"use client";

import React, { useMemo, useState } from "react";

interface TreemapLeaf {
  id: string;
  label: string;
  sublabel: string;
  value: number;
  weightPct: number;
  color: string;
}

interface PositionedRect extends TreemapLeaf {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface AllocationTreemapProps {
  investments: any[];
  accounts?: any[];
  customAssets?: any[];
  formatCurrency: (val: number) => string;
  hideValues: boolean;
}

// Paleta estritamente Warm Obsidian + Kitsune Orange / Emerald / Amber / Zinc (Zero tons azulados)
const TREEMAP_PALETTE = [
  "#FF8216", // Kitsune Orange
  "#10B981", // Emerald Mint
  "#F59E0B", // Warm Amber
  "#EA580C", // Deep Ember
  "#059669", // Deep Mint
  "#D97706", // Gold Ochre
  "#52525B", // Warm Zinc
  "#3F3F46", // Obsidian Charcoal
];

/**
 * Layout determinístico Binary Split / Slice-and-Dice balanceado para Treemap responsivo sem dependências externas.
 */
function computeTreemapRects(
  items: TreemapLeaf[],
  x: number,
  y: number,
  w: number,
  h: number
): PositionedRect[] {
  if (items.length === 0 || w <= 0 || h <= 0) return [];
  if (items.length === 1) {
    return [{ ...items[0], x, y, w, h }];
  }

  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];

  let halfAcc = 0;
  let splitIdx = 0;
  for (let i = 0; i < items.length - 1; i++) {
    halfAcc += items[i].value;
    splitIdx = i + 1;
    if (halfAcc >= total * 0.5) break;
  }

  const leftItems = items.slice(0, splitIdx);
  const rightItems = items.slice(splitIdx);
  const leftSum = leftItems.reduce((s, i) => s + i.value, 0);
  const ratio = Math.max(0.12, Math.min(0.88, leftSum / total));

  if (w >= h) {
    const leftW = w * ratio;
    return [
      ...computeTreemapRects(leftItems, x, y, leftW, h),
      ...computeTreemapRects(rightItems, x + leftW, y, w - leftW, h),
    ];
  } else {
    const topH = h * ratio;
    return [
      ...computeTreemapRects(leftItems, x, y, w, topH),
      ...computeTreemapRects(rightItems, x, y + topH, w, h - topH),
    ];
  }
}

export function AllocationTreemap({
  investments,
  accounts = [],
  customAssets = [],
  formatCurrency,
  hideValues,
}: AllocationTreemapProps) {
  const [groupBy, setGroupBy] = useState<"asset_class" | "institution">("asset_class");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const leaves = useMemo<TreemapLeaf[]>(() => {
    const map = new Map<string, { label: string; count: number; value: number }>();

    const activeInvs = investments.filter(
      (i) => (Number(i.balance) || 0) > 0.05 && i.status !== "TOTAL_WITHDRAWAL"
    );

    if (groupBy === "asset_class") {
      for (const inv of activeInvs) {
        const name = String(inv.name || "").toLowerCase();
        const type = String(inv.type || "").toLowerCase();
        const bal = Number(inv.balance) || 0;

        let cls = "Renda Fixa & CDBs";
        if (name.includes("tesouro") || type.includes("treasury")) cls = "Tesouro Direto";
        else if (
          name.includes("fii") ||
          name.includes("ação") ||
          name.includes("acao") ||
          type.includes("equity")
        )
          cls = "Renda Variável & FIIs";
        else if (name.includes("fundo") || type.includes("fund")) cls = "Fundos";

        const cur = map.get(cls) || { label: cls, count: 0, value: 0 };
        cur.count += 1;
        cur.value += bal;
        map.set(cls, cur);
      }

      const liquidSum = accounts
        .filter((a) => a.type !== "CREDIT" && a.subtype !== "CREDIT_CARD")
        .reduce((s, a) => s + Math.max(0, Number(a.balance) || 0), 0);

      if (liquidSum > 0) {
        const cashCount = accounts.filter(
          (a) =>
            a.type !== "CREDIT" &&
            a.subtype !== "CREDIT_CARD" &&
            (Number(a.balance) || 0) > 0
        ).length;
        map.set("Liquidez em Conta", {
          label: "Liquidez em Conta",
          count: cashCount,
          value: liquidSum,
        });
      }

      // Ativos Físicos e Não-Líquidos
      for (const asset of customAssets) {
        const val = Number(asset.current_value) || 0;
        if (val <= 0) continue;
        let cls = "Outros Ativos";
        if (asset.category === "vehicle") cls = "Veículos (FIPE)";
        else if (asset.category === "land" || asset.category === "real_estate") cls = "Imóveis & Terrenos";
        else if (asset.category === "fgts") cls = "FGTS Caixa";

        const cur = map.get(cls) || { label: cls, count: 0, value: 0 };
        cur.count += 1;
        cur.value += val;
        map.set(cls, cur);
      }
    } else {
      for (const inv of activeInvs) {
        const inst = inv.institution_name || inv.bank_name || inv.issuer || "Custódia";
        const bal = Number(inv.balance) || 0;
        const cur = map.get(inst) || { label: inst, count: 0, value: 0 };
        cur.count += 1;
        cur.value += bal;
        map.set(inst, cur);
      }

      for (const acc of accounts) {
        if (acc.type === "CREDIT" || acc.subtype === "CREDIT_CARD") continue;
        const bal = Math.max(0, Number(acc.balance) || 0);
        if (bal <= 0) continue;
        const inst = acc.institution_name || acc.bank_name || "Banco";
        const cur = map.get(inst) || { label: inst, count: 0, value: 0 };
        cur.count += 1;
        cur.value += bal;
        map.set(inst, cur);
      }

      for (const asset of customAssets) {
        const val = Number(asset.current_value) || 0;
        if (val <= 0) continue;
        let inst = "Ativos Físicos";
        if (asset.category === "vehicle") inst = "Veículo (FIPE)";
        else if (asset.category === "land" || asset.category === "real_estate") inst = "Imobiliário";
        else if (asset.category === "fgts") inst = "Caixa Econômica";

        const cur = map.get(inst) || { label: inst, count: 0, value: 0 };
        cur.count += 1;
        cur.value += val;
        map.set(inst, cur);
      }
    }

    const sorted = Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    const total = sorted.reduce((s, i) => s + i.value, 0);

    return sorted.map((item, idx) => ({
      id: item.key,
      label: item.label,
      sublabel: `${item.count} posição(ões)`,
      value: item.value,
      weightPct: total > 0 ? (item.value / total) * 100 : 0,
      color: TREEMAP_PALETTE[idx % TREEMAP_PALETTE.length],
    }));
  }, [investments, accounts, groupBy]);

  const W = 800;
  const H = 260;

  const rects = useMemo(
    () => computeTreemapRects(leaves, 0, 0, W, H),
    [leaves]
  );

  const activeItem =
    rects.find((r) => r.id === hoveredId) ?? rects[0] ?? null;

  return (
    <section className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#27272A] flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            Mapa de Alocação Patrimonial (Treemap)
          </h3>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            Densidade proporcional de capital por classe de ativo e custódia
          </p>
        </div>

        <div className="inline-flex items-center rounded-lg bg-zinc-100 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] p-0.5 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setGroupBy("asset_class")}
            className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              groupBy === "asset_class"
                ? "bg-[#FF8216] text-black"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5]"
            }`}
          >
            Classes de Ativos
          </button>
          <button
            type="button"
            onClick={() => setGroupBy("institution")}
            className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              groupBy === "institution"
                ? "bg-[#FF8216] text-black"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-[#F4F4F5]"
            }`}
          >
            Instituições
          </button>
        </div>
      </div>

      {rects.length === 0 ? (
        <div className="h-48 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] flex items-center justify-center text-xs text-zinc-500">
          Sem ativos com saldo positivo para renderizar o Treemap.
        </div>
      ) : (
        <>
          {/* Treemap SVG Responsivo */}
          <div className="w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-[#0A0A0A] p-1 border border-zinc-200 dark:border-[#27272A]">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[215px] sm:h-[250px] block">
              {rects.map((rect) => {
                const pad = 2.5;
                const innerW = Math.max(0, rect.w - pad * 2);
                const innerH = Math.max(0, rect.h - pad * 2);
                const isHovered = activeItem?.id === rect.id;
                const canShowTitle = innerW > 78 && innerH > 40;
                const canShowValue = innerW > 95 && innerH > 62;

                return (
                  <g
                    key={rect.id}
                    onMouseEnter={() => setHoveredId(rect.id)}
                    onClick={() => setHoveredId(rect.id)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={rect.x + pad}
                      y={rect.y + pad}
                      width={innerW}
                      height={innerH}
                      rx={9}
                      ry={9}
                      fill={rect.color}
                      fillOpacity={isHovered ? 0.96 : 0.82}
                      stroke={isHovered ? "#FFFFFF" : "#121214"}
                      strokeWidth={isHovered ? 1.5 : 1}
                    />
                    {canShowTitle && (
                      <text
                        x={rect.x + pad + 11}
                        y={rect.y + pad + 21}
                        fill="#FFFFFF"
                        fontSize={12}
                        fontWeight={700}
                      >
                        {rect.label.length > Math.floor(innerW / 7.5)
                          ? `${rect.label.slice(0, Math.max(4, Math.floor(innerW / 7.5) - 1))}…`
                          : rect.label}
                      </text>
                    )}
                    {canShowTitle && (
                      <text
                        x={rect.x + pad + 11}
                        y={rect.y + pad + 37}
                        fill="rgba(255,255,255,0.86)"
                        fontSize={11}
                        fontWeight={600}
                      >
                        {hideValues
                          ? "••%"
                          : `${rect.weightPct.toFixed(1).replace(".", ",")}%`}
                      </text>
                    )}
                    {canShowValue && (
                      <text
                        x={rect.x + pad + 11}
                        y={rect.y + pad + 54}
                        fill="rgba(255,255,255,0.92)"
                        fontSize={11}
                        fontWeight={600}
                      >
                        {formatCurrency(rect.value)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Barra Inferior de Inspeção + Legenda Interativa */}
          {activeItem && (
            <div className="px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200 dark:border-[#27272A] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: activeItem.color }}
                />
                <span className="font-bold text-zinc-900 dark:text-[#F4F4F5] truncate">
                  {activeItem.label}
                </span>
                <span className="text-zinc-500 text-[11px]">({activeItem.sublabel})</span>
              </div>
              <div className="flex items-center gap-3 tabular-nums">
                <span className="font-semibold text-[#FF8216]">
                  {hideValues
                    ? "••%"
                    : `${activeItem.weightPct.toFixed(2).replace(".", ",")}%`}
                </span>
                <span className="font-bold text-zinc-900 dark:text-[#F4F4F5]">
                  {formatCurrency(activeItem.value)}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
