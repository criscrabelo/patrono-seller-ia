import { prisma } from '@/lib/prisma'

/**
 * Auditoria simples de operações de escrita importantes.
 *
 * Sem serviço externo, sem custo: só uma tabela (`AuditLog`) no mesmo
 * Postgres do app. Chame depois que a operação principal já foi
 * confirmada — uma falha ao gravar o log NUNCA deve derrubar a operação
 * que ele está registrando (por isso o catch silencioso: perder um log é
 * ruim, mas quebrar "criar produto" por causa do log seria pior).
 *
 * NUNCA passe senha, token, segredo ou outro dado sensível em `metadata`.
 */
export async function registrarAuditoria(evento: {
  workspaceId: string
  userId?: string | null
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}) {
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId: evento.workspaceId,
        userId: evento.userId ?? null,
        action: evento.action,
        entityType: evento.entityType,
        entityId: evento.entityId,
        metadata: evento.metadata as never,
      },
    })
  } catch (e) {
    console.error('Falha ao gravar log de auditoria (operação principal seguiu normalmente):', e)
  }
}
