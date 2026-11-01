/**
 * Kitsune Finance — Motor Determinístico de Veículos & FIPE ao Vivo
 *
 * Integração pública e gratuita ($0.00/mês) via BrasilAPI:
 * - Marcas: `https://brasilapi.com.br/api/fipe/marcas/v1/{tipoVeiculo}`
 * - Modelos: `https://brasilapi.com.br/api/fipe/veiculos/v1/{tipoVeiculo}/{brandCode}`
 * - Anos/Versões: `https://brasilapi.com.br/api/fipe/anos/v1/{tipoVeiculo}/{brandCode}/{modelCode}`
 * - Preço Detalhado: `https://brasilapi.com.br/api/fipe/detalhes/v1/{tipoVeiculo}/{brandCode}/{modelCode}/{yearCode}`
 * - Consulta por Código FIPE: `https://brasilapi.com.br/api/fipe/preco/v1/{codigoFipe}`
 *
 * Cache L1 (Memória) + Cache L2 (LocalStorage) de 24 horas para conformidade e resposta instantânea (0ms).
 * Cálculo matemático determinístico e puro de depreciação histórica e taxa anualizada.
 */

export type FipeVehicleType = 'carros' | 'motos' | 'caminhoes';

export interface FipeBrand {
  code: string;
  name: string;
}

export interface FipeModel {
  code: string;
  name: string;
}

export interface FipeYear {
  code: string;
  name: string;
  year: number;
  fuel: string;
}

export interface FipePriceDetail {
  fipeCode: string;
  brand: string;
  model: string;
  modelYear: number;
  fuel: string;
  fuelAcronym: string;
  price: number;
  priceFormatted: string;
  referenceMonth: string;
  consultedAt: string;
  vehicleType: number;
}

export interface VehicleDepreciationResult {
  acquisitionValue: number;
  currentFipePrice: number;
  nominalDelta: number;
  totalVariationPct: number;
  elapsedDays: number;
  elapsedYears: number;
  annualizedVariationPct: number;
  status: 'appreciated' | 'depreciated' | 'neutral';
}

const BRASIL_API_BASE_URL = 'https://brasilapi.com.br/api/fipe';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

// Cache L1 (Em memória)
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();

function getCached<T>(key: string): T | null {
  const mem = memoryCache.get(key);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.data as T;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(`kitsune_fipe_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored) as { data: T; expiresAt: number };
        if (parsed.expiresAt > Date.now()) {
          memoryCache.set(key, parsed);
          return parsed.data;
        }
        window.localStorage.removeItem(`kitsune_fipe_${key}`);
      }
    } catch {
      // Ignora falhas de parse no storage
    }
  }

  return null;
}

function setCached<T>(key: string, data: T): void {
  const expiresAt = Date.now() + CACHE_TTL_MS;
  memoryCache.set(key, { data, expiresAt });

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        `kitsune_fipe_${key}`,
        JSON.stringify({ data, expiresAt })
      );
    } catch {
      // Silencia cota estourada de localStorage
    }
  }
}

/**
 * Converte string de moeda brasileira ('R$ 89.900,00') em número float determinístico (89900.00).
 */
export function parseFipePriceStringToNumber(priceStr: string | number | null | undefined): number {
  if (typeof priceStr === 'number') return isNaN(priceStr) ? 0 : priceStr;
  if (!priceStr || typeof priceStr !== 'string') return 0;

  const cleaned = priceStr
    .replace(/[^\d,-]/g, '')
    .replace('.', '')
    .replace(',', '.');

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}

/**
 * Busca a lista de montadoras/marcas para a categoria selecionada.
 */
export async function fetchFipeBrands(vehicleType: FipeVehicleType = 'carros'): Promise<FipeBrand[]> {
  const cacheKey = `brands_${vehicleType}`;
  const cached = getCached<FipeBrand[]>(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${BRASIL_API_BASE_URL}/marcas/v1/${vehicleType}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar marcas FIPE (${response.status})`);
  }

  const rawList = (await response.json()) as Array<{ nome?: string; name?: string; valor?: string; value?: string }>;
  const normalized: FipeBrand[] = rawList
    .map((item) => ({
      code: String(item.valor || item.value || ''),
      name: String(item.nome || item.name || '').trim(),
    }))
    .filter((b) => b.code && b.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  setCached(cacheKey, normalized);
  return normalized;
}

/**
 * Busca a lista de modelos de uma montadora específica.
 */
