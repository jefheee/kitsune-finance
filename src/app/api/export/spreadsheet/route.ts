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

    // Busca contas, investimentos, empréstimos e transações do usuário
    const { data: accounts } = await supabase
      .from("bank_accounts")
      .select("name, bank_name, institution_name, product_name, type, subtype, balance, credit_limit, account_number")
      .eq("user_id", user.id);

    const { data: investments } = await supabase
      .from("investments")
      .select("name, type, subtype, balance, institution_name, fixed_rate, due_date")
      .eq("user_id", user.id);

    const { data: loans } = await supabase
      .from("loans")
      .select("contract_number, type, balance_due, total_amount, paid_installments, total_installments, institution_name")
      .eq("user_id", user.id);

    const { data: transactions } = await supabase
      .from("transactions")
      .select("description, clean_description, raw_description, amount, type, operation_type, category_pt, category, date, executed_at, is_internal_transfer, is_refund, is_subscription, installment_number, total_installments")
      .eq("user_id", user.id)
      .order("executed_at", { ascending: false });

    const safeAccounts = accounts || [];
    const safeInvestments = investments || [];
    const safeLoans = loans || [];
    const safeTransactions = transactions || [];

    const liquidBalance = safeAccounts
      .filter((a) => a.type === "CHECKING" || a.type === "SAVINGS" || a.subtype === "CHECKING_ACCOUNT" || a.subtype === "SAVINGS_ACCOUNT")
      .reduce((acc, a) => acc + (Number(a.balance) || 0), 0);

    const creditCardDebt = safeAccounts
      .filter((a) => a.type === "CREDIT" || a.type === "CREDIT_CARD" || a.subtype === "CREDIT_CARD")
      .reduce((acc, a) => acc + Math.abs(Number(a.balance) || 0), 0);

    const totalInvested = safeInvestments.reduce((sum, inv) => sum + (Number(inv.balance) || 0), 0);
    const totalLoanDebt = safeLoans.reduce((sum, l) => sum + (Number(l.balance_due) || 0), 0);
    const totalNetWorth = liquidBalance + totalInvested - (creditCardDebt + totalLoanDebt);

    // Fluxo de caixa operacional (Exclui transferências entre contas próprias)
    const operationalTx = safeTransactions.filter((t) => !t.is_internal_transfer);

    const totalIncome = operationalTx.reduce((acc, t) => {
      const a = Number(t.amount) || 0;
      return !t.is_refund && (t.type === "CREDIT" || a > 0) ? acc + Math.abs(a) : acc;
    }, 0);

    const totalExpenses = operationalTx.reduce((acc, t) => {
      const a = Number(t.amount) || 0;
      if (t.is_refund) return acc - Math.abs(a);
      return t.type === "DEBIT" || a < 0 ? acc + Math.abs(a) : acc;
    }, 0);

    if (format === "json") {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        userEmail: user.email,
        summary: {
          netWorth: totalNetWorth,
          liquidBalance,
          totalInvested,
          creditCardDebt,
          totalLoanDebt,
          totalIncome,
          totalExpenses,
          margin: totalIncome - totalExpenses,
        },
        accounts: safeAccounts,
        investments: safeInvestments,
        loans: safeLoans,
        transactions: safeTransactions,
      });
    }

    // Geração de CSV Formatado para Excel / Google Sheets em UTF-8 com BOM
    const bom = "\uFEFF";
    let csvContent = bom;

    csvContent += "RELATÓRIO PATRIMONIAL KITSUNE FINANCE (OPEN FINANCE BRASIL)\n";
    csvContent += `Gerado em:;${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}\n`;
    csvContent += `Usuário:;${user.email}\n\n`;

    csvContent += "RESUMO CONSOLIDADO;\n";
    csvContent += `Patrimônio Líquido:;R$ ${totalNetWorth.toFixed(2).replace(".", ",")}\n`;
    csvContent += `Saldo em Conta Corrente/Poupança:;R$ ${liquidBalance.toFixed(2).replace(".", ",")}\n`;
    csvContent += `Total Investido:;R$ ${totalInvested.toFixed(2).replace(".", ",")}\n`;
    csvContent += `Faturas de Cartão de Crédito:;R$ ${creditCardDebt.toFixed(2).replace(".", ",")}\n`;
    csvContent += `Saldo Devedor Empréstimos:;R$ ${totalLoanDebt.toFixed(2).replace(".", ",")}\n`;
    csvContent += `Receitas Operacionais:;R$ ${totalIncome.toFixed(2).replace(".", ",")}\n`;
    csvContent += `Despesas Operacionais:;R$ ${totalExpenses.toFixed(2).replace(".", ",")}\n`;
    csvContent += `Margem Líquida do Período:;R$ ${(totalIncome - totalExpenses).toFixed(2).replace(".", ",")}\n\n`;

    csvContent += "CONTAS & CARTÕES CONECTADOS;\n";
    csvContent += "Instituição;Nome do Produto / Conta;Tipo;Subtipo;Número;Limite de Crédito (R$);Saldo (R$)\n";
    safeAccounts.forEach((acc) => {
      csvContent += `"${acc.institution_name || acc.bank_name || "-"}";"${acc.product_name || acc.name || "-"}";"${acc.type || "-"}";"${acc.subtype || "-"}";"${acc.account_number || "-"}";"${Number(acc.credit_limit || 0).toFixed(2).replace(".", ",")}";"${Number(acc.balance || 0).toFixed(2).replace(".", ",")}"\n`;
    });

    if (safeInvestments.length > 0) {
      csvContent += "\nINVESTIMENTOS & CARTEIRA;\n";
      csvContent += "Instituição;Nome do Ativo;Tipo;Subtipo;Taxa / Rentabilidade;Saldo (R$);Vencimento\n";
      safeInvestments.forEach((inv) => {
        csvContent += `"${inv.institution_name || "-"}";"${inv.name || "-"}";"${inv.type || "-"}";"${inv.subtype || "-"}";"${inv.fixed_rate ? inv.fixed_rate + "% a.a." : "-"}";"${Number(inv.balance || 0).toFixed(2).replace(".", ",")}";"${inv.due_date || "-"}"\n`;
      });
    }

    csvContent += "\nEXTRATO DETALHADO DE TRANSAÇÕES;\n";
    csvContent += "Data;Descrição Limpa;Descrição Original;Categoria;Operação;Parcelas;Transferência Interna;Estorno;Assinatura;Valor (R$)\n";
    safeTransactions.forEach((t) => {
      const rawDate = t.executed_at || t.date;
      const formattedDate = rawDate ? new Date(rawDate).toLocaleDateString("pt-BR") : "-";
      const amt = Number(t.amount || 0);
      const isPositive = t.type === "CREDIT" || amt > 0;
      const sign = isPositive ? "+" : "-";
      const installmentStr = t.total_installments && t.total_installments > 1 ? `${t.installment_number || 1}/${t.total_installments}` : "À vista";
      csvContent += `"${formattedDate}";"${(t.clean_description || t.description || "").replace(/"/g, '""')}";"${(t.raw_description || t.description || "").replace(/"/g, '""')}";"${t.category_pt || t.category || "Outros"}";"${t.operation_type || (isPositive ? "Crédito" : "Débito")}";"${installmentStr}";"${t.is_internal_transfer ? "Sim" : "Não"}";"${t.is_refund ? "Sim" : "Não"}";"${t.is_subscription ? "Sim" : "Não"}";"${sign}R$ ${Math.abs(amt).toFixed(2).replace(".", ",")}"\n`;
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
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
