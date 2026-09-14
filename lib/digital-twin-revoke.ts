/**
 * Revogação de consentimento (Rodada 7, regra 8). Ao revogar identidade
 * OU voz: impede novas gerações, desativa `VoiceProfile` e
 * `DigitalTwinProfile` (kill switch), e mantém só os registros mínimos de
 * auditoria — nunca apaga o histórico de consentimento em si (é prova de
 * que existiu e foi revogado).
 */

import { prisma } from './prisma'
import { registrarAuditoria } from './audit-log'

export async function revogarIdentityConsent(workspaceId: string, consentId: string, userId?: string) {
  const consent = await prisma.identityConsent.findFirst({ where: { id: consentId, workspaceId } })
  if (!consent) throw new Error('Consentimento de identidade não encontrado neste workspace.')

  await prisma.$transaction([
    prisma.identityConsent.update({ where: { id: consentId }, data: { status: 'REVOKED', revokedAt: new Date() } }),
    prisma.digitalTwinProfile.updateMany({ where: { workspaceId, identityConsentId: consentId }, data: { enabled: false } }),
  ])

  await registrarAuditoria({
    workspaceId,
    userId: userId ?? null,
    action: 'digital_twin.identity_consent_revoked',
    entityType: 'IdentityConsent',
    entityId: consentId,
    metadata: {}, // nunca material biométrico
  })
}

export async function revogarVoiceConsent(workspaceId: string, consentId: string, userId?: string) {
  const consent = await prisma.voiceConsent.findFirst({ where: { id: consentId, workspaceId } })
  if (!consent) throw new Error('Consentimento de voz não encontrado neste workspace.')

  await prisma.$transaction([
    prisma.voiceConsent.update({ where: { id: consentId }, data: { status: 'REVOKED', revokedAt: new Date() } }),
    prisma.voiceProfile.updateMany({ where: { workspaceId, consentId }, data: { enabled: false } }),
  ])

  const voiceProfile = await prisma.voiceProfile.findFirst({ where: { workspaceId, consentId } })
  if (voiceProfile) {
    await prisma.digitalTwinProfile.updateMany({ where: { workspaceId, voiceProfileId: voiceProfile.id }, data: { enabled: false } })
  }

  await registrarAuditoria({
    workspaceId,
    userId: userId ?? null,
    action: 'digital_twin.voice_consent_revoked',
    entityType: 'VoiceConsent',
    entityId: consentId,
    metadata: {},
  })
}
