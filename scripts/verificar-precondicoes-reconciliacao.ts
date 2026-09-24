/**
 * As pré-condições que decidem se a reconciliação de produção é executável.
 *
 * Uso:
 *   DATABASE_URL="..." npx tsx scripts/verificar-precondicoes-reconciliacao.ts
 *
 * ── O QUE ESTÁ EM JOGO ──────────────────────────────────────────────────
 * A reconciliação adiciona `workspaceId NOT NULL` em cinco tabelas que já
 * têm linhas, e cria índices únicos novos que envolvem essa coluna. Com um
 * único workspace para todo o dado existente, um índice único que antes
 * separava por `userId` passa a separar por `workspaceId` — e duas linhas
 * que conviviam podem colidir.
 *
 * Este script procura essas colisões ANTES de qualquer escrita. Se alguma
 * aparecer, a reconciliação precisa de decisão humana, não de força.
 *
 * ── SOMENTE LEITURA ─────────────────────────────────────────────────────
 * Só SELECT. Nenhuma coluna de token, segredo ou credencial é lida.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['error'] })

type Resultado = { nome: string; ok: boolean; detalhe: string }
const resultados: Resultado[] = []

function registrar(nome: string, ok: boolean, detalhe: string) {
  resultados.push({ nome, ok, detalhe })
  console.log(`  ${ok ? 'OK     ' : 'BLOQUEIA'} ${nome.padEnd(46)} ${detalhe}`)
}

async function q<T>(sql: string): Promise<T[]> {
  return (await prisma.$queryRawUnsafe(sql)) as T[]
}

function titulo(t: string) {
  console.log(`\n${'='.repeat(78)}\n${t}\n${'='.repeat(78)}`)
}

async function main() {
  const url = process.env.DATABASE_URL ?? ''
  console.log(`alvo: ${url.match(/@([^/:]+)/)?.[1] ?? '?'} — ref ${url.match(/[a-z]{20}/)?.[0] ?? '?'}`)
  console.log('modo: SOMENTE LEITURA — nenhuma coluna de token é lida')

  titulo('1. QUANTOS DONOS O DADO EXISTENTE TEM')
  // Um único workspace só serve se o dado pertencer a uma única pessoa.
  const users = await q<{ n: number }>(`SELECT count(*)::int AS n FROM "User"`)
  const nUsers = users[0]?.n ?? 0
  registrar(
    'existe exatamente 1 User',
    nUsers === 1,
    `${nUsers} usuários` + (nUsers > 1 ? ' — um único workspace juntaria pessoas distintas' : '')
  )

  for (const t of ['Produto', 'Conteudo', 'LinkDinamico', 'Integracao', 'EventoLink']) {
    const temUserId = await q<{ n: number }>(
      `SELECT count(*)::int AS n FROM information_schema.columns
       WHERE table_schema='public' AND table_name='${t}' AND column_name='userId'`
    )
    if ((temUserId[0]?.n ?? 0) === 0) {
      registrar(`${t}: donos distintos`, true, 'sem coluna userId — nada a separar')
      continue
    }
    const donos = await q<{ n: number }>(`SELECT count(DISTINCT "userId")::int AS n FROM "${t}"`)
    const n = donos[0]?.n ?? 0
    registrar(`${t}: donos distintos`, n <= 1, `${n} userId distintos`)
  }

  titulo('2. COLISÕES NOS ÍNDICES ÚNICOS NOVOS')

  // Integracao: (userId, plataforma) vira (workspaceId, plataforma).
  // Com um workspace só, duas integrações da mesma plataforma colidem.
  const dupInt = await q<{ plataforma: string; n: number }>(
    `SELECT "plataforma", count(*)::int AS n FROM "Integracao"
     GROUP BY "plataforma" HAVING count(*) > 1 ORDER BY 2 DESC`
  )
  registrar(
    'Integracao (workspaceId, plataforma) única',
    dupInt.length === 0,
    dupInt.length === 0
      ? 'nenhuma plataforma repetida'
      : `COLIDE: ${dupInt.map((d) => `${d.plataforma}×${d.n}`).join(', ')}`
  )

  // Produto: (workspaceId, providerId, externalId). NULL é distinto de NULL
  // em índice único do Postgres, então linhas com ambos nulos não colidem.
  // As duas colunas podem ainda nem existir — é a reconciliação que as cria.
  const colsProduto = await q<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='Produto'
       AND column_name IN ('providerId','externalId')`
  )
  if (colsProduto.length < 2) {
    const total = await q<{ n: number }>(`SELECT count(*)::int AS n FROM "Produto"`)
    registrar(
      'Produto (workspaceId, providerId, externalId) única',
      true,
      `colunas ainda não existem — as ${total[0]?.n ?? 0} linhas nascem NULL, e NULLs não colidem`
    )
  } else {
    const dup = await q<{ n: number }>(
      `SELECT count(*)::int AS n FROM (
         SELECT 1 FROM "Produto" WHERE "providerId" IS NOT NULL AND "externalId" IS NOT NULL
         GROUP BY "providerId", "externalId" HAVING count(*) > 1
       ) t`
    )
    const n = dup[0]?.n ?? 0
    registrar(
      'Produto (workspaceId, providerId, externalId) única',
      n === 0,
      n === 0 ? 'nenhum par repetido' : `COLIDE: ${n} pares repetidos`
    )
  }

  // LinkDinamico: (publicacaoId, workspaceId). publicacaoId nasce nulo.
  const linkTotal = await q<{ n: number }>(`SELECT count(*)::int AS n FROM "LinkDinamico"`)
  registrar(
    'LinkDinamico (publicacaoId, workspaceId) única',
    true,
    `${linkTotal[0]?.n ?? 0} linhas, publicacaoId nasce NULL — NULLs não colidem`
  )

  titulo('3. O BACKFILL É POSSÍVEL')
  // ADD COLUMN ... NOT NULL sem default falha se a tabela tiver linhas. O
  // caminho é: adicionar anulável, preencher, depois SET NOT NULL.
  for (const t of ['User', 'Produto', 'Conteudo', 'LinkDinamico', 'Integracao', 'EventoLink']) {
    const r = await q<{ n: number }>(`SELECT count(*)::int AS n FROM "${t}"`)
    const n = r[0]?.n ?? 0
    registrar(
      `${t}: linhas a preencher`,
      true,
      `${n} linhas` + (n > 0 ? ' — exige backfill antes de SET NOT NULL' : ' — vazia, NOT NULL direto')
    )
  }

  titulo('4. O QUE SERIA APAGADO')
  const LEGADO = [
    'Creator', 'DecisaoMotor', 'EntregaUGC', 'Fornecedor', 'ImagemCriativo',
    'LogCompliance', 'SerieFxa', 'TendenciaRadar', 'TermoJuridico', 'VideoAutorizado',
  ]
  let comDado = 0
  for (const t of LEGADO) {
    const r = await q<{ n: number }>(`SELECT count(*)::int AS n FROM "${t}"`).catch(() => [{ n: -1 }])
    if ((r[0]?.n ?? 0) > 0) comDado += 1
  }
  registrar('tabelas legadas vazias', comDado === 0, `${comDado} de ${LEGADO.length} têm dado`)

  const colsConteudo = await q<{ n: number }>(
    `SELECT (count("linkUrl") + count("videoResultUrl") + count("videoStatusUrl"))::int AS n
     FROM "Conteudo"`
  ).catch(() => [{ n: -1 }])
  registrar(
    'colunas removidas de Conteudo estão vazias',
    (colsConteudo[0]?.n ?? -1) === 0,
    `${colsConteudo[0]?.n} valores preenchidos no total`
  )

  titulo('VEREDITO')
  const bloqueios = resultados.filter((r) => !r.ok)
  if (bloqueios.length === 0) {
    console.log('  Nenhum bloqueio. A reconciliação é executável com backfill de um único workspace.')
  } else {
    console.log(`  ${bloqueios.length} bloqueio(s) — exigem decisão antes de qualquer escrita:`)
    for (const b of bloqueios) console.log(`    - ${b.nome}: ${b.detalhe}`)
  }
  console.log('\n  (nenhuma escrita foi executada)')

  await prisma.$disconnect()
  process.exit(bloqueios.length === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('ERRO:', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(2)
})
