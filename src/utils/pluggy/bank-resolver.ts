export type BankSlug =
    | 'nubank'
    | 'itau'
    | 'santander'
    | 'inter'
    | 'caixa'
    | 'mercadopago'
    | 'bradesco'
    | 'bb'
    | 'c6'
    | 'btg'
    | 'safra'
    | 'picpay'
    | 'xp'
    | 'rico'
    | 'sicredi'
    | 'sicoob'
    | 'generic';

export interface BankCatalogEntry {
    slug: BankSlug;
    name: string;
    shortName: string;
    compeCodes: string[];
    ispbCodes: string[];
    primaryColor: string;
    bgColor: string;
    textColor: string;
    logoPath: string;
}

export const BANK_CATALOG: Record<BankSlug, BankCatalogEntry> = {
    nubank: {
        slug: 'nubank',
        name: 'Nubank',
        shortName: 'Nubank',
        compeCodes: ['260'],
        ispbCodes: ['18236120'],
        primaryColor: '#820AD1',
        bgColor: 'rgba(130, 10, 209, 0.14)',
        textColor: '#A855F7',
        logoPath: '/banks/nubank.svg',
    },
    itau: {
        slug: 'itau',
        name: 'Itaú',
        shortName: 'Itaú',
        compeCodes: ['341'],
        ispbCodes: ['60701190'],
        primaryColor: '#FF6200',
        bgColor: 'rgba(255, 98, 0, 0.14)',
        textColor: '#FB923C',
        logoPath: '/banks/itau.svg',
    },
    santander: {
        slug: 'santander',
        name: 'Santander',
        shortName: 'Santander',
        compeCodes: ['033', '33'],
        ispbCodes: ['90400888'],
        primaryColor: '#EC0000',
        bgColor: 'rgba(236, 0, 0, 0.14)',
        textColor: '#F87171',
        logoPath: '/banks/santander.svg',
    },
    inter: {
        slug: 'inter',
        name: 'Banco Inter',
        shortName: 'Inter',
        compeCodes: ['077', '77'],
        ispbCodes: ['00416968'],
        primaryColor: '#FF7A00',
        bgColor: 'rgba(255, 122, 0, 0.14)',
        textColor: '#FB923C',
        logoPath: '/banks/inter.svg',
    },
    caixa: {
        slug: 'caixa',
        name: 'Caixa Econômica Federal',
        shortName: 'Caixa',
        compeCodes: ['104'],
        ispbCodes: ['00360305'],
        primaryColor: '#005CA9',
        bgColor: 'rgba(0, 92, 169, 0.15)',
        textColor: '#38BDF8',
        logoPath: '/banks/caixa.svg',
    },
    mercadopago: {
        slug: 'mercadopago',
        name: 'Mercado Pago',
        shortName: 'Mercado Pago',
        compeCodes: ['323'],
        ispbCodes: ['10573521'],
        primaryColor: '#009EE3',
        bgColor: 'rgba(0, 158, 227, 0.15)',
        textColor: '#38BDF8',
        logoPath: '/banks/mercadopago.svg',
    },
    bradesco: {
        slug: 'bradesco',
        name: 'Bradesco',
        shortName: 'Bradesco',
        compeCodes: ['237'],
        ispbCodes: ['60746948'],
        primaryColor: '#CC092F',
        bgColor: 'rgba(204, 9, 47, 0.15)',
        textColor: '#F43F5E',
        logoPath: '/banks/bradesco.svg',
    },
    bb: {
        slug: 'bb',
        name: 'Banco do Brasil',
        shortName: 'Banco do Brasil',
        compeCodes: ['001', '1'],
        ispbCodes: ['00000000'],
        primaryColor: '#F8D117',
        bgColor: 'rgba(248, 209, 23, 0.15)',
        textColor: '#FACC15',
        logoPath: '/banks/bb.svg',
    },
    c6: {
        slug: 'c6',
        name: 'C6 Bank',
        shortName: 'C6 Bank',
        compeCodes: ['336'],
        ispbCodes: ['31872495'],
        primaryColor: '#242424',
        bgColor: 'rgba(161, 161, 170, 0.14)',
        textColor: '#E4E4E7',
        logoPath: '/banks/c6.svg',
    },
    btg: {
        slug: 'btg',
        name: 'BTG Pactual',
        shortName: 'BTG Pactual',
        compeCodes: ['208'],
        ispbCodes: ['30306294'],
        primaryColor: '#001E62',
        bgColor: 'rgba(30, 64, 175, 0.15)',
        textColor: '#60A5FA',
        logoPath: '/banks/btg.svg',
    },
    safra: {
        slug: 'safra',
        name: 'Banco Safra',
        shortName: 'Safra',
        compeCodes: ['422'],
        ispbCodes: ['58160789'],
        primaryColor: '#D4AF37',
        bgColor: 'rgba(212, 175, 55, 0.15)',
        textColor: '#FBBF24',
        logoPath: '/banks/safra.svg',
    },
    picpay: {
        slug: 'picpay',
        name: 'PicPay',
        shortName: 'PicPay',
        compeCodes: ['380'],
        ispbCodes: ['22896431'],
        primaryColor: '#11C76F',
        bgColor: 'rgba(17, 199, 111, 0.15)',
        textColor: '#34D399',
        logoPath: '/banks/picpay.svg',
    },
    xp: {
        slug: 'xp',
        name: 'XP Investimentos',
        shortName: 'XP',
        compeCodes: ['102', '348'],
        ispbCodes: ['02332886'],
        primaryColor: '#F59E0B',
        bgColor: 'rgba(245, 158, 11, 0.15)',
        textColor: '#FBBF24',
        logoPath: '/banks/xp.svg',
    },
    rico: {
        slug: 'rico',
        name: 'Rico Investimentos',
        shortName: 'Rico',
        compeCodes: ['349'],
        ispbCodes: [],
        primaryColor: '#FF5500',
        bgColor: 'rgba(255, 85, 0, 0.15)',
        textColor: '#FB923C',
        logoPath: '/banks/rico.svg',
    },
    sicredi: {
        slug: 'sicredi',
        name: 'Sicredi',
        shortName: 'Sicredi',
        compeCodes: ['748'],
        ispbCodes: ['01181521'],
        primaryColor: '#3FA110',
        bgColor: 'rgba(63, 161, 16, 0.15)',
        textColor: '#4ADE80',
        logoPath: '/banks/sicredi.svg',
    },
    sicoob: {
        slug: 'sicoob',
        name: 'Sicoob',
        shortName: 'Sicoob',
        compeCodes: ['756'],
        ispbCodes: ['02038232'],
        primaryColor: '#003641',
        bgColor: 'rgba(0, 160, 145, 0.15)',
        textColor: '#2DD4BF',
        logoPath: '/banks/sicoob.svg',
    },
    generic: {
        slug: 'generic',
        name: 'Instituição Conectada',
        shortName: 'Banco',
        compeCodes: [],
        ispbCodes: [],
        primaryColor: '#10B981',
        bgColor: 'rgba(16, 185, 129, 0.12)',
        textColor: '#34D399',
        logoPath: '/banks/generic.svg',
    },
};

