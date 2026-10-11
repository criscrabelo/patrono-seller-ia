/**
 * P2.15.6 — Mede os fluxos da Fase 1 com a LATÊNCIA DE PRODUCTION simulada.
 *
 * Production: função Netlify em us-east-2 ↔ banco em sa-east-1 ≈ 375 ms por
 * ida e volta (medido no go-live: 2,25 s por transição de ~6 idas). Aqui cada
 * ida ao banco de TESTE ganha um atraso extra (padrão 275 ms, somando ~100 ms
 * da rede local) — inclusive SQL cru e o BEGIN/COMMIT das transações.
 * Conta consultas e ONDAS (idas sequenciais) por fluxo. Workspace descartável.
 *
 *   node --env-file=<.env de teste> ./node_modules/tsx/dist/cli.mjs scripts/perf/latencia-producao.ts [atrasoMs]
 */
import { PrismaClient } from '@prisma/client'

const ATRASO = Number(process.argv[2] ?? 275)
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))
type Q = { op: string; ini: number; fim: number }
let regs: Q[] = []
// Pool de conexões: cada ida ao banco ocupa uma "conexão" do começo ao fim
// (atraso + execução). Com mais idas simultâneas que o pool, as outras esperam
// — é o que acontece numa função com 3–5 conexões.
const LIMITE_DO_POOL = Number(process.env.PERF_POOL ?? 0) || Infinity
let emUso = 0
const fila: Array<() => void> = []
const pegarConexao = () => (emUso < LIMITE_DO_POOL ? (emUso++, Promise.resolve()) : new Promise<void>((r) => fila.push(() => { emUso++; r() })))
const soltarConexao = () => { emUso--; fila.shift()?.() }
const marcar = async <T>(op: string, fn: () => Promise<T>): Promise<T> => {
  const ini = performance.now()
  await pegarConexao()
  try {
    await dormir(ATRASO)
    return await fn()
  } finally {
    soltarConexao()
    regs.push({ op, ini, fim: performance.now() })
  }
}

// Production: `?pgbouncer=true` sem connection_limit → pool padrão do Prisma
// (CPUs × 2 + 1); numa função Netlify (1–2 vCPU) ≈ 3–5 conexões. PERF_POOL
// reproduz isso (o pool desta máquina é maior e exageraria o paralelismo).
const urlDoBanco = new URL(process.env.DATABASE_URL ?? '')
if (process.env.PERF_POOL) urlDoBanco.searchParams.set('connection_limit', process.env.PERF_POOL)
const base = new PrismaClient({ log: ['error'], datasourceUrl: urlDoBanco.toString() })
const comAtraso = base.$extends({
  query: {
    $allOperations({ model, operation, args, query }) {
      return marcar(`${model ?? 'raw'}.${operation}`, () => query(args))
    },
  },
}) as unknown as PrismaClient
// BEGIN e COMMIT de transação interativa também são idas ao banco.
const txOriginal = comAtraso.$transaction.bind(comAtraso) as (...a: unknown[]) => Promise<unknown>
;(comAtraso as unknown as { $transaction: unknown }).$transaction = async (arg: unknown, opts?: unknown) => {
  if (typeof arg !== 'function') return txOriginal(arg, opts)
  await marcar('tx.BEGIN', async () => undefined)
  const r = await txOriginal(arg, opts)
  await marcar('tx.COMMIT', async () => undefined)
  return r
}
;(globalThis as unknown as { prisma: PrismaClient }).prisma = comAtraso

function ondas(qs: Q[]) {
  const s = [...qs].sort((a, b) => a.ini - b.ini)
  let n = 0
  let fimOnda = -1
  for (const q of s) {
    if (q.ini >= fimOnda) { n++; fimOnda = q.fim } else fimOnda = Math.max(fimOnda, q.fim)
  }
  return n
}

