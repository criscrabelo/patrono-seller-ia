/**
 * runAutopilot (Rodada 5) — primeiro ciclo operacional REAL do Automation
 * First, implementando o ciclo de 14 etapas pedido: encontrar oportunidades
 * elegíveis → pontuar (AutomationFeasibilityScorer) → excluir
 * BLOCKED_BY_POLICY → calcular feasibility → selecionar melhor candidato →
 * obter link autorizado → obter mídia autorizada → gerar conteúdo →
 * validar → preparar publicação → publicar quando permitido → registrar
 * publicação → acompanhar status → registrar métricas.
 *
 * PRIORIDADE DE CANAL: TikTok primeiro (canal principal do MVP Automation
 * First, ver ajuste de prioridade estratégica da Rodada 5), Instagram como
 * segunda opção quando TikTok não estiver disponível/liberado.
 *
 * Kill switch: `Workspace.automationPaused` é checado ANTES de qualquer
 * trabalho e de novo imediatamente antes da etapa externa (publicação) —
 * um job em andamento nunca ignora uma pausa que aconteceu no meio do
 * caminho.
 *
 * Dry run: `dryRun: true` (também via env `AUTOPILOT_DRY_RUN=true`) faz
 * tudo até READY_TO_PUBLISH e registra exatamente o que teria sido
 * publicado — nunca chama a publicação real.
 */

import type { AffiliateOpportunity, OpportunitySource, OpportunityScorer } from './affiliate-discovery'
import { AutomationFeasibilityScorer, calcularFeasibility, type FeasibilityBreakdown } from './automation-feasibility'
import { direitosDaPolicy, mediaRightsGate, type MediaRightsRecord, type MediaUsagePolicy } from './media-rights'
import { formatarBRLOuNulo } from './formato-moeda'
import { decidirDisclosure } from './compliance-engine'
import { TikTokPreflightNotConfigured, tiktokHumanConsentGate, type TikTokPreflightValidator } from './tiktok-preflight'
import { InstagramPreflightValidator } from './instagram-preflight'
import type { RendererProvider } from './creative-factory'
import { MLBlendedScorer } from './opportunity-score-composite'
import type { OpportunityMLPrediction } from './ml-engine'

export type AutopilotStepStatus =
  | 'NO_OPPORTUNITY'
  | 'ALL_BLOCKED_BY_POLICY'
  | 'PAUSED'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHED'
  | 'DRY_RUN_COMPLETE'
  | 'REQUIRES_USER_CONSENT'
  | 'BLOCKED_BY_POLICY'
  | 'RATE_LIMITED'
  | 'FAILED'

export interface AutopilotAuditEntry {
  step: string
  detail: string
  createdAt: string
  /** Nome do produto envolvido, quando aplicável — usado por anti-spam (nunca repetir o mesmo produto no dia). */
  productName?: string
}

export interface AutopilotResult {
  status: AutopilotStepStatus
  channel: 'tiktok' | 'instagram' | null
  selected: AffiliateOpportunity | null
  feasibility: FeasibilityBreakdown | null
  mediaRights: MediaRightsRecord | null
  contentUrl: string | null
  publicationId: string | null
  mensagemParaUsuaria: string | null
  audit: AutopilotAuditEntry[]
}

export interface WorkspaceAutomationControls {
  automationPaused: boolean
  automationMode: 'MANUAL' | 'ASSISTED' | 'AUTOMATIC'
}

/**
 * Limites operacionais internos de segurança — NUNCA descritos como "limite
 * de shadowban" ou qualquer coisa atribuída à plataforma. São só o Patrono
 * evitando se comportar de forma abusiva.
 */
export interface AutopilotLimits {
  maxPublicacoesPorDia: number
  cooldownMinutos: number
}

export const LIMITES_PADRAO: AutopilotLimits = {
  maxPublicacoesPorDia: 3,
  cooldownMinutos: 60,
}

