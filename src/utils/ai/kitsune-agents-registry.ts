/**
 * Kitsune Finance — Roteador & Registro Oficial dos 7 Agentes Especialistas (v2.0)
 *
 * Conecta cada um dos 7 Agentes Oficiais da Kitsune às suas Macro-Tools determinísticas
 * em `src/utils/ai/deterministic-tools.ts`, garantindo Zero Alucinação Matemática (MSLR)
 * tanto no Chat (`/api/chat`) quanto nos Cards em Tempo Real (`/agents`).
 */

import {
    ANTI_HALLUCINATION_SYSTEM_DIRECTIVE,
    toolGetBalanceSheetAndXRay,
    toolGetIncomeStatement,
    toolSimulateDebtAndCards,
    toolAnalyzeFixedIncomeAndGoals,
    toolAuditAnomaliesAndLeaks,
    calculateSharedProportionalSummary,
    type AuditedDeterministicBundle,
    type UserFinancialDataInput,
    type FixedIncomeSimulationParams,
} from './deterministic-tools';

export type KitsuneAgentId =
    | 'sentinela'
    | 'kuro'
    | 'kenji'
    | 'daiko'
    | 'kage'
    | 'ren'
    | 'takeshi';

export type MacroToolIdentifier =
    | 'get_balance_sheet_xray'
    | 'get_income_statement'
    | 'simulate_debt_payoff'
    | 'compare_fixed_income_br'
    | 'audit_anomalies_and_subscriptions'
    | 'shared_space_reconciler';

export interface AgentLiveCardDiagnostic {
    headline: string;
    metricLabel: string;
    metricValue: string;
    secondaryLabel: string;
    secondaryValue: string;
    advice: string;
    alertLevel: 'success' | 'warning' | 'danger' | 'info';
}

export interface KitsuneSpecialistAgent {
    id: KitsuneAgentId;
    name: string;
    role: string;
    personality: string;
    tagline: string;
    /** Classes de gradiente respeitando estritamente o Design System Warm Obsidian (zero azul/marinho) */
    avatarBg: string;
    avatarEmoji: string;
    accentColor: string;
    consumedTools: MacroToolIdentifier[];
    suggestedPrompt: string;
    systemPersonaDirective: string;
    executeDeterministicPayload: (
        userData: UserFinancialDataInput,
        params?: {
            periodMonths?: number;
            extraMonthlyBudget?: number;
            fixedIncomeParams?: FixedIncomeSimulationParams;
        }
    ) => Record<string, unknown>;
    buildLiveDiagnostic: (
        bundle: AuditedDeterministicBundle,
        formatCurrency: (val: number) => string,
        isPrivacyMode: boolean
    ) => AgentLiveCardDiagnostic;
}

