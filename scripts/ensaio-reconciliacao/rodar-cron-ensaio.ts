/**
 * Roda o ciclo de oportunidades em MODO ENSAIO, pelo mesmo caminho da rota.
 *
 * Uso:
 *   DATABASE_URL="postgresql://postgres@127.0.0.1:55432/patrono_ensaio" \
 *     npx tsx scripts/ensaio-reconciliacao/rodar-cron-ensaio.ts
 *
 * ── POR QUE NÃO CHAMAR A ROTA HTTP ──────────────────────────────────────
 * A rota faz três coisas: confere o `CRON_SECRET`, lê `?modo=ensaio` e
 * chama `rodarCicloDeOportunidades`. As duas primeiras já têm teste
 * próprio. A terceira é a que mede o catálogo — e é exatamente esta
 * chamada, com os mesmos argumentos que a rota usa quando `modo=ensaio`.
 *
 * ── GUARDA ──────────────────────────────────────────────────────────────
 * Recusa rodar se o alvo não for 127.0.0.1. Este script existe para o
 * banco descartável; apontá-lo para outro lugar seria acidente.
 */

import { portaPrisma } from '../../lib/automation-queue-prisma'
import { rodarCicloDeOportunidades, CICLO_NAO_PUBLICA_NEM_GERA } from '../../lib/ciclo-de-oportunidades'
import { prisma } from '../../lib/prisma'

async function main() {
  const url = process.env.DATABASE_URL ?? ''
  if (!url.includes('127.0.0.1')) {
    console.error('RECUSANDO: este ensaio só roda contra 127.0.0.1.')
    process.exit(1)
  }
  console.log(`alvo: ${url.replace(/\/\/[^@]*@/, '//***@')}`)

  const agora = new Date()
  const relatorio = await rodarCicloDeOportunidades({
    porta: portaPrisma(),
    agora,
    escrever: false, // <- a única diferença entre ensaio e operação
  })

  console.log('\n=== RELATÓRIO DO CICLO (modo ensaio) ===')
  console.log(JSON.stringify(relatorio, null, 2))
  console.log('\n=== ESCOPO DECLARADO ===')
  console.log(JSON.stringify(CICLO_NAO_PUBLICA_NEM_GERA, null, 2))

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ERRO:', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(2)
})
