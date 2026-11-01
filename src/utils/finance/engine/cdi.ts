/**
 * Motor B3CALC / CETIP DU/252 com Precisão Segura
 * Implementação puramente determinística para títulos de renda fixa pós-fixados indexados ao CDI.
 * 
 * Regras oficiais:
 * - Base anual: 252 dias úteis (DU/252).
 * - Feriados nacionais oficiais ANBIMA (fixos e móveis).
 * - Truncamento estrito sem estouro de limite IEEE 754 (Number.MAX_SAFE_INTEGER).
 */

/**
 * Trunca um número na quantidade exata de casas decimais sem arredondamento.
 * Implementado via manipulação segura de string para evitar o estouro de IEEE 754
 * que ocorre com multiplicações ingênuas por 10^16.
 */
export function truncateDecimal(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0;
  if (decimals <= 0) return Math.trunc(value);

  const sign = value < 0 ? -1 : 1;
  const absVal = Math.abs(value);

  // Evita notação científica para valores decimais muito pequenos
  let str = absVal.toString();
  if (str.includes('e-')) {
    str = absVal.toFixed(decimals + 10);
  } else {
    // Garante que há casas decimais suficientes
    const dotPos = str.indexOf('.');
    if (dotPos === -1) {
      str += '.' + '0'.repeat(decimals + 4);
    } else {
      str += '0'.repeat(decimals + 4);
    }
  }

  const dotIndex = str.indexOf('.');
  const truncatedStr = str.slice(0, dotIndex + 1 + decimals);
  return sign * Number(truncatedStr);
}

/**
 * Calcula a data da Páscoa para qualquer ano gregoriano pelo algoritmo anônimo de Meeus/Jones/Butcher.
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed (Março = 2, Abril = 3)
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

/**
 * Adiciona ou subtrai dias de uma data UTC.
 */
function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Formata Date para YYYY-MM-DD em UTC.
 */
function formatISODateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Cache de feriados por ano para performance máxima.
 */
const holidayCacheByYear = new Map<number, Set<string>>();

/**
 * Retorna todos os feriados bancários nacionais ANBIMA de um determinado ano.
 * Inclui os feriados fixos e os móveis derivados do domingo de Páscoa:
 * - Segunda-feira de Carnaval (Páscoa - 48 dias)
 * - Terça-feira de Carnaval (Páscoa - 47 dias)
 * - Sexta-feira da Paixão / Sexta Santa (Páscoa - 2 dias)
 * - Corpus Christi (Páscoa + 60 dias)
 * Feriados fixos:
 * - 01/01 (Ano Novo)
 * - 21/04 (Tiradentes)
 * - 01/05 (Dia do Trabalho)
 * - 07/09 (Independência do Brasil)
 * - 12/10 (Nossa Senhora Aparecida)
 * - 02/11 (Finados)
 * - 15/11 (Proclamação da República)
 * - 20/11 (Dia Nacional de Zumbi e da Consciência Negra - Lei 14.759/2023)
 * - 25/12 (Natal)
 */
export function getAnbimaHolidays(year: number): Set<string> {
  const cached = holidayCacheByYear.get(year);
  if (cached) return cached;

  const holidays = new Set<string>();

  // Feriados Fixos
  holidays.add(`${year}-01-01`);
  holidays.add(`${year}-04-21`);
  holidays.add(`${year}-05-01`);
  holidays.add(`${year}-07-09`); // Feriado Estadual SP (relevante na B3, mas a ANBIMA segue federais; 07-09 é federal Independência)
  holidays.add(`${year}-10-12`);
  holidays.add(`${year}-11-02`);
  holidays.add(`${year}-11-15`);
  holidays.add(`${year}-11-20`);
  holidays.add(`${year}-12-25`);

  // Feriados Móveis baseados na Páscoa
  const easter = getEasterSunday(year);
  const carnavalMon = addDaysUTC(easter, -48);
  const carnavalTue = addDaysUTC(easter, -47);
  const goodFriday = addDaysUTC(easter, -2);
  const corpusChristi = addDaysUTC(easter, 60);

  holidays.add(formatISODateUTC(carnavalMon));
  holidays.add(formatISODateUTC(carnavalTue));
  holidays.add(formatISODateUTC(goodFriday));
  holidays.add(formatISODateUTC(corpusChristi));

  holidayCacheByYear.set(year, holidays);
  return holidays;
}

/**
 * Verifica se uma data é dia útil bancário no Brasil.
 */
