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
 *   já existem para isso; `AffiliateProviderCapability.lastVerifiedAt`
 *   (lib/affiliate-provider-capabilities.ts) idem para o que é permitido.
 * - Nunca contornar exigência de aceite pessoal, CPF, dados bancários,
 *   autenticação ou qualquer confirmação que só a própria usuária pode dar
 *   — o motor deve preparar tudo e parar exatamente nesse ponto (ver
 *   `HumanActionRequired` em lib/automation.ts).
 * - Campo desconhecido fica `undefined`/`null` — nunca um número inventado
 *   "para preencher a tela".
 */

import type { AffiliateProvider } from './affiliate-providers'

/**
 * De onde veio o dado de uma oportunidade. `SCRAPED_UNOFFICIAL` NÃO existe
 * de propósito — nunca é uma fonte operacional aceita nesta plataforma.
 */
export const ORIGEM_OPORTUNIDADE = [
  'OFFICIAL_API',
  'AUTHORIZED_PARTNER_API',
  'AFFILIATE_PORTAL_IMPORT',
  'USER_PROVIDED',
  'MANUAL',
] as const
export type OrigemOportunidade = (typeof ORIGEM_OPORTUNIDADE)[number]

/**
 * Uma oportunidade concreta de venda dentro de um provider. Campos que
 * dependem de dado externo não confirmado ficam `null`/`undefined` — nunca
 * um valor inventado para não deixar a tela "vazia".
 */
export interface AffiliateOpportunity {
  providerId: string
  productName: string
  category: string
  price?: number | null
  commissionPercent?: number | null
  estimatedCommissionBRL?: number | null
  salesVolumeRank?: number | null
  trending?: boolean | null
  historicalConversionRate?: number | null
  channelFit?: string[]
  origin: OrigemOportunidade
  source: string
  lastVerifiedAt: string
}

/** Uma fonte de candidatos a oportunidade — um provider, um canal, um dado informado pela usuária. */
export interface OpportunitySource {
  getCandidates(params: { workspaceId: string; category?: string }): Promise<AffiliateOpportunity[]>
}

/**
 * Compara oportunidades entre providers para sugerir onde vale mais a pena
 * divulgar. Implementação futura — hoje é só o contrato. `score` nunca
 * deve inventar valor para um campo `null`/`undefined` da oportunidade —
 * a ausência de dado entra como "desconhecido", não como zero.
 */
export interface OpportunityScorer {
  score(candidate: AffiliateOpportunity): number
  rank(candidates: AffiliateOpportunity[]): AffiliateOpportunity[]
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
