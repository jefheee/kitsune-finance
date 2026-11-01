import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { CustomAssetCategorySchema } from '@/types/finance';

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

    const { data: assets, error } = await supabase
      .from('custom_assets')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assets: assets || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
    const {
      name,
      category,
      acquisition_date,
      acquisition_value,
      current_value,
      metadata = {},
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Nome do ativo é obrigatório.' }, { status: 400 });
    }

    const parsedCategory = CustomAssetCategorySchema.safeParse(category);
    if (!parsedCategory.success) {
      return NextResponse.json(
        { error: 'Categoria inválida. Use vehicle, real_estate, land, fgts ou other.' },
        { status: 400 }
      );
    }

    const payload = {
      user_id: user.id,
      name: name.trim(),
      category: parsedCategory.data,
      acquisition_date: acquisition_date || null,
      acquisition_value: Number(acquisition_value) || 0,
      current_value: Number(current_value) || 0,
      metadata: typeof metadata === 'object' && metadata !== null ? metadata : {},
    };

    const { data: createdAsset, error } = await supabase
      .from('custom_assets')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ asset: createdAsset }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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
    const { id, name, category, acquisition_date, acquisition_value, current_value, metadata } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID do ativo é obrigatório para atualização.' }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {};

    if (name && typeof name === 'string') updatePayload.name = name.trim();
    if (category) {
      const parsedCategory = CustomAssetCategorySchema.safeParse(category);
      if (parsedCategory.success) updatePayload.category = parsedCategory.data;
    }
    if (acquisition_date !== undefined) updatePayload.acquisition_date = acquisition_date || null;
    if (acquisition_value !== undefined) updatePayload.acquisition_value = Number(acquisition_value) || 0;
    if (current_value !== undefined) updatePayload.current_value = Number(current_value) || 0;
    if (metadata !== undefined && typeof metadata === 'object' && metadata !== null) {
      updatePayload.metadata = metadata;
    }

    const { data: updatedAsset, error } = await supabase
      .from('custom_assets')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ asset: updatedAsset });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do ativo ausente.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('custom_assets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
