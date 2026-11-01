import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isUserAuthorized } from '@/utils/security/auth-guard'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/utils/security/rate-limiter'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getClientIp(request)

  // 1. Rate Limiting em Rotas Sensíveis e Caras (LLMs, Uploads, Auth)
  if (pathname.startsWith('/api/ai/') || pathname.startsWith('/api/chat')) {
    // Máximo 40 requisições por minuto por IP para endpoints de IA
    const rl = checkRateLimit(`ai_${ip}`, 40, 60 * 1000)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)
  }

  if (pathname.startsWith('/api/auth') || pathname.startsWith('/login') || pathname.startsWith('/signup')) {
    // Máximo 15 requisições por minuto por IP para rotas de autenticação (anti-bruteforce)
    const rl = checkRateLimit(`auth_${ip}`, 15, 60 * 1000)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)
  }

  // 2. Inicialização do Supabase Server Client com propagação de cookies
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Headers de Segurança HTTP Fundamentais (OWASP & WAF)
  supabaseResponse.headers.set('X-Frame-Options', 'DENY')
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  supabaseResponse.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(), interest-cohort=()'
  )

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 3. Validação autoritativa da sessão
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const protectedPrefixes = [
    '/dashboard',
    '/assets',
    '/cards',
    '/investments',
    '/holdings',
    '/transactions',
    '/insights',
    '/goals',
    '/kitsune',
    '/agents',
    '/connections',
    '/shared',
    '/settings',
    '/profile',
    '/admin',
  ]

  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p))

  // Não autenticado tentando acessar área interna -> /login
  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c.name, c.value))
    return redirectResponse
  }

  // Autenticado: checar se está na Allowlist de usuários autorizados
  if (isProtected && user && user.email) {
    const authCheck = await isUserAuthorized(user.email)
    if (!authCheck.authorized) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('access_denied', 'true')
      url.searchParams.set(
        'error_description',
        `Acesso Restrito: A conta ${user.email} não possui autorização neste ambiente.`
      )
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c.name, c.value))
      return redirectResponse
    }

    // Proteção de rota /admin: estritamente reservada a Owner ou Admin
    if (pathname.startsWith('/admin') && authCheck.role !== 'owner' && authCheck.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
