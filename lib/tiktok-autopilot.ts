/**
 * Cenários de Autopilot específicos do TikTok (Rodada 6, regras 32-34) —
 * complementam `lib/autopilot.ts` (runAutopilot genérico, já com TikTok
 * como canal primário desde a Rodada 5) com dois cenários explícitos que a
 * rodada pediu isoladamente, fáceis de testar sem o ciclo completo:
 *
 *  - `dryRunTikTokAutopilot`: os 7 passos até READY_TO_PUBLISH, nunca chama
 *    Direct Post de verdade.
 *  - `executarTikTokPrivateTest`: publica de verdade, mas SÓ na privacidade
 *    permitida para app não auditado (nunca pública) — usado para validar
 *    a integração real antes de produção.
 */

import type { AffiliateOpportunity } from './affiliate-discovery'
import { direitosDaPolicy, mediaRightsGate, type MediaUsagePolicy } from './media-rights'
import { decidirDisclosure } from './compliance-engine'
import { tiktokHumanConsentGate, type TikTokPreflightValidator, type TikTokCreatorInfo } from './tiktok-preflight'
import { resolverPrivacidadeTikTok } from './tiktok-privacy'
import type { TikTokPublisher, TikTokCredentials, TikTokDisclosureFlags } from './tiktok-channel'

export type TikTokAutopilotDryRunStatus = 'READY_TO_PUBLISH' | 'REQUIRES_USER_CONSENT' | 'BLOCKED_BY_POLICY'

export interface TikTokAutopilotDryRunResult {
  status: TikTokAutopilotDryRunStatus
  opportunity: AffiliateOpportunity
  assetUrl: string | null
  mensagemParaUsuaria: string | null
  passos: string[]
}

export interface TikTokAutopilotDryRunDeps {
  gerarAsset: (opportunity: AffiliateOpportunity) => Promise<{ url: string }>
  mediaRightsResolver: (opportunity: AffiliateOpportunity) => { policy: MediaUsagePolicy; source: string }
  preflight: TikTokPreflightValidator
  obterCreatorInfoSeConectado: () => Promise<TikTokCreatorInfo | null>
}

/**
 * 1. seleciona produto (recebido já selecionado — a seleção em si é
 *    responsabilidade do `AutomationFeasibilityScorer`, já testado em
 *    `lib/automation-feasibility.ts`) → 2. gera asset → 3. preflight →
 * 4. creator info se conectado → 5. disclosure → 6. consent gate →
 * 7. READY_TO_PUBLISH. Nunca chama Direct Post.
 */
export async function dryRunTikTokAutopilot(
  opportunity: AffiliateOpportunity,
  deps: TikTokAutopilotDryRunDeps
): Promise<TikTokAutopilotDryRunResult> {
  const passos: string[] = ['1. produto selecionado']

  const politica = deps.mediaRightsResolver(opportunity)
  const record = direitosDaPolicy(politica.policy, {
    assetId: opportunity.productName,
    source: politica.source,
    storageExpiresAt: null,
    authorizingSource: politica.source,
  })
  const decisaoMidia = mediaRightsGate(record, 'reusar-social')
  if (!decisaoMidia.allowed) {
    passos.push('bloqueado por media rights antes de gerar asset')
    return { status: 'BLOCKED_BY_POLICY', opportunity, assetUrl: null, mensagemParaUsuaria: null, passos }
  }

  const asset = await deps.gerarAsset(opportunity)
  passos.push('2. asset gerado')

  const preflight = await deps.preflight.validar({ contentId: opportunity.productName, workspaceId: 'dry-run' })
  passos.push(`3. preflight: ${preflight.status}`)
  if (preflight.status === 'BLOCKED_BY_POLICY') {
    return { status: 'BLOCKED_BY_POLICY', opportunity, assetUrl: asset.url, mensagemParaUsuaria: null, passos }
  }

  const creatorInfo = await deps.obterCreatorInfoSeConectado()
  passos.push(creatorInfo ? '4. creator info consultado (conectado)' : '4. sem conexão TikTok ainda')

  const disclosure = decidirDisclosure({
    opportunity: { origin: opportunity.origin, providerId: opportunity.providerId },
    channel: { channelId: 'tiktok', commercialDisclosure: true },
  })
  passos.push(`5. disclosure: necessario=${disclosure.necessario}`)

  const consent = tiktokHumanConsentGate(preflight)
  passos.push(`6. consent gate: liberadoParaPublicarSozinho=${consent.liberadoParaPublicarSozinho}`)

  if (consent.mensagemParaUsuaria) {
    return { status: 'REQUIRES_USER_CONSENT', opportunity, assetUrl: asset.url, mensagemParaUsuaria: consent.mensagemParaUsuaria, passos }
  }

  passos.push('7. READY_TO_PUBLISH (dry run — Direct Post nunca chamado)')
  return { status: 'READY_TO_PUBLISH', opportunity, assetUrl: asset.url, mensagemParaUsuaria: null, passos }
}

// ── TIKTOK_PRIVATE_TEST (regra 33) ────────────────────────────────────────

export interface TikTokPrivateTestResult {
  publishId: string
  privacyLevelUsado: string
}

/**
 * Publica de verdade, mas SÓ na privacidade permitida para app não
 * auditado — nunca pública. Usado para validar a integração real (regra
 * 33: "não transformar em publicação pública").
 */
export async function executarTikTokPrivateTest(params: {
  publisher: TikTokPublisher
  creds: TikTokCredentials
  videoUrl: string
  legenda: string
  disclosure: TikTokDisclosureFlags
  opcoesPermitidasPelaConta: string[] | 'unknown'
}): Promise<TikTokPrivateTestResult> {
  const resolucao = resolverPrivacidadeTikTok({
    appAuditado: false, // este modo só existe justamente porque o app NÃO está auditado
    opcoesPermitidasPelaConta: params.opcoesPermitidasPelaConta,
    preferenciaConfiguradaPelaUsuaria: null,
  })
  if (resolucao.status !== 'PRIVATE_TESTING_ONLY' || !resolucao.privacyLevel) {
    throw new Error('TIKTOK_PRIVATE_TEST só pode publicar em privacidade privada — resolução não confirmou isso.')
  }

  const resultado = await params.publisher.publicar({
    creds: params.creds,
    videoUrl: params.videoUrl,
    legenda: params.legenda,
    disclosure: params.disclosure,
    privacyLevel: resolucao.privacyLevel,
  })
  return { publishId: resultado.publishId, privacyLevelUsado: resolucao.privacyLevel }
}
