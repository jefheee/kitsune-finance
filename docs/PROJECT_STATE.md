# Estado do Projeto - Kitsune Finance

**Última atualização:** 27/10/2026
**Status Geral:** Operacional / Warm Obsidian Human-Centric UI Ativa

---

## 1. Stack Tecnológica
- **Framework:** Next.js (App Router, React 19, Turbopack)
- **Estilização:** Tailwind CSS v4, Warm Obsidian Tokens (`theme.css` / `globals.css`), Fontes Plus Jakarta Sans & JetBrains Mono, Framer Motion
- **Banco de Dados & Autenticação:** Supabase (Auth com Google Provider, RLS, PostgreSQL, Multi-tenant por `user_id`)
- **Open Finance / Integrações:** Pluggy SDK (`pluggy-sdk`, `react-pluggy-connect`)
- **Inteligência Artificial:** Pool com failover automático Google Gemini API (`gemini-4-argon`, `gemini-3.8-flash`, `gemini-3.5-flash-lite`) e Groq (`llama-3.3-70b-versatile`)
- **Roteamento Inteligente:** Modo Automático por complexidade e tamanho do prompt (Cascade Routing)

---

## 2. Arquitetura e Decisões Críticas
- **Multi-Tenant RLS:** Todas as tabelas (`bank_accounts`, `transactions`, `family_members`, `users_profile`) isoladas estritamente por `auth.uid() = user_id`.
- **Design System Warm Obsidian Intelligence:** Diretrizes de Stitch e Untitled UI. Substituição total de jargões técnicos por garantias humanas de segurança bancária.
- **Transições Fluidas de Página (`template.tsx`):** Transições suaves entre rotas com `framer-motion` (fade + slide).
- **Loading State de Marca (`loading.tsx`):** Tela de carregamento suave com respiração visual do logo da Kitsune e ambient back-glow.
- **Página de Perfil (`/profile`):** Edição de avatar, nome de exibição, renda mensal com simulação da regra 50/30/20 e meta financeira vinculada ao Supabase.
- **Chatbot Kitsune AI (`/kitsune`):**
  - Badges de contexto anexáveis (o usuário decide a pergunta sem poluir o input).
  - Microfone integrado com transcrição de voz em tempo real (Web Speech API).
  - Histórico de chats anteriores salvo em gaveta lateral.
  - Exportação de relatórios da consultoria.
- **Protocolo Docs as Code:** Toda alteração é documentada em `docs/PROJECT_STATE.md` e registrada em `docs/CHANGELOG.md`.

---

## 3. Módulos Implementados
- [x] Licenciamento Open Source MIT (`LICENSE`)
- [x] Autenticação e Perfis (`/login`, `/signup`, `/profile`, `users_profile`)
- [x] Página de edição de perfil e renda com calculadora da regra 50/30/20
- [x] Sincronização e listagem de Contas e Lançamentos
- [x] Divisão familiar / Multi-membro (`family_members`)
- [x] Chatbot Kitsune AI com seletor de modelos e modo "✨ Automático"
- [x] Anexos de blocos de contexto como Badges visuais dismissíveis
- [x] Entrada de voz por microfone em tempo real (Web Speech API)
- [x] Histórico de conversas salvas em gaveta lateral (Past sessions)
- [x] Exportação de relatório da consultoria em Markdown
- [x] Transições fluidas de páginas (`template.tsx`) e loading state suave (`loading.tsx`)
- [x] Design System Warm Obsidian Intelligence com Plus Jakarta Sans e números tabulares
- [x] Conexões Bancárias Open Finance com Security Assurance Banner, Quick Bank Grid e FAQ (`/agents`)
- [x] Otimização de Tokens no Chat AI (formato compacto de alta densidade ~85% de economia)
- [x] Roteamento Automático de Modelos de IA ativado por padrão (`auto`)
- [x] Unificação da cor oficial `#FF8216` da logo em todo o projeto
- [x] Suporte universal a temas Claro e Escuro de alto contraste
- [x] Transcrição de voz universal compatível com Zen Browser, Firefox e Chrome via Whisper (`/api/ai/transcribe`)
- [x] Painel de Configurações do Sistema e Preferências (`/settings`)
- [x] Eliminação de textos estáticos/fictícios e substituição por lógica 100% dinâmica baseada em dados reais
- [x] Responsividade mobile refinada com touch targets de 44px e padding de navegação seguro
