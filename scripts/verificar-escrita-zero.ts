/**
 * Prova mecânica de que o ensaio não escreveu nada.
 *
 * Uso — duas chamadas, com o ensaio no meio:
 *
 *   npx tsx scripts/verificar-escrita-zero.ts antes
 *   # ... dispara GET /api/cron/oportunidades?modo=ensaio ...
 *   npx tsx scripts/verificar-escrita-zero.ts depois
 *
 * A segunda chamada compara com a primeira e falha com exit 1 se QUALQUER
 * contagem tiver mudado. Sai 0 só quando tudo bate.
 *
 * ── POR QUE CONTAGEM, E NÃO CONFIANÇA NO CÓDIGO ─────────────────────────
 * O código diz que `escrever: false` não grava, e há teste provando isso
 * contra Postgres. Mas o teste roda no banco de teste. Esta verificação é
 * a que vale contra o banco de verdade, e não depende de acreditar em
 * nada: são linhas contadas antes e depois.
 *
 * ── SOMENTE LEITURA ─────────────────────────────────────────────────────
 * Este script só conta. Ele não cria, não altera e não apaga.
 */

import { prisma } from '../lib/prisma'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ARQUIVO = join(process.cwd(), '.verificacao-escrita-zero.json')

/** As tabelas que o ensaio jamais pode tocar. */
async function contar() {
  const [automationJob, conteudo, publicacao, linkDinamico, eventoLink, mLModel, mLFeatureSnapshot] =
    await Promise.all([
      prisma.automationJob.count(),
      prisma.conteudo.count(),
      prisma.publicacao.count(),
      prisma.linkDinamico.count(),
      prisma.eventoLink.count(),
      prisma.mLModel.count(),
      prisma.mLFeatureSnapshot.count(),
    ])
  return { automationJob, conteudo, publicacao, linkDinamico, eventoLink, mLModel, mLFeatureSnapshot }
}

async function main() {
  const fase = (process.argv[2] ?? '').toLowerCase()
  if (fase !== 'antes' && fase !== 'depois') {
    console.error('uso: verificar-escrita-zero.ts antes|depois')
    process.exit(2)
  }

  const agora = await contar()
  console.log(`\n=== CONTAGENS (${fase}) — ${new Date().toISOString()}`)
  for (const [k, v] of Object.entries(agora)) console.log(`  ${k.padEnd(20)} ${v}`)

  if (fase === 'antes') {
    writeFileSync(ARQUIVO, JSON.stringify({ quando: new Date().toISOString(), contagens: agora }, null, 2))
    console.log(`\nbaseline gravado em ${ARQUIVO}`)
    console.log('Agora dispare o ensaio e rode de novo com "depois".')
    await prisma.$disconnect()
    return
  }

  if (!existsSync(ARQUIVO)) {
    console.error(`\nsem baseline: rode "antes" primeiro (${ARQUIVO} não existe)`)
    await prisma.$disconnect()
    process.exit(2)
  }

  const antes = JSON.parse(readFileSync(ARQUIVO, 'utf8')).contagens as Record<string, number>
  const mudou: string[] = []
  console.log('\n=== COMPARACAO')
  for (const [k, v] of Object.entries(agora)) {
    const a = antes[k]
    const delta = v - a
    const marca = delta === 0 ? 'ok' : 'MUDOU'
    console.log(`  ${k.padEnd(20)} antes=${String(a).padStart(6)} depois=${String(v).padStart(6)} delta=${delta >= 0 ? '+' : ''}${delta}  ${marca}`)
    if (delta !== 0) mudou.push(`${k} (${delta >= 0 ? '+' : ''}${delta})`)
  }

  await prisma.$disconnect()

  if (mudou.length > 0) {
    console.error(`\nFALHOU — o ensaio escreveu: ${mudou.join(', ')}`)
    process.exit(1)
  }
  console.log('\nOK — nenhuma contagem mudou. O ensaio nao escreveu nada.')
}

main().catch(async (e) => {
  console.error('ERRO:', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(2)
})