export async function medir(nome: string, fn: () => Promise<unknown>) {
  regs = []
  const t = performance.now()
  await fn()
  const ms = performance.now() - t
  const r = { nome, consultas: regs.length, ondas: ondas(regs), ms: Math.round(ms) }
  if (process.env.PERF_DETALHE && nome.includes(process.env.PERF_DETALHE)) {
    const s = [...regs].sort((a, b) => a.ini - b.ini)
    const t0 = s[0]?.ini ?? 0
    console.log(s.map((q) => `      ${q.op.padEnd(34)} ${(q.ini - t0).toFixed(0).padStart(5)}→${(q.fim - t0).toFixed(0).padStart(5)} ms`).join(String.fromCharCode(10)))
    let n = 0, fimOnda = -1, linha: string[] = []
    const linhas: string[] = []
    for (const q of s) { if (q.ini >= fimOnda) { if (linha.length) linhas.push(`   onda ${n}: ${linha.join(', ')}`); n++; linha = []; fimOnda = q.fim } else fimOnda = Math.max(fimOnda, q.fim); linha.push(q.op) }
    if (linha.length) linhas.push(`   onda ${n}: ${linha.join(', ')}`)
    console.log(linhas.join(String.fromCharCode(10)))
  }
  console.log(`>> ${nome.padEnd(36)} consultas=${String(r.consultas).padStart(3)} ondas=${String(r.ondas).padStart(3)} tempo=${(ms / 1000).toFixed(2)}s`)
  return { ...r, regs: [...regs] }
}

async function main() {
  const { prisma } = await import('../../lib/prisma')
  const { flagLigada } = await import('../../lib/feature-flags')
  const C = await import('../../lib/supervisor/ciclo')
  const CO = await import('../../lib/copilot')
  const CE = await import('../../lib/central')
  const { limparWorkspaceDeTeste } = await import('../../tests/_limpar-workspace-de-teste')
  console.log(`[perf] atraso extra por ida ao banco: ${ATRASO} ms | pool: ${process.env.PERF_POOL ?? 'padrão desta máquina'}`)
  const marca = `perf-${Date.now()}`
  const ws = (await base.workspace.create({ data: { name: 'Conta de Teste — perf P2.15.6', ownerId: marca }, select: { id: true } })).id
  const u = (await base.user.create({ data: { email: `${marca}@teste.local`, name: 'U', password: 'x', workspaceId: ws, status: 'ativo', role: 'admin' }, select: { id: true } })).id
  await base.produto.createMany({ data: Array.from({ length: 22 }, (_, i) => ({ workspaceId: ws, userId: u, nome: `${marca} produto ${i}`, categoria: 'Casa', preco: 50 + i, tipoVenda: 'afiliado', origemConteudo: 'manual', imagens: [], linkProduto: `https://loja.invalido/${i}` })) })
  // a porta das rotas da Fase 1: releitura da sessão (1/min) + flag
  const porta = () => Promise.all([prisma.user.findUnique({ where: { id: u }, select: { workspaceId: true, role: true, status: true, password: true } })]).then(() => flagLigada('COPILOT_DETERMINISTICO', ws))
  try {
    const ciclo1 = await medir('Supervisor: 1º ciclo (cria pedidos)', () => C.executarCiclo({ workspaceId: ws, userId: u, env: {} }))
    await medir('Supervisor: 2º ciclo (pedidos já existem)', () => C.executarCiclo({ workspaceId: ws, userId: u, env: {}, agora: new Date(Date.now() + 1000) }))
    await medir('porta da rota, fria (sessão + flag)', porta)
    for (const q of ['Como está a operação?', 'O que precisa de mim?', 'O que você fez hoje?', 'Por que este produto?'])
      await medir(`Copilot "${q}" (só o comando)`, () => CO.perguntarAoCopilot(q, { workspaceId: ws, userId: u }))
    await medir('Central (só o painel)', () => CE.painelCentral(ws))
    const porOp = new Map<string, number>()
    for (const q of ciclo1.regs) porOp.set(q.op, (porOp.get(q.op) ?? 0) + 1)
    console.log('   1º ciclo por operação:', [...porOp].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(', '))
  } finally {
    await limparWorkspaceDeTeste(base, ws, 'Conta de Teste — ')
    await base.$disconnect()
  }
}
main().catch((e) => { console.log('>> ERRO', e instanceof Error ? e.message.slice(-400) : e); process.exitCode = 1 })
