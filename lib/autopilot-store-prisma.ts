/**
 * Implementação real (Prisma) de `AutopilotStore` (lib/autopilot.ts).
 * Usa `Workspace.automationPaused`/`automationMode` (Rodada 5) e `AuditLog`
 * para trilha/limites — nenhuma tabela nova além da migração de workspace
 * já aplicada.
 */

import { prisma } from './prisma'
import type { AutopilotAuditEntry, AutopilotStore, WorkspaceAutomationControls } from './autopilot'

const ACTION_PUBLICADO = 'autopilot.published'

export class AutopilotStorePrisma implements AutopilotStore {
  async getWorkspaceControls(workspaceId: string): Promise<WorkspaceAutomationControls> {
    const ws = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { automationPaused: true, automationMode: true },
    })
    const modo = ws.automationMode === 'ASSISTED' || ws.automationMode === 'AUTOMATIC' ? ws.automationMode : 'MANUAL'
    return { automationPaused: ws.automationPaused, automationMode: modo }
  }

  async registrarAuditoria(workspaceId: string, entry: AutopilotAuditEntry): Promise<void> {
    await prisma.auditLog.create({
      data: {
        workspaceId,
        action: `autopilot.${entry.step}`,
        entityType: 'Autopilot',
        entityId: workspaceId,
        metadata: { detail: entry.detail, produto: entry.productName ?? null },
      },
    })
  }

  private inicioDoDia(): Date {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }

  async publicacoesHoje(workspaceId: string): Promise<number> {
    return prisma.auditLog.count({
      where: { workspaceId, action: ACTION_PUBLICADO, createdAt: { gte: this.inicioDoDia() } },
    })
  }

  async ultimaPublicacaoEm(workspaceId: string): Promise<Date | null> {
    const ultimo = await prisma.auditLog.findFirst({
      where: { workspaceId, action: ACTION_PUBLICADO },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    return ultimo?.createdAt ?? null
  }

  async produtosPublicadosHoje(workspaceId: string): Promise<string[]> {
    const logs = await prisma.auditLog.findMany({
      where: { workspaceId, action: ACTION_PUBLICADO, createdAt: { gte: this.inicioDoDia() } },
      select: { metadata: true },
    })
    return logs
      .map((l) => (l.metadata as { produto?: string } | null)?.produto)
      .filter((p): p is string => typeof p === 'string')
  }
}
