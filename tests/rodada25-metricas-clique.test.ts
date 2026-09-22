/**
 * P0.3 — métricas reais de clique e conversão histórica.
 *
 * A prova central: a conversão histórica passa a sair do log real de
 * cliques (`EventoLink`) e só de vendas que a autoridade aprova. Antes ela
 * dividia por `Conteudo.cliquesLink`, contador que produção nunca
 * incrementa — e portanto era `null` em 100% dos casos reais.
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { registrarResultado } from '../lib/vendas-comissoes'
import { promoverPorCorrecaoManual } from '../lib/promocao-operacao-real'
import {
  dividirOuNull,
  contarCliquesReais,
  listarVendasElegiveis,
  calcularMetricasDeClique,
  TIPO_DE_EVENTO_CLIQUE,
  LIMITACAO_DE_ATRIBUICAO,
} from '../lib/metricas-clique'
import { calcularConversaoHistoricaPorCategoria, extrairFeaturesDeConteudo } from '../lib/ml-feature-store'

const TEM_BANCO = !!process.env.DATABASE_URL
const RAIZ = join(__dirname, '..')
const lerFonte = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8')
const lerCodigo = (rel: string) =>
  lerFonte(rel)
    .split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')

const DIA = 24 * 60 * 60 * 1000

// ── Divisão sem número inventado ────────────────────────────────────────

describe('Divisão — ausência de base é null, nunca zero', () => {
  test('divide normalmente quando há base', () => {
    assert.equal(dividirOuNull(2, 10), 0.2)
    assert.equal(dividirOuNull(0, 10), 0, 'mediu e deu zero é diferente de não mediu')
  })

  test('denominador zero → null', () => {
    // Zero afirmaria que a conversão foi medida e deu zero. `null` diz que
    // não houve o que medir — e o modelo trata os dois de formas diferentes.
    assert.equal(dividirOuNull(5, 0), null)
    assert.equal(dividirOuNull(0, 0), null)
  })

  test('denominador negativo ou ilegível → null', () => {
    for (const d of [-1, NaN, Infinity]) assert.equal(dividirOuNull(1, d), null)
    for (const n of [NaN, Infinity]) assert.equal(dividirOuNull(n, 10), null)
  })

  test('nunca devolve NaN nem Infinity', () => {
    for (const [n, d] of [[1, 0], [0, 0], [NaN, 1], [1, NaN]]) {
      const r = dividirOuNull(n, d)
      assert.ok(r === null || Number.isFinite(r))
    }
  })
})

// ── Fonte de verdade e limitação declarada ──────────────────────────────

describe('Fonte de verdade — EventoLink, não contador', () => {
  test('a conversão histórica NÃO lê mais cliquesLink', () => {
    const codigo = lerCodigo('lib/ml-feature-store.ts')
    const trecho = codigo.slice(
      codigo.indexOf('export async function calcularConversaoHistoricaPorCategoria'),
      codigo.indexOf('export async function extrairFeaturesDeConteudo')
    )
    assert.ok(!/cliquesLink/.test(trecho), 'o denominador não pode vir de um contador que ninguém incrementa')
    assert.match(trecho, /calcularMetricasDeClique/)
  })

  test('a contagem consulta EventoLink com tipo clique', () => {
    const codigo = lerCodigo('lib/metricas-clique.ts')
    assert.match(codigo, /prisma\.eventoLink\.count/)
    assert.match(codigo, /tipo: TIPO_DE_EVENTO_CLIQUE/)
    assert.equal(TIPO_DE_EVENTO_CLIQUE, 'clique')
  })

  test('não existe contador incremental novo — nada a atualizar à mão', () => {
    const codigo = lerCodigo('lib/metricas-clique.ts')
    assert.ok(!/increment|decrement|\.update\(|\.create\(/.test(codigo), 'métrica é derivada, nunca mantida')
  })

  test('a limitação de atribuição por conteúdo está declarada', () => {
    assert.equal(LIMITACAO_DE_ATRIBUICAO.nivelSustentadoHoje, 'PRODUTO_CATEGORIA')
    assert.match(LIMITACAO_DE_ATRIBUICAO.explicacao, /LinkDinamico aponta para produto/)
  })

  test('cliquesLink está marcado como legado no schema e nos leitores', () => {
    assert.match(lerFonte('prisma/schema.prisma'), /DEPRECATED_LEGACY \(P0\.3\)[\s\S]{0,400}cliquesLink/)
    for (const arq of ['lib/ml-financial-metrics.ts', 'lib/ml-creative-learning.ts', 'lib/learning-engine.ts']) {
      assert.match(lerFonte(arq), /DEPRECATED_LEGACY \(P0\.3\)/, `${arq} precisa declarar o legado`)
    }
  })

  test('a elegibilidade continua sendo decidida pela autoridade única', () => {
    const codigo = lerCodigo('lib/metricas-clique.ts')
    assert.match(codigo, /avaliarVendaParaOperacaoReal\(janela\.workspaceId, venda\.id\)/)
    // O filtro na consulta é pré-filtro, não segunda versão da regra.
    assert.ok(!/status: 'CONFIRMED'/.test(codigo))
  })
})

// ── Banco ───────────────────────────────────────────────────────────────

let workspaceA = ''
let workspaceB = ''
let userA = ''
let userB = ''
let produtoCasa = ''
let produtoOutro = ''
let produtoB = ''
let linkCasa = ''
let linkOutro = ''
let linkB = ''
const criados: string[] = []

const CORTE = new Date(Date.now() - 10 * DIA)
const MOTIVO = 'Comissão recebida e conferida no extrato bancário da empresa.'

async function limpar(ws: string) {
  await prisma.mLFeatureSnapshot.deleteMany({ where: { workspaceId: ws } })
  await prisma.commission.deleteMany({ where: { workspaceId: ws } })
  await prisma.sale.deleteMany({ where: { workspaceId: ws } })
  await prisma.eventoLink.deleteMany({ where: { workspaceId: ws } })
  await prisma.auditLog.deleteMany({ where: { workspaceId: ws } })
}

async function clicar(ws: string, linkId: string, quando: Date, tipo = 'clique') {
  await prisma.eventoLink.create({ data: { workspaceId: ws, linkId, tipo, createdAt: quando } })
}

/** Cria a venda e, se pedido, promove pelo caminho legítimo. */
async function venda(opcoes: {
  ws?: string
  produtoId?: string
  quando: Date
  origem?: string
  promover?: boolean
  contentId?: string | null
  recebido?: number
}) {
  const ws = opcoes.ws ?? workspaceA
  const uid = ws === workspaceA ? userA : userB
  const { sale, commission } = await registrarResultado({
    workspaceId: ws,
    actorUserId: uid,
    dataOrigin: 'USER_REPORTED',
    productId: opcoes.produtoId ?? produtoCasa,
    contentId: opcoes.contentId ?? null,
    date: opcoes.quando,
    amount: 100,
    status: 'CONFIRMED',
    expectedCommission: 10,
    idempotencyKey: `p03-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  })
  await prisma.commission.update({
    where: { id: commission!.id },
    data: { status: 'RECEIVED', confirmedAmount: 9, receivedAmount: opcoes.recebido ?? 8 },
  })
  if (opcoes.origem && opcoes.origem !== 'USER_REPORTED') {
    await prisma.sale.update({ where: { id: sale.id }, data: { dataOrigin: opcoes.origem } })
  }
  if (opcoes.promover) {
    const r = await promoverPorCorrecaoManual({
      workspaceId: ws,
      saleId: sale.id,
      responsavelUserId: uid,
      motivo: MOTIVO,
      referencia: `extrato-${sale.id}`,
    })
    assert.equal(r.promovido, true, r.explicacao)
  }
  return sale.id
}

describe(
  'P0.3 no banco — clique real e conversão auditável',
  { skip: !TEM_BANCO ? 'DATABASE_URL ausente — exige Postgres' : false },
  () => {
    before(async () => {
      const marca = Date.now()
      for (const nome of ['A', 'B']) {
        const ws = await prisma.workspace.create({
          data: { name: `P03-${nome}`, ownerId: `teste-p03-${nome}-${marca}` },
          select: { id: true },
        })
        criados.push(ws.id)
      }
      ;[workspaceA, workspaceB] = criados

      const criarUser = async (ws: string, s: string) =>
        (
          await prisma.user.create({
            data: { email: `p03-${s}-${marca}@teste.local`, name: `U${s}`, password: 'x', workspaceId: ws },
            select: { id: true },
          })
        ).id
      userA = await criarUser(workspaceA, 'a')
      userB = await criarUser(workspaceB, 'b')

      const criarProduto = async (ws: string, uid: string, categoria: string) =>
        (
          await prisma.produto.create({
            data: {
              workspaceId: ws,
              userId: uid,
              nome: `Produto ${categoria}`,
              categoria,
              tipoVenda: 'Afiliado',
              origemConteudo: 'Proprio',
            },
            select: { id: true },
          })
        ).id
      produtoCasa = await criarProduto(workspaceA, userA, 'casa')
      produtoOutro = await criarProduto(workspaceA, userA, 'eletronicos')
      produtoB = await criarProduto(workspaceB, userB, 'casa')

      const criarLink = async (ws: string, uid: string, produtoId: string, slug: string) =>
        (
          await prisma.linkDinamico.create({
            data: {
              workspaceId: ws,
              userId: uid,
              produtoId,
              slug,
              plataforma: 'tiktok',
              urlDestino: 'https://exemplo.invalido/p',
            },
            select: { id: true },
          })
        ).id
      linkCasa = await criarLink(workspaceA, userA, produtoCasa, `p03-casa-${marca}`)
      linkOutro = await criarLink(workspaceA, userA, produtoOutro, `p03-eletr-${marca}`)
      linkB = await criarLink(workspaceB, userB, produtoB, `p03-b-${marca}`)
    })

    after(async () => {
      for (const ws of criados) await limpar(ws)
      await prisma.linkDinamico.deleteMany({ where: { workspaceId: { in: criados } } })
      await prisma.conteudo.deleteMany({ where: { workspaceId: { in: criados } } })
      await prisma.produto.deleteMany({ where: { workspaceId: { in: criados } } })
      await prisma.user.deleteMany({ where: { workspaceId: { in: criados } } })
      await prisma.workspace.deleteMany({ where: { id: { in: criados } } })
      await prisma.$disconnect()
    })

    const janela = (over: Record<string, unknown> = {}) => ({
      workspaceId: workspaceA,
      categoria: 'casa',
      antesDe: CORTE,
      ...over,
    })

    // ── Cliques ──────────────────────────────────────────────────────

    test('clique real é contado', async () => {
      await limpar(workspaceA)
      await clicar(workspaceA, linkCasa, new Date(CORTE.getTime() - DIA))
      await clicar(workspaceA, linkCasa, new Date(CORTE.getTime() - 2 * DIA))
      assert.equal(await contarCliquesReais(janela()), 2)
    })

    test('evento que NÃO é clique não é contado', async () => {
      await limpar(workspaceA)
      await clicar(workspaceA, linkCasa, new Date(CORTE.getTime() - DIA), 'visualizacao')
      await clicar(workspaceA, linkCasa, new Date(CORTE.getTime() - DIA), 'compartilhamento')
      assert.equal(await contarCliquesReais(janela()), 0)
    })

    test('clique de OUTRO workspace não é contado', async () => {
      await limpar(workspaceA)
      await limpar(workspaceB)
      await clicar(workspaceB, linkB, new Date(CORTE.getTime() - DIA))
      assert.equal(await contarCliquesReais(janela()), 0)
      assert.equal(await contarCliquesReais(janela({ workspaceId: workspaceB })), 1)
    })

    test('clique POSTERIOR ao corte não é contado', async () => {
      await limpar(workspaceA)
      await clicar(workspaceA, linkCasa, new Date(CORTE.getTime() + DIA))
      await clicar(workspaceA, linkCasa, CORTE) // exatamente no corte: fora
      assert.equal(await contarCliquesReais(janela()), 0)
    })

    test('clique de outra categoria não entra na conta da categoria pedida', async () => {
      await limpar(workspaceA)
      await clicar(workspaceA, linkOutro, new Date(CORTE.getTime() - DIA))
      assert.equal(await contarCliquesReais(janela()), 0)
      assert.equal(await contarCliquesReais(janela({ categoria: 'eletronicos' })), 1)
      // Sem categoria, conta os dois níveis.
      assert.equal(await contarCliquesReais(janela({ categoria: undefined })), 1)
    })

    // ── Vendas ───────────────────────────────────────────────────────

    test('venda REAL_OPERATION elegível é contada', async () => {
      await limpar(workspaceA)
      await venda({ quando: new Date(CORTE.getTime() - DIA), promover: true })
      const elegiveis = await listarVendasElegiveis(janela())
      assert.equal(elegiveis.length, 1)
      assert.equal(elegiveis[0].receitaRealizada, 8)
    })

    test('USER_REPORTED não é contada em métrica de produção', async () => {
      await limpar(workspaceA)
      await venda({ quando: new Date(CORTE.getTime() - DIA) }) // sem promover
      assert.equal((await listarVendasElegiveis(janela())).length, 0)
    })

    for (const origem of ['TEST_FIXTURE', 'DEMO', 'SEED', 'SYNTHETIC_TEST']) {
      test(`${origem} não é contada`, async () => {
        await limpar(workspaceA)
        await venda({ quando: new Date(CORTE.getTime() - DIA), origem })
        assert.equal((await listarVendasElegiveis(janela())).length, 0)
      })
    }

    test('venda POSTERIOR ao corte não é contada', async () => {
      await limpar(workspaceA)
      await venda({ quando: new Date(CORTE.getTime() + DIA), promover: true })
      assert.equal((await listarVendasElegiveis(janela())).length, 0)
    })

    test('venda de outra categoria não entra', async () => {
      await limpar(workspaceA)
      await venda({ quando: new Date(CORTE.getTime() - DIA), produtoId: produtoOutro, promover: true })
      assert.equal((await listarVendasElegiveis(janela())).length, 0)
      assert.equal((await listarVendasElegiveis(janela({ categoria: 'eletronicos' }))).length, 1)
    })

    test('venda de outro workspace não entra', async () => {
      await limpar(workspaceA)
      await limpar(workspaceB)
      await venda({ ws: workspaceB, produtoId: produtoB, quando: new Date(CORTE.getTime() - DIA), promover: false })
      assert.equal((await listarVendasElegiveis(janela())).length, 0)
    })

    // ── Métricas combinadas ──────────────────────────────────────────

    test('zero cliques → taxa null, mesmo havendo venda', async () => {
      await limpar(workspaceA)
      await venda({ quando: new Date(CORTE.getTime() - DIA), promover: true })
      const m = await calcularMetricasDeClique(janela())
      assert.equal(m.cliques, 0)
      assert.equal(m.vendasElegiveis, 1)
      assert.equal(m.taxaConversao, null, 'sem base não se inventa taxa')
      assert.equal(m.receitaPorClique, null)
    })

    test('cliques sem vendas → taxa 0 (mediu e deu zero)', async () => {
      await limpar(workspaceA)
      for (let i = 1; i <= 4; i++) await clicar(workspaceA, linkCasa, new Date(CORTE.getTime() - i * DIA))
      const m = await calcularMetricasDeClique(janela())
      assert.equal(m.cliques, 4)
      assert.equal(m.vendasElegiveis, 0)
      assert.equal(m.taxaConversao, 0)
      assert.equal(m.receitaRealizada, 0)
      assert.equal(m.receitaPorClique, 0)
    })

    test('as quatro métricas ficam separadas', async () => {
      await limpar(workspaceA)
      for (let i = 1; i <= 10; i++) await clicar(workspaceA, linkCasa, new Date(CORTE.getTime() - i * DIA))
      await venda({ quando: new Date(CORTE.getTime() - DIA), promover: true, recebido: 25 })
      const m = await calcularMetricasDeClique(janela())
      assert.equal(m.cliques, 10)
      assert.equal(m.vendasElegiveis, 1)
      assert.equal(m.taxaConversao, 0.1)
      assert.equal(m.receitaRealizada, 25)
      assert.equal(m.receitaPorClique, 2.5)
    })

    test('USER_REPORTED não infla a taxa', async () => {
      await limpar(workspaceA)
      for (let i = 1; i <= 10; i++) await clicar(workspaceA, linkCasa, new Date(CORTE.getTime() - i * DIA))
      await venda({ quando: new Date(CORTE.getTime() - DIA), promover: true })
      await venda({ quando: new Date(CORTE.getTime() - DIA) }) // relato sem prova
      const m = await calcularMetricasDeClique(janela())
      assert.equal(m.vendasElegiveis, 1)
      assert.equal(m.taxaConversao, 0.1)
    })

    // ── Conversão histórica (a feature do ML) ────────────────────────

    test('a conversão histórica agora responde de verdade', async () => {
      // Antes do P0.3 esta chamada devolvia null SEMPRE.
      await limpar(workspaceA)
      for (let i = 1; i <= 5; i++) await clicar(workspaceA, linkCasa, new Date(CORTE.getTime() - i * DIA))
      await venda({ quando: new Date(CORTE.getTime() - DIA), promover: true })
      assert.equal(await calcularConversaoHistoricaPorCategoria(workspaceA, 'casa', CORTE), 0.2)
    })

    test('o histórico do PRÓPRIO conteúdo é excluído', async () => {
      await limpar(workspaceA)
      const conteudo = await prisma.conteudo.create({
        data: {
          workspaceId: workspaceA,
          userId: userA,
          produtoId: produtoCasa,
          roteiro: 'x',
          redeSocial: 'tiktok',
          dataPublicacao: new Date(CORTE.getTime() - 5 * DIA),
        },
        select: { id: true },
      })
      for (let i = 1; i <= 4; i++) await clicar(workspaceA, linkCasa, new Date(CORTE.getTime() - i * DIA))
      // Uma venda de OUTRO conteúdo e uma do próprio.
      await venda({ quando: new Date(CORTE.getTime() - DIA), promover: true })
      await venda({ quando: new Date(CORTE.getTime() - DIA), promover: true, contentId: conteudo.id })

      const semExcluir = await calcularConversaoHistoricaPorCategoria(workspaceA, 'casa', CORTE)
      const excluindo = await calcularConversaoHistoricaPorCategoria(workspaceA, 'casa', CORTE, conteudo.id)
      assert.equal(semExcluir, 0.5, '2 vendas / 4 cliques')
      assert.equal(excluindo, 0.25, 'a venda do próprio conteúdo não pode entrar na sua feature')
    })

    test('sem clique nenhum, a feature continua null — nunca 0 inventado', async () => {
      await limpar(workspaceA)
      assert.equal(await calcularConversaoHistoricaPorCategoria(workspaceA, 'casa', CORTE), null)
    })

    test('o feature store continua funcionando, sem regressão', async () => {
      await limpar(workspaceA)
      for (let i = 1; i <= 5; i++) await clicar(workspaceA, linkCasa, new Date(Date.now() - (20 + i) * DIA))
      await venda({ quando: new Date(Date.now() - 20 * DIA), promover: true })

      const conteudo = await prisma.conteudo.create({
        data: {
          workspaceId: workspaceA,
          userId: userA,
          produtoId: produtoCasa,
          roteiro: 'Você já viu esse produto? Resolve tudo.',
          chamadaAcao: 'Link na bio',
          duracao: 30,
          redeSocial: 'tiktok',
          dataPublicacao: new Date(Date.now() - 5 * DIA),
        },
        select: { id: true },
      })

      const extraido = await extrairFeaturesDeConteudo(workspaceA, conteudo.id)
      assert.ok(extraido)
      assert.equal(extraido!.features.channel, 'tiktok')
      assert.equal(extraido!.features.product_category, 'casa')
      // A feature que antes era sempre null agora tem valor real.
      assert.equal(extraido!.features.historical_conversion_rate, 0.2)
    })

    test('SEM DATA LEAKAGE: nada posterior ao conteúdo entra na feature dele', async () => {
      await limpar(workspaceA)
      const publicadoEm = new Date(Date.now() - 10 * DIA)
      // Antes da publicação: 4 cliques, 1 venda elegível.
      for (let i = 1; i <= 4; i++) await clicar(workspaceA, linkCasa, new Date(publicadoEm.getTime() - i * DIA))
      await venda({ quando: new Date(publicadoEm.getTime() - DIA), promover: true })
      // DEPOIS da publicação: muito mais movimento, que não pode vazar.
      for (let i = 1; i <= 50; i++) await clicar(workspaceA, linkCasa, new Date(publicadoEm.getTime() + i * 1000))
      await venda({ quando: new Date(publicadoEm.getTime() + DIA), promover: true })

      const conteudo = await prisma.conteudo.create({
        data: {
          workspaceId: workspaceA,
          userId: userA,
          produtoId: produtoCasa,
          roteiro: 'x',
          redeSocial: 'tiktok',
          dataPublicacao: publicadoEm,
        },
        select: { id: true },
      })

      const extraido = await extrairFeaturesDeConteudo(workspaceA, conteudo.id)
      // 1 venda / 4 cliques — só o que existia ANTES da publicação.
      assert.equal(extraido!.features.historical_conversion_rate, 0.25)
    })

    test('nenhum modelo foi treinado, ativado ou promovido', async () => {
      assert.equal(await prisma.mLModel.count({ where: { workspaceId: { in: criados } } }), 0)
      assert.equal(await prisma.mLTrainingRun.count({ where: { workspaceId: { in: criados } } }), 0)
    })
  }
)
