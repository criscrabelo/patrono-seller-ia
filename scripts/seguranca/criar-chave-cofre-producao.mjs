// P2.14.8 — Cria a TOKENS_ENCRYPTION_KEY de PRODUÇÃO (Fase 0B).
//
//   node scripts/seguranca/criar-chave-cofre-producao.mjs <netlify-cli/bin/run.js>                 (SIMULAÇÃO)
//   node scripts/seguranca/criar-chave-cofre-producao.mjs <netlify-cli/bin/run.js> --executar --confirmo=patrono-seller-producao
//
// 1. gera 32 bytes aleatórios (chave NOVA; nunca reaproveita a de teste);
// 2. confere que o kid é diferente do kid da chave de teste;
// (P2.14.9: depois de criada, a cópia foi MOVIDA para fora do OneDrive:
//  %LOCALAPPDATA%\PatronoSeller\cofre-producao\ — é de lá que o envelope lê.)
// 3. grava a cópia de segurança em `.env.producao-cofre` (ignorado pelo git),
//    necessária para cifrar o legado localmente e para o rollback; a titular
//    copia para o cofre pessoal e o arquivo é apagado ao fim da 0B;
// 4. cria a variável SECRETA só no site de PRODUÇÃO da Netlify (escopos
//    builds/functions/runtime, contexto production). Recusa se já existir.
// Nunca imprime a chave: só o kid (8 hex do SHA-256).
import { execFileSync } from 'node:child_process'
import { randomBytes, createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const SITE_PRODUCAO = 'b3b78d78-84e3-4972-a33c-fe47526f5065'
const KID_DE_TESTE = 'bd245124'
const ARQUIVO = '.env.producao-cofre'
const [cli] = process.argv.slice(2)
const executar = process.argv.includes('--executar')
const confirmou = process.argv.includes('--confirmo=patrono-seller-producao')

if (!cli || !existsSync(cli)) throw new Error('Informe o caminho do netlify-cli (bin/run.js).')
const ignorado = (() => { try { execFileSync('git', ['check-ignore', '-q', ARQUIVO]); return true } catch { return false } })()
if (!ignorado) throw new Error(`${ARQUIVO} não está no .gitignore. Abortado.`)
if (existsSync(ARQUIVO)) throw new Error(`${ARQUIVO} já existe: a chave de produção já foi gerada. Nada alterado.`)

const chave = randomBytes(32)
const kid = createHash('sha256').update(chave).digest('hex').slice(0, 8)
if (kid === KID_DE_TESTE) throw new Error('Colisão improvável com a chave de teste. Rode de novo.')

const api = (metodo, dados) => execFileSync(process.execPath, [cli, 'api', metodo, '--data', JSON.stringify(dados)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const existentes = JSON.parse(api('getEnvVars', { account_id: 'criscrabelo', site_id: SITE_PRODUCAO }))
if (existentes.some((v) => v.key === 'TOKENS_ENCRYPTION_KEY')) throw new Error('Produção já tem TOKENS_ENCRYPTION_KEY. Nada alterado.')

if (!executar || !confirmou) {
  console.log(`SIMULACAO: geraria kid=${kid} (≠ teste ${KID_DE_TESTE}), gravaria ${ARQUIVO} e criaria a variável secreta no site de produção. Nada foi gravado.`)
  process.exit(0)
}

writeFileSync(ARQUIVO, `# Cofre de PRODUÇÃO — kid ${kid}. Copie para o seu cofre pessoal e apague este arquivo ao fim da 0B.\nTOKENS_ENCRYPTION_KEY=${chave.toString('hex')}\n`, { mode: 0o600, flag: 'wx' })
api('createEnvVars', {
  account_id: 'criscrabelo',
  site_id: SITE_PRODUCAO,
  body: [{ key: 'TOKENS_ENCRYPTION_KEY', is_secret: true, scopes: ['builds', 'functions', 'runtime'], values: [{ context: 'production', value: chave.toString('hex') }] }],
})
const confere = createHash('sha256').update(Buffer.from(readFileSync(ARQUIVO, 'utf8').match(/TOKENS_ENCRYPTION_KEY=([0-9a-f]{64})/)[1], 'hex')).digest('hex').slice(0, 8)
console.log(`criada: TOKENS_ENCRYPTION_KEY secreta=true kid=${kid} (site de produção) | cópia local ${ARQUIVO} kid=${confere}`)
