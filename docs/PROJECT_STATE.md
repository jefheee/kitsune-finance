# Estado do Projeto - Kitsune Finance

**Última atualização:** 01/11/2026
**Status Geral:** Operacional / Release v2.1 — Migração Completa de Front-End & UX para Padrão Wealthfolio em Warm Obsidian (Desktop, Tablet & Mobile/PWA, Zero Erros TypeScript, `.benchmarks/` higienizado)

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
- [x] Módulo de Patrimônio Total & Ativos Físicos (Release v2.4):
  - **Migração Supabase (`20261101_custom_assets_schema.sql`):** Tabela `public.custom_assets` com FORCE RLS e tipagem Zod estrita para veículos, imóveis, terrenos, FGTS e ativos alternativos.
  - **Motores Determinísticos MSLR (`src/utils/finance/engine/`):**
    - `fipe.ts`: integração BrasilAPI com cache L1/L2 (0ms), marcas, modelos, anos e cotação instantânea, com taxa de depreciação/valorização anualizada composta.
    - `fgts.ts`: projeção determinística oficial da Caixa Econômica (TR + 3% a.a. à taxa de 0,2466% a.m., aporte mensal de 8% do salário bruto e poder de compra real via Equação de Fisher).
    - `land-valuation.ts`: Modelo A (Custo Contábil & Ganho de Capital IRPF progressivo 15%), Modelo B (correção composta por IPCA vs. IGP-M) e Modelo C (Radar Geográfico Overpass OpenStreetMap em 2km com Kitsune Infrastructure Score 0-100 e multiplicador de atratividade por m²).
  - **Interface Wealthfolio em Warm Obsidian:** `VehicleFipeSelector.tsx` (cascata Tipo -> Marca -> Modelo -> Ano -> Preço ao vivo), `LandValuationCard.tsx` (auto-fill de CEP v2 com coordenadas e abas Custo, Índices e Radar Local), `FgtsCalculatorCard.tsx` e `AssetModal.tsx` integrado no Dashboard (`NetWorthHeroChart.tsx`, `GroupedAccountsList.tsx` e `AllocationTreemap.tsx`) e gaveta de ações rápidas no `AppShell.tsx`.
- [x] Guardião Biométrico PWA (WebAuthn W3C + Cortina de Privacidade Page Lifecycle + PIN Universal + Snapshot Masking 0ms): módulo `src/utils/security/biometrics.ts` (checagem de `isSecureContext`, diagnóstico de ambiente IP/HTTPS, credenciais de plataforma `navigator.credentials.create` com ES256/RS256, verificação `userVerification: required` e cofre local com PIN SHA-256), componente de bloqueio global `src/components/security/BiometricLockGuard.tsx` em `src/app/layout.tsx` (onboarding proativo para novos dispositivos, cold-start lock ao abrir o PWA, cortina instantânea `#0A0A0A` síncrona via `window.onblur` e `pwa-privacy-curtain-active` no DOM para blindagem total na tela de recentes/multitarefa do Android/iOS, e keypad numérico estilo app de banco com fallback de senha) e painel de controle em `src/app/settings/page.tsx`.
- [x] Fusão Total de UI/UX — Portabilidade Completa do Wealthfolio em Warm Obsidian (Fases 1 a 4): substituição integral da casca visual e navegação do Kitsune Finance pelo layout, densidade e responsividade do Wealthfolio (`github.com/wealthfolio/wealthfolio`) com paleta estrita Warm Obsidian (`#0A0A0A` / `#121214` / `#18181B` / `#27272A` / `#FF8216`, zero tons azulados):
  - **Fase 1 (`AppShell.tsx` + `WealthfolioIcons.tsx`):** Sidebar desktop vertical enxuta e colapsável (`68px` / `228px` persistida) com ícones lineares 1.75px, busca global `Ctrl+K`, sync Open Finance e privacidade; Mobile (`< 768px`) com Bottom Navigation Bar flutuante (`env(safe-area-inset-bottom)`), feedback tátil, badge de privacidade, botão central `+` de ação rápida e gaveta "Mais".
  - **Fase 2 (`/dashboard` + `NetWorthHeroChart.tsx` + `GroupedAccountsList.tsx`):** Saldo patrimonial em destaque com seletor `BRL` / `USD` / `CDI/mês`, gráfico de área SVG em spline cúbica monotônica com gradiente `#FF8216` e seletor linear `1M`/`3M`/`6M`/`1Y`/`ALL` via cálculo reverso em centavos (`calculateReverseHistoricalBalances`), mais lista densa agrupada expansível (Contas Bancárias, Investimentos, Cartões/Passivos) e linha contábil `= Patrimônio Líquido Consolidado`.
  - **Fase 3 (`/investments`, `/holdings`, `/transactions`, `HoldingsDataTable.tsx`, `TransactionsDataTable.tsx`):** Tabelas densas com ordenação por colunas, números alinhados à direita (`tabular-nums`), paginação fluida e conversão automática `< 768px` para lista compacta empilhada (valor principal + variação `%` / agrupamento diário).
  - **Fase 4 (`/insights`, `/goals`, `AllocationGauges.tsx`, `AllocationTreemap.tsx`, `IncomeHistoryCard.tsx`):** Gauges semicirculares `180°` de exposição/risco (X-Ray Score, FGC, Reserva 6m, Limite de Crédito), Donut semicircular multi-slice, Treemap SVG determinístico por classe e instituição, histórico de proventos de 12 meses em barras finas e página dedicada de Metas & FIRE pela Equação de Fisher.
