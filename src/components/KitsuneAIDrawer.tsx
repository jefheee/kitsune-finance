'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'sys-001',
    role: 'assistant',
    content:
      'Conexão estabelecida. Protocolos de segurança ativos. Como posso ajudar com sua gestão patrimonial hoje?',
    timestamp: new Date(),
  },
];

interface KitsuneAIDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KitsuneAIDrawer({
  isOpen,
  onClose,
}: KitsuneAIDrawerProps) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: getAIResponse(userMessage.content),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1200 + Math.random() * 800);
  };

  return (
    <>
      {/* Backdrop Overlay */}
      <div
        id="ai-drawer-backdrop"
        className="fixed inset-0 z-[60] transition-all duration-500"
        style={{
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: isOpen ? 'blur(8px)' : 'blur(0px)',
          WebkitBackdropFilter: isOpen ? 'blur(8px)' : 'blur(0px)',
        }}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      {/* Drawer Panel */}
      <div
        id="ai-drawer"
        role="dialog"
        aria-label="Kitsune Core AI Assistant"
        aria-modal="true"
        className="fixed bottom-0 left-0 right-0 z-[70] transition-transform duration-500"
        style={{
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transitionTimingFunction: 'var(--ease-spring)',
          maxHeight: '85dvh',
          borderTopLeftRadius: 'var(--radius-xl)',
          borderTopRightRadius: 'var(--radius-xl)',
          background:
            'linear-gradient(180deg, var(--color-noir-elevated) 0%, var(--color-noir-deep) 100%)',
          borderTop: '1px solid var(--color-noir-border)',
        }}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div
            className="w-10 h-1 rounded-full"
            style={{ backgroundColor: 'var(--color-noir-surface)' }}
          />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pb-4"
          style={{ borderBottom: '1px solid var(--color-noir-border)' }}
        >
          <div className="flex items-center gap-3">
            {/* Kitsune Icon */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background:
                  'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dim) 100%)',
                boxShadow: '0 0 20px rgba(255, 94, 0, 0.3)',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#050505"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                KITSUNE CORE
              </h2>
              <p style={{ fontSize: '0.625rem', color: 'var(--color-success)', letterSpacing: '0.05em' }}>
                ● Online
              </p>
            </div>
          </div>
          <button
            id="ai-drawer-close"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200"
            style={{
              backgroundColor: 'var(--color-noir-surface)',
              color: 'var(--color-text-secondary)',
            }}
            aria-label="Fechar assistente"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div
          className="overflow-y-auto no-scrollbar px-5 py-4 flex flex-col gap-3"
          style={{ maxHeight: 'calc(85dvh - 160px)' }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="flex"
              style={{
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                className="max-w-[85%] px-4 py-3 text-sm leading-relaxed"
                style={{
                  borderRadius:
                    msg.role === 'user'
                      ? 'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)'
                      : 'var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)',
                  backgroundColor:
                    msg.role === 'user'
                      ? 'var(--color-accent)'
                      : 'var(--color-noir-card)',
                  color:
                    msg.role === 'user'
                      ? '#050505'
                      : 'var(--color-text-primary)',
                  border:
                    msg.role === 'assistant'
                      ? '1px solid var(--color-noir-border)'
                      : 'none',
                  fontWeight: msg.role === 'user' ? 500 : 400,
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-1 px-4 py-3 w-fit rounded-xl"
              style={{
                backgroundColor: 'var(--color-noir-card)',
                border: '1px solid var(--color-noir-border)',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div
          className="px-5 py-4"
          style={{
            borderTop: '1px solid var(--color-noir-border)',
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{
              backgroundColor: 'var(--color-noir-card)',
              border: '1px solid var(--color-noir-border)',
            }}
          >
            <input
              ref={inputRef}
              id="ai-input"
              type="text"
              placeholder="Pergunte à Kitsune..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{
                color: 'var(--color-text-primary)',
                caretColor: 'var(--color-accent)',
              }}
              aria-label="Campo de mensagem"
            />
            <button
              id="ai-send"
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
              style={{
                backgroundColor: input.trim()
                  ? 'var(--color-accent)'
                  : 'var(--color-noir-surface)',
                color: input.trim()
                  ? '#050505'
                  : 'var(--color-text-muted)',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
              }}
              aria-label="Enviar mensagem"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Simulated AI Responses ──
function getAIResponse(userInput: string): string {
  const input = userInput.toLowerCase();

  if (input.includes('saldo') || input.includes('patrimônio') || input.includes('balance')) {
    return 'Seu patrimônio líquido atual é R$ 61.150,50. Contas correntes: R$ 15.420,50 | Poupança: R$ 8.230,00 | Investimentos: R$ 37.500,00. Variação de +5.3% no último mês.';
  }

  if (input.includes('gasto') || input.includes('despesa') || input.includes('categoria')) {
    return 'Suas maiores categorias de gasto este mês: Alimentação (R$ 1.240), Moradia (R$ 2.100), Transporte (R$ 680). Recomendo revisar os gastos com delivery — aumentaram 23% vs. mês anterior.';
  }

  if (input.includes('investimento') || input.includes('cdb') || input.includes('rendimento')) {
    return 'Seus investimentos: CDB 120% CDI (R$ 25.000 @ 13.65% a.a.) e IVVB11 S&P 500 ETF (R$ 12.500, +18.2% YTD). Sua alocação está 67% renda fixa / 33% renda variável.';
  }

  if (input.includes('alerta') || input.includes('aviso')) {
    return '⚠️ Alerta: Fatura do cartão Nubank vence em 3 dias (R$ 1.890,40). Você tem saldo disponível na conta corrente para cobrir.';
  }

  return 'Entendi sua solicitação. Estou analisando seus dados financeiros para fornecer uma resposta precisa. Você pode me perguntar sobre saldos, gastos, investimentos ou alertas financeiros.';
}
