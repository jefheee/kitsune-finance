# Histórico de Modificações (Changelog)

Todas as alterações notáveis no projeto Kitsune Finance são registradas de forma incremental aqui.

---

## [2026-10-29] - Página Dedicada /shared (Espaço Compartilhado), Isolamento Pessoal Total, Correção de Entradas & Modo Privacidade em Gráficos
- **Arquivos Afetados:** `src/app/shared/page.tsx`, `src/app/dashboard/page.tsx`, `src/context/FinanceDataContext.tsx`, `src/components/charts/SpendingCurveChart.tsx`, `src/components/layout/AppShell.tsx`, `src/components/NotificationsModal.tsx`, `src/app/api/shared-space/route.ts`, `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`.
- **Objetivo:**
  - Criação da página `/shared` com governança multi-membros, visão consolidada conjunta, abas individuais por integrante, distribuição patrimonial e botão de desligamento total ("Sair do Espaço") com revogação RLS imediata.
  - Isolamento estrito das telas pessoais (`/dashboard`, `/cards`, etc.): cada usuário visualiza exclusivamente suas próprias contas e transações, sem misturar ativos.
  - Correção no cômputo de "Entradas do Mês" eliminando bug de timezone UTC no 1º dia do mês via `parseLocalDate` (incluindo o salário integral de R$ 4.842,00).
  - Suporte ao Modo Privacidade (`hideValues`) no gráfico de Ritmo de Gastos e paginação retrátil com botão "Ver mais" em "Minhas Contas & Cartões".
  - Fechamento automático e feedback visual "Conexão aceita" no modal de notificações, limpando instantaneamente alertas e glow ao abrir.

---

## [2026-10-29] - Remoção do Kitsune Vision da Landing Page
- **Arquivos Afetados:** `src/app/page.tsx`, `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`.
- **Objetivo:**
  - Remoção de todas as menções e links do "Kitsune Vision" na landing page.
  - O atalho da barra de navegação superior foi unificado para `Kitsune AI` (`/kitsune`), integrando as funcionalidades de diagnóstico de forma coesa.
  - Substituição do card isolado de visão computacional na seção de destaques por `Kitsune AI • Consultoria Autônoma`, destacando auditoria orçamentária e consultoria patrimonial contínua.

---

## [2026-10-29] - Refatoração do Espaço Compartilhado Multi-Membro, Carteira de Cartões Master-Detail, Lenis Global e Otimizações de UX
- **Arquivos Afetados:** `src/app/dashboard/page.tsx`, `src/components/finance/WalletCards.tsx`, `src/components/finance/CategoriesView.tsx`, `src/components/charts/CategoryDonutChart.tsx`, `src/app/kitsune/page.tsx`, `src/app/agents/page.tsx`, `src/app/connections/page.tsx`, `src/app/cards/page.tsx`, `src/app/investments/page.tsx`, `src/components/layout/AppShell.tsx`, `src/components/providers/SmoothScrollProvider.tsx`, `src/app/api/shared-space/route.ts`, `src/context/FinanceDataContext.tsx`, `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`.
- **Objetivo:**
  - Multi-Membro no Espaço Compartilhado com 8 perfis de vínculo, resolução de e-mail via RPC seguro, exibição de código gerado (`KT-XXXX`), link direto e botões de compartilhamento rápido (WhatsApp e Gmail).
  - Remoção das abas redundantes "Cartões" e "Investimentos" do Dashboard e padronização para "Espaço Compartilhado".
  - Refatoração dos Cartões: modo Carteira master-detail no desktop, interação em 2 cliques (expandir/selecionar), ordem invertida com o cartão mais relevante no topo e mobile limpo estilo Pierre.
  - Correção na soma de Categorias (exclusão de pagamentos de fatura e transferências próprias) e suporte integral ao Modo Privacidade em gráficos de pizza, agentes e conexões.
  - Ativação do Lenis Smooth Scrolling em todas as rotas internas via liberação de overflow no AppShell e âncoras suaves na Landing Page.

