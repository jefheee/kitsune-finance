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
  - Arquitetura multi-tier em `BankLogo.tsx`: 1) SVGs locais otimizados de alta fidelidade para os 16 maiores bancos nacionais; 2) Resolução automática via CDN oficial (`react-bancos` / `rzmt`) para os mais de 140 bancos e cooperativas homologados no Open Finance Brasil; 3) Fallback seguro para vetor neutro `generic.svg`.
- **Motor de Detecção de Renda & Auditoria Declaratória:**
  - Módulo `src/utils/finance/income-detector.ts` que analisa o fluxo histórico de depósitos, frequência, desvio padrão e datas para classificar o perfil em: CLT/Salário Regular, Renda Variável/Autônomo, Entradas Esporádicas ou Sem Renda Regular. Compara com a renda declarada no cadastro para auditar coerência ou alertar subnotificação/outliers.
- **Diagnóstico IA com Camada MSLR Determinística:**
  - Eliminação de alucinações numéricas: os 3 cards do diagnóstico executivo (Liquidez, Gastos e Margem) são calculados deterministicamente por TypeScript e acoplados diretamente ao banco filtrado ou à visão consolidada, nunca pelo texto gerado pelo LLM.
- **Experiência de Usuário e Fluidez:**
  - Saudação personalizada pelo primeiro nome (`userFirstName`).
  - Ordenação patrimonial decrescente por relevância financeira (saldo + investimentos) em todos os seletores e listas de conexões.
  - Widget interativo de Objetivo Patrimonial com metas reais calculadas por liquidez e custos.
  - Auto-disparo de sugestões dinâmicas na Kitsune IA e suporte completo ao tema do SO (`prefers-color-scheme`).
- **Conciliação e Fluxo de Caixa Matemático:**
  - Transferências entre contas da mesma titularidade e pagamentos de fatura são marcadas como `is_internal_transfer = true` e excluídas da soma de receitas/despesas, evitando inflação artificial do fluxo financeiro.
  - Estornos de cartão (`is_refund = true`) abatem diretamente as despesas ao invés de constarem como rendimentos.
- **Contexto Otimizado por Sessão de IA:**
  - `ai_chat_sessions` e `ai_chat_messages` armazenam o histórico no banco de dados. O dossiê do usuário é montado uma única vez por sessão (`buildUserFinancialDossier`) e cacheado em `system_prompt_cached`, invalidado somente após sincronizações Open Finance.
- **Protocolo Docs as Code:** Toda alteração é documentada em `docs/PROJECT_STATE.md` e registrada em `docs/CHANGELOG.md`.

---

