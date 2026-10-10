/**
 * P2.14.8 — Scripts do cofre usados na 0B: cifrar o legado e o ROLLBACK
 * (decifrar de volta). Trava de banco: teste por padrão; produção só com
 * --producao e a ref confirmada.
 *
 * Com banco de TESTE: cria uma integração com segredos em TEXTO PURO (como
 * a produção tem hoje), roda o script de cifrar, confere `enc:v1` na linha
 * crua e leitura correta pelo app; roda o rollback, confere texto puro de
 * volta e idêntico ao original. Limpa tudo. Custo R$ 0,00.
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { exigirBancoAutorizado, REF_PRODUCAO, REF_TESTE } from '../scripts/seguranca/_banco-autorizado'
import { cofreConfigurado, estaCifrado } from '../lib/cofre'

const URL_TESTE = `postgresql://u:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?user=postgres.${REF_TESTE}`
const URL_PROD = `postgresql://u:p@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?user=postgres.${REF_PRODUCAO}`

describe('Trava de banco dos scripts do cofre (pura)', () => {
  test('teste passa sem flags; --producao no teste é recusado', () => {
    assert.equal(exigirBancoAutorizado({ DATABASE_URL: URL_TESTE, DIRECT_URL: URL_TESTE }, []), 'TESTE')
    assert.throws(() => exigirBancoAutorizado({ DATABASE_URL: URL_TESTE }, ['--producao']), /TESTE/)
  })
  test('produção exige --producao E --confirmo=<ref> exata', () => {
    assert.throws(() => exigirBancoAutorizado({ DATABASE_URL: URL_PROD }, []), /sem --producao/)
    assert.throws(() => exigirBancoAutorizado({ DATABASE_URL: URL_PROD }, ['--producao']), /Confirmação/)
    assert.throws(() => exigirBancoAutorizado({ DATABASE_URL: URL_PROD }, ['--producao', '--confirmo=outra']), /Confirmação/)
    assert.equal(exigirBancoAutorizado({ DATABASE_URL: URL_PROD, DIRECT_URL: URL_PROD }, ['--producao', `--confirmo=${REF_PRODUCAO}`]), 'PRODUCAO')
  })
  test('banco desconhecido, ausente ou misturado é recusado', () => {
    assert.throws(() => exigirBancoAutorizado({ DATABASE_URL: 'postgresql://u:p@outro:5432/db' }, []), /não reconhecido/)
    assert.throws(() => exigirBancoAutorizado({}, []), /ausente/)
    assert.throws(() => exigirBancoAutorizado({ DATABASE_URL: URL_PROD, DIRECT_URL: URL_TESTE }, ['--producao', `--confirmo=${REF_PRODUCAO}`]), /misturam/)
  })
})

const TEM_BANCO = !!process.env.DATABASE_URL && (process.env.DATABASE_URL ?? '').includes(REF_TESTE) && cofreConfigurado()

describe('Cifrar legado e rollback (banco de teste)', { skip: !TEM_BANCO ? 'exige banco de TESTE e TOKENS_ENCRYPTION_KEY' : false }, () => {
  let prisma: typeof import('../lib/prisma').prisma
  let limpar: typeof import('./_limpar-workspace-de-teste').limparWorkspaceDeTeste
  const PREFIXO = 'Conta de Teste — '
  const marca = `r66-${Date.now()}`
  let ws = ''
  let integracaoId = ''
  const ORIGINAL = { access: `acc-${marca}`, refresh: `ref-${marca}`, appSecret: `app-${marca}` }

  const rodar = (script: string, ...args: string[]) => {
    const r = spawnSync(process.execPath, [join(__dirname, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(__dirname, '..', 'scripts', 'seguranca', script), `--workspace=${ws}`, ...args], { encoding: 'utf8', env: process.env, timeout: 120_000 })
    assert.equal(r.status, 0, r.stderr)
    // O script nunca imprime segredo.
    for (const v of Object.values(ORIGINAL)) assert.ok(!(r.stdout + r.stderr).includes(v), 'script imprimiu segredo')
    return JSON.parse(r.stdout)
  }
  const cru = async () => {
    const [l] = await prisma.$queryRaw<{ accessToken: string; refreshToken: string; extraData: Record<string, string> }[]>`
      SELECT "accessToken", "refreshToken", "extraData" FROM "Integracao" WHERE "id" = ${integracaoId}`
    return l
  }

  before(async () => {
    ;({ prisma } = await import('../lib/prisma'))
    ;({ limparWorkspaceDeTeste: limpar } = await import('./_limpar-workspace-de-teste'))
    ws = (await prisma.workspace.create({ data: { name: `${PREFIXO}Scripts do Cofre`, ownerId: marca }, select: { id: true } })).id
    const user = (await prisma.user.create({ data: { email: `${marca}@teste.local`, name: 'U', password: 'x', workspaceId: ws }, select: { id: true } })).id
    integracaoId = `${marca}-int`
    // Legado: grava em TEXTO PURO por SQL cru, como a produção está hoje.
    await prisma.$executeRaw`
      INSERT INTO "Integracao" ("id","workspaceId","userId","plataforma","status","accessToken","refreshToken","extraData","createdAt","updatedAt")
      VALUES (${integracaoId}, ${ws}, ${user}, 'instagram', 'conectado', ${ORIGINAL.access}, ${ORIGINAL.refresh},
              ${JSON.stringify({ appId: '123', appSecret: ORIGINAL.appSecret })}::jsonb, now(), now())`
  })

  after(async () => {
    if (prisma) await limpar(prisma, ws, PREFIXO)
    await prisma?.$disconnect()
  })

  test('simulação não grava nada', async () => {
    const r = rodar('cifrar-tokens-existentes.ts')
    assert.equal(r.banco, 'TESTE')
    assert.equal(r.modo, 'SIMULACAO')
    assert.equal(r.linhasQuePrecisam, 1)
    assert.equal((await cru()).accessToken, ORIGINAL.access)
  })

  test('cifrar: linha crua vira enc:v1; o app lê os valores originais; nada em texto puro', async () => {
    const r = rodar('cifrar-tokens-existentes.ts', '--aplicar')
    assert.equal(r.gravadas, 1)
    assert.deepEqual(r.textoPuroRestante, { accessToken: 0, refreshToken: 0, extraDataLinhas: 0 })
    const l = await cru()
    assert.ok(estaCifrado(l.accessToken) && estaCifrado(l.refreshToken) && estaCifrado(l.extraData.appSecret))
    assert.equal(l.extraData.appId, '123')
    const app = await prisma.integracao.findUniqueOrThrow({ where: { id: integracaoId } })
    assert.equal(app.accessToken, ORIGINAL.access)
    assert.equal(app.refreshToken, ORIGINAL.refresh)
    assert.equal((app.extraData as Record<string, string>).appSecret, ORIGINAL.appSecret)
    // Idempotente: rodar de novo não regrava.
    assert.equal(rodar('cifrar-tokens-existentes.ts', '--aplicar').gravadas, 0)
  })

  test('rollback: decifra de volta para o texto original exato', async () => {
    const sim = rodar('decifrar-tokens-rollback.ts')
    assert.equal(sim.linhasADecifrar, 1)
    assert.ok(estaCifrado((await cru()).accessToken), 'simulação não pode gravar')
    const r = rodar('decifrar-tokens-rollback.ts', '--aplicar')
    assert.equal(r.gravadas, 1)
    assert.equal(r.linhasAindaCifradas, 0)
    const l = await cru()
    assert.equal(l.accessToken, ORIGINAL.access)
    assert.equal(l.refreshToken, ORIGINAL.refresh)
    assert.equal(l.extraData.appSecret, ORIGINAL.appSecret)
  })

  test('rollback sem a chave aborta sem tocar em nada', async () => {
    rodar('cifrar-tokens-existentes.ts', '--aplicar')
    const antes = await cru()
    const r = spawnSync(process.execPath, [join(__dirname, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(__dirname, '..', 'scripts', 'seguranca', 'decifrar-tokens-rollback.ts'), `--workspace=${ws}`, '--aplicar'], {
      encoding: 'utf8', env: { ...process.env, TOKENS_ENCRYPTION_KEY: '' }, timeout: 120_000,
    })
    assert.notEqual(r.status, 0)
    assert.deepEqual(await cru(), antes)
  })
})
