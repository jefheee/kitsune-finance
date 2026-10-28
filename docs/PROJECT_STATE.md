# Estado do Projeto - Kitsune Finance

**Última atualização:** 28/10/2026
**Status Geral:** Operacional / Warm Obsidian Human-Centric UI & Landing Page Ativas

---

## 1. Stack Tecnológica
- **Framework:** Next.js (App Router, React 19, Turbopack)
- **Estilização:** Tailwind CSS v4, Warm Obsidian Tokens (`theme.css` / `globals.css`), Untitled UI components (`@untitledui/icons`, `qr-code`), Fontes Plus Jakarta Sans & JetBrains Mono, Framer Motion
- **Banco de Dados & Autenticação:** Supabase (Auth com Google Provider, RLS, PostgreSQL, Multi-tenant por `user_id`)
- **Open Finance / Integrações:** Pluggy SDK (`pluggy-sdk`, `react-pluggy-connect`)
- **Inteligência Artificial:** Pool com failover automático Google Gemini API (`gemini-4-argon`, `gemini-3.8-flash`, `gemini-3.5-flash-lite`) e Groq (`llama-3.3-70b-versatile`, `whisper-large-v3`)
- **Roteamento Inteligente:** Modo Automático por complexidade e tamanho do prompt (Cascade Routing)

---

## 2. Arquitetura e Decisões Críticas
- **Landing Page Oficial (`/`):** Acesso deslogado exibindo Landing Page de alta conversão fiel ao Stitch com iPhone 16 Pro mockup, 3 faixas métricas, seções de arquitetura de IA, vitrine dos 5 Agentes Autônomos (Albert, Sherlock, Megamen, Rita, Julius), FAQ e QR Code dinâmico do Untitled UI.
- **Painel Executivo da Kitsune IA (`AiDiagnosticPanel.tsx`):** Diagnóstico gerado via payload JSON estrito sem markdown bruto solto, contendo resumo executivo, 3 cards de métricas dinâmicas (Cobertura de Liquidez, Categoria Dominante, Margem Operacional), ações imediatas e gaveta expansível para o parecer detalhado.
- **Entrada de Voz Responsiva (`kitsune/page.tsx`):** Web Audio API (`AudioContext` e `AnalyserNode`) animando um equalizador de 5 barras dinâmicas em tempo real com status ativo e transcrição universal via Whisper.
- **Suíte Completa Pierre Finance (`public/pierre design system`):**
  - **Mapa de Calor de Gastos (`SpendingHeatmap.tsx`):** Matriz 7x5 dos dias do mês com gradiente de intensidade, média diária e destaque do maior dia de gasto.
  - **Rastreador de Parcelamentos (`InstallmentsTracker.tsx`):** Cálculo determinístico de compras parceladas, valor pago, restante e progresso percentual.
  - **Auditoria de Assinaturas (`SubscriptionsTracker.tsx`):** Detecção automática de recorrências com gasto mensal, projeção anual e contagem ativa.
  - **Apps & Conexões (`AppsModal.tsx`):** Conexões com Google Sheets, Notion, Google Drive, Google Calendar e exportação imediata.
- **Geração de Planilhas Automatizada (`/api/export/spreadsheet`):** Download em 1 clique de arquivo CSV/Excel formatado em UTF-8 com BOM e compatível com Google Sheets.
- **Detecção Preventiva de Anomalias em Segundo Plano (`/api/ai/anomalies`):** Scanner determinístico e por IA que alerta sobre cobranças duplicadas em até 48h e picos anômalos de gastos.
- **Multi-Tenant RLS:** Todas as tabelas isoladas por `auth.uid() = user_id`.
- **Protocolo Docs as Code:** Toda alteração é documentada em `docs/PROJECT_STATE.md` e registrada em `docs/CHANGELOG.md`.

---

## 3. Módulos Implementados
- [x] Landing Page Oficial fiel ao Stitch com iPhone 16 Pro mockup e QR Code do Untitled UI (`/`)
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