export async function fetchFipeModels(
  vehicleType: FipeVehicleType,
  brandCode: string
): Promise<FipeModel[]> {
  if (!brandCode) return [];
  const cacheKey = `models_${vehicleType}_${brandCode}`;
  const cached = getCached<FipeModel[]>(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${BRASIL_API_BASE_URL}/veiculos/v1/${vehicleType}/${brandCode}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar modelos FIPE (${response.status})`);
  }

  const rawList = (await response.json()) as Array<{
    nome?: string;
    name?: string;
    modelo?: string;
    valor?: string;
    value?: string;
    codigo?: string;
  }>;

  const normalized: FipeModel[] = rawList
    .map((item) => ({
      code: String(item.valor || item.value || item.codigo || ''),
      name: String(item.nome || item.name || item.modelo || '').trim(),
    }))
    .filter((m) => m.code && m.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  setCached(cacheKey, normalized);
  return normalized;
}

/**
 * Busca os anos e tipos de combustível disponíveis para o modelo.
 */
export async function fetchFipeYears(
  vehicleType: FipeVehicleType,
  brandCode: string,
  modelCode: string
): Promise<FipeYear[]> {
  if (!brandCode || !modelCode) return [];
  const cacheKey = `years_${vehicleType}_${brandCode}_${modelCode}`;
  const cached = getCached<FipeYear[]>(cacheKey);
  if (cached) return cached;

  const response = await fetch(
    `${BRASIL_API_BASE_URL}/anos/v1/${vehicleType}/${brandCode}/${modelCode}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }
  );

  if (!response.ok) {
    throw new Error(`Falha ao buscar anos FIPE (${response.status})`);
  }

  const rawList = (await response.json()) as Array<{ nome?: string; valor?: string }>;
  const normalized: FipeYear[] = rawList.map((item) => {
    const rawName = String(item.nome || '').trim();
    const parts = rawName.split(' ');
    const yearParsed = parseInt(parts[0], 10);
    const fuel = parts.slice(1).join(' ') || 'Gasolina / Flex';

    return {
      code: String(item.valor || ''),
      name: rawName,
      year: isNaN(yearParsed) ? 0 : yearParsed,
      fuel,
    };
  });

  setCached(cacheKey, normalized);
  return normalized;
}

/**
 * Busca o preço de referência atual e histórico da FIPE para o ano/modelo exato.
 */
export async function fetchFipePrice(
  vehicleType: FipeVehicleType,
  brandCode: string,
  modelCode: string,
  yearCode: string
): Promise<FipePriceDetail> {
  const cacheKey = `price_${vehicleType}_${brandCode}_${modelCode}_${yearCode}`;
  const cached = getCached<FipePriceDetail>(cacheKey);
  if (cached) return cached;

  const response = await fetch(
    `${BRASIL_API_BASE_URL}/detalhes/v1/${vehicleType}/${brandCode}/${modelCode}/${yearCode}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }
  );

  if (!response.ok) {
    throw new Error(`Falha ao obter cotação FIPE detalhada (${response.status})`);
  }

  const raw = (await response.json()) as {
    valor?: string | number;
    marca?: string;
    modelo?: string;
    anoModelo?: number;
    combustivel?: string;
    codigoFipe?: string;
    mesReferencia?: string;
    tipoVeiculo?: number;
    siglaCombustivel?: string;
    dataConsulta?: string;
  };

  const parsedPrice = parseFipePriceStringToNumber(raw.valor);

  const detail: FipePriceDetail = {
    fipeCode: String(raw.codigoFipe || '').trim(),
    brand: String(raw.marca || '').trim(),
    model: String(raw.modelo || '').trim(),
    modelYear: Number(raw.anoModelo) || 0,
    fuel: String(raw.combustivel || '').trim(),
    fuelAcronym: String(raw.siglaCombustivel || '').trim(),
    price: parsedPrice,
    priceFormatted:
      typeof raw.valor === 'string'
        ? raw.valor
        : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parsedPrice),
    referenceMonth: String(raw.mesReferencia || '').trim(),
    consultedAt: String(raw.dataConsulta || new Date().toISOString()),
    vehicleType: Number(raw.tipoVeiculo) || 1,
  };

  setCached(cacheKey, detail);
  return detail;
}

/**
 * Busca cotação FIPE diretamente por código de 7 dígitos (ex: "001001-4").
 */
export async function fetchFipePriceByCode(fipeCode: string): Promise<FipePriceDetail[]> {
  const cleanCode = fipeCode.replace(/[^\d-]/g, '').trim();
  if (!cleanCode) return [];

  const cacheKey = `code_${cleanCode}`;
  const cached = getCached<FipePriceDetail[]>(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${BRASIL_API_BASE_URL}/preco/v1/${cleanCode}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Código FIPE ${cleanCode} não encontrado na BrasilAPI`);
  }

  const rawList = (await response.json()) as Array<{
    valor?: string | number;
    marca?: string;
    modelo?: string;
    anoModelo?: number;
    combustivel?: string;
    codigoFipe?: string;
    mesReferencia?: string;
    tipoVeiculo?: number;
    siglaCombustivel?: string;
    dataConsulta?: string;
  }>;

  const results: FipePriceDetail[] = rawList.map((raw) => {
    const parsedPrice = parseFipePriceStringToNumber(raw.valor);
    return {
      fipeCode: String(raw.codigoFipe || cleanCode).trim(),
      brand: String(raw.marca || '').trim(),
      model: String(raw.modelo || '').trim(),
      modelYear: Number(raw.anoModelo) || 0,
      fuel: String(raw.combustivel || '').trim(),
      fuelAcronym: String(raw.siglaCombustivel || '').trim(),
      price: parsedPrice,
      priceFormatted:
        typeof raw.valor === 'string'
          ? raw.valor
          : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parsedPrice),
      referenceMonth: String(raw.mesReferencia || '').trim(),
      consultedAt: String(raw.dataConsulta || new Date().toISOString()),
      vehicleType: Number(raw.tipoVeiculo) || 1,
    };
  });

  setCached(cacheKey, results);
  return results;
}

