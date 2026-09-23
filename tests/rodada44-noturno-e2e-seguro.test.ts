/**
 * Modo noturno seguro — preparação do P1.6 e ciclo operacional completo.
 *
 * Duas coisas são provadas aqui:
 *
 *  1. A cadeia do Instagram (preflight → Publicacao → LinkDinamico →
 *     adapter → confirmação) se comporta sob retry, recusa, envio incerto e
 *     republicação — sem nunca duplicar um post.
 *
 *  2. O Patrono vai de oportunidade a ensaio de distribuição sem ninguém
 *     chamar função à mão.
 *
 * NENHUMA postagem real. NENHUM provider pago. Custo R$ 0,00.
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../lib/prisma'
import {
  distribuirConteudo,
  type AdaptadorDeCanal,
  type PedidoDeDistribuicao,
} from '../lib/distribuicao-orquestrador'
import { adaptadorInstagram, falhaDeRede } from '../lib/adaptadores-reais'
import { preflightDePublicacao, simularDistribuicao } from '../lib/preflight-de-publicacao'
import { CAMPO_DOS_SCOPES, CAMPO_DA_COMPROVACAO } from '../lib/autorizacao-da-conta'
import { montarFilaDeOportunidades } from '../lib/motor-de-oportunidades'
import { montarPlanoDeAcao } from '../lib/plano-de-acao'
import { jobsDeGeracaoDoPlano } from '../lib/fabrica-de-conteudo'
import { sincronizarFilaComPlano } from '../lib/automation-queue-repositorio'
import { portaPrisma } from '../lib/automation-queue-prisma'
import { rodarFilaDoWorkspace } from '../lib/executor-da-fila'
import { textoDisclosure } from '../lib/creative-factory'

const TEM_BANCO = !!process.env.DATABASE_URL
const marca = `r44-${Date.now()}`
const AMANHA = new Date(Date.now() + 24 * 60 * 60 * 1000)

const ENV = {
  PUBLIC_BASE_URL: 'https://patrono.exemplo.com.br',
  PUBLICACAO_REAL_INSTAGRAM: 'true',
}
const SEGREDO = `TOKEN-SECRETO-${marca}`

let wsA = ''
let userA = ''
let produtoId = ''
let conteudoId = ''
const criados: string[] = []

const LEGENDA = `Produto bom. ${textoDisclosure('afiliado')}`

/** Conta o que o canal recebeu, e nunca sai da máquina. */
function espiao(resposta: () => Promise<{ ok: boolean; publicacaoExternaId: string | null; erro: string | null; fatal?: boolean; envioIncerto?: boolean }>) {
  const chamadas: PedidoDeDistribuicao[] = []
  const adapter: AdaptadorDeCanal = {
    canal: 'instagram',
    publicar: async (p) => {
      chamadas.push(p)
      return resposta()
    },
  }
  return { chamadas, adapter }
}

before(async () => {
  if (!TEM_BANCO) return
  const ws = await prisma.workspace.create({
    data: { name: 'R44', ownerId: marca },
    select: { id: true },
  })
  criados.push(ws.id)
  wsA = ws.id
  userA = (
    await prisma.user.create({
      data: { email: `${marca}@teste.local`, name: 'U', password: 'x', workspaceId: wsA },
      select: { id: true },
    })
  ).id

  produtoId = (
    await prisma.produto.create({
      data: {
        workspaceId: wsA, userId: userA, nome: `${marca}-produto`, categoria: 'casa',
        tipoVenda: 'Afiliado', origemConteudo: 'Proprio',
        imagens: ['https://loja.invalido/i.jpg'],
        linkProduto: 'https://loja.invalido/p',
        preco: 99.9,
      },
      select: { id: true },
    })
  ).id

  conteudoId = (
    await prisma.conteudo.create({
      data: {
        workspaceId: wsA, userId: userA, produtoId, roteiro: 'x',
        redeSocial: 'instagram', legendaInstagram: LEGENDA,
        videoUrl: 'https://cdn.invalido/v.mp4',
      },
      select: { id: true },
    })
  ).id

  await prisma.integracao.create({
    data: {
      workspaceId: wsA, userId: userA, plataforma: 'instagram', status: 'conectado',
      accessToken: SEGREDO, tokenExpiry: AMANHA, accountId: '178414', accountName: '@loja',
      extraData: {
        appId: '123',
        [CAMPO_DOS_SCOPES]: ['instagram_content_publish'],
        [CAMPO_DA_COMPROVACAO]: new Date().toISOString(),
      } as never,
    },
  })
})

