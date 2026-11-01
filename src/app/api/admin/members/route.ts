import { NextResponse } from 'next/server';
import { assertAdminAccess } from '@/utils/security/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';

const AddMemberSchema = z.object({
  email: z.string().email('E-mail em formato inválido').max(120),
  role: z.enum(['admin', 'member']).default('member'),
  notes: z.string().max(255).optional(),
});

const UpdateMemberSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['active', 'suspended', 'revoked']),
  role: z.enum(['admin', 'member']).optional(),
  notes: z.string().max(255).optional(),
});

/**
 * GET /api/admin/members
 * Lista todos os membros autorizados (requer privilégio de owner/admin)
 */
export async function GET() {
  const adminCheck = await assertAdminAccess();
  if (!adminCheck.authorized) {
    return NextResponse.json(
      { error: adminCheck.errorResponse?.error || 'Acesso negado' },
      { status: adminCheck.errorResponse?.status || 403 }
    );
  }

  try {
    const supabase = await createClient();
    const { data: members, error } = await supabase
      .from('allowed_members')
      .select('id, email, role, status, notes, created_by, created_at, updated_at')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Erro ao listar membros' }, { status: 500 });
    }

    return NextResponse.json({
      members: members || [],
      currentUserEmail: adminCheck.userEmail,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Falha interna do servidor' }, { status: 500 });
  }
}

/**
 * POST /api/admin/members
 * Adiciona um novo e-mail à lista de autorizados
 */
export async function POST(request: Request) {
  const adminCheck = await assertAdminAccess();
  if (!adminCheck.authorized) {
    return NextResponse.json(
      { error: adminCheck.errorResponse?.error || 'Acesso negado' },
      { status: adminCheck.errorResponse?.status || 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = AddMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.issues.map((i) => i.message) },
        { status: 400 }
      );
    }

    const { email, role, notes } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('allowed_members')
      .insert({
        email: normalizedEmail,
        role,
        status: 'active',
        notes: notes || null,
        created_by: adminCheck.userEmail,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Este e-mail já está cadastrado na lista de acessos.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Erro ao cadastrar membro' }, { status: 500 });
    }

    return NextResponse.json({ success: true, member: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Falha ao processar requisição' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/members
 * Atualiza status ou permissão de um membro
 */
export async function PATCH(request: Request) {
  const adminCheck = await assertAdminAccess();
  if (!adminCheck.authorized) {
    return NextResponse.json(
      { error: adminCheck.errorResponse?.error || 'Acesso negado' },
      { status: adminCheck.errorResponse?.status || 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = UpdateMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const { id, status, role, notes } = parsed.data;
    const supabase = await createClient();

    // Protege para nunca rebaixar ou revogar o Master Owner
    const { data: target } = await supabase
      .from('allowed_members')
      .select('email, role')
      .eq('id', id)
      .single();

    if (target?.role === 'owner') {
      return NextResponse.json(
        { error: 'O Master Owner do sistema não pode ter seu status alterado.' },
        { status: 403 }
      );
    }

    const updates: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (role) updates.role = role;
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabase
      .from('allowed_members')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Erro ao atualizar membro' }, { status: 500 });
    }

    return NextResponse.json({ success: true, member: data });
  } catch (err) {
    return NextResponse.json({ error: 'Falha interna' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/members?id=uuid
 * Remove definitivamente um membro da lista de autorizados
 */
export async function DELETE(request: Request) {
  const adminCheck = await assertAdminAccess();
  if (!adminCheck.authorized) {
    return NextResponse.json(
      { error: adminCheck.errorResponse?.error || 'Acesso negado' },
      { status: adminCheck.errorResponse?.status || 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do membro é obrigatório' }, { status: 400 });
    }

    const supabase = await createClient();

    // Impede exclusão do Master Owner
    const { data: target } = await supabase
      .from('allowed_members')
      .select('email, role')
      .eq('id', id)
      .single();

    if (target?.role === 'owner') {
      return NextResponse.json(
        { error: 'O Master Owner do sistema não pode ser removido.' },
        { status: 403 }
      );
    }

    const { error } = await supabase.from('allowed_members').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: 'Erro ao deletar membro' }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err) {
    return NextResponse.json({ error: 'Falha interna ao deletar' }, { status: 500 });
  }
}

