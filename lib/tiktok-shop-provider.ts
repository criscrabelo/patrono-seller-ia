/**
 * TikTokShopAffiliateProvider (Rodada 5) — PROVIDER de afiliados do TikTok
 * Shop: produtos, oportunidades, links, comissões, vendas. Propositalmente
 * SEPARADO de `lib/tiktok-channel.ts` (TikTokChannel), que cuida só de
 * criação/publicação/disclosure/consentimento/status/métricas do CANAL
 * TikTok. Nunca misturar os dois — uma conta pode ter o canal conectado
 * sem ter o TikTok Shop, e vice-versa.
 *
 * Sem credenciais (`TIKTOK_SHOP_APP_KEY`, `TIKTOK_SHOP_APP_SECRET`):
 * healthCheck() devolve "TIKTOK SHOP — AGUARDANDO CONFIGURAÇÃO",
 * getCandidates() devolve lista vazia — nunca inventa oportunidade.
 */

import type { AffiliateOpportunity, OpportunitySource } from './affiliate-discovery'

export interface TikTokShopCredentials {
  appKey: string
  appSecret: string
}

export function lerCredenciaisTikTokShop(): TikTokShopCredentials | null {
  const appKey = process.env.TIKTOK_SHOP_APP_KEY
  const appSecret = process.env.TIKTOK_SHOP_APP_SECRET
  if (!appKey || !appSecret) return null
  return { appKey, appSecret }
}

export type TikTokShopHealthStatus =
  | { configured: false; status: 'AGUARDANDO CONFIGURAÇÃO'; message: string }
  | { configured: true; status: 'OK' | 'ERROR'; message: string }

/**
 * Implementação atual: nenhuma API oficial de afiliados do TikTok Shop foi
 * confirmada/registrada nesta rodada (ver REGRAS-PROVIDERS-E-CANAIS.md,
 * seção "TikTok Shop" — status A VERIFICAR). Por isso este provider nunca
 * fabrica produto, link ou comissão — existe só para o resto do código já
 * poder depender da interface `OpportunitySource`, trocando esta classe
 * pela integração real assim que a API/permissão for confirmada.
 */
export class TikTokShopAffiliateProvider implements OpportunitySource {
  async healthCheck(): Promise<TikTokShopHealthStatus> {
    const creds = lerCredenciaisTikTokShop()
    if (!creds) {
      return {
        configured: false,
        status: 'AGUARDANDO CONFIGURAÇÃO',
        message: 'Defina TIKTOK_SHOP_APP_KEY e TIKTOK_SHOP_APP_SECRET para conectar (API oficial ainda A VERIFICAR).',
      }
    }
    return { configured: true, status: 'ERROR', message: 'Credenciais presentes, mas nenhuma chamada real implementada — API de afiliados do TikTok Shop ainda não confirmada.' }
  }

  async getCandidates(): Promise<AffiliateOpportunity[]> {
    // Nunca inventa oportunidade sem uma API oficial confirmada.
    return []
  }
}
