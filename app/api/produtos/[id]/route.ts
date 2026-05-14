import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const produto = await prisma.produto.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { conteudos: { orderBy: { createdAt: 'desc' } } },
  })

  if (!produto) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  return NextResponse.json(produto)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()

  const produto = await prisma.produto.updateMany({
    where: { id: params.id, userId: session.user.id },
    data: body,
  })

  if (!produto.count) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await prisma.produto.updateMany({
    where: { id: params.id, userId: session.user.id },
    data: { status: 'descartado' },
  })

  return NextResponse.json({ success: true })
}
