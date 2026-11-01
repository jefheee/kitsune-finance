# Plano Mestre de Expansão Arquitetural — Kitsune Finance (v2.0)

> **Propósito deste documento:** Servir como fonte única de verdade (Blueprint Técnico) para a evolução do Kitsune Finance, unificando o que há de mais avançado nos projetos open-source **Maybe Finance**, **Ghostfolio**, **Actual Budget** e **Firefly III** com as regras do Sistema Financeiro Nacional (BACEN / B3 / Receita Federal).

---

## Status de Execução do Roadmap (State Machine)

- [x] **Etapa 0:** Governança Autônoma Global (`GEMINI.md`, `AGENTS.md`, `ARCHITECTURE_EXPANSION.md` e limpeza de estado).
- [x] **Etapa 1:** Motor Matemático Determinístico BR & X-Ray Engine (`src/utils/finance/engine/`).
- [ ] **Etapa 2:** Pipeline Open Finance v2, Reconciliação Anti-Duplicidade (`kind` + `auto_transfer_match`) e Enriquecimento Comercial 3 Camadas (`BrasilAPI` + Cache Supabase).
- [ ] **Etapa 3:** Orquestração Multi-Agente com Tool Calling Determinístico (7 Agentes Kitsune + Macro-Tools do Maybe + Endpoint `/api/mcp`).
- [ ] **Etapa 4:** Performance Client-Side (Read-Through Cache IndexedDB `0ms`, Lista Virtualizada 60 FPS e Diagrama de Sankey em SVG).
- [ ] **Etapa 5:** Reconciliador Dinâmico no Espaço Compartilhado ("Pix de Acerto Único") e UI Interativa do Simulador de Dívidas/Antecipação.

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

### Etapa 5: Reconciliador Familiar ("Pix de Acerto Único") & Simulador UI
1. **Cálculo de Liquidação Mínima no `/shared`:** Algoritmo que cruza os gastos compartilhados do mês ponderados pelo peso da renda líquida de cada membro e gera o card de **Liquidação em 1 Pix** (quem transfere exatamente quanto para quem para zerar o mês).
2. **Modal Interativo de Quitação e Antecipação em `/cards`:** Interface visual ligada ao `debt-payoff.ts` e `cet.ts`.

