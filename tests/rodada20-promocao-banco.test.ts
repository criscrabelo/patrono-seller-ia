/**
 * P0.2 Bloco 3.1 — promoção auditada contra Postgres real.
 *
 * Prova o que a regra pura não alcança: a transação tudo-ou-nada, a
 * idempotência da evidência, o isolamento entre workspaces, e a
 * revalidação pela autoridade única depois da promoção.
 *
 * NUNCA rodar contra produção.
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../lib/prisma'
import { registrarResultado } from '../lib/vendas-comissoes'
import { ACAO_AUDIT_EVIDENCIA } from '../lib/real-operation'
import { promoverVendaParaRealOperation, ACAO_AUDIT_PROMOCAO } from '../lib/promocao-operacao-real'

const TEM_BANCO = !!process.env.DATABASE_URL

let workspaceA = ''
let workspaceB = ''
let userId = ''
let produtoA = ''
const criados: string[] = []

async function limpar(ws: string) {
  await prisma.commission.deleteMany({ where: { workspaceId: ws } })
  await prisma.sale.deleteMany({ where: { workspaceId: ws } })
  await prisma.auditLog.deleteMany({ where: { workspaceId: ws } })
}

/**
 * Cria a venda pelo caminho normal e ajusta `dataOrigin` direto no banco
 * para montar o cenário. `USER_REPORTED` é exatamente o que a tela produz.
 */
