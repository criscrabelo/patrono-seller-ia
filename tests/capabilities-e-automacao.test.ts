/**
 * Teste de regressão — Provider/Channel Capability, automação e
 * Learning Engine (Rodada 4).
 *
 *   DATABASE_URL=... npm run test:capabilities
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'
import { AFFILIATE_PROVIDER_CAPABILITIES, capacidadeDoProvider, capacidadeOuDesconhecida } from '../lib/affiliate-provider-capabilities'
import { AFFILIATE_PROVIDER_REGISTRY } from '../lib/affiliate-providers'
import { CHANNEL_CAPABILITIES, capacidadeDoCanal } from '../lib/channel-registry'
import { STATUS_PIPELINE, AUTOMATION_MODES, HUMAN_ACTION_REASONS } from '../lib/automation'
import { criarUsuarioComWorkspace } from '../lib/workspace'
import { limparWorkspaceDeTeste } from './_limpar-workspace-de-teste'

// P2.14.8: o teste apaga, ao final, a conta que criou.
const PREFIXO = 'Conta de Teste — '
import { resumoPorConteudo, resumoPorCanal } from '../lib/learning-engine'

const prisma = new PrismaClient()

describe('AffiliateProviderCapability', () => {
  test('todo provider do registry tem uma capability correspondente', () => {
    for (const provider of AFFILIATE_PROVIDER_REGISTRY) {
      const cap = capacidadeDoProvider(provider.id)
      assert.ok(cap, `provider "${provider.id}" não tem capability cadastrada`)
    }
  })

  test('nenhuma capability permite scraping', () => {
    for (const cap of AFFILIATE_PROVIDER_CAPABILITIES) {
      assert.equal(cap.scrapingAllowed, false, `${cap.providerId} não pode permitir scraping`)
    }
  })

  test('toda capability tem fonte, data de verificação e nível de confiança', () => {
    for (const cap of AFFILIATE_PROVIDER_CAPABILITIES) {
      assert.ok(cap.sourceType, `${cap.providerId} sem sourceType`)
      assert.ok(cap.lastVerifiedAt, `${cap.providerId} sem lastVerifiedAt`)
      assert.ok(cap.confidence, `${cap.providerId} sem confidence`)
      assert.ok(cap.country, `${cap.providerId} sem country`)
    }
  })

  test('Shopee está marcada com regra crítica contra scraping na observação', () => {
    const shopee = capacidadeDoProvider('shopee')
    assert.ok(shopee)
    assert.equal(shopee.scrapingAllowed, false)
    assert.ok(shopee.observacao?.toUpperCase().includes('REGRA CRÍTICA'))
  })

  test('provider desconhecido nunca é tratado como disponível', () => {
    const desconhecido = capacidadeOuDesconhecida('provider-que-nao-existe-123')
    assert.equal(desconhecido.status, 'NOT_VERIFIED')
    assert.equal(desconhecido.officialApi, false)
    assert.equal(desconhecido.automatedPublishing, false)
    assert.equal(desconhecido.scrapingAllowed, false)
  })

  test('nenhum provider está marcado como conectado/automatizado sem verificação', () => {
    for (const cap of AFFILIATE_PROVIDER_CAPABILITIES) {
      if (cap.automatedPublishing || cap.automatedDiscovery) {
        assert.notEqual(cap.sourceType, 'NOT_VERIFIED', `${cap.providerId} automatiza algo sem fonte verificada`)
      }
    }
  })
})

describe('ChannelCapability', () => {
  test('TikTok exige consentimento explícito do usuário', () => {
    const tiktok = capacidadeDoCanal('tiktok')
    assert.ok(tiktok)
    assert.equal(tiktok.requiresExplicitConsent, true)
  })

  test('TikTok não hardcoda duração — depende da conta (null, não um número fixo)', () => {
    const tiktok = capacidadeDoCanal('tiktok')
    assert.equal(tiktok?.durationRulesSeconds, null)
  })

  test('Instagram já tem publicação automática real implementada', () => {
    const instagram = capacidadeDoCanal('instagram')
    assert.equal(instagram?.autoPublish, true)
  })

  test('todo canal tem lastVerifiedAt e sourceType', () => {
    for (const c of CHANNEL_CAPABILITIES) {
      assert.ok(c.lastVerifiedAt)
      assert.ok(c.sourceType)
    }
  })
})

describe('Automação — constantes', () => {
  test('pipeline de status inclui REQUIRES_USER_CONSENT e BLOCKED_BY_POLICY', () => {
    assert.ok(STATUS_PIPELINE.includes('REQUIRES_USER_CONSENT'))
    assert.ok(STATUS_PIPELINE.includes('BLOCKED_BY_POLICY'))
  })

  test('modos de automação incluem MANUAL, ASSISTED e AUTOMATIC', () => {
    assert.deepEqual([...AUTOMATION_MODES].sort(), ['ASSISTED', 'AUTOMATIC', 'MANUAL'])
  })

  test('motivos de HumanActionRequired cobrem consentimento e token expirado', () => {
    assert.ok(HUMAN_ACTION_REASONS.includes('TIKTOK_CONSENT'))
    assert.ok(HUMAN_ACTION_REASONS.includes('TOKEN_EXPIRED'))
  })
})

describe('LearningEngine — métricas determinísticas reais', () => {
  let workspaceId: string
  let userId: string

  before(async () => {
    const { workspace, user } = await criarUsuarioComWorkspace(prisma, {
      email: `learning-${Date.now()}@teste.local`,
      password: 'hash-fake-nao-usado-no-login',
      name: 'Conta de Teste — Learning Engine',
    })
    workspaceId = workspace.id
    userId = user.id
  })

  after(async () => {
    await limparWorkspaceDeTeste(prisma, workspaceId, PREFIXO)
    await prisma.$disconnect()
  })

  test('workspace vazio: resumo por conteúdo e por canal vêm vazios, não com dado inventado', async () => {
    const porConteudo = await resumoPorConteudo(workspaceId)
    const porCanal = await resumoPorCanal(workspaceId)
    assert.deepEqual(porConteudo, [])
    assert.deepEqual(porCanal, [])
  })

  test('uma venda ligada a um conteúdo aparece no resumo por conteúdo e por canal', async () => {
    const produto = await prisma.produto.create({
      data: { workspaceId, userId, nome: 'Produto Learning', categoria: 'Teste', origemConteudo: 'manual', tipoVenda: 'afiliado' },
    })
    // `cliquesLink: 10` de propósito: o contador legado continua na coluna,
    // e o teste prova que ele NÃO vaza mais para nenhuma métrica (P0.3.1).
    const conteudo = await prisma.conteudo.create({
      data: { workspaceId, userId, produtoId: produto.id, redeSocial: 'instagram', cliquesLink: 10 },
    })
    const venda = await prisma.sale.create({
      data: { workspaceId, productId: produto.id, contentId: conteudo.id, amount: 100, status: 'CONFIRMED' },
    })
    await prisma.commission.create({
      data: { workspaceId, saleId: venda.id, productId: produto.id, expectedAmount: 10, status: 'EXPECTED' },
    })

    const porConteudo = await resumoPorConteudo(workspaceId)
    const linhaConteudo = porConteudo.find((c) => c.contentId === conteudo.id)
    assert.ok(linhaConteudo)
    assert.equal(linhaConteudo.vendasConfirmadas, 1)
    assert.equal(linhaConteudo.comissaoReconhecida, 10)
    // AJUSTADO no P0.3.1: clique por conteúdo não existe — não há atribuição
    // EventoLink → Conteudo. Antes isto lia o contador legado e devolvia 10.
    assert.equal(linhaConteudo.cliques, null)
    assert.equal(linhaConteudo.cliquesIndisponiveisPorque, 'SEM_ATRIBUICAO_POR_CONTEUDO')
    assert.equal(linhaConteudo.granularidade, 'CONTEUDO')

    const porCanal = await resumoPorCanal(workspaceId)
    const linhaCanal = porCanal.find((c) => c.canal === 'instagram')
    assert.ok(linhaCanal)
    assert.equal(linhaCanal.vendasConfirmadas, 1)
    // A taxa por canal também caiu: `EventoLink.plataforma` é do LINK, não o
    // canal de publicação do conteúdo — dividir um pelo outro seria falso.
    assert.equal(linhaCanal.taxaConversao, null)
    assert.equal(linhaCanal.taxaIndisponivelPorque, 'SEM_ATRIBUICAO_POR_CANAL')
  })
})
