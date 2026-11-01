import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface PlateLookupResponse {
  plate: string;
  isMercosul: boolean;
  ufEstimate?: string;
  brand?: string;
  model?: string;
  year?: number;
  fuel?: string;
  fipeCode?: string;
  source: 'gateway_api' | 'denatran_prefix_resolver';
  message: string;
  requiresApiKey?: boolean;
}

/**
 * Tabela oficial de faixas de letras de placas brasileiras por Unidade Federativa (Denatran/Senatran).
 */
const BRAZILIAN_PLATE_RANGES: Array<{ uf: string; start: string; end: string }> = [
  { uf: 'PR', start: 'AAA', end: 'BEZ' },
  { uf: 'SP', start: 'BFA', end: 'GKI' },
  { uf: 'MG', start: 'GKJ', end: 'HOK' },
  { uf: 'MA', start: 'HOL', end: 'HQE' },
  { uf: 'MS', start: 'HQF', end: 'HTW' },
  { uf: 'CE', start: 'HTX', end: 'HZA' },
  { uf: 'SE', start: 'HZB', end: 'IAP' },
  { uf: 'RS', start: 'IAQ', end: 'JDO' },
  { uf: 'BA', start: 'JDP', end: 'JKR' },
  { uf: 'PE', start: 'JKS', end: 'KPL' },
  { uf: 'RJ', start: 'KPM', end: 'LVK' },
  { uf: 'PI', start: 'LVL', end: 'LWQ' },
  { uf: 'SC', start: 'LWR', end: 'MMM' },
  { uf: 'PB', start: 'MMN', end: 'MOW' },
  { uf: 'ES', start: 'MOX', end: 'MTZ' },
  { uf: 'AL', start: 'MUA', end: 'MVK' },
  { uf: 'TO', start: 'MVL', end: 'MXG' },
  { uf: 'GO', start: 'MXH', end: 'NFD' },
  { uf: 'RN', start: 'NFE', end: 'NIZ' },
  { uf: 'AM', start: 'NJA', end: 'NPU' },
  { uf: 'MT', start: 'NPV', end: 'NQR' },
  { uf: 'AP', start: 'NQS', end: 'NRE' },
  { uf: 'PA', start: 'NRF', end: 'NSD' },
  { uf: 'RR', start: 'NSE', end: 'NTC' },
  { uf: 'AC', start: 'NTE', end: 'NVP' },
  { uf: 'RO', start: 'NVQ', end: 'NXZ' },
  { uf: 'DF', start: 'OBC', end: 'OBZ' },
];

function estimateUfFromPlatePrefix(letters: string): string | undefined {
  if (letters.length < 3) return undefined;
  const prefix = letters.slice(0, 3).toUpperCase();
  for (const range of BRAZILIAN_PLATE_RANGES) {
    if (prefix >= range.start && prefix <= range.end) {
      return range.uf;
    }
  }
  return undefined;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const rawPlate = String(body.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!rawPlate || rawPlate.length !== 7) {
      return NextResponse.json(
        { error: 'Formato de placa inválido. Digite 7 caracteres (ex: ABC1D23 ou ABC1234).' },
        { status: 400 }
      );
    }

    const isMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(rawPlate);
    const isOldPattern = /^[A-Z]{3}[0-9]{4}$/.test(rawPlate);

    if (!isMercosul && !isOldPattern) {
      return NextResponse.json(
        { error: 'A placa deve estar no padrão Mercosul (ABC1D23) ou tradicional (ABC1234).' },
        { status: 400 }
      );
    }

    const ufEstimate = estimateUfFromPlatePrefix(rawPlate.slice(0, 3));

    // 1. Verificação de chaves de API comerciais no ambiente (.env)
    const apiBrasilToken = process.env.APIBRASIL_TOKEN || process.env.API_BRASIL_SECRET;
    const wdApiToken = process.env.WDAPI_TOKEN || process.env.PLACA_API_KEY;

    if (apiBrasilToken) {
      try {
        const response = await fetch('https://gateway.apibrasil.io/api/v2/vehicles/dados', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiBrasilToken}`,
          },
          body: JSON.stringify({ placa: rawPlate }),
          signal: AbortSignal.timeout(6000),
        });

        if (response.ok) {
          const data = await response.json();
          const vehicle = data.dados || data.veiculo || data;
          return NextResponse.json({
            plate: rawPlate,
            isMercosul,
            ufEstimate: vehicle.uf || ufEstimate,
            brand: vehicle.marca,
            model: vehicle.modelo,
            year: Number(vehicle.anoModelo || vehicle.ano),
            fuel: vehicle.combustivel,
            fipeCode: vehicle.fipe_codigo || vehicle.codigoFipe,
            source: 'gateway_api',
            message: 'Veículo identificado via gateway APIBrasil.',
          } as PlateLookupResponse);
        }
      } catch (err) {
        console.warn('[PlateAPI] Erro ao consultar APIBrasil:', err);
      }
    }

    if (wdApiToken) {
      try {
        const response = await fetch(`https://wdapi2.com.br/consulta/${rawPlate}/${wdApiToken}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(6000),
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            plate: rawPlate,
            isMercosul,
            ufEstimate: data.uf || ufEstimate,
            brand: data.marca,
            model: data.modelo,
            year: Number(data.anoModelo || data.ano),
            fuel: data.combustivel,
            fipeCode: data.codigo_fipe,
            source: 'gateway_api',
            message: 'Veículo identificado via gateway WDAPI.',
          } as PlateLookupResponse);
        }
      } catch (err) {
        console.warn('[PlateAPI] Erro ao consultar WDAPI:', err);
      }
    }

    // 2. Resposta quando não há chave comercial configurada
    return NextResponse.json({
      plate: rawPlate,
      isMercosul,
      ufEstimate,
      source: 'denatran_prefix_resolver',
      requiresApiKey: false,
      message: `Placa válida (${isMercosul ? 'Padrão Mercosul' : 'Padrão Tradicional'})${
        ufEstimate ? ` registrada na UF de ${ufEstimate}` : ''
      }. Para dados profundos com chassi e Renavam automático via Detran, configure seu token da APIBrasil ou WDAPI no cofre. Selecione abaixo a montadora para carregar a FIPE oficial instantânea.`,
    } as PlateLookupResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao processar consulta de placa';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
