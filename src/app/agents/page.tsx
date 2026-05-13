"use client";

import { useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";

const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((mod) => mod.PluggyConnect),
  { ssr: false }
);

export default function AgentsPage() {
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddConnection = async () => {
    setIsLoadingToken(true);
    setError(null);
    setConnectToken(null);
    
    try {
      const res = await fetch("/api/pluggy/create-token", {
        method: "POST",
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Erro ao obter token");
      }
      
      setConnectToken(data.accessToken);
      console.log("Pluggy Connect Token:", data.accessToken);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoadingToken(false);
    }
  };

  const handlePluggySuccess = (itemData: any) => {
    console.log("Pluggy onSuccess item:", itemData.item.id);
    // TODO: save item.id to Supabase
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-2 border-b border-gray-100 dark:border-white/5 pb-6">
        <h1 className="text-2xl font-bold font-sans text-gray-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-kitsune">hub</span>
          Conexões Bancárias
        </h1>
        <p className="text-gray-500 dark:text-white/50 text-sm font-sans">
          Conecte suas contas reais via Open Finance (Pluggy Development) para habilitar o motor da IA.
        </p>
      </header>

      {/* Pluggy Actions */}
      <div className="flex flex-col gap-4 bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-bold font-sans text-gray-900 dark:text-white">Nova Conexão</h2>
            <p className="text-sm font-sans text-gray-500 dark:text-white/50">Inicie o fluxo de consentimento seguro da Pluggy.</p>
          </div>
          
          <button 
            onClick={handleAddConnection}
            disabled={isLoadingToken}
            className="h-12 px-6 flex items-center justify-center gap-2 bg-kitsune text-white rounded-xl font-sans font-bold hover:bg-kitsune/90 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoadingToken ? (
              <span className="material-symbols-outlined animate-spin text-[20px]">refresh</span>
            ) : (
              <span className="material-symbols-outlined text-[20px]">add_link</span>
            )}
            {isLoadingToken ? "Gerando Token..." : "Adicionar Conexão Bancária"}
          </button>
        </div>

        {error && (
          <div className="text-sm font-sans text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-xl border border-red-200 dark:border-red-500/20">
            {error}
          </div>
        )}

        {connectToken && (
          <div className="flex flex-col gap-2 mt-4 border-t border-gray-100 dark:border-white/5 pt-4">
            <h3 className="text-sm font-sans font-bold text-gray-900 dark:text-white mb-2">
              Conecte seu Banco:
            </h3>
            <div className="w-full bg-gray-50 dark:bg-[#1A1A1A] rounded-2xl overflow-hidden" style={{ minHeight: '500px' }}>
              {typeof window !== 'undefined' && (
                <PluggyConnect
                  connectToken={connectToken}
                  includeSandbox={true}
                  onSuccess={handlePluggySuccess}
                  onError={(error) => setError(error?.message || "Erro no widget Pluggy")}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contas Conectadas */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        {/* Placeholder Agent Card - Nubank */}
        <div className="flex flex-col bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 hover:border-[#8A05BE]/30 dark:hover:border-[#8A05BE]/30 transition-colors rounded-3xl p-6 shadow-sm group cursor-pointer relative overflow-hidden opacity-50">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8A05BE] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#8A05BE]/10 flex items-center justify-center text-[#8A05BE] transition-colors">
              <span className="material-symbols-outlined">account_balance</span>
            </div>
            <span className="px-2 py-1 text-[10px] font-sans font-bold uppercase tracking-wider bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/50 rounded-md">
              Desconectado
            </span>
          </div>
          
          <h3 className="text-lg font-bold font-sans text-gray-900 dark:text-white mb-1">Nubank</h3>
          <p className="text-sm font-sans text-gray-500 dark:text-white/50 mb-6">Exemplo de integração</p>
        </div>
      </section>
    </div>
  );
}
