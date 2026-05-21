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
    somaVisualizacoes,
    conteudosRecentes,
    conteudosPorStatus,
  ] = await Promise.all([
    prisma.produto.count({ where: { userId, status: { not: 'descartado' } } }),
    prisma.conteudo.count({ where: { userId } }),
    prisma.conteudo.count({ where: { userId, status: 'aguardando_aprovacao' } }),
    prisma.conteudo.count({ where: { userId, status: 'publicado' } }),
    // Soma TODAS as visualizações, não apenas top 5
    prisma.conteudo.aggregate({
      where: { userId },
      _sum: { visualizacoes: true },
    }),
    // Conteúdos recentes de todos os status (não só publicados)
    prisma.conteudo.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { produto: { select: { nome: true } } },
    }),
    prisma.conteudo.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true },
    }),
  ])

  return NextResponse.json({
    totalProdutos,
    totalConteudos,
    aguardandoAprovacao,
    publicados,
    visualizacoesTotais: somaVisualizacoes._sum.visualizacoes ?? 0,
    topConteudos: conteudosRecentes,
    conteudosPorStatus,
  })
}
