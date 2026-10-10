/**
 * P2.14.8 — ROLLBACK do cofre: devolve a texto puro os segredos cifrados de
 * `Integracao` (accessToken, refreshToken, chaves secretas de extraData).
 *
 * Só existe para uma situação: voltar a um código ANTIGO que não sabe
 * decifrar (ex.: religar a Vercel). Com o código novo no ar, NÃO use.
 *
 *   node --env-file=<env> ./node_modules/tsx/dist/cli.mjs scripts/seguranca/decifrar-tokens-rollback.ts [--aplicar] [--workspace=<id>] [--producao --confirmo=<ref>]
 *
 * - Sem `--aplicar`: SIMULAÇÃO.
 * - Exige a MESMA chave que cifrou (TOKENS_ENCRYPTION_KEY e, se houver,
 *   TOKENS_ENCRYPTION_KEY_ANTERIOR). Sem ela, aborta sem tocar em nada.
 * - Decifra tudo em memória ANTES de gravar: se uma linha não decifrar, não
 *   grava nenhuma.
 * - Compare-and-set por linha. Nunca imprime valor.
 */
import { PrismaClient, type Prisma } from '@prisma/client'
import { chaveEhSecreta, cofreConfigurado, decifrar, estaCifrado } from '../../lib/cofre'
import { exigirBancoAutorizado, argumento } from './_banco-autorizado'

const aplicar = process.argv.includes('--aplicar')
const soWorkspace = argumento('workspace')

async function main() {
  const banco = exigirBancoAutorizado()
  if (!cofreConfigurado()) throw new Error('TOKENS_ENCRYPTION_KEY ausente ou inválida. Abortado.')

  const cru = new PrismaClient()
  try {
    const filtro = soWorkspace ? { workspaceId: soWorkspace } : {}
    const linhas = await cru.integracao.findMany({ where: filtro, select: { id: true, accessToken: true, refreshToken: true, extraData: true } })

    // 1) Decifra tudo em memória. Qualquer falha aborta antes de gravar.
    const planos: Array<{ id: string; antes: { accessToken: string | null; refreshToken: string | null }; dados: Prisma.IntegracaoUpdateManyMutationInput }> = []
    for (const l of linhas) {
      const dados: Prisma.IntegracaoUpdateManyMutationInput = {}
      if (estaCifrado(l.accessToken)) dados.accessToken = decifrar(l.accessToken as string, 'Integracao.accessToken')
      if (estaCifrado(l.refreshToken)) dados.refreshToken = decifrar(l.refreshToken as string, 'Integracao.refreshToken')
      if (l.extraData && typeof l.extraData === 'object' && !Array.isArray(l.extraData)) {
        const ex = l.extraData as Record<string, unknown>
        let tocou = false
        const novo: Record<string, unknown> = { ...ex }
        for (const [k, v] of Object.entries(ex)) {
          if (chaveEhSecreta(k) && estaCifrado(v)) {
            novo[k] = decifrar(v as string, `Integracao.extraData.${k}`)
            tocou = true
          }
        }
        if (tocou) dados.extraData = novo as Prisma.InputJsonValue
      }
      if (Object.keys(dados).length) planos.push({ id: l.id, antes: { accessToken: l.accessToken, refreshToken: l.refreshToken }, dados })
    }

    // 2) Grava (compare-and-set).
    let gravadas = 0, mudaram = 0
    if (aplicar) {
      for (const p of planos) {
        const r = await cru.integracao.updateMany({ where: { id: p.id, accessToken: p.antes.accessToken, refreshToken: p.antes.refreshToken }, data: p.dados })
        if (r.count === 1) gravadas++
        else mudaram++
      }
    }

    const [restantes] = await cru.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "Integracao"
      WHERE (${soWorkspace ?? null}::text IS NULL OR "workspaceId" = ${soWorkspace ?? null}::text)
        AND ("accessToken" LIKE 'enc:v1:%' OR "refreshToken" LIKE 'enc:v1:%' OR "extraData"::text LIKE '%enc:v1:%')`
    console.log(JSON.stringify({ banco, modo: aplicar ? 'APLICAR' : 'SIMULACAO', integracoes: linhas.length, linhasADecifrar: planos.length, gravadas, puladasPorConcorrencia: mudaram, linhasAindaCifradas: Number(restantes.n) }, null, 2))
  } finally {
    await cru.$disconnect()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'falha')
  process.exit(1)
})
