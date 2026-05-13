import Image from "next/image";

export default function AgentsPage() {
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

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Placeholder Agent Card - Nubank */}
        <div className="flex flex-col bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 hover:border-[#8A05BE]/30 dark:hover:border-[#8A05BE]/30 transition-colors rounded-3xl p-6 shadow-sm group cursor-pointer relative overflow-hidden">
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
          <p className="text-sm font-sans text-gray-500 dark:text-white/50 mb-6">Conta Corrente & Cartão de Crédito</p>
          
          <div className="mt-auto pt-4 border-t border-gray-100 dark:border-white/5">
            <button className="text-sm font-sans font-medium text-[#8A05BE] hover:text-[#8A05BE]/80 transition-colors flex items-center gap-1">
              Conectar via Pluggy
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Placeholder Agent Card - Itaú */}
        <div className="flex flex-col bg-white dark:bg-[#121212] border border-gray-100 dark:border-white/5 hover:border-[#EC7000]/30 dark:hover:border-[#EC7000]/30 transition-colors rounded-3xl p-6 shadow-sm group cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#EC7000] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#EC7000]/10 flex items-center justify-center text-[#EC7000] transition-colors">
              <span className="material-symbols-outlined">account_balance</span>
            </div>
            <span className="px-2 py-1 text-[10px] font-sans font-bold uppercase tracking-wider bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/50 rounded-md">
              Desconectado
            </span>
          </div>
          
          <h3 className="text-lg font-bold font-sans text-gray-900 dark:text-white mb-1">Itaú</h3>
          <p className="text-sm font-sans text-gray-500 dark:text-white/50 mb-6">Investimentos & Corretora</p>
          
          <div className="mt-auto pt-4 border-t border-gray-100 dark:border-white/5">
            <button className="text-sm font-sans font-medium text-[#EC7000] hover:text-[#EC7000]/80 transition-colors flex items-center gap-1">
              Conectar via Pluggy
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Add New Agent Card */}
        <div className="flex flex-col items-center justify-center bg-transparent border border-dashed border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/30 transition-colors rounded-3xl p-6 cursor-pointer min-h-[220px]">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-white/50 mb-4 shadow-sm">
            <span className="material-symbols-outlined">add</span>
          </div>
          <span className="text-sm font-sans font-medium text-gray-600 dark:text-white/70">
            Mais Instituições
          </span>
        </div>
      </section>
    </div>
  );
}