export function isBusinessDay(date: Date): boolean {
  const d = new Date(date);
  const dayOfWeek = d.getUTCDay();
  // Sábado (6) ou Domingo (0)
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const year = d.getUTCFullYear();
  const holidays = getAnbimaHolidays(year);
  const isoStr = formatISODateUTC(d);
  return !holidays.has(isoStr);
}

/**
 * Conta a quantidade de dias úteis entre duas datas (startDate inclusive, endDate exclusive).
 * Padrão ANBIMA/B3 de liquidação e acúmulo de taxa DI.
 */
export function countBusinessDays(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Normaliza horas para UTC meia-noite
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 12, 0, 0));
  const final = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 12, 0, 0));

  if (cur.getTime() >= final.getTime()) return 0;

  let businessDays = 0;
  while (cur.getTime() < final.getTime()) {
    if (isBusinessDay(cur)) {
      businessDays++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return businessDays;
}

/**
 * Calcula o fator diário do CDI segundo a fórmula oficial da CETIP/B3.
 * 
 * 1. Fator DI diário (TDI_k):
 *    TDI_k = ((1 + DI_anual / 100)^(1 / 252) - 1) truncado na 8ª casa decimal.
 * 2. Fator aplicado com percentual contratado:
 *    F_diario = 1 + truncateDecimal(TDI_k * (percentOfCDI / 100), 16).
 */
export function calculateDailyCDIFactor(annualDI: number, percentOfCDI: number): number {
  if (annualDI <= 0 || percentOfCDI <= 0) return 1;

  // TDI_k com base 252 truncado em 8 casas decimais
  const rawDailyRate = Math.pow(1 + annualDI / 100, 1 / 252) - 1;
  const tdiK = truncateDecimal(rawDailyRate, 8);

  // Fator ponderado truncado em 16 casas decimais
  const appliedDailyRate = truncateDecimal(tdiK * (percentOfCDI / 100), 16);
  return 1 + appliedDailyRate;
}

export interface CDIPositionParams {
  principal: number;
  startDate: Date;
  endDate: Date;
  annualDI: number;
  percentOfCDI: number;
  dailyRatesOverride?: Array<{ date: string; annualDI: number }>;
}

export interface CDIPositionResult {
  principal: number;
  grossBalance: number;
  grossYield: number;
  businessDays: number;
  calendarDays: number;
  accumulatedFactor: number;
  effectiveReturnPct: number;
}

/**
 * Calcula o saldo bruto e o rendimento acumulado de uma posição atrelada ao CDI.
 */
export function calculateCDIPosition(params: CDIPositionParams): CDIPositionResult {
  const { principal, startDate, endDate, annualDI, percentOfCDI, dailyRatesOverride } = params;

  const start = new Date(startDate);
  const end = new Date(endDate);

  const startUtc = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 12, 0, 0));
  const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 12, 0, 0));

  const diffMs = endUtc.getTime() - startUtc.getTime();
  const calendarDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  if (calendarDays <= 0 || principal <= 0) {
    return {
      principal,
      grossBalance: principal,
      grossYield: 0,
      businessDays: 0,
      calendarDays: 0,
      accumulatedFactor: 1,
      effectiveReturnPct: 0,
    };
  }

  // Mapa de taxas diárias customizadas, se fornecidas
  const overrideMap = new Map<string, number>();
  if (dailyRatesOverride && dailyRatesOverride.length > 0) {
    for (const item of dailyRatesOverride) {
      overrideMap.set(item.date, item.annualDI);
    }
  }

  let accumulatedFactor = 1.0;
  let businessDays = 0;
  const cur = new Date(startUtc.getTime());

  while (cur.getTime() < endUtc.getTime()) {
    if (isBusinessDay(cur)) {
      businessDays++;
      const isoStr = formatISODateUTC(cur);
      const rateForDay = overrideMap.get(isoStr) ?? annualDI;
      const dailyFactor = calculateDailyCDIFactor(rateForDay, percentOfCDI);
      // Acumula truncando o produtório em 16 casas decimais (padrão B3)
      accumulatedFactor = truncateDecimal(accumulatedFactor * dailyFactor, 16);
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // Saldo bruto truncado em 2 casas decimais
  const grossBalance = truncateDecimal(principal * accumulatedFactor, 2);
  const grossYield = truncateDecimal(grossBalance - principal, 2);
  const effectiveReturnPct = principal > 0 ? truncateDecimal(((grossBalance - principal) / principal) * 100, 4) : 0;

  return {
    principal,
    grossBalance,
    grossYield,
    businessDays,
    calendarDays,
    accumulatedFactor,
    effectiveReturnPct,
  };
}

