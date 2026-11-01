/**
 * Kitsune Finance — Motor de Terrenos & Imóveis (Modelos A, B e C)
 *
 * Modelo A (Custo Contábil & IRPF):
 * - Mantém o valor de aquisição histórico (Dossiê IRPF / Custo de Aquisição)
 * - Simula Ganho de Capital tributável pela tabela progressiva da Receita Federal (Lei nº 13.259/2016):
 *   - Até R$ 5.000.000,00: 15,0%
 *   - De R$ 5.000.000,01 até R$ 10.000.000,00: 17,5%
 *   - De R$ 10.000.000,01 até R$ 30.000.000,00: 20,0%
 *   - Acima de R$ 30.000.000,00: 22,5%
 *
 * Modelo B (Correção por Índices Macroeconômicos):
 * - Valor teórico corrigido pela inflação oficial acumulada (IPCA)
 * - Valor teórico corrigido pelo IGP-M (Índice Geral de Preços - Mercado)
 * - Comparativo de ganho real patrimonial e descolamento de mercado.
 *
 * Modelo C (Radar Geográfico de Infraestrutura & Potencial de Valorização):
 * - Consulta à API pública Overpass do OpenStreetMap ($0.00/mês)
 * - Contabilização determinística de POIs num raio de até 2km:
 *   Transportes, Saúde, Educação, Comércio e Segurança
 * - Kitsune Infrastructure Score (0 a 100)
 * - Multiplicador de atratividade por m²
 */

export interface ModelACapitalGainResult {
  acquisitionValue: number;
  currentValue: number;
  grossCapitalGain: number;
  estimatedTaxDue: number;
  effectiveTaxRatePct: number;
  netLiquidProceeds: number;
  taxBracketsBreakdown: Array<{
    bracketLabel: string;
    taxableAmountInBracket: number;
    ratePct: number;
    taxInBracket: number;
  }>;
}

export interface ModelBIndexCorrectionResult {
  acquisitionValue: number;
  elapsedDays: number;
  elapsedMonths: number;
  elapsedYears: number;
  ipcaAccumulatedPct: number;
  correctedValueIPCA: number;
  ipcaGain: number;
  igpmAccumulatedPct: number;
  correctedValueIGPM: number;
  igpmGain: number;
  comparisonDelta: number; // IGPM - IPCA
}

export interface LandSurroundingsPoiItem {
  id: string;
  name: string;
  category: 'transport' | 'health' | 'education' | 'commerce' | 'security';
  type: string;
  lat: number;
  lng: number;
  distanceMeters: number;
}

export interface LandSurroundingsSummary {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  totalPoisFound: number;
  score: number; // 0 a 100
  classification: string;
  attractivenessMultiplier: number;
  categoryBreakdown: {
    transport: { count: number; pointsAwarded: number; maxPoints: number };
    health: { count: number; pointsAwarded: number; maxPoints: number };
    education: { count: number; pointsAwarded: number; maxPoints: number };
    commerce: { count: number; pointsAwarded: number; maxPoints: number };
    security: { count: number; pointsAwarded: number; maxPoints: number };
  };
  keyNearbyPois: LandSurroundingsPoiItem[];
}

/**
 * Fórmula de Haversine para cálculo exato de distância entre coordenadas geográficas (em metros).
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Raio da Terra em metros
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// ============================================================================
// MODELO A: CUSTO CONTÁBIL & ESTIMATIVA DE GANHO DE CAPITAL (IRPF)
// ============================================================================

/**
 * Tabela de alíquotas progressivas do Ganho de Capital da RFB (Lei 13.259/2016).
 */
const CAPITAL_GAIN_BRACKETS = [
  { limit: 5_000_000, rate: 0.15, label: 'Até R$ 5.000.000 (15%)' },
  { limit: 10_000_000, rate: 0.175, label: 'De R$ 5M a R$ 10M (17,5%)' },
  { limit: 30_000_000, rate: 0.20, label: 'De R$ 10M a R$ 30M (20%)' },
  { limit: Infinity, rate: 0.225, label: 'Acima de R$ 30M (22,5%)' },
];

