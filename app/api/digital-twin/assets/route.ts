import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/audit-log'
import { uploadBufferPrivado, criarUrlAssinada } from '@/lib/supabase'
import { calcularExpiracaoPreview } from '@/lib/digital-twin-retention'
import { DIGITAL_TWIN_ASSET_TYPES, ehTipoDeAssetValido } from '@/lib/digital-twin-asset-types'
import { BUCKET_DIGITAL_TWIN_PRIVADO as BUCKET_PRIVADO } from '@/lib/digital-twin-store'

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

  if (typeof type !== 'string' || !ehTipoDeAssetValido(type)) {
    return NextResponse.json({ error: `type precisa ser um de: ${DIGITAL_TWIN_ASSET_TYPES.join(', ')}` }, { status: 400 })
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
      // Prévias geradas expiram (limpeza automática) — referências
      // permanentes de identidade/voz nunca expiram por esta rotina.
      expiresAt: type === 'GENERATED_PREVIEW' ? calcularExpiracaoPreview() : null,
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
