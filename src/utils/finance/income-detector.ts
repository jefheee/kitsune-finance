/**
 * Kitsune Finance — Motor Inteligente de Detecção de Padrão de Renda
 * Analisa as transações reais de entrada para detectar:
 * 1. Salário Formal / CLT / Pró-labore recorrente de empresas
 * 2. Renda Variável / Freelancer / Prestador de Serviços
 * 3. Entradas Informais / Auxílio Familiar / Sem Emprego Fixo
 * 4. Conciliação com a "Renda Mensal Líquida" declarada pelo usuário
 */

export interface DetectedIncomeProfile {
    type: 'CLT_SALARIED' | 'VARIABLE_FREELANCE' | 'INFORMAL_SPORADIC' | 'NO_REGULAR_INCOME';
    typeLabel: string;
    description: string;
    badgeColor: string;
    monthlyAverageIncome: number;
    recurringSalaryAmount?: number;
    expectedPayDay?: number;
    salaryPayerName?: string;
    confidence: 'ALTA' | 'MÉDIA' | 'ESTIMADA';
    inflowCount90Days: number;
    comparisonWithDeclared?: {
        declaredIncome: number;
        detectedIncome: number;
        difference: number;
        differencePercent: number;
        status: 'CONCILIADA' | 'DIVERGENTE_MAIOR' | 'DIVERGENTE_MENOR' | 'NAO_INFORMADA';
        explanation: string;
    };
}

