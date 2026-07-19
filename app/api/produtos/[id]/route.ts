import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getContaAtivaId } from '@/lib/conta'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const contaId = await getContaAtivaId(session.user.id)
  if (!contaId) return NextResponse.json({ error: 'Nenhuma marca configurada' }, { status: 400 })

  const produto = await prisma.produto.findFirst({
    where: { id, contaId },
    include: { conteudos: { orderBy: { createdAt: 'desc' } } },
  })

  if (!produto) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  return NextResponse.json(produto)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const contaId = await getContaAtivaId(session.user.id)
  if (!contaId) return NextResponse.json({ error: 'Nenhuma marca configurada' }, { status: 400 })

  const body = await req.json()

  const produto = await prisma.produto.updateMany({
    where: { id, contaId },
    data: body,
  })

  if (!produto.count) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const contaId = await getContaAtivaId(session.user.id)
  if (!contaId) return NextResponse.json({ error: 'Nenhuma marca configurada' }, { status: 400 })

  await prisma.produto.updateMany({
    where: { id, contaId },
    data: { status: 'descartado' },
  })

  return NextResponse.json({ success: true })
}
