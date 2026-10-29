export interface PluggyTransactionRaw {
    id: string;
    description?: string | null;
    descriptionRaw?: string | null;
    amount: number;
    date: string;
    type?: 'DEBIT' | 'CREDIT' | string | null;
    category?: string | null;
    operationType?: string | null;
    currencyCode?: string | null;
    paymentData?: {
        payer?: {
            name?: string | null;
            documentNumber?: { type?: string; value?: string } | null;
        } | null;
        receiver?: {
            name?: string | null;
            documentNumber?: { type?: string; value?: string } | null;
        } | null;
        reason?: string | null;
        paymentMethod?: string | null;
        referenceNumber?: string | null;
    } | null;
    creditCardMetadata?: {
        installmentNumber?: number | null;
        totalInstallments?: number | null;
        totalAmount?: number | null;
        billId?: string | null;
        purchaseDate?: string | null;
        cardNumber?: string | null;
    } | null;
    merchant?: {
        name?: string | null;
        businessName?: string | null;
        cnpj?: string | null;
        cnae?: string | null;
        category?: string | null;
    } | null;
}

export interface EnrichedTransaction {
    pluggyTransactionId: string;
    cleanDescription: string;
    rawDescription: string;
    amount: number;
    type: 'DEBIT' | 'CREDIT';
    categoryPt: string;
    categoryOriginal: string | null;
    operationType:
        | 'PIX'
        | 'TED'
        | 'CREDIT_CARD'
        | 'DEBIT_CARD'
        | 'BOLETO'
        | 'INTERNAL_TRANSFER'
        | 'REFUND'
        | 'BILL_PAYMENT'
        | 'OTHER';
    isInternalTransfer: boolean;
    isRefund: boolean;
    isSubscription: boolean;
    installmentNumber: number | null;
    totalInstallments: number | null;
    totalPurchaseAmount: number | null;
    merchantName: string | null;
    merchantBusinessName: string | null;
    merchantCnpj: string | null;
    payerName: string | null;
    receiverName: string | null;
    paymentReason: string | null;
    billId: string | null;
    executedAt: string;
    dateOnly: string;
}