---

## [2026-10-29] - Espaço Compartilhado com Supabase RLS, Central de Notificações, Apple Wallet Stack e Mobile Pierre Finance
- **Arquivos Afetados:** `src/app/api/shared-space/route.ts`, `src/app/api/notifications/route.ts`, `src/components/NotificationsModal.tsx`, `src/components/providers/SmoothScrollProvider.tsx`, `src/context/FinanceDataContext.tsx`, `src/app/dashboard/page.tsx`, `src/components/finance/WalletCards.tsx`, `src/components/layout/AppShell.tsx`, `src/app/globals.css`, `src/app/kitsune/page.tsx`, `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`.
- **Objetivo:**
  - Implementação completa do Espaço Compartilhado via Supabase (`shared_connections`, `user_notifications`), pré-requisito de conta bancária conectada, envio de convites por e-mail com geração de código (`KT-XXXX`), link utilizável (`?accept_invite=...`) e consolidação multi-tenant com conciliação automática de Pix interno.
  - Central de Notificações funcional no AppShell (desktop e mobile) para visualização e resposta instantânea a convites mútuos.
  - Modo Apple Wallet Stack vertical nos cartões com sobreposição fluida, exibição de cabeçalhos e transição para carrossel.
  - Redesenho mobile inspirado no Pierre Finance com barra inferior flutuante em pill dock, widget de faturas e saldo em contas.
  - Rolagem suave com Lenis integrada via `SmoothScrollProvider` e eliminação de tags técnicas desnecessárias na interface.

---

