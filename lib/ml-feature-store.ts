/**
 * MLFeatureStore (Rodada 9, complemento ML, regra 7) — features nomeadas e
 * versionadas, derivadas de dados REAIS já existentes (`Conteudo`/
 * `Produto`/`Sale`/`Commission`). Sem serviço externo: usa o Postgres já
 * existente (`MLFeatureSnapshot`).
 *
 * Anti-leakage (regra 31): a extração de features (`extrairFeaturesDeConteudo`)
 * só usa dados anteriores/conhecidos no momento da publicação — o rótulo
 * (`extrairLabelDeConteudo`) é sempre uma chamada SEPARADA, feita depois,
 * quando o resultado (venda/comissão) já é conhecido. Nunca misturado na
 * mesma função.
 *
 * Funil preservado (regra 6): Produto → Conteudo (Creative/Publication) →
 * Sale → Commission, usando o vínculo real `Sale.contentId`. Este schema
 * não persiste `Opportunity`/`Impression`/`Click` como eventos individuais
 * — `Conteudo.visualizacoes`/`cliquesLink` são contadores agregados, não
 * um log evento a evento. Documentado como limitação real, não fingido.
 */

import { prisma } from './prisma'
import { classificarHook, type HookType } from './ml-hook-classifier'
import { classificarCta, type CtaType } from './ml-cta-classifier'
import { verificarSemDadosBiometricos } from './ml-privacy'
import type { MLDataOrigin } from './ml-types'

export const FEATURE_VERSION = 'ml-features-v1-rodada9'

export type ProductPriceBucket = 'LOW' | 'MID' | 'HIGH' | 'DESCONHECIDO'

/** Limiares documentados e ajustáveis — nunca escondidos dentro da função. */
export const LIMIARES_PRECO_PADRAO = { low: 50, high: 200 }

export function bucketPreco(preco: number | null | undefined, limiares = LIMIARES_PRECO_PADRAO): ProductPriceBucket {
  if (preco == null) return 'DESCONHECIDO'
  if (preco < limiares.low) return 'LOW'
  if (preco > limiares.high) return 'HIGH'
  return 'MID'
}

export interface ContentMLFeatures {
  product_price_bucket: ProductPriceBucket
  // Não existe campo de % de comissão persistido em Produto/AffiliateProgram
  // hoje — nunca inventado; fica `null` até o schema registrar isso.
  commission_percentage: number | null
  video_duration: number | null
  hook_type: HookType
  cta_type: CtaType
  posting_hour: number | null
  // Conteudo ainda não registra qual modo do Digital Twin foi usado
  // (DIGITAL_TWIN/VOICE_ONLY/MOTION_GRAPHICS) — reservado, sempre `null`
  // nesta rodada. Ver DIGITAL-TWIN.md para o estado real dessa integração.
  avatar_style: string | null
  channel: string | null
  product_category: string
  historical_conversion_rate: number | null
}

/**
 * Conversão histórica por categoria — só considera Conteudo/Sale
 * criados ANTES de `antesDe` (nunca inclui dados futuros). `excluirContentId`
 * é OBRIGATÓRIO em uso real: sem ele, um conteúdo cujo `createdAt` é (por
 * definição) anterior à sua própria `dataPublicacao` vazaria suas próprias
 * cliques/vendas parciais para dentro da sua própria feature histórica —
 * um vazamento sutil só percebido testando com dados reais (regra 31).
 */
export async function calcularConversaoHistoricaPorCategoria(
  workspaceId: string,
  categoria: string,
  antesDe: Date,
  excluirContentId?: string
): Promise<number | null> {
  const conteudos = await prisma.conteudo.findMany({
    where: {
      workspaceId,
      produto: { categoria },
      createdAt: { lt: antesDe },
      ...(excluirContentId ? { id: { not: excluirContentId } } : {}),
    },
    select: {
      cliquesLink: true,
      sales: { where: { status: 'CONFIRMED', createdAt: { lt: antesDe } }, select: { id: true } },
    },
  })
  const cliques = conteudos.reduce((s, c) => s + c.cliquesLink, 0)
  const vendas = conteudos.reduce((s, c) => s + c.sales.length, 0)
  return cliques > 0 ? vendas / cliques : null
}

