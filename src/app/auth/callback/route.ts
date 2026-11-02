import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isUserAuthorized } from '@/utils/security/auth-guard'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  // Determinar a origem pública correta (suporte a proxies de borda na Vercel)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const isLocalEnv = process.env.NODE_ENV === 'development'
  const publicOrigin = isLocalEnv ? origin : (host ? `${proto}://${host}` : origin)

  const authError = searchParams.get('error_description') || searchParams.get('error')
  if (authError) {
    return NextResponse.redirect(`${publicOrigin}/login?error_description=${encodeURIComponent(authError)}`)
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set({ name, value, ...options })
              })
            } catch (error) {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      }
    )
    
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && sessionData?.user) {
      const userEmail = sessionData.user.email

      // 🚨 BLINDAGEM DE ACESSO: Valida se o usuário tem permissão para entrar
      const authCheck = await isUserAuthorized(userEmail)

      if (!authCheck.authorized) {
        // 🧹 Higienização Instantânea: Expurga o usuário de auth.users para evitar poluição no banco
        try {
          await supabase.rpc('delete_unauthorized_user', { target_user_id: sessionData.user.id })
        } catch (cleanupErr) {
          console.error('[OAuth Callback] Erro ao expurgar usuário não autorizado:', cleanupErr)
        }

        // Encerra imediatamente a sessão recém-criada
        await supabase.auth.signOut()

        const reason = encodeURIComponent(
          `Acesso Restrito: A conta ${userEmail || ''} não possui autorização neste ambiente privado.`
        )
        return NextResponse.redirect(`${publicOrigin}/login?access_denied=true&error_description=${reason}`)
      }

      return NextResponse.redirect(`${publicOrigin}${next}`)
    } else {
      const errMsg = error ? error.message : 'Falha na troca de sessão'
      return NextResponse.redirect(`${publicOrigin}/login?error_description=${encodeURIComponent(errMsg)}`)
    }
  }

  return NextResponse.redirect(`${publicOrigin}/login?error=true`)
}
