import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isUserAuthorized } from '@/utils/security/auth-guard'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  const authError = searchParams.get('error_description') || searchParams.get('error')
  if (authError) {
    return NextResponse.redirect(`${origin}/login?error_description=${encodeURIComponent(authError)}`)
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
        // Encerra imediatamente a sessão recém-criada
        await supabase.auth.signOut()

        const reason = encodeURIComponent(
          `Acesso Restrito: A conta ${userEmail || ''} não possui autorização neste ambiente privado.`
        )
        return NextResponse.redirect(`${origin}/login?access_denied=true&error_description=${reason}`)
      }

      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    } else {
      const errMsg = error ? error.message : 'Falha na troca de sessão'
      return NextResponse.redirect(`${origin}/login?error_description=${encodeURIComponent(errMsg)}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=true`)
}
