import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/audit-log'
import { carregarContextoDigitalTwin } from '@/lib/digital-twin-store'
import { podeGerarComDigitalTwin } from '@/lib/digital-twin'
import { detectarCapacidadesRuntime } from '@/lib/digital-twin-runtime'

/** Status do Digital Twin do workspace da sessão — nunca aceita workspaceId do cliente. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const contexto = await carregarContextoDigitalTwin(session.user.workspaceId)
  const decisao = podeGerarComDigitalTwin(contexto)
  const runtime = await detectarCapacidadesRuntime()

  return NextResponse.json({
    profile: contexto.profile,
    voiceProfile: contexto.voiceProfile ? { ...contexto.voiceProfile, referenceAudio: undefined } : null,
    identityConsent: contexto.identityConsent,
    voiceConsent: contexto.voiceConsent,
    podeGerar: decisao,
    runtime,
  })
}

/** Bootstrap do perfil (etapa 0 do onboarding) — nasce sempre desativado. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const existente = await prisma.digitalTwinProfile.findUnique({ where: { workspaceId: session.user.workspaceId } })
  if (existente) return NextResponse.json(existente)

  const body = await req.json().catch(() => ({}))
  const displayName = typeof body.displayName === 'string' && body.displayName.trim() ? body.displayName.trim() : 'Meu Digital Twin'

  const profile = await prisma.digitalTwinProfile.create({
    data: {
      workspaceId: session.user.workspaceId,
      ownerUserId: session.user.id,
      displayName,
      enabled: false,
    },
  })

  await registrarAuditoria({
    workspaceId: session.user.workspaceId,
    userId: session.user.id,
    action: 'digital_twin.profile_created',
    entityType: 'DigitalTwinProfile',
    entityId: profile.id,
    metadata: {},
  })

  return NextResponse.json(profile)
}
