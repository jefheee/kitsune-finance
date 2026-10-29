/**
 * Motor Avançado de Resolução, Decodificação e Tradução Comercial de Transações
 * Integração com Simple Icons (3.000+ marcas globais) e Dicionário Heurístico Brasileiro
 */

export interface ResolvedMerchant {
    cleanName: string;
    originalQuery: string;
    category: string;
    simpleIconSlug: string | null;
    brandColor: string | null;
    operationTypeHint?: string;
    isDecodedStore: boolean;
}

// Mapeamento de Marcas Globais e Brasileiras frequentes para slugs do Simple Icons
const SIMPLE_ICONS_BRAND_MAP: Record<string, { slug: string; name: string; color: string; category: string }> = {
    // Delivery & Alimentação
    ifood: { slug: "ifood", name: "iFood", color: "#EA1D2C", category: "Alimentação e Delivery" },
    ifd: { slug: "ifood", name: "iFood", color: "#EA1D2C", category: "Alimentação e Delivery" },
    rappi: { slug: "rappi", name: "Rappi", color: "#FF441F", category: "Alimentação e Delivery" },
    ubereats: { slug: "ubereats", name: "Uber Eats", color: "#06C167", category: "Alimentação e Delivery" },
    mcdonalds: { slug: "mcdonalds", name: "McDonald's", color: "#FFBC0D", category: "Alimentação e Delivery" },
    burgerking: { slug: "burgerking", name: "Burger King", color: "#D62300", category: "Alimentação e Delivery" },
    subway: { slug: "subway", name: "Subway", color: "#008C15", category: "Alimentação e Delivery" },
    starbucks: { slug: "starbucks", name: "Starbucks", color: "#006241", category: "Alimentação e Delivery" },
    dominos: { slug: "dominos", name: "Domino's Pizza", color: "#0B648F", category: "Alimentação e Delivery" },
    pizzahut: { slug: "pizzahut", name: "Pizza Hut", color: "#EE3124", category: "Alimentação e Delivery" },
    habibs: { slug: "target", name: "Habib's", color: "#ED1C24", category: "Alimentação e Delivery" },
    cacaushow: { slug: "target", name: "Cacau Show", color: "#4A2618", category: "Alimentação e Delivery" },

    // Transporte & Mobilidade
    uber: { slug: "uber", name: "Uber", color: "#FFFFFF", category: "Transporte e Mobilidade" },
    "99app": { slug: "99", name: "99", color: "#FFCA00", category: "Transporte e Mobilidade" },
    "99": { slug: "99", name: "99", color: "#FFCA00", category: "Transporte e Mobilidade" },
    "99pop": { slug: "99", name: "99 Pop", color: "#FFCA00", category: "Transporte e Mobilidade" },
    semparar: { slug: "target", name: "Sem Parar", color: "#E30613", category: "Transporte e Mobilidade" },
    veloe: { slug: "target", name: "Veloe", color: "#00A859", category: "Transporte e Mobilidade" },
    conectcar: { slug: "target", name: "ConectCar", color: "#0047BA", category: "Transporte e Mobilidade" },
    ipiranga: { slug: "target", name: "Posto Ipiranga", color: "#F7BE00", category: "Transporte e Mobilidade" },
    shell: { slug: "shell", name: "Posto Shell", color: "#FBCE07", category: "Transporte e Mobilidade" },
    petrobras: { slug: "target", name: "Posto Petrobras", color: "#008542", category: "Transporte e Mobilidade" },
    localiza: { slug: "target", name: "Localiza", color: "#008850", category: "Transporte e Mobilidade" },
    movida: { slug: "target", name: "Movida", color: "#FF5900", category: "Transporte e Mobilidade" },
    azul: { slug: "target", name: "Azul Linhas Aéreas", color: "#002B49", category: "Viagens e Passagens" },
    gol: { slug: "target", name: "GOL Linhas Aéreas", color: "#FF5A00", category: "Viagens e Passagens" },
    latam: { slug: "latam", name: "LATAM Airlines", color: "#E41B13", category: "Viagens e Passagens" },

    // Streaming, Assinaturas & Digital
    spotify: { slug: "spotify", name: "Spotify", color: "#1DB954", category: "Serviços Digitais" },
    netflix: { slug: "netflix", name: "Netflix", color: "#E50914", category: "Serviços Digitais" },
    youtube: { slug: "youtube", name: "YouTube", color: "#FF0000", category: "Serviços Digitais" },
    google: { slug: "google", name: "Google", color: "#4285F4", category: "Serviços Digitais" },
    googleone: { slug: "google", name: "Google One", color: "#4285F4", category: "Serviços Digitais" },
    apple: { slug: "apple", name: "Apple", color: "#FFFFFF", category: "Serviços Digitais" },
    disney: { slug: "disneyplus", name: "Disney+", color: "#113CCF", category: "Serviços Digitais" },
    disneyplus: { slug: "disneyplus", name: "Disney+", color: "#113CCF", category: "Serviços Digitais" },
    max: { slug: "max", name: "Max (HBO)", color: "#002BE7", category: "Serviços Digitais" },
    hbomax: { slug: "max", name: "Max (HBO)", color: "#002BE7", category: "Serviços Digitais" },
    primevideo: { slug: "primevideo", name: "Amazon Prime Video", color: "#00A8E1", category: "Serviços Digitais" },
    amazonprime: { slug: "amazon", name: "Amazon Prime", color: "#FF9900", category: "Serviços Digitais" },
    globoplay: { slug: "globo", name: "Globoplay", color: "#FB6600", category: "Serviços Digitais" },
    deezer: { slug: "deezer", name: "Deezer", color: "#A238FF", category: "Serviços Digitais" },
    openai: { slug: "openai", name: "OpenAI / ChatGPT", color: "#10A37F", category: "Serviços Digitais" },
    chatgpt: { slug: "openai", name: "ChatGPT Plus", color: "#10A37F", category: "Serviços Digitais" },
    anthropic: { slug: "anthropic", name: "Claude (Anthropic)", color: "#D97706", category: "Serviços Digitais" },
    github: { slug: "github", name: "GitHub", color: "#FFFFFF", category: "Serviços Digitais" },
    notion: { slug: "notion", name: "Notion", color: "#FFFFFF", category: "Serviços Digitais" },
    canva: { slug: "canva", name: "Canva", color: "#00C4CC", category: "Serviços Digitais" },
    duolingo: { slug: "duolingo", name: "Duolingo", color: "#58CC02", category: "Educação e Cursos" },

    // E-commerce & Varejo
    amazon: { slug: "amazon", name: "Amazon", color: "#FF9900", category: "Compras e Varejo" },
    mercadolivre: { slug: "mercadolibre", name: "Mercado Livre", color: "#FFE600", category: "Compras e Varejo" },
    meli: { slug: "mercadolibre", name: "Mercado Livre", color: "#FFE600", category: "Compras e Varejo" },
    melimais: { slug: "mercadolibre", name: "Meli+", color: "#FFE600", category: "Serviços Digitais" },
    shopee: { slug: "shopee", name: "Shopee", color: "#EE4D2D", category: "Compras e Varejo" },
    shein: { slug: "shein", name: "Shein", color: "#000000", category: "Compras e Varejo" },
    aliexpress: { slug: "aliexpress", name: "AliExpress", color: "#FF4747", category: "Compras e Varejo" },
    magalu: { slug: "target", name: "Magazine Luiza", color: "#0086FF", category: "Compras e Varejo" },
    casasbahia: { slug: "target", name: "Casas Bahia", color: "#003399", category: "Compras e Varejo" },
    fastshop: { slug: "target", name: "Fast Shop", color: "#ED1C24", category: "Compras e Varejo" },
    kabum: { slug: "target", name: "KaBuM!", color: "#FF6500", category: "Compras e Varejo" },
    pichau: { slug: "target", name: "Pichau", color: "#D11F1F", category: "Compras e Varejo" },

    // Games
    steam: { slug: "steam", name: "Steam Games", color: "#171A21", category: "Lazer e Jogos" },
    playstation: { slug: "playstation", name: "PlayStation Store", color: "#003791", category: "Lazer e Jogos" },
    playstationnetwork: { slug: "playstation", name: "PlayStation Store", color: "#003791", category: "Lazer e Jogos" },
    psn: { slug: "playstation", name: "PlayStation Store", color: "#003791", category: "Lazer e Jogos" },
    xbox: { slug: "xbox", name: "Xbox / Microsoft", color: "#107C10", category: "Lazer e Jogos" },
    nintendo: { slug: "nintendo", name: "Nintendo eShop", color: "#E60012", category: "Lazer e Jogos" },
    epicgames: { slug: "epicgames", name: "Epic Games", color: "#313131", category: "Lazer e Jogos" },
    riotgames: { slug: "riotgames", name: "Riot Games", color: "#EB0029", category: "Lazer e Jogos" },
    blizzard: { slug: "blizzardentertainment", name: "Blizzard", color: "#009AE4", category: "Lazer e Jogos" },

    // Supermercados & Atacados
    carrefour: { slug: "carrefour", name: "Carrefour", color: "#004797", category: "Supermercado" },
    paodeacucar: { slug: "target", name: "Pão de Açúcar", color: "#006C35", category: "Supermercado" },
    extra: { slug: "target", name: "Extra Hipermercado", color: "#E30613", category: "Supermercado" },
    assai: { slug: "target", name: "Assaí Atacadista", color: "#E30613", category: "Supermercado" },
    atacadao: { slug: "target", name: "Atacadão", color: "#F37021", category: "Supermercado" },
    samclub: { slug: "samsclub", name: "Sam's Club", color: "#0067A0", category: "Supermercado" },
    stmarche: { slug: "target", name: "St. Marche", color: "#2B2B2B", category: "Supermercado" },

    // Saúde, Farmácia & Bem-Estar
    drogasil: { slug: "target", name: "Drogasil", color: "#E30613", category: "Saúde e Farmácia" },
    drogaraia: { slug: "target", name: "Droga Raia", color: "#0047BA", category: "Saúde e Farmácia" },
    paguemenos: { slug: "target", name: "Pague Menos", color: "#E30613", category: "Saúde e Farmácia" },
    panvel: { slug: "target", name: "Panvel Farmácias", color: "#002B49", category: "Saúde e Farmácia" },
    smartfit: { slug: "target", name: "Smart Fit", color: "#FFB800", category: "Academia e Bem-Estar" },
    bluefit: { slug: "target", name: "Bluefit", color: "#0047BA", category: "Academia e Bem-Estar" },
    gympass: { slug: "target", name: "Wellhub (Gympass)", color: "#FF441F", category: "Academia e Bem-Estar" },
    wellhub: { slug: "target", name: "Wellhub (Gympass)", color: "#FF441F", category: "Academia e Bem-Estar" },

    // Casa, Construção & Decoração
    leroymerlin: { slug: "leroymerlin", name: "Leroy Merlin", color: "#78BE20", category: "Construção e Reforma" },
    telhanorte: { slug: "target", name: "Telhanorte", color: "#0047BA", category: "Construção e Reforma" },
    "c&c": { slug: "target", name: "C&C Casa e Construção", color: "#E30613", category: "Construção e Reforma" },
    cec: { slug: "target", name: "C&C Casa e Construção", color: "#E30613", category: "Construção e Reforma" },
    tokstok: { slug: "target", name: "Tok&Stok", color: "#000000", category: "Casa e Decoração" },
    camicado: { slug: "target", name: "Camicado", color: "#0047BA", category: "Casa e Decoração" },

    // Telecom & Utilidades
    vivo: { slug: "target", name: "Telefônica Vivo", color: "#660099", category: "Contas de Consumo" },
    claro: { slug: "target", name: "Claro Telecom", color: "#E30613", category: "Contas de Consumo" },
    tim: { slug: "target", name: "TIM Brasil", color: "#003399", category: "Contas de Consumo" },
    enel: { slug: "enel", name: "Enel Energia", color: "#00A859", category: "Contas de Consumo" },
    cpfl: { slug: "target", name: "CPFL Energia", color: "#0047BA", category: "Contas de Consumo" },
    sabesp: { slug: "target", name: "Sabesp Água e Esgoto", color: "#0099FF", category: "Contas de Consumo" },
    copasa: { slug: "target", name: "Copasa", color: "#0047BA", category: "Contas de Consumo" },
    sanepar: { slug: "target", name: "Sanepar", color: "#008850", category: "Contas de Consumo" },
};

