# Plano Mestre de Expansão Arquitetural — Kitsune Finance (v2.0)

> **Propósito deste documento:** Servir como fonte única de verdade (Blueprint Técnico) para a evolução do Kitsune Finance, unificando o que há de mais avançado nos projetos open-source **Maybe Finance**, **Ghostfolio**, **Actual Budget** e **Firefly III** com as regras do Sistema Financeiro Nacional (BACEN / B3 / Receita Federal).

---

## Status de Execução do Roadmap (State Machine)

- [x] **Etapa 0:** Governança Autônoma Global (`GEMINI.md`, `AGENTS.md`, `ARCHITECTURE_EXPANSION.md` e limpeza de estado).
- [x] **Etapa 1:** Motor Matemático Determinístico BR & X-Ray Engine (`src/utils/finance/engine/`).
- [x] **Etapa 2:** Pipeline Open Finance v2, Reconciliação Anti-Duplicidade (`kind` + `auto_transfer_match`) e Enriquecimento Comercial 3 Camadas (`BrasilAPI` + Cache Supabase).
- [x] **Etapa 3:** Orquestração Multi-Agente com Tool Calling Determinístico (7 Agentes Kitsune + Macro-Tools do Maybe + Endpoint `/api/mcp`).
- [x] **Etapa 4:** Performance Client-Side (Read-Through Cache IndexedDB `0ms`, Lista Virtualizada 60 FPS e Diagrama de Sankey em SVG).
- [x] **Etapa 5:** Reconciliador Dinâmico no Espaço Compartilhado ("Pix de Acerto Único"), UI Interativa do Simulador de Dívidas/Antecipação e Auditoria Upstream (`pluggy-node`, `BrasilAPI` e `minha-receita`).
- [x] **Release v2.0 (Consolidação em Produção):** Higienização profunda (zero artefatos órfãos), Webhook Real-Time Pluggy com invalidação de cache IA, Monitor de Garantia FGC por Emissor Real e Simulador de Equivalência Tributária em `/investments`, README.md executivo v2.0 e build de produção validado (33/33 rotas).
- [x] **Release v2.1 (Fusão Total UI/UX Wealthfolio):** Portabilidade completa da navegação (Sidebar colapsável + Mobile Bottom Nav `safe-area`), Net Worth Area Chart (`1M`–`ALL`), tabelas densas `tabular-nums` com modo empilhado mobile, Gauges `180°`, Treemap e Histórico de Proventos em Barras Finas na paleta estrita Warm Obsidian (`#0A0A0A` / `#121214` / `#18181B` / `#27272A` / `#FF8216`).

---

## Tabela Oficial de Repositórios de Referência (Upstream Benchmarks)

> **Regra Obrigatória:** Antes de codificar qualquer recurso relacionado aos domínios abaixo, baixe temporariamente em `.benchmarks/` (via `git clone --depth 1 --filter=blob:none --sparse`) os caminhos críticos do repositório oficial correspondente para conferir a implementação real e os tipos oficiais antes de escrever o código, removendo `.benchmarks/` ao concluir.

| Domínio / Recurso | Repositório Oficial GitHub | Caminhos Críticos para Sparse Checkout em `.benchmarks/` |
| :--- | :--- | :--- |
| **Reconciliação, Transfers, Sankey & Assistant Tools** | `https://github.com/maybe-finance/maybe.git` | `app/models/transfer.rb`, `app/models/account/transfer_matchable.rb`, `app/models/balance/reverse_calculator.rb`, `app/javascript/controllers/sankey_chart_controller.js`, `app/models/assistant/function/` |
| **X-Ray Rules, TWR/MWR & Servidor MCP** | `https://github.com/ghostfolio/ghostfolio.git` | `apps/api/src/models/rules/`, `apps/api/src/app/endpoints/mcp/`, `apps/api/src/app/portfolio/calculator/` |
| **Matching de Transações, Regras & Local-First** | `https://github.com/actualbudget/actual.git` | `packages/loot-core/src/server/accounts/sync.ts`, `packages/loot-core/src/server/accounts/transaction-rules.ts` |
| **Open Finance Brasil, Metadata de Cartões, Pix & Investimentos** | `https://github.com/pluggyai/pluggy-node.git` | `src/types/transaction.ts`, `src/types/investment.ts`, `src/types/loan.ts`, `src/client.ts` |
| **Taxas BCB ao Vivo (Selic/CDI/IPCA), Feriados, ISPB & CNPJ** | `https://github.com/BrasilAPI/BrasilAPI.git` | `pages/api/taxas/v1/`, `pages/api/cnpj/v1/`, `pages/api/banks/v1/`, `pages/api/feriados/v1/`, `services/` |
| **Failover de CNPJ / CNAE Receita Federal em Alta Velocidade** | `https://github.com/cuducos/minha-receita.git` | `README.md`, estrutura de resposta JSON (`cnae_fiscal`, `cnaes_secundarios`, `nome_fantasia`, `razao_social`) |
| **Auditoria de Reconciliação Contábil** | `https://github.com/firefly-iii/firefly-iii.git` | `app/Services/Internal/Support/TransactionTypeFilter.php`, `app/Transformers/AccountTransformer.php` |