export function detectUserIncomePattern(
    transactions: any[],
    declaredMonthlyIncome?: number | string | null
): DetectedIncomeProfile {
    const declared = Number(declaredMonthlyIncome) || 0;

    // 1. Filtra entradas genuínas (exclui transferências entre contas próprias e estornos)
    const genuineInflows = transactions.filter((t) => {
        const amt = Number(t.amount) || 0;
        return (
            amt > 0 &&
            !t.is_internal_transfer &&
            !t.is_refund &&
            t.category_pt !== 'Transferência Própria' &&
            t.category_pt !== 'Pagamento de Fatura'
        );
    });

    if (genuineInflows.length === 0) {
        return {
            type: 'NO_REGULAR_INCOME',
            typeLabel: 'Sem Renda Regular Detectada',
            description: 'Nenhuma entrada recorrente de salário ou atividade operacional foi identificada nos extratos bancários conectados.',
            badgeColor: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
            monthlyAverageIncome: 0,
            confidence: 'ALTA',
            inflowCount90Days: 0,
            comparisonWithDeclared: declared > 0
                ? {
                      declaredIncome: declared,
                      detectedIncome: 0,
                      difference: -declared,
                      differencePercent: -100,
                      status: 'DIVERGENTE_MENOR',
                      explanation: `Você informou uma renda de R$ ${declared.toFixed(2)}, mas as contas conectadas ainda não registraram os depósitos correspondentes. Se você recebe em outra instituição ou em dinheiro, mantenha o valor declarado como referência.`,
                  }
                : undefined,
        };
    }

    // Calcula a média mensal dos últimos 90 dias (ou do período disponível)
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const recentInflows = genuineInflows.filter((t) => {
        const rawDate = t.executed_at || t.date;
        const d = rawDate ? new Date(rawDate) : null;
        return d && d >= ninetyDaysAgo;
    });

    const targetList = recentInflows.length >= 3 ? recentInflows : genuineInflows;
    const totalInflow = targetList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const monthsSpan = Math.max(1, Math.min(3, Math.ceil(targetList.length / 5)));
    const monthlyAverage = totalInflow / monthsSpan;

    // 2. Busca padrões de Salário CLT / Formal / Pró-labore
    // Agrupa lançamentos por pagador ou descrição aproximada e valor
    const salaryKeywords = ['salario', 'folha', 'pro-labore', 'vencimento', 'remuneracao', 'ted recebida', 'pix recebido'];
    const candidatesByPayer = new Map<string, Array<{ amount: number; date: Date; raw: any }>>();

    targetList.forEach((t) => {
        const amt = Number(t.amount) || 0;
        if (amt < 300) return; // Salários no Brasil são maiores que R$ 300

        const desc = (t.clean_description || t.payer_name || t.description || '').toLowerCase();
        const rawDate = t.executed_at || t.date;
        const date = rawDate ? new Date(rawDate) : new Date();

        // Normaliza chave de pagador
        const key = desc.slice(0, 16).trim();
        if (!candidatesByPayer.has(key)) candidatesByPayer.set(key, []);
        candidatesByPayer.get(key)!.push({ amount: amt, date, raw: t });
    });

    let detectedSalaryCandidate: {
        payer: string;
        amount: number;
        day: number;
        occurrences: number;
    } | null = null;

    for (const [payer, entries] of candidatesByPayer.entries()) {
        if (entries.length >= 2) {
            // Verifica consistência de valor (+/- 15%)
            const baseAmount = entries[0].amount;
            const isConsistent = entries.every((e) => Math.abs(e.amount - baseAmount) / baseAmount < 0.18);

            if (isConsistent) {
                const day = entries[0].date.getDate();
                detectedSalaryCandidate = {
                    payer: entries[0].raw.clean_description || entries[0].raw.payer_name || payer,
                    amount: baseAmount,
                    day,
                    occurrences: entries.length,
                };
                break;
            }
        }
    }

    // 3. Classificação do Perfil
    let profileType: DetectedIncomeProfile['type'] = 'VARIABLE_FREELANCE';
    let typeLabel = 'Renda Variável / Autônomo';
    let description = 'Entradas frequentes com valores variados ao longo do mês, característico de profissionais liberais, freelancers ou prestadores de serviço.';
    let badgeColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    let confidence: DetectedIncomeProfile['confidence'] = 'MÉDIA';

    if (detectedSalaryCandidate && detectedSalaryCandidate.amount > 600) {
        profileType = 'CLT_SALARIED';
        typeLabel = 'Salário Recorrente (CLT / Pró-labore)';
        description = `Padrão salarial consistente identificado de aproximadamente R$ ${detectedSalaryCandidate.amount.toFixed(2).replace('.', ',')} recebido por volta do dia ${detectedSalaryCandidate.day}.`;
        badgeColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
        confidence = 'ALTA';
    } else if (monthlyAverage < 800 || targetList.length <= 2) {
        profileType = 'INFORMAL_SPORADIC';
        typeLabel = 'Entradas Esporádicas / Não Assalariado';
        description = 'Não há padrão de salário regular de empresa. Entradas pontuais de transferências de terceiros ou vendas esporádicas.';
        badgeColor = 'text-blue-500 bg-blue-500/10 border-blue-500/20';
        confidence = 'ESTIMADA';
    }

    // 4. Comparação e Auditoria com a Renda Declarada
    let comparisonWithDeclared: DetectedIncomeProfile['comparisonWithDeclared'];

    if (declared > 0) {
        const effectiveDetected = detectedSalaryCandidate ? detectedSalaryCandidate.amount : monthlyAverage;
        const diff = effectiveDetected - declared;
        const diffPercent = Math.round((diff / declared) * 100);

        let status: 'CONCILIADA' | 'DIVERGENTE_MAIOR' | 'DIVERGENTE_MENOR' = 'CONCILIADA';
        let explanation = '';

        if (Math.abs(diffPercent) <= 15) {
            status = 'CONCILIADA';
            explanation = `Sua renda declarada de R$ ${declared.toFixed(2).replace('.', ',')} está 100% alinhada com as entradas reais conciliadas no Open Finance (R$ ${effectiveDetected.toFixed(2).replace('.', ',')}).`;
        } else if (diff > 0) {
            status = 'DIVERGENTE_MAIOR';
            explanation = `Suas entradas reais consolidadas (R$ ${effectiveDetected.toFixed(2).replace('.', ',')}) são ${diffPercent}% maiores que o valor informado de R$ ${declared.toFixed(2).replace('.', ',')}. Você está gerando mais caixa do que estimava.`;
        } else {
            status = 'DIVERGENTE_MENOR';
            explanation = `Você declarou R$ ${declared.toFixed(2).replace('.', ',')}, porém as contas bancárias conectadas identificaram R$ ${effectiveDetected.toFixed(2).replace('.', ',')} em entradas operacionais. A diferença de ${Math.abs(diffPercent)}% pode indicar recebimentos em outras contas não conectadas ou em espécie.`;
        }

        comparisonWithDeclared = {
            declaredIncome: declared,
            detectedIncome: effectiveDetected,
            difference: diff,
            differencePercent: diffPercent,
            status,
            explanation,
        };
    }

    return {
        type: profileType,
        typeLabel,
        description,
        badgeColor,
        monthlyAverageIncome: monthlyAverage,
        recurringSalaryAmount: detectedSalaryCandidate?.amount,
        expectedPayDay: detectedSalaryCandidate?.day,
        salaryPayerName: detectedSalaryCandidate?.payer,
        confidence,
        inflowCount90Days: targetList.length,
        comparisonWithDeclared,
    };
}
