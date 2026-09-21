/**
 * P0.2 Bloco 3.1 — comprovação e promoção auditada (regra pura).
 *
 * As exigências por tipo de evidência decidem se uma venda vira operação
 * real. São exercidas aqui com os dados exatos de cada caso, sem banco. O
 * que precisa de Postgres — transação, idempotência, isolamento e
 * revalidação — está em `rodada20-promocao-banco.test.ts`.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  validarPedidoDePromocao,
  chaveDaEvidencia,
  ORIGENS_PROMOVIVEIS,
  MOTIVOS_RECUSA_PROMOCAO,
  TAMANHO_MINIMO_DO_MOTIVO,
  ACAO_AUDIT_PROMOCAO,
  PENDENCIA_DE_AUTOMACAO,
  type ContextoDeValidacao,
  type PedidoDePromocao,
} from '../lib/promocao-operacao-real'
import { EVIDENCIAS_ACEITAS_PARA_OPERACAO_REAL, ORIGENS_DE_REGISTRO } from '../lib/proveniencia'
import { ACAO_AUDIT_EVIDENCIA } from '../lib/real-operation'

const RAIZ = join(__dirname, '..')
const lerFonte = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8')
const lerCodigo = (rel: string) =>
  lerFonte(rel)
    .split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')

const WS = 'ws-alfa'
const SALE = 'sale-1'

function pedido(over: Partial<PedidoDePromocao> = {}): PedidoDePromocao {
  return {
    workspaceId: WS,
    saleId: SALE,
    tipoEvidencia: 'PROVIDER_OFICIAL',
    referencia: 'webhook-evt-9f3a1',
    ator: { tipo: 'INTEGRACAO' },
    ...over,
  }
}

function contexto(over: Partial<ContextoDeValidacao> = {}): ContextoDeValidacao {
  return { origemAtual: 'USER_REPORTED', temComissaoReconhecida: true, ...over }
}

const validar = (p: Partial<PedidoDePromocao> = {}, c: Partial<ContextoDeValidacao> = {}) =>
  validarPedidoDePromocao(pedido(p), contexto(c))

const CORRECAO_COMPLETA: Partial<PedidoDePromocao> = {
  tipoEvidencia: 'CORRECAO_MANUAL_AUDITADA',
  referencia: 'extrato-banco-2026-09-18-linha-42',
  ator: { tipo: 'USUARIA', userId: 'user-1' },
  motivo: 'Repasse conferido no extrato bancário da conta da empresa.',
}

// ── Evidências que PROMOVEM ─────────────────────────────────────────────

describe('Promove — evidência externa verificável', () => {
  test('USER_REPORTED + PROVIDER_OFICIAL com referência → promove', () => {
    assert.deepEqual(validar(), { ok: true })
  })

  test('USER_REPORTED + CONCILIACAO_FINANCEIRA com referência → promove', () => {
    const r = validar({ tipoEvidencia: 'CONCILIACAO_FINANCEIRA', referencia: 'repasse-2026-09-30' })
    assert.deepEqual(r, { ok: true })
  })

  test('USER_REPORTED + CORRECAO_MANUAL_AUDITADA completa → promove', () => {
    assert.deepEqual(validar(CORRECAO_COMPLETA), { ok: true })
  })

  test('UNVERIFIED também é promovível', () => {
    assert.deepEqual(validar({}, { origemAtual: 'UNVERIFIED' }), { ok: true })
  })

  test('COMISSAO_CONFIRMADA_COM_ORIGEM_VERIFICAVEL, com referência E comissão → promove', () => {
    const r = validar(
      { tipoEvidencia: 'COMISSAO_CONFIRMADA_COM_ORIGEM_VERIFICAVEL', referencia: 'integracao-shopee-conf-771' },
      { temComissaoReconhecida: true }
    )
    assert.deepEqual(r, { ok: true })
  })

  test('as quatro evidências do Bloco 3 continuam aceitas', () => {
    assert.deepEqual([...EVIDENCIAS_ACEITAS_PARA_OPERACAO_REAL], [
      'PROVIDER_OFICIAL',
      'CONCILIACAO_FINANCEIRA',
      'COMISSAO_CONFIRMADA_COM_ORIGEM_VERIFICAVEL',
      'CORRECAO_MANUAL_AUDITADA',
    ])
  })
})

// ── Comissão confirmada NÃO é prova por si ──────────────────────────────

describe('Recusa — comissão confirmada sem referência externa', () => {
  test('COMISSAO_CONFIRMADA_COM_ORIGEM_VERIFICAVEL sem referência → NÃO promove', () => {
    // O ponto do Bloco 3.1: `Commission.status = CONFIRMED` é a mesma
    // pessoa repetindo a mesma declaração. O que prova é de ONDE veio.
    for (const ref of ['', '   ', null, undefined]) {
      const r = validar(
        { tipoEvidencia: 'COMISSAO_CONFIRMADA_COM_ORIGEM_VERIFICAVEL', referencia: ref as string },
        { temComissaoReconhecida: true }
      )
      assert.equal(r.ok, false)
      assert.equal((r as { motivo: string }).motivo, 'REFERENCIA_AUSENTE')
    }
  })

  test('evidência de comissão sem comissão reconhecida → NÃO promove', () => {
    const r = validar(
      { tipoEvidencia: 'COMISSAO_CONFIRMADA_COM_ORIGEM_VERIFICAVEL', referencia: 'conf-1' },
      { temComissaoReconhecida: false }
    )
    assert.equal(r.ok, false)
    assert.equal((r as { motivo: string }).motivo, 'SEM_COMISSAO_PARA_A_EVIDENCIA')
  })
})

// ── Referência: exigida em TODOS os tipos ───────────────────────────────

describe('Recusa — evidência sem referência conferível', () => {
  for (const tipo of EVIDENCIAS_ACEITAS_PARA_OPERACAO_REAL) {
    test(`${tipo} sem referência → NÃO promove`, () => {
      const extra = tipo === 'CORRECAO_MANUAL_AUDITADA' ? CORRECAO_COMPLETA : {}
      const r = validar({ ...extra, tipoEvidencia: tipo, referencia: '  ' })
      assert.equal(r.ok, false)
      assert.equal((r as { motivo: string }).motivo, 'REFERENCIA_AUSENTE')
    })
  }

  test('tipo de evidência inventado → NÃO promove', () => {
    for (const t of ['ACHO_QUE_VENDEU', '', 'provider_oficial', 'MANUAL']) {
      const r = validar({ tipoEvidencia: t })
      assert.equal(r.ok, false)
      assert.equal((r as { motivo: string }).motivo, 'TIPO_DE_EVIDENCIA_INVALIDO')
    }
  })
})

// ── Correção manual: exceção com assinatura ─────────────────────────────

describe('Recusa — correção manual incompleta', () => {
  test('sem responsável → bloqueia', () => {
    const r = validar({ ...CORRECAO_COMPLETA, ator: { tipo: 'USUARIA', userId: null } })
    assert.equal(r.ok, false)
    assert.equal((r as { motivo: string }).motivo, 'RESPONSAVEL_AUSENTE')
  })

  test('sem motivo → bloqueia', () => {
    const r = validar({ ...CORRECAO_COMPLETA, motivo: null })
    assert.equal(r.ok, false)
    assert.equal((r as { motivo: string }).motivo, 'MOTIVO_AUSENTE')
  })

  test('motivo curto demais → bloqueia ("ok" não é justificativa)', () => {
    const r = validar({ ...CORRECAO_COMPLETA, motivo: 'ok' })
    assert.equal(r.ok, false)
    assert.equal((r as { motivo: string }).motivo, 'MOTIVO_INSUFICIENTE')
    assert.ok(TAMANHO_MINIMO_DO_MOTIVO >= 10)
  })

  test('motivo só de espaços → bloqueia', () => {
    assert.equal(validar({ ...CORRECAO_COMPLETA, motivo: '              ' }).ok, false)
  })

  test('ator USUARIA sem userId bloqueia em qualquer tipo', () => {
    const r = validar({ tipoEvidencia: 'PROVIDER_OFICIAL', ator: { tipo: 'USUARIA', userId: null } })
    assert.equal(r.ok, false)
    assert.equal((r as { motivo: string }).motivo, 'RESPONSAVEL_AUSENTE')
  })
})

// ── Dados sintéticos: nunca ─────────────────────────────────────────────

describe('Recusa — dado sintético nunca vira real', () => {
  for (const origem of ['SEED', 'TEST_FIXTURE', 'DEMO', 'SYNTHETIC_TEST']) {
    test(`${origem} nunca promove, nem com evidência perfeita`, () => {
      // Promover dado que o próprio sistema fabricou seria falsificar a
      // procedência, não comprová-la.
      for (const tipo of EVIDENCIAS_ACEITAS_PARA_OPERACAO_REAL) {
        const extra = tipo === 'CORRECAO_MANUAL_AUDITADA' ? CORRECAO_COMPLETA : {}
        const r = validar({ ...extra, tipoEvidencia: tipo }, { origemAtual: origem })
        assert.equal(r.ok, false, `${origem} + ${tipo} não podia passar`)
        assert.equal((r as { motivo: string }).motivo, 'ORIGEM_SINTETICA_NAO_PROMOVIVEL')
      }
    })
  }

  test('só USER_REPORTED e UNVERIFIED são promovíveis', () => {
    assert.deepEqual([...ORIGENS_PROMOVIVEIS], ['USER_REPORTED', 'UNVERIFIED'])
    const passam = ORIGENS_DE_REGISTRO.filter((o) => validar({}, { origemAtual: o }).ok)
    assert.deepEqual([...passam].sort(), ['UNVERIFIED', 'USER_REPORTED'])
  })

  test('origem já REAL_OPERATION é recusada com motivo próprio', () => {
    const r = validar({}, { origemAtual: 'REAL_OPERATION' })
    assert.equal(r.ok, false)
    assert.equal((r as { motivo: string }).motivo, 'JA_ERA_OPERACAO_REAL')
  })

  test('origem corrompida cai em UNVERIFIED e ainda exige evidência válida', () => {
    assert.equal(validar({}, { origemAtual: 'LIXO' }).ok, true)
    assert.equal(validar({ referencia: '' }, { origemAtual: 'LIXO' }).ok, false)
  })
})

// ── Multi-workspace ─────────────────────────────────────────────────────

describe('Recusa — identificação incompleta', () => {
  test('saleId sem workspaceId → bloqueia', () => {
    const r = validarPedidoDePromocao(
      { ...pedido(), workspaceId: '' },
      contexto()
    )
    assert.equal(r.ok, false)
    assert.equal((r as { motivo: string }).motivo, 'WORKSPACE_AUSENTE')
  })

  test('workspaceId sem saleId → bloqueia', () => {
    const r = validarPedidoDePromocao({ ...pedido(), saleId: '' }, contexto())
    assert.equal(r.ok, false)
    assert.equal((r as { motivo: string }).motivo, 'WORKSPACE_AUSENTE')
  })
})

// ── Idempotência ────────────────────────────────────────────────────────

describe('Chave de idempotência', () => {
  const base = { workspaceId: WS, saleId: SALE, tipoEvidencia: 'PROVIDER_OFICIAL', referencia: 'evt-1' }

  test('mesma evidência → mesma chave', () => {
    assert.equal(chaveDaEvidencia(base), chaveDaEvidencia({ ...base }))
  })

  test('espaços na referência não criam chave diferente', () => {
    assert.equal(chaveDaEvidencia(base), chaveDaEvidencia({ ...base, referencia: '  evt-1  ' }))
  })

  test('workspace, venda, tipo e referência entram todos na chave', () => {
    assert.notEqual(chaveDaEvidencia(base), chaveDaEvidencia({ ...base, workspaceId: 'ws-beta' }))
    assert.notEqual(chaveDaEvidencia(base), chaveDaEvidencia({ ...base, saleId: 'sale-2' }))
    assert.notEqual(chaveDaEvidencia(base), chaveDaEvidencia({ ...base, tipoEvidencia: 'CONCILIACAO_FINANCEIRA' }))
    assert.notEqual(chaveDaEvidencia(base), chaveDaEvidencia({ ...base, referencia: 'evt-2' }))
  })
})

// ── Garantias estruturais ───────────────────────────────────────────────

describe('Garantias da promoção', () => {
  const codigo = lerCodigo('lib/promocao-operacao-real.ts')

  test('validar → evidência → origem → auditoria, tudo numa transação', () => {
    assert.match(codigo, /prisma\.\$transaction/)
    assert.match(codigo, /pg_advisory_xact_lock/)
    // A evidência é gravada ANTES da mudança de origem: se algo falhar
    // depois, a transação desfaz e a venda não fica promovida sem prova.
    const posEvidencia = codigo.indexOf(`action: ACAO_AUDIT_EVIDENCIA`)
    const posUpdate = codigo.indexOf('tx.sale.update')
    const posPromocao = codigo.indexOf('action: ACAO_AUDIT_PROMOCAO')
    assert.ok(posEvidencia > 0 && posUpdate > posEvidencia, 'evidência tem de vir antes da promoção')
    assert.ok(posPromocao > posUpdate, 'a auditoria da promoção vem por último')
  })

  test('a venda é sempre buscada COM o workspace', () => {
    assert.match(codigo, /where: \{ id: pedido\.saleId, workspaceId: pedido\.workspaceId \}/)
    assert.ok(!/findUnique\(\{\s*where:\s*\{\s*id: pedido\.saleId\s*\}/.test(codigo), 'nunca por id solto')
  })

  test('a busca de evidência anterior filtra por workspace', () => {
    const trecho = codigo.slice(codigo.indexOf('const jaRegistrada'), codigo.indexOf('if (jaRegistrada)'))
    assert.match(trecho, /workspaceId: pedido\.workspaceId/)
  })

  test('a comissão considerada é do mesmo workspace', () => {
    assert.match(codigo, /c\.workspaceId === pedido\.workspaceId/)
  })

  test('a promoção revalida pela autoridade única', () => {
    assert.match(codigo, /avaliarVendaParaOperacaoReal\(pedido\.workspaceId, pedido\.saleId\)/)
  })

  test('as duas ações de auditoria são distintas', () => {
    assert.equal(ACAO_AUDIT_PROMOCAO, 'venda.promovida_para_operacao_real')
    assert.notEqual(ACAO_AUDIT_PROMOCAO, ACAO_AUDIT_EVIDENCIA)
  })

  test('o estado anterior e o novo são gravados na auditoria', () => {
    assert.match(codigo, /estadoAnterior: origemAnterior/)
    assert.match(codigo, /estadoNovo: 'REAL_OPERATION'/)
  })

  test('não existe atalho para marcar como real sem evidência', () => {
    // Um "forcar", "ignorarEvidencia" ou "marcarComoReal" aqui anularia o
    // mecanismo inteiro.
    for (const atalho of ['forcar', 'force', 'ignorarEvidencia', 'marcarComoReal', 'skipValidacao']) {
      assert.ok(!codigo.toLowerCase().includes(atalho.toLowerCase()), `${atalho} não pode existir`)
    }
  })

  test('todo motivo de recusa pertence à lista declarada', () => {
    const casos: Array<[Partial<PedidoDePromocao>, Partial<ContextoDeValidacao>]> = [
      [{ tipoEvidencia: 'X' }, {}],
      [{ referencia: '' }, {}],
      [CORRECAO_COMPLETA, { origemAtual: 'SEED' }],
      [{ ...CORRECAO_COMPLETA, motivo: 'x' }, {}],
      [{ ...CORRECAO_COMPLETA, ator: { tipo: 'USUARIA' } }, {}],
      [{ tipoEvidencia: 'COMISSAO_CONFIRMADA_COM_ORIGEM_VERIFICAVEL' }, { temComissaoReconhecida: false }],
      [{}, { origemAtual: 'REAL_OPERATION' }],
    ]
    for (const [p, c] of casos) {
      const r = validar(p, c)
      assert.equal(r.ok, false, JSON.stringify(p))
      assert.ok((MOTIVOS_RECUSA_PROMOCAO as readonly string[]).includes((r as { motivo: string }).motivo))
    }
  })

  test('toda recusa vem com explicação', () => {
    const r = validar({ referencia: '' })
    assert.equal(r.ok, false)
    assert.ok((r as { explicacao: string }).explicacao.length > 0)
  })
})

// ── Fila de automação ───────────────────────────────────────────────────

describe('Correção manual é exceção, não rotina', () => {
  test('a pendência de automação está declarada', () => {
    assert.equal(PENDENCIA_DE_AUTOMACAO.chave, 'operacao-real:comprovacao-recorrente')
    assert.equal(PENDENCIA_DE_AUTOMACAO.evidenciaManualAceitaHoje, 'CORRECAO_MANUAL_AUDITADA')
  })

  test('os substitutos automáticos são provider e conciliação', () => {
    assert.deepEqual([...PENDENCIA_DE_AUTOMACAO.substitutosAutomaticos], [
      'PROVIDER_OFICIAL',
      'CONCILIACAO_FINANCEIRA',
    ])
  })

  test('a explicação diz que recorrência é dívida de automação', () => {
    assert.match(PENDENCIA_DE_AUTOMACAO.explicacao, /dívida de automação/i)
  })
})

// ── Nada de ML nesta rodada ─────────────────────────────────────────────

describe('Bloco 3.1 não liga o ML', () => {
  test('a promoção não toca o feature store', () => {
    const codigo = lerCodigo('lib/promocao-operacao-real.ts')
    assert.ok(
      !/salvarFeatureSnapshot|mLFeatureSnapshot|registrarLabelNoSnapshot|extrairFeaturesDeConteudo|treinar|promoverModelo/.test(codigo)
    )
  })

  test('a autoridade do Bloco 3 continua sem escrever nada', () => {
    const codigo = lerCodigo('lib/real-operation.ts')
    for (const escrita of ['.create(', '.update(', '.upsert(', '.delete(']) {
      assert.ok(!codigo.includes(escrita), `real-operation.ts não pode escrever (${escrita})`)
    }
  })

  test('as rotas continuam criando USER_REPORTED, não REAL_OPERATION', () => {
    for (const rota of ['app/api/vendas/route.ts', 'app/api/links/[id]/venda/route.ts']) {
      const codigo = lerCodigo(rota)
      assert.match(codigo, /dataOrigin: 'USER_REPORTED'/)
      assert.ok(!/dataOrigin:\s*'REAL_OPERATION'/.test(codigo))
    }
  })
})