// Dicionário de Expansão de Abreviações Comerciais Brasileiras
const BRAZILIAN_ABBREVIATIONS: Array<{ regex: RegExp; replacement: string; category: string }> = [
    { regex: /\bMAT\s*(CONST|CONSTR|CONSTRUCAO)\b/i, replacement: "Materiais de Construção", category: "Construção e Reforma" },
    { regex: /\bAUTO\s*POSTO\b/i, replacement: "Posto de Combustíveis", category: "Transporte e Mobilidade" },
    { regex: /\bPOSTO\s*(COMB|COMBUSTIVEIS)\b/i, replacement: "Posto de Combustíveis", category: "Transporte e Mobilidade" },
    { regex: /\b(SUPERM|SUPERMERC|SUPERMERCADO|ATACAD|HIPER)\b/i, replacement: "Supermercado", category: "Supermercado" },
    { regex: /\b(REST|RESTAUR|RESTAURANTE)\b/i, replacement: "Restaurante", category: "Alimentação e Delivery" },
    { regex: /\b(LANCH|LANCHONETE)\b/i, replacement: "Lanchonete", category: "Alimentação e Delivery" },
    { regex: /\b(PIZZ|PIZZARIA)\b/i, replacement: "Pizzaria", category: "Alimentação e Delivery" },
    { regex: /\b(CHURRASC|CHURRASCARIA)\b/i, replacement: "Churrascaria", category: "Alimentação e Delivery" },
    { regex: /\b(PANIF|PANIFICADORA|PAD|PADARIA|CONFEIT)\b/i, replacement: "Padaria e Panificadora", category: "Alimentação e Delivery" },
    { regex: /\b(DROG|DROGARIA|FARM|FARMACIA)\b/i, replacement: "Farmácia e Drogaria", category: "Saúde e Farmácia" },
    { regex: /\b(CONFEC|CONFECC|CONFECCAO|MODA|VEST)\b/i, replacement: "Moda e Confecções", category: "Compras e Varejo" },
    { regex: /\b(OFIC|OFICINA|AUTO\s*MEC|MECANICA)\b/i, replacement: "Oficina Mecânica", category: "Transporte e Mobilidade" },
    { regex: /\b(PET|PETSHOP|VET|VETERINARIA)\b/i, replacement: "Pet Shop e Veterinária", category: "Cuidados Pessoais" },
    { regex: /\b(DEP\s*BEB|DISTRIB\s*BEB|DISTRIBUIDORA)\b/i, replacement: "Distribuidora de Bebidas", category: "Alimentação e Delivery" },
    { regex: /\b(ESTAC|ESTACIONAMENTO|PARKING)\b/i, replacement: "Estacionamento", category: "Transporte e Mobilidade" },
    { regex: /\b(LAV|LAVANDERIA|LAVA\s*JATO)\b/i, replacement: "Lava Rápido / Lavanderia", category: "Serviços Gerais" },
    { regex: /\b(PAPELARIA|LIVRARIA)\b/i, replacement: "Papelaria e Livraria", category: "Educação e Cursos" },
    { regex: /\b(OTICA|OTICAS)\b/i, replacement: "Ótica", category: "Saúde e Farmácia" },
    { regex: /\b(ACAD|ACADEMIA|FITNESS)\b/i, replacement: "Academia e Fitness", category: "Academia e Bem-Estar" },
];

