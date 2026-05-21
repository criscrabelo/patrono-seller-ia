import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Diagnóstico do token do Instagram — testa o token salvo contra
// graph.instagram.com e graph.facebook.com e mostra a resposta crua.
export const dynamic = 'force-dynamic'

async function testar(url: string) {
  try {
    const res = await fetch(url)
    const body = await res.json().catch(() => ({}))
    return { httpStatus: res.status, body }
  } catch (e) {
    return { erro: e instanceof Error ? e.message : 'erro de rede' }
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const integ = await prisma.integracao.findUnique({
    where: { userId_plataforma: { userId: session.user.id, plataforma: 'instagram' } },
  })

  if (!integ) {
    return NextResponse.json({ ok: false, motivo: 'Nenhuma integração do Instagram salva no banco' })
  }

  const token = integ.accessToken
  if (!token) {
    return NextResponse.json({
      ok: false,
      status: integ.status,
      motivo: 'A integração existe mas o token está vazio (null). Reconecte em Integrações.',
    })
  }

  const t = encodeURIComponent(token)
  const [igSemVersao, igComVersao, fb] = await Promise.all([
    testar(`https://graph.instagram.com/me?fields=user_id,username&access_token=${t}`),
    testar(`https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${t}`),
    testar(`https://graph.facebook.com/v21.0/me?access_token=${t}`),
  ])

  return NextResponse.json({
    ok: true,
    status: integ.status,
    accountId: integ.accountId,
    token: {
      tamanho: token.length,
      prefixo: token.slice(0, 8),
      sufixo: token.slice(-6),
      temEspacoOuQuebra: /\s/.test(token),
    },
    testes: {
      'graph.instagram.com/me': igSemVersao,
      'graph.instagram.com/v21.0/me': igComVersao,
      'graph.facebook.com/v21.0/me': fb,
    },
  })
}