- [x] Consolidação Production-Ready (Release v2.0): Higienização profunda de artefatos órfãos (remoção de scripts temporários na raiz, capturas de tela e logo legada com blindagem total no `.gitignore`), upgrade do Webhook Real-Time Pluggy (`/api/webhooks/pluggy`) com suporte a `transactions/created`, `transactions/updated` e `transactions/deleted` mais invalidação automática do cache de dossiê da IA (`system_prompt_cached = null`), integração visual do Monitor de Garantia FGC por Emissor Real e Simulador de Equivalência Tributária/Juro Real de Fisher em `/investments` e `/dashboard`, atualização executiva completa do `README.md` (v2.0) e compilação de produção Next.js validada com 33/33 rotas geradas com sucesso.
- [x] Reconciliador Familiar ("Pix de Acerto Único"), Simulador Interativo de Quitação/Antecipação & Auditoria Upstream Pluggy/BrasilAPI/MinhaReceita (Etapa 5): governança institucionalizada de `.benchmarks/` em `ARCHITECTURE_EXPANSION.md`, `AGENTS.md` e `~/.gemini/GEMINI.md`; `src/utils/finance/shared-settlement.ts` + card "Acerto Inteligente do Mês (Pix Único)" em `src/app/shared/page.tsx` (arredondamento exato de Hamilton em centavos + *Minimum Cash Flow*, WhatsApp 1-clique e agente Takeshi); `src/components/finance/DebtAndAdvanceSimulator.tsx` integrado em `src/app/cards/page.tsx` (Avalanche vs. Bola de Neve com *Snowball Rollover* + Antecipação vs. CDI líquido); taxas BCB ao vivo (`src/utils/finance/macro-rates.ts` + `/api/finance/macro-rates`); failover duplo CNPJ/CNAE (`BrasilAPI` <-> `MinhaReceita` com `cnaes_secundarios`); e metadados estruturados Pluggy (`payeeMCC` ISO 18245, `paymentData` mesmo CPF/CNPJ e segregação `issuer` vs. custodiante no teto R$ 250k do FGC).
- [x] Performance Client-Side 0ms, Extrato Virtualizado 60 FPS & Diagrama de Sankey (Etapa 4 + Auditoria Upstream Maybe/Actual/Ghostfolio): `src/utils/cache/indexeddb-cache.ts` (Read-Through Cache nativo L1+IndexedDB isolado por `kitsune_${userId}_db` integrado ao `FinanceDataContext.tsx`), `src/components/finance/VirtualizedTransactionsList.tsx` (virtualização 60 FPS para 3.000+ transações com modal de auditoria e `isPrivacyMode`), `src/components/charts/CashFlowSankey.tsx` (Sankey SVG responsivo de 3 colunas fiel ao Maybe Finance com cantos assimétricos e paleta Warm Obsidian) e refinamentos upstream em `reconciler.ts`, `enrichment-pipeline.ts` e `/api/mcp`.
- [x] Orquestração Multi-Agente Determinística (MSLR) & Servidor MCP Nativo (Etapa 3): `src/utils/ai/deterministic-tools.ts` (5 Macro-Tools puras em TypeScript + conciliador proporcional familiar), `src/utils/ai/kitsune-agents-registry.ts` (roteador oficial dos 7 Agentes Especialistas: Sentinela Kitsune, Kuro, Kenji, Daiko, Kage, Ren e Takeshi), injeção estrita do bloco `[ENGINE_MATEMATICO_AUDITADO]` em `src/utils/ai/dossier.ts`, `src/app/api/chat/route.ts` e `src/app/api/ai/generate-insight/route.ts`, cards em tempo real com `isPrivacyMode` em `src/app/agents/page.tsx` e servidor MCP JSON-RPC 2.0 autenticado em `src/app/api/mcp/route.ts`.
- [x] Pipeline Open Finance v2, Reconciliação Anti-Duplicidade & Enriquecimento Comercial 3 Camadas: migration `supabase/migrations/20261101_reconciliation_and_merchants_cache.sql` (`kind`, `matched_transfer_id`, `reconciled_from_pending_id`, `known_merchants` com FORCE RLS), `src/utils/finance/reconciler.ts` (reconciliação in-place `PENDING` -> `POSTED`, classificação `kind`, Auto-Transfer Matcher 72h e `calculateReverseHistoricalBalances` em centavos inteiros) e `src/utils/finance/enrichment-pipeline.ts` (validação oficial CNPJ Módulo 11 + `BrasilAPI` CNAE com cache Supabase), integrados em `src/utils/pluggy/` e `/api/openfinance`.
- [x] Motor Matemático Determinístico BR & X-Ray Engine (v2.0) em `src/utils/finance/engine/`: `cdi.ts` com cálculo oficial DU/252 B3/CETIP e feriados ANBIMA, `taxes.ts` com IR/IOF regressivo RFB e equivalência LCI/LCA vs CDB, `fisher.ts` com Equação de Fisher exata e poder de compra real, `cet.ts` via Newton-Raphson ($10^{-7}$) e antecipação de parcelas, `debt-payoff.ts` com simulador Snowball vs Avalanche e rollover real de parcelas mínimas, e `xray-rules.ts` com Kitsune Health Score (0-100) e auditoria FGC (R$ 250k).
- [x] Espaço Compartilhado 360° (`/shared`): Eliminação do AppShell duplicado (resolução do bug de barra lateral dupla), criação de hub com 7 módulos temáticos (Visão Geral & Balanço, Salários & Fluxo Mensal por integrante, Contas Pagas e a Pagar com indicação de pagador e vencimento, Investimentos & Rendimento com comparativo Poupança vs CDI vs IPCA+, Simulador Interativo de Metas Familiares com juros compostos, Calculadora de Divisão Justa 50/50 e Proporcional à renda com valor de ressarcimento, e Administração de Membros com convites WhatsApp/Gmail).
- [x] Otimização do Pop-up "+" de Anexos no Kitsune AI (`/kitsune`): Eliminação completa da barra de rolagem vertical via grid 2x2 ultra-compacto para modos de Visão e Contexto Financeiro.
- [x] Auditoria Transparente de Investimentos e Paginação (`/investments` e Dashboard): Detalhamento do núcleo de R$ 89,5k em 4 grandes CDBs vs R$ 16,9k em menores aportes e 4 posições zeradas/resgatadas; implementação de paginação numerada (1, 2, 3...) com 6 posições por página e alternador de posições resgatadas em ambas as telas.
- [x] Faturas de Cartão com Parcelamento Detalhado e Widgets no Dashboard: Detalhamento explícito de compras parceladas nas faturas (quanto foi parcelado no total e quanto é a parcela mensal), 5º card de KPI "Liquidez Livre em Conta", e trio de widgets inteligentes (Comprometimento de Renda %, Reserva de Emergência em Dias/Meses e Previsão de Fechamento do Mês).
- [x] Consumo Total de Dados Open Finance & Correção em Modal de Busca: Aumento dos limites de busca de 400 para 3000 transações no contexto global e de 50 para 1500 no espaço compartilhado; correção de sinal no modal de busca global (despesas exibidas com sinal de menos e cor avermelhada, sem distorção verde de crédito); desacoplamento de filtros temporais nos módulos de Categorias, Parcelamentos e Assinaturas permitindo navegação livre entre meses.
- [x] Página Dedicada do Espaço Compartilhado (`/shared`): Centralização completa da governança multi-membros, visão consolidada conjunta, abas individuais por integrante (cartões, contas e extrato isolados por membro), distribuição percentual de patrimônio, gestão de convites com WhatsApp/Gmail e botão de desligamento total com revogação RLS imediata ("Sair do Espaço", sem resíduos visíveis).
- [x] Isolamento Pessoal Total nas Rotas Principais: O painel pessoal (`/dashboard`), cartões (`/cards`), investimentos (`/investments`), bancos (`/connections`) e IA (`/kitsune`) carregam exclusivamente os ativos do usuário autenticado (`user_id = authUser.id`), eliminando contaminações cruzadas de contas ou cartões no fluxo diário.
- [x] Correção de Entradas do Mês & Timezone: Implementação de `parseLocalDate` para eliminar o deslocamento de timezone UTC no 1º dia de cada mês, computando corretamente o salário integral (ex: R$ 4.842,00 no Santander) e distinguindo receitas operacionais de transferências/resgates internos.
- [x] Modo Privacidade no Gráfico de Ritmo de Gastos (`SpendingCurveChart.tsx`): Mascaramento dinâmico de quantias monetárias, comparativos percentuais e eixos quando o botão de privacidade está ativo.
- [x] Paginação Retrátil em "Minhas Contas & Cartões": Limitação inicial a 5 cartões/contas com botão expansível "Ver mais (X outras contas)" / "Ver menos", prevenindo rolagem vertical excessiva.
- [x] Central de Notificações com Feedback Imediato & Limpeza de Glow: Desativação automática do botão para "Conexão aceita" após aprovação de convite, fechamento do modal e eliminação instantânea do badge e pulso luminoso no AppShell ao abrir.
- [x] Landing Page Atualizada: Remoção completa de menções e links do "Kitsune Vision" autônomo, unificando a navegação para Kitsune AI (`/kitsune`) e substituindo o card de visão computacional por Consultoria Autônoma Patrimonial.
- [x] Espaço Compartilhado Multi-Membro com Supabase RLS: Suporte a múltiplos membros simultâneos (além de duo), expansão de vínculos (Cônjuge, Familiar, Filho, Sócio, Parceiro Financeiro, Amigo, Workspace, Personalizado), resolução de e-mail via RPC seguro com SECURITY DEFINER, código de convite explícito (`KT-XXXX`), link direto (`?accept_invite=...`) e botões de compartilhamento 1-clique (WhatsApp e Gmail).
- [x] Carteira de Cartões Master-Detail & Interação em 2 Toques (`WalletCards.tsx`): layout split desktop onde a pilha vertical fica à esquerda e os detalhes do cartão ativo (limite, faturas, dicas dinâmicas, últimos lançamentos) à direita. Interação em 2 cliques (1º expande prévia, 2º seleciona cartão) e ordem invertida com o cartão mais relevante no topo. Mobile 100% clean estilo Pierre Finance.
- [x] Lenis Smooth Scrolling Desbloqueado Globalmente: Remoção do overflow restritivo no container pai do AppShell e adição de interceptor para âncoras na Landing Page (`#vantagens`, `#recursos`, etc.).
- [x] Blindagem Completa do Modo Privacidade: Mascaramento integral de quantias monetárias em diagnósticos de agentes, cards de anomalias, gráfico donut de categorias e conexões bancárias.
- [x] Dashboard Otimizado: Remoção das abas redundantes "Cartões" e "Investimentos" em prol das rotas dedicadas `/cards` e `/investments`; resolução da meta patrimonial com labels em português (`FINANCIAL_GOALS_MAP`); bloqueio estrito de lançamentos futuros no feed de despesas recentes.
- [x] Kitsune AI com 3 Modelos Especialistas: Seleção simplificada e potente no Gemini API (`gemini-3.8-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-pro-preview`) e popover de anexos e contexto reorganizado.
- [x] Central de Notificações em Tempo Real (`NotificationsModal.tsx` & `/api/notifications`): sino com badge de não lidas no AppShell (desktop e mobile) para gerenciar convites e alertas com ações diretas de aceitar e recusar conexões.
- [x] Apple Wallet Vertical Stack (`WalletCards.tsx`): visualização de cartões sobrepostos na vertical revelando os cabeçalhos das instituições (logos, contactless, chip e dígitos) inspirada na Carteira da Apple, com alternador suave para carrossel horizontal interativo por mouse-drag.
- [x] Mobile UI Pierre Finance: dock bar flutuante inferior em pill arredondado (`rounded-full`) com backdrop blur, ícones elegantes e indicador em ponto luminoso, além de widget de cartões mobile com banner institucional, total em faturas, vencimento e pill direto de "Saldo em contas >".
- [x] Lenis Smooth Scrolling: integração global de rolagem suave e lenta via `SmoothScrollProvider.tsx` e classes Lenis no `globals.css` com respeito automático a `prefers-reduced-motion`.
- [x] Padronização Visual Neutra (Warm Obsidian): Eliminação completa de classes legadas com matiz azul/marinho (`#12161F`, `#262E3D`, `#0E121A`, etc.) em todos os componentes e páginas (`SpotlightCard`, extrato, parcelamentos, assinaturas, gráficos, modais, settings, profile e chat), padronizando no cinza neutro e grafite profundo (`#0A0A0A` / `#121214` / `#18181B` / `#27272A`) idêntico à Landing Page
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
- [x] Scanner de Anomalias em Segundo Plano com filtro de transferências internas
- [x] Licenciamento PolyForm Noncommercial 1.0.0 (`LICENSE`)
- [x] Multi-Tenant RLS ativo em 100% das tabelas públicas com anon revogado
- [x] Mapa de Calor de Gastos Diários (`SpendingHeatmap.tsx`)
- [x] Rastreamento Matemático de Parcelamentos (`InstallmentsTracker.tsx`)
- [x] Auditoria Contínua de Assinaturas e Projeção Anual (`SubscriptionsTracker.tsx`)
- [x] Modal de Apps & Conexões de Produtividade (`AppsModal.tsx`)
- [x] Autenticação e Perfis (`/login`, `/signup`, `/profile`, `users_profile`)
- [x] Sincronização e listagem de Contas e Lançamentos
- [x] Divisão familiar / Multi-membro (`family_members`)
- [x] Chatbot Kitsune AI com seletor de modelos e modo "✨ Automático"
- [x] Conexões Bancárias Open Finance com Security Assurance Banner (`/agents`)
- [x] Unificação da cor oficial `#FF8216` da logo em todo o projeto
- [x] Suporte universal a temas Claro e Escuro de alto contraste
- [x] Painel de Configurações do Sistema e Preferências (`/settings`)
- [x] Responsividade mobile refinada com touch targets de 44px e sem overflow horizontal

