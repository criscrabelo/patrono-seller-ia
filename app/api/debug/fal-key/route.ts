import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Endpoint de diagnóstico — confirma que a FAL_KEY foi lida pelo build
// e mostra apenas prefixo + sufixo + formato (não expõe o segredo).
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const key = process.env.FAL_KEY
  if (!key) {
    return NextResponse.json({
      ok: false,
      message: 'FAL_KEY NÃO está nas variáveis de ambiente do servidor',
    })
  }

  return NextResponse.json({
    ok: true,
    tamanho: key.length,
    prefixo: key.slice(0, 6),
    sufixo: key.slice(-4),
    contemDoisPontos: key.includes(':'),
    formatoFalAiClassico: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]+$/i.test(key),
    primeirosCaracteresSugerem:
      key.startsWith('sk_live_') ? 'Stripe (NÃO é fal.ai)' :
      key.startsWith('sk-') ? 'OpenAI (NÃO é fal.ai)' :
      key.startsWith('fal_') ? 'fal.ai novo formato' :
      key.match(/^[0-9a-f]{8}-/) ? 'fal.ai formato clássico (UUID)' :
      'formato não reconhecido',
  })
}