## [2026-10-29] - Padronização Visual Neutra: Eliminação Completa de Tons Azulados em Todo o App
- **Arquivos Afetados:** src/components/react-bits/SpotlightCard.tsx, src/components/finance/PaginatedTransactionsView.tsx, src/components/finance/InstallmentsTracker.tsx, src/components/finance/SubscriptionsTracker.tsx, src/components/finance/SpendingHeatmap.tsx, src/components/charts/InvoiceBarChart.tsx, src/components/charts/CategoryDonutChart.tsx, src/components/charts/SpendingCurveChart.tsx, src/components/AppsModal.tsx, src/components/vision/VisionAnalyzer.tsx, src/components/layout/AppShell.tsx, src/app/connections/page.tsx, src/app/profile/page.tsx, src/app/settings/page.tsx, src/app/dashboard/page.tsx, src/app/kitsune/page.tsx, src/app/investments/page.tsx, src/app/agents/page.tsx, src/app/globals.css.
- **Objetivo:**
  - Remoção de todos os resquícios de tokens azulados/marinho herdados (#12161F, #262E3D, #0E121A, #161B26, #1A202C, #1E2533, #0B0E14, etc.).
  - Padronização 100% alinhada com o Warm Obsidian / Grafite do Design System da Landing Page: fundo #0A0A0A, cards #121214, subcontainers/inputs #18181B, bordas #27272A, e realces em Laranja Kitsune #FF8216.
  - Correção na raiz do SpotlightCard, unificando a aparência de todos os cards do Dashboard, Extrato, Carteira, Investimentos e Kitsune AI.
  - Verificação de build com TypeScript e Turbopack concluída com sucesso (28 rotas).

---

## [2026-10-29] - Refatoração Global de Categorias, Carrossel Wallet Touch/Mouse, Espaço Compartilhado & Identidade Kitsune
- **Arquivos Afetados:** `src/app/dashboard/page.tsx`, `src/components/finance/CategoriesView.tsx`, `src/components/finance/WalletCards.tsx`, `src/utils/finance/card-theme-resolver.ts`, `src/app/investments/page.tsx`, `src/app/kitsune/page.tsx`, `src/app/agents/page.tsx`, `src/app/page.tsx`, `src/components/AiDiagnosticPanel.tsx`, `src/components/AnomalyAlertCard.tsx`, `src/app/globals.css`, `src/utils/finance/income-detector.ts`, `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`.
- **Objetivo:**
  - Correção da distorção de R$ 40k em categorias: exclusão estrita de CDBs/aportes e aplicação do filtro temporal ativo.
  - Carrossel de cartões responsivo estilo Apple Wallet com suporte nativo a drag por mouse e touch swipe, limite utilizado vs livre, faturas detalhadas e dicas dinâmicas.
  - Resolver dinâmico de temas `resolveCardTheme` para cartões bancários com gradientes escuros refinados e reflexo especular minimalista.
  - Reativação completa do Espaço Compartilhado (Duo & Família) com consentimento mútuo, conciliação de transferências internas e alternância no header.
  - Pacing gradual na Kitsune AI: exibição de 4 etapas de pensamento em tempo real e digitação tipo máquina de escrever.
  - Padronização definitiva dos agentes da Kitsune (Sentinela Kitsune, Kuro, Daiko, Kage, Ren, Kenji, Takeshi), audit de segurança no Git e paleta Warm Obsidian (#0A0A0A/#121214/#27272A).

---

## [2026-10-29] - Kitsune Vision Integrada ao Chat, Páginas Dedicadas /cards e /investments, Modo Privacidade e Correção Crítica de Sinais
- **Arquivos Afetados:** `src/app/cards/page.tsx`, `src/app/investments/page.tsx`, `src/app/kitsune/page.tsx`, `src/app/api/chat/route.ts`, `src/components/finance/WalletCards.tsx`, `src/components/finance/PaginatedTransactionsView.tsx`, `src/components/finance/CategoriesView.tsx`, `src/components/finance/SubscriptionsTracker.tsx`, `src/app/dashboard/page.tsx`, `src/components/layout/AppShell.tsx`, `src/context/FinanceDataContext.tsx`, `src/utils/ai/dossier.ts`, `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`.
- **Objetivo:**
  - Fusão definitiva do Kitsune Vision Multimodal diretamente no chat da Kitsune AI (`/kitsune`), eliminando a rota separada `/vision`. Integração de Câmera ao vivo WebRTC, seleção da galeria com compressão client-side em Canvas (1280px, JPEG 0.85), OCR de alta fidelidade e modos rápidos guiados (Cardápio, Horas de Trabalho de Produtos, Simulação Imóvel/Carro e Comprovantes).
  - Correção emergencial de sinais no extrato: compras a débito e no cartão não são mais invertidas como receitas. Lógica refatorada para classificar despesas e receitas com precisão matemática em todas as visualizações (`PaginatedTransactionsView.tsx`, `CategoriesView.tsx`, `WalletCards.tsx`, `dossier.ts`).
  - Criação da página dedicada de Cartões (`/cards`): visual Wallet com proporção clássica de cartão (`aspect-[1.586/1]`), cálculo de faturas reais e independentes por cartão via `getCardInvoiceAmount()`, estatísticas consolidadas de crédito e auditoria inteligente de tarifas e anuidade.
  - Criação da página dedicada de Investimentos (`/investments`): consolidação multi-banco com logos oficiais, termômetro macroeconômico brasileiro em tempo real (Selic 10,75%, CDI 10,65%, IPCA 4,42%, Juro Real +6,23% a.a., Ibovespa e Dólar) e recomendações inteligentes de alocação de ativos (Kitsune Strategy) adaptadas ao patrimônio e renda do usuário.
  - Implementação do Modo Privacidade (`isPrivacyMode` ativo por padrão ao entrar no site) com máscara `R$ ••••••` e botão de alternância no AppShell (desktop e mobile).
  - Módulo "Gastos de Hoje & Atividade Recente" no Dashboard e correção do filtro de granularidade temporal com datas dinâmicas ancoradas em `new Date()`.
  - Suporte completo a query params `?prompt=...` nos botões de auditoria, preenchendo e enviando automaticamente a consulta contextualizada ao chat.
  - Padronização 100% obrigatória do nome para "Kitsune AI" em todos os arquivos e interfaces.

---

## [2026-10-29] - Suíte Pierre Design System, Kitsune Vision Multimodal, Carteira Wallet 3D & Paginação Estruturada
- **Arquivos Afetados:** `src/app/api/ai/vision/route.ts`, `src/app/vision/page.tsx`, `src/components/vision/VisionAnalyzer.tsx`, `src/components/finance/WalletCards.tsx`, `src/components/finance/PaginatedTransactionsView.tsx`, `src/components/finance/CategoriesView.tsx`, `src/components/charts/SpendingCurveChart.tsx`, `src/components/charts/CategoryDonutChart.tsx`, `src/components/charts/InvoiceBarChart.tsx`, `src/components/react-bits/*`, `src/app/dashboard/page.tsx`, `src/components/layout/AppShell.tsx`, `src/app/kitsune/page.tsx`, `src/app/page.tsx`, `src/utils/ai/gemini.ts`, `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`.
- **Objetivo:**
  - Implementação do Kitsune Vision Multimodal (`/vision`) com captura direta via câmera (WebRTC) e upload da galeria, compressão client-side em Canvas (~85% economia de tokens) e 5 modos analíticos (Cardápios, Compras por Impulso, Bens Caros/Financiamentos de Casa/Carro com regra dos 30% da renda, Comprovantes/Notas Fiscais e Modo Livre) cruzando com o dossiê financeiro real do usuário.
  - Carteira de Cartões estilo Apple Wallet (`WalletCards.tsx`) com alternância Stack 3D e Grade moderna, gradientes bancários oficiais, faturas acumuladas, limites e gráficos de histórico de fatura.
  - Paginação estruturada de transações sem scroll infinito (`PaginatedTransactionsView.tsx`) com seletor 10/25/50 por página, botões `< 1 2 3 ... >`, 4 KPIs de resumo e filtros avançados.
  - Visualização dinâmica inspirada no Pierre: Curva do Ritmo de Gastos dia a dia (`SpendingCurveChart.tsx`), Gráfico Donut de Categorias com acordeão interativo (`CategoriesView.tsx`) e barras de fatura (`InvoiceBarChart.tsx`).
  - Hero humanizado do Pierre no Dashboard, componentes interativos React Bits (SpotlightCard, ShinyText, CountUp, DecryptedText) na Landing Page e no App, com total fidelidade ao Design System Warm Obsidian.

---

## [2026-10-29] - Motor Simple-Icons & Decodificação BR, Pesquisa 360°, Central de Agentes Dinâmicos & Marquee Infinito
- **Arquivos Afetados:** `src/utils/finance/merchant-resolver.ts`, `src/components/MerchantLogo.tsx`, `src/components/finance/GlobalFinanceSearchModal.tsx`, `src/app/connections/page.tsx`, `src/app/agents/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/kitsune/page.tsx`, `src/components/layout/AppShell.tsx`, `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/app/settings/page.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `package.json`, `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`.
- **Objetivo:**
  - Integração do repositório Simple Icons com motor de decodificação comercial brasileiro (`merchant-resolver.ts`): limpeza de ruídos de maquininhas e adquirentes (`PAG*`, `MP*`, `CIELO*`, `COMPRA NO DEBITO|`), expansão heurística de abreviações brasileiras (ex: `TRENTO MAT CONST` -> `Trento Materiais de Construção`, `AUTO POSTO` -> `Posto de Combustíveis`) e logos oficiais via CDN Simple Icons (`<MerchantLogo />`).
  - Criação do Mecanismo de Pesquisa Global de Gastos e Estabelecimentos (`GlobalFinanceSearchModal.tsx`): atalho `Ctrl+K` / `Cmd+K` para buscar termos como iFood ou Uber, gerando dossiê 360° com total gasto, ticket médio, dia de pico, meio de pagamento preferido e histórico com ação direta de IA.
  - Implementação de Granularidade Temporal no Dashboard: visão Dia a Dia (últimos 7 dias), Semana a Semana (últimas 2 semanas), Mês a Mês (padrão consolidado) e Ano a Ano (acumulado de 12 meses), com recálculo matemático de patrimônio, receitas e despesas.
  - Reestruturação de Rotas e Hub de Agentes Especialistas da Kitsune: transferência das conexões bancárias para `/connections` (sem accordion de FAQ de privacidade) e transformação de `/agents` na galeria oficial de Agentes Inteligentes (Julius, Sherlock, Tio Patinhas, Inspetor Bugiganga, Megamen, Silvio) inspirados no design do Pierre com métricas dinâmicas calculadas em tempo real da base real do usuário.
  - Carrossel de Sugestões com Navegação por Setas `<` e `>` no Desktop e touch no mobile em `kitsune/page.tsx`, com perguntas instigantes dos agentes.
  - Experiência de Autenticação Segura & Retorno à Landing Page: redirecionamento de logout diretamente para `/`, adição de botão de retorno e logo clicável em `/login` e `/signup`.
  - Marquee Infinito de Bancos na Landing Page com animação CSS suave (`@keyframes marquee`) contendo mais de 20 instituições financeiras e vitrine de Agentes.

---

## [2026-10-29] - Motor de Renda Inteligente, Resolução de 140+ Bancos, Auto-Envio de Sugestões & Blindagem Matemática IA
- **Arquivos Afetados:** `src/utils/finance/income-detector.ts`, `src/components/BankLogo.tsx`, `src/app/kitsune/page.tsx`, `src/components/AiDiagnosticPanel.tsx`, `src/app/api/ai/generate-insight/route.ts`, `src/app/dashboard/page.tsx`, `src/app/agents/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/utils/ai/dossier.ts`, `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`.
- **Objetivo:**
  - Implementação do motor de identificação de padrão de renda (`income-detector.ts`): classificação automática entre Salário Regular CLT/Pró-labore, Renda Variável/Autônomo, Entradas Esporádicas ou Sem Renda Fixa, auditando a coerência com a renda declarada no onboarding.
  - Resolução universal multi-tier de logos bancárias (`BankLogo.tsx`): suporte aos 16 bancos locais em SVG corporativo + resolução dinâmica via CDN oficial para 140+ bancos brasileiros do Open Finance, com fallback seguro para SVG neutro sem quebra visual.
  - Auto-envio de prompts sugeridos no chat Kitsune IA quando o campo de texto estiver vazio e carrossel dinâmico rolável com 8 categorias personalizadas geradas a partir da situação patrimonial real do usuário.
  - Eliminação de alucinações e desacoplamento falso no Diagnóstico IA: amarração direta dos 3 cards de métricas (Cobertura de Liquidez, Gastos Operacionais e Margem Operacional) aos números matemáticos determinísticos calculados por código e suporte a filtro isolado por banco selecionado sem transferências internas.
  - Ordenação decrescente por relevância patrimonial (saldo em conta + investimentos) nos seletores de banco do Dashboard, na lista de instituições vinculadas (`/agents`) e nas listagens de contas.
  - Ativação do Objetivo Patrimonial com widget dinâmico de progresso no Dashboard e impacto direto nas diretrizes analíticas da IA.
  - Correção do tema "Sistema" via `ThemeProvider` (`enableSystem={true}`), saudação pelo primeiro nome ("Olá, Jacson!") e suavização global de transições CSS.

---

## [2026-10-29] - Refatoração Estrutural Open Finance, Eliminação de Mocks, Logos Oficiais em SVG & Blindagem Total
- **Arquivos Afetados:** `supabase/migrations/20261029_open_finance_full_restructure.sql`, `supabase/migrations/20261029_open_finance_identity_and_cache_rpcs.sql`, `public/banks/*.svg`, `src/components/BankLogo.tsx`, `src/utils/pluggy/*`, `src/utils/ai/dossier.ts`, `src/app/api/chat/route.ts`, `src/app/api/openfinance/route.ts`, `src/app/api/ai/anomalies/route.ts`, `src/app/api/ai/generate-insight/route.ts`, `src/app/api/export/spreadsheet/route.ts`, `src/context/FinanceDataContext.tsx`, `src/components/finance/SubscriptionsTracker.tsx`, `src/components/finance/InstallmentsTracker.tsx`, `src/app/dashboard/page.tsx`, `src/app/kitsune/page.tsx`, `src/app/agents/page.tsx`, `src/app/profile/page.tsx`, `src/app/settings/page.tsx`, `src/app/page.tsx`, `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`.
- **Objetivo:**
  - Blindagem 100% de segurança: remoção de todos os mocks em frontend e backend (`MOCK_ACCOUNTS`, `MOCK_INVESTMENTS`, `MOCK_TRANSACTIONS`), isolamento total de cache client-side com prefixo `kitsune_${user.id}_...` e limpeza em logout/troca de usuário.
  - Reestruturação completa do Supabase: remoção definitiva de `accounts`, expansão de `bank_accounts`, `pluggy_connections`, `transactions`, `investments`, criação de `loans`, `ai_chat_sessions`, `ai_chat_messages`, FORCE RLS e revogação de acessos `anon`.
  - Resolução inteligente de bancos e logos oficiais vetoriais em SVG dos repositórios de referência (`rzmt/logos-bancos-br`, `Tgentil/Bancos-em-SVG` e `henriquezolini/react-bancos`), substituindo vetores manuais por marcas oficiais corporativas (Nubank, Itaú, Santander, Inter, Caixa, Mercado Pago, Bradesco, BB, C6, BTG, Safra, PicPay, XP, Rico, Sicredi, Sicoob).
  - Backfill e sincronização de 10 conexões reais Pluggy (22 contas ativas, 37 investimentos em renda fixa/CDB, 2.438 transações enriquecidas com limpeza comercial, tradução PT-BR, identificação de transferências internas e estornos, e consolidação de identidade multi-banco com CPF mascarado).
  - Contexto por sessão na Kitsune AI com dossiê financeiro montado 1x por sessão e reaproveitado nas mensagens subsequentes, com invalidação pós-sync.

---

## [2026-10-28] - Landing Page Stitch, Untitled UI QR Code, Painel IA Executivo, Audio Visualizer & Pierre Suite
- **Arquivos Afetados:** `src/app/page.tsx`, `src/components/landing/LandingQrCode.tsx`, `src/components/AiDiagnosticPanel.tsx`, `src/app/kitsune/page.tsx`, `src/app/api/ai/generate-insight/route.ts`, `src/app/api/ai/anomalies/route.ts`, `src/components/AnomalyAlertCard.tsx`, `src/app/api/export/spreadsheet/route.ts`, `src/components/finance/SpendingHeatmap.tsx`, `src/components/finance/SubscriptionsTracker.tsx`, `src/components/finance/InstallmentsTracker.tsx`, `src/components/AppsModal.tsx`, `src/app/dashboard/page.tsx`, `src/components/layout/AppShell.tsx`, `docs/PROJECT_STATE.md`, `docs/CHANGELOG.md`.
- **Objetivo:**
  - Implementação completa da Landing Page oficial (`/`) fiel ao Stitch com iPhone 16 Pro mockup, cards de agentes (Albert, Sherlock, Megamen, Rita, Julius), FAQ interativo e QR Code oficial Untitled UI apontando para o site.
  - Refatoração do Diagnóstico IA no Dashboard em Painel Executivo com 3 metric cards dinâmicos, resumo de 2 linhas, ações imediatas e relatório expansível sem markdown bruto.
  - Upgrade do microfone no chat com live audio waveform (Web Audio API AnalyserNode) e status responsivo, eliminando o ícone vermelho cortado.
  - Implementação de toda a suíte do Pierre Finance: Mapa de Calor de gastos diários, Rastreador de Parcelamentos com barra de quitação, e Auditoria de Assinaturas com projeção anual.
  - Geração automática de planilhas (`/api/export/spreadsheet`) para Excel / Google Sheets em 1 clique.
  - Motor de anomalias preventivas em segundo plano (`/api/ai/anomalies`) com card de alerta do Agente Albert na Dashboard.

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
