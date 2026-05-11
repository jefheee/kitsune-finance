export default function KitsuneAIPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center p-6 border-b border-gray-200 dark:border-white/5">
        <h1 className="text-xl font-bold font-sans text-kitsune flex items-center gap-2">
          <span className="material-symbols-outlined">auto_awesome</span>
          Kitsune AI
        </h1>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-kitsune/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-kitsune text-[20px]">auto_awesome</span>
          </div>
          <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-white/5 rounded-2xl rounded-tl-none p-4 max-w-[85%] md:max-w-[70%]">
            <p className="text-gray-900 dark:text-white/90 font-sans text-sm leading-relaxed">
              Olá! Sou a Kitsune, sua IA financeira. Como posso ajudar na gestão do seu patrimônio hoje?
            </p>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#0A0A0A]">
        <div className="flex items-center gap-2 bg-white dark:bg-[#121212] border border-gray-200 dark:border-white/10 rounded-full p-2 pl-4 focus-within:border-kitsune/50 transition-colors">
          <input 
            type="text" 
            placeholder="Pergunte sobre seus rendimentos, alocações..." 
            className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white font-sans text-sm placeholder:text-gray-400 dark:placeholder:text-white/30"
          />
          <button className="w-10 h-10 rounded-full bg-kitsune text-white flex items-center justify-center hover:bg-kitsune/90 transition-colors">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_upward</span>
          </button>
        </div>
      </div>
    </div>
  );
}
