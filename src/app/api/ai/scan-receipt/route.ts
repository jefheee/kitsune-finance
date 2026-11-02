import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateWithGeminiPool } from '@/utils/ai/gemini';

export const runtime = 'nodejs';
export const maxDuration = 60;

const COMMON_CATEGORIES = [
  'Alimentação & Restaurantes',
  'Supermercado',
  'Transporte & Combustível',
  'Moradia & Contas',
  'Saúde & Farmácia',
  'Lazer & Entretenimento',
  'Compras & Vestuário',
  'Serviços & Assinaturas',
  'Rendimento & Vendas',
  'Outros',
];

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const body = await req.json();
    const { fileBase64, mimeType = 'image/jpeg' } = body;

    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Documento ou comprovante não fornecido.' },
        { status: 400 }
      );
    }

    // Limpa prefixo data:image/xxx;base64 se presente
    const cleanedBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');

    const systemInstruction = `Você é o Scanner Inteligente de Comprovantes e Documentos do Kitsune Finance.
Sua missão é extrair com precisão absoluta as informações financeiras de comprovantes de pagamento (Pix, TED, DOC), notas fiscais (NF-e, NFC-e, Danfe), cupons de cartão de crédito/débito, faturas e recibos.
Categorias financeiras permitidas:
${COMMON_CATEGORIES.map((c) => `- "${c}"`).join('\n')}

DIRETRIZES:
1. Extraia o valor TOTAL pago ou recebido em reais (R$). Se for débito/gasto, type = "DEBIT". Se for recebimento/Pix recebido, type = "CREDIT".
2. Identifique o nome limpo do estabelecimento, loja ou pessoa (ex: "Droga Raia", "Posto Ipiranga", "Pix para Maria Santos", "Uber").
3. Identifique a data do comprovante no formato ISO "AAAA-MM-DD". Se não houver ano explícito, assuma o ano atual (2026).
4. Se identificar parcelamento (ex: 3x, parcela 1 de 5), marque isInstallment: true e totalInstallments: número.
5. Selecione a categoria mais precisa entre as permitidas.

RETORNO MANDATÓRIO: Responda EXCLUSIVAMENTE em formato JSON VÁLIDO sem cercaduras de texto:
{
  "description": "Nome da loja ou descrição limpa",
  "amount": 120.50,
  "date": "2026-11-01",
  "category": "Supermercado",
  "type": "DEBIT",
  "isInstallment": false,
  "totalInstallments": 1,
  "notes": "CNPJ ou detalhe adicional identificado"
}`;

    const prompt = 'Analise este comprovante ou nota fiscal e extraia os dados da transação com exatidão matemática.';

    const aiResponse = await generateWithGeminiPool({
      systemInstruction,
      prompt,
      preferredModel: 'gemini-3.8-flash',
      temperature: 0.1,
      images: [
        {
          mimeType: mimeType.includes('pdf') ? 'application/pdf' : mimeType,
          data: cleanedBase64,
        },
      ],
    });

    let result = {
      description: 'Lançamento via Comprovante',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      category: 'Outros',
      type: 'DEBIT',
      isInstallment: false,
      totalInstallments: 1,
      notes: '',
    };

    try {
      const cleanJson = aiResponse.text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      const parsed = JSON.parse(cleanJson);
      result = {
        description: parsed.description || result.description,
        amount: typeof parsed.amount === 'number' ? Math.abs(parsed.amount) : parseFloat(String(parsed.amount).replace(',', '.')) || 0,
        date: parsed.date || result.date,
        category: COMMON_CATEGORIES.includes(parsed.category) ? parsed.category : 'Outros',
        type: parsed.type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
        isInstallment: Boolean(parsed.isInstallment),
        totalInstallments: Number(parsed.totalInstallments) || 1,
        notes: parsed.notes || '',
      };
    } catch (parseError) {
      console.error('[Scan Receipt] Erro no parse JSON da IA:', parseError, aiResponse.text);
    }

    return NextResponse.json({
      success: true,
      data: result,
      modelUsed: aiResponse.modelUsed,
    });
  } catch (error: any) {
    console.error('[Scan Receipt API Error]:', error);
    return NextResponse.json(
      { error: 'Falha ao processar a leitura do comprovante.' },
      { status: 500 }
    );
  }
}

