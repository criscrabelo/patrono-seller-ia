/**
 * Testes de regressão — proteção de rotas e estado zerado.
 *
 * Usa o test runner nativo do Node (`node --test`): nenhuma dependência nova,
 * nenhum custo. Roda contra um servidor já em pé.
 *
 *   BASE_URL=http://localhost:3100 npm run test:rotas
 *
 * Por que existe: a versão anterior do middleware listava as telas protegidas
 * uma a uma, e sete áreas ficaram públicas sem ninguém perceber. Estes testes
 * falham se isso voltar a acontecer.
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'

const BASE = process.env.BASE_URL ?? 'http://localhost:3100'

// Toda tela que exige sessão. Ao criar uma tela nova, acrescente aqui.
const TELAS_PROTEGIDAS = [
  '/dashboard', '/produtos', '/produtos/novo', '/produtos/imagens',
  '/conteudos', '/conteudos/gerar', '/aprovacao', '/calendario',
  '/relatorios', '/video-seller', '/links', '/monetizacao',
  '/integracoes', '/integracoes/shopee', '/whatsapp', '/videos',
  '/conta', '/admin/usuarios', '/admin/permissoes',
]

const APIS_PROTEGIDAS = [
  '/api/produtos', '/api/links', '/api/integracoes', '/api/conteudos',
  '/api/metricas', '/api/permissoes', '/api/admin/usuarios',
  '/api/admin/permissoes', '/api/video-seller',
]

const PUBLICAS = [
  '/login', '/register', '/esqueci-senha', '/redefinir-senha',
  '/api/auth/providers', '/api/auth/csrf',
]

const sem = (url) => fetch(BASE + url, { redirect: 'manual' })

before(async () => {
  const r = await fetch(BASE + '/login').catch(() => null)
  if (!r?.ok) {
    throw new Error(
      `Servidor não respondeu em ${BASE}. Suba o app antes: npm run build && npm start`
    )
  }
})

describe('Sem sessão', () => {
  for (const rota of TELAS_PROTEGIDAS) {
    test(`${rota} redireciona para /login`, async () => {
      const r = await sem(rota)
      assert.equal(r.status, 307, `${rota} deveria redirecionar`)
      const destino = r.headers.get('location') ?? ''
      assert.ok(
        destino.includes('/login'),
        `${rota} redirecionou para "${destino}" em vez de /login`
      )
    })
  }

  for (const rota of APIS_PROTEGIDAS) {
    test(`${rota} responde 401 em JSON`, async () => {
      const r = await sem(rota)
      assert.equal(r.status, 401, `${rota} deveria responder 401`)

      // Precisa ser JSON: um `fetch()` do navegador que receba HTML aqui
      // quebraria no res.json() e mostraria erro técnico para a usuária.
      const tipo = r.headers.get('content-type') ?? ''
      assert.ok(tipo.includes('application/json'), `${rota} respondeu ${tipo}`)

      const corpo = await r.json()
      assert.ok(typeof corpo.error === 'string' && corpo.error.length > 0)
      // A mensagem é lida por uma pessoa — nada de stack trace ou código cru.
      assert.ok(!/at \w+|Error:|undefined|null/.test(corpo.error), corpo.error)
    })
  }

  for (const rota of PUBLICAS) {
    test(`${rota} continua acessível`, async () => {
      const r = await fetch(BASE + rota)
      assert.equal(r.status, 200, `${rota} deveria ser pública`)
    })
  }
})

describe('Link de afiliada (/api/l/:slug)', () => {
  test('funciona sem sessão — é o link que vai para o público', async () => {
    const r = await sem('/api/l/__inexistente__')
    // O importante: NÃO cai na tela de login. Slug inválido pode dar 404 ou
    // redirecionar para a home, mas nunca exigir sessão.
    assert.notEqual(r.status, 401, 'link público não pode exigir sessão')
    const destino = r.headers.get('location') ?? ''
    assert.ok(!destino.includes('/login'), `redirecionou para login: ${destino}`)
  })
})
