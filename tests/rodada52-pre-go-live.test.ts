/**
 * P2.5 — Correções pré-go-live.
 *
 *   1. Links: uma função central de base pública; produção nunca gera
 *      localhost; slug preservado; sem barra dupla; domínio respeitado.
 *   2. TikTok: webhook público por caminho EXATO, recusando o inválido
 *      antes de qualquer escrita; callback do Shop reservado e bloqueado.
 *   3. IA: chave injetada pela plataforma não libera nem desvia chamada.
 *   4. Preview/teste nunca abrem o banco de produção.
 *
 * Sem banco, sem rede, sem credencial real. Custo R$ 0,00.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'
import {
  lerBasePublica,
  basePublicaParaExibir,
  urlRastreadaParaExibir,
  montarUrlRastreada,
} from '../lib/link-de-publicacao'
import { lerCabecalhoDeAssinatura, TAMANHO_MAXIMO_DO_CORPO } from '../lib/tiktok-webhook'
import { bancoPermitidoNoAmbiente, contextoDeImplantacao } from '../lib/guarda-de-ambiente'
import { lerPoliticaDeCusto, avaliarCusto } from '../lib/cost-safety-gate'

const RAIZ = join(__dirname, '..')
const lerCodigo = (rel: string) =>
  readFileSync(join(RAIZ, rel), 'utf8')
    .split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')

const LOCAIS = /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/

// ── 1. Links ────────────────────────────────────────────────────────────

describe('Base pública: uma função central', () => {
  test('PUBLIC_BASE_URL vence; NEXTAUTH_URL é a segunda opção', () => {
    const r = lerBasePublica({ PUBLIC_BASE_URL: 'https://patrono.com.br', NEXTAUTH_URL: 'https://outro.com.br' })
    assert.deepEqual(r, { ok: true, baseUrl: 'https://patrono.com.br' })
    assert.deepEqual(lerBasePublica({ NEXTAUTH_URL: 'https://outro.com.br' }), { ok: true, baseUrl: 'https://outro.com.br' })
  })

  test('PUBLIC_BASE_URL vazia não esconde o NEXTAUTH_URL', () => {
    assert.deepEqual(lerBasePublica({ PUBLIC_BASE_URL: '  ', NEXTAUTH_URL: 'https://outro.com.br' }), { ok: true, baseUrl: 'https://outro.com.br' })
  })

  test('produção NUNCA gera localhost — em nenhuma combinação', () => {
    const configs: Record<string, string | undefined>[] = [
      {},
      { PUBLIC_BASE_URL: 'http://localhost:3000' },
      { NEXTAUTH_URL: 'http://localhost:3000' },
      { PUBLIC_BASE_URL: 'http://127.0.0.1:3000', NEXTAUTH_URL: 'http://localhost' },
      { PUBLIC_BASE_URL: '', NEXTAUTH_URL: 'http://[::1]:3000' },
      { PUBLIC_BASE_URL: 'http://maquina.local' },
    ]
    for (const NODE_ENV of ['production', 'test', undefined]) {
      for (const c of configs) {
        const env = { ...c, NODE_ENV }
        const r = urlRastreadaParaExibir('abc123', env)
        assert.equal(r.url, null, `${JSON.stringify(env)} gerou ${r.url}`)
        assert.ok(r.motivo, 'sem link, o motivo vai para a tela')
        const base = basePublicaParaExibir(env, 'http://localhost:3000')
        assert.equal(base.ok, false, `${JSON.stringify(env)} aceitou base local fora de desenvolvimento`)
      }
    }
  })

  test('domínio configurado é respeitado, com slug preservado e sem barra dupla', () => {
    for (const base of ['https://patrono.com.br', 'https://patrono.com.br/', 'https://patrono.com.br///']) {
      const r = urlRastreadaParaExibir('k7x2m9q4w1ab', { NODE_ENV: 'production', PUBLIC_BASE_URL: base })
      assert.equal(r.url, 'https://patrono.com.br/api/l/k7x2m9q4w1ab')
      assert.equal(r.local, false)
    }
    // Base com caminho (app atrás de um prefixo) também não duplica barra.
    const comCaminho = urlRastreadaParaExibir('abc', { NODE_ENV: 'production', PUBLIC_BASE_URL: 'https://x.com.br/app/' })
    assert.equal(comCaminho.url, 'https://x.com.br/app/api/l/abc')
    assert.ok(!/[^:]\/\//.test(comCaminho.url!), 'barra dupla no caminho')
  })

  test('slug é preservado e não vira outro caminho', () => {
    assert.equal(montarUrlRastreada('https://p.com.br', 'Abc-123_x'), 'https://p.com.br/api/l/Abc-123_x')
    assert.equal(montarUrlRastreada('https://p.com.br', '../admin'), 'https://p.com.br/api/l/..%2Fadmin')
  })

  test('em DESENVOLVIMENTO, e só nele, o endereço local é aceito e marcado', () => {
    const semNada = urlRastreadaParaExibir('abc', { NODE_ENV: 'development' })
    assert.equal(semNada.url, 'http://localhost:3000/api/l/abc')
    assert.equal(semNada.local, true)
    const configurada = urlRastreadaParaExibir('abc', { NODE_ENV: 'development', NEXTAUTH_URL: 'http://localhost:3100' })
    assert.equal(configurada.url, 'http://localhost:3100/api/l/abc')
    const origem = basePublicaParaExibir({ NODE_ENV: 'development' }, 'http://localhost:4000')
    assert.deepEqual(origem, { ok: true, baseUrl: 'http://localhost:4000', local: true })
    // Domínio público em desenvolvimento não é marcado como local.
    assert.equal(urlRastreadaParaExibir('abc', { NODE_ENV: 'development', PUBLIC_BASE_URL: 'https://p.com.br' }).local, false)
  })

  test('a publicação continua estrita: post nunca leva localhost, nem em desenvolvimento', () => {
    assert.equal(lerBasePublica({ NODE_ENV: 'development', NEXTAUTH_URL: 'http://localhost:3000' }).ok, false)
  })

  test('a tela de Links usa a URL montada no servidor — sem localhost, sem domínio inventado', () => {
    const tela = lerCodigo('app/(dashboard)/links/page.tsx')
    assert.ok(!LOCAIS.test(tela), 'a tela ainda tem endereço local fixo')
    assert.ok(!/patrono\.link/.test(tela), 'domínio que não é do Patrono')
    assert.match(tela, /<CopyBtn text=\{link\.urlPublica\} \/>/)
    const api = lerCodigo('app/api/links/route.ts')
    assert.match(api, /urlRastreadaParaExibir\(link\.slug\)/)
  })

  test('recuperação de senha usa a função central e não confia no Host em produção', () => {
    const rota = lerCodigo('app/api/auth/esqueci-senha/route.ts')
    assert.match(rota, /basePublicaParaExibir\(process\.env, new URL\(req\.url\)\.origin\)/)
    assert.ok(!/process\.env\.NEXTAUTH_URL \|\|/.test(rota), 'voltou a montar a origem à mão')
    // Em produção, sem base configurada, a origem da requisição NÃO é usada.
    assert.equal(basePublicaParaExibir({ NODE_ENV: 'production' }, 'https://atacante.example').ok, false)
  })

  test('nenhuma tela ou rota tem endereço local fixo', () => {
    const achados: string[] = []
    const varrer = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n)
        if (statSync(p).isDirectory()) varrer(p)
        else if (/\.(ts|tsx)$/.test(n) && LOCAIS.test(lerCodigo(p.slice(RAIZ.length + 1)))) achados.push(p.slice(RAIZ.length + 1))
      }
    }
    varrer(join(RAIZ, 'app'))
    assert.deepEqual(achados, [])
  })
})

// ── 2. Middleware: exceções exatas ───────────────────────────────────────

describe('Middleware: só o webhook do TikTok vira público, por caminho exato', () => {
  process.env.NEXTAUTH_SECRET ??= 'segredo-de-teste-r52'

  const passar = async (caminho: string) => {
    const { default: middleware } = await import('../middleware')
    const r = await middleware(new NextRequest(`https://p.com.br${caminho}`, { method: 'POST' }))
    return r.headers.get('x-middleware-next') === '1' ? 'PASSA' : String(r.status)
  }

  test('o webhook do TikTok passa sem sessão', async () => {
    assert.equal(await passar('/api/webhooks/tiktok'), 'PASSA')
  })

  test('nada parecido passa: sem prefixo, sem bypass de /api', async () => {
    for (const c of [
      '/api/webhooks',
      '/api/webhooks/',
      '/api/webhooks/outro',
      '/api/webhooks/tiktok-falso',
      '/api/webhooks/tiktokx',
      '/api/webhooks/tiktok/extra',
      '/api/integracoes/tiktok-shop/oauth/callback',
      '/api/integracoes/tiktok/oauth/callback',
      '/api/produtos',
    ]) {
      assert.equal(await passar(c), '401', `${c} ficou público`)
    }
  })

  test('a lista é exata e os prefixos de sempre não mudaram', () => {
    const m = lerCodigo('middleware.ts')
    assert.match(m, /const ROTAS_API_PUBLICAS_EXATAS = \['\/api\/webhooks\/tiktok'\]/)
    assert.match(m, /ROTAS_API_PUBLICAS_EXATAS\.includes\(pathname\)/)
    assert.match(m, /const PREFIXOS_API_PUBLICOS = \['\/api\/auth', '\/api\/l\/', '\/api\/cron'\]/)
  })
})

// ── 3. Webhook do TikTok ────────────────────────────────────────────────

describe('Webhook do TikTok: formato oficial, recusa antes de qualquer escrita', () => {
  const SECRET = 'client-secret-de-teste'
  const assinar = (t: string, corpo: string) => createHmac('sha256', SECRET).update(`${t}.${corpo}`).digest('hex')
  const agora = () => String(Math.floor(Date.now() / 1000))
  const enviar = async (corpo: string, headers: Record<string, string>) => {
    const { POST } = await import('../app/api/webhooks/tiktok/route')
    return POST(new NextRequest('https://p.com.br/api/webhooks/tiktok', { method: 'POST', body: corpo, headers }))
  }

  test('lê o cabeçalho oficial `t=...,s=...`', () => {
    const s = 'a'.repeat(64)
    assert.deepEqual(lerCabecalhoDeAssinatura(`t=1633174587,s=${s}`), { timestamp: '1633174587', assinatura: s })
    assert.deepEqual(lerCabecalhoDeAssinatura(` t=1633174587 , s=${s.toUpperCase()} `), { timestamp: '1633174587', assinatura: s })
    for (const ruim of [null, '', 'abc', `s=${s}`, 't=1633174587', `t=abc,s=${s}`, 't=1633174587,s=xyz', `t=1,s=${s}`, `t=1633174587,s=${s},t=1633174588`]) {
      assert.equal(lerCabecalhoDeAssinatura(ruim), null, String(ruim))
    }
  })

  test('sem segredo configurado, recusa', async () => {
    delete process.env.TIKTOK_CLIENT_SECRET
    const r = await enviar('{}', { 'tiktok-signature': `t=${agora()},s=${'a'.repeat(64)}` })
    assert.equal(r.status, 400)
  })

  test('cabeçalho ausente, separado (formato antigo) ou malformado: 401', async () => {
    process.env.TIKTOK_CLIENT_SECRET = SECRET
    const corpo = JSON.stringify({ event: 'x', client_key: 'k', create_time: 1, user_openid: 'u' })
    const t = agora()
    assert.equal((await enviar(corpo, {})).status, 401)
    assert.equal((await enviar(corpo, { 'tiktok-signature': assinar(t, corpo), 'tiktok-timestamp': t })).status, 401)
    assert.equal((await enviar(corpo, { 'tiktok-signature': 'lixo' })).status, 401)
  })

  test('assinatura errada ou evento antigo: 401', async () => {
    process.env.TIKTOK_CLIENT_SECRET = SECRET
    const corpo = JSON.stringify({ event: 'x', client_key: 'k', create_time: 2, user_openid: 'u' })
    const t = agora()
    assert.equal((await enviar(corpo, { 'tiktok-signature': `t=${t},s=${'0'.repeat(64)}` })).status, 401)
    const velho = String(Math.floor(Date.now() / 1000) - 3600)
    assert.equal((await enviar(corpo, { 'tiktok-signature': `t=${velho},s=${assinar(velho, corpo)}` })).status, 401)
  })

  test('corpo grande demais: 413', async () => {
    process.env.TIKTOK_CLIENT_SECRET = SECRET
    const corpo = 'x'.repeat(TAMANHO_MAXIMO_DO_CORPO + 1)
    const t = agora()
    assert.equal((await enviar(corpo, { 'tiktok-signature': `t=${t},s=${assinar(t, corpo)}` })).status, 413)
  })

  test('evento legítimo no formato oficial é aceito, e o repetido é reconhecido', async () => {
    process.env.TIKTOK_CLIENT_SECRET = SECRET
    const corpo = JSON.stringify({ event: 'post.publish.complete', client_key: 'k', create_time: 3, user_openid: 'u' })
    const t = agora()
    const r1 = await enviar(corpo, { 'tiktok-signature': `t=${t},s=${assinar(t, corpo)}` })
    assert.equal(r1.status, 200)
    const r2 = await enviar(corpo, { 'tiktok-signature': `t=${t},s=${assinar(t, corpo)}` })
    assert.equal((await r2.json()).duplicado, true)
    delete process.env.TIKTOK_CLIENT_SECRET
  })

  test('o caminho público não grava nada: sem banco na rota nem no processamento', () => {
    for (const f of ['app/api/webhooks/tiktok/route.ts', 'lib/tiktok-webhook.ts']) {
      const src = lerCodigo(f)
      // Banco e auditoria: nenhum import, nenhuma chamada. (O `.update` do
      // HMAC é criptografia, não escrita.)
      assert.ok(!/prisma|registrarAuditoria|audit-log|\.(create|upsert|delete)(Many)?\(/.test(src), `${f} escreve`)
    }
    // A recusa pelo cabeçalho vem antes de ler o corpo.
    const rota = lerCodigo('app/api/webhooks/tiktok/route.ts')
    assert.ok(rota.indexOf('lerCabecalhoDeAssinatura(') < rota.indexOf('await req.text()'))
  })
})

describe('Callback do TikTok Shop: reservado e bloqueado', () => {
  test('responde 501 sem ler código, sem rede, sem banco, sem credencial', async () => {
    const { GET } = await import('../app/api/integracoes/tiktok-shop/oauth/callback/route')
    const r = await GET()
    assert.equal(r.status, 501)
    assert.equal((await r.json()).bloqueio, 'TIKTOK_SHOP_OAUTH_NAO_IMPLEMENTADO')
    const src = lerCodigo('app/api/integracoes/tiktok-shop/oauth/callback/route.ts')
    assert.ok(!/searchParams|fetch\(|prisma|process\.env|console\./.test(src))
  })
})

// ── 4. IA ───────────────────────────────────────────────────────────────

describe('IA: chave injetada pela plataforma não libera nem desvia', () => {
  test('presença de chave (inclusive a do AI Gateway) não habilita custo', () => {
    for (const env of [
      { ANTHROPIC_API_KEY: 'chave-injetada', ANTHROPIC_BASE_URL: 'https://gateway.invalido' },
      { ANTHROPIC_API_KEY: 'x', NETLIFY_AI_GATEWAY_KEY: 'y', AI_MONTHLY_BUDGET: '50' },
      { PAID_AI_ENABLED: 'true', ANTHROPIC_API_KEY: 'x' },
    ]) {
      const d = avaliarCusto({
        provider: 'anthropic', operacao: 'gerar-roteiro', workspaceId: 'w', custoEstimado: 0.05, gastoAcumulado: 0,
        politica: lerPoliticaDeCusto(env),
      })
      assert.equal(d.permitido, false, JSON.stringify(env))
    }
  })

  test('o cliente da Anthropic tem o endereço oficial fixo', () => {
    const src = lerCodigo('lib/claude.ts')
    assert.match(src, /export const ENDERECO_DA_ANTHROPIC = 'https:\/\/api\.anthropic\.com'/)
    assert.match(src, /new Anthropic\(\{\s*apiKey: process\.env\.ANTHROPIC_API_KEY,\s*baseURL: ENDERECO_DA_ANTHROPIC,\s*\}\)/)
    // E não há outro cliente de IA no projeto.
    for (const f of ['lib', 'app']) {
      const achados: string[] = []
      const varrer = (dir: string) => {
        for (const n of readdirSync(dir)) {
          const p = join(dir, n)
          if (statSync(p).isDirectory()) varrer(p)
          else if (/\.(ts|tsx)$/.test(n) && /new Anthropic\(|new OpenAI\(/.test(readFileSync(p, 'utf8'))) achados.push(n)
        }
      }
      varrer(join(RAIZ, f))
      assert.deepEqual(achados, f === 'lib' ? ['claude.ts'] : [])
    }
  })
})

// ── 5. Preview × produção ───────────────────────────────────────────────

describe('Preview e teste nunca abrem o banco de produção', () => {
  const REF = 'refdeprod0123'
  const PROD = `postgresql://u:p@pooler.exemplo:6543/postgres?ref=${REF}`
  const TESTE = 'postgresql://u:p@pooler.exemplo:6543/postgres?ref=refdeteste99'

  test('sem a referência configurada, a trava fica inerte (nada muda hoje)', () => {
    assert.deepEqual(bancoPermitidoNoAmbiente({ DATABASE_URL: PROD, VERCEL_ENV: 'preview' }), { ok: true, trava: 'inerte' })
  })

  test('com a referência: banco de produção só em produção explícita', () => {
    const base = { DATABASE_URL: PROD, PATRONO_REF_DO_BANCO_DE_PRODUCAO: REF }
    assert.equal(bancoPermitidoNoAmbiente({ ...base, VERCEL_ENV: 'production' }).ok, true)
    assert.equal(bancoPermitidoNoAmbiente({ ...base, CONTEXT: 'production' }).ok, true)
    assert.equal(bancoPermitidoNoAmbiente({ ...base, PATRONO_AMBIENTE: 'producao' }).ok, true)
    for (const ctx of [{ VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' }, { CONTEXT: 'deploy-preview' }, { CONTEXT: 'branch-deploy' }, { PATRONO_AMBIENTE: 'teste' }, {}]) {
      assert.equal(bancoPermitidoNoAmbiente({ ...base, ...ctx }).ok, false, JSON.stringify(ctx))
    }
    // O explícito vence o da plataforma, nos dois sentidos.
    assert.equal(bancoPermitidoNoAmbiente({ ...base, PATRONO_AMBIENTE: 'teste', VERCEL_ENV: 'production' }).ok, false)
    assert.equal(contextoDeImplantacao({ PATRONO_AMBIENTE: 'producao', CONTEXT: 'deploy-preview' }), 'producao')
  })

  test('banco de teste em preview segue normal', () => {
    assert.equal(bancoPermitidoNoAmbiente({ DATABASE_URL: TESTE, PATRONO_REF_DO_BANCO_DE_PRODUCAO: REF, VERCEL_ENV: 'preview' }).ok, true)
  })

  test('referência curta demais não vira passe livre', () => {
    assert.equal(bancoPermitidoNoAmbiente({ DATABASE_URL: PROD, PATRONO_REF_DO_BANCO_DE_PRODUCAO: 'ref', VERCEL_ENV: 'production' }).ok, false)
  })

  test('a trava roda ANTES de o Prisma existir', () => {
    const src = lerCodigo('lib/prisma.ts')
    assert.ok(src.indexOf('bancoPermitidoNoAmbiente(process.env)') < src.indexOf('new PrismaClient('))
    assert.match(src, /if \(!veredito\.ok\) throw/)
  })
})