/**
 * Cálculo determinístico da depreciação ou valorização do veículo.
 *
 * @param acquisitionValue Valor nominal pago na compra
 * @param acquisitionDate Data em que o bem foi adquirido
 * @param currentFipePrice Valor atual da FIPE
 */
export function calculateVehicleDepreciation(
  acquisitionValue: number,
  acquisitionDate: string | Date | null | undefined,
  currentFipePrice: number
): VehicleDepreciationResult {
  const safeAcq = Math.max(0, acquisitionValue || 0);
  const safeCurrent = Math.max(0, currentFipePrice || 0);

  if (safeAcq === 0 || safeCurrent === 0) {
    return {
      acquisitionValue: safeAcq,
      currentFipePrice: safeCurrent,
      nominalDelta: safeCurrent - safeAcq,
      totalVariationPct: 0,
      elapsedDays: 0,
      elapsedYears: 0,
      annualizedVariationPct: 0,
      status: 'neutral',
    };
  }

  const nominalDelta = Math.round((safeCurrent - safeAcq) * 100) / 100;
  const totalVariationPct = Math.round(((safeCurrent - safeAcq) / safeAcq) * 10000) / 100;

  let elapsedDays = 0;
  if (acquisitionDate) {
    const acqTime = typeof acquisitionDate === 'string' ? new Date(acquisitionDate).getTime() : acquisitionDate.getTime();
    if (!isNaN(acqTime)) {
      const nowTime = Date.now();
      elapsedDays = Math.max(1, Math.floor((nowTime - acqTime) / (1000 * 60 * 60 * 24)));
    }
  }

  const elapsedYears = elapsedDays > 0 ? elapsedDays / 365.25 : 1;

  // Se período menor que 30 dias, evita distorções exponenciais no anualizado
  let annualizedVariationPct: number;
  if (elapsedDays < 30 || elapsedYears < 0.08) {
    annualizedVariationPct = totalVariationPct;
  } else {
    // Variação anualizada composta: ((1 + varTotal)^(1/anos)) - 1
    const factor = 1 + totalVariationPct / 100;
    if (factor <= 0) {
      annualizedVariationPct = -100;
    } else {
      const annualCompounded = Math.pow(factor, 1 / elapsedYears) - 1;
      annualizedVariationPct = Math.round(annualCompounded * 10000) / 100;
    }
  }

  let status: VehicleDepreciationResult['status'] = 'neutral';
  if (nominalDelta > 0.01) {
    status = 'appreciated';
  } else if (nominalDelta < -0.01) {
    status = 'depreciated';
  }

  return {
    acquisitionValue: safeAcq,
    currentFipePrice: safeCurrent,
    nominalDelta,
    totalVariationPct,
    elapsedDays,
    elapsedYears: Math.round(elapsedYears * 100) / 100,
    annualizedVariationPct,
    status,
  };
}
