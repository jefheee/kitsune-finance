export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold font-sans">Dashboard</h1>
        <p className="text-white/50 text-sm font-sans">Sua visão financeira consolidada.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card: Total Balance */}
        <div className="flex flex-col bg-[#121212] border border-white/5 rounded-2xl p-6">
          <span className="text-white/50 text-sm font-sans mb-2">Saldo Total</span>
          <span className="text-3xl font-bold font-mono tracking-tight text-white">R$ 0,00</span>
          <div className="flex items-center gap-2 mt-4">
            <span className="text-kitsune text-xs font-mono bg-kitsune/10 px-2 py-1 rounded-md">+0.00%</span>
            <span className="text-white/30 text-xs font-sans">este mês</span>
          </div>
        </div>

        {/* Card: Investimentos */}
        <div className="flex flex-col bg-[#121212] border border-white/5 rounded-2xl p-6">
          <span className="text-white/50 text-sm font-sans mb-2">Investimentos</span>
          <span className="text-3xl font-bold font-mono tracking-tight text-white">R$ 0,00</span>
        </div>

        {/* Card: Liquidez */}
        <div className="flex flex-col bg-[#121212] border border-white/5 rounded-2xl p-6">
          <span className="text-white/50 text-sm font-sans mb-2">Liquidez Imediata</span>
          <span className="text-3xl font-bold font-mono tracking-tight text-white">R$ 0,00</span>
        </div>
      </section>

      {/* Placeholder Chart / Activity Area */}
      <section className="flex-1 min-h-[300px] bg-[#121212] border border-white/5 rounded-2xl p-6 flex items-center justify-center">
        <span className="text-white/30 font-sans text-sm">Aguardando sincronização de dados...</span>
      </section>
    </div>
  );
}
