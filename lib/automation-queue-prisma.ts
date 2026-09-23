/**
 * Adaptador Prisma da Automation Queue (P1.3).
 *
 * É o ÚNICO arquivo que escreve em `AutomationJob`. Há teste varrendo
 * `lib/` e `app/` que quebra se outro módulo chamar
 * `prisma.automationJob.create/update/upsert`.
 *
 * ── O CLAIM É SQL CRU, E ISSO É DELIBERADO ──────────────────────────────
 * `FOR UPDATE SKIP LOCKED` não tem equivalente no query builder do Prisma.
 * Sem ele, dois workers simultâneos disputariam a MESMA linha: um esperaria
 * o outro soltar o lock e então pegaria o job já reivindicado, ou ficaria
 * bloqueado. Com ele, cada worker pula o que já está travado e leva uma
 * linha diferente — que é a diferença entre uma fila e uma disputa.
 */

import { prisma } from './prisma'
import {
  TIMEOUT_DE_HEARTBEAT_MS,
  type PortaDaFila,
  type LinhaDaFila,
} from './automation-queue-repositorio'
import type { EstadoDoJob, ClasseDeJob } from './automation-queue-contrato'

type LinhaCrua = {
  id: string
  workspaceId: string
  tipo: string
  chave: string
  estado: string
  classe: string
  motivoHumano: string | null
  entityType: string
  entityId: string
  contexto: unknown
  tentativas: number
  proximaTentativaEm: Date | null
  ultimoErro: string | null
  workerId: string | null
  claimedAt: Date | null
  heartbeatAt: Date | null
  resolvidoEm: Date | null
  createdAt: Date
}

function converter(l: LinhaCrua): LinhaDaFila {
  return {
    ...l,
    estado: l.estado as EstadoDoJob,
    classe: l.classe as ClasseDeJob,
    contexto: (l.contexto as Record<string, unknown> | null) ?? null,
  }
}

/**
 * A porta de verdade. `staleMs` fica configurável só para teste poder
 * provar a recuperação sem esperar cinco minutos de relógio.
 */
export function portaPrisma(staleMs: number = TIMEOUT_DE_HEARTBEAT_MS): PortaDaFila {
  return {
    async listarPorWorkspace(workspaceId) {
      const linhas = await prisma.automationJob.findMany({ where: { workspaceId } })
      return (linhas as unknown as LinhaCrua[]).map(converter)
    },

    async inserirOuReencontrar(nova) {
      try {
        const criada = await prisma.automationJob.create({
          data: {
            workspaceId: nova.workspaceId,
            tipo: nova.tipo,
            chave: nova.chave,
            estado: nova.estado as never,
            classe: nova.classe,
            motivoHumano: nova.motivoHumano,
            entityType: nova.entityType,
            entityId: nova.entityId,
            contexto: (nova.contexto ?? undefined) as never,
            tentativas: nova.tentativas,
            proximaTentativaEm: nova.proximaTentativaEm,
            ultimoErro: nova.ultimoErro,
            workerId: nova.workerId,
            claimedAt: nova.claimedAt,
            heartbeatAt: nova.heartbeatAt,
            resolvidoEm: nova.resolvidoEm,
          },
        })
        return converter(criada as unknown as LinhaCrua)
      } catch (e) {
        // A unique `(workspaceId, chave)` recusou: dois crons simultâneos
        // pediram a mesma coisa. Isso é IDEMPOTÊNCIA, não erro — devolve a
        // linha que venceu a corrida.
        const err = e as { code?: string }
        if (err?.code === 'P2002') {
          const existente = await prisma.automationJob.findUnique({
            where: { workspaceId_chave: { workspaceId: nova.workspaceId, chave: nova.chave } },
          })
          if (existente) return converter(existente as unknown as LinhaCrua)
        }
        throw e
      }
    },

    async atualizar(id, dados) {
      const atualizada = await prisma.automationJob
        .update({
          where: { id },
          data: {
            ...(dados.estado !== undefined ? { estado: dados.estado as never } : {}),
            ...(dados.contexto !== undefined ? { contexto: (dados.contexto ?? undefined) as never } : {}),
            ...(dados.classe !== undefined ? { classe: dados.classe } : {}),
            ...(dados.tentativas !== undefined ? { tentativas: dados.tentativas } : {}),
            ...(dados.proximaTentativaEm !== undefined ? { proximaTentativaEm: dados.proximaTentativaEm } : {}),
            ...(dados.ultimoErro !== undefined ? { ultimoErro: dados.ultimoErro } : {}),
            ...(dados.workerId !== undefined ? { workerId: dados.workerId } : {}),
            ...(dados.claimedAt !== undefined ? { claimedAt: dados.claimedAt } : {}),
            ...(dados.heartbeatAt !== undefined ? { heartbeatAt: dados.heartbeatAt } : {}),
            ...(dados.resolvidoEm !== undefined ? { resolvidoEm: dados.resolvidoEm } : {}),
          },
        })
        .catch(() => null)
      return atualizada ? converter(atualizada as unknown as LinhaCrua) : null
    },

    async reivindicar(workspaceId, workerId, agora) {
      const limiteStale = new Date(agora.getTime() - staleMs)
      // `workspaceId` no WHERE é o que impede o worker de A de enxergar job
      // de B. `WAITING` não aparece: dependência humana e condição externa
      // ficam visíveis na fila sem consumir execução.
      const linhas = await prisma.$queryRaw<LinhaCrua[]>`
        UPDATE "AutomationJob"
        SET "workerId" = ${workerId},
            "claimedAt" = ${agora},
            "heartbeatAt" = ${agora},
            "estado" = 'RUNNING'::"EstadoDoAutomationJob",
            "updatedAt" = now()
        WHERE id = (
          SELECT id FROM "AutomationJob"
          WHERE "workspaceId" = ${workspaceId}
            AND (
              ("estado" = 'PENDING' AND "workerId" IS NULL)
              OR ("estado" = 'FAILED_RETRYABLE' AND "proximaTentativaEm" IS NOT NULL AND "proximaTentativaEm" <= ${agora})
              OR ("estado" = 'RUNNING' AND "heartbeatAt" IS NOT NULL AND "heartbeatAt" < ${limiteStale})
            )
          ORDER BY "createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING *
      `
      return linhas[0] ? converter(linhas[0]) : null
    },
  }
}

/** Renova o heartbeat — só se ESTE worker ainda for o dono. */
export async function renovarHeartbeat(jobId: string, workerId: string, agora: Date): Promise<boolean> {
  const r = await prisma.automationJob.updateMany({
    where: { id: jobId, workerId },
    data: { heartbeatAt: agora },
  })
  return r.count === 1
}
