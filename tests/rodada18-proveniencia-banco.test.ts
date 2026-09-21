/**
 * P0.2 Blocos 1 e 2 — o que só o banco consegue provar.
 *
 * A REGRA de atribuição já é testada sem Postgres em
 * `rodada18-proveniencia-e-atribuicao.test.ts`. Aqui provamos a outra metade:
 * que a consulta busca os cliques certos, que a coluna guarda o que foi
 * declarado, e que `UNVERIFIED` é mesmo o default de quem insere direto.
 *
 * NUNCA rodar contra produção: cria e apaga vendas, comissões, cliques e
 * links. Use o banco de teste.
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../lib/prisma'
import { registrarResultado } from '../lib/vendas-comissoes'

const TEM_BANCO = !!process.env.DATABASE_URL

let workspaceA = ''
let workspaceB = ''
let userId = ''
let produtoA = ''
let linkA1 = ''
let linkA2 = ''
let linkB1 = ''
const criados: string[] = []

async function limpar(ws: string) {
  await prisma.commission.deleteMany({ where: { workspaceId: ws } })
  await prisma.sale.deleteMany({ where: { workspaceId: ws } })
  await prisma.eventoLink.deleteMany({ where: { workspaceId: ws } })
}

async function clicar(ws: string, linkId: string, quando: Date) {
  return prisma.eventoLink.create({
    data: { workspaceId: ws, linkId, tipo: 'clique', createdAt: quando },
    select: { id: true },
  })
}

describe(
  'P0.2 no banco — proveniência e atribuição',
  { skip: !TEM_BANCO ? 'DATABASE_URL ausente — este arquivo exige Postgres' : false },
  () => {
    before(async () => {
      const marca = Date.now()
      const criarWorkspace = async (nome: string) => {
        const ws = await prisma.workspace.create({
          data: { name: nome, ownerId: `p02-${nome}-${marca}` },
          select: { id: true },
        })
        criados.push(ws.id)
        return ws.id
      }
      workspaceA = await criarWorkspace('A')
      workspaceB = await criarWorkspace('B')

      const user = await prisma.user.create({
        data: {
          email: `p02-${marca}@teste.local`,
          name: 'Teste P0.2',
          password: 'nao-usada-neste-teste',
          workspaceId: workspaceA,
        },
        select: { id: true },
      })
      userId = user.id

      const criarProduto = async (ws: string) =>
        (
          await prisma.produto.create({
            data: {
              workspaceId: ws,
              userId,
              nome: 'Produto P0.2',
              categoria: 'casa',
              tipoVenda: 'Afiliado',
              origemConteudo: 'Proprio',
            },
            select: { id: true },
          })
        ).id
      produtoA = await criarProduto(workspaceA)
      const produtoB = await criarProduto(workspaceB)

      const criarLink = async (ws: string, produtoId: string, slug: string) =>
        (
          await prisma.linkDinamico.create({
            data: {
              workspaceId: ws,
              userId,
              produtoId,
              slug,
              plataforma: 'tiktok',
              urlDestino: 'https://exemplo.invalido/produto',
            },
            select: { id: true },
          })
        ).id
      linkA1 = await criarLink(workspaceA, produtoA, `p02-a1-${marca}`)
      linkA2 = await criarLink(workspaceA, produtoA, `p02-a2-${marca}`)
      linkB1 = await criarLink(workspaceB, produtoB, `p02-b1-${marca}`)
    })

    after(async () => {
      // A ordem importa e nao pode ser por workspace: a mesma usuaria e dona
      // de links nos DOIS workspaces de teste, entao apagar workspace por
      // workspace esbarra em LinkDinamico_userId_fkey. Primeiro somem TODAS
      // as linhas dependentes dos dois, depois as usuarias, depois os
      // workspaces.
      for (const ws of criados) await limpar(ws)
      await prisma.linkDinamico.deleteMany({ where: { workspaceId: { in: criados } } })
      await prisma.produto.deleteMany({ where: { workspaceId: { in: criados } } })
      await prisma.auditLog.deleteMany({ where: { workspaceId: { in: criados } } })
      await prisma.user.deleteMany({ where: { workspaceId: { in: criados } } })
      await prisma.workspace.deleteMany({ where: { id: { in: criados } } })
      await prisma.$disconnect()
    })

    // ── Bloco 1: proveniência ───────────────────────────────────────────

    test('as quatro origens são gravadas exatamente como declaradas', async () => {
      await limpar(workspaceA)
      for (const origem of ['REAL_OPERATION', 'SEED', 'TEST_FIXTURE', 'DEMO'] as const) {
        const { sale } = await registrarResultado({
          workspaceId: workspaceA,
          actorUserId: userId,
          dataOrigin: origem,
          productId: produtoA,
          amount: 10,
          status: 'CONFIRMED',
          idempotencyKey: `origem-${origem}-${Date.now()}`,
        })
        assert.equal(sale.dataOrigin, origem)
      }
      const reais = await prisma.sale.count({ where: { workspaceId: workspaceA, dataOrigin: 'REAL_OPERATION' } })
      assert.equal(reais, 1, 'só a venda declarada como real pode contar como real')
    })

    test('quem insere Sale direto, sem declarar, cai em UNVERIFIED', async () => {
      await limpar(workspaceA)
      const sale = await prisma.sale.create({
        data: { workspaceId: workspaceA, productId: produtoA, amount: 5, status: 'CONFIRMED' },
        select: { dataOrigin: true },
      })
      assert.equal(sale.dataOrigin, 'UNVERIFIED', 'o default do banco nunca pode ser REAL_OPERATION')
    })

    test('a proveniência aparece na auditoria da venda', async () => {
      await limpar(workspaceA)
      const { sale } = await registrarResultado({
        workspaceId: workspaceA,
        actorUserId: userId,
        dataOrigin: 'REAL_OPERATION',
        productId: produtoA,
        amount: 99,
        status: 'CONFIRMED',
        idempotencyKey: `audit-${Date.now()}`,
      })
      const log = await prisma.auditLog.findFirst({
        where: { workspaceId: workspaceA, entityType: 'Sale', entityId: sale.id, action: 'venda.criada' },
        select: { metadata: true },
      })
      const meta = log?.metadata as Record<string, unknown> | null
      assert.equal(meta?.dataOrigin, 'REAL_OPERATION')
      assert.ok(typeof meta?.attributionMethod === 'string')
    })

    // ── Bloco 2: atribuição contra dados reais ──────────────────────────

    test('venda SEM clique: clickEventId null, método explícito', async () => {
      await limpar(workspaceA)
      const { sale } = await registrarResultado({
        workspaceId: workspaceA,
        actorUserId: userId,
        dataOrigin: 'TEST_FIXTURE',
        productId: produtoA,
        linkId: linkA1,
        amount: 10,
        status: 'CONFIRMED',
        idempotencyKey: `sem-clique-${Date.now()}`,
      })
      assert.equal(sale.clickEventId, null)
      assert.equal(sale.attributionMethod, 'SEM_CLIQUE_ELEGIVEL')
    })

    test('venda sem link: método SEM_LINK_NA_VENDA', async () => {
      await limpar(workspaceA)
      await clicar(workspaceA, linkA1, new Date(Date.now() - 60_000))
      const { sale } = await registrarResultado({
        workspaceId: workspaceA,
        actorUserId: userId,
        dataOrigin: 'TEST_FIXTURE',
        productId: produtoA,
        amount: 10,
        status: 'CONFIRMED',
        idempotencyKey: `sem-link-${Date.now()}`,
      })
      assert.equal(sale.clickEventId, null)
      assert.equal(sale.attributionMethod, 'SEM_LINK_NA_VENDA')
    })

    test('venda COM clique correto: atribui aquele clique', async () => {
      await limpar(workspaceA)
      const c = await clicar(workspaceA, linkA1, new Date(Date.now() - 60_000))
      const { sale } = await registrarResultado({
        workspaceId: workspaceA,
        actorUserId: userId,
        dataOrigin: 'TEST_FIXTURE',
        productId: produtoA,
        linkId: linkA1,
        amount: 10,
        status: 'CONFIRMED',
        idempotencyKey: `com-clique-${Date.now()}`,
      })
      assert.equal(sale.clickEventId, c.id)
      assert.equal(sale.attributionMethod, 'ULTIMO_CLIQUE_MESMO_LINK_ANTES_DA_VENDA')
    })

    test('DOIS cliques no mesmo link: vence o mais recente', async () => {
      await limpar(workspaceA)
      await clicar(workspaceA, linkA1, new Date(Date.now() - 600_000))
      const recente = await clicar(workspaceA, linkA1, new Date(Date.now() - 60_000))
      const { sale } = await registrarResultado({
        workspaceId: workspaceA,
        actorUserId: userId,
        dataOrigin: 'TEST_FIXTURE',
        productId: produtoA,
        linkId: linkA1,
        amount: 10,
        status: 'CONFIRMED',
        idempotencyKey: `dois-cliques-${Date.now()}`,
      })
      assert.equal(sale.clickEventId, recente.id)
    })

    test('clique POSTERIOR à venda nunca é atribuído', async () => {
      await limpar(workspaceA)
      const dataDaVenda = new Date(Date.now() - 600_000)
      await clicar(workspaceA, linkA1, new Date(dataDaVenda.getTime() + 60_000))
      const { sale } = await registrarResultado({
        workspaceId: workspaceA,
        actorUserId: userId,
        dataOrigin: 'TEST_FIXTURE',
        productId: produtoA,
        linkId: linkA1,
        date: dataDaVenda,
        amount: 10,
        status: 'CONFIRMED',
        idempotencyKey: `clique-depois-${Date.now()}`,
      })
      assert.equal(sale.clickEventId, null)
      assert.equal(sale.attributionMethod, 'SEM_CLIQUE_ELEGIVEL')
    })

    test('clique de OUTRO WORKSPACE nunca é atribuído', async () => {
      await limpar(workspaceA)
      await limpar(workspaceB)
      await clicar(workspaceB, linkB1, new Date(Date.now() - 60_000))
      const { sale } = await registrarResultado({
        workspaceId: workspaceA,
        actorUserId: userId,
        dataOrigin: 'TEST_FIXTURE',
        productId: produtoA,
        linkId: linkA1,
        amount: 10,
        status: 'CONFIRMED',
        idempotencyKey: `outro-ws-${Date.now()}`,
      })
      assert.equal(sale.clickEventId, null)
      assert.equal(sale.attributionMethod, 'SEM_CLIQUE_ELEGIVEL')
    })

    test('clique de OUTRO LINK do mesmo workspace nunca é atribuído', async () => {
      await limpar(workspaceA)
      await clicar(workspaceA, linkA2, new Date(Date.now() - 60_000))
      const { sale } = await registrarResultado({
        workspaceId: workspaceA,
        actorUserId: userId,
        dataOrigin: 'TEST_FIXTURE',
        productId: produtoA,
        linkId: linkA1,
        amount: 10,
        status: 'CONFIRMED',
        idempotencyKey: `outro-link-${Date.now()}`,
      })
      assert.equal(sale.clickEventId, null)
      assert.equal(sale.attributionMethod, 'SEM_CLIQUE_ELEGIVEL')
    })

    test('clique do link certo vence clique mais recente de outro link', async () => {
      await limpar(workspaceA)
      const certo = await clicar(workspaceA, linkA1, new Date(Date.now() - 600_000))
      await clicar(workspaceA, linkA2, new Date(Date.now() - 1_000))
      const { sale } = await registrarResultado({
        workspaceId: workspaceA,
        actorUserId: userId,
        dataOrigin: 'TEST_FIXTURE',
        productId: produtoA,
        linkId: linkA1,
        amount: 10,
        status: 'CONFIRMED',
        idempotencyKey: `link-certo-${Date.now()}`,
      })
      assert.equal(sale.clickEventId, certo.id, 'a recência não pode vencer a identidade do link')
    })

    test('NENHUMA venda desta suíte ficou com atribuição falsa', async () => {
      // Varredura final: toda venda atribuída tem de apontar para um clique
      // do MESMO workspace, do MESMO link, ANTERIOR à venda.
      const vendas = await prisma.sale.findMany({
        where: { workspaceId: { in: [workspaceA, workspaceB] }, clickEventId: { not: null } },
        select: { id: true, workspaceId: true, linkId: true, date: true, clickEvent: true },
      })
      for (const v of vendas) {
        assert.ok(v.clickEvent, `venda ${v.id} aponta para clique inexistente`)
        assert.equal(v.clickEvent!.workspaceId, v.workspaceId, 'clique de outro workspace atribuído')
        assert.equal(v.clickEvent!.linkId, v.linkId, 'clique de outro link atribuído')
        assert.ok(v.clickEvent!.createdAt.getTime() < v.date.getTime(), 'clique posterior à venda atribuído')
      }
    })
  }
)
