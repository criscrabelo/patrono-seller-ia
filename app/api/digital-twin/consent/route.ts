import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/audit-log'
import { revogarIdentityConsent, revogarVoiceConsent } from '@/lib/digital-twin-revoke'

/** Registra consentimento (identidade ou voz) — sempre GRANTED explicitamente pela própria titular. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { tipo, purpose } = body as { tipo?: 'identity' | 'voice'; purpose?: string }
  if (tipo !== 'identity' && tipo !== 'voice') {
    return NextResponse.json({ error: 'tipo precisa ser "identity" ou "voice".' }, { status: 400 })
  }
  if (!purpose || typeof purpose !== 'string') {
    return NextResponse.json({ error: 'purpose (finalidade) é obrigatório.' }, { status: 400 })
  }

  const dataConsent = {
    workspaceId: session.user.workspaceId,
    subjectUserId: session.user.id,
    purpose,
    status: 'GRANTED',
    grantedAt: new Date(),
  }

  const consent =
    tipo === 'identity' ? await prisma.identityConsent.create({ data: dataConsent }) : await prisma.voiceConsent.create({ data: dataConsent })

  await registrarAuditoria({
    workspaceId: session.user.workspaceId,
    userId: session.user.id,
    action: `digital_twin.${tipo}_consent_granted`,
    entityType: tipo === 'identity' ? 'IdentityConsent' : 'VoiceConsent',
    entityId: consent.id,
    metadata: { purpose },
  })

  return NextResponse.json(consent)
}

/** Revogação — impede novas gerações imediatamente (lib/digital-twin-revoke.ts). */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo')
  const consentId = searchParams.get('consentId')
  if (!consentId || (tipo !== 'identity' && tipo !== 'voice')) {
    return NextResponse.json({ error: 'tipo e consentId são obrigatórios.' }, { status: 400 })
  }

  try {
    if (tipo === 'identity') await revogarIdentityConsent(session.user.workspaceId, consentId, session.user.id)
    else await revogarVoiceConsent(session.user.workspaceId, consentId, session.user.id)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao revogar.' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
