"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";

export default function DashboardPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Visão geral');

  // AI Insights State
  const [aiInsight, setAiInsight] = useState<{ text: string, updatedAt: string } | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const TABS = ['Visão geral', 'Transações', 'Parcelamento', 'Assinaturas', 'Categorias', 'Cartões'];

  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: accData } = await supabase.from('accounts').select('*, pluggy_connections(provider_name)').eq('user_id', user.id);
      const { data: invData } = await supabase.from('investments').select('*, pluggy_connections(provider_name)').eq('user_id', user.id);
      
      const combinedAssets = [
        ...(accData || []).map(a => ({ ...a, assetType: a.type === 'CREDIT' ? 'Cartão de Crédito' : 'Conta Bancária' })),
        ...(invData || []).map(i => ({ ...i, assetType: 'Investimento' }))
      ];
      setAssets(combinedAssets);

      const { data: txnData } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(20);
      if (txnData) setTransactions(txnData);
      
      const { data: insightData } = await supabase.from('ai_insights').select('*').eq('user_id', user.id).single();
      if (insightData) {
        setAiInsight({ text: insightData.last_analysis_text, updatedAt: insightData.updated_at });
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  // Matemática Financeira Correta:
  // Patrimônio Total = SUM(bank/investment) - SUM(credit)
  const totalBalance = assets.reduce((acc, curr) => {
    const bal = Number(curr.balance) || 0;
    if (curr.type === 'CREDIT') {
      return acc - bal;
    }
    return acc + bal;
  }, 0);

  const creditCardBalance = assets.reduce((acc, curr) => {
    if (curr.type === 'CREDIT') {
      return acc + (Number(curr.balance) || 0);
    }
    return acc;
  }, 0);

  // Mês Corrente
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  let monthlyIncome = 0;
  let monthlyExpense = 0;
  
  transactions.forEach(txn => {
    // A data vem em yyyy-mm-dd
    const [year, month, day] = txn.date.split('-');
    const txnDate = new Date(Number(year), Number(month) - 1, Number(day));
    
    if (txnDate >= currentMonthStart) {
      const amount = Number(txn.amount) || 0;
      if (amount > 0) monthlyIncome += amount;
      if (amount < 0) monthlyExpense += Math.abs(amount);
    }
  });

  const generateAiInsight = async () => {
    setIsGeneratingAi(true);
    setAiError(null);
    try {
      const response = await fetch('/api/ai/generate-insight', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao gerar análise');
      if (data.success && data.data) {
        setAiInsight({ text: data.data.last_analysis_text, updatedAt: data.data.updated_at });
      }
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setIsGeneratingAi(false);
    }
  };

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
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold font-sans text-gray-900 dark:text-white tracking-tight">Tudo pronto para entender suas finanças?</h1>
          <p className="text-gray-500 dark:text-white/50 text-base font-sans">Sua visão financeira consolidada.</p>
        </div>

        {/* Horizontal Scrollable Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6 md:mx-0 md:px-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap px-4 py-2 rounded-full font-sans text-sm font-semibold transition-colors ${
                  isActive 
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black' 
                    : 'bg-transparent text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white border border-gray-200 dark:border-white/10'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </header>

      {activeTab === 'Visão geral' ? (
        <>
          {/* Visão Geral Cards */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex flex-col gap-2">
              <span className="text-gray-500 dark:text-white/50 text-xs font-sans uppercase tracking-wider font-semibold">Patrimônio Total</span>
              <span className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-gray-900 dark:text-white">
                {formatCurrency(totalBalance)}
              </span>
            </div>
            
            <div className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex flex-col gap-2">
              <span className="text-gray-500 dark:text-white/50 text-xs font-sans uppercase tracking-wider font-semibold">Receitas (Mês)</span>
              <span className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-green-500">
                {formatCurrency(monthlyIncome)}
              </span>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex flex-col gap-2">
              <span className="text-gray-500 dark:text-white/50 text-xs font-sans uppercase tracking-wider font-semibold">Despesas (Mês)</span>
              <span className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-red-500">
                {formatCurrency(monthlyExpense)}
              </span>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex flex-col gap-2">
              <span className="text-gray-500 dark:text-white/50 text-xs font-sans uppercase tracking-wider font-semibold">Faturas (Cartões)</span>
              <span className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-gray-900 dark:text-white">
                {formatCurrency(creditCardBalance)}
              </span>
            </div>
          </section>

      {/* Kitsune AI Insight */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-sans text-gray-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-kitsune">auto_awesome</span>
            Kitsune Insights
          </h2>
          <button 
            onClick={generateAiInsight}
            disabled={isGeneratingAi}
            className="flex items-center gap-2 px-4 py-2 bg-kitsune/10 hover:bg-kitsune/20 text-kitsune rounded-full font-sans text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingAi ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                Gerando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                Gerar Análise Atualizada
              </>
            )}
          </button>
        </div>

        <div className="bg-white dark:bg-[#121212] border border-kitsune/20 dark:border-kitsune/20 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-kitsune"></div>
          
          {aiError && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
              {aiError}
            </div>
          )}

          {isGeneratingAi ? (
            <div className="flex flex-col gap-3 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-full"></div>
              <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-5/6"></div>
            </div>
          ) : aiInsight ? (
            <div className="flex flex-col gap-4">
              <p className="text-gray-900 dark:text-white/90 font-sans leading-relaxed">
                {aiInsight.text}
              </p>
              <div className="flex items-center gap-2 mt-2 pt-4 border-t border-gray-100 dark:border-white/5">
                <span className="material-symbols-outlined text-[16px] text-gray-400">schedule</span>
                <span className="text-xs text-gray-500 font-sans">
                  Atualizado em: {new Date(aiInsight.updatedAt).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 font-sans">
              Nenhuma análise gerada ainda. Clique no botão acima para começar.
            </div>
          )}
        </div>
      </section>

      {/* Ativos (Contas) */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold font-sans text-gray-900 dark:text-white">Ativos & Passivos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.length > 0 ? (
            assets.map((asset) => {
              const isCredit = asset.type === 'CREDIT';
              const providerName = asset.pluggy_connections?.provider_name || 'Instituição';
              return (
                <div key={asset.id} className="flex flex-col bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-sans text-gray-500 dark:text-white/50 font-medium">
                      {asset.assetType} • {providerName}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm text-gray-500">
                        {isCredit ? 'credit_card' : asset.assetType === 'Investimento' ? 'trending_up' : 'account_balance'}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold font-sans text-gray-900 dark:text-white mb-2">{asset.name}</h3>
                  <span className={`text-2xl font-bold font-mono tracking-tight ${isCredit ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                    {isCredit ? '-' : ''}{formatCurrency(Number(asset.balance))}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="col-span-full p-6 text-center text-gray-500 font-sans bg-white dark:bg-[#121212] rounded-2xl border border-gray-100 dark:border-white/5">
              Nenhum dado financeiro sincronizado.
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
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPositive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        <span className="material-symbols-outlined text-lg">
                          {isPositive ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-sans font-semibold text-gray-900 dark:text-white">{txn.description}</span>
                        <span className="font-sans text-xs text-gray-500 dark:text-white/40">{formatDate(txn.date)} • {txn.category || 'Outros'}</span>
                      </div>
                    </div>
                    <span className={`font-mono font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                      {isPositive ? '+' : '-'}{formatCurrency(Math.abs(Number(txn.amount)))}
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
      </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-white/20 mb-4">construction</span>
          <h3 className="text-xl font-bold font-sans text-gray-900 dark:text-white">Aba em Construção</h3>
          <p className="text-gray-500 dark:text-white/50 font-sans mt-2">Esta funcionalidade estará disponível em breve.</p>
        </div>
      )}
    </div>
  );
}
