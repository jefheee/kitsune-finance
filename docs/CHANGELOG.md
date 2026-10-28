# Histórico de Modificações (Changelog)

Todas as alterações notáveis no projeto Kitsune Finance são registradas de forma incremental aqui.

---

## [2026-10-27] - Refinamento Impeccable: Laranja Oficial #FF8216, Tema Claro/Escuro, Voz Universal & Mobile
- **Arquivos Afetados:** `globals.css`, `layout.tsx`, `AppShell.tsx`, `dashboard/page.tsx`, `kitsune/page.tsx`, `agents/page.tsx`, `profile/page.tsx`, `settings/page.tsx`, `Spinner.tsx`, `template.tsx`, `loading.tsx`, `api/ai/transcribe/route.ts`, `api/ai/generate-insight/route.ts`, `PluggyConnectModal.tsx`, `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`.
- **Objetivo:** 
  - Unificação da cor primária oficial para `#FF8216` da logo em todo o CSS, ícones, botões e acentos.
  - Correção completa do tema claro (legibilidade de alto contraste e sem classes conflitantes no `body`).
  - Remoção de todos os degradês excessivos, neon glows e textos fixos/mockups do Stitch no Dashboard.
  - Reestruturação da barra lateral: remoção do ícone duplicado de perfil e fixação exclusiva no avatar inferior.
  - Implementação de entrada de voz universal no chat via Whisper (`/api/ai/transcribe`) com compatibilidade para Zen Browser, Firefox e Chrome.
  - Ajuste nas sugestões de prompt para preenchimento de input com retenção de contextos anexados.
  - Eliminação do spinner gigante no chat em favor de indicador de digitação discreto e refinado.
  - Criação da página completa de Configurações (`/settings`) e reformulação mobile responsiva em todas as 22 rotas.

---

## [2026-10-27] - Redesign Open Finance Warm Obsidian, Otimização de Tokens & FAQ de Segurança
- **Arquivos Afetados:** `src/app/agents/page.tsx`, `src/app/api/chat/route.ts`, `src/context/FinanceDataContext.tsx`, `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`.
- **Objetivo:** 
  - Redesign completo da página de Conexões Bancárias (`/agents`) alinhada às telas do Stitch (`80fa7af03ce8417fba73ef02d068139f` e `90e3a36dbc424738a1c01bbbd7f44de3`) com Warm Obsidian tokens.
  - Adição do Security Assurance Banner (100% Somente-Leitura, Regulação Bacen nº 1/2020 e Criptografia AES-256 TLS 1.3).
  - Implementação do Quick Bank Grid (Nubank, Itaú, Bradesco, Santander, Banco do Brasil, Inter, C6, BTG) para conexão rápida com 1 clique e FAQ interativo de privacidade.
  - Eliminação de jargões técnicos de banco de dados e substituição por garantias humanas de privacidade.
  - Otimização severa de consumo de tokens no endpoint `/api/chat` com digest pipe-delimited de alta densidade (~85% de economia em transações) e injeção condicional de extratos.
  - Modelo padrão inicial do assistente configurado como "✨ Automático" no `FinanceDataContext`.

---

## [2026-10-27] - Redesign Warm Obsidian, Perfil do Usuário, Roteamento Automático & Licença MIT
- **Arquivos Afetados:** `LICENSE`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/template.tsx`, `src/app/loading.tsx`, `src/app/profile/page.tsx`, `src/components/layout/AppShell.tsx`, `src/app/kitsune/page.tsx`, `src/app/api/chat/route.ts`, `src/utils/ai/gemini.ts`, `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`.
- **Objetivo:** 
  - Adição do arquivo de licenciamento Open Source `LICENSE` (MIT).
  - Adoção da identidade de design "Warm Obsidian Intelligence" (Stitch/Untitled UI) com fonte Plus Jakarta Sans, números tabulares e eliminação de jargões técnicos.
  - Implementação da página de Perfil (`/profile`) com upload de avatar, nome de exibição, renda mensal com simulação 50/30/20 e objetivos financeiros no Supabase.
  - Transições fluidas de páginas com Framer Motion (`template.tsx`) e animação suave de loading com ambient glow (`loading.tsx`).
  - Chat Kitsune AI com modo "✨ Automático" (roteamento por complexidade), blocos de contexto como badges anexáveis, microfone por voz em tempo real e histórico de conversas anteriores.

---

## [2026-10-27] - Inicialização do Docs as Code e Melhorias no Chat AI
- **Arquivos Afetados:** `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`, `AGENTS.md`, `src/app/kitsune/page.tsx`, `src/app/globals.css`.
- **Objetivo:** 
  - Inicialização do protocolo Docs as Code no repositório.
  - Implementação de animações fluidas nos balões de chat e streaming visual da resposta da IA.
  - Scroll automático reativo que acompanha a resposta da IA caso o usuário esteja no final da página.
  - Refinamento tipográfico Markdown (h1/h2/h3 escalonados, blocos de código estilizados, tabelas limpas, separadores horizontais com espaçamento generoso e visual sutil sem colar no texto).
