import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Proteção de rotas — política "negar por padrão".
 *
 * A versão anterior listava explicitamente as telas protegidas. Toda tela nova
 * nascia PÚBLICA até alguém lembrar de acrescentá-la ao matcher — e sete áreas
 * já estavam expostas dessa forma (/links, /monetizacao, /integracoes,
 * /whatsapp, /admin, /conta, /videos).
 *
 * Agora o matcher cobre o site inteiro e só as rotas abaixo ficam de fora.
 * Uma tela nova nasce protegida; esquecer de atualizar esta lista causa, no
 * pior caso, um login a mais — nunca um vazamento.
 */
const ROTAS_PUBLICAS = [
  '/login',
  '/register',
  '/esqueci-senha',
  '/redefinir-senha',
  // Páginas institucionais: identificam a empresa responsável para
  // parceiros e plataformas (ex.: validação do TikTok Shop Partner Center).
  // Só texto — nenhum dado de usuária ou de workspace.
  '/sobre',
  '/privacidade',
  '/termos',
]

// Prefixos de API que precisam ser alcançáveis sem sessão:
// - /api/auth  → o próprio fluxo de login/registro/recuperação do NextAuth
// - /api/l     → redirecionamento público dos links de afiliada (/go/:slug)
// - /api/cron  → chamada pela Vercel Cron, autenticada por CRON_SECRET
const PREFIXOS_API_PUBLICOS = ['/api/auth', '/api/l/', '/api/cron']

function ehPublica(pathname: string): boolean {
  if (ROTAS_PUBLICAS.includes(pathname)) return true
  return PREFIXOS_API_PUBLICOS.some((p) => pathname.startsWith(p))
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (ehPublica(pathname)) return NextResponse.next()

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (token) return NextResponse.next()

  // Sem sessão. A resposta muda conforme quem está pedindo:
  //
  // - Rota de API → 401 em JSON. Redirecionar aqui devolveria o HTML da tela
  //   de login para um `fetch()`, que quebraria no `res.json()` e mostraria
  //   um erro técnico ("Unexpected token <") para a usuária.
  // - Tela        → redireciona para /login, guardando para onde ela queria ir.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
  }

  const login = new URL('/login', req.url)
  login.searchParams.set('callbackUrl', pathname + req.nextUrl.search)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: [
    /*
     * Todas as rotas, exceto:
     * - _next/static, _next/image  → assets do build
     * - favicon.ico, robots.txt, sitemap.xml
     * - arquivos com extensão (imagens, fontes, etc.) servidos de /public
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[\\w]+$).*)',
  ],
}
