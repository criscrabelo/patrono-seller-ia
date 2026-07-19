import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CONTA_ATIVA_COOKIE, getContaAtivaIdCookie } from '@/lib/conta'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const contas = await prisma.conta.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })

  const cookieContaId = await getContaAtivaIdCookie()
  const contaAtivaId = contas.some((c) => c.id === cookieContaId)
    ? cookieContaId
    : contas[0]?.id ?? null

  return NextResponse.json({ contas, contaAtivaId })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const nome = (body.nome ?? '').trim()
  if (!nome) return NextResponse.json({ error: 'Informe um nome para a marca' }, { status: 400 })

  const conta = await prisma.conta.create({
    data: { userId: session.user.id, nome },
  })

  const res = NextResponse.json(conta)
  res.cookies.set(CONTA_ATIVA_COOKIE, conta.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return res
}