---

## Especificações Técnicas por Etapa

### Etapa 1: Motor Matemático Determinístico & X-Ray Engine (`src/utils/finance/engine/`)
Todos os algoritmos devem ser puros, zero-dependency, 100% determinísticos em TypeScript:
1. **`cdi.ts` (Motor B3CALC / CETIP DU/252):**
   - Convenção de 252 dias úteis e calendário oficial ANBIMA de feriados nacionais móveis (Carnaval, Paixão de Cristo, Corpus Christi via algoritmo de Meeus/Jones/Butcher) e fixos.
   - Fator diário: $F_{diário} = \left(1 + \frac{Taxa_{DI}}{100}\right)^{\frac{1}{252}} - 1$ truncado exatamente na 8ª casa decimal usando manipulação segura de string/BigInt (evitando estouro IEEE 754 de `Math.pow(10, 16)`).
   - Produtório acumulado truncado na 16ª casa decimal e saldo bruto truncado em 2 casas decimais.
2. **`taxes.ts` (Tributação Regressiva IR + IOF + Equivalência LCI/LCA):**
   - Tabela regressiva de IOF (1 a 29 dias corridos, de 96% a 3%, zero no 30º dia) aplicada ANTES do IR.
   - Tabela regressiva de IR Renda Fixa (Até 180 dias: 22,5%; 181-360: 20%; 361-720: 17,5%; >720: 15%) sobre `(rendimentoBruto - iof)`.
   - Função `calculateTaxEquivalentRate()`: compara instantaneamente taxas isentas (LCI/LCA/CRI/CRA) com taxas tributadas (CDB/Tesouro) para o prazo exato em dias corridos.
3. **`fisher.ts` & `cet.ts` (Juro Real Exato & Custo Efetivo Total):**
   - Equação de Fisher exata: $i_{real} = \frac{1 + i_{nominal}}{1 + \pi_{inflacao}} - 1$. Proibido subtrair inflação diretamente da taxa nominal.
   - Cálculo de CET anual/mensal e desconto de antecipação de parcelas de cartão (ex: Nubank) via método numérico de **Newton-Raphson** com convergência de $10^{-7}$.
4. **`debt-payoff.ts` (Amortização Bola de Neve vs. Avalanche com Rollover Real):**
   - Simulação mês a mês onde `totalMonthlyCommitment = sum(minimumPayments) + extraMonthlyBudget`.
   - Quando uma dívida é liquidada no mês $M$, toda a parcela mínima que ia para ela é automaticamente somada ao poder de amortização extra no mês $M+1$ (*Snowball Rollover*), gerando o comparativo exato de juros economizados e meses poupados entre Avalanche (maior CET primeiro) e Bola de Neve (menor saldo primeiro).
5. **`xray-rules.ts` (Motor de Diagnóstico X-Ray inspirado no Ghostfolio):**
   - Avaliação modular determinística do portfólio e fluxo de caixa gerando o **Kitsune Health Score (0 a 100)**:
     - `fgc-concentration-risk`: alerta se o saldo (principal + juros) em um mesmo conglomerado/CNPJ ultrapassar o teto de **R$ 250.000,00** do FGC (ou R$ 1 milhão global em 4 anos).
     - `emergency-fund-coverage`: cobertura da reserva de liquidez diária em meses de custo operacional.
     - `credit-utilization-risk`: utilização do limite de crédito e comprometimento da renda mensal com parcelas.
     - `real-yield-efficiency`: identifica posições rendendo abaixo de 100% do CDI líquido ou perdendo para o IPCA (Fisher negativo).

