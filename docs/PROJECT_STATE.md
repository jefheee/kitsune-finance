# Estado do Projeto - Kitsune Finance

**Última atualização:** 29/10/2026
**Status Geral:** Operacional / Open Finance Brasil Completo & Blindagem Multi-tenant Ativos

---

## 1. Stack Tecnológica
- **Framework:** Next.js (App Router, React 19, Turbopack)
- **Estilização:** Tailwind CSS v4, Warm Obsidian Tokens (`theme.css` / `globals.css`), Untitled UI components (`@untitledui/icons`, `qr-code`), Fontes Plus Jakarta Sans & JetBrains Mono, Framer Motion
- **Banco de Dados & Autenticação:** Supabase (Auth com Google Provider, FORCE RLS em todas as tabelas públicas, revogação do role `anon`, PostgreSQL, Multi-tenant por `user_id`)
- **Open Finance / Integrações:** Pluggy SDK (`pluggy-sdk`, `react-pluggy-connect`) com 10 conexões reais sincronizadas
- **Inteligência Artificial:** Pool com failover automático Google Gemini API (`gemini-4-argon`, `gemini-3.8-flash`, `gemini-3.5-flash-lite`) e Groq (`llama-3.3-70b-versatile`, `whisper-large-v3`)
- **Roteamento Inteligente:** Modo Automático por complexidade e tamanho do prompt (Cascade Routing), sessões persistentes em banco (`ai_chat_sessions`) e dossiê patrimonial montado 1x por sessão

---

## 2. Arquitetura e Decisões Críticas
- **Blindagem 100% de Segurança & Eliminação de Mocks:**
  - Remoção de qualquer array estático de mock no frontend e no backend (`MOCK_ACCOUNTS`, `MOCK_INVESTMENTS`, `MOCK_TRANSACTIONS` eliminados).
  - Todas as rotas `/api/**` validam o usuário autenticado no servidor via `supabase.auth.getUser()`, rejeitando requisições não autorizadas com HTTP 401.
  - Todo o cache client-side (`localStorage`) é estritamente isolado por `kitsune_${user.id}_...` e limpo na desconexão (`SIGNED_OUT` ou troca de conta).
- **Banco de Dados Reestruturado:**
  - Tabela `accounts` removida definitivamente; `bank_accounts` consolidada como fonte única de contas correntes, poupanças e cartões de crédito.
  - Expansão de `pluggy_connections` com logos, slugs e consentimento.
  - Expansão de `bank_accounts` com `institution_name`, `product_name`, `subtype`, `credit_limit`, `balance_due_date`, etc.
  - Expansão de `transactions` com conciliação rica: `clean_description`, `category_pt`, `operation_type`, `is_internal_transfer`, `is_refund`, `is_subscription`, `installment_number`, `total_installments`.
  - Tabelas de `investments` (renda fixa, fundos, ações), `loans` (financiamentos e empréstimos) e identidade consolidada multi-banco em `users_profile` (`consolidated_identity` com CPF mascarado).
- **Resolução de Marcas & Logos Oficiais em SVG:**
  - Integração com vetores oficiais dos repositórios `rzmt/logos-bancos-br`, `Tgentil/Bancos-em-SVG` e `henriquezolini/react-bancos` para 16 bancos brasileiros (Nubank, Itaú, Santander, Inter, Caixa, Mercado Pago, Bradesco, BB, C6, BTG, Safra, PicPay, XP, Rico, Sicredi, Sicoob).
- **Conciliação e Fluxo de Caixa Matemático:**
  - Transferências entre contas da mesma titularidade e pagamentos de fatura são marcadas como `is_internal_transfer = true` e excluídas da soma de receitas/despesas, evitando inflação artificial do fluxo financeiro.
  - Estornos de cartão (`is_refund = true`) abatem diretamente as despesas ao invés de constarem como rendimentos.
