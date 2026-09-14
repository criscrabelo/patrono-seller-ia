/**
 * Job Queue real do Digital Twin (Rodada 8, regras 33-36) — usa o Postgres
 * já existente (nenhum Redis/BullMQ/fila SaaS). Claim atômico via
 * `SELECT ... FOR UPDATE SKIP LOCKED` — dois workers nunca pegam o mesmo
 * job ao mesmo tempo, mesmo concorrendo de verdade.
 *
 * Worker offline nunca perde o job: se o `heartbeatAt` parar de ser
 * renovado por mais que `staleTimeoutMs`, o job volta a ficar "claimável"
 * — nunca vira `FAILED` só por falta de processador (regra 36).
 */

import { Prisma, PrismaClient } from '@prisma/client'
import { prisma as prismaPadrao } from './prisma'

export const STALE_TIMEOUT_MS_PADRAO = 5 * 60 * 1000 // 5 minutos sem heartbeat = considerado travado/offline

export interface DigitalTwinJobRow {
  id: string
  workspaceId: string
  profileId: string
  status: string
  workerId: string | null
  claimedAt: Date | null
  heartbeatAt: Date | null
  attempts: number
  error: string | null
  resultAssetId: string | null
}

/**
 * Reivindica atomicamente o próximo job elegível: `QUEUED`, ou um job
 * travado (heartbeat velho demais) de outro worker que caiu. `FOR UPDATE
 * SKIP LOCKED` garante que dois workers rodando a mesma query ao mesmo
 * tempo nunca pegam a mesma linha.
 *
 * `workspaceId` (Rodada 9, worker pairing): quando informado, o worker só
 * enxerga jobs DAQUELE workspace — nunca de outro. Um worker pareado a um
 * workspace nunca deve poder baixar assets/gerar conteúdo de outro.
 *
 * Terceiro kill switch (Rodada 9, regra 34): um job cujo `DigitalTwinProfile`
 * está com `workerPaused = true` NUNCA é reivindicado — pausar o worker é
 * independente de pausar o Autopilot (`Workspace.automationPaused`) ou o
 * Digital Twin (`DigitalTwinProfile.enabled`).
 */
export async function reivindicarProximoJob(
  workerId: string,
  staleTimeoutMs: number = STALE_TIMEOUT_MS_PADRAO,
  client: PrismaClient = prismaPadrao,
  workspaceId?: string
): Promise<DigitalTwinJobRow | null> {
  const limiteStale = new Date(Date.now() - staleTimeoutMs)
  const filtroWorkspace = workspaceId ? Prisma.sql`AND "workspaceId" = ${workspaceId}` : Prisma.empty

  const rows = await client.$queryRaw<DigitalTwinJobRow[]>(Prisma.sql`
    UPDATE "DigitalTwinJob"
    SET "workerId" = ${workerId}, "claimedAt" = now(), "heartbeatAt" = now(), "updatedAt" = now()
    WHERE id = (
      SELECT id FROM "DigitalTwinJob"
      WHERE (
        (status = 'QUEUED' AND "workerId" IS NULL)
        OR (status NOT IN ('READY', 'FAILED', 'CANCELLED') AND "heartbeatAt" IS NOT NULL AND "heartbeatAt" < ${limiteStale})
      )
      AND NOT EXISTS (
        SELECT 1 FROM "DigitalTwinProfile" p WHERE p.id = "DigitalTwinJob"."profileId" AND p."workerPaused" = true
      )
      ${filtroWorkspace}
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, "workspaceId", "profileId", status, "workerId", "claimedAt", "heartbeatAt", attempts, error, "resultAssetId"
  `)

  return rows[0] ?? null
}

/** Renova o heartbeat — só se ESTE worker ainda for o dono do job (nunca renova o job de outro worker). */
export async function renovarHeartbeat(jobId: string, workerId: string, client: PrismaClient = prismaPadrao): Promise<boolean> {
  const resultado = await client.digitalTwinJob.updateMany({
    where: { id: jobId, workerId },
    data: { heartbeatAt: new Date() },
  })
  return resultado.count === 1
}

/** Avança o status — só se este worker ainda for o dono. */
export async function avancarStatus(jobId: string, workerId: string, novoStatus: string, client: PrismaClient = prismaPadrao): Promise<boolean> {
  const resultado = await client.digitalTwinJob.updateMany({
    where: { id: jobId, workerId },
    data: { status: novoStatus, heartbeatAt: new Date() },
  })
  return resultado.count === 1
}

export async function completarJob(jobId: string, workerId: string, resultAssetId: string, client: PrismaClient = prismaPadrao): Promise<boolean> {
  const resultado = await client.digitalTwinJob.updateMany({
    where: { id: jobId, workerId },
    data: { status: 'READY', resultAssetId, heartbeatAt: new Date() },
  })
  return resultado.count === 1
}

/**
 * Falha um job — se ainda houver tentativas dentro do limite, volta para
 * `QUEUED` (retry automático, regra 31); senão, `FAILED` de verdade.
 */
export async function falharJob(
  jobId: string,
  workerId: string,
  erro: string,
  maxTentativas: number,
  client: PrismaClient = prismaPadrao
): Promise<'REQUEUED' | 'FAILED' | 'NAO_ERA_DONO'> {
  const job = await client.digitalTwinJob.findUnique({ where: { id: jobId } })
  if (!job || job.workerId !== workerId) return 'NAO_ERA_DONO'

  const novasTentativas = job.attempts + 1
  if (novasTentativas < maxTentativas) {
    await client.digitalTwinJob.update({
      where: { id: jobId },
      data: { status: 'QUEUED', workerId: null, attempts: novasTentativas, error: erro, heartbeatAt: null },
    })
    return 'REQUEUED'
  }
  await client.digitalTwinJob.update({
    where: { id: jobId },
    data: { status: 'FAILED', attempts: novasTentativas, error: erro },
  })
  return 'FAILED'
}

/**
 * Status amigável para a UI: um job `QUEUED` sem worker nenhum ainda não
 * é "falha" — é só "aguardando processador" (regra 36).
 */
export function statusAmigavelParaUsuaria(job: Pick<DigitalTwinJobRow, 'status' | 'workerId'>): string {
  if (job.status === 'QUEUED' && !job.workerId) return 'Aguardando processador'
  if (job.status === 'FAILED') return 'Falhou'
  if (job.status === 'READY') return 'Pronto'
  return 'Processando'
}