const PLUGGY_CATEGORY_PT_MAP: Record<string, string> = {
    'same person transfer': 'Transferência Própria',
    'transfer - internal': 'Transferência Interna',
    'internal transfer': 'Transferência Interna',
    'transfers': 'Transferências',
    'transfer': 'Transferências',
    'third party transfer': 'Transferência para Terceiros',
    'transfer - third party': 'Transferência para Terceiros',
    'same person transfers': 'Transferência Própria',
    'transfer - pix': 'Pix',
    'pix': 'Pix',
    'transfer - ted': 'TED',
    'ted': 'TED',
    'transfer - doc': 'DOC',
    'transfer - bank slip': 'Boleto Bancário',
    'bank slip': 'Boleto Bancário',
    'credit card payment': 'Pagamento de Fatura',
    'loans and financing': 'Empréstimos e Financiamentos',
    'loans': 'Empréstimos e Financiamentos',
    'financing': 'Financiamentos',
    'late payment and overdraft costs': 'Juros e Encargos',
    'interests charged': 'Juros e Encargos',
    'interest': 'Juros e Encargos',
    'financing interest': 'Juros de Financiamento',
    'tax on financial operations': 'Impostos e IOF',
    'taxes': 'Impostos e Taxas',
    'bank fees': 'Tarifas Bancárias',
    'credit card fees': 'Anuidade e Tarifas de Cartão',
    'account fees': 'Tarifas de Conta',
    'digital services': 'Serviços Digitais',
    'telecommunications': 'Internet e Telefonia',
    'internet': 'Internet e Telefonia',
    'mobile': 'Telefonia Móvel',
    'cable tv': 'TV e Streaming',
    'food and drinks': 'Alimentação e Delivery',
    'eating out': 'Restaurantes e Bares',
    'restaurants': 'Restaurantes e Bares',
    'food delivery': 'Delivery de Comida',
    'supermarket': 'Supermercado',
    'groceries': 'Supermercado',
    'bakery': 'Padaria e Café',
    'shopping': 'Compras',
    'online shopping': 'Compras Online',
    'electronics': 'Eletrônicos',
    'clothing': 'Vestuário e Moda',
    'apparel': 'Vestuário e Moda',
    'bookstore': 'Livraria e Papelaria',
    'department store': 'Loja de Departamento',
    'kids and toys': 'Artigos Infantis',
    'pet supplies and vet': 'Pets e Veterinário',
    'pets': 'Pets e Veterinário',
    'gyms and fitness centers': 'Academia e Bem-Estar',
    'fitness': 'Academia e Bem-Estar',
    'sports': 'Esporte e Lazer',
    'wellness and beauty': 'Beleza e Cuidados Pessoais',
    'pharmacy': 'Farmácia',
    'healthcare': 'Saúde e Consultas',
    'medical': 'Saúde e Consultas',
    'dentist': 'Odontologia',
    'hospital': 'Hospital e Laboratório',
    'transportation': 'Transporte e Mobilidade',
    'taxi and ride-sharing': 'Apps de Mobilidade (Uber/99)',
    'public transit': 'Transporte Público',
    'automotive': 'Automotivo e Manutenção',
    'gas stations': 'Combustível e Postos',
    'fuel': 'Combustível e Postos',
    'parking': 'Estacionamento',
    'tolls': 'Pedágio e Tags',
    'travel': 'Viagens e Turismo',
    'accommodation': 'Hospedagem e Hotéis',
    'airline': 'Passagens Aéreas',
    'bus tickets': 'Passagens Rodoviárias',
    'education': 'Educação e Cursos',
    'university': 'Faculdade e Ensino',
    'school': 'Escola e Educação',
    'housing': 'Moradia e Condomínio',
    'rent': 'Aluguel e Moradia',
    'utilities': 'Contas de Consumo',
    'electricity': 'Energia Elétrica',
    'water': 'Água e Saneamento',
    'gas': 'Gás',
    'houseware': 'Casa e Decoração',
    'maintenance': 'Manutenção Residencial',
    'insurance': 'Seguros',
    'life insurance': 'Seguro de Vida',
    'car insurance': 'Seguro Auto',
    'home insurance': 'Seguro Residencial',
    'entertainment': 'Lazer e Entretenimento',
    'movies': 'Cinema e Streaming',
    'games': 'Jogos e Games',
    'music': 'Música e Shows',
    'bars and clubs': 'Bares e Vida Noturna',
    'services': 'Serviços',
    'legal and accounting': 'Contabilidade e Jurídico',
    'cleaning': 'Serviços Domésticos',
    'donations': 'Doações',
    'charity': 'Doações',
    'investments': 'Investimentos',
    'fixed income': 'Renda Fixa',
    'mutual funds': 'Fundos de Investimento',
    'equities': 'Ações e Renda Variável',
    'automatic investment': 'Investimento Automático',
    'proceeds interests and dividends': 'Rendimentos e Dividendos',
    'dividends': 'Dividendos',
    'salary': 'Salário e Renda',
    'payroll': 'Salário e Renda',
    'income': 'Renda e Recebimentos',
    'entrepreneurial activities': 'Receita Profissional',
    'government aid': 'Benefícios Sociais',
    'retirement': 'Aposentadoria e Previdência',
    'gambling': 'Apostas e Loteria',
    'other': 'Outros',
    'others': 'Outros',
};

/**
 * Traduz qualquer categoria da Pluggy do inglês para o português.
 */
