/**
 * Evolução do Opportunity Score (Rodada 9, complemento ML, regra 12) —
 *
 *   Opportunity Score = External Market Signals + Automation Feasibility
 *                      + Historical Performance + ML Prediction
 *
 * Cada componente é registrado SEPARADAMENTE — nunca escondido atrás de
 * um score opaco (regra 36). Pesos escolhidos para preservar EXATAMENTE o
 * comportamento da Rodada 5 (`calcularFeasibility`, 0.55/0.45) quando
 * `historicalPerformance`/`mlPrediction` ainda não existem (a maioria dos
 * casos hoje, dado o cold start) — reweight proporcional entre os
 * componentes realmente disponíveis, mesma técnica de `notaPotencial`.
 */

import { notaPotencial, notaAutomatizabilidade } from './automation-feasibility'
import type { AffiliateOpportunity, OpportunityScorer } from './affiliate-discovery'
import type { MLDecisionType } from './ml-types'
import { chaveOportunidade, type OpportunityMLPrediction } from './ml-engine'

export interface OpportunityScoreComponents {
  externalMarketSignals: number
  automationFeasibility: number
  historicalPerformance: number | null
  mlPrediction: number | null
  final: number
  motivos: string[]
  decisionType: MLDecisionType
}

/**
 * Pesos com os 4 componentes presentes. Quando `historicalPerformance`
 * (0.15) e `mlPrediction` (0.15) estão ausentes, o reweight entre os dois
 * restantes reproduz exatamente 0.55/0.45 (0.385/0.315 = 11/9 = 0.55/0.45).
 */
const PESOS = {
  externalMarketSignals: 0.385,
  automationFeasibility: 0.315,
  historicalPerformance: 0.15,
  mlPrediction: 0.15,
}

export function calcularOpportunityScoreComposto(
  op: AffiliateOpportunity,
  extras: { historicalPerformance?: number | null; mlPrediction?: OpportunityMLPrediction | null } = {}
): OpportunityScoreComponents {
  const potencial = notaPotencial(op)
  const automatizabilidade = notaAutomatizabilidade(op)

  const historicalPerformance = extras.historicalPerformance ?? null
  const mlPredictionScore =
    extras.mlPrediction?.predictedConversionProbability != null ? extras.mlPrediction.predictedConversionProbability * 100 : null

  const componentesDisponiveis: { valor: number; peso: number }[] = [
    { valor: potencial.nota, peso: PESOS.externalMarketSignals },
    { valor: automatizabilidade.nota, peso: PESOS.automationFeasibility },
  ]
  if (historicalPerformance != null) componentesDisponiveis.push({ valor: historicalPerformance, peso: PESOS.historicalPerformance })
  if (mlPredictionScore != null) componentesDisponiveis.push({ valor: mlPredictionScore, peso: PESOS.mlPrediction })

  const pesoTotal = componentesDisponiveis.reduce((s, c) => s + c.peso, 0)
  const final = Math.round(componentesDisponiveis.reduce((s, c) => s + c.valor * c.peso, 0) / pesoTotal)

  const motivos = [...potencial.motivos, ...automatizabilidade.motivos]
  if (historicalPerformance == null) motivos.push('sem histórico de performance real para este produto/categoria ainda')
  if (mlPredictionScore == null) motivos.push('sem previsão de ML disponível (modelo ainda não ACTIVE ou dados insuficientes)')

  const decisionType: MLDecisionType = extras.mlPrediction?.decisionType ?? (historicalPerformance != null ? 'STATISTICAL_LEARNING' : 'RULE_BASED')

  return {
    externalMarketSignals: potencial.nota,
    automationFeasibility: automatizabilidade.nota,
    historicalPerformance,
    mlPrediction: mlPredictionScore,
    final,
    motivos,
    decisionType,
  }
}

/**
 * Implementa `OpportunityScorer` (contrato inalterado, lib/affiliate-discovery.ts)
 * — injetável em `AutopilotDeps.scorer` no lugar de `AutomationFeasibilityScorer`
 * sem mudar a assinatura que `runAutopilot` já espera. Previsões de ML e
 * performance histórica são pré-computadas (assíncronas) ANTES de montar
 * este scorer, já que `score()`/`rank()` do contrato são síncronos.
 */
export class MLBlendedScorer implements OpportunityScorer {
  constructor(
    private historicalPerformanceByKey: Map<string, number> = new Map(),
    private mlPredictionsByKey: Map<string, OpportunityMLPrediction> = new Map()
  ) {}

  private componentes(candidate: AffiliateOpportunity): OpportunityScoreComponents {
    const chave = chaveOportunidade(candidate)
    return calcularOpportunityScoreComposto(candidate, {
      historicalPerformance: this.historicalPerformanceByKey.get(chave) ?? null,
      mlPrediction: this.mlPredictionsByKey.get(chave) ?? null,
    })
  }

  score(candidate: AffiliateOpportunity): number {
    return this.componentes(candidate).final
  }

  rank(candidates: AffiliateOpportunity[]): AffiliateOpportunity[] {
    return [...candidates].sort((a, b) => this.score(b) - this.score(a))
  }

  /** Nunca esconde a origem do score (regra 12/36) — os 4 componentes separados. */
  explicar(candidate: AffiliateOpportunity): OpportunityScoreComponents {
    return this.componentes(candidate)
  }
}

/**
 * Explicação em linguagem simples (regra 36) — nunca jargão técnico
 * (ROC-AUC, feature importance, gradient boosting) na interface
 * principal; detalhes técnicos ficam só na área administrativa/avançada.
 */
export function explicarEmLinguagemSimples(components: OpportunityScoreComponents, produtoNome: string): string {
  const partes: string[] = [`Escolhi "${produtoNome}" porque:`]
  partes.push(`- Tendência e comissão no mercado: ${components.externalMarketSignals}/100`)
  partes.push(`- Consigo fazer isso sozinho, sem te incomodar: ${components.automationFeasibility}/100`)
  if (components.historicalPerformance != null) partes.push(`- Histórico real de conversão nessa categoria: ${Math.round(components.historicalPerformance)}/100`)
  if (components.mlPrediction != null) partes.push(`- O que aprendi com publicações anteriores: ${Math.round(components.mlPrediction)}/100`)
  return partes.join('\n')
}
