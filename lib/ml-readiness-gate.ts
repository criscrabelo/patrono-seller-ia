/**
 * MLReadinessGate (Rodada 9, complemento ML, regras 3, 8, 41) — nunca
 * força Machine Learning com meia dúzia de publicações. A escada de
 * maturidade é sempre avaliada a partir de dados REAIS já rotulados
 * (`MLFeatureSnapshot.labeledAt != null`) — nunca de dados inventados.
 *
 * COLD START → RULE_BASED → STATISTICAL_LEARNING → MACHINE_LEARNING →
 * CONTINUOUS LEARNING (regra 3), mapeado nos 4 estados de
 * `MLReadinessState` (lib/ml-types.ts).
 */

import { prisma } from './prisma'
import type { MLReadinessState } from './ml-types'

export interface LimiaresProntidaoML {
  minimoParaEstatistica: number
  minimoParaML: number
  minimoPositivosParaML: number
}

/**
 * Limiares documentados e ajustáveis (nunca escondidos): um workspace
 * novo do Patrono Seller começa em zero publicações — é esperado (e
 * correto) que a maioria comece em INSUFFICIENT_DATA por um bom tempo.
 */
export const LIMIARES_PRONTIDAO_PADRAO: LimiaresProntidaoML = {
  minimoParaEstatistica: 30,
  minimoParaML: 200,
  minimoPositivosParaML: 20,
}

export interface MLReadinessInput {
  labeledSampleCount: number
  positiveSampleCount: number
  hasActiveModel: boolean
}

export interface MLReadinessResultado {
  estado: MLReadinessState
  motivo: string
  amostrasRotuladas: number
  amostrasPositivas: number
}

/** Função pura — nunca acessa banco, só decide a partir dos números já apurados. */
export function avaliarProntidaoML(input: MLReadinessInput, limiares: LimiaresProntidaoML = LIMIARES_PRONTIDAO_PADRAO): MLReadinessResultado {
  const base = { amostrasRotuladas: input.labeledSampleCount, amostrasPositivas: input.positiveSampleCount }

  if (input.hasActiveModel) {
    return { ...base, estado: 'MODEL_ACTIVE', motivo: 'Já existe um MLModel ACTIVE para este workspace/família.' }
  }

  if (input.labeledSampleCount < limiares.minimoParaEstatistica) {
    return {
      ...base,
      estado: 'INSUFFICIENT_DATA',
      motivo: `Apenas ${input.labeledSampleCount} amostra(s) rotulada(s) — mínimo de ${limiares.minimoParaEstatistica} para estatística simples confiável.`,
    }
  }

  if (input.labeledSampleCount < limiares.minimoParaML || input.positiveSampleCount < limiares.minimoPositivosParaML) {
    return {
      ...base,
      estado: 'READY_FOR_STATISTICS',
      motivo: `${input.labeledSampleCount} amostra(s) rotulada(s) (${input.positiveSampleCount} positiva(s)) — suficiente para médias/taxas por grupo, mas abaixo do mínimo para treinar um modelo (${limiares.minimoParaML} amostras / ${limiares.minimoPositivosParaML} positivas).`,
    }
  }

  return {
    ...base,
    estado: 'READY_FOR_ML',
    motivo: `${input.labeledSampleCount} amostra(s) rotulada(s) (${input.positiveSampleCount} positiva(s)) — dados suficientes para treinar um primeiro modelo real.`,
  }
}

/** Conta amostras rotuladas reais de um workspace — nunca inventa contagem. */
export async function contarAmostrasRotuladas(workspaceId: string, entityType: string = 'Conteudo'): Promise<{ total: number; positivas: number }> {
  const snapshots = await prisma.mLFeatureSnapshot.findMany({
    where: { workspaceId, entityType, labeledAt: { not: null } },
    select: { label: true },
  })
  const total = snapshots.length
  const positivas = snapshots.filter((s) => (s.label as { converted?: boolean } | null)?.converted === true).length
  return { total, positivas }
}

export async function avaliarProntidaoMLDoWorkspace(
  workspaceId: string,
  family: string,
  entityType: string = 'Conteudo',
  limiares: LimiaresProntidaoML = LIMIARES_PRONTIDAO_PADRAO
): Promise<MLReadinessResultado> {
  const hasActiveModel = (await prisma.mLModel.count({ where: { workspaceId, family, status: 'ACTIVE' } })) > 0
  const { total, positivas } = await contarAmostrasRotuladas(workspaceId, entityType)
  return avaliarProntidaoML({ labeledSampleCount: total, positiveSampleCount: positivas, hasActiveModel }, limiares)
}