## 3. Módulos Implementados
- [x] Refatoração Global de Categorias: eliminação da distorção de R$ 40k, exclusão de aportes/resgates de investimento e TEDs próprias, com navegação mensal independente (< / >) e filtro pelo período selecionado
- [x] Carrossel Apple Wallet de Cartões com interação por Mouse-Drag (`cursor-grab`) e Touch Swipe, barra de limite (usado vs livre), faturas detalhadas, dicas dinâmicas por cartão e seleção interativa
- [x] Dynamic Style Resolver (`resolveCardTheme`) com reconhecimento inteligente de bancos e cartões (Black, Ultravioleta, Uniclass, Azul Itaú, Inter, C6 Carbon, etc.) com reflexo especular minimalista
- [x] Espaço Compartilhado (Duo & Família): reativação completa da aba e toggle no header, conciliação segura de Pix e remanejamentos patrimoniais com consentimento mútuo
- [x] Pacing Inteligente na Kitsune AI: exibição de 4 etapas de raciocínio em tempo real (Conectando, Conciliando, Auditando, Formulando) e streaming fluído via efeito máquina de escrever
- [x] Central de Agentes Oficiais Kitsune (Sentinela Kitsune, Kuro, Daiko, Kage, Ren, Kenji, Takeshi) com cálculo em tempo real e identidade própria
- [x] Transparência de Origem ("Fonte dos Dados") nos 4 KPIs do Dashboard detalhando a contagem exata de contas e lançamentos bancários conciliados
- [x] Rendimento em Investimentos & Carteira Consolidada: cálculo de lucro acumulado e rendimento projetado mensal (~100% CDI / 0,85% a.m.)
- [x] Identidade Warm Obsidian (#0A0A0A/#121214/#27272A) alinhada à Landing Page e eliminação de tremidos na troca de páginas (`scrollbar-gutter: stable`)
- [x] Landing Page Otimizada: Marquee 100% SVG oficial sem textos pesados, inclusão de cooperativas (Civia, Unicred, Ailos, Cresol) e eliminação do lag no Hero
- [x] Auditoria de Segurança Git: verificação minuciosa do repositório, histórico e branches confirmando 0 vazamentos de credenciais, chaves ou variáveis de ambiente
- [x] Fusão do Kitsune Vision Multimodal no Chat (/kitsune) com câmera ao vivo WebRTC, galeria, compressão client-side em canvas e OCR de alta fidelidade
- [x] Criação da Rota Dedicada de Cartões (/cards) estilo Wallet com proporção proporcional, faturas reais por cartão e auditoria de tarifas/anuidade
- [x] Criação da Rota Dedicada de Investimentos (/investments) com termômetro macroeconômico Brasil (Selic, CDI, IPCA, Juro Real, Ibovespa, Dólar) e alocação estratégica adaptativa
- [x] Modo Privacidade Global (isPrivacyMode iniciado como true) ocultando valores sensíveis em R$ •••••• com toggle de olho no AppShell
- [x] Módulo "Gastos de Hoje & Atividade Recente" no Dashboard e janela temporal dinâmica dia/semana/mês/ano ancorada no calendário atual
- [x] Correção matemática de inversão de compras e despesas no extrato e visualizações de categorias
- [x] Padronização definitiva de nomenclatura para "Kitsune AI" em 100% do projeto
- [x] Suíte Completa Pierre Finance & Visual Dinâmico: Ritmo de Gastos (`SpendingCurveChart.tsx`), Donut de Categorias (`CategoryDonutChart.tsx`), Faturas Anteriores (`InvoiceBarChart.tsx`) e Gestão de Cartões Estilo Apple Wallet (`WalletCards.tsx`)
- [x] Kitsune Vision Multimodal com Câmera e Galeria (`/vision` & `/api/ai/vision`): OCR, análise de cardápios, produtos por impulso e simulação de bens caros (casa/carro) cruzando renda, limite seguro dos 30% e horas de trabalho com compressão no cliente para economia massiva de tokens
- [x] Paginação Estruturada no Extrato ("1, 2, 3...") com Limite de Scroll (`PaginatedTransactionsView.tsx`) com 4 KPIs, filtros avançados e modal de Nova Transação manual
- [x] Biblioteca de Micro-Interações React Bits (`SpotlightCard.tsx`, `ShinyText.tsx`, `CountUp.tsx`, `DecryptedText.tsx`) integrados na Landing Page e Dashboard
- [x] Motor de Resolução de Marcas Simple Icons & Decodificação Brasileira (`src/utils/finance/merchant-resolver.ts` e `src/components/MerchantLogo.tsx`)
- [x] Mecanismo de Pesquisa Financeira Global 360° com Dossiê de Estabelecimento (`GlobalFinanceSearchModal.tsx` via `Ctrl+K`)
- [x] Central de Agentes Especialistas da Kitsune Dinâmicos (`src/app/agents/page.tsx` com Julius, Sherlock, Tio Patinhas, Inspetor Bugiganga, Megamen e Silvio)
- [x] Rota Dedicada de Conexões Bancárias & Open Finance sem FAQ redundante (`src/app/connections/page.tsx`)
- [x] Granularidade Temporal no Dashboard (Dia a Dia, Semana a Semana, Mês a Mês, Ano a Ano)
- [x] Carrossel de Sugestões com Navegação por Setas `<` e `>` no Desktop e touch no mobile em `kitsune/page.tsx`
- [x] Marquee Infinito Fluido com Logos Oficiais de mais de 20 Bancos na Landing Page (`animate-marquee`)
- [x] Fluxo de Logout Direcionado para Landing Page e Botão de Retorno no Login/Signup
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
