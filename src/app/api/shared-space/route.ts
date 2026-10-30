import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'KT-';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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

    // 1. Verificar se o usuário atual possui pelo menos 1 conta bancária conectada
    const { count: userAccountsCount } = await supabase
      .from('bank_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const hasConnectedBank = (userAccountsCount || 0) > 0;

    // 2. Buscar conexões onde o usuário é o solicitante ou o destinatário
    const userEmail = user.email?.toLowerCase().trim();
    const { data: connections, error: connError } = await supabase
      .from('shared_connections')
      .select('*')
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id},recipient_email.ilike.${userEmail}`)
      .order('created_at', { ascending: false });

    if (connError) {
      return NextResponse.json({ error: connError.message }, { status: 500 });
    }

    // 3. Encontrar todas as conexões ativas aceitas (suporte multi-membros no Espaço Compartilhado)
    const activeConnections = connections?.filter((c) => c.status === 'accepted') || [];
    const activeConnection = activeConnections[0] || null;
    let partnerProfile = null;
    let partnerAccountsCount = 0;
    const activePartners: any[] = [];

    if (activeConnections.length > 0) {
      for (const conn of activeConnections) {
        const partnerId =
          conn.requester_id === user.id
            ? conn.recipient_id
            : conn.requester_id;

        if (partnerId) {
          const [profileRes, accountsRes, invRes, txnRes] = await Promise.all([
            supabase
              .from('users_profile')
              .select('id, display_name, full_name, avatar_url')
              .eq('id', partnerId)
              .maybeSingle(),
            supabase
              .from('bank_accounts')
              .select('*')
              .eq('user_id', partnerId)
              .order('balance', { ascending: false }),
            supabase
              .from('investments')
              .select('*')
              .eq('user_id', partnerId)
              .order('balance', { ascending: false }),
            supabase
              .from('transactions')
              .select('*, bank_accounts(bank_name, institution_name, institution_slug, product_name, type, subtype, card_brand)')
              .eq('user_id', partnerId)
              .order('date', { ascending: false })
              .limit(50),
          ]);

          const prof = profileRes.data || { id: partnerId };
          activePartners.push({
            ...prof,
            role: conn.role,
            connection_id: conn.id,
            accountsCount: accountsRes.data?.length || 0,
            accounts: accountsRes.data || [],
            investments: invRes.data || [],
            transactions: txnRes.data || [],
          });

          if (!partnerProfile) {
            partnerProfile = prof;
            partnerAccountsCount = accountsRes.data?.length || 0;
          }
        }
      }
    }

    // Buscar contas e investimentos do usuário atual para a visualização consolidada do Espaço Compartilhado
    const [myAccountsRes, myInvRes, myTxnRes] = await Promise.all([
      supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('balance', { ascending: false }),
      supabase
        .from('investments')
        .select('*')
        .eq('user_id', user.id)
        .order('balance', { ascending: false }),
      supabase
        .from('transactions')
        .select('*, bank_accounts(bank_name, institution_name, institution_slug, product_name, type, subtype, card_brand)')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(50),
    ]);

    return NextResponse.json({
      canInvite: hasConnectedBank,
      userAccountsCount: userAccountsCount || 0,
      userAccounts: myAccountsRes.data || [],
      userInvestments: myInvRes.data || [],
      userTransactions: myTxnRes.data || [],
      connections: connections || [],
      activeConnection,
      activeConnections,
      activePartners,
      partnerProfile,
      partnerAccountsCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
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

    // 1. Validar pré-requisito: Usuário DEVE ter ao menos 1 conta bancária conectada
    const { count: accountsCount } = await supabase
      .from('bank_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (!accountsCount || accountsCount === 0) {
      return NextResponse.json(
        {
          error:
            'Para criar um Espaço Compartilhado, você precisa ter pelo menos uma instituição bancária conectada via Open Finance.',
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { email, name, role } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'E-mail do parceiro(a) cadastrado é obrigatório e deve ser válido.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const myEmail = user.email?.toLowerCase().trim();

    if (cleanEmail === myEmail) {
      return NextResponse.json(
        { error: 'Você não pode criar um Espaço Compartilhado com seu próprio e-mail.' },
        { status: 400 }
      );
    }

    // Buscar perfil do usuário atual para obter seu nome
    const { data: myProfile } = await supabase
      .from('users_profile')
      .select('display_name, full_name')
      .eq('id', user.id)
      .maybeSingle();

    const requesterName = myProfile?.display_name || myProfile?.full_name || 'Seu Parceiro';

    // Verificar se já existe conexão pendente ou aceita entre ambos
    const { data: existing } = await supabase
      .from('shared_connections')
      .select('*')
      .or(
        `and(requester_id.eq.${user.id},recipient_email.ilike.${cleanEmail}),and(requester_email.ilike.${cleanEmail},recipient_id.eq.${user.id})`
      )
      .in('status', ['pending', 'accepted'])
      .maybeSingle();

    if (existing) {
      if (existing.status === 'accepted') {
        return NextResponse.json(
          { error: 'Você já possui uma conexão compartilhada ativa com esta conta.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          error: 'Já existe um convite pendente para este e-mail.',
          inviteCode: existing.invite_code,
          connection: existing,
        },
        { status: 400 }
      );
    }

    // Tenta resolver o ID do destinatário pelo RPC de segurança ou pelo perfil
    let resolvedRecipientId: string | null = null;
    let resolvedRecipientName: string | null = name?.trim() || null;

    try {
      const { data: foundId } = await supabase.rpc('find_user_by_email', { target_email: cleanEmail });
      if (foundId) {
        resolvedRecipientId = foundId;
      }
    } catch {
      // quiet fallback
    }

    if (!resolvedRecipientId) {
      const { data: recipientProfile } = await supabase
        .from('users_profile')
        .select('id, display_name, full_name')
        .contains('emails', [cleanEmail])
        .maybeSingle();

      if (recipientProfile?.id) {
        resolvedRecipientId = recipientProfile.id;
        resolvedRecipientName = resolvedRecipientName || recipientProfile.display_name || recipientProfile.full_name || null;
      }
    }

    const inviteCode = generateInviteCode();

    const { data: newConn, error: insertError } = await supabase
      .from('shared_connections')
      .insert({
        requester_id: user.id,
        requester_email: myEmail || '',
        requester_name: requesterName,
        recipient_email: cleanEmail,
        recipient_id: resolvedRecipientId,
        recipient_name: resolvedRecipientName,
        role: role?.trim() || 'Cônjuge',
        invite_code: inviteCode,
        status: 'pending',
      })
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Se o usuário convidado já tem conta no sistema, criar notificação in-app imediata
    if (resolvedRecipientId) {
      await supabase.from('user_notifications').insert({
        user_id: resolvedRecipientId,
        type: 'invite_received',
        title: 'Convite para Espaço Compartilhado',
        message: `${requesterName} convidou você para vincular contas no Espaço Compartilhado (${role || 'Cônjuge'}). Código: ${inviteCode}`,
        data: {
          connection_id: newConn.id,
          invite_code: inviteCode,
          requester_name: requesterName,
          role: role || 'Cônjuge',
        },
      });
    }

    return NextResponse.json({
      success: true,
      connection: newConn,
      inviteCode,
      invite_code: inviteCode,
      inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://kitsune-finance.vercel.app'}/dashboard?accept_invite=${inviteCode}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Validar se o usuário que está aceitando possui ao menos 1 conta bancária
    const { count: accountsCount } = await supabase
      .from('bank_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (!accountsCount || accountsCount === 0) {
      return NextResponse.json(
        {
          error:
            'Para aceitar e ativar o Espaço Compartilhado, você precisa ter pelo menos uma instituição bancária conectada na sua conta.',
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const rawCode = (body.code || body.inviteCode || body.invite_code || '') as string;
    const { connectionId, action } = body;

    // Buscar a conexão pelo código ou ID
    let query = supabase.from('shared_connections').select('*');
    if (rawCode) {
      query = query.eq('invite_code', rawCode.trim().toUpperCase());
    } else if (connectionId) {
      query = query.eq('id', connectionId);
    } else {
      return NextResponse.json({ error: 'Código de convite ou ID da conexão é obrigatório.' }, { status: 400 });
    }

    const { data: conn, error: findError } = await query.maybeSingle();

    if (findError || !conn) {
      return NextResponse.json({ error: 'Convite não encontrado ou inválido.' }, { status: 404 });
    }

    if (conn.requester_id === user.id) {
      return NextResponse.json({ error: 'Você não pode aceitar um convite criado por você mesmo.' }, { status: 400 });
    }

    if (conn.status === 'accepted') {
      return NextResponse.json({ error: 'Este convite já foi aceito e está ativo.' }, { status: 400 });
    }

    // Buscar perfil do usuário aceitante
    const { data: myProfile } = await supabase
      .from('users_profile')
      .select('display_name, full_name')
      .eq('id', user.id)
      .maybeSingle();

    const recipientName = myProfile?.display_name || myProfile?.full_name || user.email || 'Parceiro';

    if (action === 'reject') {
      await supabase
        .from('shared_connections')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', conn.id);

      return NextResponse.json({ success: true, status: 'rejected' });
    }

    // Aceitar convite
    const { data: updatedConn, error: updateError } = await supabase
      .from('shared_connections')
      .update({
        recipient_id: user.id,
        recipient_name: recipientName,
        recipient_email: user.email?.toLowerCase().trim(),
        status: 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conn.id)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Notificar o solicitante que o convite foi aceito
    await supabase.from('user_notifications').insert({
      user_id: conn.requester_id,
      type: 'invite_accepted',
      title: 'Espaço Compartilhado Ativado!',
      message: `${recipientName} aceitou seu convite! Agora seus dados financeiros de cônjuges/parceiros estão unificados.`,
      data: {
        connection_id: conn.id,
        partner_id: user.id,
        partner_name: recipientName,
      },
    });

    return NextResponse.json({
      success: true,
      status: 'accepted',
      connection: updatedConn,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID da conexão é obrigatório.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('shared_connections')
      .delete()
      .eq('id', id)
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