- [x] Refinamento Executivo do Dashboard, Roteamento Automático Kitsune AI & Suíte Apple Wallet (Release v2.6):
  - **Dashboard Inicial:** Integração de `BankBalanceCards.tsx` com gradientes de bancos e faturas abertas, `CompactKitsuneChat.tsx` com chips dinâmicos de resposta instantânea, botão `+ Lançamento` com `ManualTransactionModal.tsx` para gastos em dinheiro e `TransactionDetailModal.tsx` estilo Apple Wallet/Mobbin (com histórico completo do estabelecimento e total acumulado) ao clicar em transações.
  - **Roteamento de IA & Observabilidade Google AI Studio:** Reintrodução da opção "✨ Automático (Roteamento Inteligente)" como padrão em `KITSUNE_AI_MODELS`, cascata de complexidade (Lite 3.5 -> Flash 3.8 -> Pro 3.1) e rastreamento em tempo real de `usageMetadata` (tokens consumidos) e cotas de requisições (RPM/RPD) no rodapé das mensagens do chat.
  - **Governança Multi-Membros no Espaço Compartilhado (`/shared`):** Pills interativos de seleção de membros (`Consolidado`, `Você`, `Membros 1..10+`), remoção de termos restritos a casais em prol de cooperação universal, cards individuais de custódia e botões diretos de `+ Convidar Membro` e `Desconectar / Sair do Espaço`.
  - **Eliminação de Fricções:** Remoção de tags de marketing ("60 FPS"), desbloqueio de rolagem nativa em caixas internas (restrição do Lenis à Landing Page) e prevenção de recargas acidentais (`overscroll-behavior-y: none`).

