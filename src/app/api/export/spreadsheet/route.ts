import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv";

    // Busca contas e transações do usuário
    const { data: accounts } = await supabase
      .from("bank_accounts")
      .select("name, bank_name, type, balance")
      .eq("user_id", user.id);

    const { data: transactions } = await supabase
      .from("transactions")
      .select("description, amount, type, category, date, executed_at")
      .eq("user_id", user.id)
      .order("executed_at", { ascending: false });

    const totalBalance = (accounts || []).reduce((acc, a) => {
      const b = Number(a.balance) || 0;
      return a.type === "CREDIT" || a.type === "CREDIT_CARD" ? acc - Math.abs(b) : acc + b;
    }, 0);

    const totalIncome = (transactions || []).reduce((acc, t) => {
      const a = Number(t.amount) || 0;
      return t.type === "CREDIT" || a > 0 ? acc + Math.abs(a) : acc;
    }, 0);

    const totalExpenses = (transactions || []).reduce((acc, t) => {
      const a = Number(t.amount) || 0;
      return t.type === "DEBIT" || a < 0 ? acc + Math.abs(a) : acc;
    }, 0);

    if (format === "json") {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        userEmail: user.email,
        summary: {
          totalBalance,
          totalIncome,
          totalExpenses,
          margin: totalIncome - totalExpenses,
        },
        accounts: accounts || [],
        transactions: transactions || [],
      });
    }

    // Geração de CSV Formatado para Excel / Google Sheets em UTF-8 com BOM
    const bom = "\uFEFF";
    let csvContent = bom;

    csvContent += "RELATÓRIO PATRIMONIAL KITSUNE FINANCE\n";
    csvContent += `Gerado em:;${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}\n`;
    csvContent += `Usuário:;${user.email}\n\n`;

    csvContent += "RESUMO CONSOLIDADO;\n";
    csvContent += `Patrimônio Líquido:;R$ ${totalBalance.toFixed(2).replace(".", ",")}\n`;
    csvContent += `Receitas Totais:;R$ ${totalIncome.toFixed(2).replace(".", ",")}\n`;
    csvContent += `Despesas Totais:;R$ ${totalExpenses.toFixed(2).replace(".", ",")}\n`;
    csvContent += `Margem Operacional:;R$ ${(totalIncome - totalExpenses).toFixed(2).replace(".", ",")}\n\n`;

    csvContent += "CONTAS & CARTÕES CONECTADOS;\n";
    csvContent += "Instituição;Nome da Conta;Tipo;Saldo (R$)\n";
    (accounts || []).forEach((acc) => {
      csvContent += `"${acc.bank_name || "-"}";"${acc.name || "-"}";"${acc.type || "-"}";"${Number(acc.balance || 0).toFixed(2).replace(".", ",")}"\n`;
    });

    csvContent += "\nEXTRATO DETALHADO DE TRANSAÇÕES;\n";
    csvContent += "Data;Descrição;Categoria;Tipo;Valor (R$)\n";
    (transactions || []).forEach((t) => {
      const rawDate = t.executed_at || t.date;
      const formattedDate = rawDate ? new Date(rawDate).toLocaleDateString("pt-BR") : "-";
      const amt = Number(t.amount || 0);
      const isPositive = t.type === "CREDIT" || amt > 0;
      const sign = isPositive ? "+" : "-";
      csvContent += `"${formattedDate}";"${(t.description || "").replace(/"/g, '""')}";"${t.category || "Outros"}";"${isPositive ? "Receita" : "Despesa"}";"${sign}R$ ${Math.abs(amt).toFixed(2).replace(".", ",")}"\n`;
    });

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kitsune_relatorio_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("Export error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
