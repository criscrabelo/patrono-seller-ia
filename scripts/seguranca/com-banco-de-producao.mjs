// P2.14.8 — Roda UM comando com a conexão de PRODUÇÃO, montada em memória.
//
//   node scripts/seguranca/com-banco-de-producao.mjs --confirmo=aftqchhuknsqijsengoo [--cofre] -- <comando> [args...]
//
// - Lê a senha de `.env.local` (DATABASE_URL de produção) e monta a URL do
//   pooler de SESSÃO (aws-1-sa-east-1:5432, IPv4) — o host direto `db.<ref>`
//   só responde por IPv6 e não é alcançável desta rede.
// - DATABASE_URL e DIRECT_URL apontam para o mesmo pooler de sessão.
// - `--cofre` também carrega TOKENS_ENCRYPTION_KEY da cópia local da chave de
//   produção: %LOCALAPPDATA%\PatronoSeller\cofre-producao\.env.producao-cofre
//   (FORA do OneDrive — a pasta do projeto é sincronizada). Outro caminho só
//   via PATRONO_ARQUIVO_COFRE.
// - Nada é impresso além da saída do comando, com URLs de banco mascaradas.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const REF = 'aftqchhuknsqijsengoo'
const i = process.argv.indexOf('--')
if (i < 0 || i === process.argv.length - 1) throw new Error('Uso: ... -- <comando> [args]')
if (!process.argv.slice(2, i).includes(`--confirmo=${REF}`)) throw new Error('Confirmação de produção ausente (--confirmo=<ref>). Abortado.')

const lerEnv = (arq) => Object.fromEntries(readFileSync(arq, 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]))
const local = lerEnv('.env.local')
const origem = new URL(local.DATABASE_URL)
if (!origem.hostname.includes(REF) && !decodeURIComponent(origem.username).includes(REF)) throw new Error('.env.local não aponta para produção. Abortado.')
const url = new URL('postgresql://x@aws-1-sa-east-1.pooler.supabase.com:5432/postgres')
url.username = `postgres.${REF}`
url.password = origem.password

const env = { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString() }
if (process.argv.slice(2, i).includes('--cofre')) {
  const arquivo = process.env.PATRONO_ARQUIVO_COFRE || join(process.env.LOCALAPPDATA ?? '', 'PatronoSeller', 'cofre-producao', '.env.producao-cofre')
  if (/onedrive/i.test(arquivo)) throw new Error('A cópia da chave não pode ficar em pasta sincronizada (OneDrive). Abortado.')
  const c = lerEnv(arquivo).TOKENS_ENCRYPTION_KEY
  if (!/^[0-9a-f]{64}$/.test(c ?? '')) throw new Error('Cópia da chave de produção ausente ou inválida. Abortado.')
  env.TOKENS_ENCRYPTION_KEY = c
  delete env.TOKENS_ENCRYPTION_KEY_ANTERIOR
}
const [cmd, ...args] = process.argv.slice(i + 1)
const r = spawnSync(cmd === 'node' ? process.execPath : cmd, args, { encoding: 'utf8', env, timeout: 600_000 })
const mascarar = (t) => (t ?? '').replace(/postgres(ql)?:\/\/\S+/g, '[url-do-banco]')
process.stdout.write(mascarar(r.stdout))
process.stderr.write(mascarar(r.stderr))
process.exit(r.status ?? 1)