- [x] Geração de Documentos IA, Busca Global 360°, Centralização de Modais & Bento Grid Executivo (Release v2.7):
  - **Exportação Multiformato Kitsune AI (`document-exporter.ts` e `/kitsune`):** Barra de ações acoplada a relatórios da IA com download instantâneo em Word (.doc), Salvar PDF, Abrir no Google Docs (com rich-HTML pré-copiado para Ctrl+V imediato) e Markdown (.md), sem recusa da IA.
  - **Resolução de Contenção e Centralização de Modais:** Aplicação de `createPortal(..., document.body)` em `PluggyConnectModal`, `AssetModal`, `ManualTransactionModal`, `TransactionDetailModal` e `GlobalFinanceSearchModal`, juntamente com a higienização de `transform: translateY` em `pageFadeIn` (`globals.css`), garantindo que todos os modais abram perfeitamente centralizados no viewport visível sem exigir scroll do usuário.
  - **Busca Financeira Global 360° (`GlobalFinanceSearchModal.tsx`):** Indexação unificada de páginas do sistema, contas correntes e cartões, carteira de investimentos, ativos imobilizados (FIPE/FGTS/Imóveis) e transações com navegação direta via `useRouter`.
  - **Overhaul do Diagnóstico da IA & Bento Grid (`AiDiagnosticPanel.tsx` e `/dashboard`):** Formatação estrita com `Intl.NumberFormat('pt-BR')` em 100% dos valores injetados e textos gerados (eliminação de floats brutos como `106561.48`), posicionamento em Bento Grid de largura total para respiração visual e eliminação do truncamento de métricas (`Cobert...`, `Gastos...`).
  - **Limpeza do Cabeçalho Mobile e Localização:** Aumento da saudação `Olá, {userFirstName}`, remoção de botões redundantes (lupa e CSV) da barra mobile, destaque do botão `Sincronizar` e tradução completa dos períodos (`1 Mês`, `3 Meses`, `6 Meses`, `1 Ano`, `Tudo`) e unidades no Hero Chart.

