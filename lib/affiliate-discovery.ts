/**
 * Arquitetura FUTURA — NÃO implementada nesta rodada.
 *
 * Este arquivo só declara os TIPOS (contratos), sem nenhuma lógica de
 * execução, sem chamada de rede, sem integração externa. Existe para que
 * uma rodada futura tenha um contrato já pensado para implementar de
 * verdade, em vez de decidir a forma dos dados às pressas.
 *
 * Direção do produto (não executar ainda):
 *   descobrir programa → avaliar oportunidade → orientar/automatizar
 *   adesão → encontrar produtos → criar conteúdo → publicar → medir →
 *   vender → aprender.
 *
 * Regras já decididas para quando isso for implementado:
 * - Usar SOMENTE fontes oficiais ou autorizadas (nunca raspar/violar termos).
 * - Nunca assumir que um programa continua disponível para sempre —
 *   `AffiliateProvider.lastVerifiedAt`/`fonteDasRegras` (lib/affiliate-providers.ts)
 *   já existem para isso.
 * - Nunca contornar exigência de aceite pessoal, CPF, dados bancários,
 *   autenticação ou qualquer confirmação que só a própria usuária pode dar
 *   — o motor deve preparar tudo e parar exatamente nesse ponto.
 */

import type { AffiliateProvider } from './affiliate-providers'

/** Uma oportunidade concreta de venda dentro de um provider. */
export interface AffiliateOpportunity {
  providerId: string
  productName: string
  category: string
  price?: number
  commissionPercent?: number
  estimatedCommissionBRL?: number
  salesVolumeRank?: number
  trending?: boolean
  historicalConversionRate?: number
  channelFit?: string[]
  source: string
  lastVerifiedAt: string
}

/**
 * Compara oportunidades entre providers para sugerir onde vale mais a pena
 * divulgar. Implementação futura — hoje é só o contrato.
 */
export interface OpportunityScorer {
  score(opportunity: AffiliateOpportunity): number
  rank(opportunities: AffiliateOpportunity[]): AffiliateOpportunity[]
}

/**
 * Varre categorias (moda, beleza, casa, eletrônicos, etc.) em providers
 * conhecidos (lib/affiliate-providers.ts) e providers novos ainda não
 * cadastrados, sempre por fonte oficial/autorizada. Implementação futura —
 * hoje é só o contrato.
 */
export interface AffiliateProgramDiscoveryEngine {
  discoverByCategory(category: string): Promise<AffiliateProvider[]>
  discoverOpportunities(providerId: string): Promise<AffiliateOpportunity[]>
}
