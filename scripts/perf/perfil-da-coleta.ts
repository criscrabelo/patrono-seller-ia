/**
 * P2.15 — Perfil da coleta da curadoria (banco de TESTE).
 *
 *   node --env-file="$LOCALAPPDATA/PatronoSeller/teste/.env.digital-twin-test" ./node_modules/tsx/dist/cli.mjs scripts/perf/perfil-da-coleta.ts [latenciaMs=125]
 *
 * Cria um workspace descartável com 22 produtos, roda UMA coleta com um
 * cliente Prisma instrumentado que soma `latenciaMs` a cada ida ao banco
 * (simula Netlify us-east-2 → Supabase sa-east-1) e mede:
 *   - total de consultas;
 *   - "ondas" sequenciais (consultas que não se sobrepõem no tempo);
 *   - tempo total.
 * Apaga tudo o que criou. Recusa banco que não seja o de teste.
 */
import { PrismaClient } from '@prisma/client'

const latencia = Number(process.argv[2] ?? 125)
if (!(process.env.DATABASE_URL ?? '').includes('xntkypjmmdovrfbblbqb')) throw new Error('só banco de TESTE')

type Registro = { op: string; ini: number; fim: number }
const registros: Registro[] = []
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

const base = new PrismaClient()
const instrumentado = base.$extends({
  query: {
    async $allOperations({ model, operation, args, query }) {
      const ini = performance.now()
      await espera(latencia)
      const r = await query(args)
      registros.push({ op: `${model ?? 'raw'}.${operation}`, ini, fim: performance.now() })
      return r
    },
  },
})
;(globalThis as unknown as { prisma: unknown }).prisma = instrumentado

async function main() {
  const { limparWorkspaceDeTeste } = await import('../../tests/_limpar-workspace-de-teste')
  const { coletarCandidatos } = await import('../../lib/curadoria')
  const PREFIXO = 'Conta de Teste — '
  const ws = (await base.workspace.create({ data: { name: `${PREFIXO}Perfil da coleta`, ownerId: `perf-${Date.now()}` }, select: { id: true } })).id
  try {
    const user = (await base.user.create({ data: { email: `perf-${Date.now()}@teste.local`, name: 'U', password: 'x', workspaceId: ws }, select: { id: true } })).id
    const categorias = ['Casa e Decoração', 'Beleza', 'Brinquedos', 'Papelaria', 'Moda', 'Esportes', 'Outros']
    await base.produto.createMany({
      data: Array.from({ length: 22 }, (_, i) => ({
        workspaceId: ws, userId: user, nome: `Produto perfil ${i}`, categoria: categorias[i % 7], preco: 30 + i * 15,
        tipoVenda: 'Afiliado', origemConteudo: 'De fornecedor', imagens: [], linkProduto: `https://loja.invalido/perf/${i}`,
      })),
    })
    registros.length = 0
    const t0 = performance.now()
    const r = await coletarCandidatos({ workspaceId: ws, userId: user })
    const total = performance.now() - t0

    // Ondas: agrupa consultas que se sobrepõem no tempo (rodaram em paralelo).
    const ord = [...registros].sort((a, b) => a.ini - b.ini)
    let ondas = 0, fimDaOnda = -1
    for (const q of ord) { if (q.ini >= fimDaOnda) { ondas++; fimDaOnda = q.fim } else fimDaOnda = Math.max(fimDaOnda, q.fim) }
    const porOp: Record<string, number> = {}
    for (const q of ord) porOp[q.op] = (porOp[q.op] ?? 0) + 1
    console.log(JSON.stringify({ latenciaSimuladaMs: latencia, consultas: registros.length, ondasSequenciais: ondas, totalMs: Math.round(total), avaliados: r.avaliados, apresentados: r.apresentados, porOperacao: porOp }, null, 1))
    console.log('sequência:', ord.map((q) => q.op).join(' → '))
  } finally {
    await limparWorkspaceDeTeste(base as unknown as PrismaClient, ws, PREFIXO)
    await base.$disconnect()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