/** Fonte de dados/persistência do autopilot — injetável para permitir teste sem banco real. */
export interface AutopilotStore {
  getWorkspaceControls(workspaceId: string): Promise<WorkspaceAutomationControls>
  registrarAuditoria(workspaceId: string, entry: AutopilotAuditEntry): Promise<void>
  publicacoesHoje(workspaceId: string): Promise<number>
  ultimaPublicacaoEm(workspaceId: string): Promise<Date | null>
  /** Nomes de produto já publicados hoje (anti-spam: nunca repetir o mesmo produto no mesmo dia). */
  produtosPublicadosHoje(workspaceId: string): Promise<string[]>
}

export interface AutopilotPublisher {
  /** Publica de verdade (nunca chamado em dry run). Retorna um id de publicação. */
  publicar(params: { channel: 'tiktok' | 'instagram'; contentUrl: string; legenda: string }): Promise<string>
}

/**
 * PatronoMLEngine (Rodada 9, complemento ML, regra 43) — fonte opcional de
 * previsão de conversão por oportunidade. Injetável para não acoplar
 * `runAutopilot` diretamente ao Prisma (mesmo padrão de `store`/`publisher`).
 */
export interface MLPredictionSource {
  preverOportunidades(workspaceId: string, candidatos: AffiliateOpportunity[]): Promise<OpportunityMLPrediction[]>
}

export interface AutopilotDeps {
  opportunitySources: OpportunitySource[]
  mediaRightsResolver: (opportunity: AffiliateOpportunity) => { policy: MediaUsagePolicy; source: string }
  renderer: RendererProvider
  tiktokPreflight: TikTokPreflightValidator
  tiktokAvailable: boolean // credenciais TikTok configuradas (health check já feito por quem monta os deps)
  instagramAvailable: boolean
  store: AutopilotStore
  publisher: AutopilotPublisher
  limits?: AutopilotLimits
  /** Scorer explícito — quando informado, tem prioridade sobre `mlEngine` (nunca sobrescrito). */
  scorer?: OpportunityScorer
  /** Rodada 9, complemento ML (regra 43) — opcional; ausência preserva 100% o comportamento anterior. */
  mlEngine?: MLPredictionSource
}

/** Toda etapa relevante é registrada — nunca só as duas últimas (regra 31: trilha completa). */
async function tocaAuditoria(
  store: AutopilotStore,
  workspaceId: string,
  audit: AutopilotAuditEntry[],
  step: string,
  detail: string,
  productName?: string
) {
  const entry: AutopilotAuditEntry = { step, detail, createdAt: new Date().toISOString(), productName }
  audit.push(entry)
  await store.registrarAuditoria(workspaceId, entry)
}

/** Gera a legenda SÓ a partir de dados presentes na oportunidade — nunca inventa benefício/preço/desconto. */
function legendaFactual(op: AffiliateOpportunity): string {
  const partes = [op.productName]
  const precoFormatado = formatarBRLOuNulo(op.price)
  if (precoFormatado) partes.push(`Preço consultado em ${op.lastVerifiedAt}: ${precoFormatado}`)
  else partes.push('Confira o preço atual.')
  return partes.join(' — ')
}