export function calculateModelACapitalGain(
  acquisitionValue: number,
  currentValue: number
): ModelACapitalGainResult {
  const safeAcq = Math.max(0, acquisitionValue || 0);
  const safeCurrent = Math.max(0, currentValue || 0);

  const grossCapitalGain = Math.max(0, safeCurrent - safeAcq);

  if (grossCapitalGain <= 0) {
    return {
      acquisitionValue: safeAcq,
      currentValue: safeCurrent,
      grossCapitalGain: 0,
      estimatedTaxDue: 0,
      effectiveTaxRatePct: 0,
      netLiquidProceeds: safeCurrent,
      taxBracketsBreakdown: [],
    };
  }

  let remainingGain = grossCapitalGain;
  let previousLimit = 0;
  let totalTaxDue = 0;
  const breakdown: ModelACapitalGainResult['taxBracketsBreakdown'] = [];

  for (const bracket of CAPITAL_GAIN_BRACKETS) {
    if (remainingGain <= 0) break;

    const bracketCapacity = bracket.limit - previousLimit;
    const taxableInThisBracket = Math.min(remainingGain, bracketCapacity);
    const taxInThisBracket = taxableInThisBracket * bracket.rate;

    totalTaxDue += taxInThisBracket;
    remainingGain -= taxableInThisBracket;
    previousLimit = bracket.limit;

    breakdown.push({
      bracketLabel: bracket.label,
      taxableAmountInBracket: Math.round(taxableInThisBracket * 100) / 100,
      ratePct: bracket.rate * 100,
      taxInBracket: Math.round(taxInThisBracket * 100) / 100,
    });
  }

  const roundedTaxDue = Math.round(totalTaxDue * 100) / 100;
  const effectiveTaxRatePct = Math.round((roundedTaxDue / grossCapitalGain) * 10000) / 100;
  const netLiquidProceeds = Math.round((safeCurrent - roundedTaxDue) * 100) / 100;

  return {
    acquisitionValue: safeAcq,
    currentValue: safeCurrent,
    grossCapitalGain: Math.round(grossCapitalGain * 100) / 100,
    estimatedTaxDue: roundedTaxDue,
    effectiveTaxRatePct,
    netLiquidProceeds,
    taxBracketsBreakdown: breakdown,
  };
}

// ============================================================================
// MODELO B: CORREÇÃO DETERMINÍSTICA POR ÍNDICES MACROECONÔMICOS (IPCA vs. IGP-M)
// ============================================================================

export interface IndexCorrectionCustomRates {
  /** Taxa anual do IPCA em % (default: 4.83% a.a.) */
  ipcaAnnualPct?: number;
  /** Taxa anual do IGP-M em % (default: 6.20% a.a.) */
  igpmAnnualPct?: number;
}

