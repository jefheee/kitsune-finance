import { createClient } from '@/utils/supabase/server';

export const MASTER_OWNER_EMAIL = 'jnnebu@gmail.com';

export const DEFAULT_ALLOWED_EMAILS = [
  'jnnebu@gmail.com',
  'fabianadecastro3@gmail.com',
  'jacsonph79@gmail.com',
];

/**
 * Verifica no servidor se um e-mail possui autorização de acesso ao sistema.
 * Prioridade:
 * 1. Master Owner (jnnebu@gmail.com) - Acesso incondicional
 * 2. Variável de ambiente ALLOWED_USERS_EMAILS (se definida na Vercel/env)
 * 3. Tabela public.allowed_members no Supabase (gerenciada pelo Admin)
 * 4. Fallback seguro para DEFAULT_ALLOWED_EMAILS
 */
export async function isUserAuthorized(email: string | null | undefined): Promise<{
  authorized: boolean;
  role: 'owner' | 'admin' | 'member' | 'unauthorized';
  reason?: string;
}> {
  if (!email) {
    return { authorized: false, role: 'unauthorized', reason: 'Email não informado' };
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 1. Master Owner Supremo
  if (normalizedEmail === MASTER_OWNER_EMAIL.toLowerCase()) {
    return { authorized: true, role: 'owner' };
  }

  // 2. Variável de ambiente (Vercel ou .env)
  const envList = process.env.ALLOWED_USERS_EMAILS
    ? process.env.ALLOWED_USERS_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
    : [];

  if (envList.includes(normalizedEmail)) {
    return { authorized: true, role: 'member' };
  }

  // 3. Consulta à tabela allowed_members via Supabase
  try {
    const supabase = await createClient();
    const { data: member, error } = await supabase
      .from('allowed_members')
      .select('email, role, status')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (!error && member) {
      if (member.status === 'active') {
        return {
          authorized: true,
          role: (member.role as 'owner' | 'admin' | 'member') || 'member',
        };
      } else {
        return {
          authorized: false,
          role: 'unauthorized',
          reason: `Acesso ${member.status === 'suspended' ? 'suspenso' : 'revogado'}`,
        };
      }
    }
  } catch (err) {
    console.warn('[Authorization Guard] Aviso ao consultar allowed_members:', err);
  }

  // 4. Fallback para lista padrão hardcoded segura
  if (DEFAULT_ALLOWED_EMAILS.map((e) => e.toLowerCase()).includes(normalizedEmail)) {
    return { authorized: true, role: 'member' };
  }

  return { authorized: false, role: 'unauthorized', reason: 'Email não autorizado na plataforma' };
}

/**
 * Checa se o usuário logado tem privilégio administrativo para gerenciar acessos.
 */
export async function assertAdminAccess(): Promise<{
  authorized: boolean;
  userEmail: string;
  errorResponse?: { error: string; status: number };
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !user.email) {
    return {
      authorized: false,
      userEmail: '',
      errorResponse: { error: 'Unauthorized: Autenticação necessária', status: 401 },
    };
  }

  const authCheck = await isUserAuthorized(user.email);
  if (!authCheck.authorized || (authCheck.role !== 'owner' && authCheck.role !== 'admin')) {
    return {
      authorized: false,
      userEmail: user.email,
      errorResponse: { error: 'Forbidden: Acesso restrito a administradores', status: 403 },
    };
  }

  return { authorized: true, userEmail: user.email };
}