- **Contexto Otimizado por Sessão de IA:**
  - `ai_chat_sessions` e `ai_chat_messages` armazenam o histórico no banco de dados. O dossiê do usuário é montado uma única vez por sessão (`buildUserFinancialDossier`) e cacheado em `system_prompt_cached`, invalidado somente após sincronizações Open Finance.
- **Protocolo Docs as Code:** Toda alteração é documentada em `docs/PROJECT_STATE.md` e registrada em `docs/CHANGELOG.md`.

---

## 3. Módulos Implementados
- [x] Blindagem 100% de segurança, eliminação de mocks e isolamento de cache `kitsune_${user.id}_...`
- [x] Reestruturação do Supabase (drop `accounts`, expansão de `bank_accounts`, `transactions`, `investments`, criação de `loans` e tabelas de chat)
- [x] Motor de Resolução de Bancos e Logos Oficiais em SVG (`src/components/BankLogo.tsx` e `public/banks/*.svg`)
- [x] Backfill e sincronização de 10 conexões Pluggy reais (22 contas, 37 investimentos, 2.438 transações enriquecidas)
- [x] Perfil Open Finance consolidado com consenso multi-banco e máscara de CPF (`src/utils/pluggy/identity-consolidator.ts`)
- [x] Filtro Global de Bancos no topo do Dashboard com logos oficiais
- [x] Rastreador de Parcelamentos com abas 1x e 2x+ (`InstallmentsTracker.tsx`) e Subscriptions (`SubscriptionsTracker.tsx`) com Empty State real
- [x] Chat Kitsune IA com arquitetura de sessões por banco de dados e cache de dossiê
- [x] Landing Page Oficial fiel ao Stitch com iPhone 16 Pro mockup, vitrine Open Finance oficial e QR Code do Untitled UI (`/`)
- [x] Diagnóstico Executivo da Kitsune IA com 3 cards dinâmicos e resumo sem markdown solto
- [x] Microfone com Live Audio Waveform (Web Audio API) e transcrição via Whisper
- [x] Geração Automática de Planilhas e Documentos (`/api/export/spreadsheet`) com dados enriquecidos Open Finance
- [x] Scanner de Anomalias em Segundo Plano (`/api/ai/anomalies`) com filtro de transferências internas
- [x] Licenciamento Open Source MIT (`LICENSE`)
- [x] Multi-Tenant RLS ativo em 100% das tabelas públicas com anon revogado
- [x] Diagnóstico Executivo da Kitsune IA com 3 cards dinâmicos e resumo sem markdown solto
- [x] Microfone com Live Audio Waveform (Web Audio API) e transcrição via Whisper
- [x] Mapa de Calor de Gastos Diários (`SpendingHeatmap.tsx`)
- [x] Rastreamento Matemático de Parcelamentos (`InstallmentsTracker.tsx`)
- [x] Auditoria Contínua de Assinaturas e Projeção Anual (`SubscriptionsTracker.tsx`)
- [x] Geração Automática de Planilhas e Documentos (`/api/export/spreadsheet`)
- [x] Scanner de Anomalias em Segundo Plano com Alerta do Agente Albert (`AnomalyAlertCard.tsx`)
- [x] Modal de Apps & Conexões de Produtividade (`AppsModal.tsx`)
- [x] Licenciamento Open Source MIT (`LICENSE`)
- [x] Autenticação e Perfis (`/login`, `/signup`, `/profile`, `users_profile`)
- [x] Sincronização e listagem de Contas e Lançamentos
- [x] Divisão familiar / Multi-membro (`family_members`)
- [x] Chatbot Kitsune AI com seletor de modelos e modo "✨ Automático"
- [x] Conexões Bancárias Open Finance com Security Assurance Banner (`/agents`)
- [x] Unificação da cor oficial `#FF8216` da logo em todo o projeto
- [x] Suporte universal a temas Claro e Escuro de alto contraste
- [x] Painel de Configurações do Sistema e Preferências (`/settings`)
- [x] Responsividade mobile refinada com touch targets de 44px e sem overflow horizontal
