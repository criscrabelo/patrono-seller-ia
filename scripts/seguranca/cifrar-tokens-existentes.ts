/**
 * P2.14.7 (Fase 0A) — Cifra (ou recifra com a chave atual) os segredos já
 * gravados em `Integracao`: accessToken, refreshToken e chaves secretas de
 * extraData.
 *
 *   node --env-file=.env.digital-twin-test ./node_modules/tsx/dist/cli.mjs scripts/seguranca/cifrar-tokens-existentes.ts [--aplicar] [--workspace=<id>]
 *
 * - Sem `--aplicar`: SIMULAÇÃO — só conta, não grava nada.
 * - Por padrão recusa qualquer banco que não seja o de TESTE. PRODUÇÃO só
 *   na janela autorizada da 0B, com `--producao --confirmo=<ref de produção>`
 *   (a ref digitada tem de bater com a URL do banco).
 * - `--workspace=<id>` limita a um workspace (usado pelos testes).
 * - Usa um PrismaClient CRU (sem a extensão do cofre) para ver o valor real.
 * - Grava com compare-and-set: se a linha mudou no meio, não sobrescreve.
 * - Nunca imprime token, nem parcial: só contagens e ids.
 * - Ao final, conta via SQL quantos campos ainda estão em texto puro (meta: 0).
 */
import { PrismaClient, type Prisma } from '@prisma/client'
import { chaveEhSecreta, cifrar, cofreConfigurado, decifrar, estaCifrado, precisaRecifrar } from '../../lib/cofre'

import { exigirBancoAutorizado, argumento } from './_banco-autorizado'

const aplicar = process.argv.includes('--aplicar')
const soWorkspace = argumento('workspace')

/** Valor em texto puro ou cifrado com chave antiga → cifrado com a chave atual. */
function normalizar(v: string, campo: string): string {
  return cifrar(estaCifrado(v) ? decifrar(v, campo) : v, campo)
}

async function main() {
  const banco = exigirBancoAutorizado()
  if (!cofreConfigurado()) throw new Error('TOKENS_ENCRYPTION_KEY ausente ou inválida. Abortado.')

  const cru = new PrismaClient()
  try {
    const filtro = soWorkspace ? { workspaceId: soWorkspace } : {}
    const linhas = await cru.integracao.findMany({ where: filtro, select: { id: true, accessToken: true, refreshToken: true, extraData: true } })
    let alvo = 0, gravadas = 0, mudaram = 0
    const campos = { accessToken: 0, refreshToken: 0, extraData: 0 }

    for (const l of linhas) {
      const dados: Prisma.IntegracaoUpdateManyMutationInput = {}
      if (l.accessToken && precisaRecifrar(l.accessToken)) { dados.accessToken = normalizar(l.accessToken, 'Integracao.accessToken'); campos.accessToken++ }
      if (l.refreshToken && precisaRecifrar(l.refreshToken)) { dados.refreshToken = normalizar(l.refreshToken, 'Integracao.refreshToken'); campos.refreshToken++ }
      if (l.extraData && typeof l.extraData === 'object' && !Array.isArray(l.extraData)) {
        const ex = l.extraData as Record<string, unknown>
        let tocou = false
        const novo: Record<string, unknown> = { ...ex }
        for (const [k, v] of Object.entries(ex)) {
          if (typeof v === 'string' && v && chaveEhSecreta(k) && precisaRecifrar(v)) {
            novo[k] = normalizar(v, `Integracao.extraData.${k}`)
            tocou = true
          }
        }
        if (tocou) { dados.extraData = novo as Prisma.InputJsonValue; campos.extraData++ }
      }
      if (Object.keys(dados).length === 0) continue
      alvo++
      if (!aplicar) continue
      // Compare-and-set nos campos de texto: se alguém gravou no meio, não sobrescreve.
      const r = await cru.integracao.updateMany({
        where: { id: l.id, accessToken: l.accessToken, refreshToken: l.refreshToken },
        data: dados,
      })
      if (r.count === 1) gravadas++
      else mudaram++
    }

    const [restantes] = await cru.$queryRaw<{ access: bigint; refresh: bigint }[]>`
      SELECT
        COUNT(*) FILTER (WHERE "accessToken" IS NOT NULL AND "accessToken" <> '' AND "accessToken" NOT LIKE 'enc:v1:%') AS access,
        COUNT(*) FILTER (WHERE "refreshToken" IS NOT NULL AND "refreshToken" <> '' AND "refreshToken" NOT LIKE 'enc:v1:%') AS refresh
      FROM "Integracao" WHERE (${soWorkspace ?? null}::text IS NULL OR "workspaceId" = ${soWorkspace ?? null}::text)`
    const extrasPuros = (await cru.integracao.findMany({ where: filtro, select: { extraData: true } })).filter((l) => {
      const ex = l.extraData
      return ex && typeof ex === 'object' && !Array.isArray(ex) && Object.entries(ex as Record<string, unknown>).some(([k, v]) => typeof v === 'string' && v && chaveEhSecreta(k) && !estaCifrado(v))
    }).length

    console.log(JSON.stringify({
      banco,
      modo: aplicar ? 'APLICAR' : 'SIMULACAO',
      integracoes: linhas.length,
      linhasQuePrecisam: alvo,
      camposPorTipo: campos,
      gravadas,
      puladasPorConcorrencia: mudaram,
      textoPuroRestante: { accessToken: Number(restantes.access), refreshToken: Number(restantes.refresh), extraDataLinhas: extrasPuros },
    }, null, 2))
  } finally {
    await cru.$disconnect()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'falha')
  process.exit(1)
})