export const KITSUNE_AGENTS_REGISTRY: readonly KitsuneSpecialistAgent[] = [
    // 1. SENTINELA KITSUNE — Orquestrador Geral & Diagnóstico 360°
    {
        id: 'sentinela',
        name: 'Sentinela Kitsune',
        role: 'Orquestrador Geral & Diagnóstico 360°',
        personality: 'Estratégico, sereno, holístico e guardião da saúde patrimonial integral.',
        tagline: 'Cruza balanço patrimonial, liquidez, reserva de emergência e fluxo operacional em visão 360°.',
        avatarBg: 'from-[#E11D48]/30 to-amber-600/15',
        avatarEmoji: '🦊',
        accentColor: '#E11D48',
        consumedTools: ['get_balance_sheet_xray', 'get_income_statement'],
        suggestedPrompt:
            'Sentinela Kitsune, execute meu Diagnóstico 360° completo com Kitsune Score, cobertura de reserva de emergência e margem operacional do mês.',
        systemPersonaDirective:
            'Você está operando sob o comando de **Sentinela Kitsune (Orquestrador Geral & Diagnóstico 360°)**. Apresente o Kitsune Score (0..100), o Patrimônio Líquido exato, os meses de reserva de emergência e o balanço operacional entre entradas e saídas reais.',
        executeDeterministicPayload: (userData, params) => ({
            agent: 'Sentinela Kitsune',
            balanceSheetAndXRay: toolGetBalanceSheetAndXRay(userData),
            incomeStatement: toolGetIncomeStatement(userData, params?.periodMonths ?? 1),
        }),
        buildLiveDiagnostic: (bundle, fmt, isPrivacyMode) => {
            const xray = bundle.balanceSheetAndXRay;
            const stmt = bundle.incomeStatement;
            const score = xray.kitsuneScore;
            const scoreDisplay = isPrivacyMode ? '••/100' : `${score}/100`;

            const alertLevel: AgentLiveCardDiagnostic['alertLevel'] =
                score >= 85 ? 'success' : score >= 70 ? 'info' : score >= 50 ? 'warning' : 'danger';

            return {
                headline: `Saúde Patrimonial: ${xray.statusLabel}`,
                metricLabel: 'Kitsune Health Score',
                metricValue: scoreDisplay,
                secondaryLabel: 'Reserva de Liquidez',
                secondaryValue: isPrivacyMode ? '•• meses' : `${xray.emergencyFundMonths} meses`,
                advice: `Patrimônio líquido auditado em ${fmt(xray.balanceSheet.netWorth)}, com margem de poupança operacional de ${isPrivacyMode ? '••%' : `${stmt.netSavingsMarginPct.toFixed(1)}%`} no período.`,
                alertLevel,
            };
        },
    },

    // 2. KURO — Auditor Forense de Anomalias, Tarifas e Assinaturas
    {
        id: 'kuro',
        name: 'Kuro',
        role: 'Auditor Forense de Anomalias, Tarifas e Assinaturas',
        personality: 'Implacável, cirúrgico, cético com cobranças recorrentes e tarifas bancárias ocultas.',
        tagline: 'Rastreia assinaturas esquecidas, cobranças passadas em duplicidade e anuidades evitáveis.',
        avatarBg: 'from-amber-600/25 to-stone-700/30',
        avatarEmoji: '😾',
        accentColor: '#D97706',
        consumedTools: ['audit_anomalies_and_subscriptions'],
        suggestedPrompt:
            'Kuro, faça uma auditoria forense nas minhas assinaturas recorrentes, tarifas bancárias/anuidades e verifique se há cobranças duplicadas este mês.',
        systemPersonaDirective:
            'Você está operando como **Kuro (Auditor Forense de Anomalias, Tarifas e Assinaturas)**. Seja incisivo, direto e liste exatamente cada assinatura recorrente (com seu impacto anual em 12 meses), eventuais cobranças duplicadas no mês e tarifas/anuidades bancárias detectadas.',
        executeDeterministicPayload: (userData) => ({
            agent: 'Kuro',
            anomaliesAndLeaks: toolAuditAnomaliesAndLeaks(userData),
        }),
        buildLiveDiagnostic: (bundle, fmt) => {
            const audit = bundle.anomaliesAndLeaks;
            const dups = audit.duplicateCharges.count;
            const feesCount = audit.avoidableFees.count;
            const subsAnnual = audit.subscriptions.annualizedTotalBRL;

            if (dups > 0 || feesCount > 0) {
                const leakSum =
                    audit.duplicateCharges.potentialRefundTotalBRL + audit.avoidableFees.totalFeesDetectedBRL;
                return {
                    headline:
                        dups > 0
                            ? `${dups} Duplicidade(s) Sob Suspeita`
                            : `${feesCount} Tarifa(s)/Encargo(s) Detectados`,
                    metricLabel: 'Impacto Auditado',
                    metricValue: fmt(leakSum),
                    secondaryLabel: `Assinaturas (${audit.subscriptions.activeCount})`,
                    secondaryValue: `${fmt(audit.subscriptions.monthlyTotalBRL)}/mês`,
                    advice: `Identifiquei ${dups} cobrança(s) repetida(s) e ${feesCount} tarifa(s) evitável(is), além de ${fmt(subsAnnual)}/ano comprometidos em assinaturas.`,
                    alertLevel: dups > 0 ? 'danger' : 'warning',
                };
            }

            return {
                headline: `${audit.subscriptions.activeCount} Assinaturas Monitoradas`,
                metricLabel: 'Custo Anual Recorrente',
                metricValue: `${fmt(subsAnnual)}/ano`,
                secondaryLabel: 'Duplicidades / Tarifas',
                secondaryValue: '0 anomalias',
                advice:
                    audit.subscriptions.activeCount > 0
                        ? `Nenhuma cobrança duplicada ou tarifa oculta, mas suas ${audit.subscriptions.activeCount} assinaturas consomem ${fmt(audit.subscriptions.monthlyTotalBRL)} todo mês.`
                        : 'Extrato blindado: zero cobranças duplicadas, zero anuidades ocultas e nenhuma assinatura fantasma.',
                alertLevel: audit.subscriptions.monthlyTotalBRL > 350 ? 'warning' : 'success',
            };
        },
    },

    // 3. KENJI — Estrategista de Cartões, CET e Quitação Avalanche/Snowball
    {
        id: 'kenji',
        name: 'Kenji',
        role: 'Estrategista de Cartões, CET e Quitação Avalanche/Snowball',
        personality: 'Matemático, tático, mestre em Newton-Raphson para CET, amortização e antecipação de parcelas.',
        tagline: 'Simula Avalanche vs. Bola de Neve com rollover real e calcula se vale antecipar parcelas frente ao CDI.',
        avatarBg: 'from-zinc-700/45 to-neutral-800/40',
        avatarEmoji: '🐱‍👓',
        accentColor: '#E11D48',
        consumedTools: ['simulate_debt_payoff'],
        suggestedPrompt:
            'Kenji, analise minhas faturas de cartão, parcelamentos ativos e empréstimos: compare Avalanche vs Bola de Neve e diga matematicamente se vale antecipar parcelas ou deixar no CDI.',
        systemPersonaDirective:
            'Você está operando como **Kenji (Estrategista de Cartões, CET e Quitação Avalanche/Snowball)**. Use estritamente os números de CET (Newton-Raphson), comparativo Avalanche vs Bola de Neve e avaliação matemática de antecipação de parcelas vs CDI líquido de IR.',
        executeDeterministicPayload: (userData, params) => ({
            agent: 'Kenji',
            debtAndCards: toolSimulateDebtAndCards(userData, params?.extraMonthlyBudget ?? 0),
        }),
        buildLiveDiagnostic: (bundle, fmt) => {
            const debt = bundle.debtAndCards;
            const payoff = debt.payoffComparison;
            const adv = debt.installmentAdvances;

            if (debt.liquidCoverageStatus === 'PARTIAL_COVERAGE_REVOLVING_RISK') {
                const saved = payoff?.interestSavedByAvalanche ?? 0;
                return {
                    headline: 'Risco de Rotativo Detectado',
                    metricLabel: 'Faturas vs Liquidez',
                    metricValue: fmt(debt.totalCreditCardBills),
                    secondaryLabel: 'Economia via Avalanche',
                    secondaryValue: fmt(saved),
                    advice: `Suas faturas (${fmt(debt.totalCreditCardBills)}) superam o caixa imediato (${fmt(debt.liquidCashAvailable)}). Priorize o plano Avalanche para estancar juros compostos.`,
                    alertLevel: 'danger',
                };
            }

            if (debt.totalLoansBalance > 0 && payoff) {
                return {
                    headline: 'Plano de Quitação Calculado',
                    metricLabel: 'Saldo de Empréstimos',
                    metricValue: fmt(debt.totalLoansBalance),
                    secondaryLabel: 'Economia Avalanche',
                    secondaryValue: fmt(payoff.interestSavedByAvalanche),
                    advice: `Quitação estimada em ${payoff.avalanche.totalMonths} meses via Avalanche, economizando ${fmt(payoff.interestSavedByAvalanche)} em juros frente à Bola de Neve.`,
                    alertLevel: 'warning',
                };
            }

            if (adv.activePlansCount > 0 && adv.consolidatedVerdict) {
                const v = adv.consolidatedVerdict;
                return {
                    headline: v.isWorthAdvancing
                        ? 'Vantagem em Antecipar Parcelas'
                        : 'Faturas Cobertas • Manter no CDI',
                    metricLabel: `${adv.activePlansCount} Parcelamento(s) Ativo(s)`,
                    metricValue: fmt(adv.totalRemainingInstallmentsNominal),
                    secondaryLabel: v.isWorthAdvancing ? 'Ganho Líquido' : 'Vantagem CDI Líquido',
                    secondaryValue: `+${fmt(v.netFinancialAdvantage)}`,
                    advice: `Faturas atuais (${fmt(debt.totalCreditCardBills)}) 100% cobertas pela liquidez. ${v.isWorthAdvancing ? `Antecipar parcelas gera vantagem real de ${fmt(v.netFinancialAdvantage)}.` : `Deixar o recurso rendendo no CDI supera o desconto padrão em ${fmt(v.netFinancialAdvantage)}.`}`,
                    alertLevel: 'success',
                };
            }

            return {
                headline: 'Faturas 100% Cobertas pelo Caixa',
                metricLabel: 'Exposição em Cartões',
                metricValue: fmt(debt.totalCreditCardBills),
                secondaryLabel: 'Cobertura Líquida',
                secondaryValue: fmt(debt.liquidCashAvailable),
                advice: 'Zero exposição a juros rotativos ou empréstimos caros. Seus cartões operam como meio de pagamento puro.',
                alertLevel: 'success',
            };
        },
    },

    // 4. DAIKO — Gestor de Portfólio, CDI/B3, Equivalência LCI/CDB e Risco FGC
    {
        id: 'daiko',
        name: 'Daiko',
        role: 'Gestor de Portfólio, CDI/B3, Equivalência LCI/CDB e Risco FGC',
        personality: 'Institucional, focado em convenção DU/252 da B3, eficiência tributária regressiva e proteção FGC.',
        tagline: 'Audita posições pós-fixadas em DU/252, compara LCI/LCA isentas vs CDB e monitora o teto de R$ 250k do FGC.',
        avatarBg: 'from-emerald-600/25 to-neutral-800/40',
        avatarEmoji: '🎩',
        accentColor: '#10B981',
        consumedTools: ['compare_fixed_income_br', 'get_balance_sheet_xray'],
        suggestedPrompt:
            'Daiko, audite minha carteira de investimentos pela regra DU/252 da B3, verifique minha exposição ao teto de R$ 250k do FGC por banco e compare LCI/LCA vs CDB.',
        systemPersonaDirective:
            'Você está operando como **Daiko (Gestor de Portfólio, CDI/B3, Equivalência LCI/CDB e Risco FGC)**. Apresente o rendimento líquido projetado após IR/IOF regressivo, custo de oportunidade de caixa parado, equivalência tributária LCI/LCA vs CDB e exposição por conglomerado ao limite de R$ 250.000 do FGC.',
        executeDeterministicPayload: (userData, params) => ({
            agent: 'Daiko',
            fixedIncomeAndGoals: toolAnalyzeFixedIncomeAndGoals(userData, params?.fixedIncomeParams),
            balanceSheetAndXRay: toolGetBalanceSheetAndXRay(userData),
        }),
        buildLiveDiagnostic: (bundle, fmt, isPrivacyMode) => {
            const xray = bundle.balanceSheetAndXRay;
            const fi = bundle.fixedIncomeAndGoals;

            if (xray.totalUncoveredFGC > 0) {
                return {
                    headline: 'Alerta de Exposição Acima do FGC',
                    metricLabel: 'Capital Descoberto (> R$ 250k)',
                    metricValue: fmt(xray.totalUncoveredFGC),
                    secondaryLabel: 'Rendimento Líquido 12m',
                    secondaryValue: `+${fmt(fi.portfolioSummary.projected12mNetYieldBRL)}`,
                    advice: `Você possui ${fmt(xray.totalUncoveredFGC)} acima da garantia regulamentar (${fmt(250000)}) do FGC. Diversifique novos aportes entre emissores ou Tesouro Selic.`,
                    alertLevel: 'danger',
                };
            }

            if (xray.annualOpportunityCostBRL > 300) {
                return {
                    headline: 'Custo de Oportunidade no Caixa',
                    metricLabel: 'Ganho Adicional Potencial',
                    metricValue: `+${fmt(xray.annualOpportunityCostBRL)}/ano`,
                    secondaryLabel: 'Rendimento Líquido Carteira',
                    secondaryValue: `+${fmt(fi.portfolioSummary.projected12mNetYieldBRL)}/ano`,
                    advice: `Há ${fmt(xray.idleCheckingAmount)} ociosos em conta corrente. Alocar em CDB/LCI eficiente destrava +${fmt(xray.annualOpportunityCostBRL)} anuais com cobertura total do FGC.`,
                    alertLevel: 'warning',
                };
            }

            return {
                headline: 'Portfólio Calibrado & Coberto FGC',
                metricLabel: 'Projeção Líquida (12m pós-IR)',
                metricValue: `+${fmt(fi.portfolioSummary.projected12mNetYieldBRL)}`,
                secondaryLabel: 'Juro Real Líquido (Fisher)',
                secondaryValue: isPrivacyMode
                    ? '••% a.a.'
                    : `+${fi.portfolioSummary.weightedRealAnnualFisherPct.toFixed(2)}% a.a.`,
                advice: `100% das posições elegíveis estão protegidas dentro do teto regulamentar (${fmt(250000)}) do FGC, rendendo ${fmt(fi.portfolioSummary.projected12mNetYieldBRL)} líquidos em 252 DU.`,
                alertLevel: 'success',
            };
        },
    },

    // 5. KAGE — Caçador de Vazamentos de Caixa e Compras por Impulso
    {
        id: 'kage',
        name: 'Kage',
        role: 'Caçador de Vazamentos de Caixa e Compras por Impulso',
        personality: 'Furtivo, observador de padrões comportamentais e detector estatístico de desvios-padrão.',
        tagline: 'Isola gastos por impulso fora da curva histórica (2σ) e drena vazamentos silenciosos do fluxo mensal.',
        avatarBg: 'from-orange-500/25 to-zinc-800/40',
        avatarEmoji: '🕵️‍♂️',
        accentColor: '#F97316',
        consumedTools: ['get_income_statement', 'audit_anomalies_and_subscriptions'],
        suggestedPrompt:
            'Kage, rastreie meus vazamentos de caixa deste mês, gastos supérfluos e compras por impulso que fugiram do meu desvio padrão histórico.',
        systemPersonaDirective:
            'Você está operando como **Kage (Caçador de Vazamentos de Caixa e Compras por Impulso)**. Cruze o ranking das 8 maiores categorias/estabelecimentos operacionais com os outliers estatísticos (> 2 desvios-padrão) e gastos discricionários para revelar onde o dinheiro está escapando.',
        executeDeterministicPayload: (userData, params) => ({
            agent: 'Kage',
            incomeStatement: toolGetIncomeStatement(userData, params?.periodMonths ?? 1),
            anomaliesAndLeaks: toolAuditAnomaliesAndLeaks(userData),
        }),
        buildLiveDiagnostic: (bundle, fmt) => {
            const leaks = bundle.anomaliesAndLeaks;
            const stmt = bundle.incomeStatement;
            const outliersCount = leaks.impulseAndDiscretionary.outlierCount;
            const discSpend = leaks.impulseAndDiscretionary.currentMonthDiscretionaryBRL;
            const topCat = stmt.topCategories[0];

            if (outliersCount > 0) {
                return {
                    headline: `${outliersCount} Gasto(s) Fora do Padrão (2σ)`,
                    metricLabel: 'Picos Atípicos Recentes',
                    metricValue: fmt(leaks.impulseAndDiscretionary.outlierTotalBRL),
                    secondaryLabel: 'Consumo Discricionário Mês',
                    secondaryValue: fmt(discSpend),
                    advice: `Detectei ${outliersCount} compra(s) muito acima da sua média histórica. Potencial de recuperação mensal estimado em ${fmt(leaks.totalMonthlyRecoverableLeakBRL)}.`,
                    alertLevel: 'warning',
                };
            }

            return {
                headline: discSpend > 600 ? 'Atenção ao Consumo por Impulso' : 'Fluxo Operacional Disciplinado',
                metricLabel: 'Gastos Discricionários Mês',
                metricValue: fmt(discSpend),
                secondaryLabel: topCat ? `Maior Categoria (${topCat.name})` : 'Ritmo Diário',
                secondaryValue: topCat ? fmt(topCat.totalAmount) : `${fmt(stmt.dailyBurnRate)}/dia`,
                advice:
                    discSpend > 0
                        ? `Delivery, lazer e compras rápidas somam ${fmt(discSpend)} neste mês. Reduzir 25% libera ${fmt(discSpend * 0.25)} extras para investir.`
                        : 'Nenhum pico estatístico de impulso (> 2σ) detectado nas suas categorias recentes.',
                alertLevel: discSpend > 600 ? 'warning' : 'success',
            };
        },
    },

    // 6. REN — Arquiteto de Metas Patrimoniais e Juro Real de Fisher
    {
        id: 'ren',
        name: 'Ren',
        role: 'Arquiteto de Metas Patrimoniais e Juro Real de Fisher',
        personality: 'Visionário, disciplinado no longo prazo e guardião implacável do poder de compra contra a inflação.',
        tagline: 'Projeta a evolução da sua meta descontando o IPCA composto pela Equação de Fisher exata.',
        avatarBg: 'from-rose-600/25 to-neutral-800/40',
        avatarEmoji: '⚡',
        accentColor: '#E11D48',
        consumedTools: ['compare_fixed_income_br'],
        suggestedPrompt:
            'Ren, projete minha evolução patrimonial para os próximos 5 anos descontando a inflação pela Equação de Fisher exata em direção ao meu objetivo financeiro.',
        systemPersonaDirective:
            'Você está operando como **Ren (Arquiteto de Metas Patrimoniais e Juro Real de Fisher)**. Nunca subtraia inflação linearmente da taxa nominal: utilize exclusivamente a taxa real de Fisher e a linha do tempo de poder de compra real (`finalRealPurchasingPowerBRL` vs `finalNominalBalance`) alinhada à meta do usuário.',
        executeDeterministicPayload: (userData, params) => ({
            agent: 'Ren',
            fixedIncomeAndGoals: toolAnalyzeFixedIncomeAndGoals(userData, params?.fixedIncomeParams),
        }),
        buildLiveDiagnostic: (bundle, fmt, isPrivacyMode) => {
            const fi = bundle.fixedIncomeAndGoals;
            const proj = fi.realWealthProjection;
            const realRate = fi.portfolioSummary.weightedRealAnnualFisherPct;

            return {
                headline: realRate > 0 ? 'Ganho Real Acima do IPCA' : 'Atenção à Erosão Inflacionária',
                metricLabel: `Poder de Compra Real (${Math.round(proj.horizonMonths / 12)} anos)`,
                metricValue: fmt(proj.finalRealPurchasingPowerBRL),
                secondaryLabel: 'Taxa Real Líquida (Fisher)',
                secondaryValue: isPrivacyMode ? '••% a.a.' : `+${realRate.toFixed(2)}% a.a.`,
                advice: `Aportando ${fmt(proj.monthlyContributionUsed)}/mês, seu patrimônio chegará a ${fmt(proj.finalNominalBalance)} nominais (${fmt(proj.finalRealPurchasingPowerBRL)} em moeda real de hoje descontando IPCA).`,
                alertLevel: realRate >= 3 ? 'success' : realRate > 0 ? 'info' : 'warning',
            };
        },
    },

    // 7. TAKESHI — Conciliador de Espaço Compartilhado e Divisão Proporcional Familiar
    {
        id: 'takeshi',
        name: 'Takeshi',
        role: 'Conciliador de Espaço Compartilhado e Divisão Proporcional Familiar',
        personality: 'Diplomático, justo, transparente e especialista em governança financeira de casais e famílias.',
        tagline: 'Pondera despesas conjuntas pelo peso real da renda líquida de cada membro para um acerto justo.',
        avatarBg: 'from-amber-500/25 to-orange-600/15',
        avatarEmoji: '🤝',
        accentColor: '#EA580C',
        consumedTools: ['shared_space_reconciler', 'get_income_statement'],
        suggestedPrompt:
            'Takeshi, calcule a divisão proporcional justa das despesas do mês com base na nossa renda líquida e diga como equilibrar o orçamento compartilhado.',
        systemPersonaDirective:
            'Você está operando como **Takeshi (Conciliador de Espaço Compartilhado e Divisão Proporcional Familiar)**. Utilize os pesos exatos de renda líquida e saídas operacionais de `espacoCompartilhadoTakeshi` e `get_income_statement` para propor divisões justas (Proporcional à Renda vs 50/50) sem jamais inventar valores.',
        executeDeterministicPayload: (userData, params) => {
            const incomeStatement = toolGetIncomeStatement(userData, params?.periodMonths ?? 1);
            const sharedSpace = calculateSharedProportionalSummary(userData, incomeStatement);
            return {
                agent: 'Takeshi',
                sharedSpace,
                incomeStatement,
            };
        },
        buildLiveDiagnostic: (bundle, fmt, isPrivacyMode) => {
            const sh = bundle.sharedSpace;
            const stmt = bundle.incomeStatement;

            if (sh.hasActiveSharedSpace && sh.partnersTotalMonthlyIncome > 0) {
                const delta = sh.netSettlementDeltaBRL;
                const weightStr = isPrivacyMode ? '••%' : `${sh.userFairShareWeightPct.toFixed(1)}%`;
                return {
                    headline: `Peso Proporcional: ${weightStr} da Renda`,
                    metricLabel: delta >= 0 ? 'Crédito a Receber no Mês' : 'Acerto Proporcional a Enviar',
                    metricValue: fmt(Math.abs(delta)),
                    secondaryLabel: 'Cota Justa Mensal',
                    secondaryValue: fmt(sh.userTargetFairContributionBRL),
                    advice: `Na divisão proporcional entre ${sh.membersCount} membros, sua cota ideal é ${fmt(sh.userTargetFairContributionBRL)} frente a ${fmt(sh.userCurrentMonthExpenses)} pagos por você.`,
                    alertLevel: Math.abs(delta) > 500 ? 'info' : 'success',
                };
            }

            if (sh.hasActiveSharedSpace) {
                return {
                    headline: `Espaço Ativo (${sh.membersCount} Integrantes)`,
                    metricLabel: 'Despesas Operacionais Mês',
                    metricValue: fmt(stmt.netOperationalExpenses),
                    secondaryLabel: 'Regra 50/50 de Referência',
                    secondaryValue: fmt(stmt.netOperationalExpenses / Math.max(2, sh.membersCount)),
                    advice: `Família vinculada! Conecte ou sincronize as contas do parceiro(a) em /shared para cálculo automático do Pix de acerto proporcional.`,
                    alertLevel: 'info',
                };
            }

            return {
                headline: 'Pronto para Governança Familiar',
                metricLabel: 'Base Mensal Conciliável',
                metricValue: fmt(stmt.netOperationalExpenses),
                secondaryLabel: 'Simulação 50/50 Duo',
                secondaryValue: fmt(stmt.netOperationalExpenses / 2),
                advice: `Seus gastos operacionais somam ${fmt(stmt.netOperationalExpenses)} no mês. Ative o Espaço Compartilhado para dividir contas proporcionalmente à renda.`,
                alertLevel: 'info',
            };
        },
    },
];

