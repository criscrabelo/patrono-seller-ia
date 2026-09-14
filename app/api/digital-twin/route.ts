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

  // Saúde do worker de geração — só aparece em Configurações/Digital Twin, nunca na Home.
  const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000)
  const workers = await prisma.generationWorkerHealth.findMany({
    where: { lastSeenAt: { gte: cincoMinutosAtras } },
    select: { workerId: true, gpuDetected: true, gpuName: true, vramGB: true, version: true, lastSeenAt: true },
  })

  // Preferências globais (regra 50) não fazem parte do tipo de domínio
  // DigitalTwinProfile — buscadas direto do banco para a tela.
  const preferencias = contexto.profile
    ? await prisma.digitalTwinProfile.findUnique({
        where: { id: contexto.profile.id },
        select: { autoUseDigitalTwin: true, autoUseVoice: true, allowFallback: true, priorityChannel: true, defaultStyle: true },
      })
    : null

  return NextResponse.json({
    profile: contexto.profile ? { ...contexto.profile, ...preferencias } : null,
    voiceProfile: contexto.voiceProfile ? { ...contexto.voiceProfile, referenceAudio: undefined } : null,
    identityConsent: contexto.identityConsent,
    voiceConsent: contexto.voiceConsent,
    podeGerar: decisao,
    runtime,
    workers,
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

const CANAIS_VALIDOS = ['tiktok', 'instagram']
const ESTILOS_VALIDOS = ['presenter', 'unboxing']

/** Preferências globais (regra 50) — nunca perguntadas a cada postagem. */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const profile = await prisma.digitalTwinProfile.findUnique({ where: { workspaceId: session.user.workspaceId } })
  if (!profile) return NextResponse.json({ error: 'Crie o perfil do Digital Twin primeiro.' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.autoUseDigitalTwin === 'boolean') data.autoUseDigitalTwin = body.autoUseDigitalTwin
  if (typeof body.autoUseVoice === 'boolean') data.autoUseVoice = body.autoUseVoice
  if (typeof body.allowFallback === 'boolean') data.allowFallback = body.allowFallback
  if (typeof body.priorityChannel === 'string' && CANAIS_VALIDOS.includes(body.priorityChannel)) data.priorityChannel = body.priorityChannel
  if (typeof body.defaultStyle === 'string' && ESTILOS_VALIDOS.includes(body.defaultStyle)) data.defaultStyle = body.defaultStyle

  const atualizado = await prisma.digitalTwinProfile.update({ where: { id: profile.id }, data })

  await registrarAuditoria({
    workspaceId: session.user.workspaceId,
    userId: session.user.id,
    action: 'digital_twin.preferences_updated',
    entityType: 'DigitalTwinProfile',
    entityId: profile.id,
    metadata: data,
  })

  return NextResponse.json(atualizado)
}