export async function runAutopilot(
  workspaceId: string,
  deps: AutopilotDeps,
  options: { dryRun?: boolean } = {}
): Promise<AutopilotResult> {
  const audit: AutopilotAuditEntry[] = []
  const dryRun = options.dryRun ?? (process.env.AUTOPILOT_DRY_RUN ?? 'true') !== 'false'
  const limits = deps.limits ?? LIMITES_PADRAO

  const resultadoVazio = (status: AutopilotStepStatus, mensagem: string | null = null): AutopilotResult => ({
    status,
    channel: null,
    selected: null,
    feasibility: null,
    mediaRights: null,
    contentUrl: null,
    publicationId: null,
    mensagemParaUsuaria: mensagem,
    audit,
  })

  // 0. Kill switch — checado antes de qualquer trabalho.
  const controls = await deps.store.getWorkspaceControls(workspaceId)
  await tocaAuditoria(deps.store, workspaceId, audit, 'kill_switch_check', `automationPaused=${controls.automationPaused} automationMode=${controls.automationMode}`)
  if (controls.automationPaused) {
    return resultadoVazio('PAUSED', 'Automação pausada para este workspace.')
  }

  // 1. Encontrar oportunidades elegíveis (todas as fontes configuradas).
  const candidatos: AffiliateOpportunity[] = []
  for (const source of deps.opportunitySources) {
    const encontrados = await source.getCandidates({ workspaceId })
    candidatos.push(...encontrados)
  }
  await tocaAuditoria(deps.store, workspaceId, audit, 'opportunity_found', `${candidatos.length} oportunidade(s) encontrada(s).`)
  if (candidatos.length === 0) {
    return resultadoVazio('NO_OPPORTUNITY', null)
  }

  // 2. Pontuar. Por padrão, AutomationFeasibilityScorer (Rodada 5) —
  // preservado exatamente. Quando `deps.mlEngine` é informado (Rodada 9,
  // complemento ML) e nenhum `deps.scorer` explícito foi passado, o score
  // evolui para o composto (External Market Signals + Automation
  // Feasibility + ML Prediction) via MLBlendedScorer. Falha do ML NUNCA
  // bloqueia o Autopilot (regra 44) — cai para o score determinístico.
  let scorer: OpportunityScorer
  if (deps.scorer) {
    scorer = deps.scorer
  } else if (deps.mlEngine) {
    try {
      const predicoes = await deps.mlEngine.preverOportunidades(workspaceId, candidatos)
      const mapaPredicoes = new Map(predicoes.map((p) => [p.opportunityKey, p]))
      scorer = new MLBlendedScorer(new Map(), mapaPredicoes)
      await tocaAuditoria(deps.store, workspaceId, audit, 'ml_prediction', `${predicoes.length} previsão(ões) de ML consultada(s) — detalhes em MLPrediction/AuditLog.`)
    } catch (e) {
      scorer = new AutomationFeasibilityScorer()
      await tocaAuditoria(
        deps.store,
        workspaceId,
        audit,
        'ml_prediction_failed',
        `Falha ao consultar o PatronoMLEngine — usando o score determinístico (o Autopilot nunca trava por causa do ML): ${e instanceof Error ? e.message : 'erro desconhecido'}.`
      )
    }
  } else {
    scorer = new AutomationFeasibilityScorer()
  }
  const ranqueados = scorer.rank(candidatos)
  await tocaAuditoria(deps.store, workspaceId, audit, 'score', `Ranking calculado para ${ranqueados.length} candidato(s).`)

  // 3+4. Excluir BLOCKED_BY_POLICY (mídia) e calcular feasibility detalhado, na ordem do ranking.
  let selecionado: AffiliateOpportunity | null = null
  let mediaRights: MediaRightsRecord | null = null
  let feasibility: FeasibilityBreakdown | null = null

  for (const candidato of ranqueados) {
    const politica = deps.mediaRightsResolver(candidato)
    const record = direitosDaPolicy(politica.policy, {
      assetId: candidato.productName,
      source: politica.source,
      storageExpiresAt: null,
      authorizingSource: politica.source,
    })
    const decisao = mediaRightsGate(record, 'reusar-social')
    if (!decisao.allowed) {
      await tocaAuditoria(deps.store, workspaceId, audit, 'media_rights_blocked', `${candidato.productName}: ${decisao.reason}`)
      continue // Nunca pergunta primeiro — tenta o próximo candidato automaticamente.
    }
    selecionado = candidato
    mediaRights = record
    feasibility = calcularFeasibility(candidato)
    break
  }

  if (!selecionado || !mediaRights || !feasibility) {
    await tocaAuditoria(deps.store, workspaceId, audit, 'selection', 'Nenhum candidato passou no MediaRightsGate.')
    return resultadoVazio('ALL_BLOCKED_BY_POLICY', null)
  }
  await tocaAuditoria(deps.store, workspaceId, audit, 'selection', `Selecionado: ${selecionado.productName} (feasibility=${feasibility.final.toFixed(1)}).`)

  // 5. Link autorizado — oportunidades que exigem consentimento (ex.: Mercado Livre) não têm link automático.
  if (selecionado.requiresUserConsent || !selecionado.canGenerateLinkAutomatically) {
    await tocaAuditoria(deps.store, workspaceId, audit, 'link', 'Produto exige geração de link pela ferramenta oficial da usuária — automação para aqui.')
    return {
      ...resultadoVazio('REQUIRES_USER_CONSENT', 'Gere o link de afiliado na ferramenta oficial do provider para continuar.'),
      selected: selecionado,
      feasibility,
      mediaRights,
    }
  }
  await tocaAuditoria(deps.store, workspaceId, audit, 'link', 'Link de afiliado obtido automaticamente (já incluso na oportunidade).')

  // 6. Mídia autorizada — já validada no passo 3/4 (mediaRights.canReuseSocial === true aqui).
  await tocaAuditoria(deps.store, workspaceId, audit, 'media', `Mídia autorizada (policy confirmada por ${mediaRights.source}).`)

  // 7. Gerar conteúdo — legenda só com dados factuais da oportunidade.
  const legenda = legendaFactual(selecionado)
  let contentUrl: string
  try {
    const render = await deps.renderer.render({
      mediaAssetIds: [mediaRights.assetId],
      format: 'reel-simples',
      overlays: [
        { texto: selecionado.productName, posicao: 'topo' },
        { texto: legenda, posicao: 'rodape' },
      ],
    })
    contentUrl = render.url
  } catch (e) {
    await tocaAuditoria(deps.store, workspaceId, audit, 'content_generation_failed', e instanceof Error ? e.message : 'Falha ao gerar conteúdo.')
    return { ...resultadoVazio('FAILED', null), selected: selecionado, feasibility, mediaRights }
  }
  await tocaAuditoria(deps.store, workspaceId, audit, 'content_created', 'Conteúdo gerado via RendererFFmpeg.')

  // 8. Validar — TikTok primeiro (canal principal), Instagram como alternativa.
  let channel: 'tiktok' | 'instagram' | null = null
  let mensagemConsentimento: string | null = null

  if (deps.tiktokAvailable) {
    const preflight = await deps.tiktokPreflight.validar({ contentId: selecionado.productName, workspaceId })
    await tocaAuditoria(deps.store, workspaceId, audit, 'validation_tiktok', `status=${preflight.status}`)
    const consent = tiktokHumanConsentGate(preflight)
    if (preflight.status === 'BLOCKED_BY_POLICY') {
      await tocaAuditoria(deps.store, workspaceId, audit, 'validation_tiktok_blocked', preflight.motivo)
    } else if (consent.mensagemParaUsuaria) {
      channel = 'tiktok'
      mensagemConsentimento = consent.mensagemParaUsuaria
    } else if (consent.liberadoParaPublicarSozinho) {
      channel = 'tiktok'
    }
  }
  if (!channel && deps.instagramAvailable) {
    const igPreflight = new InstagramPreflightValidator().validar({
      tipo: 'REELS',
      mediaUrl: contentUrl,
      contaElegivel: true,
      midiaAutorizada: true,
    })
    await tocaAuditoria(deps.store, workspaceId, audit, 'validation_instagram', `status=${igPreflight.status}`)
    if (igPreflight.status === 'TECHNICALLY_VALID') channel = 'instagram'
  }

  if (!channel) {
    await tocaAuditoria(deps.store, workspaceId, audit, 'validation', 'Nenhum canal disponível/aprovado para publicar agora.')
    return { ...resultadoVazio('FAILED', null), selected: selecionado, feasibility, mediaRights, contentUrl }
  }

  // 9. Preparar publicação — disclosure comercial.
  const disclosure = decidirDisclosure({
    opportunity: { origin: selecionado.origin, providerId: selecionado.providerId },
    channel: { channelId: channel, commercialDisclosure: true },
  })
  const legendaFinal = disclosure.necessario ? `${legenda}\n\n${disclosure.texto}` : legenda
  await tocaAuditoria(deps.store, workspaceId, audit, 'compliance', `disclosure necessario=${disclosure.necessario} motivo=${disclosure.motivo}`)

  if (mensagemConsentimento) {
    await tocaAuditoria(deps.store, workspaceId, audit, 'consent_required', mensagemConsentimento)
    return {
      ...resultadoVazio('REQUIRES_USER_CONSENT', mensagemConsentimento),
      channel,
      selected: selecionado,
      feasibility,
      mediaRights,
      contentUrl,
    }
  }

  // Dry run: para aqui, nunca chama publicação real.
  if (dryRun) {
    await tocaAuditoria(deps.store, workspaceId, audit, 'dry_run', `Publicaria em ${channel} agora: "${legendaFinal}".`, selecionado.productName)
    return {
      status: 'DRY_RUN_COMPLETE',
      channel,
      selected: selecionado,
      feasibility,
      mediaRights,
      contentUrl,
      publicationId: null,
      mensagemParaUsuaria: null,
      audit,
    }
  }

  // Modo produção: só publica com automationMode === AUTOMATIC.
  if (controls.automationMode !== 'AUTOMATIC') {
    await tocaAuditoria(deps.store, workspaceId, audit, 'prod_gate_blocked', `automationMode=${controls.automationMode}, não é AUTOMATIC.`)
    return {
      status: 'READY_TO_PUBLISH',
      channel,
      selected: selecionado,
      feasibility,
      mediaRights,
      contentUrl,
      publicationId: null,
      mensagemParaUsuaria: null,
      audit,
    }
  }

  // Anti-spam / limites — checados por último, logo antes da etapa externa.
  const jaPublicadoHoje = await deps.store.produtosPublicadosHoje(workspaceId)
  if (jaPublicadoHoje.includes(selecionado.productName)) {
    await tocaAuditoria(deps.store, workspaceId, audit, 'anti_spam_blocked', `${selecionado.productName} já foi publicado hoje.`)
    return { ...resultadoVazio('RATE_LIMITED', null), channel, selected: selecionado, feasibility, mediaRights, contentUrl }
  }
  const publicacoesHoje = await deps.store.publicacoesHoje(workspaceId)
  if (publicacoesHoje >= limits.maxPublicacoesPorDia) {
    await tocaAuditoria(deps.store, workspaceId, audit, 'rate_limit_blocked', `Limite diário de ${limits.maxPublicacoesPorDia} publicações atingido.`)
    return { ...resultadoVazio('RATE_LIMITED', null), channel, selected: selecionado, feasibility, mediaRights, contentUrl }
  }
  const ultima = await deps.store.ultimaPublicacaoEm(workspaceId)
  if (ultima && Date.now() - ultima.getTime() < limits.cooldownMinutos * 60_000) {
    await tocaAuditoria(deps.store, workspaceId, audit, 'cooldown_blocked', `Cooldown de ${limits.cooldownMinutos} min ainda ativo.`)
    return { ...resultadoVazio('RATE_LIMITED', null), channel, selected: selecionado, feasibility, mediaRights, contentUrl }
  }

  // Kill switch checado de novo, imediatamente antes da chamada externa.
  const controlsAntesDePublicar = await deps.store.getWorkspaceControls(workspaceId)
  if (controlsAntesDePublicar.automationPaused) {
    await tocaAuditoria(deps.store, workspaceId, audit, 'kill_switch_check_before_publish', 'Pausado entre o início do ciclo e a publicação — abortando.')
    return { ...resultadoVazio('PAUSED', null), channel, selected: selecionado, feasibility, mediaRights, contentUrl }
  }

  // 10-13. Publicar, registrar, acompanhar status.
  let publicationId: string
  try {
    publicationId = await deps.publisher.publicar({ channel, contentUrl, legenda: legendaFinal })
  } catch (e) {
    await tocaAuditoria(deps.store, workspaceId, audit, 'publish_failed', e instanceof Error ? e.message : 'Falha ao publicar.')
    return { ...resultadoVazio('FAILED', null), channel, selected: selecionado, feasibility, mediaRights, contentUrl }
  }
  await tocaAuditoria(deps.store, workspaceId, audit, 'published', `publicationId=${publicationId} canal=${channel}`, selecionado.productName)

  // 14. Métricas ficam para uma consulta seguinte (TikTokAnalyticsAdapter) — não fazem parte deste ciclo síncrono.

  return {
    status: 'PUBLISHED',
    channel,
    selected: selecionado,
    feasibility,
    mediaRights,
    contentUrl,
    publicationId,
    mensagemParaUsuaria: null,
    audit,
  }
}

/** Implementação padrão de `TikTokPreflightValidator` quando não há credencial — reexportado para conveniência dos chamadores. */
export const tiktokPreflightNaoConfigurado = new TikTokPreflightNotConfigured()
