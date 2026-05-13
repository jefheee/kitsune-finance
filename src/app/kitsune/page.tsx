"use client";

import { useState } from "react";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function KitsuneAIPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Olá! Sou a Kitsune, sua IA financeira. Como posso ajudar na gestão do seu patrimônio hoje?' }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setMessages(prev => [...prev, { role: 'assistant', content: 'Ops! Parece que você não está logado. Faça o login para interagir com a Kitsune.' }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: 'Ocorreu um erro interno. Tente novamente mais tarde.' }]);
        }
        return;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Falha na conexão. Verifique sua internet.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full absolute inset-0">
      <header className="flex items-center p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-[#0A0A0A]/80 backdrop-blur-md z-10 shrink-0 shadow-sm">
        <h1 className="text-xl font-bold font-sans text-kitsune flex items-center gap-2">
          <span className="material-symbols-outlined">auto_awesome</span>
          Kitsune AI
        </h1>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 pb-24 md:pb-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-10 h-10 rounded-full bg-kitsune/10 flex items-center justify-center shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-kitsune text-[20px]">auto_awesome</span>
              </div>
            )}
            <div className={`border rounded-3xl p-4 max-w-[85%] md:max-w-[70%] shadow-sm ${
              msg.role === 'user' 
                ? 'bg-kitsune text-white border-kitsune rounded-tr-none' 
                : 'bg-white dark:bg-[#121212] border-gray-100 dark:border-white/5 rounded-tl-none text-gray-900 dark:text-white/90'
            }`}>
              <p className="font-sans text-sm leading-relaxed">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-kitsune/10 flex items-center justify-center shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-kitsune text-[20px] animate-pulse">auto_awesome</span>
            </div>
            <div className={`border rounded-3xl p-4 max-w-[85%] md:max-w-[70%] shadow-sm bg-white dark:bg-[#121212] border-gray-100 dark:border-white/5 rounded-tl-none flex items-center gap-2`}>
              <div className="w-2 h-2 rounded-full bg-kitsune/60 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-kitsune/60 animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-kitsune/60 animate-bounce" style={{ animationDelay: '300ms' }}></div>
              <span className="text-sm font-sans text-gray-500 dark:text-white/50 ml-2">Kitsune está pensando...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#0A0A0A] shrink-0 sticky bottom-0 md:relative md:bottom-auto md:pb-4 pb-20 z-20">
        <form 
          onSubmit={handleSubmit}
          className={`flex items-center gap-2 bg-white dark:bg-[#121212] border border-gray-200 dark:border-white/10 rounded-full p-2 pl-4 transition-colors shadow-sm ${isLoading ? 'opacity-70' : 'focus-within:border-kitsune/50'}`}
        >
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Pergunte sobre seus rendimentos, alocações..." 
            className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white font-sans text-sm placeholder:text-gray-400 dark:placeholder:text-white/30 disabled:cursor-not-allowed"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-full bg-kitsune text-white flex items-center justify-center hover:bg-kitsune/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
          >
            {isLoading ? (
              <span className="material-symbols-outlined text-[20px] animate-spin">refresh</span>
            ) : (
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_upward</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
