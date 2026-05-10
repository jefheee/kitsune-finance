export default function AgentsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-2 border-b border-white/5 pb-6">
        <h1 className="text-2xl font-bold font-sans flex items-center gap-2">
          <span className="material-symbols-outlined text-kitsune">hub</span>
          Agentes Financeiros
        </h1>
        <p className="text-white/50 text-sm font-sans">
          Conexões ativas via Open Finance e gestão de chaves.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Placeholder Agent Card */}
        <div className="flex flex-col bg-[#121212] border border-white/5 hover:border-kitsune/30 transition-colors rounded-2xl p-6 group cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-kitsune to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/50 group-hover:text-kitsune transition-colors">
              <span className="material-symbols-outlined">account_balance</span>
            </div>
            <span className="px-2 py-1 text-[10px] font-sans font-bold uppercase tracking-wider bg-white/5 text-white/50 rounded-md">
              Desconectado
            </span>
          </div>
          
          <h3 className="text-lg font-bold font-sans text-white mb-1">Banco Principal</h3>
          <p className="text-sm font-sans text-white/50 mb-6">Conta Corrente & Investimentos</p>
          
          <div className="mt-auto pt-4 border-t border-white/5">
            <button className="text-sm font-sans font-medium text-kitsune hover:text-kitsune/80 transition-colors flex items-center gap-1">
              Conectar via Belvo
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Add New Agent Card */}
        <div className="flex flex-col items-center justify-center bg-transparent border border-dashed border-white/10 hover:border-white/30 transition-colors rounded-2xl p-6 cursor-pointer min-h-[220px]">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/50 mb-4">
            <span className="material-symbols-outlined">add</span>
          </div>
          <span className="text-sm font-sans font-medium text-white/70">
            Adicionar Instituição
          </span>
        </div>
      </section>
    </div>
  );
}
