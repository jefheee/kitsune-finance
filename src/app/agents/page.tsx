"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { createClient } from "@/utils/supabase/client";

const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((mod) => mod.PluggyConnect),
  { ssr: false }
);

export default function AgentsPage() {
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connections, setConnections] = useState<any[]>([]);

  const supabase = createClient();

  const fetchConnections = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('pluggy_connections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setConnections(data);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleAddConnection = async () => {
    setIsLoadingToken(true);
    setError(null);
    setSuccess(null);
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

  const handlePluggySuccess = async (itemData: any) => {
    console.log("Pluggy onSuccess item:", itemData.item.id);
    try {
      const res = await fetch("/api/pluggy/save-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: itemData.item.id }),
      });
      if (!res.ok) {
        throw new Error("Falha ao salvar a conexão");
      }
      const saveData = await res.json();

      if (saveData.connectionId) {
        // Sincroniza dados da conta (Accounts e Transactions)
        await fetch("/api/pluggy/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId: saveData.connectionId, itemId: itemData.item.id }),
        });
      }

      setConnectToken(null);
      setSuccess("Banco conectado e dados sincronizados com sucesso!");
      fetchConnections();
    } catch (err: any) {
      setError(err.message);
    }
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

        {success && (
          <div className="text-sm font-sans text-green-600 bg-green-50 dark:bg-green-500/10 p-3 rounded-xl border border-green-200 dark:border-green-500/20">
            {success}
          </div>
        )}

        {connectToken && (
          <div className="flex flex-col gap-2 mt-4 border-t border-gray-100 dark:border-white/5 pt-4">
            <h3 className="text-sm font-sans font-bold text-gray-900 dark:text-white mb-2">
              Conecte seu Banco:
            </h3>
            <div className="w-full bg-gray-50 dark:bg-[#1A1A1A] rounded-2xl overflow-hidden max-w-4xl h-[600px] mx-auto flex flex-col relative">
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
      <section className="flex flex-col gap-4 mt-4">
        <h2 className="text-lg font-bold font-sans text-gray-900 dark:text-white">Suas Conexões</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connections.length > 0 ? (
            connections.map(conn => (
              <div key={conn.id} className="flex flex-col bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500">
                    <span className="material-symbols-outlined">account_balance</span>
                  </div>
                  <span className="px-2 py-1 text-[10px] font-sans font-bold uppercase tracking-wider bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400 rounded-md">
                    {conn.status === 'CONNECTED' ? 'Ativo' : conn.status}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold font-sans text-gray-900 dark:text-white mb-1">
                  {conn.provider_name ? conn.provider_name.charAt(0).toUpperCase() + conn.provider_name.slice(1) : "Instituição Conectada"}
                </h3>
                <p className="text-sm font-sans text-gray-500 dark:text-white/50 mb-6">ID: {conn.item_id}</p>
              </div>
            ))
          ) : (
            <div className="col-span-full p-6 text-center text-gray-500 font-sans bg-white dark:bg-[#121212] rounded-3xl border border-gray-100 dark:border-white/5">
              Nenhuma conexão bancária ativa no momento.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
