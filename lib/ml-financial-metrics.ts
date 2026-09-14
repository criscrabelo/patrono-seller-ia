/**
 * Métricas financeiras (Rodada 9, complemento ML, regra 5) — o Patrono não
 * otimiza só para views. Estas funções distinguem "muitas views, zero
 * venda" de "poucas views, alta conversão", sempre a partir de dados reais
 * (Sale/Commission ligados a Conteudo via `Sale.contentId` — nunca
 * atribuição inventada).
 */

import { prisma } from './prisma'

export interface ResumoFinanceiroPorConteudo {
  contentId: string
  produtoId: string | null
  canal: string | null
  visualizacoes: number
  cliques: number
  vendasConfirmadas: number
  receitaVendas: number
  comissaoReconhecida: number
}

/** Mesmo vínculo real de `lib/learning-engine.ts::resumoPorConteudo`, com visualizacoes/produtoId/receita agregados para as métricas financeiras. */
export async function resumoFinanceiroPorConteudo(workspaceId: string): Promise<ResumoFinanceiroPorConteudo[]> {
  const conteudos = await prisma.conteudo.findMany({
    where: { workspaceId },
    select: {
      id: true,
      redeSocial: true,
      visualizacoes: true,
      cliquesLink: true,
      produtoId: true,
      sales: {
        where: { status: 'CONFIRMED' },
        select: { amount: true, commissions: { select: { status: true, expectedAmount: true, confirmedAmount: true, receivedAmount: true } } },
      },
    },
  })

  return conteudos.map((c) => {
    const receitaVendas = c.sales.reduce((soma, venda) => soma + (venda.amount ?? 0), 0)
    const comissaoReconhecida = c.sales.reduce((somaVendas, venda) => {
      const daVenda = venda.commissions.reduce((soma, com) => {
        if (com.status === 'RECEIVED') return soma + (com.receivedAmount ?? 0)
        if (com.status === 'CONFIRMED') return soma + (com.confirmedAmount ?? 0)
        return soma + (com.expectedAmount ?? 0)
      }, 0)
      return somaVendas + daVenda
    }, 0)

    return {
      contentId: c.id,
      produtoId: c.produtoId,
      canal: c.redeSocial,
      visualizacoes: c.visualizacoes,
      cliques: c.cliquesLink,
      vendasConfirmadas: c.sales.length,
      receitaVendas,
      comissaoReconhecida,
    }
  })
}

export interface MetricasFinanceiras {
  revenuePer1000Views: number | null
  commissionPerPublication: number | null
  clicksPerView: number | null
  saleConversionRate: number | null
  commissionPerClick: number | null
  commissionPerProduct: Record<string, number>
  commissionPerChannel: Record<string, number>
}

/**
 * Nunca divide por zero — denominador zerado vira `null` (desconhecido),
 * nunca `0` (que pareceria "sabemos que é zero").
 */
export function calcularMetricasFinanceiras(itens: ResumoFinanceiroPorConteudo[]): MetricasFinanceiras {
  const totalViews = itens.reduce((s, i) => s + i.visualizacoes, 0)
  const totalCliques = itens.reduce((s, i) => s + i.cliques, 0)
  const totalVendas = itens.reduce((s, i) => s + i.vendasConfirmadas, 0)
  const totalReceita = itens.reduce((s, i) => s + i.receitaVendas, 0)
  const totalComissao = itens.reduce((s, i) => s + i.comissaoReconhecida, 0)
  const totalPublicacoes = itens.length

  const commissionPerProduct: Record<string, number> = {}
  const commissionPerChannel: Record<string, number> = {}
  for (const i of itens) {
    if (i.produtoId) commissionPerProduct[i.produtoId] = (commissionPerProduct[i.produtoId] ?? 0) + i.comissaoReconhecida
    const canal = i.canal ?? 'não informado'
    commissionPerChannel[canal] = (commissionPerChannel[canal] ?? 0) + i.comissaoReconhecida
  }

  return {
    revenuePer1000Views: totalViews > 0 ? (totalReceita / totalViews) * 1000 : null,
    commissionPerPublication: totalPublicacoes > 0 ? totalComissao / totalPublicacoes : null,
    clicksPerView: totalViews > 0 ? totalCliques / totalViews : null,
    saleConversionRate: totalCliques > 0 ? totalVendas / totalCliques : null,
    commissionPerClick: totalCliques > 0 ? totalComissao / totalCliques : null,
    commissionPerProduct,
    commissionPerChannel,
  }
}

export async function calcularMetricasFinanceirasDoWorkspace(workspaceId: string): Promise<MetricasFinanceiras> {
  const itens = await resumoFinanceiroPorConteudo(workspaceId)
  return calcularMetricasFinanceiras(itens)
}