/**
 * Remove ruídos bancários (prefixos de transação, adquirentes e maquinistas)
 */
export function stripBankingNoise(raw: string): { cleanQuery: string; operationHint?: string } {
    if (!raw) return { cleanQuery: "Transação" };

    let text = raw.trim();
    let operationHint: string | undefined;

    // Detecta e remove modalidade bancária (ex: "Compra no débito|", "Compra no credito -")
    const opMatches = [
        { regex: /^(compra\s+no\s+d[eé]bito|compra\s+d[eé]bito|debito\s+visa|debito\s+master)[\s|\-:]*/i, hint: "DEBIT_CARD" },
        { regex: /^(compra\s+no\s+cr[eé]dito|compra\s+cr[eé]dito|credito\s+visa|credito\s+master)[\s|\-:]*/i, hint: "CREDIT_CARD" },
        { regex: /^(pagamento\s+eletr[oô]nico|pagto\s+eletronico|pagamento\s+boleto)[\s|\-:]*/i, hint: "BOLETO" },
        { regex: /^(transf\s+pix|envio\s+pix|recebimento\s+pix|pix\s+recebido|pix\s+enviado)[\s|\-:]*/i, hint: "PIX" },
        { regex: /^(transfer[eê]ncia\s+ted|doc\/ted|ted\s+outro\s+banco)[\s|\-:]*/i, hint: "TED" },
        { regex: /^(d[eé]bito\s+autom[aá]tico|deb\s+autom)[\s|\-:]*/i, hint: "BILL_PAYMENT" },
        { regex: /^(estorno\s+de|reembolso|devolu[cç][aã]o)[\s|\-:]*/i, hint: "REFUND" },
    ];

    for (const op of opMatches) {
        if (op.regex.test(text)) {
            operationHint = op.hint;
            text = text.replace(op.regex, "");
            break;
        }
    }

    // Remove adquirentes conhecidas (PAG*, MP*, CIELO*, GETNET*, STONE*, etc.)
    text = text.replace(/^(pag\*|pagseguro\*|mp\s*\*|mercadopago\*|cielo\s*\*|getnet\s*\*|stone\s*\*|rede\s*\*|sumup\s*\*|stripe\s*\*|ebanx\s*\*|paypal\s*\*|dl\s*\*|dm\s*\*)/i, "");

    // Remove sufixos de datas ou numerais romanos residuais (" I", " II", " 01", " 02") no final
    text = text.replace(/\s+(I|II|III|IV|V|01|02|03|04|05)$/i, "");

    // Remove códigos de cidades com sufixo BRA (ex: "SAO PAULO BRA", "CURITIBA BR")
    text = text.replace(/\s+[A-Z\s]{3,15}\s+(BRA|BR)$/i, "");

    // Remove CNPJ residual se estiver colado
    text = text.replace(/\s+\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}.*$/i, "");

    // Remove datas no formato DD/MM no fim
    text = text.replace(/\s+\d{2}\/\d{2}$/, "");

    return { cleanQuery: text.trim(), operationHint };
}

