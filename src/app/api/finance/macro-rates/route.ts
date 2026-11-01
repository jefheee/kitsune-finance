import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { fetchLiveMacroRates } from '@/utils/finance/macro-rates';

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rates = await fetchLiveMacroRates();
        return NextResponse.json(rates);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erro ao consultar taxas macroeconômicas';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
