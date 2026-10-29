import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export interface AnomalyItem {
  id: string;
  type: "duplicate" | "category_spike" | "subscription_hike" | "liquidity_alert";
  title: string;
  description: string;
  severity: "danger" | "warning" | "info";
  amount?: number;
  merchant?: string;
  category?: string;
  detectedAt: string;
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: accounts } = await supabase
      .from("bank_accounts")
      .select("balance, type, subtype, institution_name, bank_name")
      .eq("user_id", user.id);

    const { data: rawTransactions } = await supabase
      .from("transactions")
      .select("id, description, clean_description, amount, type, category, category_pt, date, executed_at, is_internal_transfer, is_refund")
      .eq("user_id", user.id)
      .eq("is_internal_transfer", false)
      .order("executed_at", { ascending: false })
      .limit(300);

    const transactions = rawTransactions || [];
    const anomalies: AnomalyItem[] = [];

    // 1. Verificação de Cobranças Duplicadas (Mesmo valor e estabelecimento num intervalo de até 48 horas)
    // ATENÇÃO: Limitado rigorosamente ao período recente (máximo 30 dias / mês atual) conforme diretriz do usuário
    const seenMap = new Map<string, { date: Date; desc: string; amount: number; id: string }>();
    const now = new Date();
    const maxAnomalyAgeMs = 30 * 24 * 60 * 60 * 1000; // Máximo 30 dias

    for (const t of transactions) {
      if (t.is_refund) continue; // Ignora estornos na checagem de duplicidade
      const amt = Math.abs(Number(t.amount) || 0);
      const isExpense = t.type === "DEBIT" || Number(t.amount) < 0;
      if (!isExpense || amt === 0) continue;

      const rawDate = t.executed_at || t.date;
      const tDate = rawDate ? new Date(rawDate) : new Date();

      // Ignora transações antigas com mais de 30 dias
      if (now.getTime() - tDate.getTime() > maxAnomalyAgeMs) continue;

      const displayDesc = t.clean_description || t.description || "Despesa";
      // Normaliza o nome do estabelecimento
      const normalizedDesc = displayDesc
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 10);

      const key = `${amt.toFixed(2)}_${normalizedDesc}`;

      if (seenMap.has(key)) {
        const prev = seenMap.get(key)!;
        const diffHours = Math.abs(tDate.getTime() - prev.date.getTime()) / (1000 * 60 * 60);

        if (diffHours <= 48 && diffHours > 0.05) {
          anomalies.push({
            id: `dup_${t.id}`,
            type: "duplicate",
            title: "Possível Cobrança Duplicada Detectada",
            description: `Identificamos 2 lançamentos de R$ ${amt.toFixed(2).replace(".", ",")} em "${displayDesc}" em menos de 48h.`,
            severity: "danger",
            amount: amt,
            merchant: displayDesc,
            detectedAt: new Date().toISOString(),
          });
        }
      } else {
        seenMap.set(key, { date: tDate, desc: displayDesc, amount: amt, id: t.id });
      }
    }

    // 2. Verificação de Picos de Gastos em Categorias
    const categoryWeekSpend: Record<string, number> = {};
    const categoryMonthSpend: Record<string, number> = {};
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    transactions.forEach((t) => {
      if (t.is_refund) return;
      const amt = Math.abs(Number(t.amount) || 0);
      const isExpense = t.type === "DEBIT" || Number(t.amount) < 0;
      if (!isExpense) return;

      const rawDate = t.executed_at || t.date;
      const tDate = rawDate ? new Date(rawDate) : new Date();
      const cat = t.category_pt || t.category || "Outros";

      if (tDate >= oneMonthAgo) {
        categoryMonthSpend[cat] = (categoryMonthSpend[cat] || 0) + amt;
      }
      if (tDate >= oneWeekAgo) {
        categoryWeekSpend[cat] = (categoryWeekSpend[cat] || 0) + amt;
      }
    });

    Object.entries(categoryWeekSpend).forEach(([cat, weekAmt]) => {
      const monthAmt = categoryMonthSpend[cat] || weekAmt;
      const dailyMonthAvg = monthAmt / 30;
      const dailyWeekAvg = weekAmt / 7;

      if (dailyWeekAvg > dailyMonthAvg * 2.2 && weekAmt > 80) {
        anomalies.push({
          id: `spike_${cat}`,
          type: "category_spike",
          title: `Aumento Repentino em ${cat}`,
          description: `Seus gastos com ${cat} nos últimos 7 dias (R$ ${weekAmt.toFixed(2).replace(".", ",")}) estão 120% acima da sua média usual.`,
          severity: "warning",
          amount: weekAmt,
          category: cat,
          detectedAt: new Date().toISOString(),
        });
      }
    });

    // 3. Verificação de Risco de Liquidez Imediata
    let liquid = 0;
    let debt = 0;
    (accounts || []).forEach((acc) => {
      const b = Number(acc.balance) || 0;
      if (acc.type === "CREDIT" || acc.type === "CREDIT_CARD" || acc.subtype === "CREDIT_CARD") {
        debt += Math.abs(b);
      } else {
        liquid += b;
      }
    });

    if (debt > liquid && debt > 0) {
      anomalies.push({
        id: "liquidity_gap",
        type: "liquidity_alert",
        title: "Atenção: Faturas Superam Saldo Líquido",
        description: `O total de faturas de cartão de crédito (R$ ${debt.toFixed(2).replace(".", ",")}) excede o saldo disponível em contas (R$ ${liquid.toFixed(2).replace(".", ",")}).`,
        severity: "warning",
        amount: debt - liquid,
        detectedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      count: anomalies.length,
      anomalies,
      scannedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Anomaly Detection error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