- [x] Widgets Interativos Estilo Banco, Limpeza de Cabeçalhos e Tabs 100% Responsivas (Release v2.8):
  - **Widgets Interativos Executivos (`DashboardExecutiveWidgets.tsx`):** Transformação das 4 seções principais ("Contas & Custódia", "Atividades Recentes Conciliadas", "Metas & Reserva" e "Maiores Posições") em cards idênticos aos `BankBalanceCards` (grid 2x2 no mobile e 4 colunas no desktop). Cada widget é interativo e clicável, permitindo expandir o conteúdo completo com animação fluida e botão de recolher, eliminando a sobrecarga de informações na tela inicial.
  - **Segmented Tabs Sem Scroll no Mobile:** Redesenho das 4 abas ("Visão Geral", "Fluxo & Gastos", "Transações", "Parcelas & Assinaturas") em layout `grid grid-cols-2 sm:grid-cols-4 gap-1 w-full`, encaixando-se perfeitamente em 100% dos celulares sem barra de rolagem horizontal.
  - **Ações Rápidas Justificadas e Centralizadas:** Botões "Sincronizar" e "+ Lançamento" organizados em grid de 2 botões de largura igual (50% cada) no mobile, com textos completos e ícones centralizados; no PC, alinhados de forma harmônica na barra superior.
  - **Remoção de Elementos Poluentes:**
    - Remoção do botão redundante `+ Conectar Conta` do cabeçalho da página inicial.
    - Remoção da bolinha/anel laranja do botão `+` na barra de navegação inferior mobile (`AppShell.tsx`).
    - Remoção do card de "Diagnóstico & Parecer da Kitsune AI" e do "Kitsune Score" da página inicial, limpando o dashboard e priorizando os dados financeiros diretos.
  - **Correção e Estabilidade:** Resolução de duplicidade de sintaxe no motor FIPE (`src/utils/finance/engine/fipe.ts`) e validação rigorosa de tipagem com `npx tsc --noEmit` zerado (0 erros).