export function getKitsuneAgentById(id: KitsuneAgentId): KitsuneSpecialistAgent {
    return KITSUNE_AGENTS_REGISTRY.find((a) => a.id === id) ?? KITSUNE_AGENTS_REGISTRY[0];
}

export interface AgentRoutingDecision {
    agent: KitsuneSpecialistAgent;
    matchedExplicitly: boolean;
    extractedExtraBudget: number;
    extractedPeriodMonths: number;
}

/**
 * Roteia deterministicamente uma pergunta do usuário para um dos 7 Agentes Especialistas da Kitsune
 * (ou mantém Sentinela Kitsune como Orquestrador Geral 360°) e extrai parâmetros numéricos de simulação.
 */
export function routePromptToKitsuneAgent(
    prompt: string,
    attachedContexts: string[] = []
): AgentRoutingDecision {
    const normalized = String(prompt || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    // Extrai eventual orçamento mensal extra mencionado na pergunta (ex: "R$ 500 extras", "aportar 800")
    let extractedExtraBudget = 0;
    const extraMatch = normalized.match(
        /(?:extra|adicional|aportar|amortizar|sobrar)\s*(?:de\s*)?(?:r\$\s*)?(\d{2,6}(?:[.,]\d{1,2})?)/i
    );
    if (extraMatch?.[1]) {
        const parsed = Number(extraMatch[1].replace('.', '').replace(',', '.'));
        if (Number.isFinite(parsed) && parsed > 0 && parsed <= 500_000) {
            extractedExtraBudget = parsed;
        }
    }

    let extractedPeriodMonths = 1;
    const monthsMatch = normalized.match(/ultimos?\s+(\d{1,2})\s+meses/i);
    if (monthsMatch?.[1]) {
        const m = Number(monthsMatch[1]);
        if (m >= 1 && m <= 24) extractedPeriodMonths = m;
    }

    // 1. Menção explícita pelo nome do agente
    const explicitOrder: Array<{ id: KitsuneAgentId; regex: RegExp }> = [
        { id: 'sentinela', regex: /\bsentinela\b/i },
        { id: 'kuro', regex: /\bkuro\b/i },
        { id: 'kenji', regex: /\bkenji\b/i },
        { id: 'daiko', regex: /\bdaiko\b/i },
        { id: 'kage', regex: /\bkage\b/i },
        { id: 'ren', regex: /\bren\b/i },
        { id: 'takeshi', regex: /\btakeshi\b/i },
    ];

    for (const entry of explicitOrder) {
        if (entry.regex.test(normalized)) {
            return {
                agent: getKitsuneAgentById(entry.id),
                matchedExplicitly: true,
                extractedExtraBudget,
                extractedPeriodMonths,
            };
        }
    }

    // 2. Roteamento por anexos de contexto do Chat
    if (attachedContexts.includes('auditar-cartao')) {
        return {
            agent: getKitsuneAgentById('kenji'),
            matchedExplicitly: false,
            extractedExtraBudget,
            extractedPeriodMonths,
        };
    }
    if (attachedContexts.includes('cortar-gastos')) {
        return {
            agent: getKitsuneAgentById('kuro'),
            matchedExplicitly: false,
            extractedExtraBudget,
            extractedPeriodMonths,
        };
    }

    // 3. Roteamento semântico por domínio especialista
    if (/\b(casal|conjuge|esposa|marido|compartilhad|divisao proporcional|dividir conta|familia)\b/.test(normalized)) {
        return {
            agent: getKitsuneAgentById('takeshi'),
            matchedExplicitly: false,
            extractedExtraBudget,
            extractedPeriodMonths,
        };
    }

    if (/\b(avalanche|bola de neve|snowball|rotativo|antecipar parcela|antecipacao|cet|quitar divida|emprestimo)\b/.test(normalized)) {
        return {
            agent: getKitsuneAgentById('kenji'),
            matchedExplicitly: false,
            extractedExtraBudget,
            extractedPeriodMonths,
        };
    }

    if (/\b(fgc|lci|lca|cdb|rdb|tesouro|du\/252|252|aliquota regressiva|iof regressivo|carteira de investimento)\b/.test(normalized)) {
        return {
            agent: getKitsuneAgentById('daiko'),
            matchedExplicitly: false,
            extractedExtraBudget,
            extractedPeriodMonths,
        };
    }

    if (/\b(fisher|juro real|poder de compra|ipca|inflacao|aposentadoria|independencia financeira|longo prazo|5 anos|10 anos)\b/.test(normalized)) {
        return {
            agent: getKitsuneAgentById('ren'),
            matchedExplicitly: false,
            extractedExtraBudget,
            extractedPeriodMonths,
        };
    }

    if (/\b(assinatura|duplicad|cobrad[oa] duas vezes|anuidade|tarifa bancaria|pacote de servico|estorno indevido)\b/.test(normalized)) {
        return {
            agent: getKitsuneAgentById('kuro'),
            matchedExplicitly: false,
            extractedExtraBudget,
            extractedPeriodMonths,
        };
    }

    if (/\b(impulso|vazamento|delivery|ifood|superfluo|desvio padrao|fora do padrao|onde estou gastando demais)\b/.test(normalized)) {
        return {
            agent: getKitsuneAgentById('kage'),
            matchedExplicitly: false,
            extractedExtraBudget,
            extractedPeriodMonths,
        };
    }

    return {
        agent: getKitsuneAgentById('sentinela'),
        matchedExplicitly: false,
        extractedExtraBudget,
        extractedPeriodMonths,
    };
}

/**
 * Formata a diretiva de execução do agente especialista + saída ao vivo de suas Macro-Tools
 * para acoplamento imediato na chamada ao LLM (`/api/chat`).
 */
export function buildAgentTurnDirectiveBlock(
    decision: AgentRoutingDecision,
    userData?: UserFinancialDataInput
): string {
    const lines: string[] = [
        `[AGENTE_ESPECIALISTA_ATIVO: ${decision.agent.name} — ${decision.agent.role}]`,
        decision.agent.systemPersonaDirective,
        ANTI_HALLUCINATION_SYSTEM_DIRECTIVE,
    ];

    if (userData) {
        const livePayload = decision.agent.executeDeterministicPayload(userData, {
            extraMonthlyBudget: decision.extractedExtraBudget,
            periodMonths: decision.extractedPeriodMonths,
        });
        lines.push(`[MACRO_TOOLS_${decision.agent.id.toUpperCase()}_OUTPUT]`);
        lines.push(JSON.stringify(livePayload, null, 2));
        lines.push(`[/MACRO_TOOLS_${decision.agent.id.toUpperCase()}_OUTPUT]`);
    }

    return lines.join('\n');
}
