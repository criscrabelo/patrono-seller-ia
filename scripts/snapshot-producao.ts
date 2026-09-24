/**
 * Retrato somente-leitura do banco, para comparar antes e depois de uma etapa.
 *
 * Uso:
 *   DATABASE_URL="..." npx tsx scripts/snapshot-producao.ts gravar <arquivo>
 *   DATABASE_URL="..." npx tsx scripts/snapshot-producao.ts comparar <antes> <depois>
 *
 * ── POR QUE UM RETRATO, E NÃO SÓ CONTAGEM ───────────────────────────────
 * "Nada mudou" é uma afirmação forte. Contar linhas prova que nenhuma
 * sumiu, mas não prova que nenhuma coluna, índice ou constraint mudou. Este
 * retrato guarda as quatro coisas, e a comparação aponta exatamente o que
 * saiu do lugar — em vez de pedir confiança.
 *
 * ── SOMENTE LEITURA ─────────────────────────────────────────────────────
 * Só SELECT sobre `information_schema` / `pg_*` e `count(*)`. Nenhum dado de
 * linha é lido, nenhuma coluna de token é tocada.
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync, writeFileSync } from 'node:fs'

type Retrato = {
  quando: string
  tabelas: string[]
  colunas: Record<string, number>
  linhas: Record<string, number>
  indices: Record<string, string[]>
  constraints: Record<string, string[]>
}

const prisma = new PrismaClient({ log: ['error'] })

async function q<T>(sql: string): Promise<T[]> {
  return (await prisma.$queryRawUnsafe(sql)) as T[]
}

async function tirarRetrato(): Promise<Retrato> {
  const tabelas = (
    await q<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`
    )
  ).map((t) => t.table_name)

  const colunas: Record<string, number> = {}
  for (const r of await q<{ table_name: string; n: number }>(
    `SELECT table_name, count(*)::int AS n FROM information_schema.columns
     WHERE table_schema='public' GROUP BY table_name`
  )) {
    colunas[r.table_name] = r.n
  }

  const linhas: Record<string, number> = {}
  for (const t of tabelas) {
    const r = await q<{ n: number }>(`SELECT count(*)::int AS n FROM public."${t}"`)
    linhas[t] = r[0]?.n ?? -1
  }

  const indices: Record<string, string[]> = {}
  for (const r of await q<{ tablename: string; indexname: string }>(
    `SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname`
  )) {
    ;(indices[r.tablename] ??= []).push(r.indexname)
  }

  const constraints: Record<string, string[]> = {}
  for (const r of await q<{ tabela: string; conname: string; contype: string }>(
    `SELECT cl.relname AS tabela, c.conname, c.contype::text
       FROM pg_constraint c
       JOIN pg_class cl ON cl.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname='public' ORDER BY cl.relname, c.conname`
  )) {
    ;(constraints[r.tabela] ??= []).push(`${r.conname}(${r.contype})`)
  }

  return { quando: new Date().toISOString(), tabelas, colunas, linhas, indices, constraints }
}

function comparar(a: Retrato, b: Retrato) {
  const diferencas: string[] = []

  const soEmB = b.tabelas.filter((t) => !a.tabelas.includes(t))
  const soEmA = a.tabelas.filter((t) => !b.tabelas.includes(t))
  for (const t of soEmB) diferencas.push(`TABELA NOVA        ${t}`)
  for (const t of soEmA) diferencas.push(`TABELA REMOVIDA    ${t}`)

  for (const t of a.tabelas.filter((t) => b.tabelas.includes(t))) {
    if (a.colunas[t] !== b.colunas[t]) {
      diferencas.push(`COLUNAS MUDARAM    ${t}: ${a.colunas[t]} -> ${b.colunas[t]}`)
    }
    if (a.linhas[t] !== b.linhas[t]) {
      diferencas.push(`LINHAS MUDARAM     ${t}: ${a.linhas[t]} -> ${b.linhas[t]}`)
    }
    const ia = (a.indices[t] ?? []).join(',')
    const ib = (b.indices[t] ?? []).join(',')
    if (ia !== ib) diferencas.push(`ÍNDICES MUDARAM    ${t}: [${ia}] -> [${ib}]`)
    const ca = (a.constraints[t] ?? []).join(',')
    const cb = (b.constraints[t] ?? []).join(',')
    if (ca !== cb) diferencas.push(`CONSTRAINTS MUDARAM ${t}: [${ca}] -> [${cb}]`)
  }

  console.log(`\nantes:  ${a.quando}  (${a.tabelas.length} tabelas)`)
  console.log(`depois: ${b.quando}  (${b.tabelas.length} tabelas)`)
  console.log(`\n=== DIFERENÇAS (${diferencas.length}) ===`)
  if (diferencas.length === 0) console.log('  nenhuma')
  for (const d of diferencas) console.log(`  ${d}`)

  // O que interessa para a Etapa 1: as tabelas de negócio não podem mudar.
  const NEGOCIO = ['User', 'Produto', 'Conteudo', 'LinkDinamico', 'EventoLink', 'Integracao']
  console.log(`\n=== TABELAS DE NEGÓCIO — linhas ===`)
  let mexeu = 0
  for (const t of NEGOCIO) {
    const antes = a.linhas[t] ?? -1
    const depois = b.linhas[t] ?? -1
    const ok = antes === depois
    if (!ok) mexeu += 1
    console.log(`  ${ok ? 'ok   ' : 'MUDOU'} ${t.padEnd(14)} antes=${String(antes).padStart(5)} depois=${String(depois).padStart(5)}`)
  }
  return { diferencas, mexeu }
}

async function main() {
  const modo = process.argv[2]
  if (modo === 'gravar') {
    const arquivo = process.argv[3]
    if (!arquivo) {
      console.error('uso: snapshot-producao.ts gravar <arquivo>')
      process.exit(2)
    }
    const url = process.env.DATABASE_URL ?? ''
    console.log(`alvo: ${url.match(/@([^/:]+)/)?.[1] ?? '?'} — ref ${url.match(/[a-z]{20}/)?.[0] ?? '?'}`)
    const r = await tirarRetrato()
    writeFileSync(arquivo, JSON.stringify(r, null, 2))
    console.log(`retrato gravado: ${arquivo}`)
    console.log(`  ${r.tabelas.length} tabelas`)
    for (const t of ['User', 'Produto', 'Conteudo', 'LinkDinamico', 'EventoLink', 'Integracao']) {
      console.log(`  ${t.padEnd(14)} ${r.linhas[t] ?? '(não existe)'} linhas, ${r.colunas[t] ?? '?'} colunas`)
    }
    await prisma.$disconnect()
    return
  }

  if (modo === 'comparar') {
    const a = JSON.parse(readFileSync(process.argv[3], 'utf8')) as Retrato
    const b = JSON.parse(readFileSync(process.argv[4], 'utf8')) as Retrato
    const { mexeu } = comparar(a, b)
    await prisma.$disconnect()
    process.exit(mexeu === 0 ? 0 : 1)
  }

  console.error('uso: snapshot-producao.ts gravar <arquivo> | comparar <antes> <depois>')
  process.exit(2)
}

main().catch(async (e) => {
  console.error('ERRO:', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(2)
})