after(async () => {
  if (!TEM_BANCO) return
  for (const ws of criados) {
    await prisma.mLFeatureSnapshot.deleteMany({ where: { workspaceId: ws } })
    await prisma.linkDinamico.updateMany({ where: { workspaceId: ws }, data: { publicacaoId: null } })
    await prisma.eventoLink.deleteMany({ where: { workspaceId: ws } })
    await prisma.linkDinamico.deleteMany({ where: { workspaceId: ws } })
    await prisma.publicacao.deleteMany({ where: { workspaceId: ws } })
    await prisma.automationJob.deleteMany({ where: { workspaceId: ws } })
    await prisma.conteudo.deleteMany({ where: { workspaceId: ws } })
    await prisma.produto.deleteMany({ where: { workspaceId: ws } })
    await prisma.integracao.deleteMany({ where: { workspaceId: ws } })
    await prisma.auditLog.deleteMany({ where: { workspaceId: ws } })
    await prisma.user.deleteMany({ where: { workspaceId: ws } })
  }
  await prisma.workspace.deleteMany({ where: { id: { in: criados } } })
  await prisma.$disconnect()
})

// ── Envio incerto ───────────────────────────────────────────────────────

describe('Envio incerto nunca vira retry automático', () => {
  test('a rede caindo é incerta; a Meta respondendo, não', () => {
    for (const e of [
      new TypeError('fetch failed'),
      new Error('connect ETIMEDOUT 31.13.85.36:443'),
      new Error('socket hang up'),
      new Error(''),
      'coisa sem tipo',
    ]) {
      assert.equal(falhaDeRede(e), true, String(e))
    }
    for (const e of [
      new Error('(#100) The parameter video_url is required'),
      new Error('Invalid OAuth access token'),
      new Error('Media ID is not available'),
    ]) {
      assert.equal(falhaDeRede(e), false, String(e))
    }
  })

  test(
    'adapter que LANÇA: fatal, e a explicação manda conferir o perfil',
    { skip: !TEM_BANCO ? 'exige Postgres' : false },
    async () => {
      const e = espiao(async () => {
        throw new Error('fetch failed')
      })
      const r = await distribuirConteudo({
        workspaceId: wsA, contentId: conteudoId, canal: 'instagram',
        chaveDaTentativa: `${marca}-incerto`,
        adaptadores: { instagram: e.adapter }, env: ENV,
      })
      assert.equal(r.ok, false)
      assert.equal(r.envioIncerto, true)
      assert.equal(r.erroFatal, true, 'fatal = não repita sozinho')
      assert.match(r.explicacao, /ENVIO INCERTO/)
      assert.match(r.explicacao, /perfil/i)
    }
  )

  test(
    'adapter que RESPONDE recusa: retry continua permitido',
    { skip: !TEM_BANCO ? 'exige Postgres' : false },
    async () => {
      const e = espiao(async () => ({
        ok: false, publicacaoExternaId: null, erro: '(#100) video_url inválido', envioIncerto: false,
      }))
      const r = await distribuirConteudo({
        workspaceId: wsA, contentId: conteudoId, canal: 'instagram',
        chaveDaTentativa: `${marca}-recusa`,
        adaptadores: { instagram: e.adapter }, env: ENV,
      })
      assert.equal(r.envioIncerto, false)
      assert.equal(r.erroFatal, false, 'recusa é resposta: repetir é seguro')
    }
  )

  test(
    'adapter que responde com envioIncerto também vira fatal',
    { skip: !TEM_BANCO ? 'exige Postgres' : false },
    async () => {
      const e = espiao(async () => ({
        ok: false, publicacaoExternaId: null, erro: 'timeout na etapa final', envioIncerto: true,
      }))
      const r = await distribuirConteudo({
        workspaceId: wsA, contentId: conteudoId, canal: 'instagram',
        chaveDaTentativa: `${marca}-incerto-2`,
        adaptadores: { instagram: e.adapter }, env: ENV,
      })
      assert.equal(r.erroFatal, true)
      assert.equal(r.envioIncerto, true)
    }
  )

  test('sucesso nunca é marcado como incerto', { skip: !TEM_BANCO ? 'exige Postgres' : false }, async () => {
    const e = espiao(async () => ({ ok: true, publicacaoExternaId: `ig_ok_${marca}`, erro: null }))
    const r = await distribuirConteudo({
      workspaceId: wsA, contentId: conteudoId, canal: 'instagram',
      chaveDaTentativa: `${marca}-ok`,
      adaptadores: { instagram: e.adapter }, env: ENV,
    })
    assert.equal(r.ok, true, r.explicacao)
    assert.equal(r.envioIncerto, false)
  })
})