/**
 * Converte string para Title Case elegante preservando conectivos em português
 */
function toTitleCasePt(str: string): string {
    const lowerWords = new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "com", "no", "na", "por", "sobre"]);
    return str
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((word, index) => {
            if (word === "s.a." || word === "s/a" || word === "sa") return "S.A.";
            if (word === "ltda" || word === "ltda.") return "Ltda";
            if (word === "me" || word === "mei" || word === "epp") return word.toUpperCase();
            if (word === "pix" || word === "ted" || word === "cdb" || word === "iof") return word.toUpperCase();
            if (index > 0 && lowerWords.has(word)) return word;
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ");
}

/**
 * Resolve o estabelecimento comercial e identifica a marca oficial via Simple Icons e dicionário brasileiro
 */
export function resolveMerchant(rawDescription: string, fallbackCategory?: string | null): ResolvedMerchant {
    const { cleanQuery, operationHint } = stripBankingNoise(rawDescription);
    const normalized = cleanQuery
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    // 1. Verificação Direta no Mapa do Simple Icons
    for (const [key, brand] of Object.entries(SIMPLE_ICONS_BRAND_MAP)) {
        if (normalized.includes(key)) {
            // Se for sub-marca ou serviço específico (ex: "iFood • Restaurante X")
            let displayName = brand.name;
            const subMatch = cleanQuery.replace(new RegExp(`^${key}\\s*[\\*\\-\\s]*`, "i"), "").trim();
            if (subMatch && subMatch.length > 2 && !normalized.endsWith(key)) {
                displayName = `${brand.name} • ${toTitleCasePt(subMatch)}`;
            }

            return {
                cleanName: displayName,
                originalQuery: rawDescription,
                category: brand.category || fallbackCategory || "Outros",
                simpleIconSlug: brand.slug !== "target" ? brand.slug : null,
                brandColor: brand.color,
                operationTypeHint: operationHint,
                isDecodedStore: false,
            };
        }
    }

    // 2. Verificação de Dicionário de Abreviações Brasileiras (ex: "TRENTO MAT CONST" -> "Trento Materiais de Construção")
    let translatedName = cleanQuery;
    let detectedCategory = fallbackCategory || "Outros";
    let isDecodedStore = false;

    for (const abbr of BRAZILIAN_ABBREVIATIONS) {
        if (abbr.regex.test(translatedName)) {
            translatedName = translatedName.replace(abbr.regex, abbr.replacement);
            detectedCategory = abbr.category;
            isDecodedStore = true;
            break;
        }
    }

    // Formata em Title Case humano e legível
    const finalCleanName = toTitleCasePt(translatedName);

    return {
        cleanName: finalCleanName || "Transação",
        originalQuery: rawDescription,
        category: detectedCategory,
        simpleIconSlug: null,
        brandColor: null,
        operationTypeHint: operationHint,
        isDecodedStore,
    };
}
