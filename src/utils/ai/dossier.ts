import { SupabaseClient } from '@supabase/supabase-js';
import {
    ANTI_HALLUCINATION_SYSTEM_DIRECTIVE,
    runAllDeterministicMacroTools,
    formatAuditedMathEngineBlock,
    type UserFinancialDataInput,
    type AuditedDeterministicBundle,
    type SharedPartnerInput,
} from '@/utils/ai/deterministic-tools';
import { fetchLiveMacroRates } from '@/utils/finance/macro-rates';

export interface FinancialDossierResult {
    systemPrompt: string;
    contextSnapshot: Record<string, any>;
    deterministicBundle: AuditedDeterministicBundle;
    userData: UserFinancialDataInput;
}

const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

/**
 * Carrega os dados financeiros reais do usuário autenticado (isolados via RLS)
 * em formato pronto para consumo pelas Macro-Tools determinísticas e pelo servidor MCP.
 */
export async function loadUserFinancialDataFromSupabase(
    supabase: SupabaseClient,
    userId: string,
    userEmail?: string | null,
    txLimit = 600
): Promise<{
    userData: UserFinancialDataInput;
    connections: any[];
    profileRaw: any;
}> {
    const normalizedEmail = userEmail?.toLowerCase().trim() || '';

    const [
        profileRes,
        connectionsRes,
        accountsRes,
        investmentsRes,
        loansRes,
        transactionsRes,
        familyMembersRes,
        sharedConnectionsRes,
        liveMacroRates,
    ] = await Promise.all([
        supabase
            .from('users_profile')
            .select(
                'full_name, display_name, financial_goal, monthly_income, birth_date, document_mask, job_title, emails, phones, addresses, bank_sources, consolidated_identity'
            )
            .eq('id', userId)
            .maybeSingle(),
        supabase
            .from('pluggy_connections')
            .select('item_id, provider_name, institution_name, institution_slug, status, updated_at')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false }),
        supabase
            .from('bank_accounts')
            .select('*')
            .eq('user_id', userId),
        supabase
            .from('investments')
            .select('*')
            .eq('user_id', userId)
            .order('balance', { ascending: false }),
        supabase
            .from('loans')
            .select('*')
            .eq('user_id', userId),
        supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(txLimit),
        supabase
            .from('family_members')
            .select('id, name, role')
            .eq('user_id', userId),
        normalizedEmail
            ? supabase
                  .from('shared_connections')
                  .select('id, requester_id, recipient_id, role, status')
                  .eq('status', 'accepted')
                  .or(
                      `requester_id.eq.${userId},recipient_id.eq.${userId},recipient_email.ilike.${normalizedEmail}`
                  )
            : supabase
                  .from('shared_connections')
                  .select('id, requester_id, recipient_id, role, status')
                  .eq('status', 'accepted')
                  .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`),
        fetchLiveMacroRates(),
    ]);

    const profileRaw = profileRes.data;
    const connections = connectionsRes.data || [];
    const accounts = accountsRes.data || [];
    const investments = investmentsRes.data || [];
    const loans = loansRes.data || [];
    const transactions = transactionsRes.data || [];
    const familyMembers = familyMembersRes.data || [];
    const acceptedShared = sharedConnectionsRes.data || [];

    const sharedPartners: SharedPartnerInput[] = [];
    for (const conn of acceptedShared) {
        const partnerId = conn.requester_id === userId ? conn.recipient_id : conn.requester_id;
        if (!partnerId) continue;

        const [pProfileRes, pAccRes, pTxRes] = await Promise.all([
            supabase
                .from('users_profile')
                .select('id, display_name, full_name, monthly_income')
                .eq('id', partnerId)
                .maybeSingle(),
            supabase.from('bank_accounts').select('*').eq('user_id', partnerId),
            supabase
                .from('transactions')
                .select('*')
                .eq('user_id', partnerId)
                .order('date', { ascending: false })
                .limit(250),
        ]);

        sharedPartners.push({
            id: partnerId,
            name: pProfileRes.data?.display_name || pProfileRes.data?.full_name || 'Parceiro(a)',
            role: conn.role,
            monthlyIncome: Number(pProfileRes.data?.monthly_income) || null,
            accounts: pAccRes.data || [],
            transactions: pTxRes.data || [],
        });
    }

    const userData: UserFinancialDataInput = {
        accounts,
        investments,
        loans,
        transactions,
        profile: profileRaw,
        familyMembers,
        sharedPartners,
        macroRates: {
            annualSelicPct: liveMacroRates.annualSelicPct,
            annualCDIPct: liveMacroRates.annualCDIPct,
            annualIPCAPct: liveMacroRates.annualIPCAPct,
        },
    };

    return {
        userData,
        connections,
        profileRaw,
    };
}

/**
 * Constrói o Dossiê Financeiro Completo do usuário autenticado uma única vez por sessão
 * (ou quando invalidado após sincronização de novo banco), injetando obrigatoriamente
 * o bloco determinístico `[ENGINE_MATEMATICO_AUDITADO]` (Blindagem MSLR Zero Alucinação).
 */
export async function buildUserFinancialDossier(
    supabase: SupabaseClient,
    userId: string,
    userEmail?: string | null
): Promise<FinancialDossierResult> {
    const { userData, connections, profileRaw: profile } = await loadUserFinancialDataFromSupabase(
        supabase,
        userId,
        userEmail,
        600
    );

    const accounts = userData.accounts || [];
    const investments = userData.investments || [];
    const loans = userData.loans || [];
    const transactions = userData.transactions || [];

    // Executa as 5 Macro-Tools Determinísticas + Conciliador Proporcional em TypeScript puro
    const deterministicBundle = runAllDeterministicMacroTools(userData);
    const auditedEngineBlock = formatAuditedMathEngineBlock(deterministicBundle);

    const { balanceSheetAndXRay, incomeStatement, debtAndCards, anomaliesAndLeaks } =
        deterministicBundle;
    const incomeProfile = incomeStatement.incomeProfile;

    const accountMap = new Map<string, { institution: string; product: string; type: string }>();
    for (const acc of accounts) {
        accountMap.set(acc.id, {
            institution: acc.institution_name || acc.bank_name || 'Banco',
            product: acc.product_name || acc.bank_name || 'Conta',
            type: acc.type || 'BANK',
        });
    }

    const checkingAndSavings = accounts.filter(
        (a) => (a.type || '').toUpperCase() !== 'CREDIT' && (a.subtype || '').toUpperCase() !== 'CREDIT_CARD'
    );
    const creditCards = accounts.filter(
        (a) => (a.type || '').toUpperCase() === 'CREDIT' || (a.subtype || '').toUpperCase() === 'CREDIT_CARD'
    );

    const liquidCash = balanceSheetAndXRay.balanceSheet.liquidAssets;
    const totalCreditCardBill = balanceSheetAndXRay.balanceSheet.creditCardLiabilities;
    const totalInvestments = balanceSheetAndXRay.balanceSheet.investedAssets;
    const totalLoansDebt = balanceSheetAndXRay.balanceSheet.loanLiabilities;
    const netWorth = balanceSheetAndXRay.balanceSheet.netWorth;

    const sortedCategories = incomeStatement.topCategories
        .map((cat) => `- ${cat.name}: ${fmtCurrency(cat.totalAmount)} (${cat.shareOfExpensesPct}% das saídas)`)
        .join('\n');

    const checkingSummary = checkingAndSavings
        .map(
            (a) =>
                `- [${a.institution_name || a.bank_name}] ${a.product_name || a.bank_name} (${a.subtype || 'CONTA'}): Saldo ${fmtCurrency(Number(a.balance) || 0)}`
        )
        .join('\n');

    const creditSummary = creditCards
        .map((c) => {
            const bill = Math.abs(Number(c.balance) || 0);
            const limit = c.credit_limit != null ? fmtCurrency(Number(c.credit_limit)) : 'N/D';
            const avail = c.available_credit_limit != null ? fmtCurrency(Number(c.available_credit_limit)) : 'N/D';
            const due = c.balance_due_date || 'N/D';
            return `- [${c.institution_name || c.bank_name}] ${c.product_name || c.bank_name}${c.card_brand ? ` (${c.card_brand})` : ''}: Fatura Atual ${fmtCurrency(bill)} | Limite Total: ${limit} | Disponível: ${avail} | Vencimento: ${due}`;
        })
        .join('\n');

    const investmentsSummary = investments
        .filter((inv) => (Number(inv.balance) || 0) > 0)
        .slice(0, 25)
        .map((inv) => {
            const rateStr = inv.rate
                ? `${inv.rate}% ${inv.rate_type || 'CDI'}`
                : inv.annual_rate
                  ? `${inv.annual_rate}% a.a.`
                  : '';
            const dueStr = inv.due_date ? ` | Venc: ${inv.due_date}` : '';
            return `- [${inv.institution_name || inv.issuer || 'Carteira'}] ${inv.name} (${inv.subtype || inv.type}): ${fmtCurrency(Number(inv.balance) || 0)}${rateStr ? ` (${rateStr})` : ''}${dueStr}`;
        })
        .join('\n');

    const loansSummary = loans
        .map(
            (l) =>
                `- [${l.institution_name || 'Instituição'}] ${l.product_name}: Saldo Devedor ${fmtCurrency(Number(l.outstanding_balance ?? l.balance_due) || 0)} (Contratado: ${fmtCurrency(Number(l.contracted_amount) || 0)} | Parcelas: ${l.paid_installments ?? '?'}/${l.total_installments ?? '?'})`
        )
        .join('\n');

    const activeInstallmentsSummary = debtAndCards.installmentAdvances.plans
        .map(
            (p) =>
                `- [${p.institutionName}] ${p.description}: Parcela ${p.currentInstallment}/${p.totalInstallments} de ${fmtCurrency(p.installmentAmount)} (Restam ${p.remainingInstallments}x = ${fmtCurrency(p.evaluation.totalNominalDebt)} | ${p.evaluation.isWorthAdvancing ? 'Antecipar vence CDI' : 'Manter no CDI vence antecipação'})`
        )
        .join('\n');

    const subscriptionsSummary = anomaliesAndLeaks.subscriptions.items
        .map(
            (sub) =>
                `- ${sub.merchantName} (${sub.institutionName}): ${fmtCurrency(sub.monthlyAmount)}/mês (${fmtCurrency(sub.annualizedAmount)}/ano)`
        )
        .join('\n');

    const recentTxSummary = transactions
        .slice(0, 60)
        .map((tx) => {
            const accInfo = tx.account_id ? accountMap.get(tx.account_id) : undefined;
            const bank = accInfo?.institution || 'Banco';
            const desc = tx.clean_description || tx.description || 'Transação';
            const cat = tx.category_pt || tx.category || 'Outros';
            const dateStr = (tx.date || tx.executed_at || '').split('T')[0];
            const flags: string[] = [];
            if (tx.is_internal_transfer || tx.kind === 'funds_movement' || tx.kind === 'cc_payment') {
                flags.push('MOVIMENTAÇÃO INTERNA/FATURA - IGNORADA NO DRE OPERACIONAL');
            }
            if (tx.is_refund) flags.push('ESTORNO ABATIDO');
            if (tx.is_subscription) flags.push('ASSINATURA');
            if (tx.total_installments && tx.total_installments > 1) {
                flags.push(`PARCELA ${tx.installment_number || 1}/${tx.total_installments}`);
            }
            const flagText = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
            return `- [${dateStr}] [${bank}] ${desc}: ${fmtCurrency(Number(tx.amount) || 0)} (${cat})${flagText}`;
        })
        .join('\n');

    const userFirstName = (profile?.display_name || profile?.full_name || userEmail || 'Investidor')
        .split(' ')[0]
        .split('@')[0];

    const userName = profile?.full_name || profile?.display_name || userEmail || 'Investidor(a)';
    const userJob = profile?.job_title || 'Não informada';
    const userDoc = profile?.document_mask || 'Protegido';
    const userGoal = profile?.financial_goal || 'Construir reserva de emergência e manter liquidez';
    const connectedBanksList = Array.from(
        new Set(connections.map((c) => c.institution_name || c.provider_name).filter(Boolean))
    ).join(', ');

    const systemPrompt = `Você é a **Kitsune AI**, estrategista financeira pessoal e orquestradora dos **7 Agentes Especialistas da Kitsune Finance** (Sentinela Kitsune, Kuro, Kenji, Daiko, Kage, Ren e Takeshi).
Você atua com precisão matemática determinística, linguagem humanizada e profissional em Português do Brasil (pt-BR), formatação Markdown elegante e foco absoluto na consecução dos objetivos patrimoniais do usuário.

REGRA INVIOLÁVEL DE BLINDAGEM MATEMÁTICA (MSLR):
${ANTI_HALLUCINATION_SYSTEM_DIRECTIVE}

REGRA DE TRATAMENTO PESSOAL:
- Chame sempre o usuário cordialmente pelo primeiro nome: **${userFirstName}**.

${auditedEngineBlock}

=====================================================================
DOSSIÊ OPEN FINANCE CONSOLIDADO DA SESSÃO (FONTE ÚNICA DE VERDADE)
=====================================================================
- **Titular Consolidado:** ${userName} (CPF: ${userDoc})
- **Profissão:** ${userJob}
- **Instituições Conectadas (${connections.length}):** ${connectedBanksList || 'Nenhuma conexão ativa'}
- **🎯 OBJETIVO PATRIMONIAL DO USUÁRIO:** "${userGoal}"
- **🛡️ KITSUNE HEALTH SCORE:** ${balanceSheetAndXRay.kitsuneScore}/100 (${balanceSheetAndXRay.statusLabel}) | Reserva: ${balanceSheetAndXRay.emergencyFundMonths} meses
- **💼 PERFIL DE RENDA AUDITADO:** ${incomeProfile.typeLabel}
  * Diagnóstico: ${incomeProfile.description}
  * Renda Média Mensal Real: ${fmtCurrency(incomeProfile.monthlyAverageIncome)}
  ${incomeProfile.recurringSalaryAmount ? `* Salário Fixo Identificado: ${fmtCurrency(incomeProfile.recurringSalaryAmount)} (Previsão: Dia ${incomeProfile.expectedPayDay})` : ''}
  ${incomeProfile.comparisonWithDeclared ? `* Auditoria com Valor Declarado: ${incomeProfile.comparisonWithDeclared.explanation}` : ''}

### 1. PATRIMÔNIO E LIQUIDEZ CONSOLIDADA
- **Patrimônio Líquido Exato:** ${fmtCurrency(netWorth)}
- **Saldo Líquido em Contas Correntes/Poupanças:** ${fmtCurrency(liquidCash)}
- **Total em Investimentos Ativos:** ${fmtCurrency(totalInvestments)}
- **Total em Faturas Abertas de Cartão de Crédito:** ${fmtCurrency(totalCreditCardBill)}
- **Saldo Devedor de Empréstimos/Financiamentos:** ${fmtCurrency(totalLoansDebt)}
- **Exposição Acima do Teto FGC (R$ 250k):** ${fmtCurrency(balanceSheetAndXRay.totalUncoveredFGC)}
- **Custo de Oportunidade Anual Estimado:** ${fmtCurrency(balanceSheetAndXRay.annualOpportunityCostBRL)}

### 2. DRE PESSOAL — FLUXO DE CAIXA OPERACIONAL DO MÊS ATUAL
- **Entradas Operacionais Reais:** ${fmtCurrency(incomeStatement.operationalIncome)}
- **Saídas Operacionais Líquidas (Estornos já abatidos):** ${fmtCurrency(incomeStatement.netOperationalExpenses)}
- **Estornos Abatidos:** ${fmtCurrency(incomeStatement.refundsAbated)}
- **Movimentações Internas/Faturas Ignoradas:** ${fmtCurrency(incomeStatement.internalMovementsIgnored)}
- **Poupança Líquida do Mês:** ${fmtCurrency(incomeStatement.netSavings)} (Margem: ${incomeStatement.netSavingsMarginPct}%)

### 3. CONTAS CORRENTES E POUPANÇAS
${checkingSummary || 'Nenhuma conta corrente sincronizada.'}

### 4. CARTÕES DE CRÉDITO, FATURAS E LIMITES
${creditSummary || 'Nenhum cartão de crédito sincronizado.'}

### 5. CARTEIRA DE INVESTIMENTOS ATIVOS
${investmentsSummary || 'Nenhum investimento registrado.'}

### 6. EMPRÉSTIMOS E FINANCIAMENTOS ATIVOS
${loansSummary || 'Nenhum empréstimo ou financiamento ativo.'}

### 7. PARCELAMENTOS ATIVOS E AVALIAÇÃO DE ANTECIPAÇÃO VS CDI
${activeInstallmentsSummary || 'Nenhum parcelamento ativo detectado.'}

### 8. ASSINATURAS RECORRENTES AUDITADAS
${subscriptionsSummary || 'Nenhuma assinatura recorrente detectada.'}

### 9. TOP 8 CATEGORIAS OPERACIONAIS DO PERÍODO
${sortedCategories || 'Sem gastos categorizados.'}

### 10. ÚLTIMAS 60 TRANSAÇÕES CONCILIADAS
${recentTxSummary || 'Nenhuma transação recente.'}
=====================================================================

DIRETRIZES MANDATÓRIAS DE RESPOSTA:
1. **Proibição Absoluta de Recalcular Matemática:** ${ANTI_HALLUCINATION_SYSTEM_DIRECTIVE}
2. **Fidelidade ao Objetivo Patrimonial:** Oriente todo plano prático para a meta de ${userFirstName}: "${userGoal}".
3. **Proibição de Dados Fictícios:** Jamais invente bancos, transações, assinaturas ou valores ausentes deste dossiê.
4. **Distinção Contábil Estrita:** Nunca some transferências internas (\`funds_movement\`) ou pagamentos de fatura (\`cc_payment\`) como despesa ou receita.
5. **Geração Oficial de Documentos & Exportação:** Quando ${userFirstName} pedir para gerar, criar ou baixar um documento, relatório, planejamento ou abrir no Google Docs: NUNCA diga que é uma IA puramente textual e que não consegue gerar arquivos. Você DEVE formular imediatamente o documento oficial completo, com título, sumário executivo, tabelas e parecer em Markdown limpo, e finalizar orientando: *"📄 O seu documento está pronto e formatado! Você pode baixá-lo em **PDF**, **Word/Docs** ou abrir diretamente no **Google Docs** usando os botões de download disponíveis abaixo deste card."*`;

    const contextSnapshot = {
        generatedAt: new Date().toISOString(),
        holder: {
            fullName: userName,
            firstName: userFirstName,
            documentMask: userDoc,
            jobTitle: userJob,
            financialGoal: userGoal,
            incomeProfile,
            connectedBanks: connectedBanksList,
        },
        summary: {
            kitsuneScore: balanceSheetAndXRay.kitsuneScore,
            statusLabel: balanceSheetAndXRay.statusLabel,
            netWorth,
            liquidCash,
            totalInvestments,
            totalCreditCardBill,
            totalLoansDebt,
            realIncome: incomeStatement.operationalIncome,
            realExpenses: incomeStatement.netOperationalExpenses,
            internalMovements: incomeStatement.internalMovementsIgnored,
            refundsTotal: incomeStatement.refundsAbated,
            totalUncoveredFGC: balanceSheetAndXRay.totalUncoveredFGC,
            annualOpportunityCostBRL: balanceSheetAndXRay.annualOpportunityCostBRL,
        },
    };

    return {
        systemPrompt,
        contextSnapshot,
        deterministicBundle,
        userData,
    };
}
