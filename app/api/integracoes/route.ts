import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getContaAtivaId } from '@/lib/conta'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const contaId = await getContaAtivaId(session.user.id)
  if (!contaId) return NextResponse.json({ error: 'Nenhuma marca configurada' }, { status: 400 })

  const integracoes = await prisma.integracao.findMany({
    where: { contaId },
  })

  return NextResponse.json(integracoes)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const contaId = await getContaAtivaId(session.user.id)
  if (!contaId) return NextResponse.json({ error: 'Nenhuma marca configurada' }, { status: 400 })

  const body = await req.json()
  const { plataforma, accessToken, accountId, accountName, extraData } = body

  // Para o Instagram, registra a data de expiração (~60 dias a partir de agora)
  const tokenExpiry =
    plataforma === 'instagram' && accessToken
      ? new Date(Date.now() + 59 * 24 * 60 * 60 * 1000)
      : undefined

  const integracao = await prisma.integracao.upsert({
    where: { contaId_plataforma: { contaId, plataforma } },
    update: { accessToken, accountId, accountName, extraData, status: 'conectado', tokenExpiry, updatedAt: new Date() },
    create: { userId: session.user.id, contaId, plataforma, accessToken, accountId, accountName, extraData, status: 'conectado', tokenExpiry },
  })

  return NextResponse.json(integracao)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const contaId = await getContaAtivaId(session.user.id)
  if (!contaId) return NextResponse.json({ error: 'Nenhuma marca configurada' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const plataforma = searchParams.get('plataforma')
  if (!plataforma) return NextResponse.json({ error: 'Plataforma obrigatória' }, { status: 400 })

  await prisma.integracao.updateMany({
    where: { contaId, plataforma },
    data: { status: 'desconectado', accessToken: null, refreshToken: null, accountId: null, accountName: null },
  })

  return NextResponse.json({ success: true })
}
