import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { criarUrlAssinada } from '@/lib/supabase'
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

/**
 * P2.11 — o upload pela função foi DESATIVADO: foto, vídeo e voz não passam
 * mais pela hospedagem (P2.10). O navegador envia direto ao bucket privado
 * (`assets/url-de-envio` → storage → `assets/confirmar`). Esta resposta não
 * lê o corpo: nenhum byte do arquivo é processado aqui.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Envio por esta rota desativado. Use o envio direto (assets/url-de-envio).', codigo: 'USE_UPLOAD_DIRETO' },
    { status: 410 }
  )
}
