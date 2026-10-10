import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { registrarAuditoria } from '@/lib/audit-log'

const produtoSchema = z.object({
  nome: z.string().min(1),
  categoria: z.string().min(1),
  preco: z.number().positive().optional(),
  linkProduto: z.string().url().optional().or(z.literal('')),
  descricao: z.string().optional(),
  publicoAlvo: z.array(z.string()),
  tipoVenda: z.string().min(1),
  origemConteudo: z.string().min(1),
  observacoes: z.string().optional(),
  beneficios: z.array(z.string()),
  pontosNegativos: z.array(z.string()),
  imagens: z.array(z.string()),
  videos: z.array(z.string()),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const categoria = searchParams.get('categoria')
  const busca = searchParams.get('busca')

  const produtos = await prisma.produto.findMany({
    where: {
      workspaceId: session.user.workspaceId,
      status: { not: 'descartado' },
      ...(categoria && { categoria }),
      ...(busca && { nome: { contains: busca, mode: 'insensitive' } }),
    },
    include: { _count: { select: { conteudos: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(produtos)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = produtoSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const produto = await prisma.produto.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
      workspaceId: session.user.workspaceId,
    },
  })

  await registrarAuditoria({
    workspaceId: session.user.workspaceId,
    userId: session.user.id,
    action: 'produto.criado',
    entityType: 'Produto',
    entityId: produto.id,
    metadata: { nome: produto.nome, categoria: produto.categoria },
  })

  return NextResponse.json(produto, { status: 201 })
}