export function calculateModelBIndexCorrection(
  acquisitionValue: number,
  acquisitionDate: string | Date | null | undefined,
  targetDate: string | Date = new Date(),
  customRates: IndexCorrectionCustomRates = {}
): ModelBIndexCorrectionResult {
  const safeAcq = Math.max(0, acquisitionValue || 0);

  let elapsedDays = 0;
  if (acquisitionDate) {
    const start = typeof acquisitionDate === 'string' ? new Date(acquisitionDate).getTime() : acquisitionDate.getTime();
    const end = typeof targetDate === 'string' ? new Date(targetDate).getTime() : targetDate.getTime();
    if (!isNaN(start) && !isNaN(end) && end > start) {
      elapsedDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    }
  }

  const elapsedYears = elapsedDays > 0 ? elapsedDays / 365.25 : 0;
  const elapsedMonths = Math.round(elapsedYears * 12 * 10) / 10;

  const ipcaAnnualPct = customRates.ipcaAnnualPct ?? 4.83;
  const igpmAnnualPct = customRates.igpmAnnualPct ?? 6.20;

  if (elapsedDays <= 0 || safeAcq <= 0) {
    return {
      acquisitionValue: safeAcq,
      elapsedDays: 0,
      elapsedMonths: 0,
      elapsedYears: 0,
      ipcaAccumulatedPct: 0,
      correctedValueIPCA: safeAcq,
      ipcaGain: 0,
      igpmAccumulatedPct: 0,
      correctedValueIGPM: safeAcq,
      igpmGain: 0,
      comparisonDelta: 0,
    };
  }

  // Fator composto: (1 + r_anual)^(anos)
  const ipcaCompoundFactor = Math.pow(1 + ipcaAnnualPct / 100, elapsedYears);
  const igpmCompoundFactor = Math.pow(1 + igpmAnnualPct / 100, elapsedYears);

  const correctedValueIPCA = Math.round(safeAcq * ipcaCompoundFactor * 100) / 100;
  const correctedValueIGPM = Math.round(safeAcq * igpmCompoundFactor * 100) / 100;

  const ipcaAccumulatedPct = Math.round((ipcaCompoundFactor - 1) * 10000) / 100;
  const igpmAccumulatedPct = Math.round((igpmCompoundFactor - 1) * 10000) / 100;

  const ipcaGain = Math.round((correctedValueIPCA - safeAcq) * 100) / 100;
  const igpmGain = Math.round((correctedValueIGPM - safeAcq) * 100) / 100;
  const comparisonDelta = Math.round((correctedValueIGPM - correctedValueIPCA) * 100) / 100;

  return {
    acquisitionValue: safeAcq,
    elapsedDays,
    elapsedMonths,
    elapsedYears: Math.round(elapsedYears * 100) / 100,
    ipcaAccumulatedPct,
    correctedValueIPCA,
    ipcaGain,
    igpmAccumulatedPct,
    correctedValueIGPM,
    igpmGain,
    comparisonDelta,
  };
}

// ============================================================================
// MODELO C: RADAR GEOGRÁFICO DE INFRAESTRUTURA & POTENCIAL DE VALORIZAÇÃO
// ============================================================================

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

interface OverpassRawElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

function classifyPoiTags(tags: Record<string, string>): {
  category: LandSurroundingsPoiItem['category'];
  typeLabel: string;
} | null {
  // Transportes
  if (tags.highway === 'bus_stop' || tags.public_transport === 'platform') {
    return { category: 'transport', typeLabel: 'Ponto de Ônibus' };
  }
  if (tags.railway === 'station' || tags.station === 'subway') {
    return { category: 'transport', typeLabel: 'Estação Ferroviária / Metrô' };
  }
  if (tags.railway === 'subway_entrance') {
    return { category: 'transport', typeLabel: 'Acesso ao Metrô' };
  }
  if (tags.amenity === 'bus_station') {
    return { category: 'transport', typeLabel: 'Terminal de Ônibus' };
  }

  // Saúde
  if (tags.amenity === 'hospital') {
    return { category: 'health', typeLabel: 'Hospital' };
  }
  if (tags.amenity === 'pharmacy') {
    return { category: 'health', typeLabel: 'Farmácia' };
  }
  if (tags.amenity === 'clinic' || tags.amenity === 'doctors') {
    return { category: 'health', typeLabel: 'Clínica Médica' };
  }

  // Educação
  if (tags.amenity === 'school') {
    return { category: 'education', typeLabel: 'Escola' };
  }
  if (tags.amenity === 'university' || tags.amenity === 'college') {
    return { category: 'education', typeLabel: 'Universidade / Faculdade' };
  }
  if (tags.amenity === 'kindergarten') {
    return { category: 'education', typeLabel: 'Creche / Educação Infantil' };
  }

  // Comércio & Serviços
  if (tags.shop === 'supermarket') {
    return { category: 'commerce', typeLabel: 'Supermercado' };
  }
  if (tags.shop === 'mall') {
    return { category: 'commerce', typeLabel: 'Shopping Center' };
  }
  if (tags.shop === 'convenience' || tags.shop === 'bakery') {
    return { category: 'commerce', typeLabel: 'Conveniência / Padaria' };
  }
  if (tags.amenity === 'bank') {
    return { category: 'commerce', typeLabel: 'Agência Bancária' };
  }

  // Segurança
  if (tags.amenity === 'police') {
    return { category: 'security', typeLabel: 'Delegacia / Polícia' };
  }
  if (tags.amenity === 'fire_station') {
    return { category: 'security', typeLabel: 'Corpo de Bombeiros' };
  }

  return null;
}

