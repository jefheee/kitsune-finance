import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  analyzeLandSurroundings,
  calculateRealEstateMarketMetrics,
} from '@/utils/finance/engine/land-valuation';

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
    const {
      lat,
      lng,
      radiusMeters = 2000,
      areaSqm = 300,
      state = '',
      city = '',
      propertyType = 'house',
    } = body;

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return NextResponse.json(
        { error: 'Latitude e Longitude válidas são obrigatórias.' },
        { status: 400 }
      );
    }

    const analysis = await analyzeLandSurroundings(parsedLat, parsedLng, Number(radiusMeters) || 2000);

    const marketMetrics = calculateRealEstateMarketMetrics(
      Number(areaSqm) || 300,
      String(state || ''),
      String(city || ''),
      propertyType as 'house' | 'apartment' | 'land' | 'commercial',
      analysis.attractivenessMultiplier
    );

    analysis.marketMetrics = marketMetrics;

    return NextResponse.json(analysis);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao processar radar de infraestrutura';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
