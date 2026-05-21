import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  criarContainerReel,
  statusContainer,
  publicarContainer,
  montarLegenda,
} from '@/lib/instagram'

// Publicar um Reels pode levar até ~50s (processamento do vídeo na Meta).
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Prefixo usado para guardar o ID do container do Instagram dentro do
// campo videoRequestId (reaproveitado — só existe após o vídeo estar pronto).
const PREFIXO_CONTAINER = 'ig:'

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

  const accessToken = integracao.accessToken
  const igUserId = integracao.accountId

  try {
    // Reaproveita o container da tentativa anterior (se houver) para não
    // recomeçar o processamento do zero a cada clique.
    let containerId: string
    const vri = conteudo.videoRequestId
    if (vri && vri.startsWith(PREFIXO_CONTAINER)) {
      containerId = vri.slice(PREFIXO_CONTAINER.length)
    } else {
      containerId = await criarContainerReel({
        accessToken,
        igUserId,
        videoUrl: conteudo.videoUrl,
        legenda: montarLegenda(conteudo.legendaInstagram, conteudo.hashtags),
      })
      await prisma.conteudo.update({
        where: { id: conteudo.id },
        data: { videoRequestId: PREFIXO_CONTAINER + containerId },
      })
    }

    // Aguarda o Instagram processar o vídeo (~45s, dentro do limite de 60s).
    let status = 'IN_PROGRESS'
    for (let i = 0; i < 9; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      status = await statusContainer({ accessToken, containerId })
      if (status === 'FINISHED' || status === 'ERROR' || status === 'EXPIRED') break
    }

    if (status === 'ERROR' || status === 'EXPIRED') {
      await prisma.conteudo.update({
        where: { id: conteudo.id },
        data: {
          videoRequestId: null,
          erroPublicacao: `O Instagram não conseguiu processar o vídeo (${status}). Gere o vídeo novamente.`,
        },
      })
      return NextResponse.json(
        { error: `Instagram falhou ao processar o vídeo (${status})` },
        { status: 502 }
      )
    }

    if (status !== 'FINISHED') {
      // Ainda processando — mantém o container salvo para reaproveitar no próximo clique.
      const msg =
        'O vídeo ainda está sendo processado pelo Instagram. Espere ~30s e clique em ' +
        '"Publicar no Instagram agora" de novo — ele continua de onde parou.'
      await prisma.conteudo.update({
        where: { id: conteudo.id },
        data: { erroPublicacao: msg },
      })
      return NextResponse.json({ ok: false, processando: true, mensagem: msg })
    }

    // FINISHED → publica de fato
    const mediaId = await publicarContainer({ accessToken, igUserId, containerId })
    await prisma.conteudo.update({
      where: { id: conteudo.id },
      data: {
        status: 'publicado',
        dataPublicacao: new Date(),
        publicacaoExternaId: mediaId,
        erroPublicacao: null,
        videoRequestId: null,
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
