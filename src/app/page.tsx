'use client';

import { useState, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';
import KitsuneAIDrawer from '@/components/KitsuneAIDrawer';

// ── Mock Data (mirrors API route) ──
const PORTFOLIO = {
  total_balance: 61150.5,
  accounts: [
    { id: 'acc_001', name: 'Conta Corrente', institution: 'Nubank', balance: 15420.5 },
    { id: 'acc_002', name: 'Poupança', institution: 'Itaú', balance: 8230.0 },
  ],
  investments: [
    { id: 'inv_001', name: 'CDB 120% CDI', type: 'FIXED_INCOME', balance: 25000.0, profitability: 13.65 },
    { id: 'inv_002', name: 'IVVB11', type: 'ETF', balance: 12500.0, profitability: 18.2 },
  ],
  transactions: [
    { id: 'tx_001', description: 'iFood', amount: -89.9, category: 'Alimentação', type: 'OUTFLOW' },
    { id: 'tx_002', description: 'Salário', amount: 4500.0, category: 'Receita', type: 'INFLOW' },
    { id: 'tx_003', description: 'Energia CPFL', amount: -250.0, category: 'Moradia', type: 'OUTFLOW' },
    { id: 'tx_004', description: 'Uber', amount: -32.5, category: 'Transporte', type: 'OUTFLOW' },
    { id: 'tx_005', description: 'Freelance Dev', amount: 2800.0, category: 'Receita', type: 'INFLOW' },
  ],
  performance: {
    change: 1250.0,
    percentage: 5.3,
    period: '1M',
    chart: [42, 48, 45, 52, 55, 58, 62], // Normalized values for mini chart
  },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

export default function Dashboard() {
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <main
      className="min-h-dvh pb-safe-nav"
      style={{ backgroundColor: 'var(--color-noir-deep)' }}
    >
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-5 pt-14 pb-4"
        style={{
          opacity: isLoaded ? 1 : 0,
          transform: isLoaded ? 'translateY(0)' : 'translateY(-10px)',
          transition: 'all 0.5s var(--ease-spring)',
        }}
      >
        <div>
          <p className="label" style={{ marginBottom: '4px' }}>
            Patrimônio Total
          </p>
          <h1
            className="font-value"
            style={{
              fontSize: 'var(--text-display)',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            {formatCurrency(PORTFOLIO.total_balance)}
          </h1>
        </div>

        {/* AI Trigger Button */}
        <button
          id="ai-trigger"
          onClick={() => setIsAIOpen(true)}
          className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 glow-accent"
          style={{
            background:
              'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dim) 100%)',
          }}
          aria-label="Abrir Kitsune AI"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#050505"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </button>
      </header>

      {/* ── Performance Card ── */}
      <section
        className="mx-5 mb-5 card-surface p-5"
        style={{
          opacity: isLoaded ? 1 : 0,
          transform: isLoaded ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s var(--ease-spring) 0.1s',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="label">Performance do Portfólio</p>
          <span
            className="font-value text-sm px-2 py-1 rounded-md"
            style={{
              backgroundColor: 'rgba(149, 255, 72, 0.1)',
              color: 'var(--color-success)',
              fontSize: '0.75rem',
            }}
          >
            {PORTFOLIO.performance.period}
          </span>
        </div>

        {/* Mini Chart (SVG) */}
        <div className="mb-4" style={{ height: '80px' }}>
          <svg
            viewBox="0 0 280 80"
            className="w-full h-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-success)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--color-success)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Area Fill */}
            <path
              d={`M0,${80 - PORTFOLIO.performance.chart[0]} ${PORTFOLIO.performance.chart.map((v, i) => `L${(i / 6) * 280},${80 - v}`).join(' ')} L280,80 L0,80 Z`}
              fill="url(#chartGradient)"
            />
            {/* Line */}
            <polyline
              points={PORTFOLIO.performance.chart
                .map((v, i) => `${(i / 6) * 280},${80 - v}`)
                .join(' ')}
              fill="none"
              stroke="var(--color-success)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="font-value"
            style={{
              fontSize: 'var(--text-title)',
              fontWeight: 600,
              color: 'var(--color-success)',
            }}
          >
            + {formatCurrency(PORTFOLIO.performance.change)}
          </span>
          <span
            className="font-value px-2 py-0.5 rounded-md"
            style={{
              fontSize: '0.75rem',
              backgroundColor: 'rgba(149, 255, 72, 0.1)',
              color: 'var(--color-success)',
            }}
          >
            +{PORTFOLIO.performance.percentage}%
          </span>
        </div>
      </section>

      {/* ── Accounts Section ── */}
      <section
        className="mx-5 mb-5"
        style={{
          opacity: isLoaded ? 1 : 0,
          transform: isLoaded ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s var(--ease-spring) 0.2s',
        }}
      >
        <h2
          className="label mb-3"
          style={{ paddingLeft: '4px' }}
        >
          Contas
        </h2>
        <div className="flex flex-col gap-3">
          {PORTFOLIO.accounts.map((account) => (
            <div
              key={account.id}
              className="card-surface p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--color-noir-surface)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {account.name}
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    {account.institution}
                  </p>
                </div>
              </div>
              <span
                className="font-value text-sm font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {formatCurrency(account.balance)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Investments Section ── */}
      <section
        className="mx-5 mb-5"
        style={{
          opacity: isLoaded ? 1 : 0,
          transform: isLoaded ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s var(--ease-spring) 0.3s',
        }}
      >
        <h2
          className="label mb-3"
          style={{ paddingLeft: '4px' }}
        >
          Investimentos
        </h2>
        <div className="flex flex-col gap-3">
          {PORTFOLIO.investments.map((inv) => (
            <div
              key={inv.id}
              className="card-surface p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor:
                      inv.type === 'FIXED_INCOME'
                        ? 'rgba(0, 209, 255, 0.1)'
                        : 'rgba(124, 58, 237, 0.1)',
                    color:
                      inv.type === 'FIXED_INCOME'
                        ? 'var(--color-info)'
                        : 'var(--color-secondary)',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
                    <polyline points="16,7 22,7 22,13" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {inv.name}
                  </p>
                  <p
                    className="font-value"
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--color-success)',
                    }}
                  >
                    +{inv.profitability}%
                  </p>
                </div>
              </div>
              <span
                className="font-value text-sm font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {formatCurrency(inv.balance)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Recent Transactions ── */}
      <section
        className="mx-5 mb-8"
        style={{
          opacity: isLoaded ? 1 : 0,
          transform: isLoaded ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s var(--ease-spring) 0.4s',
        }}
      >
        <h2
          className="label mb-3"
          style={{ paddingLeft: '4px' }}
        >
          Transações Recentes
        </h2>
        <div className="card-surface overflow-hidden">
          {PORTFOLIO.transactions.map((tx, index) => (
            <div
              key={tx.id}
              className="flex items-center justify-between px-4 py-3.5"
              style={{
                borderBottom:
                  index < PORTFOLIO.transactions.length - 1
                    ? '1px solid var(--color-noir-border)'
                    : 'none',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor:
                      tx.type === 'INFLOW'
                        ? 'rgba(149, 255, 72, 0.1)'
                        : 'rgba(255, 255, 255, 0.05)',
                    color:
                      tx.type === 'INFLOW'
                        ? 'var(--color-success)'
                        : 'var(--color-text-secondary)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {tx.type === 'INFLOW' ? (
                      <>
                        <line x1="12" y1="19" x2="12" y2="5" />
                        <polyline points="5 12 12 5 19 12" />
                      </>
                    ) : (
                      <>
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <polyline points="19 12 12 19 5 12" />
                      </>
                    )}
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {tx.description}
                  </p>
                  <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                    {tx.category}
                  </p>
                </div>
              </div>
              <span
                className="font-value text-sm font-medium"
                style={{
                  color:
                    tx.type === 'INFLOW'
                      ? 'var(--color-success)'
                      : 'var(--color-text-primary)',
                }}
              >
                {tx.type === 'INFLOW' ? '+' : ''}{formatCurrency(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom Nav ── */}
      <BottomNav />

      {/* ── AI Drawer ── */}
      <KitsuneAIDrawer isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </main>
  );
}
