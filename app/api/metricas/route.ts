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
    linksDoUsuario,
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
    prisma.linkDinamico.findMany({
      where: { userId },
      include: { produto: { select: { nome: true } } },
    }),
  ])

  const { lucroEscala, comissaoTotal } = calcularLucroEscala(linksDoUsuario)

  return NextResponse.json({
    totalProdutos,
    totalConteudos,
    aguardandoAprovacao,
    publicados,
    visualizacoesTotais: somaVisualizacoes._sum.visualizacoes ?? 0,
    topConteudos: conteudosRecentes,
    conteudosPorStatus,
    lucroEscala,
    comissaoTotal,
  })
}

type LinkComProduto = {
  produtoId: string
  cliques: number
  conversoes: number
  receitaTotal: number
  produto: { nome: string }
}

// Score de Escala (0-100): metade pelo desempenho de conversão, metade pela receita
// gerada em relação ao produto que mais rendeu. 15% de conversão já vale os 50 pontos
// da metade de conversão — acima disso não soma mais.
function calcularLucroEscala(links: LinkComProduto[]) {
  const porProduto = new Map<string, { nome: string; cliques: number; conversoes: number; receitaTotal: number }>()

  for (const link of links) {
    const atual = porProduto.get(link.produtoId) ?? {
      nome: link.produto.nome,
      cliques: 0,
      conversoes: 0,
      receitaTotal: 0,
    }
    atual.cliques += link.cliques
    atual.conversoes += link.conversoes
    atual.receitaTotal += link.receitaTotal
    porProduto.set(link.produtoId, atual)
  }

  const maxReceita = Math.max(0, ...[...porProduto.values()].map((p) => p.receitaTotal))

  const lucroEscala = [...porProduto.entries()]
    .map(([produtoId, p]) => {
      const taxaConversao = p.cliques > 0 ? p.conversoes / p.cliques : 0
      const receitaRelativa = maxReceita > 0 ? p.receitaTotal / maxReceita : 0
      const scoreEscala = Math.round(Math.min(1, taxaConversao / 0.15) * 50 + receitaRelativa * 50)
      return {
        produtoId,
        nome: p.nome,
        cliques: p.cliques,
        conversoes: p.conversoes,
        receitaTotal: p.receitaTotal,
        ticketMedio: p.conversoes > 0 ? p.receitaTotal / p.conversoes : 0,
        taxaConversao,
        scoreEscala,
        faixa: faixaEscala(scoreEscala),
      }
    })
    .sort((a, b) => b.scoreEscala - a.scoreEscala)

  const comissaoTotal = lucroEscala.reduce((s, p) => s + p.receitaTotal, 0)

  return { lucroEscala, comissaoTotal }
}

function faixaEscala(score: number) {
  if (score >= 81) return { label: 'Campeão · escalar já', cor: 'gold' as const }
  if (score >= 61) return { label: 'Promissor', cor: 'blue' as const }
  if (score >= 31) return { label: 'Testar mais', cor: 'amber' as const }
  return { label: 'Não escalar', cor: 'red' as const }
}
