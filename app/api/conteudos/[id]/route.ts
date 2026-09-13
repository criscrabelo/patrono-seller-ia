import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/audit-log'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const conteudo = await prisma.conteudo.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
    include: { produto: true },
  })

  if (!conteudo) return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })
  return NextResponse.json(conteudo)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()

  const conteudo = await prisma.conteudo.updateMany({
    where: { id, workspaceId: session.user.workspaceId },
    data: body,
  })

  if (!conteudo.count) return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })

  if (body.status === 'aprovado') {
    await registrarAuditoria({
      workspaceId: session.user.workspaceId,
      userId: session.user.id,
      action: 'conteudo.aprovado',
      entityType: 'Conteudo',
      entityId: id,
    })
  } else if (body.status === 'publicado') {
    await registrarAuditoria({
      workspaceId: session.user.workspaceId,
      userId: session.user.id,
      action: 'publicacao.marcada',
      entityType: 'Conteudo',
      entityId: id,
    })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await prisma.conteudo.deleteMany({
    where: { id, workspaceId: session.user.workspaceId },
  })

  return NextResponse.json({ success: true })
}
