/**
 * LearningEngine — modelo conceitual + métricas DETERMINÍSTICAS.
 *
 * NÃO é machine learning ainda — não há modelo nenhum sendo treinado
 * aqui. É só o registro e o cálculo de conversão a partir do que já existe
 * de verdade no banco (Sale/Commission ligados a Conteudo), preparando o
 * terreno para uma etapa futura de verdade aprender e recomendar sozinha.
 *
 * Cadeia registrada: Produto → Conteúdo → Canal → Publicação → Clique →
 * Venda → Comissão. `Sale.contentId` (quando informado) já liga uma venda
 * a um conteúdo específico — as funções abaixo usam esse vínculo real.
 */

import { prisma } from '@/lib/prisma'

export interface ResumoPorConteudo {
  contentId: string
  produto: string | null
  canal: string | null
  cliques: number
  vendasConfirmadas: number
  comissaoReconhecida: number
}

/** Resultado por conteúdo — só conta Sale ligada a um Conteudo (Sale.contentId), nunca inventa atribuição. */
export async function resumoPorConteudo(workspaceId: string): Promise<ResumoPorConteudo[]> {
  const conteudos = await prisma.conteudo.findMany({
    where: { workspaceId },
    select: {
      id: true,
      redeSocial: true,
      cliquesLink: true,
      produto: { select: { nome: true } },
      sales: {
        where: { status: 'CONFIRMED' },
        select: { commissions: { select: { status: true, expectedAmount: true, confirmedAmount: true, receivedAmount: true } } },
      },
    },
  })

  return conteudos.map((c) => {
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
      produto: c.produto?.nome ?? null,
      canal: c.redeSocial ?? null,
      // DEPRECATED_LEGACY (P0.3) — ver lib/metricas-clique.ts.
      cliques: c.cliquesLink,
      vendasConfirmadas: c.sales.length,
      comissaoReconhecida,
    }
  })
}

export interface ResumoPorCanal {
  canal: string
  vendasConfirmadas: number
  comissaoReconhecida: number
  taxaConversao: number | null // null quando não há cliques suficientes pra calcular (não é 0)
}

/** Resultado agregado por canal (redeSocial do Conteudo) — determinístico, sem inferência estatística ainda. */
export async function resumoPorCanal(workspaceId: string): Promise<ResumoPorCanal[]> {
  const porConteudo = await resumoPorConteudo(workspaceId)

  const porCanal = new Map<string, { cliques: number; vendasConfirmadas: number; comissaoReconhecida: number }>()
  for (const c of porConteudo) {
    const chave = c.canal ?? 'não informado'
    const atual = porCanal.get(chave) ?? { cliques: 0, vendasConfirmadas: 0, comissaoReconhecida: 0 }
    atual.cliques += c.cliques
    atual.vendasConfirmadas += c.vendasConfirmadas
    atual.comissaoReconhecida += c.comissaoReconhecida
    porCanal.set(chave, atual)
  }

  return [...porCanal.entries()].map(([canal, v]) => ({
    canal,
    vendasConfirmadas: v.vendasConfirmadas,
    comissaoReconhecida: v.comissaoReconhecida,
    taxaConversao: v.cliques > 0 ? v.vendasConfirmadas / v.cliques : null,
  }))
}

/**
 * Etapas futuras (NÃO implementadas): resultado por formato, por hook/CTA,
 * retorno por publicação isolada — dependem de metadado que o Conteudo
 * ainda não guarda de forma estruturada (formato/hook/CTA como campos
 * próprios, não só texto livre no roteiro). Documentado como pendência em
 * DOCUMENTACAO-PATRONO-SELLER.md, não implementado aqui para não inventar
 * uma estrutura de dados que o Design não pediu ainda.
 */
export interface LearningEngine {
  resumoPorConteudo(workspaceId: string): Promise<ResumoPorConteudo[]>
  resumoPorCanal(workspaceId: string): Promise<ResumoPorCanal[]>
}
