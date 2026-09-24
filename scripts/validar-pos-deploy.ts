/**
 * Validação pós-deploy, SOMENTE LEITURA.
 *
 * Uso:
 *   DATABASE_URL="..." npx tsx scripts/validar-pos-deploy.ts
 *
 * ── O QUE ELE RESPONDE ──────────────────────────────────────────────────
 * Se o código novo consegue LER o banco recém-migrado pelos mesmos caminhos
 * que a aplicação usa. Um `migrate status` verde diz que o schema está no
 * ponto; não diz que o cliente Prisma gerado conversa com ele. São coisas
 * diferentes, e a segunda é a que quebra em produção.
 *
 * Lê catálogo, conteúdo e roda o preflight de publicação — que é read-only
 * por construção e nunca cria `Publicacao`.
 *
 * ── NÃO ESCREVE, NÃO PUBLICA ────────────────────────────────────────────
 * Nenhum `create`, `update` ou `delete`. Nenhum adapter é ligado: o
 * preflight roda com o registro vazio, e o resultado esperado é
 * `executavelAgora: false`.
 */

import { prisma } from '../lib/prisma'
import { preflightDePublicacao } from '../lib/preflight-de-publicacao'

function titulo(t: string) {
  console.log(`\n${'='.repeat(70)}\n${t}\n${'='.repeat(70)}`)
}

async function main() {
  const url = process.env.DATABASE_URL ?? ''
  console.log(`alvo: ${url.match(/@([^/:]+)/)?.[1] ?? '?'} — ref ${url.match(/[a-z]{20}/)?.[0] ?? '?'}`)
  console.log('modo: SOMENTE LEITURA')

  titulo('1. WORKSPACE — o cliente novo enxerga as colunas novas?')
  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true, automationPaused: true, automationMode: true },
  })
  for (const w of workspaces) {
    console.log(`  ${w.id}  pausado=${w.automationPaused}  modo=${w.automationMode}`)
  }
  if (workspaces.length === 0) throw new Error('nenhum workspace — o backfill não teria funcionado')

  const ws = workspaces[0].id

  titulo('2. CATÁLOGO — leitura com as colunas da migration nº 10')
  const produtos = await prisma.produto.findMany({
    where: { workspaceId: ws },
    select: {
      id: true, nome: true, categoria: true, preco: true, status: true,
      origemDados: true, externalId: true, providerId: true, sincronizadoEm: true,
    },
    take: 3,
  })
  const totalProdutos = await prisma.produto.count({ where: { workspaceId: ws } })
  console.log(`  ${totalProdutos} produtos no workspace. Amostra:`)
  for (const p of produtos) {
    console.log(`    ${p.nome} | ${p.categoria} | origemDados=${p.origemDados} | externalId=${p.externalId ?? 'null'}`)
  }

  titulo('3. CONTEÚDO')
  const totalConteudo = await prisma.conteudo.count({ where: { workspaceId: ws } })
  const conteudos = await prisma.conteudo.findMany({
    where: { workspaceId: ws },
    select: { id: true, produtoId: true, status: true },
    take: 3,
  })
  console.log(`  ${totalConteudo} conteúdos. Amostra:`)
  for (const c of conteudos) console.log(`    ${c.id} | produto=${c.produtoId} | status=${c.status}`)

  titulo('4. TABELAS NOVAS — leitura das que a migração criou')
  console.log(`  AutomationJob      ${await prisma.automationJob.count()}`)
  console.log(`  Publicacao         ${await prisma.publicacao.count()}`)
  console.log(`  MLModel            ${await prisma.mLModel.count()}`)
  console.log(`  MLFeatureSnapshot  ${await prisma.mLFeatureSnapshot.count()}`)
  console.log(`  EventoLink         ${await prisma.eventoLink.count()}`)
  console.log(`  LinkDinamico       ${await prisma.linkDinamico.count({ where: { workspaceId: ws } })}`)

  titulo('5. PREFLIGHT DE PUBLICAÇÃO — read-only, sem adapter ligado')
  for (const canal of ['instagram', 'tiktok']) {
    const r = await preflightDePublicacao({ workspaceId: ws, canal })
    console.log(`  ${canal}:`)
    console.log(`    pronto          = ${r.pronto}`)
    console.log(`    executavelAgora = ${r.executavelAgora}`)
    console.log(`    bloqueio        = ${r.bloqueio ?? '(nenhum)'}`)
    console.log(`    oQueFalta       = ${r.oQueFalta ?? '(nada)'}`)
    console.log(`    custoZero       = ${r.custoZero}`)
    console.log(`    capability      = publicar=${r.capabilityEfetiva.publicar} draft=${r.capabilityEfetiva.draft}`)
  }

  titulo('FIM — nenhuma escrita, nenhuma publicação')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ERRO:', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
