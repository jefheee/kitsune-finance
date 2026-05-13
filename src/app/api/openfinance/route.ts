import { NextResponse } from 'next/server';

/**
 * Kitsune Finance — Open Finance API Route
 * Skeleton for Pluggy SDK integration.
 * 
 * Future: Replace mock data with:
 *   import { PluggyClient } from 'pluggy-sdk';
 *   const client = new PluggyClient({ clientId: process.env.PLUGGY_CLIENT_ID!, clientSecret: process.env.PLUGGY_CLIENT_SECRET! });
 */

const PLUGGY_FREE_TIER_LINK_LIMIT = 25;

// ── Mock Data ──
const MOCK_ACCOUNTS = [
  {
    id: 'acc_001',
    name: 'Conta Corrente',
    type: 'CHECKING' as const,
    number: '****1234',
    balance: { current: 15420.5, available: 14890.0 },
    institution: { name: 'Nubank', type: 'DIGITAL_BANK' },
    currency: 'BRL',
    last_accessed_at: new Date().toISOString(),
  },
  {
    id: 'acc_002',
    name: 'Poupança',
    type: 'SAVINGS' as const,
    number: '****5678',
    balance: { current: 8230.0, available: 8230.0 },
    institution: { name: 'Itaú', type: 'TRADITIONAL_BANK' },
    currency: 'BRL',
    last_accessed_at: new Date().toISOString(),
  },
];

const MOCK_INVESTMENTS = [
  {
    id: 'inv_001',
    name: 'CDB 120% CDI',
    type: 'FIXED_INCOME' as const,
    balance: 25000.0,
    profitability: 13.65,
    annual_rate: 13.65,
    institution: { name: 'XP Investimentos', type: 'BROKER' },
    currency: 'BRL',
    open_date: '2025-01-15',
    due_date: '2027-01-15',
  },
  {
    id: 'inv_002',
    name: 'IVVB11 - S&P 500 ETF',
    type: 'ETF' as const,
    balance: 12500.0,
    profitability: 18.2,
    institution: { name: 'Clear Corretora', type: 'BROKER' },
    currency: 'BRL',
  },
];

const MOCK_TRANSACTIONS = [
  {
    id: 'tx_001',
    amount: -89.9,
    currency: 'BRL',
    description: 'iFood',
    category: 'Alimentação',
    type: 'OUTFLOW' as const,
    status: 'PROCESSED' as const,
    value_date: new Date().toISOString(),
    merchant: { name: 'iFood' },
  },
  {
    id: 'tx_002',
    amount: 4500.0,
    currency: 'BRL',
    description: 'Salário',
    category: 'Receita',
    type: 'INFLOW' as const,
    status: 'PROCESSED' as const,
    value_date: new Date().toISOString(),
  },
  {
    id: 'tx_003',
    amount: -250.0,
    currency: 'BRL',
    description: 'Energia CPFL',
    category: 'Moradia',
    type: 'OUTFLOW' as const,
    status: 'PENDING' as const,
    value_date: new Date().toISOString(),
    merchant: { name: 'CPFL Energia' },
  },
];

export async function GET() {
  try {
    // Tier check (Free tier limit: 25 links)
    const activeLinks = 12;
    if (activeLinks >= PLUGGY_FREE_TIER_LINK_LIMIT) {
      return NextResponse.json(
        { error: 'Pluggy free tier link limit reached.' },
        { status: 403 }
      );
    }

    const totalBalance =
      MOCK_ACCOUNTS.reduce((sum, acc) => sum + acc.balance.current, 0) +
      MOCK_INVESTMENTS.reduce((sum, inv) => sum + inv.balance, 0);

    const totalInvested = MOCK_INVESTMENTS.reduce(
      (sum, inv) => sum + inv.balance,
      0
    );

    const portfolio = {
      total_balance: totalBalance,
      total_invested: totalInvested,
      total_debt: 0,
      net_worth: totalBalance,
      accounts: MOCK_ACCOUNTS,
      investments: MOCK_INVESTMENTS,
      transactions: MOCK_TRANSACTIONS,
      last_sync: new Date().toISOString(),
    };

    return NextResponse.json(portfolio);
  } catch (error) {
    console.error('[OpenFinance API Error]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