---

- [x] Padronização Global de UI/UX, Busca FIPE Flexível com Fallback e Radar Imobiliário Enriquecido (Release v2.9):
  - **Padronização Global do Design System Wealthfolio:** Todas as páginas do sistema (`/dashboard`, `/assets`, `/cards`, `/investments`, `/insights`, `/transactions`, `/goals`, `/agents`, `/connections`, `/shared`, `/profile`, `/settings`) unificadas no mesmo container canônico (`max-w-[1380px] p-4 md:p-7 pb-28 md:pb-10 font-sans`), eliminando margens coladas e disparidades entre telas.
  - **Cabeçalhos e Botões Harmonizados:** Substituição de tags genéricas em caixa alta e pontinhos laranjas por headers limpos com ícone oficial SVG (`WfIcons`), tipografia `text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-[#F4F4F5]`, subtítulo sem jargões e botões nos padrões primário (`h-9 px-4 rounded-xl bg-[#FF8216]`) e secundário (`h-9 px-3.5 rounded-xl border border-zinc-200 dark:border-[#27272A]`).
  - **Motor FIPE Tolerante e Resiliente (`fipe.ts` & `VehicleFipeSelector.tsx`):**
    - Implementação de busca fuzzy e flexível por tokens (insensível a acentuação e ordem dos termos).
    - Seleção de ano desbloqueada e antecipada (o usuário pode escolher o ano antes mesmo de definir a versão).
    - Fallback transparente e automático com a API da Parallelum contra falhas de rate limit (erro 429) e erro interno da BrasilAPI, eliminando a mensagem "Nenhum ano disponível para esta versão".
  - **Identificação Veicular por Placa (`/api/assets/vehicle-plate`):** Consulta por placa (Mercosul ou padrão antigo) com estimativa da UF de emplacamento e suporte nativo a gateways comerciais (APIBrasil/WDAPI).
  - **Redesenho do Modal de Ativos e Card de Imóveis (`AssetModal.tsx` & `LandValuationCard.tsx`):**
    - Eliminação de opções duplicadas (fusão de "Terreno" e "Imóvel" em uma categoria única intuitiva com subtipos: Casa, Apartamento, Terreno / Lote e Comercial).
    - Grid responsivo espaçoso sem truncamento de CEP, Bairro ou Rua.
    - Abas rebatizadas: "Valor Contábil & IRPF", "Correção por Inflação" e "Radar de Região & Serviços".
    - Enriquecimento com estimativas de mercado do m² da região do CEP (venda, locação e rental yield) e listagem nominal detalhada de todos os pontos de interesse identificados pelo OpenStreetMap Overpass no raio de 2km com suas respectivas distâncias em metros.
  - **Compilação e Estabilidade:** Validação TypeScript com 0 erros (`npx tsc --noEmit`) e build de produção bem-sucedido de todas as 42 rotas do Next.js 16.

