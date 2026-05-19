import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renovarTokenInstagram } from '@/lib/instagram'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const integracao = await prisma.integracao.findUnique({
    where: { userId_plataforma: { userId: session.user.id, plataforma: 'instagram' } },
  })

  if (!integracao || !integracao.accessToken) {
    return NextResponse.json({ error: 'Instagram não conectado' }, { status: 400 })
  }

  const extra = (integracao.extraData ?? {}) as Record<string, string>
  const appId = extra.appId
  const appSecret = extra.appSecret

  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: 'Meta App ID e App Secret são necessários para renovar o token automaticamente. Reconecte o Instagram informando esses campos.' },
      { status: 400 }
    )
  }

  try {
    const { accessToken: novoToken, expiresIn } = await renovarTokenInstagram({
      accessToken: integracao.accessToken,
      appId,
      appSecret,
    })

    const tokenExpiry = new Date(Date.now() + expiresIn * 1000)

    await prisma.integracao.update({
      where: { id: integracao.id },
      data: { accessToken: novoToken, tokenExpiry, updatedAt: new Date() },
    })

    return NextResponse.json({ ok: true, tokenExpiry: tokenExpiry.toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao renovar token'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