async function criarVenda(origem = 'USER_REPORTED', statusVenda = 'CONFIRMED', statusComissao?: string) {
  const { sale, commission } = await registrarResultado({
    workspaceId: workspaceA,
    actorUserId: userId,
    dataOrigin: 'TEST_FIXTURE',
    productId: produtoA,
    amount: 100,
    status: 'CONFIRMED',
    expectedCommission: 10,
    idempotencyKey: `b31-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  })
  await prisma.sale.update({
    where: { id: sale.id },
    data: { dataOrigin: origem, status: statusVenda },
  })
  if (statusComissao) {
    await prisma.commission.update({ where: { id: commission!.id }, data: { status: statusComissao } })
  }
  return { saleId: sale.id, commissionId: commission!.id }
}

const PROVIDER = {
  tipoEvidencia: 'PROVIDER_OFICIAL',
  referencia: 'webhook-evt-b31',
  ator: { tipo: 'INTEGRACAO' as const },
}

describe(
  'Bloco 3.1 no banco — promoção auditada',
  { skip: !TEM_BANCO ? 'DATABASE_URL ausente — este arquivo exige Postgres' : false },
  () => {
    before(async () => {
      const marca = Date.now()
      for (const nome of ['A', 'B']) {
        const ws = await prisma.workspace.create({
          data: { name: `B31-${nome}`, ownerId: `b31-${nome}-${marca}` },
          select: { id: true },
        })
        criados.push(ws.id)
      }
      ;[workspaceA, workspaceB] = criados

      userId = (
        await prisma.user.create({
          data: {
            email: `b31-${marca}@teste.local`,
            name: 'Teste Bloco 3.1',
            password: 'nao-usada-neste-teste',
            workspaceId: workspaceA,
          },
          select: { id: true },
        })
      ).id

      produtoA = (
        await prisma.produto.create({
          data: {
            workspaceId: workspaceA,
            userId,
            nome: 'Produto Bloco 3.1',
            categoria: 'casa',
            tipoVenda: 'Afiliado',
            origemConteudo: 'Proprio',
          },
          select: { id: true },
        })
      ).id
    })

    after(async () => {
      for (const ws of criados) await limpar(ws)
      await prisma.produto.deleteMany({ where: { workspaceId: { in: criados } } })
      await prisma.user.deleteMany({ where: { workspaceId: { in: criados } } })
      await prisma.workspace.deleteMany({ where: { id: { in: criados } } })
      await prisma.$disconnect()
    })

    // ── Promoções que funcionam ─────────────────────────────────────────

    test('USER_REPORTED + PROVIDER_OFICIAL → promove, grava evidência e audita', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'CONFIRMED', 'CONFIRMED')

      const r = await promoverVendaParaRealOperation({ workspaceId: workspaceA, saleId, ...PROVIDER })

      assert.equal(r.promovido, true, r.explicacao)
      assert.equal(r.origemAnterior, 'USER_REPORTED')
      assert.equal(r.origemNova, 'REAL_OPERATION')

      const venda = await prisma.sale.findUnique({ where: { id: saleId }, select: { dataOrigin: true } })
      assert.equal(venda?.dataOrigin, 'REAL_OPERATION')

      const evidencias = await prisma.auditLog.count({
        where: { workspaceId: workspaceA, action: ACAO_AUDIT_EVIDENCIA, entityId: saleId },
      })
      const promocoes = await prisma.auditLog.count({
        where: { workspaceId: workspaceA, action: ACAO_AUDIT_PROMOCAO, entityId: saleId },
      })
      assert.equal(evidencias, 1)
      assert.equal(promocoes, 1)
    })

    test('a auditoria da promoção guarda estado anterior e novo', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'CONFIRMED', 'RECEIVED')
      await promoverVendaParaRealOperation({ workspaceId: workspaceA, saleId, ...PROVIDER })

      const log = await prisma.auditLog.findFirst({
        where: { workspaceId: workspaceA, action: ACAO_AUDIT_PROMOCAO, entityId: saleId },
        select: { metadata: true },
      })
      const meta = log?.metadata as Record<string, unknown>
      assert.equal(meta.estadoAnterior, 'USER_REPORTED')
      assert.equal(meta.estadoNovo, 'REAL_OPERATION')
      assert.equal(meta.tipoEvidencia, 'PROVIDER_OFICIAL')
      assert.ok(typeof meta.promovidaEm === 'string')
    })

    test('CONCILIACAO_FINANCEIRA promove', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'CONFIRMED', 'RECEIVED')
      const r = await promoverVendaParaRealOperation({
        workspaceId: workspaceA,
        saleId,
        tipoEvidencia: 'CONCILIACAO_FINANCEIRA',
        referencia: 'repasse-2026-09-30',
        ator: { tipo: 'SISTEMA' },
      })
      assert.equal(r.promovido, true, r.explicacao)
    })

    test('CORRECAO_MANUAL_AUDITADA completa promove — o caminho sem TikTok', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'CONFIRMED', 'CONFIRMED')
      const r = await promoverVendaParaRealOperation({
        workspaceId: workspaceA,
        saleId,
        tipoEvidencia: 'CORRECAO_MANUAL_AUDITADA',
        referencia: 'extrato-banco-2026-09-18-linha-42',
        ator: { tipo: 'USUARIA', userId },
        motivo: 'Repasse conferido no extrato bancário da conta da empresa.',
      })
      assert.equal(r.promovido, true, r.explicacao)

      const log = await prisma.auditLog.findFirst({
        where: { workspaceId: workspaceA, action: ACAO_AUDIT_EVIDENCIA, entityId: saleId },
        select: { metadata: true, userId: true },
      })
      const meta = log?.metadata as Record<string, unknown>
      assert.equal(log?.userId, userId, 'o responsável fica registrado na auditoria')
      assert.ok(String(meta.motivo).length >= 10)
    })

    test('UNVERIFIED também é promovível com evidência', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('UNVERIFIED', 'CONFIRMED', 'CONFIRMED')
      const r = await promoverVendaParaRealOperation({ workspaceId: workspaceA, saleId, ...PROVIDER })
      assert.equal(r.promovido, true, r.explicacao)
      assert.equal(r.origemAnterior, 'UNVERIFIED')
    })

    // ── Revalidação: promover ≠ ser elegível ────────────────────────────

    test('promoção + venda CONFIRMED + comissão CONFIRMED → ELEGÍVEL', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'CONFIRMED', 'CONFIRMED')
      const r = await promoverVendaParaRealOperation({ workspaceId: workspaceA, saleId, ...PROVIDER })
      assert.equal(r.promovido, true)
      assert.equal(r.veredito?.elegivel, true, JSON.stringify(r.veredito?.motivos))
      assert.equal(r.veredito?.evidenciaUtilizada, 'PROVIDER_OFICIAL')
    })

    test('promoção + comissão RECEIVED → ELEGÍVEL', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'CONFIRMED', 'RECEIVED')
      const r = await promoverVendaParaRealOperation({ workspaceId: workspaceA, saleId, ...PROVIDER })
      assert.equal(r.veredito?.elegivel, true, JSON.stringify(r.veredito?.motivos))
    })

    test('promoção bem-sucedida + venda PENDING → promovida, mas NÃO elegível', async () => {
      // Promover muda a origem; não decide elegibilidade. Uma venda ainda
      // pendente continua inelegível, e isso é correto.
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'PENDING', 'RECEIVED')
      const r = await promoverVendaParaRealOperation({ workspaceId: workspaceA, saleId, ...PROVIDER })
      assert.equal(r.promovido, true, r.explicacao)
      assert.equal(r.veredito?.elegivel, false)
      assert.ok(r.veredito?.motivos.includes('VENDA_NAO_CONFIRMADA'))
    })

    test('promoção bem-sucedida + comissão EXPECTED → promovida, mas NÃO elegível', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'CONFIRMED')
      const r = await promoverVendaParaRealOperation({ workspaceId: workspaceA, saleId, ...PROVIDER })
      assert.equal(r.promovido, true, r.explicacao)
      assert.equal(r.veredito?.elegivel, false)
      assert.ok(r.veredito?.motivos.includes('SEM_COMISSAO_RECONHECIDA'))
    })

    // ── Recusas ─────────────────────────────────────────────────────────

    test('comissão confirmada SEM referência externa → NÃO promove', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'CONFIRMED', 'CONFIRMED')
      const r = await promoverVendaParaRealOperation({
        workspaceId: workspaceA,
        saleId,
        tipoEvidencia: 'COMISSAO_CONFIRMADA_COM_ORIGEM_VERIFICAVEL',
        referencia: '',
        ator: { tipo: 'SISTEMA' },
      })
      assert.equal(r.promovido, false)
      assert.equal(r.motivo, 'REFERENCIA_AUSENTE')
      const venda = await prisma.sale.findUnique({ where: { id: saleId }, select: { dataOrigin: true } })
      assert.equal(venda?.dataOrigin, 'USER_REPORTED', 'a origem não pode ter mudado')
    })

    test('correção manual sem motivo → bloqueia e não grava nada', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'CONFIRMED', 'CONFIRMED')
      const r = await promoverVendaParaRealOperation({
        workspaceId: workspaceA,
        saleId,
        tipoEvidencia: 'CORRECAO_MANUAL_AUDITADA',
        referencia: 'extrato-1',
        ator: { tipo: 'USUARIA', userId },
      })
      assert.equal(r.promovido, false)
      assert.equal(r.motivo, 'MOTIVO_AUSENTE')
      const logs = await prisma.auditLog.count({
        where: { workspaceId: workspaceA, entityId: saleId, action: { in: [ACAO_AUDIT_EVIDENCIA, ACAO_AUDIT_PROMOCAO] } },
      })
      assert.equal(logs, 0, 'recusa não pode deixar evidência nem promoção gravadas')
    })

    test('correção manual sem responsável → bloqueia', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'CONFIRMED', 'CONFIRMED')
      const r = await promoverVendaParaRealOperation({
        workspaceId: workspaceA,
        saleId,
        tipoEvidencia: 'CORRECAO_MANUAL_AUDITADA',
        referencia: 'extrato-1',
        ator: { tipo: 'USUARIA', userId: null },
        motivo: 'Repasse conferido no extrato bancário.',
      })
      assert.equal(r.promovido, false)
      assert.equal(r.motivo, 'RESPONSAVEL_AUSENTE')
    })

    for (const origem of ['SEED', 'TEST_FIXTURE', 'DEMO', 'SYNTHETIC_TEST']) {
      test(`${origem} NUNCA promove, nem com evidência válida`, async () => {
        await limpar(workspaceA)
        const { saleId } = await criarVenda(origem, 'CONFIRMED', 'RECEIVED')
        const r = await promoverVendaParaRealOperation({ workspaceId: workspaceA, saleId, ...PROVIDER })
        assert.equal(r.promovido, false)
        assert.equal(r.motivo, 'ORIGEM_SINTETICA_NAO_PROMOVIVEL')
        const venda = await prisma.sale.findUnique({ where: { id: saleId }, select: { dataOrigin: true } })
        assert.equal(venda?.dataOrigin, origem, 'a origem sintética não pode ser alterada')
      })
    }

    test('venda já REAL_OPERATION → recusa com motivo próprio, sem duplicar auditoria', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('REAL_OPERATION', 'CONFIRMED', 'RECEIVED')
      const r = await promoverVendaParaRealOperation({ workspaceId: workspaceA, saleId, ...PROVIDER })
      assert.equal(r.promovido, false)
      assert.equal(r.motivo, 'JA_ERA_OPERACAO_REAL')
    })

    // ── Multi-workspace ─────────────────────────────────────────────────

    test('venda de OUTRO workspace → bloqueia, sem revelar que existe', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'CONFIRMED', 'CONFIRMED')
      const r = await promoverVendaParaRealOperation({ workspaceId: workspaceB, saleId, ...PROVIDER })
      assert.equal(r.promovido, false)
      assert.equal(r.motivo, 'VENDA_NAO_ENCONTRADA')

      const venda = await prisma.sale.findUnique({ where: { id: saleId }, select: { dataOrigin: true } })
      assert.equal(venda?.dataOrigin, 'USER_REPORTED', 'a venda alheia não pode ter sido tocada')

      const logs = await prisma.auditLog.count({ where: { workspaceId: workspaceB } })
      assert.equal(logs, 0, 'a tentativa não pode gerar registro no workspace errado')
    })

    test('saleId sem workspaceId → bloqueia', async () => {
      const r = await promoverVendaParaRealOperation({ workspaceId: '', saleId: 'qualquer', ...PROVIDER })
      assert.equal(r.promovido, false)
      assert.equal(r.motivo, 'WORKSPACE_AUSENTE')
    })

    test('venda inexistente → bloqueia', async () => {
      const r = await promoverVendaParaRealOperation({
        workspaceId: workspaceA,
        saleId: 'venda-que-nao-existe',
        ...PROVIDER,
      })
      assert.equal(r.promovido, false)
      assert.equal(r.motivo, 'VENDA_NAO_ENCONTRADA')
    })

    // ── Idempotência ────────────────────────────────────────────────────

    test('a MESMA evidência aplicada duas vezes é idempotente', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'CONFIRMED', 'CONFIRMED')

      const primeira = await promoverVendaParaRealOperation({ workspaceId: workspaceA, saleId, ...PROVIDER })
      const segunda = await promoverVendaParaRealOperation({ workspaceId: workspaceA, saleId, ...PROVIDER })

      assert.equal(primeira.promovido, true)
      assert.equal(segunda.promovido, false)
      assert.equal(segunda.idempotente, true)
      assert.equal(segunda.motivo, null, 'reenvio da mesma evidência não é erro')

      const evidencias = await prisma.auditLog.count({
        where: { workspaceId: workspaceA, action: ACAO_AUDIT_EVIDENCIA, entityId: saleId },
      })
      const promocoes = await prisma.auditLog.count({
        where: { workspaceId: workspaceA, action: ACAO_AUDIT_PROMOCAO, entityId: saleId },
      })
      assert.equal(evidencias, 1, 'nenhuma evidência duplicada')
      assert.equal(promocoes, 1, 'nenhuma promoção duplicada')
    })

    test('o reenvio idempotente ainda devolve o veredito atual', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'CONFIRMED', 'RECEIVED')
      await promoverVendaParaRealOperation({ workspaceId: workspaceA, saleId, ...PROVIDER })
      const segunda = await promoverVendaParaRealOperation({ workspaceId: workspaceA, saleId, ...PROVIDER })
      assert.equal(segunda.idempotente, true)
      assert.equal(segunda.veredito?.elegivel, true)
    })

    test('duas entregas SIMULTÂNEAS da mesma evidência promovem uma só vez', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'CONFIRMED', 'CONFIRMED')

      const [a, b] = await Promise.all([
        promoverVendaParaRealOperation({ workspaceId: workspaceA, saleId, ...PROVIDER }),
        promoverVendaParaRealOperation({ workspaceId: workspaceA, saleId, ...PROVIDER }),
      ])

      assert.equal([a, b].filter((r) => r.promovido).length, 1, 'só uma pode promover')
      const evidencias = await prisma.auditLog.count({
        where: { workspaceId: workspaceA, action: ACAO_AUDIT_EVIDENCIA, entityId: saleId },
      })
      assert.equal(evidencias, 1)
    })

    test('referência DIFERENTE é outra evidência — recusada porque já é real', async () => {
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'CONFIRMED', 'CONFIRMED')
      await promoverVendaParaRealOperation({ workspaceId: workspaceA, saleId, ...PROVIDER })
      const outra = await promoverVendaParaRealOperation({
        workspaceId: workspaceA,
        saleId,
        ...PROVIDER,
        referencia: 'webhook-evt-OUTRO',
      })
      assert.equal(outra.promovido, false)
      assert.equal(outra.motivo, 'JA_ERA_OPERACAO_REAL')
    })

    // ── Nada de ML ──────────────────────────────────────────────────────

    test('nenhum MLFeatureSnapshot foi criado por esta rodada', async () => {
      const n = await prisma.mLFeatureSnapshot.count({ where: { workspaceId: { in: criados } } })
      assert.equal(n, 0)
    })

    test('o primeiro REAL_OPERATION legítimo existe e é elegível', async () => {
      // Fecha o P0.2: há caminho legítimo, auditado e comprovado até aqui.
      await limpar(workspaceA)
      const { saleId } = await criarVenda('USER_REPORTED', 'CONFIRMED', 'RECEIVED')
      const r = await promoverVendaParaRealOperation({
        workspaceId: workspaceA,
        saleId,
        tipoEvidencia: 'CORRECAO_MANUAL_AUDITADA',
        referencia: 'extrato-banco-2026-09-18-linha-42',
        ator: { tipo: 'USUARIA', userId },
        motivo: 'Comissão recebida e conferida no extrato bancário da empresa.',
      })
      assert.equal(r.promovido, true, r.explicacao)
      assert.equal(r.veredito?.elegivel, true, JSON.stringify(r.veredito?.motivos))

      const reais = await prisma.sale.count({
        where: { workspaceId: workspaceA, dataOrigin: 'REAL_OPERATION' },
      })
      assert.equal(reais, 1)
    })
  }
)
