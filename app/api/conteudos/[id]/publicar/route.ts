import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { publicarReelInstagram, montarLegenda } from '@/lib/instagram'

// Publicar um Reels pode levar até ~50s (processamento do vídeo na Meta).
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const conteudo = await prisma.conteudo.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!conteudo) {
    return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })
  }
  if (!conteudo.videoUrl) {
    return NextResponse.json(
      { error: 'Faça o upload do vídeo antes de publicar.' },
      { status: 400 }
    )
  }

  const integracao = await prisma.integracao.findUnique({
    where: { userId_plataforma: { userId: session.user.id, plataforma: 'instagram' } },
  })
  if (
    !integracao ||
    integracao.status !== 'conectado' ||
    !integracao.accessToken ||
    !integracao.accountId
  ) {
    return NextResponse.json(
      { error: 'Conecte o Instagram em Integrações antes de publicar.' },
      { status: 400 }
    )
  }

  try {
    const mediaId = await publicarReelInstagram({
      accessToken: integracao.accessToken,
      igUserId: integracao.accountId,
      videoUrl: conteudo.videoUrl,
      legenda: montarLegenda(conteudo.legendaInstagram, conteudo.hashtags),
    })

    await prisma.conteudo.update({
      where: { id: conteudo.id },
      data: {
        status: 'publicado',
        dataPublicacao: new Date(),
        publicacaoExternaId: mediaId,
        erroPublicacao: null,
      },
    })

    return NextResponse.json({ ok: true, mediaId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao publicar no Instagram'

    const isOAuthError =
      msg.toLowerCase().includes('oauth') ||
      msg.toLowerCase().includes('access token') ||
      msg.toLowerCase().includes('invalid token') ||
      msg.toLowerCase().includes('token expired')

    await Promise.all([
      prisma.conteudo.update({
        where: { id: conteudo.id },
        data: { erroPublicacao: msg },
      }),
      isOAuthError
        ? prisma.integracao.updateMany({
            where: { userId: session.user.id, plataforma: 'instagram' },
            data: { status: 'desconectado', accessToken: null },
          })
        : Promise.resolve(),
    ])

    return NextResponse.json({ error: msg, oauthError: isOAuthError }, { status: 502 })
  }
}