- [x] Unificação da Kitsune AI na Navegação, Hierarquia Visual e Abas Estilo Widgets (Release v3.0):
  - **Unificação da Página de IA na Navegação:** Eliminação da duplicidade entre "Agentes IA" e "Squad IA" que causava ativação simultânea. A navegação passa a contar com uma única entrada oficial: **Kitsune AI** (`/kitsune`), com o atalho redundante de "Squad IA" removido tanto da sidebar desktop quanto do More Sheet mobile.
  - **Abas do Dashboard com Fundo dos Widgets:** As 4 abas ("Visão Geral", "Fluxo & Gastos", "Transações", "Parcelas & Assinaturas") foram convertidas para o mesmo padrão estético e neutro dos widgets (`bg-[#121214] border-[#27272A]`), sem cores saturadas, destacando a aba ativa suavemente com `bg-[#18181B] border-[#3F3F46]`.
  - **Subtítulo Executivo Refinado:** Substituição da métrica técnica genérica de CDI/instituições por uma mensagem sóbria de alto nível: *"Gestão patrimonial consolidada e acompanhamento estratégico em tempo real."*
  - **Hierarquia Visual da Visão Geral Reordenada:**
    - **Falar com Kitsune AI (`CompactKitsuneChat`):** Movido para o topo do dashboard, imediatamente acima dos cartões de bancos para acesso instantâneo ao copiloto inteligente.
    - **Avisos de Agentes & Teto FGC (`AnomalyAlertCard` & `fgcWarning`):** Movidos para logo abaixo do gráfico de patrimônio líquido (`NetWorthHeroChart`), mantendo a leitura fluida e os dados patrimoniais em primeiro plano.
  - **Validação de Código:** TypeScript estrito com 0 erros (`npx tsc --noEmit`).

