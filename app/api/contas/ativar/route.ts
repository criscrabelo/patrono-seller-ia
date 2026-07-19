import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CONTA_ATIVA_COOKIE } from '@/lib/conta'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const contaId = body.contaId
  if (!contaId) return NextResponse.json({ error: 'Informe contaId' }, { status: 400 })

  const conta = await prisma.conta.findFirst({
    where: { id: contaId, userId: session.user.id },
  })
  if (!conta) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })

  const res = NextResponse.json({ success: true, conta })
  res.cookies.set(CONTA_ATIVA_COOKIE, conta.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return res
}
