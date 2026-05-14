import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const integracoes = await prisma.integracao.findMany({
    where: { userId: session.user.id },
  })

  return NextResponse.json(integracoes)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { plataforma, accessToken, accountId, accountName, extraData } = body

  const integracao = await prisma.integracao.upsert({
    where: { userId_plataforma: { userId: session.user.id, plataforma } },
    update: { accessToken, accountId, accountName, extraData, status: 'conectado', updatedAt: new Date() },
    create: { userId: session.user.id, plataforma, accessToken, accountId, accountName, extraData, status: 'conectado' },
  })

  return NextResponse.json(integracao)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const plataforma = searchParams.get('plataforma')
  if (!plataforma) return NextResponse.json({ error: 'Plataforma obrigatória' }, { status: 400 })

  await prisma.integracao.updateMany({
    where: { userId: session.user.id, plataforma },
    data: { status: 'desconectado', accessToken: null, refreshToken: null, accountId: null, accountName: null },
  })

  return NextResponse.json({ success: true })
}
