/**
 * Taxonomia do Machine Learning do Patrono (Rodada 9, complemento — ML
 * Real, regra 1). Regra permanente: NUNCA chamar de "Machine Learning"
 * algo que é só regra fixa/média/ranking/peso manual/if-else. Toda
 * decisão registrada no sistema (score, previsão, escolha de variante)
 * carrega um `MLDecisionType` explícito — nunca escondido.
 */

export const ML_DECISION_TYPES = ['RULE_BASED', 'STATISTICAL_LEARNING', 'MACHINE_LEARNING', 'MODEL_BASED'] as const
export type MLDecisionType = (typeof ML_DECISION_TYPES)[number]

export const ML_DECISION_TYPE_DESCRICOES: Record<MLDecisionType, string> = {
  RULE_BASED: 'Regra fixa/determinística (if/else, peso manual, ranking) — nenhum parâmetro é aprendido a partir de dados.',
  STATISTICAL_LEARNING: 'Estatística simples sobre dados reais (médias, taxas de conversão históricas por grupo) — nenhum modelo paramétrico treinado por otimização.',
  MACHINE_LEARNING: 'Modelo paramétrico treinado por otimização sobre dados reais (ex.: regressão logística via gradiente descendente) — generaliza para combinações de features nunca vistas.',
  MODEL_BASED: 'Decisão derivada diretamente da saída de um MLModel ACTIVE específico (modelId + version registrados).',
}

/** Escada de maturidade (regra 3) — nunca pula etapa, nunca força ML com poucos dados. */
export const ML_READINESS_STATES = ['INSUFFICIENT_DATA', 'READY_FOR_STATISTICS', 'READY_FOR_ML', 'MODEL_ACTIVE'] as const
export type MLReadinessState = (typeof ML_READINESS_STATES)[number]

export const ML_MODEL_STATUSES = ['CANDIDATE', 'VALIDATED', 'ACTIVE', 'DEPRECATED', 'ROLLED_BACK'] as const
export type MLModelStatus = (typeof ML_MODEL_STATUSES)[number]

export const ML_TRAINING_RUN_STATUSES = ['RUNNING', 'COMPLETED', 'FAILED'] as const
export type MLTrainingRunStatus = (typeof ML_TRAINING_RUN_STATUSES)[number]

export const CREATIVE_EXPERIMENT_STATUSES = ['RUNNING', 'CONCLUDED', 'CANCELLED'] as const
export type CreativeExperimentStatus = (typeof CREATIVE_EXPERIMENT_STATUSES)[number]

export const CREATIVE_EXPERIMENT_VARIANTS = ['A', 'B'] as const
export type CreativeExperimentVariant = (typeof CREATIVE_EXPERIMENT_VARIANTS)[number]
