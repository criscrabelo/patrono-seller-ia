import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { lucroEscalaPorProduto, resumoVendas, resumoComissoes, primeiraComissao } from '@/lib/vendas-comissoes'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const workspaceId = session.user.workspaceId

  const [
    totalProdutos,
    totalConteudos,
    aguardandoAprovacao,
    publicados,
    somaVisualizacoes,
    conteudosRecentes,
    conteudosPorStatus,
    produtosComVenda,
    vendas,
    comissoes,
    primeira,
  ] = await Promise.all([
    prisma.produto.count({ where: { workspaceId, status: { not: 'descartado' } } }),
    prisma.conteudo.count({ where: { workspaceId } }),
    prisma.conteudo.count({ where: { workspaceId, status: 'aguardando_aprovacao' } }),
    prisma.conteudo.count({ where: { workspaceId, status: 'publicado' } }),
    // Soma TODAS as visualizações, não apenas top 5
    prisma.conteudo.aggregate({
      where: { workspaceId },
      _sum: { visualizacoes: true },
    }),
    // Conteúdos recentes de todos os status (não só publicados)
    prisma.conteudo.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { produto: { select: { nome: true } } },
    }),
    prisma.conteudo.groupBy({
      by: ['status'],
      where: { workspaceId },
      _count: { status: true },
    }),
    // Fonte única de vendas/comissões por produto (Rodada 3) — nunca mais
    // soma o contador legado de LinkDinamico. Cliques continuam vindo dos
    // links (fonte de tracking); vendas e receita vêm de Sale/Commission.
    lucroEscalaPorProduto(workspaceId),
    resumoVendas(workspaceId),
    resumoComissoes(workspaceId),
    primeiraComissao(workspaceId),
  ])

  const lucroEscala = calcularScoreEscala(produtosComVenda)
  const comissaoTotal = comissoes.confirmada + comissoes.recebida

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
    // "Resultados" (design_handoff §I) — cliques permanecem na fonte de
    // links/tracking; vendas confirmadas e comissão confirmada/recebida
    // vêm de Sale/Commission, nunca do contador legado.
    resultados: {
      vendasConfirmadas: vendas.CONFIRMED,
      vendasPendentes: vendas.PENDING,
      vendasCanceladas: vendas.CANCELLED,
      comissaoPrevista: comissoes.prevista,
      comissaoConfirmada: comissoes.confirmada,
      comissaoRecebida: comissoes.recebida,
    },
    primeiraComissao: primeira,
  })
}

type ProdutoComVenda = {
  produtoId: string
  nome: string
  cliques: number
  conversoes: number
  receitaTotal: number
}

// Score de Escala (0-100): metade pelo desempenho de conversão, metade pela receita
// gerada em relação ao produto que mais rendeu. 15% de conversão já vale os 50 pontos
// da metade de conversão — acima disso não soma mais.
function calcularScoreEscala(produtos: ProdutoComVenda[]) {
  const maxReceita = Math.max(0, ...produtos.map((p) => p.receitaTotal))

  return produtos
    .map((p) => {
      const taxaConversao = p.cliques > 0 ? p.conversoes / p.cliques : 0
      const receitaRelativa = maxReceita > 0 ? p.receitaTotal / maxReceita : 0
      const scoreEscala = Math.round(Math.min(1, taxaConversao / 0.15) * 50 + receitaRelativa * 50)
      return {
        produtoId: p.produtoId,
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
}

function faixaEscala(score: number) {
  if (score >= 81) return { label: 'Campeão · escalar já', cor: 'gold' as const }
  if (score >= 61) return { label: 'Promissor', cor: 'blue' as const }
  if (score >= 31) return { label: 'Testar mais', cor: 'amber' as const }
  return { label: 'Não escalar', cor: 'red' as const }
}