export interface PluggyAccountRaw {
    id?: string;
    type?: string;
    subtype?: string;
    name?: string;
    marketingName?: string | null;
    number?: string | null;
    balance?: number;
    currencyCode?: string;
    bankData?: {
        transferNumber?: string | null;
        closingBalance?: number | null;
        automaticallyInvestedBalance?: number | null;
    } | null;
    creditData?: {
        level?: string | null;
        brand?: string | null;
        balanceCloseDate?: string | null;
        balanceDueDate?: string | null;
        availableCreditLimit?: number | null;
        creditLimit?: number | null;
        minimumPayment?: number | null;
    } | null;
}

function normalizeStr(input?: string | null): string {
    if (!input) return '';
    return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Extrai código COMPE (3 dígitos) ou ISPB (8 dígitos) de um transferNumber da Pluggy
 * Ex: "260/0001/12345-6" -> "260"
 */
export function resolveBankByTransferNumber(transferNumber?: string | null): BankCatalogEntry | null {
    if (!transferNumber) return null;
    const cleaned = transferNumber.trim();
    const firstPart = cleaned.split(/[/\s-]/)[0]?.replace(/\D/g, '') || '';

    if (!firstPart) return null;

    for (const entry of Object.values(BANK_CATALOG)) {
        if (entry.slug === 'generic') continue;
        if (entry.compeCodes.includes(firstPart) || entry.compeCodes.includes(firstPart.padStart(3, '0'))) {
            return entry;
        }
        if (entry.ispbCodes.includes(firstPart)) {
            return entry;
        }
    }

    return null;
}

/**
 * Identifica um banco a partir de um texto (nome da conta, marketingName, conector, emissor etc.)
 */
export function resolveInstitutionFromText(rawText?: string | null): BankCatalogEntry | null {
    const text = normalizeStr(rawText);
    if (!text || text === 'pluggy' || text === 'meupluggy' || text === 'meu pluggy') {
        return null;
    }

    // 1. Nubank
    if (
        text.includes('nu pagamentos') ||
        text.includes('nubank') ||
        text.includes('roxinho') ||
        text.includes('ultravioleta') ||
        text.includes('nu invest')
    ) {
        return BANK_CATALOG.nubank;
    }

    // 2. Banco Inter
    if (
        text.includes('banco inter') ||
        text === 'inter' ||
        text.startsWith('inter ') ||
        text.endsWith(' inter') ||
        text.includes('intermedium')
    ) {
        return BANK_CATALOG.inter;
    }

    // 3. Itaú
    if (
        text.includes('itau') ||
        text.includes('uniclass') ||
        text.includes('personnalite') ||
        text.includes('hipercard') ||
        text.includes('iconta') ||
        text.includes('azul itau') ||
        text.includes('latam pass itau') ||
        text.includes('unibanco')
    ) {
        return BANK_CATALOG.itau;
    }

    // 4. Santander
    if (text.includes('santander') || text.includes('sx ') || text.includes('select')) {
        return BANK_CATALOG.santander;
    }

    // 5. Caixa Econômica Federal
    if (
        text.includes('caixa economica') ||
        text === 'caixa' ||
        text.startsWith('caixa ') ||
        text.includes('cef') ||
        text.includes('caixa tem')
    ) {
        return BANK_CATALOG.caixa;
    }

    // 6. Mercado Pago
    if (text.includes('mercado pago') || text.includes('mercadopago') || text.includes('mercado livre')) {
        return BANK_CATALOG.mercadopago;
    }

    // 7. Bradesco
    if (text.includes('bradesco') || text.includes('next ')) {
        return BANK_CATALOG.bradesco;
    }

    // 8. Banco do Brasil
    if (text.includes('banco do brasil') || text === 'bb' || text.startsWith('bb ') || text.includes('ourocard')) {
        return BANK_CATALOG.bb;
    }

    // 9. C6 Bank
    if (text.includes('c6 bank') || text.includes('c6bank') || text === 'c6' || text.startsWith('c6 ')) {
        return BANK_CATALOG.c6;
    }

    // 10. BTG Pactual
    if (text.includes('btg')) {
        return BANK_CATALOG.btg;
    }

    // 11. Safra
    if (text.includes('safra')) {
        return BANK_CATALOG.safra;
    }

    // 12. PicPay
    if (text.includes('picpay') || text.includes('pic pay')) {
        return BANK_CATALOG.picpay;
    }

    // 13. XP
    if (text.includes('xp investimentos') || text === 'xp' || text.startsWith('xp ')) {
        return BANK_CATALOG.xp;
    }

    // 14. Rico
    if (text.includes('rico')) {
        return BANK_CATALOG.rico;
    }

    // 15. Sicredi
    if (text.includes('sicredi')) {
        return BANK_CATALOG.sicredi;
    }

    // 16. Sicoob
    if (text.includes('sicoob')) {
        return BANK_CATALOG.sicoob;
    }

    return null;
}

/**
 * Motor Determinístico de Resolução da Instituição por item_id.
 * Analisa TODAS as contas (BANK e CREDIT), investimentos e metadados do conector em conjunto
 * para descobrir a verdadeira instituição financeira por trás do conector "MeuPluggy".
 */
export function resolveInstitutionForItem(params: {
    connectorName?: string | null;
    accounts?: PluggyAccountRaw[];
    investments?: Array<{ name?: string | null; issuer?: string | null }>;
    loans?: Array<{ productName?: string | null }>;
    fallbackProviderName?: string | null;
}): BankCatalogEntry {
    const accounts = params.accounts || [];

    // Passo 1: Verificar código COMPE/ISPB em bankData.transferNumber de qualquer conta do item_id
    for (const acc of accounts) {
        const byCompe = resolveBankByTransferNumber(acc.bankData?.transferNumber);
        if (byCompe) return byCompe;
    }

    // Passo 2: Analisar todas as contas do tipo BANK (onde normalmente está "Nu Pagamentos", "BANCO INTER", "CAIXA", "Santander", "Mercado Pago")
    const bankAccounts = accounts.filter((a) => (a.type || '').toUpperCase() === 'BANK');
    for (const acc of bankAccounts) {
        const byName = resolveInstitutionFromText(acc.name) || resolveInstitutionFromText(acc.marketingName);
        if (byName) return byName;
    }

    // Passo 3: Analisar todas as contas (incluindo cartões de crédito, ex: "Uniclass Mastercard", "Hipercard", "Azul Itau")
    for (const acc of accounts) {
        const byName = resolveInstitutionFromText(acc.name) || resolveInstitutionFromText(acc.marketingName);
        if (byName) return byName;
    }

    // Passo 4: Verificar conector oficial se não for MeuPluggy
    const byConnector = resolveInstitutionFromText(params.connectorName);
    if (byConnector) return byConnector;

    // Passo 5: Verificar emissores de investimentos do mesmo item_id (ex: "BANCO ITAU UNIBANCO", "Nu Financeira")
    if (params.investments) {
        for (const inv of params.investments) {
            const byInv = resolveInstitutionFromText(inv.issuer) || resolveInstitutionFromText(inv.name);
            if (byInv) return byInv;
        }
    }

    // Passo 6: Verificar fallback salvo anteriormente
    const byFallback = resolveInstitutionFromText(params.fallbackProviderName);
    if (byFallback) return byFallback;

    return BANK_CATALOG.generic;
}

/**
 * Formata de forma limpa e legível o nome do produto bancário (product_name),
 * evitando exibir apenas "GOLD" ou "Nu Pagamentos S.A." cru.
 */
export function resolveAccountProductDetails(
    acc: PluggyAccountRaw,
    institution: BankCatalogEntry
): {
    institutionName: string;
    institutionSlug: BankSlug;
    productName: string;
    subtype: 'CHECKING_ACCOUNT' | 'SAVINGS_ACCOUNT' | 'CREDIT_CARD';
    agencyNumber: string | null;
    accountNumber: string | null;
    transferNumber: string | null;
    cardBrand: string | null;
} {
    const rawType = (acc.type || 'BANK').toUpperCase();
    const rawSubtype = (acc.subtype || '').toUpperCase();

    let subtype: 'CHECKING_ACCOUNT' | 'SAVINGS_ACCOUNT' | 'CREDIT_CARD' = 'CHECKING_ACCOUNT';
    if (rawType === 'CREDIT' || rawSubtype === 'CREDIT_CARD') {
        subtype = 'CREDIT_CARD';
    } else if (rawSubtype === 'SAVINGS_ACCOUNT') {
        subtype = 'SAVINGS_ACCOUNT';
    } else {
        subtype = 'CHECKING_ACCOUNT';
    }

    // Extrair agência e conta se presentes em transferNumber (ex: "341/1234/56789-0")
    const transferNumber = acc.bankData?.transferNumber || null;
    let agencyNumber: string | null = null;
    let accountNumber: string | null = acc.number || null;

    if (transferNumber) {
        const parts = transferNumber.split('/').map((p) => p.trim());
        if (parts.length >= 3) {
            agencyNumber = parts[1] || null;
            accountNumber = accountNumber || parts[2] || null;
        } else if (parts.length === 2) {
            agencyNumber = parts[0] || null;
            accountNumber = accountNumber || parts[1] || null;
        }
    }

    const cardBrand = acc.creditData?.brand || null;
    const cardLevel = acc.creditData?.level || null;
    const rawName = (acc.name || acc.marketingName || '').trim();
    const normRawName = normalizeStr(rawName);

    let productName = rawName;

    if (subtype === 'CREDIT_CARD') {
        if (normRawName === 'gold' || normRawName === 'platinum' || normRawName === 'black' || normRawName === 'infinite') {
            const levelFormatted = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
            if (institution.slug === 'nubank' && normRawName === 'gold') {
                productName = `Cartão ${institution.shortName} Gold / Ultravioleta`;
            } else {
                productName = `Cartão ${institution.shortName}${cardBrand ? ` ${cardBrand}` : ''} ${levelFormatted}`;
            }
        } else if (normRawName.includes('uniclass')) {
            productName = `Itaú Uniclass${cardBrand ? ` ${cardBrand}` : ''}${cardLevel ? ` ${cardLevel}` : ''}`;
        } else if (normRawName.includes('hipercard')) {
            productName = `Hipercard Itaú${cardBrand ? ` ${cardBrand}` : ''}`;
        } else if (normRawName.includes('azul')) {
            productName = `Azul Itaú${cardBrand ? ` ${cardBrand}` : ''}${cardLevel ? ` ${cardLevel}` : ''}`;
        } else if (!normRawName.includes(normalizeStr(institution.shortName))) {
            productName = `${institution.shortName} • ${rawName}`;
        } else {
            productName = rawName;
        }
    } else if (subtype === 'SAVINGS_ACCOUNT') {
        productName = `Conta Poupança ${institution.shortName}`;
    } else {
        // CHECKING_ACCOUNT
        if (
            !rawName ||
            normRawName.includes('nu pagamentos') ||
            normRawName === 'banco inter' ||
            normRawName === 'caixa' ||
            normRawName === 'santander' ||
            normRawName === 'mercado pago'
        ) {
            productName = `Conta Corrente ${institution.shortName}`;
        } else if (normRawName === 'iconta') {
            productName = `iConta Corrente Itaú`;
        } else {
            productName = `Conta Corrente ${institution.shortName} (${rawName})`;
        }
    }

    return {
        institutionName: institution.name,
        institutionSlug: institution.slug,
        productName,
        subtype,
        agencyNumber,
        accountNumber,
        transferNumber,
        cardBrand,
    };
}

export function getBankCatalogBySlugOrName(slugOrName?: string | null): BankCatalogEntry {
    if (!slugOrName) return BANK_CATALOG.generic;
    const key = slugOrName.toLowerCase().trim() as BankSlug;
    if (BANK_CATALOG[key]) {
        return BANK_CATALOG[key];
    }
    const resolved = resolveInstitutionFromText(slugOrName);
    return resolved || BANK_CATALOG.generic;
}