export function translatePluggyCategory(
    rawCategory?: string | null,
    cleanDescription?: string | null,
    isInternalTransfer?: boolean,
    isRefund?: boolean
): string {
    if (isRefund) return 'Estorno / Reembolso';
    if (isInternalTransfer) {
        const lowerCat = (rawCategory || '').toLowerCase().trim();
        if (lowerCat === 'credit card payment' || (cleanDescription || '').toLowerCase().includes('fatura')) {
            return 'Pagamento de Fatura';
        }
        return 'Transferência Própria';
    }

    if (rawCategory) {
        const normalized = rawCategory.toLowerCase().trim();
        if (PLUGGY_CATEGORY_PT_MAP[normalized]) {
            return PLUGGY_CATEGORY_PT_MAP[normalized];
        }

        // Busca parcial inteligente
        for (const [enKey, ptVal] of Object.entries(PLUGGY_CATEGORY_PT_MAP)) {
            if (normalized.includes(enKey)) {
                return ptVal;
            }
        }
    }

    // Inferência por descrição limpa se a categoria vier vazia ou "Other"
    const desc = (cleanDescription || '').toLowerCase();
    if (desc.includes('ifood') || desc.includes('rappi') || desc.includes('restaurante') || desc.includes('lanchonete') || desc.includes('padaria') || desc.includes('burger')) {
        return 'Alimentação e Delivery';
    }
    if (desc.includes('uber') || desc.includes('99') || desc.includes('posto') || desc.includes('combustivel') || desc.includes('estacionamento') || desc.includes('sem parar') || desc.includes('veloe')) {
        return 'Transporte e Mobilidade';
    }
    if (desc.includes('spotify') || desc.includes('google') || desc.includes('youtube') || desc.includes('netflix') || desc.includes('apple') || desc.includes('meli+') || desc.includes('amazon prime')) {
        return 'Serviços Digitais';
    }
    if (desc.includes('wellhub') || desc.includes('gympass') || desc.includes('smartfit') || desc.includes('bluefit') || desc.includes('academia')) {
        return 'Academia e Bem-Estar';
    }
    if (desc.includes('supermercado') || desc.includes('atacadao') || desc.includes('assai') || desc.includes('carrefour') || desc.includes('pao de acucar') || desc.includes('mercado')) {
        return 'Supermercado';
    }
    if (desc.includes('farmacia') || desc.includes('drogaria') || desc.includes('droga raia') || desc.includes('drogasil') || desc.includes('pague menos') || desc.includes('panvel')) {
        return 'Saúde e Farmácia';
    }
    if (desc.includes('pix para') || desc.includes('pix de')) {
        return 'Pix';
    }

    if (rawCategory && rawCategory.trim()) {
        // Se já estiver em português, mantém
        return rawCategory.trim();
    }

    return 'Outros';
}

