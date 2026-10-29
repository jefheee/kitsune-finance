import { SupabaseClient } from '@supabase/supabase-js';

export interface FinancialDossierResult {
    systemPrompt: string;
    contextSnapshot: Record<string, any>;
}

const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

/**
 * Constrói o Dossiê Financeiro Completo do usuário autenticado uma única vez por sessão
 * (ou quando invalidado após sincronização de novo banco).
 */
export async function buildUserFinancialDossier(
    supabase: SupabaseClient,
    userId: string,
    userEmail?: string | null
): Promise<FinancialDossierResult> {
    const [
        profileRes,
        connectionsRes,
        accountsRes,
        investmentsRes,
        loansRes,
        transactionsRes,
    ] = await Promise.all([
        supabase
            .from('users_profile')
            .select('full_name, birth_date, document_mask, job_title, emails, phones, addresses, bank_sources, consolidated_identity')
            .eq('id', userId)
            .maybeSingle(),
        supabase
            .from('pluggy_connections')
            .select('item_id, provider_name, institution_name, institution_slug, status, updated_at')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false }),
        supabase
            .from('bank_accounts')
            .select(
                'id, bank_name, institution_name, institution_slug, product_name, type, subtype, balance, credit_limit, available_credit_limit, balance_close_date, balance_due_date, minimum_payment, card_brand, currency'
            )
            .eq('user_id', userId),
        supabase
            .from('investments')
            .select('name, type, subtype, institution_name, issuer, balance, rate, rate_type, annual_rate, amount_profit, due_date, status')
            .eq('user_id', userId)
            .order('balance', { ascending: false }),
        supabase
            .from('loans')
            .select('product_name, type, institution_name, contracted_amount, outstanding_balance, paid_installments, total_installments, interest_rate, due_date')
            .eq('user_id', userId),
        supabase
            .from('transactions')
            .select(
                'account_id, description, clean_description, amount, type, category, category_pt, operation_type, is_internal_transfer, is_refund, is_subscription, installment_number, total_installments, total_purchase_amount, receiver_name, payer_name, payment_reason, date, executed_at'
            )
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(120),
    ]);

    const profile = profileRes.data;
    const connections = connectionsRes.data || [];
    const accounts = accountsRes.data || [];
    const investments = investmentsRes.data || [];
    const loans = loansRes.data || [];
    const transactions = transactionsRes.data || [];

    const accountMap = new Map<string, { institution: string; product: string; type: string }>();
    for (const acc of accounts) {
        accountMap.set(acc.id, {
            institution: acc.institution_name || acc.bank_name || 'Banco',
            product: acc.product_name || acc.bank_name || 'Conta',
            type: acc.type || 'BANK',
        });
    }

    // Cálculo de Saldos Reais
    const checkingAndSavings = accounts.filter((a) => (a.type || '').toUpperCase() !== 'CREDIT');
    const creditCards = accounts.filter((a) => (a.type || '').toUpperCase() === 'CREDIT');

    const liquidCash = checkingAndSavings.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
    const totalCreditCardBill = creditCards.reduce((acc, a) => acc + Math.abs(Number(a.balance) || 0), 0);
    const totalInvestments = investments.reduce((acc, i) => acc + (Number(i.balance) || 0), 0);
    const totalLoansDebt = loans.reduce((acc, l) => acc + (Number(l.outstanding_balance) || 0), 0);
    const netWorth = liquidCash + totalInvestments - totalCreditCardBill - totalLoansDebt;

    // Fluxo de Caixa (Excluindo Transferências Internas e Pagamentos de Fatura!)
    let realIncome = 0;
    let realExpenses = 0;
    let internalMovements = 0;
    let refundsTotal = 0;

    const categoryTotals: Record<string, number> = {};
    const activeInstallments: string[] = [];
    const activeSubscriptions = new Map<string, { amount: number; bank: string; date: string }>();

    for (const tx of transactions) {
        const amt = Math.abs(Number(tx.amount) || 0);
        const accInfo = accountMap.get(tx.account_id);
        const bankLabel = accInfo?.institution || 'Banco';
        const cleanDesc = tx.clean_description || tx.description || 'Transação';
        const cat = tx.category_pt || tx.category || 'Outros';

        if (tx.is_internal_transfer) {
            internalMovements += amt;
            continue;
        }

        if (tx.is_refund) {
            refundsTotal += amt;
            continue;
        }

        if (tx.type === 'CREDIT' && accInfo?.type !== 'CREDIT') {
            realIncome += amt;
        } else {
            realExpenses += amt;
            categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
        }

        if (tx.total_installments && tx.total_installments > 1) {
            const instNum = tx.installment_number || 1;
            const remaining = tx.total_installments - instNum;
            const totalPurch = tx.total_purchase_amount || amt * tx.total_installments;
            activeInstallments.push(
                `- [${bankLabel}] ${cleanDesc}: Parcela ${instNum}/${tx.total_installments} de ${fmtCurrency(amt)} (Total da compra: ${fmtCurrency(totalPurch)} | Restam ${remaining}x = ${fmtCurrency(remaining * amt)})`
            );
        }

        if (tx.is_subscription && !activeSubscriptions.has(cleanDesc.toLowerCase())) {
            activeSubscriptions.set(cleanDesc.toLowerCase(), {
                amount: amt,
                bank: bankLabel,
                date: tx.date || '',
            });
        }
    }

    const sortedCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, val]) => `- ${cat}: ${fmtCurrency(val)}`)
        .join('\n');

    const checkingSummary = checkingAndSavings
        .map((a) => `- [${a.institution_name || a.bank_name}] ${a.product_name || a.bank_name} (${a.subtype || 'CONTA'}): Saldo ${fmtCurrency(Number(a.balance) || 0)}`)
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
        .slice(0, 25)
        .map((inv) => {
            const rateStr = inv.rate ? `${inv.rate}% ${inv.rate_type || 'CDI'}` : inv.annual_rate ? `${inv.annual_rate}% a.a.` : '';
            const dueStr = inv.due_date ? ` | Venc: ${inv.due_date}` : '';
            return `- [${inv.institution_name || inv.issuer || 'Carteira'}] ${inv.name} (${inv.subtype || inv.type}): ${fmtCurrency(Number(inv.balance) || 0)}${rateStr ? ` (${rateStr})` : ''}${dueStr}`;
        })
        .join('\n');

    const loansSummary = loans
        .map(
            (l) =>
                `- [${l.institution_name || 'Instituição'}] ${l.product_name}: Saldo Devedor ${fmtCurrency(Number(l.outstanding_balance) || 0)} (Contratado: ${fmtCurrency(Number(l.contracted_amount) || 0)} | Parcelas: ${l.paid_installments ?? '?'}/${l.total_installments ?? '?'})`
        )
        .join('\n');

    const subscriptionsSummary = Array.from(activeSubscriptions.entries())
        .map(([name, info]) => `- ${name.toUpperCase()} (${info.bank}): ${fmtCurrency(info.amount)}/mês`)
        .join('\n');

    const recentTxSummary = transactions
        .slice(0, 60)
        .map((tx) => {
            const accInfo = accountMap.get(tx.account_id);
            const bank = accInfo?.institution || 'Banco';
            const desc = tx.clean_description || tx.description || 'Transação';
            const cat = tx.category_pt || tx.category || 'Outros';
            const dateStr = (tx.date || tx.executed_at || '').split('T')[0];
            const flags: string[] = [];
            if (tx.is_internal_transfer) flags.push('TRANSFERÊNCIA INTERNA/FATURA - NÃO É RECEITA/GASTO');
            if (tx.is_refund) flags.push('ESTORNO/REEMBOLSO');
            if (tx.is_subscription) flags.push('ASSINATURA');
            if (tx.total_installments && tx.total_installments > 1) {
                flags.push(`PARCELA ${tx.installment_number || 1}/${tx.total_installments}`);
            }
            const flagText = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
            return `- [${dateStr}] [${bank}] ${desc}: ${fmtCurrency(Number(tx.amount) || 0)} (${cat})${flagText}`;
        })
        .join('\n');

    const userName = profile?.full_name || userEmail || 'Investidor(a)';
    const userJob = profile?.job_title || 'Não informada';
    const userDoc = profile?.document_mask || 'Protegido';
    const connectedBanksList = Array.from(
        new Set(connections.map((c) => c.institution_name || c.provider_name).filter(Boolean))
    ).join(', ');

    const systemPrompt = `Você é a **Kitsune AI**, estrategista financeira pessoal e especialista em Open Finance Brasil do ecossistema **Kitsune Finance**.
Você atua com precisão matemática, linguagem clara em Português do Brasil (pt-BR), formatação Markdown elegante (tabelas, listas, destaques em negrito) e foco absoluto na construção de patrimônio e eficiência de fluxo de caixa.

=====================================================================
DOSSIÊ OPEN FINANCE CONSOLIDADO DA SESSÃO (FONTE ÚNICA DE VERDADE)
=====================================================================
- **Titular Consolidado:** ${userName} (CPF: ${userDoc})
- **Profissão Registrada nos Bancos:** ${userJob}
- **Instituições Conectadas (${connections.length}):** ${connectedBanksList || 'Nenhuma conexão ativa'}

### 1. PATRIMÔNIO E LIQUIDEZ CONSOLIDADA
- **Patrimônio Líquido Estimado:** ${fmtCurrency(netWorth)}
- **Saldo Líquido em Contas Correntes/Poupanças:** ${fmtCurrency(liquidCash)}
- **Total em Investimentos (CDBs, Renda Fixa, Fundos):** ${fmtCurrency(totalInvestments)}
- **Total em Faturas Abertas de Cartão de Crédito:** ${fmtCurrency(totalCreditCardBill)}
- **Saldo Devedor de Empréstimos/Financiamentos:** ${fmtCurrency(totalLoansDebt)}

### 2. FLUXO DE CAIXA REAL (SEM TRANSFERÊNCIAS PRÓPRIAS)
- **Entradas Reais (Excluindo Transferências Mesma Titularidade):** ${fmtCurrency(realIncome)}
- **Saídas Reais (Excluindo Pagamentos de Fatura e Transferências Próprias):** ${fmtCurrency(realExpenses)}
- **Movimentações Internas / Pagamentos de Fatura (Neutras no Patrimônio):** ${fmtCurrency(internalMovements)}
- **Estornos e Reembolsos em Cartão:** ${fmtCurrency(refundsTotal)}

### 3. CONTAS CORRENTES E POUPANÇAS
${checkingSummary || 'Nenhuma conta corrente sincronizada.'}

### 4. CARTÕES DE CRÉDITO, FATURAS E LIMITES
${creditSummary || 'Nenhum cartão de crédito sincronizado.'}

### 5. CARTEIRA DE INVESTIMENTOS (${investments.length} títulos/posições)
${investmentsSummary || 'Nenhum investimento registrado.'}

### 6. EMPRÉSTIMOS E FINANCIAMENTOS ATIVOS
${loansSummary || 'Nenhum empréstimo ou financiamento ativo.'}

### 7. PARCELAMENTOS DETECTADOS NO CARTÃO
${activeInstallments.slice(0, 20).join('\n') || 'Nenhum parcelamento ativo detectado.'}

### 8. ASSINATURAS E SERVIÇOS RECORRENTES REAIS
${subscriptionsSummary || 'Nenhuma assinatura recorrente detectada.'}

### 9. GASTOS REAIS POR CATEGORIA (EM PORTUGUÊS)
${sortedCategories || 'Sem gastos categorizados.'}

### 10. ÚLTIMAS 60 TRANSAÇÕES CONCILIADAS
${recentTxSummary || 'Nenhuma transação recente.'}
=====================================================================

DIRETRIZES MANDATÓRIAS DE RESPOSTA:
1. **Proibição de Dados Fictícios:** Jamais invente bancos, transações, assinaturas ou valores que não estejam neste dossiê.
2. **Distinção de Fluxo de Caixa:** Nunca some transferências para a mesma titularidade ou pagamento de fatura de cartão como se fossem gastos duplicados ou receitas novas.
3. **Respostas Práticas e Diretas:** Ao analisar gastos, cite os nomes reais dos estabelecimentos, os bancos correspondentes (ex: Nubank, Itaú, Santander, Banco Inter, Caixa, Mercado Pago) e valores exatos em R$.`;

    const contextSnapshot = {
        generatedAt: new Date().toISOString(),
        holder: {
            fullName: userName,
            documentMask: userDoc,
            jobTitle: userJob,
            connectedBanks: connectedBanksList,
        },
        summary: {
            netWorth,
            liquidCash,
            totalInvestments,
            totalCreditCardBill,
            totalLoansDebt,
            realIncome,
            realExpenses,
            internalMovements,
            refundsTotal,
        },
        counts: {
            connections: connections.length,
            accounts: accounts.length,
            investments: investments.length,
            loans: loans.length,
            transactionsSampled: transactions.length,
        },
    };

    return {
        systemPrompt,
        contextSnapshot,
    };
}
