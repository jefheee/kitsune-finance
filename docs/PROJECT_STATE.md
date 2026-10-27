# Estado do Projeto - Kitsune Finance

**Última atualização:** 27/10/2026
**Status Geral:** Operacional / Em expansão de UX e Integrações

---

## 1. Stack Tecnológica
- **Framework:** Next.js (App Router, React 19)
- **Estilização:** Tailwind CSS v4, Vanilla CSS Design Tokens, Fontes Inter & JetBrains Mono, Framer Motion
- **Banco de Dados & Autenticação:** Supabase (Auth, RLS, PostgreSQL, Multi-tenant por `user_id`)
- **Open Finance / Integrações:** Pluggy SDK (`pluggy-sdk`, `react-pluggy-connect`) e especificações Belvo
- **Inteligência Artificial:** Pool com failover automático Google Gemini API (`@google/genai` / SDK REST) e Groq (`llama-3.3-70b-versatile`)

---

## 2. Arquitetura e Decisões Críticas
- **Multi-Tenant RLS:** Todas as tabelas (`bank_accounts`, `transactions`, `family_members`, `users_profile`) isoladas estritamente por `auth.uid() = user_id`.
- **Chatbot Financeiro (`/kitsune`):** Assistente contextual em tempo real que consome os saldos, transações recentes e membros de família cadastrados. Suporta seleção de modelos e nível de raciocínio.
- **Protocolo Docs as Code:** Todo novo endpoint, alteração em componentes críticos ou refatoração deve ser documentado em `docs/PROJECT_STATE.md` e registrado em `docs/CHANGELOG.md`.

---

## 3. Módulos Implementados vs. Pendentes
- [x] Autenticação e Perfis (`/login`, `users_profile`)
- [x] Sincronização e listagem de Contas e Lançamentos
- [x] Divisão familiar / Multi-membro (`family_members`)
- [x] Chatbot Kitsune AI com seletor de modelos (Gemini + Groq)
- [x] Renderização de Markdown avançado com tabelas, blocos de código e sem linhas coladas
- [x] Fluidez e animações suaves (`framer-motion` nos balões e efeito typewriter streaming no `StreamingMarkdown`)
- [x] Auto-scroll inteligente que acompanha a resposta da IA sem travar caso o usuário suba para ler
- [x] Hierarquia tipográfica limpa com separadores horizontais estilizados e bem espaçados
- [ ] Exportação de relatórios em PDF/CSV de conversas da IA
