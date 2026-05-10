import BottomNav from '@/components/BottomNav';

export default function PortfolioPage() {
  return (
    <main
      className="min-h-dvh pb-safe-nav"
      style={{ backgroundColor: 'var(--color-noir-deep)' }}
    >
      <header className="px-5 pt-14 pb-4">
        <h1
          className="font-sans"
          style={{
            fontSize: 'var(--text-display)',
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}
        >
          Portfolio
        </h1>
        <p className="label mt-2">Visão Geral dos Seus Ativos</p>
      </header>
      
      <section className="mx-5 mb-5 card-surface p-5 h-64 flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Módulo em desenvolvimento...</p>
      </section>

      <BottomNav />
    </main>
  );
}