function toTitleCasePt(str: string): string {
    const lowerWords = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'no', 'na', 'por']);
    return str
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((word, index) => {
            if (word === 's.a.' || word === 's/a' || word === 'sa') return 'S.A.';
            if (word === 'ltda' || word === 'ltda.') return 'Ltda';
            if (word === 'me' || word === 'mei') return word.toUpperCase();
            if (word === 'pix') return 'Pix';
            if (word === 'cdb' || word === 'rdb' || word === 'iof' || word === 'ted') return word.toUpperCase();
            if (index > 0 && lowerWords.has(word)) return word;
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}

function normalizeComparisonName(name?: string | null): string {
    if (!name) return '';
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isSameHolderPerson(
    partyName?: string | null,
    partyDoc?: string | null,
    holderNames?: string[],
    holderDocs?: string[]
): boolean {
    if (partyDoc && holderDocs && holderDocs.length > 0) {
        const cleanPartyDoc = partyDoc.replace(/\D/g, '');
        if (cleanPartyDoc.length >= 11) {
            for (const hDoc of holderDocs) {
                const cleanHDoc = hDoc.replace(/\D/g, '');
                if (cleanHDoc && cleanHDoc === cleanPartyDoc) {
                    return true;
                }
            }
        }
    }

    if (partyName && holderNames && holderNames.length > 0) {
        const normParty = normalizeComparisonName(partyName);
        if (!normParty || normParty.length < 5) return false;
        const partyTokens = normParty.split(' ').filter((t) => t.length > 2);
        if (partyTokens.length < 2) return false;

        for (const hName of holderNames) {
            const normHolder = normalizeComparisonName(hName);
            if (!normHolder) continue;
            if (normParty === normHolder) return true;

            const holderTokens = normHolder.split(' ').filter((t) => t.length > 2);
            if (holderTokens.length >= 2) {
                // Primeiro e último nome iguais e pelo menos 2 tokens em comum
                const firstMatch = partyTokens[0] === holderTokens[0];
                const overlap = partyTokens.filter((t) => holderTokens.includes(t));
                if (firstMatch && overlap.length >= 2) {
                    return true;
                }
            }
        }
    }

    return false;
}

/**
 * Limpa e enriquece o nome da transação para nunca exibir apenas "Pix enviado", "Transferência recebida"
 * ou prefixos sujos de maquininhas ("Ifd*", "Dm*Spotify", "Mp *Melimais", etc.).
 */
export function cleanTransactionDescription(tx: PluggyTransactionRaw): string {
    const raw = (tx.description || tx.descriptionRaw || 'Transação').trim();
    const lowerRaw = raw.toLowerCase();

    const receiverName = tx.paymentData?.receiver?.name?.trim() || null;
    const payerName = tx.paymentData?.payer?.name?.trim() || null;
    const reason = tx.paymentData?.reason?.trim() || null;
    const merchantName = tx.merchant?.name?.trim() || tx.merchant?.businessName?.trim() || null;

    // 1. Decodificação prioritária de prefixos conhecidos de adquirentes e serviços digitais
    if (/^(dm|dl|ebanx)\s*\*\s*spotify/i.test(raw) || lowerRaw.includes('spotify')) {
        return 'Spotify';
    }
    if (lowerRaw.includes('google one')) {
        return 'Google One';
    }
    if (/^(dl\s*\*\s*)?google\s*youtube/i.test(raw) || lowerRaw.includes('youtube premium') || lowerRaw.includes('youtube.com')) {
        return 'YouTube (Google)';
    }
    if (/^(dl\s*\*\s*)?google\b/i.test(raw)) {
        const sub = raw.replace(/^(dl\s*\*\s*)?google\s*\*?\s*/i, '').replace(/\s+sao paulo.*$/i, '').trim();
        return sub && sub.toLowerCase() !== 'google' ? `Google • ${toTitleCasePt(sub)}` : 'Google Services';
    }
    if (lowerRaw.includes('apple.com/bill') || lowerRaw.includes('apple combill') || lowerRaw.includes('itunes.com')) {
        return 'Apple Services';
    }
    if (lowerRaw.includes('wellhub') || lowerRaw.includes('gympass')) {
        return 'Wellhub (Gympass)';
    }
    if (lowerRaw.includes('ifood club') || /ifd\s*\*\s*ifood\s*club/i.test(raw)) {
        return 'iFood Club';
    }
    if (/^(ifd|ifood)\s*\*/i.test(raw)) {
        const sub = raw
            .replace(/^(ifd|ifood)\s*\*\s*/i, '')
            .replace(/\s+\d{2}\/\d{2}$/, '')
            .replace(/\s+osasco.*$/i, '')
            .trim();
        if (!sub || sub.toLowerCase() === 'ifood' || sub.toLowerCase().includes('ifood com ag')) {
            return 'iFood';
        }
        return `iFood • ${toTitleCasePt(sub)}`;
    }
    if (/^uber\s*\*/i.test(raw) || lowerRaw.startsWith('uber ')) {
        if (lowerRaw.includes('eats')) return 'Uber Eats';
        if (lowerRaw.includes('one') || lowerRaw.includes('pass')) return 'Uber One';
        return 'Uber';
    }
    if (/^(99app|99pop|99)\s*\*/i.test(raw) || lowerRaw.startsWith('99app ') || lowerRaw.startsWith('99 pop')) {
        return '99 Mobilidade';
    }
    if (/^mp\s*\*\s*melimais/i.test(raw) || lowerRaw.includes('melimais')) {
        return 'Meli+ (Mercado Livre)';
    }
    if (/^(mp|mercadopago|mercado\s*pago)\s*\*/i.test(raw)) {
        const sub = raw.replace(/^(mp|mercadopago|mercado\s*pago)\s*\*\s*/i, '').trim();
        return sub ? `Mercado Pago • ${toTitleCasePt(sub)}` : 'Mercado Pago';
    }
    if (/^(pag|pagseguro)\s*\*/i.test(raw)) {
        const sub = raw.replace(/^(pag|pagseguro)\s*\*\s*/i, '').trim();
        return sub ? `PagSeguro • ${toTitleCasePt(sub)}` : 'PagSeguro';
    }
    if (lowerRaw.includes('netflix')) {
        return 'Netflix';
    }
    if (lowerRaw.includes('amazon prime') || lowerRaw.includes('amazonprime')) {
        return 'Amazon Prime';
    }
    if (lowerRaw.includes('openai') || lowerRaw.includes('chatgpt')) {
        return 'ChatGPT Plus (OpenAI)';
    }

    // 2. Pagamento de Fatura de Cartão
    if (
        lowerRaw === 'pagamento recebido' ||
        lowerRaw.includes('pagamento de fatura') ||
        lowerRaw.includes('pagamento fatura') ||
        lowerRaw.includes('pagamento debito automatico')
    ) {
        return 'Pagamento de Fatura do Cartão';
    }

    // 3. Enriquecimento de Pix e Transferências Genéricas com Nome do Recebedor / Pagador
    const isGenericPixOrTransfer =
        lowerRaw === 'pix enviado' ||
        lowerRaw === 'pix recebido' ||
        lowerRaw === 'transferencia enviada' ||
        lowerRaw === 'transferência enviada' ||
        lowerRaw === 'transferencia recebida' ||
        lowerRaw === 'transferência recebida' ||
        lowerRaw === 'transferência recebida pelo pix' ||
        lowerRaw === 'transferência enviada pelo pix' ||
        lowerRaw === 'pagamento efetuado' ||
        lowerRaw === 'ted enviada' ||
        lowerRaw === 'ted recebida' ||
        lowerRaw.startsWith('pix enviado ') ||
        lowerRaw.startsWith('pix recebido ') ||
        lowerRaw.startsWith('remessa pix') ||
        lowerRaw.startsWith('recebimento pix');

    const isDebit = (tx.type || '').toUpperCase() === 'DEBIT' || tx.amount < 0;

    if (isGenericPixOrTransfer || lowerRaw.includes('pix')) {
        if (isDebit && receiverName) {
            const cleanRec = toTitleCasePt(receiverName);
            return reason ? `Pix para ${cleanRec} (${reason})` : `Pix para ${cleanRec}`;
        }
        if (!isDebit && payerName) {
            const cleanPay = toTitleCasePt(payerName);
            return reason ? `Pix de ${cleanPay} (${reason})` : `Pix de ${cleanPay}`;
        }
        // Quando a própria descrição contém o nome após hífen ou barra (ex: "Pix enviado - João Silva")
        const parts = raw.split(/\s*[-–|:]\s*/);
        if (parts.length >= 2 && parts[1].trim().length > 2) {
            const target = toTitleCasePt(parts.slice(1).join(' - ').trim());
            if (isDebit) return `Pix para ${target}`;
            return `Pix de ${target}`;
        }
    }

    // 4. Se merchant.businessName ou merchant.name existir e a descrição for código sujo
    if (merchantName && merchantName.length > 2 && !isGenericPixOrTransfer) {
        const normMerchant = merchantName.toLowerCase();
        if (!normMerchant.includes('pluggy') && normMerchant !== 'outros') {
            return toTitleCasePt(merchantName);
        }
    }

    // 5. Limpeza geral da descrição bruta (remover códigos de parcelas no final, sufixos BR/BRA e múltiplos espaços)
    let cleaned = raw
        .replace(/\s*-\s*parcela\s*\d{1,2}\/\d{1,2}/i, '')
        .replace(/\s+\d{1,2}\/\d{1,2}$/, '')
        .replace(/\s+(sao paulo|rio de janeiro|curitiba|belo horizonte|brasilia|osasco|barueri|campinas)\s+(br|bra)$/i, '')
        .replace(/\s+(br|bra)$/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    if (!cleaned) cleaned = raw;

    // Se estiver 100% em maiúsculas, converte para Title Case elegante
    if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
        return toTitleCasePt(cleaned);
    }

    return cleaned;
}

/**
 * Extrai metadados de parcelamento combinando creditCardMetadata da Pluggy + Regex na descrição
 */
export function extractInstallmentMetadata(
    tx: PluggyTransactionRaw,
    isCreditCardAccount: boolean,
    absAmount: number
): {
    installmentNumber: number | null;
    totalInstallments: number | null;
    totalPurchaseAmount: number | null;
} {
    const metaInst = tx.creditCardMetadata?.installmentNumber || null;
    const metaTotal = tx.creditCardMetadata?.totalInstallments || null;
    const metaTotalAmount = tx.creditCardMetadata?.totalAmount || null;

    if (metaTotal && metaTotal >= 1) {
        const inst = metaInst && metaInst >= 1 ? metaInst : 1;
        const totalPurchase = metaTotalAmount && metaTotalAmount > 0 ? metaTotalAmount : Number((absAmount * metaTotal).toFixed(2));
        return {
            installmentNumber: inst,
            totalInstallments: metaTotal,
            totalPurchaseAmount: totalPurchase,
        };
    }

    // Regex na descrição original: ex. "3/10", "02/12", "Parcela 4 de 10"
    const rawDesc = `${tx.description || ''} ${tx.descriptionRaw || ''}`;
    const explicitMatch = rawDesc.match(/(?:parc(?:ela)?\.?\s*)(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i);
    if (explicitMatch) {
        const inst = parseInt(explicitMatch[1], 10);
        const total = parseInt(explicitMatch[2], 10);
        if (inst >= 1 && total >= 2 && inst <= total && total <= 72) {
            return {
                installmentNumber: inst,
                totalInstallments: total,
                totalPurchaseAmount: Number((absAmount * total).toFixed(2)),
            };
        }
    }

    if (isCreditCardAccount) {
        const slashMatch = rawDesc.match(/\b(\d{1,2})\/(\d{1,2})\b/);
        if (slashMatch) {
            const inst = parseInt(slashMatch[1], 10);
            const total = parseInt(slashMatch[2], 10);
            if (inst >= 1 && total >= 2 && inst <= total && total <= 48) {
                return {
                    installmentNumber: inst,
                    totalInstallments: total,
                    totalPurchaseAmount: Number((absAmount * total).toFixed(2)),
                };
            }
        }
        // Em compras no cartão sem parcelas explícitas, é compra à vista (1x)
        return {
            installmentNumber: 1,
            totalInstallments: 1,
            totalPurchaseAmount: absAmount,
        };
    }

    return {
        installmentNumber: null,
        totalInstallments: null,
        totalPurchaseAmount: null,
    };
}

/**
 * Detecta se a transação é uma assinatura/recorrência real do usuário
 */
export function detectSubscription(
    tx: PluggyTransactionRaw,
    cleanDescription: string,
    categoryOriginal?: string | null,
    totalInstallments?: number | null
): boolean {
    // Parcelamentos de longo prazo (ex: 10x) não são assinaturas mensais contínuas
    if (totalInstallments && totalInstallments > 1) {
        return false;
    }

    const cat = (categoryOriginal || '').toLowerCase().trim();
    const desc = `${cleanDescription} ${tx.description || ''}`.toLowerCase();

    if (cat === 'digital services' || cat === 'gyms and fitness centers' || cat === 'cable tv') {
        return true;
    }

    const subscriptionKeywords = [
        'spotify',
        'google one',
        'youtube',
        'netflix',
        'wellhub',
        'gympass',
        'smartfit',
        'bluefit',
        'ifood club',
        'meli+',
        'melimais',
        'amazon prime',
        'apple services',
        'apple.com/bill',
        'icloud',
        'chatgpt',
        'openai',
        'claude',
        'disney',
        'hbo',
        'max.com',
        'globoplay',
        'canva',
        'adobe',
        'microsoft 365',
        'xbox',
        'playstation',
        'uber one',
        'rappi prime',
        'sem parar',
        'veloe',
        'conectcar',
        'assinatura',
        'mensalidade',
    ];

    return subscriptionKeywords.some((kw) => desc.includes(kw));
}

/**
 * Motor Principal de Conciliação e Enriquecimento de Transações Open Finance
 */
export function enrichPluggyTransaction(params: {
    tx: PluggyTransactionRaw;
    accountType: string; // 'BANK' | 'CREDIT'
    accountSubtype?: string | null;
    holderNames?: string[];
    holderDocuments?: string[];
}): EnrichedTransaction {
    const { tx, accountType, holderNames = [], holderDocuments = [] } = params;
    const isCreditCardAccount = accountType.toUpperCase() === 'CREDIT' || (params.accountSubtype || '').toUpperCase() === 'CREDIT_CARD';

    const rawDescription = (tx.description || tx.descriptionRaw || 'Transação').trim();
    const lowerRaw = rawDescription.toLowerCase();
    const categoryOriginal = tx.category || null;
    const lowerCat = (categoryOriginal || '').toLowerCase().trim();

    const payerName = tx.paymentData?.payer?.name?.trim() || null;
    const receiverName = tx.paymentData?.receiver?.name?.trim() || null;
    const payerDoc = tx.paymentData?.payer?.documentNumber?.value || null;
    const receiverDoc = tx.paymentData?.receiver?.documentNumber?.value || null;
    const paymentReason = tx.paymentData?.reason?.trim() || null;

    const absAmount = Math.abs(Number(tx.amount) || 0);
    const rawSignNegative = Number(tx.amount) < 0;
    const rawTypeUpper = (tx.type || '').toUpperCase();

    // 1. Verificar se é Pagamento de Fatura ou Transferência Interna / Mesma Titularidade
    const isBillPaymentCategoryOrText =
        lowerCat === 'credit card payment' ||
        lowerRaw === 'pagamento recebido' ||
        lowerRaw.includes('pagamento de fatura') ||
        lowerRaw.includes('pagamento fatura') ||
        lowerRaw.includes('pagamento debito automatico') ||
        lowerRaw.includes('fatura cartao') ||
        lowerRaw.includes('fatura cartão');

    const isSamePersonCategoryOrText =
        lowerCat === 'same person transfer' ||
        lowerCat === 'transfer - internal' ||
        lowerCat === 'internal transfer' ||
        lowerCat === 'automatic investment' ||
        lowerRaw.includes('aplicacao rdb') ||
        lowerRaw.includes('aplicação rdb') ||
        lowerRaw.includes('resgate rdb') ||
        lowerRaw.includes('guardar dinheiro') ||
        lowerRaw.includes('resgate dinheiro guardado') ||
        lowerRaw.includes('transferencia mesma titularidade') ||
        lowerRaw.includes('transferência mesma titularidade');

    const isSameHolderParty =
        isSameHolderPerson(receiverName, receiverDoc, holderNames, holderDocuments) &&
        isSameHolderPerson(payerName, payerDoc, holderNames, holderDocuments);

    // Também se for transferência enviada para o próprio CPF/nome ou recebida do próprio CPF/nome
    const isTransferToSelf =
        (lowerCat.includes('transfer') || lowerCat.includes('pix') || lowerRaw.includes('pix') || lowerRaw.includes('ted')) &&
        ((rawTypeUpper === 'DEBIT' && isSameHolderPerson(receiverName, receiverDoc, holderNames, holderDocuments)) ||
            (rawTypeUpper === 'CREDIT' && isSameHolderPerson(payerName, payerDoc, holderNames, holderDocuments)));

    const isInternalTransfer = Boolean(
        isBillPaymentCategoryOrText || isSamePersonCategoryOrText || isSameHolderParty || isTransferToSelf
    );

    // 2. Determinar se é Estorno / Reembolso no Cartão de Crédito e normalizar sinal + tipo
    let isRefund = false;
    let normalizedType: 'DEBIT' | 'CREDIT' = 'DEBIT';
    let normalizedAmount = -absAmount;
    let operationType: EnrichedTransaction['operationType'] = 'OTHER';

    if (isCreditCardAccount) {
        if (isBillPaymentCategoryOrText) {
            // Pagamento da fatura recebido no cartão
            normalizedType = 'CREDIT';
            normalizedAmount = absAmount;
            operationType = 'BILL_PAYMENT';
        } else if (
            rawSignNegative ||
            rawTypeUpper === 'CREDIT' ||
            lowerRaw.includes('estorno') ||
            lowerRaw.includes('reembolso') ||
            lowerRaw.includes('credito de parcelamento') ||
            lowerRaw.includes('crédito de parcelamento') ||
            lowerRaw.includes('desconto antecipacao') ||
            lowerRaw.includes('desconto antecipação')
        ) {
            // Estorno / Reembolso no cartão de crédito (abatimento na fatura, nunca receita de conta corrente!)
            isRefund = true;
            normalizedType = 'CREDIT';
            normalizedAmount = absAmount;
            operationType = 'REFUND';
        } else {
            // Compra normal no cartão de crédito (na Pluggy vem com amount > 0 e type = 'DEBIT')
            normalizedType = 'DEBIT';
            normalizedAmount = -absAmount;
            operationType = 'CREDIT_CARD';
        }
    } else {
        // Conta Corrente / Poupança (BANK)
        const isCredit = rawTypeUpper === 'CREDIT' || (!rawTypeUpper && Number(tx.amount) > 0);
        normalizedType = isCredit ? 'CREDIT' : 'DEBIT';
        normalizedAmount = isCredit ? absAmount : -absAmount;

        if (lowerRaw.includes('estorno') || lowerRaw.includes('reembolso') || lowerRaw.includes('devolucao pix')) {
            isRefund = true;
            operationType = 'REFUND';
        } else if (isBillPaymentCategoryOrText) {
            operationType = 'BILL_PAYMENT';
        } else if (isInternalTransfer) {
            operationType = 'INTERNAL_TRANSFER';
        } else if (
            (tx.operationType || '').toUpperCase().includes('PIX') ||
            lowerCat.includes('pix') ||
            lowerRaw.includes('pix')
        ) {
            operationType = 'PIX';
        } else if ((tx.operationType || '').toUpperCase().includes('TED') || lowerCat.includes('ted') || lowerRaw.includes('ted')) {
            operationType = 'TED';
        } else if (lowerCat.includes('bank slip') || lowerRaw.includes('boleto')) {
            operationType = 'BOLETO';
        } else {
            operationType = 'DEBIT_CARD';
        }
    }

    const cleanDesc = cleanTransactionDescription({
        ...tx,
        type: normalizedType,
        amount: normalizedAmount,
    });

    const { installmentNumber, totalInstallments, totalPurchaseAmount } = extractInstallmentMetadata(
        tx,
        isCreditCardAccount && !isBillPaymentCategoryOrText && !isRefund,
        absAmount
    );

    const isSubscription =
        !isInternalTransfer &&
        !isRefund &&
        normalizedType === 'DEBIT' &&
        detectSubscription(tx, cleanDesc, categoryOriginal, totalInstallments);

    const categoryPt = translatePluggyCategory(categoryOriginal, cleanDesc, isInternalTransfer, isRefund);

    const executedDateObj = tx.date ? new Date(tx.date) : new Date();
    const executedAt = executedDateObj.toISOString();
    const dateOnly = executedAt.split('T')[0];

    return {
        pluggyTransactionId: tx.id,
        cleanDescription: cleanDesc,
        rawDescription,
        amount: normalizedAmount,
        type: normalizedType,
        categoryPt,
        categoryOriginal,
        operationType,
        isInternalTransfer,
        isRefund,
        isSubscription,
        installmentNumber,
        totalInstallments,
        totalPurchaseAmount,
        merchantName: tx.merchant?.name || null,
        merchantBusinessName: tx.merchant?.businessName || null,
        merchantCnpj: tx.merchant?.cnpj || null,
        payerName,
        receiverName,
        paymentReason,
        billId: tx.creditCardMetadata?.billId || null,
        executedAt,
        dateOnly,
    };
}
