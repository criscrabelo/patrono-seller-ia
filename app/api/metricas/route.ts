import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const userId = session.user.id

  const [
    totalProdutos,
    totalConteudos,
    aguardandoAprovacao,
    publicados,
    topConteudos,
    conteudosPorStatus,
  ] = await Promise.all([
    prisma.produto.count({ where: { userId, status: { not: 'descartado' } } }),
    prisma.conteudo.count({ where: { userId } }),
    prisma.conteudo.count({ where: { userId, status: 'aguardando_aprovacao' } }),
    prisma.conteudo.count({ where: { userId, status: 'publicado' } }),
    prisma.conteudo.findMany({
      where: { userId, status: 'publicado' },
      orderBy: { visualizacoes: 'desc' },
      take: 5,
      include: { produto: { select: { nome: true } } },
    }),
    prisma.conteudo.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true },
    }),
  ])

  const visualizacoesTotais = topConteudos.reduce((sum, c) => sum + c.visualizacoes, 0)

  return NextResponse.json({
    totalProdutos,
    totalConteudos,
    aguardandoAprovacao,
    publicados,
    visualizacoesTotais,
    topConteudos,
    conteudosPorStatus,
  })
}