### Etapa 2: Ingestão Open Finance v2, Reconciliação (`Maybe`) e Enriquecimento (`BrasilAPI`)
1. **Reconciliação de Transações Pendentes -> Postadas:** Match por janela temporal ($\pm 4$ dias), valor absoluto idêntico e `account_id` quando o Pluggy mudar `status: PENDING` para `POSTED` com novo UUID.
2. **Classificação `kind` e Auto-Transfer Match (Inspirado no Maybe Finance):**
   - Classificação determinística em `'standard' | 'funds_movement' | 'cc_payment' | 'loan_payment' | 'one_time'`.
   - Pareamento automático de saídas em conta corrente com entradas em outra conta ou pagamentos de fatura de cartão na janela de 72h, blindando o cálculo de receitas/despesas.
3. **Enriquecimento em 3 Camadas a Custo Zero:**
   - Camada 1: `merchant-resolver.ts` local (Regex de adquirentes + Simple Icons).
   - Camada 2: Lookup gratuito de CNPJ em `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` com mapeamento de `cnae_fiscal` para categoria do Kitsune e cache persistente na tabela `known_merchants` do Supabase.
   - Camada 3: Fallback em batch para o pool Gemini/Groq apenas para descrições inéditas sem CNPJ.

### Etapa 3: Orquestração Multi-Agente (Tool Calling) & Servidor MCP
1. **4 Macro-Tools de Estado (Inspiradas no Maybe) + Math Engine Tools:**
   - `get_accounts_summary`, `get_balance_sheet`, `get_income_statement`, `get_transactions_dossier`, `simulate_debt_payoff`, `compare_fixed_income`, `run_portfolio_xray`.
2. **Roteamento para os 7 Agentes Oficiais da Kitsune:**
   - **Sentinela Kitsune** (Orquestrador/Roteador), **Kuro** (Auditor Forense/Assinaturas/Anomalias), **Kenji** (Estrategista de Quitação/Cartões), **Daiko** (Gestor de Portfólio/Macro/FGC), **Kage** (Caçador de Vazamentos/Impulso), **Ren** (Planejador de Metas/Fisher), **Takeshi** (Conciliador Familiar/Espaço Compartilhado).
3. **Endpoint `/api/mcp`:** Exposição segura das tools determinísticas via protocolo MCP (inspirado na arquitetura do Ghostfolio e Pierre Finance).

### Etapa 4: Performance Mobile/Desktop & Visualização Sankey
1. **Read-Through Cache Local (`IndexedDB`):** Carregamento instantâneo (`0ms`) ao abrir o app com revalidação silenciosa em background pós-sync do Supabase.
2. **Virtualização de Extrato:** Renderização a 60 FPS para listas de 3.000+ transações no mobile/desktop.
3. **Diagrama de Sankey de Fluxo de Caixa (`CashFlowSankey.tsx`):** Fluxo visual `[Fontes de Renda] -> [Renda Total] -> [Categorias de Despesa + Aportes + Liquidez Retida]` em SVG responsivo com suporte total ao `isPrivacyMode`.

### Etapa 5: Reconciliador Familiar ("Pix de Acerto Único"), Simulador UI & Upgrades Upstream
1. **Cálculo de Liquidação Mínima no `/shared` (`src/utils/finance/shared-settlement.ts`):** Algoritmo determinístico em centavos inteiros (Método dos Maiores Restos de Hamilton + *Greedy Minimum Cash Flow*) que cruza gastos operacionais compartilhados do mês ponderados pela renda líquida de cada membro (`proportional` ou `equal`) e gera o card **"Acerto Inteligente do Mês (Pix Único)"** com cópia rápida para WhatsApp e deep-link para o agente **Takeshi**.
2. **Simulador Interativo de Quitação e Antecipação em `/cards` (`src/components/finance/DebtAndAdvanceSimulator.tsx`):** Interface visual em tempo real ligada ao `debt-payoff.ts` (Avalanche vs. Bola de Neve com *Snowball Rollover*), `cet.ts` e `taxes.ts` (Antecipação de Parcelas vs. Deixar no CDI líquido de IR regressivo).
3. **Upgrades Upstream (`pluggy-node`, `BrasilAPI` e `minha-receita`):** Extração estruturada de `merchant.cnpj`, `paymentData` (auto-detecção de transferência própria por CPF/CNPJ idêntico) e `creditCardMetadata.payeeMCC` (ISO 18245), segregação de `issuer` (emissor FGC R\$ 250k) vs. corretora custodiante, failover duplo `BrasilAPI` $\leftrightarrow$ `MinhaReceita` com inspeção de `cnaes_secundarios`, e alimentação de taxas oficiais do BCB ao vivo (`Selic`, `CDI`, `IPCA`) com cache híbrido de 12h (`src/utils/finance/macro-rates.ts`).

