import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/audit-log'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const produto = await prisma.produto.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
    include: { conteudos: { orderBy: { createdAt: 'desc' } } },
  })

  if (!produto) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  return NextResponse.json(produto)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()

  const produto = await prisma.produto.updateMany({
    where: { id, workspaceId: session.user.workspaceId },
    data: body,
  })

  if (!produto.count) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

  await registrarAuditoria({
    workspaceId: session.user.workspaceId,
    userId: session.user.id,
    action: 'produto.alterado',
    entityType: 'Produto',
    entityId: id,
    metadata: { campos: Object.keys(body) },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await prisma.produto.updateMany({
    where: { id, workspaceId: session.user.workspaceId },
    data: { status: 'descartado' },
  })

  await registrarAuditoria({
    workspaceId: session.user.workspaceId,
    userId: session.user.id,
    action: 'produto.descartado',
    entityType: 'Produto',
    entityId: id,
  })

  return NextResponse.json({ success: true })
}
