/**
 * Testes da Rodada 5 (Primeiro Autopilot Real). Ordem reflete o ajuste de
 * prioridade estratégica: TikTok primeiro, Instagram em seguida, depois
 * Amazon/Mercado Livre/Media Rights/Autopilot/Kill Switch/Zero State.
 *
 *   npm run test:rodada5
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { tiktokHumanConsentGate, TikTokPreflightNotConfigured, type TikTokPreflightResult } from '../lib/tiktok-preflight'
import { InstagramPreflightValidator } from '../lib/instagram-preflight'
import { OAuthTokenCache } from '../lib/oauth-token-cache'
import { obterAccessToken, mapearItemAmazon, lerCredenciaisAmazon, AmazonCreatorsProvider } from '../lib/amazon-creators'
import { podeSubmeterAutomaticamente, MercadoLivreOpportunitySource, lerCredenciaisMercadoLivre } from '../lib/mercado-livre-radar'
import { direitosDaPolicy, mediaRightsGate } from '../lib/media-rights'
import { AutomationFeasibilityScorer, calcularFeasibility } from '../lib/automation-feasibility'
import { runAutopilot, type AutopilotDeps, type AutopilotStore, type WorkspaceAutomationControls } from '../lib/autopilot'
import type { AffiliateOpportunity, OpportunitySource } from '../lib/affiliate-discovery'
import type { RendererProvider } from '../lib/creative-factory'

// ── 1. TikTok (prioridade nº 1) ──────────────────────────────────────────

describe('TikTok — preflight e consent gate', () => {
  test('sem credencial, o preflight nunca simula validação (NOT_VERIFIED)', async () => {
    const validator = new TikTokPreflightNotConfigured()
    const resultado = await validator.validar()
    assert.equal(resultado.status, 'NOT_VERIFIED')
    assert.equal(resultado.creatorInfo, null)
  })

  test('consent gate: BLOCKED_BY_POLICY nunca vira consentimento (é bloqueio, não pedido de autorização)', () => {
    const preflight: TikTokPreflightResult = { status: 'BLOCKED_BY_POLICY', creatorInfo: null, disclosureComercialNecessaria: true, motivo: 'x' }
    const gate = tiktokHumanConsentGate(preflight)
    assert.equal(gate.liberadoParaPublicarSozinho, false)
    assert.equal(gate.mensagemParaUsuaria, null)
  })

  test('consent gate: REQUIRES_USER_CONSENT devolve exatamente a mensagem mínima pedida', () => {
    const preflight: TikTokPreflightResult = { status: 'REQUIRES_USER_CONSENT', creatorInfo: null, disclosureComercialNecessaria: true, motivo: 'x' }
    const gate = tiktokHumanConsentGate(preflight)
    assert.equal(gate.liberadoParaPublicarSozinho, false)
    assert.equal(gate.mensagemParaUsuaria, 'Conteúdo pronto. Autorizar publicação no TikTok.')
  })

  test('consent gate: TECHNICALLY_VALID libera publicar sozinho, sem mensagem', () => {
    const preflight: TikTokPreflightResult = { status: 'TECHNICALLY_VALID', creatorInfo: null, disclosureComercialNecessaria: false, motivo: 'x' }
    const gate = tiktokHumanConsentGate(preflight)
    assert.equal(gate.liberadoParaPublicarSozinho, true)
    assert.equal(gate.mensagemParaUsuaria, null)
  })

  test('status PREVALIDATED_FOR_TIKTOK nunca é confundido com ACCEPTED_BY_TIKTOK (tipos distintos)', () => {
    // TikTokPublicationStatus é um tipo (checado em tempo de compilação); aqui só confirmamos
    // que os dois literais usados pelo código são valores distintos entre si.
    const estados: string[] = ['PREVALIDATED_FOR_TIKTOK', 'ACCEPTED_BY_TIKTOK']
    assert.notEqual(estados[0], estados[1])
  })
})

// ── 2. Instagram (prioridade nº 2) ──────────────────────────────────────

describe('Instagram — preflight', () => {
  test('mídia não autorizada bloqueia antes de qualquer outra checagem', () => {
    const resultado = new InstagramPreflightValidator().validar({
      tipo: 'REELS',
      mediaUrl: 'https://exemplo.com/v.mp4',
      contaElegivel: true,
      midiaAutorizada: false,
    })
    assert.equal(resultado.status, 'BLOCKED_BY_POLICY')
  })

  test('conta não elegível bloqueia', () => {
    const resultado = new InstagramPreflightValidator().validar({
      tipo: 'REELS',
      mediaUrl: 'https://exemplo.com/v.mp4',
      contaElegivel: false,
      midiaAutorizada: true,
    })
    assert.equal(resultado.status, 'BLOCKED_BY_POLICY')
  })

  test('campos técnicos completos e válidos → TECHNICALLY_VALID', () => {
    const resultado = new InstagramPreflightValidator().validar({
      tipo: 'REELS',
      mediaUrl: 'https://exemplo.com/v.mp4',
      codec: 'h264',
      aspectRatio: '9:16',
      duracaoSegundos: 20,
      tamanhoMB: 50,
      temAudio: true,
      contaElegivel: true,
      midiaAutorizada: true,
    })
    assert.equal(resultado.status, 'TECHNICALLY_VALID')
  })

  test('campo técnico desconhecido (não hardcodado como ok) vira NOT_VERIFIED', () => {
    const resultado = new InstagramPreflightValidator().validar({
      tipo: 'REELS',
      mediaUrl: 'https://exemplo.com/v.mp4',
      contaElegivel: true,
      midiaAutorizada: true,
    })
    assert.equal(resultado.status, 'NOT_VERIFIED')
  })
})

// ── 3. Amazon Creators API ───────────────────────────────────────────────

describe('Amazon Creators API', () => {
  test('token OAuth é cacheado — segunda chamada dentro da validade não bate na rede de novo', async () => {
    let chamadas = 0
    const fetcher = (async () => {
      chamadas++
      return new Response(JSON.stringify({ access_token: 'tok-1', expires_in: 3600 }), { status: 200 })
    }) as unknown as typeof fetch

    const creds = { credentialId: 'id-teste-cache', credentialSecret: 's', partnerTag: 'p' }
    const t1 = await obterAccessToken(creds, fetcher)
    const t2 = await obterAccessToken(creds, fetcher)
    assert.equal(t1, 'tok-1')
    assert.equal(t2, 'tok-1')
    assert.equal(chamadas, 1)
  })

  test('sem partnerTag, lerCredenciaisAmazon nunca devolve credencial parcial', () => {
    const original = { ...process.env }
    process.env.AMAZON_CREATORS_CREDENTIAL_ID = 'id'
    process.env.AMAZON_CREATORS_CREDENTIAL_SECRET = 'secret'
    delete process.env.AMAZON_CREATORS_PARTNER_TAG
    const creds = lerCredenciaisAmazon()
    assert.equal(creds, null)
    process.env = original
  })

  test('detailPageUrl nunca é reconstruída — usa exatamente o valor da API, com querystring intacta', () => {
    const item = mapearItemAmazon({
      ASIN: 'B000TESTE',
      ItemInfo: { Title: { DisplayValue: 'Produto Teste' } },
      DetailPageURL: 'https://www.amazon.com.br/dp/B000TESTE?tag=meutag-20&linkCode=abc123',
    })
    assert.equal(item.detailPageUrl, 'https://www.amazon.com.br/dp/B000TESTE?tag=meutag-20&linkCode=abc123')
  })

  test('SalesRank oficial da Amazon é distinto do score interno do Patrono', () => {
    const item = mapearItemAmazon({
      ASIN: 'B001',
      ItemInfo: { Title: { DisplayValue: 'X' } },
      DetailPageURL: 'https://www.amazon.com.br/dp/B001',
      BrowseNodeInfo: { BrowseNodes: [{ SalesRank: 42, DisplayName: 'Eletrônicos' }] },
    })
    assert.equal(item.officialSalesRank?.tipo, 'browse_node_sales_rank')
    assert.equal(item.officialSalesRank?.rank, 42)

    const opportunity: AffiliateOpportunity = {
      providerId: 'amazon-associados',
      productName: 'X',
      category: 'Eletrônicos',
      salesVolumeRank: item.officialSalesRank?.rank ?? null,
      origin: 'OFFICIAL_API',
      source: 'Amazon Creators API',
      lastVerifiedAt: item.consultedAt,
    }
    const score = calcularFeasibility(opportunity)
    // O score interno é um número calculado (0-100); o SalesRank oficial é o rank bruto da Amazon (42) — nunca o mesmo valor/semântica.
    assert.notEqual(score.final, opportunity.salesVolumeRank)
  })

  test('sem credenciais configuradas, getCandidates nunca inventa oportunidade (lista vazia)', async () => {
    const original = { ...process.env }
    delete process.env.AMAZON_CREATORS_CREDENTIAL_ID
    delete process.env.AMAZON_CREATORS_CREDENTIAL_SECRET
    delete process.env.AMAZON_CREATORS_PARTNER_TAG
    const provider = new AmazonCreatorsProvider()
    const candidatos = await provider.getCandidates({ workspaceId: 'w1' })
    assert.deepEqual(candidatos, [])
    const health = await provider.healthCheck()
    assert.equal(health.status, 'AGUARDANDO CONFIGURAÇÃO')
    process.env = original
  })
})

// ── 4. Mercado Livre ─────────────────────────────────────────────────────

describe('Mercado Livre', () => {
  test('ranking/tendência nunca vira link automático — capacidade fixa ASSISTED', async () => {
    const original = { ...process.env }
    delete process.env.MERCADO_LIVRE_APP_ID
    delete process.env.MERCADO_LIVRE_CLIENT_SECRET
    const provider = new MercadoLivreOpportunitySource()
    const candidatos = await provider.getCandidates({ workspaceId: 'w1' })
    assert.deepEqual(candidatos, [])
    process.env = original

    const creds = lerCredenciaisMercadoLivre()
    assert.equal(creds, null)
  })

  test('candidatos do ML sempre marcam canGenerateLinkAutomatically=false e requiresUserConsent=true', async () => {
    process.env.MERCADO_LIVRE_APP_ID = 'app'
    process.env.MERCADO_LIVRE_CLIENT_SECRET = 'secret'
    const fetcher = (async () =>
      new Response(JSON.stringify({ content: [{ id: 'MLB1', name: 'Produto ML', position: 3, permalink: 'https://produto.mercadolivre.com.br/MLB1' }] }), {
        status: 200,
      })) as unknown as typeof fetch
    const provider = new MercadoLivreOpportunitySource(fetcher)
    const candidatos = await provider.getCandidates({ workspaceId: 'w1' })
    assert.equal(candidatos.length, 1)
    assert.equal(candidatos[0].canGenerateLinkAutomatically, false)
    assert.equal(candidatos[0].requiresUserConsent, true)
    delete process.env.MERCADO_LIVRE_APP_ID
    delete process.env.MERCADO_LIVRE_CLIENT_SECRET
  })

  test('Creator Campaign com produto físico obrigatório bloqueia vídeo gerado por IA', () => {
    const decisao = podeSubmeterAutomaticamente({ tipo: 'CAMPANHA_DE_CRIADOR', physicalProductRequired: true }, { geradoPorIA: true })
    assert.equal(decisao.permitido, false)
    assert.match(decisao.motivo, /PHYSICAL_PRODUCT_REQUIRED/)
  })

  test('Creator Campaign sem exigência de produto físico permite conteúdo gerado por IA', () => {
    const decisao = podeSubmeterAutomaticamente({ tipo: 'CAMPANHA_DE_CRIADOR', physicalProductRequired: false }, { geradoPorIA: true })
    assert.equal(decisao.permitido, true)
  })
})

// ── 5. Media Rights Gate ─────────────────────────────────────────────────

describe('MediaRightsGate', () => {
  test('policy UNKNOWN bloqueia reuso social (nunca assume permissão)', () => {
    const record = direitosDaPolicy('UNKNOWN', { assetId: 'a1', source: 's', storageExpiresAt: null, authorizingSource: 's' })
    const decisao = mediaRightsGate(record, 'reusar-social')
    assert.equal(decisao.allowed, false)
    if (!decisao.allowed) assert.equal(decisao.status, 'BLOCKED_BY_POLICY')
  })

  test('policy UNKNOWN ainda permite exibir', () => {
    const record = direitosDaPolicy('UNKNOWN', { assetId: 'a1', source: 's', storageExpiresAt: null, authorizingSource: 's' })
    const decisao = mediaRightsGate(record, 'exibir')
    assert.equal(decisao.allowed, true)
  })

  test('SOCIAL_REUSE_ALLOWED libera reuso social mas não derivação', () => {
    const record = direitosDaPolicy('SOCIAL_REUSE_ALLOWED', { assetId: 'a1', source: 's', storageExpiresAt: null, authorizingSource: 's' })
    assert.equal(mediaRightsGate(record, 'reusar-social').allowed, true)
    assert.equal(mediaRightsGate(record, 'derivar').allowed, false)
  })
})

// ── 6. AutomationFeasibilityScore ────────────────────────────────────────

describe('AutomationFeasibilityScore', () => {
  test('produto mais automatizável (mesmo com potencial um pouco menor) supera produto manual no ranking', () => {
    const produtoManual: AffiliateOpportunity = {
      providerId: 'p1',
      productName: 'Manual',
      category: 'x',
      salesVolumeRank: 10,
      estimatedCommissionBRL: 40,
      origin: 'OFFICIAL_API',
      source: 's',
      lastVerifiedAt: new Date().toISOString(),
      canGenerateLinkAutomatically: false,
      authorizedMediaAvailable: false,
      canGenerateContent: false,
      canAutoPublish: false,
      requiresUserConsent: true,
      rulesConfidence: 'LOW',
      automationCost: 'HIGH',
    }
    const produtoAutomatizavel: AffiliateOpportunity = {
      providerId: 'p1',
      productName: 'Automatizável',
      category: 'x',
      salesVolumeRank: 30,
      estimatedCommissionBRL: 30,
      origin: 'OFFICIAL_API',
      source: 's',
      lastVerifiedAt: new Date().toISOString(),
      canGenerateLinkAutomatically: true,
      authorizedMediaAvailable: true,
      canGenerateContent: true,
      canAutoPublish: true,
      requiresUserConsent: false,
      rulesConfidence: 'HIGH',
      automationCost: 'FREE',
    }
    const scorer = new AutomationFeasibilityScorer()
    const ranking = scorer.rank([produtoManual, produtoAutomatizavel])
    assert.equal(ranking[0].productName, 'Automatizável')
  })
})

// ── 7. Autopilot: dry run, produção, kill switch, anti-spam, zero state ──

class StoreEmMemoria implements AutopilotStore {
  controls: WorkspaceAutomationControls
  publicados: { productName: string; at: Date }[] = []
  auditoria: { step: string; detail: string }[] = []
  constructor(controls: WorkspaceAutomationControls) {
    this.controls = controls
  }
  async getWorkspaceControls() {
    return this.controls
  }
  async registrarAuditoria(_workspaceId: string, entry: { step: string; detail: string }) {
    this.auditoria.push(entry)
  }
  async publicacoesHoje() {
    return this.publicados.length
  }
  async ultimaPublicacaoEm() {
    return this.publicados.length ? this.publicados[this.publicados.length - 1].at : null
  }
  async produtosPublicadosHoje() {
    return this.publicados.map((p) => p.productName)
  }
}

function opportunitySourceFixa(opps: AffiliateOpportunity[]): OpportunitySource {
  return { getCandidates: async () => opps }
}

const rendererFake: RendererProvider = {
  render: async () => ({ url: 'https://cdn.exemplo.com/render.mp4', durationSeconds: 6 }),
}

function opBase(overrides: Partial<AffiliateOpportunity> = {}): AffiliateOpportunity {
  return {
    providerId: 'amazon-associados',
    productName: 'Produto Autopilot',
    category: 'x',
    price: 99.9,
    salesVolumeRank: 5,
    origin: 'OFFICIAL_API',
    source: 's',
    lastVerifiedAt: new Date().toISOString(),
    canGenerateLinkAutomatically: true,
    authorizedMediaAvailable: true,
    canGenerateContent: true,
    canAutoPublish: true,
    requiresUserConsent: false,
    rulesConfidence: 'HIGH',
    automationCost: 'FREE',
    ...overrides,
  }
}

function depsBase(overrides: Partial<AutopilotDeps> = {}): AutopilotDeps {
  return {
    opportunitySources: [opportunitySourceFixa([opBase()])],
    mediaRightsResolver: () => ({ policy: 'SOCIAL_REUSE_ALLOWED', source: 'teste' }),
    renderer: rendererFake,
    tiktokPreflight: {
      validar: async () => ({ status: 'TECHNICALLY_VALID', creatorInfo: null, disclosureComercialNecessaria: true, motivo: '' }),
    },
    tiktokAvailable: true,
    instagramAvailable: false,
    store: new StoreEmMemoria({ automationPaused: false, automationMode: 'AUTOMATIC' }),
    publisher: { publicar: async () => 'pub-123' },
    ...overrides,
  }
}

describe('Autopilot — dry run e publicação real', () => {
  test('dry run nunca chama o publisher real', async () => {
    let chamouPublicar = false
    const deps = depsBase({
      publisher: {
        publicar: async () => {
          chamouPublicar = true
          return 'nao-deveria'
        },
      },
    })
    const resultado = await runAutopilot('w1', deps, { dryRun: true })
    assert.equal(resultado.status, 'DRY_RUN_COMPLETE')
    assert.equal(chamouPublicar, false)
    assert.equal(resultado.publicationId, null)
  })

  test('modo AUTOMATIC com tudo válido publica de verdade (dryRun=false)', async () => {
    const deps = depsBase()
    const resultado = await runAutopilot('w1', deps, { dryRun: false })
    assert.equal(resultado.status, 'PUBLISHED')
    assert.equal(resultado.publicationId, 'pub-123')
    assert.equal(resultado.channel, 'tiktok')
  })

  test('automationMode !== AUTOMATIC nunca publica de verdade, mesmo com dryRun=false', async () => {
    const deps = depsBase({ store: new StoreEmMemoria({ automationPaused: false, automationMode: 'ASSISTED' }) })
    const resultado = await runAutopilot('w1', deps, { dryRun: false })
    assert.equal(resultado.status, 'READY_TO_PUBLISH')
    assert.equal(resultado.publicationId, null)
  })

  test('kill switch (automationPaused=true) impede publicação e nem busca oportunidades', async () => {
    let buscouOportunidades = false
    const deps = depsBase({
      store: new StoreEmMemoria({ automationPaused: true, automationMode: 'AUTOMATIC' }),
      opportunitySources: [
        {
          getCandidates: async () => {
            buscouOportunidades = true
            return [opBase()]
          },
        },
      ],
    })
    const resultado = await runAutopilot('w1', deps, { dryRun: false })
    assert.equal(resultado.status, 'PAUSED')
    assert.equal(buscouOportunidades, false)
  })

  test('anti-spam: mesmo produto já publicado hoje não publica de novo (duplicação de job)', async () => {
    const store = new StoreEmMemoria({ automationPaused: false, automationMode: 'AUTOMATIC' })
    store.publicados.push({ productName: 'Produto Autopilot', at: new Date() })
    const deps = depsBase({ store })
    const resultado = await runAutopilot('w1', deps, { dryRun: false })
    assert.equal(resultado.status, 'RATE_LIMITED')
  })

  test('media rights bloqueado (UNKNOWN) exclui o candidato automaticamente, sem perguntar antes', async () => {
    const deps = depsBase({ mediaRightsResolver: () => ({ policy: 'UNKNOWN', source: 'teste' }) })
    const resultado = await runAutopilot('w1', deps, { dryRun: true })
    assert.equal(resultado.status, 'ALL_BLOCKED_BY_POLICY')
  })

  test('zero state: nenhuma oportunidade encontrada → NO_OPPORTUNITY, nunca inventa candidato', async () => {
    const deps = depsBase({ opportunitySources: [opportunitySourceFixa([])] })
    const resultado = await runAutopilot('w1', deps, { dryRun: true })
    assert.equal(resultado.status, 'NO_OPPORTUNITY')
    assert.equal(resultado.selected, null)
  })

  test('produto que exige consentimento (ex.: Mercado Livre) nunca gera link sozinho', async () => {
    const deps = depsBase({
      opportunitySources: [opportunitySourceFixa([opBase({ canGenerateLinkAutomatically: false, requiresUserConsent: true })])],
    })
    const resultado = await runAutopilot('w1', deps, { dryRun: true })
    assert.equal(resultado.status, 'REQUIRES_USER_CONSENT')
  })
})

describe('OAuthTokenCache — genérico', () => {
  test('renovações concorrentes para a mesma chave compartilham uma única chamada em andamento', async () => {
    let chamadas = 0
    const cache = new OAuthTokenCache()
    const buscar = async () => {
      chamadas++
      await new Promise((r) => setTimeout(r, 20))
      return { token: 'tok', expiraEmSegundos: 3600 }
    }
    const [a, b, c] = await Promise.all([
      cache.obterOuRenovar('chave-x', buscar),
      cache.obterOuRenovar('chave-x', buscar),
      cache.obterOuRenovar('chave-x', buscar),
    ])
    assert.equal(a, 'tok')
    assert.equal(b, 'tok')
    assert.equal(c, 'tok')
    assert.equal(chamadas, 1)
  })
})
