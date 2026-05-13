"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: accData } = await supabase.from('accounts').select('*').eq('user_id', user.id);
      if (accData) setAccounts(accData);

      const { data: txnData } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(20);
      if (txnData) setTransactions(txnData);
      
      setLoading(false);
    }
    fetchData();
  }, []);

  const totalBalance = accounts.reduce((acc, curr) => acc + Number(curr.balance), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kitsune"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 max-w-6xl mx-auto w-full">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-sans text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
        <p className="text-gray-500 dark:text-white/50 text-base font-sans">Sua visão financeira consolidada.</p>
      </header>

      {/* Visão Geral */}
      <section className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-8 shadow-sm flex flex-col gap-4">
        <span className="text-gray-500 dark:text-white/50 text-sm font-sans uppercase tracking-wider font-semibold">Patrimônio Total</span>
        <span className="text-5xl md:text-6xl font-bold font-mono tracking-tight text-gray-900 dark:text-white">
          {formatCurrency(totalBalance)}
        </span>
      </section>

      {/* Ativos (Contas) */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold font-sans text-gray-900 dark:text-white">Ativos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.length > 0 ? (
            accounts.map((acc) => (
              <div key={acc.id} className="flex flex-col bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-sans text-gray-500 dark:text-white/50 font-medium">
                    {acc.type === 'BANK' ? 'Conta Bancária' : acc.type === 'CREDIT' ? 'Cartão de Crédito' : 'Conta'}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                    <span className="material-symbols-outlined text-sm text-gray-500">account_balance</span>
                  </div>
                </div>
                <h3 className="text-lg font-bold font-sans text-gray-900 dark:text-white mb-2">{acc.name}</h3>
                <span className="text-2xl font-bold font-mono tracking-tight text-gray-900 dark:text-white">
                  {formatCurrency(Number(acc.balance))}
                </span>
              </div>
            ))
          ) : (
            <div className="col-span-full p-6 text-center text-gray-500 font-sans bg-white dark:bg-[#121212] rounded-2xl border border-gray-100 dark:border-white/5">
              Nenhuma conta conectada.
            </div>
          )}
        </div>
      </section>

      {/* Fluxo de Caixa */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold font-sans text-gray-900 dark:text-white">Fluxo de Caixa</h2>
        <div className="flex flex-col bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm overflow-hidden">
          {transactions.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {transactions.map((txn) => {
                const isPositive = Number(txn.amount) > 0;
                return (
                  <div key={txn.id} className="flex items-center justify-between p-4 md:p-6 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPositive ? 'bg-green-500/10 text-green-500' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/50'}`}>
                        <span className="material-symbols-outlined text-lg">
                          {isPositive ? 'arrow_downward' : 'arrow_upward'}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-sans font-semibold text-gray-900 dark:text-white">{txn.description}</span>
                        <span className="font-sans text-xs text-gray-500 dark:text-white/40">{formatDate(txn.date)} • {txn.category || 'Outros'}</span>
                      </div>
                    </div>
                    <span className={`font-mono font-bold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                      {isPositive ? '+' : ''}{formatCurrency(Number(txn.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 font-sans">
              Nenhuma transação encontrada.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