/**
 * Normaliza contagem de POIs em pontos ponderados com curva de saturação logarítmica.
 * Garante que poucos serviços já pontuem, mas 100 pontos de ônibus não saturem injustamente.
 */
function calculateSaturatedPoints(count: number, maxPoints: number, targetCount: number): number {
  if (count <= 0) return 0;
  const ratio = Math.log2(1 + count) / Math.log2(1 + targetCount);
  const clamped = Math.min(1, Math.max(0, ratio));
  return Math.round(clamped * maxPoints * 10) / 10;
}

/**
 * Consulta a Overpass API do OpenStreetMap e analisa a infraestrutura em torno das coordenadas.
 */
export async function analyzeLandSurroundings(
  lat: number,
  lng: number,
  radiusMeters = 2000
): Promise<LandSurroundingsSummary> {
  const safeRadius = Math.min(5000, Math.max(500, radiusMeters));

  // Query otimizada Overpass QL buscando elementos essenciais num raio de ${radius} metros
  const query = `
    [out:json][timeout:15];
    (
      node["highway"="bus_stop"](around:${safeRadius},${lat},${lng});
      node["railway"="station"](around:${safeRadius},${lat},${lng});
      node["railway"="subway_entrance"](around:${safeRadius},${lat},${lng});
      node["amenity"="bus_station"](around:${safeRadius},${lat},${lng});
      node["amenity"="hospital"](around:${safeRadius},${lat},${lng});
      node["amenity"="pharmacy"](around:${safeRadius},${lat},${lng});
      node["amenity"="clinic"](around:${safeRadius},${lat},${lng});
      node["amenity"="school"](around:${safeRadius},${lat},${lng});
      node["amenity"="university"](around:${safeRadius},${lat},${lng});
      node["amenity"="college"](around:${safeRadius},${lat},${lng});
      node["shop"="supermarket"](around:${safeRadius},${lat},${lng});
      node["shop"="mall"](around:${safeRadius},${lat},${lng});
      node["shop"="bakery"](around:${safeRadius},${lat},${lng});
      node["amenity"="police"](around:${safeRadius},${lat},${lng});
      node["amenity"="fire_station"](around:${safeRadius},${lat},${lng});
    );
    out body 80;
  `.trim();

  let elements: OverpassRawElement[] = [];
  let fetchSucceeded = false;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'KitsuneFinance/2.0 (OpenStreetMaps Overpass Client)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(12000),
      });

      if (response.ok) {
        const json = (await response.json()) as { elements?: OverpassRawElement[] };
        elements = json.elements || [];
        fetchSucceeded = true;
        break;
      }
    } catch {
      // Tenta próximo endpoint público
    }
  }

  // Se todos os mirrors públicos da Overpass falharem ou estiverem indisponíveis (fallback seguro)
  if (!fetchSucceeded || elements.length === 0) {
    return generateFallbackSurroundings(lat, lng, safeRadius);
  }

  const categoryCounts = {
    transport: 0,
    health: 0,
    education: 0,
    commerce: 0,
    security: 0,
  };

  const poiList: LandSurroundingsPoiItem[] = [];

  for (const el of elements) {
    if (!el.tags || typeof el.lat !== 'number' || typeof el.lon !== 'number') continue;
    const classification = classifyPoiTags(el.tags);
    if (!classification) continue;

    categoryCounts[classification.category]++;
    const distanceMeters = calculateHaversineDistanceMeters(lat, lng, el.lat, el.lon);

    const poiName =
      el.tags.name ||
      el.tags['name:pt'] ||
      `${classification.typeLabel} (${distanceMeters}m)`;

    poiList.push({
      id: `osm-${el.id}`,
      name: poiName,
      category: classification.category,
      type: classification.typeLabel,
      lat: el.lat,
      lng: el.lon,
      distanceMeters,
    });
  }

  // Ordena POIs por proximidade física
  poiList.sort((a, b) => a.distanceMeters - b.distanceMeters);

  // Pesos determinísticos do Kitsune Infrastructure Score:
  // Transporte: máx 25 pts (alvo: 12 POIs)
  // Saúde: máx 20 pts (alvo: 4 POIs)
  // Educação: máx 20 pts (alvo: 5 POIs)
  // Comércio: máx 25 pts (alvo: 8 POIs)
  // Segurança: máx 10 pts (alvo: 2 POIs)
  const transportPoints = calculateSaturatedPoints(categoryCounts.transport, 25, 12);
  const healthPoints = calculateSaturatedPoints(categoryCounts.health, 20, 4);
  const educationPoints = calculateSaturatedPoints(categoryCounts.education, 20, 5);
  const commercePoints = calculateSaturatedPoints(categoryCounts.commerce, 25, 8);
  const securityPoints = calculateSaturatedPoints(categoryCounts.security, 10, 2);

  const totalScore = Math.min(
    100,
    Math.round(transportPoints + healthPoints + educationPoints + commercePoints + securityPoints)
  );

  let classificationLabel = 'Infraestrutura básica em consolidação';
  let attractivenessMultiplier = 1.0;

  if (totalScore >= 80) {
    classificationLabel = 'Altíssima densidade de serviços, transporte e valorização';
    attractivenessMultiplier = 1.45;
  } else if (totalScore >= 60) {
    classificationLabel = 'Alta densidade de serviços urbanos e transporte';
    attractivenessMultiplier = 1.25;
  } else if (totalScore >= 40) {
    classificationLabel = 'Densidade moderada com comércio local acessível';
    attractivenessMultiplier = 1.1;
  } else if (totalScore >= 20) {
    classificationLabel = 'Região residencial com serviços essenciais em desenvolvimento';
    attractivenessMultiplier = 0.95;
  } else {
    classificationLabel = 'Área isolada ou de baixa consolidação urbana';
    attractivenessMultiplier = 0.85;
  }

  return {
    latitude: lat,
    longitude: lng,
    radiusMeters: safeRadius,
    totalPoisFound: poiList.length,
    score: totalScore,
    classification: classificationLabel,
    attractivenessMultiplier,
    categoryBreakdown: {
      transport: { count: categoryCounts.transport, pointsAwarded: transportPoints, maxPoints: 25 },
      health: { count: categoryCounts.health, pointsAwarded: healthPoints, maxPoints: 20 },
      education: { count: categoryCounts.education, pointsAwarded: educationPoints, maxPoints: 20 },
      commerce: { count: categoryCounts.commerce, pointsAwarded: commercePoints, maxPoints: 25 },
      security: { count: categoryCounts.security, pointsAwarded: securityPoints, maxPoints: 10 },
    },
    keyNearbyPois: poiList.slice(0, 15),
  };
}

/**
 * Fallback estático e determinístico em caso de indisponibilidade da Overpass API.
 */
function generateFallbackSurroundings(
  lat: number,
  lng: number,
  radiusMeters: number
): LandSurroundingsSummary {
  return {
    latitude: lat,
    longitude: lng,
    radiusMeters,
    totalPoisFound: 0,
    score: 50,
    classification: 'Radar em modo de contingência (serviços estimados)',
    attractivenessMultiplier: 1.05,
    categoryBreakdown: {
      transport: { count: 0, pointsAwarded: 12.5, maxPoints: 25 },
      health: { count: 0, pointsAwarded: 10, maxPoints: 20 },
      education: { count: 0, pointsAwarded: 10, maxPoints: 20 },
      commerce: { count: 0, pointsAwarded: 12.5, maxPoints: 25 },
      security: { count: 0, pointsAwarded: 5, maxPoints: 10 },
    },
    keyNearbyPois: [],
  };
}
