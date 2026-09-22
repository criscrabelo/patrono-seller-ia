/**
 * Métricas financeiras (Rodada 9, complemento ML, regra 5) — o Patrono não
 * otimiza só para views. Estas funções distinguem "muitas views, zero
 * venda" de "poucas views, alta conversão", sempre a partir de dados reais
 * (Sale/Commission ligados a Conteudo via `Sale.contentId` — nunca
 * atribuição inventada).
 */

import { prisma } from './prisma'
import {
  calcularMetricasPorProduto,
  type Granularidade,
  type MetricasPorProduto,
  type MotivoCliqueIndisponivel,
} from './metricas-clique'

export interface ResumoFinanceiroPorConteudo {
  contentId: string
  produtoId: string | null
  canal: string | null
  visualizacoes: number
  /**
   * SEMPRE `null`: não existe atribuição `EventoLink → Conteudo`.
   * Até o P0.3 vinha de `Conteudo.cliquesLink`, contador que produção nunca
   * incrementa — era 0 disfarçado de medição.
   */
  cliques: null
  cliquesIndisponiveisPorque: MotivoCliqueIndisponivel
  vendasConfirmadas: number
  receitaVendas: number
  comissaoReconhecida: number
  granularidade: Granularidade
}

/** Mesmo vínculo real de `lib/learning-engine.ts::resumoPorConteudo`, com visualizacoes/produtoId/receita agregados para as métricas financeiras. */
export async function resumoFinanceiroPorConteudo(workspaceId: string): Promise<ResumoFinanceiroPorConteudo[]> {
  const conteudos = await prisma.conteudo.findMany({
    where: { workspaceId },
    select: {
      id: true,
      redeSocial: true,
      visualizacoes: true,
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
      cliques: null,
      cliquesIndisponiveisPorque: 'SEM_ATRIBUICAO_POR_CONTEUDO' as const,
      vendasConfirmadas: c.sales.length,
      receitaVendas,
      comissaoReconhecida,
      granularidade: 'CONTEUDO' as const,
    }
  })
}

export interface MetricasFinanceiras {
  revenuePer1000Views: number | null
  commissionPerPublication: number | null
  /**
   * As TRÊS métricas por clique abaixo são SEMPRE `null` neste nível.
   *
   * O numerador aqui é de CONTEÚDO (venda ligada por `Sale.contentId`) e o
   * único denominador de clique disponível é de PRODUTO. Dividir um pelo
   * outro daria um número com cara de taxa e sem significado — é o erro que
   * `Granularidade` existe para impedir.
   *
   * Para conversão e comissão por clique de verdade, use
   * `calcularMetricasPorProdutoDoWorkspace()`, onde as duas pontas ficam no
   * mesmo nível.
   */
  clicksPerView: null
  saleConversionRate: null
  commissionPerClick: null
  metricasPorCliqueIndisponiveisPorque: MotivoCliqueIndisponivel
  commissionPerProduct: Record<string, number>
  commissionPerChannel: Record<string, number>
  granularidade: Granularidade
}

/**
 * Nunca divide por zero — denominador zerado vira `null` (desconhecido),
 * nunca `0` (que pareceria "sabemos que é zero").
 */
export function calcularMetricasFinanceiras(itens: ResumoFinanceiroPorConteudo[]): MetricasFinanceiras {
  const totalViews = itens.reduce((s, i) => s + i.visualizacoes, 0)
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
    clicksPerView: null,
    saleConversionRate: null,
    commissionPerClick: null,
    metricasPorCliqueIndisponiveisPorque: 'SEM_ATRIBUICAO_POR_CONTEUDO' as const,
    commissionPerProduct,
    commissionPerChannel,
    granularidade: 'CONTEUDO' as const,
  }
}

/**
 * Métricas por clique de VERDADE, no nível PRODUTO.
 *
 * Aqui as duas pontas fecham: venda por `Sale.productId`, clique por
 * `EventoLink → LinkDinamico → produtoId`. Nenhuma depende de atribuição a
 * criativo, então a divisão significa alguma coisa.
 *
 * O numerador conta SÓ venda aprovada pela autoridade de operação real —
 * relato não comprovado e fixture de teste não entram.
 */
export async function calcularMetricasPorProdutoDoWorkspace(
  workspaceId: string,
  antesDe: Date = new Date()
): Promise<MetricasPorProduto[]> {
  const produtos = await prisma.produto.findMany({ where: { workspaceId }, select: { id: true } })
  return calcularMetricasPorProduto(workspaceId, produtos.map((p) => p.id), antesDe)
}

export async function calcularMetricasFinanceirasDoWorkspace(workspaceId: string): Promise<MetricasFinanceiras> {
  const itens = await resumoFinanceiroPorConteudo(workspaceId)
  return calcularMetricasFinanceiras(itens)
}