---

## 4. Context Handoff (Memória de Continuidade entre Chats)
- **Última Etapa Concluída:** Release v3.2 — **Glow Refinado, Widgets Neutros Sob Demanda, Scroll Restoration & Logo Horizontal**:
  1. **Landing Page:** Glow alaranjado atrás do iPhone 16 Pro substituído por halo sofisticado e translúcido em carmesim suave e branco (`rgba(225,29,72,0.12)` + `rgba(255,255,255,0.06)`).
  2. **Dashboard Widgets:** Cards de "Módulos & Visão Executiva" convertidos para cinza neutro Warm Obsidian (`#121214` e `#27272A`), iniciando 100% recolhidos para que o usuário decida quando expandir.
  3. **Scroll Restoration:** Criado `ScrollRestorationProvider.tsx` integrado ao `layout.tsx` que preserva a posição exata de scroll por rota ao usar o botão "Voltar" em navegadores e no app PWA mobile.
  4. **Logo Horizontal Transparente:** Implementada no `README.md` (GitHub), no footer da Landing Page e nas telas de `/login` e `/signup`, removendo títulos redundantes.
  5. **Estabilidade Técnica:** TypeScript validado com 0 erros (`npx tsc --noEmit`).
- **Próxima Etapa Imediata:** Implementação opcional de `ALLOWED_USERS_EMAILS` (Allowlist Server-Side) para restringir o acesso na Vercel mantendo o repositório aberto e público no GitHub.
- **Pendências ou Bloqueios:** Nenhum. Todo o código compila perfeitamente.