---

## Repositórios & Projetos de Referência Arquitetural

| Projeto / SDK | Repositório Oficial / Link | Categoria & Padrões Absorvidos no Kitsune Finance |
| :--- | :--- | :--- |
| **Actual Budget** | [github.com/actualbudget/actual](https://github.com/actualbudget/actual) | Metodologia Zero-Based Budgeting, arquitetura Local-First sincronizada, regras condicionais determinísticas no cliente e pareamento de transações pendentes $\to$ postadas sem duplicação de UUID. |
| **Ghostfolio** | [github.com/ghostfolio/ghostfolio](https://github.com/ghostfolio/ghostfolio) | Motor de auditoria patrimonial X-Ray, pontuação de saúde modular (0-100), separação estrita entre capital gains e proventos periódicos, Zen Mode (privacidade) e arquitetura MCP. |
| **Maybe Finance** | [github.com/maybe-finance/maybe](https://github.com/maybe-finance/maybe) | Diagramas de Sankey em fluxo contínuo, classificação determinística de movimentações (`kind`), macro-tools contábeis (`get_balance_sheet`, `get_income_statement`) e agregação analítica no PostgreSQL. |
| **Firefly III** | [github.com/firefly-iii/firefly-iii](https://github.com/firefly-iii/firefly-iii) | Contabilidade estrita por partidas dobradas (double-entry bookkeeping), isolamento atômico de transferências internas e pagamentos de fatura para prevenir inflação artificial de receitas/despesas. |
| **Pluggy Node SDK** | [github.com/pluggyai/pluggy-node](https://github.com/pluggyai/pluggy-node) | SDK oficial do agregador Open Finance Brasil com consumo estrito de paginação por cursor (`/v2/transactions?after=...`) e processamento assíncrono de webhooks bancários. |
| **icesnow10 / personal-finance** | [github.com/icesnow10/personal-finance](https://github.com/icesnow10/personal-finance) | Solução de referência para ciclo de vida de faturas de cartão de crédito no Open Finance, tratamento de transição de cobranças pendentes para definitivas e eliminação de duplicidades em fechamento de fatura. |
| **BrasilAPI SDK** | [github.com/guhcostan/brasilapi-sdk](https://github.com/guhcostan/brasilapi-sdk) | SDK em TypeScript para consulta gratuita de dados públicos governamentais (CNPJ, feriados bancários e tabelas FIPE). |
| **MinhaReceita API** | [github.com/lenivene/minha-receita-api](https://github.com/lenivene/minha-receita-api) | Microsserviço aberto de enriquecimento de CNPJ e CNAE primário para decodificação de credenciadoras (Cielo, Stone, PagSeguro) em categorias comerciais amigáveis. |
| **Pierre Finance** | [pierre.finance](https://pierre.finance) | Referência visual para interface mobile-first de alto padrão, dock bar flutuante inferior em pill arredondado, carrossel de cartões com mouse-drag e micro-interações fluidas. |
| **Wealthfolio** | [github.com/wealthfolio/wealthfolio](https://github.com/wealthfolio/wealthfolio) | Arquitetura oficial de UI/UX adotada na v2.1: Sidebar colapsável + Mobile Bottom Nav com `safe-area`, Net Worth Hero Chart, linhas densas agrupadas de contas/passivos, tabelas `tabular-nums` responsivas, Gauges `180°`, Treemap e barras finas de proventos. |