/**
 * Extrai as features nomeadas de um `Conteudo` real. `referenceDate` é a
 * data de publicação (ou criação, se ainda não publicado) — o corte
 * temporal usado para a conversão histórica, nunca a data "agora".
 */
export async function extrairFeaturesDeConteudo(
  workspaceId: string,
  contentId: string
): Promise<{ features: ContentMLFeatures; referenceDate: Date } | null> {
  const conteudo = await prisma.conteudo.findFirst({
    where: { id: contentId, workspaceId },
    select: {
      roteiro: true,
      chamadaAcao: true,
      duracao: true,
      redeSocial: true,
      dataPublicacao: true,
      createdAt: true,
      produto: { select: { categoria: true, preco: true } },
    },
  })
  if (!conteudo) return null

  const referenceDate = conteudo.dataPublicacao ?? conteudo.createdAt
  const primeiraFrase = conteudo.roteiro?.split(/[.!?\n]/).find((s) => s.trim().length > 0) ?? null
  const hook = classificarHook(primeiraFrase)
  const cta = classificarCta(conteudo.chamadaAcao)
  const historicalRate = await calcularConversaoHistoricaPorCategoria(workspaceId, conteudo.produto.categoria, referenceDate, contentId)

  const features: ContentMLFeatures = {
    product_price_bucket: bucketPreco(conteudo.produto.preco),
    commission_percentage: null,
    video_duration: conteudo.duracao,
    hook_type: hook.tipo,
    cta_type: cta.tipo,
    posting_hour: conteudo.dataPublicacao ? conteudo.dataPublicacao.getUTCHours() : null,
    avatar_style: null,
    channel: conteudo.redeSocial,
    product_category: conteudo.produto.categoria,
    historical_conversion_rate: historicalRate,
  }

  return { features, referenceDate }
}

/**
 * `dataOrigin` é OBRIGATÓRIO e nunca inferido — quem chama declara
 * explicitamente se este dado veio de operação real (`REAL_OPERATION`)
 * ou de teste/fixture/demo/seed. Só `REAL_OPERATION` conta para o
 * `MLReadinessGate` de produção (`lib/ml-readiness-gate.ts`) — nunca a
 * confundir com dado real por omissão.
 */
export async function salvarFeatureSnapshot(
  workspaceId: string,
  entityType: string,
  entityId: string,
  features: ContentMLFeatures,
  dataOrigin: MLDataOrigin
) {
  verificarSemDadosBiometricos(features as unknown as Record<string, unknown>)
  return prisma.mLFeatureSnapshot.create({
    data: { workspaceId, entityType, entityId, featureVersion: FEATURE_VERSION, features: features as never, dataOrigin },
  })
}

export interface RotuloConversao {
  converted: boolean
  saleAmount: number | null
  commissionValue: number | null
}

/**
 * Rótulo (label) — SEMPRE chamado depois, quando o resultado já é
 * conhecido. Nunca dentro de `extrairFeaturesDeConteudo`.
 */
export async function extrairLabelDeConteudo(workspaceId: string, contentId: string): Promise<RotuloConversao> {
  const sales = await prisma.sale.findMany({
    where: { workspaceId, contentId, status: 'CONFIRMED' },
    select: { amount: true, commissions: { select: { status: true, expectedAmount: true, confirmedAmount: true, receivedAmount: true } } },
  })
  if (sales.length === 0) return { converted: false, saleAmount: null, commissionValue: null }

  const saleAmount = sales.reduce((s, v) => s + (v.amount ?? 0), 0)
  const commissionValue = sales.reduce((somaVendas, venda) => {
    const daVenda = venda.commissions.reduce((soma, com) => {
      if (com.status === 'RECEIVED') return soma + (com.receivedAmount ?? 0)
      if (com.status === 'CONFIRMED') return soma + (com.confirmedAmount ?? 0)
      return soma + (com.expectedAmount ?? 0)
    }, 0)
    return somaVendas + daVenda
  }, 0)

  return { converted: true, saleAmount, commissionValue }
}

export async function registrarLabelNoSnapshot(snapshotId: string, label: RotuloConversao) {
  return prisma.mLFeatureSnapshot.update({
    where: { id: snapshotId },
    data: { label: label as never, labeledAt: new Date() },
  })
}
