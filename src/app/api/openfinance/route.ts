import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * Kitsune Finance — Open Finance API Route (100% Real Open Finance Data)
 * Returns the authenticated user's portfolio: accounts, investments, loans, and transactions.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // 1. Fetch real bank accounts
    const { data: accounts, error: accError } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', user.id);

    if (accError) {
      console.error('[OpenFinance API] Erro ao buscar contas:', accError);
    }

    // 2. Fetch real investments
    const { data: investments, error: invError } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', user.id);

    if (invError) {
      console.error('[OpenFinance API] Erro ao buscar investimentos:', invError);
    }

    // 3. Fetch real loans
    const { data: loans, error: loanError } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', user.id);

    if (loanError) {
      console.error('[OpenFinance API] Erro ao buscar empréstimos:', loanError);
    }

    // 4. Fetch recent transactions
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('executed_at', { ascending: false })
      .limit(50);

    if (txError) {
      console.error('[OpenFinance API] Erro ao buscar transações:', txError);
    }

    // 5. Fetch connections count
    const { count: connectionsCount } = await supabase
      .from('pluggy_connections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const safeAccounts = accounts || [];
    const safeInvestments = investments || [];
    const safeLoans = loans || [];
    const safeTransactions = transactions || [];

    // Calculations
    const liquidBalance = safeAccounts
      .filter((a) => a.type === 'CHECKING' || a.type === 'SAVINGS' || a.subtype === 'CHECKING_ACCOUNT' || a.subtype === 'SAVINGS_ACCOUNT')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

    const creditCardDebt = safeAccounts
      .filter((a) => a.type === 'CREDIT' || a.subtype === 'CREDIT_CARD')
      .reduce((sum, a) => sum + Math.abs(Number(a.balance) || 0), 0);

    const totalInvested = safeInvestments.reduce((sum, inv) => sum + (Number(inv.balance) || 0), 0);
    const totalLoanDebt = safeLoans.reduce((sum, l) => sum + (Number(l.balance_due) || 0), 0);
    const totalDebt = creditCardDebt + totalLoanDebt;
    const netWorth = liquidBalance + totalInvested - totalDebt;

    const portfolio = {
      user_id: user.id,
      connections_count: connectionsCount || 0,
      total_balance: liquidBalance,
      total_invested: totalInvested,
      total_debt: totalDebt,
      credit_card_debt: creditCardDebt,
      net_worth: netWorth,
      accounts: safeAccounts,
      investments: safeInvestments,
      loans: safeLoans,
      transactions: safeTransactions,
      last_sync: new Date().toISOString(),
    };

    return NextResponse.json(portfolio);
  } catch (error: any) {
    console.error('[OpenFinance API Error]', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