// ── Retry, republicação e identidade ────────────────────────────────────

describe(
  'A cadeia sob retry e republicação',
  { skip: !TEM_BANCO ? 'exige Postgres' : false },
  () => {
    test('RETRY após recusa: uma Publicacao, e o canal chamado de novo', async () => {
      let tentativa = 0
      const e = espiao(async () => {
        tentativa += 1
        return tentativa === 1
          ? { ok: false, publicacaoExternaId: null, erro: 'instabilidade', envioIncerto: false }
          : { ok: true, publicacaoExternaId: `ig_retry_${marca}`, erro: null }
      })
      const chave = `${marca}-retry`
      const a = await distribuirConteudo({
        workspaceId: wsA, contentId: conteudoId, canal: 'instagram', chaveDaTentativa: chave,
        adaptadores: { instagram: e.adapter }, env: ENV,
      })
      const b = await distribuirConteudo({
        workspaceId: wsA, contentId: conteudoId, canal: 'instagram', chaveDaTentativa: chave,
        adaptadores: { instagram: e.adapter }, env: ENV,
      })
      assert.equal(a.ok, false)
      assert.equal(b.ok, true, b.explicacao)
      assert.equal(a.publicacaoId, b.publicacaoId, 'a MESMA tentativa')
      assert.equal(
        await prisma.publicacao.count({ where: { workspaceId: wsA, chaveDaTentativa: chave } }),
        1
      )
      assert.equal(e.chamadas.length, 2, 'o retry de uma recusa reenvia — e isso é correto')
    })

    test('o mesmo link rastreado é reusado no retry', async () => {
      const chave = `${marca}-retry-link`
      let n = 0
      const e = espiao(async () => {
        n += 1
        return n === 1
          ? { ok: false, publicacaoExternaId: null, erro: 'instabilidade', envioIncerto: false }
          : { ok: true, publicacaoExternaId: `ig_rl_${marca}`, erro: null }
      })
      await distribuirConteudo({
        workspaceId: wsA, contentId: conteudoId, canal: 'instagram', chaveDaTentativa: chave,
        adaptadores: { instagram: e.adapter }, env: ENV,
      })
      await distribuirConteudo({
        workspaceId: wsA, contentId: conteudoId, canal: 'instagram', chaveDaTentativa: chave,
        adaptadores: { instagram: e.adapter }, env: ENV,
      })
      assert.equal(e.chamadas[0].urlParaDivulgar, e.chamadas[1].urlParaDivulgar)
      assert.match(e.chamadas[0].urlParaDivulgar, /\/api\/l\//)
    })

    test('REPUBLICAÇÃO deliberada: outra tentativa, outro link', async () => {
      let n = 0
      const e = espiao(async () => {
        n += 1
        return { ok: true, publicacaoExternaId: `ig_rep_${n}_${marca}`, erro: null }
      })
      const a = await distribuirConteudo({
        workspaceId: wsA, contentId: conteudoId, canal: 'instagram',
        chaveDaTentativa: `${marca}-rep-a`, adaptadores: { instagram: e.adapter }, env: ENV,
      })
      const b = await distribuirConteudo({
        workspaceId: wsA, contentId: conteudoId, canal: 'instagram',
        chaveDaTentativa: `${marca}-rep-b`, adaptadores: { instagram: e.adapter }, env: ENV,
      })
      assert.notEqual(a.publicacaoId, b.publicacaoId)
      assert.notEqual(e.chamadas[0].urlParaDivulgar, e.chamadas[1].urlParaDivulgar)
    })

    test('publicacaoExternaId é normalizado e vira evidência', async () => {
      const e = espiao(async () => ({
        ok: true, publicacaoExternaId: `   ig_norm_${marca}   `, erro: null,
      }))
      const r = await distribuirConteudo({
        workspaceId: wsA, contentId: conteudoId, canal: 'instagram',
        chaveDaTentativa: `${marca}-norm`, adaptadores: { instagram: e.adapter }, env: ENV,
      })
      const pub = await prisma.publicacao.findUniqueOrThrow({ where: { id: r.publicacaoId! } })
      assert.equal(pub.publicacaoExternaId, `ig_norm_${marca}`)
      assert.equal(pub.estado, 'DISTRIBUIDA')
      const ev = pub.evidencia as Record<string, unknown>
      assert.equal(ev.referenciaExterna, `ig_norm_${marca}`)
      assert.equal(ev.tipo, 'ID_EXTERNO_DO_PROVIDER')
    })
  }
)

// ── Credenciais ─────────────────────────────────────────────────────────

describe(
  'Nenhuma credencial chega ao adapter, ao log ou à evidência',
  { skip: !TEM_BANCO ? 'exige Postgres' : false },
  () => {
    test('o pedido entregue ao canal não tem token', async () => {
      const e = espiao(async () => ({ ok: true, publicacaoExternaId: `ig_c_${marca}`, erro: null }))
      await distribuirConteudo({
        workspaceId: wsA, contentId: conteudoId, canal: 'instagram',
        chaveDaTentativa: `${marca}-cred`, adaptadores: { instagram: e.adapter }, env: ENV,
      })
      const texto = JSON.stringify(e.chamadas[0])
      assert.ok(!texto.includes(SEGREDO))
      for (const proibido of ['accessToken', 'refreshToken', 'authorization', 'Bearer']) {
        assert.ok(!texto.includes(proibido), `${proibido} não pode chegar ao adapter`)
      }
      // O adapter recebe o WORKSPACE e busca a credencial sozinho.
      assert.equal(e.chamadas[0].workspaceId, wsA)
    })

    test('um erro do canal com token dentro sai redigido', async () => {
      const e = espiao(async () => {
        throw new Error(`GET https://exemplo.invalido/x?access_token=${SEGREDO} falhou`)
      })
      const r = await distribuirConteudo({
        workspaceId: wsA, contentId: conteudoId, canal: 'instagram',
        chaveDaTentativa: `${marca}-cred-erro`, adaptadores: { instagram: e.adapter }, env: ENV,
      })
      assert.ok(!r.explicacao.includes(SEGREDO))
      assert.match(r.explicacao, /REDIGIDO/)
    })

    test('a evidência gravada não tem segredo', async () => {
      const e = espiao(async () => ({ ok: true, publicacaoExternaId: `ig_ev_${marca}`, erro: null }))
      const r = await distribuirConteudo({
        workspaceId: wsA, contentId: conteudoId, canal: 'instagram',
        chaveDaTentativa: `${marca}-cred-ev`, adaptadores: { instagram: e.adapter }, env: ENV,
      })
      const pub = await prisma.publicacao.findUniqueOrThrow({
        where: { id: r.publicacaoId! }, select: { evidencia: true },
      })
      const texto = JSON.stringify(pub.evidencia)
      assert.ok(!texto.includes(SEGREDO))
      for (const proibido of ['accessToken', 'Bearer', 'appSecret']) {
        assert.ok(!texto.includes(proibido))
      }
    })
  }
)

// ── O adapter real, nas portas que fecham antes da rede ─────────────────

describe(
  'Adapter real do Instagram: as recusas que acontecem antes de qualquer rede',
  { skip: !TEM_BANCO ? 'exige Postgres' : false },
  () => {
    test('sem vídeo renderizado: fatal, e nenhuma chamada sai', async () => {
      const r = await adaptadorInstagram.publicar!({
        canal: 'instagram', workspaceId: wsA, publicacaoId: 'x',
        legenda: LEGENDA, urlParaDivulgar: 'https://patrono.exemplo.com.br/api/l/a', assetUrl: null,
      })
      assert.equal(r.ok, false)
      assert.equal(r.fatal, true)
      assert.match(r.erro!, /sem mídia/i)
    })

    test('workspace sem conta conectada: fatal, e nenhuma chamada sai', async () => {
      const r = await adaptadorInstagram.publicar!({
        canal: 'instagram', workspaceId: 'workspace-que-nao-existe', publicacaoId: 'x',
        legenda: LEGENDA, urlParaDivulgar: 'https://patrono.exemplo.com.br/api/l/a',
        assetUrl: 'https://cdn.invalido/v.mp4',
      })
      assert.equal(r.ok, false)
      assert.equal(r.fatal, true)
      assert.match(r.erro!, /não está conectada/i)
    })
  }
)

// ── O ciclo inteiro, sem ninguém chamar função à mão ────────────────────

describe(
  'Do produto ao ensaio de distribuição, sozinho',
  { skip: !TEM_BANCO ? 'exige Postgres' : false },
  () => {
    test('oportunidade → plano → fila → geração → preflight → ensaio', async () => {
      const agora = new Date()

      // 1. Oportunidade: sai do catálogo real, não de palpite.
      const fila = await montarFilaDeOportunidades({
        workspaceId: wsA, agora, canaisCapazes: ['instagram'],
      })
      assert.ok(fila.length >= 1, 'o produto real entra na fila de oportunidades')

      // 2. Plano: sem FFmpeg declarado, o formato escolhido é o que roda
      //    sem capacidade nenhuma — custo R$ 0,00 continua sendo restrição.
      const plano = montarPlanoDeAcao({
        workspaceId: wsA, fila, canaisConectados: ['instagram'], capacidades: {}, agora,
      })
      assert.ok(plano.itens.length >= 1)
      for (const item of plano.itens) assert.equal(item.custoEstimado, 0)

      // 3. Fila: os jobs de geração entram na tabela que já existe.
      const desejados = jobsDeGeracaoDoPlano(wsA, plano.itens)
      const porta = portaPrisma()
      if (desejados.length > 0) {
        const sinc = await sincronizarFilaComPlano({ porta, workspaceId: wsA, desejados, agora })
        assert.ok(sinc.criados + sinc.mantidos >= 1)
      }

      // 4. Executor: roda sozinho, sem capacidade de render declarada.
      const laco = await rodarFilaDoWorkspace({
        porta, workspaceId: wsA, workerId: `noturno-${marca}`,
        capacidades: { ffmpeg: false, chatterbox: false, memoriaLivreBytes: 8 * 1024 ** 3 },
        agora, limite: 5,
      })
      assert.ok(laco.executados >= 0)
      // Nada do laço publica: o executor termina com a peça pronta.
      assert.equal(
        await prisma.publicacao.count({ where: { workspaceId: wsA, chaveDaTentativa: { startsWith: 'auto-' } } }),
        0
      )

      // 5. Preflight da peça que já existe: responde com evidência.
      const pf = await preflightDePublicacao({
        workspaceId: wsA, canal: 'instagram', contentId: conteudoId, env: ENV,
      })
      assert.equal(pf.conectado, true)
      assert.equal(pf.capabilityEfetiva.publicar, true)

      // 6. Ensaio: o ciclo fecha sem enviar nada e sem gravar nada.
      const pubAntes = await prisma.publicacao.count({ where: { workspaceId: wsA } })
      const ensaio = await simularDistribuicao({
        workspaceId: wsA, contentId: conteudoId, canal: 'instagram', env: ENV,
      })
      assert.equal(ensaio.enviouAoCanal, false)
      assert.equal(ensaio.criouPublicacao, false)
      assert.equal(await prisma.publicacao.count({ where: { workspaceId: wsA } }), pubAntes)
      assert.equal(ensaio.acaoQueSeriaTomada, 'PUBLICAR')
    })

    test('o executor não gasta tentativa com o que só uma pessoa destrava', async () => {
      const jobs = await prisma.automationJob.findMany({
        where: { workspaceId: wsA, tipo: 'CONECTAR_CANAL' },
        select: { tentativas: true, estado: true },
      })
      for (const j of jobs) {
        assert.equal(j.tentativas, 0, 'CONECTAR_CANAL nunca consome tentativa automática')
      }
    })

    test('nenhum job de publicação foi criado pelo ciclo', async () => {
      const publicar = await prisma.automationJob.count({
        where: { workspaceId: wsA, tipo: 'DISTRIBUIR_CONTEUDO' },
      })
      assert.equal(publicar, 0, 'o ciclo prepara; distribuir continua sendo outra decisão')
    })
  }
)
