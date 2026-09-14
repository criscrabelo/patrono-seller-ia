import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/audit-log'
import { uploadBufferPrivado, criarUrlAssinada } from '@/lib/supabase'

const BUCKET_PRIVADO = 'digital-twin-private'
const TIPOS_VALIDOS = ['FACE_IMAGE', 'REFERENCE_VIDEO', 'VOICE_REFERENCE', 'CONSENT_EVIDENCE', 'GENERATED_PREVIEW']

/** Lista assets do PRÓPRIO workspace, com URL assinada temporária (nunca pública/permanente). */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const profile = await prisma.digitalTwinProfile.findUnique({ where: { workspaceId: session.user.workspaceId } })
  if (!profile) return NextResponse.json([])

  const assets = await prisma.digitalTwinAsset.findMany({
    where: { workspaceId: session.user.workspaceId, profileId: profile.id, active: true },
    orderBy: { createdAt: 'desc' },
  })

  const comUrl = await Promise.all(
    assets.map(async (a) => ({
      id: a.id,
      type: a.type,
      mimeType: a.mimeType,
      purpose: a.purpose,
      createdAt: a.createdAt,
      url: await criarUrlAssinada(BUCKET_PRIVADO, a.storagePath, 300),
    }))
  )

  return NextResponse.json(comUrl)
}

/** Upload de referência (foto/vídeo/voz) — sempre no bucket privado, nunca URL pública permanente. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const profile = await prisma.digitalTwinProfile.findUnique({ where: { workspaceId: session.user.workspaceId } })
  if (!profile) return NextResponse.json({ error: 'Crie o perfil do Digital Twin antes de enviar referências.' }, { status: 400 })

  const form = await req.formData()
  const type = form.get('type')
  const file = form.get('file')
  const purpose = form.get('purpose')

  if (typeof type !== 'string' || !TIPOS_VALIDOS.includes(type)) {
    return NextResponse.json({ error: `type precisa ser um de: ${TIPOS_VALIDOS.join(', ')}` }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file é obrigatório.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const storagePath = `${session.user.workspaceId}/${profile.id}/${type.toLowerCase()}-${Date.now()}`
  await uploadBufferPrivado(buffer, BUCKET_PRIVADO, storagePath, file.type || 'application/octet-stream')

  const asset = await prisma.digitalTwinAsset.create({
    data: {
      workspaceId: session.user.workspaceId,
      profileId: profile.id,
      type,
      storagePath,
      mimeType: file.type || 'application/octet-stream',
      purpose: typeof purpose === 'string' ? purpose : null,
    },
  })

  await registrarAuditoria({
    workspaceId: session.user.workspaceId,
    userId: session.user.id,
    action: 'digital_twin.asset_uploaded',
    entityType: 'DigitalTwinAsset',
    entityId: asset.id,
    metadata: { type }, // nunca o conteúdo do arquivo, nunca o storagePath em log público
  })

  return NextResponse.json({ id: asset.id, type: asset.type, createdAt: asset.createdAt })
}
