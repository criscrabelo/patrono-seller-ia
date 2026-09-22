import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { capturarSnapshotDePublicacao } from '@/lib/ml-captura-publicacao'
import {
  criarContainerReel,
  criarContainerStoryVideo,
  criarContainerImagemFeed,
  criarContainerStoryImagem,
  criarContainerCarrossel,
  statusContainer,
  publicarContainer,
  montarLegenda,
} from '@/lib/instagram'
import { LINK_COMPRA } from '@/lib/config'

// Publicar pode levar até ~50s (processamento do vídeo na Meta).
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Prefixo usado para guardar o ID do container do Instagram em videoRequestId.
const PREFIXO_CONTAINER = 'ig:'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const tipoMidia: 'video' | 'imagens' = body.tipoMidia === 'imagens' ? 'imagens' : 'video'
  const destino: 'feed' | 'stories' = body.destino === 'stories' ? 'stories' : 'feed'

  const conteudo = await prisma.conteudo.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
    include: { produto: { select: { linkProduto: true, imagens: true } } },
  })
  if (!conteudo) {
    return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })
  }

  const imagens = conteudo.produto?.imagens ?? []
  if (tipoMidia === 'video' && !conteudo.videoUrl) {
    return NextResponse.json(
      { error: 'Este conteúdo não tem vídeo. Gere o vídeo ou escolha publicar as imagens.' },
      { status: 400 }
    )
  }
  if (tipoMidia === 'imagens' && imagens.length === 0) {
    return NextResponse.json(
      { error: 'O produto não tem imagens cadastradas.' },
      { status: 400 }
    )
  }

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_plataforma: { workspaceId: session.user.workspaceId, plataforma: 'instagram' } },
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
  const legenda = montarLegenda(
    conteudo.legendaInstagram,
    conteudo.hashtags,
    conteudo.chamadaAcao,
    conteudo.produto?.linkProduto || LINK_COMPRA
  )
  const ehVideo = tipoMidia === 'video'

  try {
    // Reaproveita o container da tentativa anterior (apenas para vídeo, que
    // tem processamento lento). Imagens criam container novo a cada chamada.
    let containerId: string
    const vri = conteudo.videoRequestId
    if (ehVideo && vri && vri.startsWith(PREFIXO_CONTAINER)) {
      containerId = vri.slice(PREFIXO_CONTAINER.length)
    } else {
      if (tipoMidia === 'video' && destino === 'feed') {
        containerId = await criarContainerReel({
          accessToken, igUserId, videoUrl: conteudo.videoUrl!, legenda,
        })
      } else if (tipoMidia === 'video' && destino === 'stories') {
        containerId = await criarContainerStoryVideo({
          accessToken, igUserId, videoUrl: conteudo.videoUrl!,
        })
      } else if (tipoMidia === 'imagens' && destino === 'feed') {
        containerId = imagens.length > 1
          ? await criarContainerCarrossel({ accessToken, igUserId, imageUrls: imagens, legenda })
          : await criarContainerImagemFeed({ accessToken, igUserId, imageUrl: imagens[0], legenda })
      } else {
        // imagens + stories — publica a imagem de capa (primeira)
        containerId = await criarContainerStoryImagem({
          accessToken, igUserId, imageUrl: imagens[0],
        })
      }
      if (ehVideo) {
        await prisma.conteudo.update({
          where: { id: conteudo.id },
          data: { videoRequestId: PREFIXO_CONTAINER + containerId },
        })
      }
    }

    // Aguarda o processamento. Vídeo demora; imagem é quase instantânea.
    const maxPolls = ehVideo ? 9 : 4
    let status = 'IN_PROGRESS'
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      status = await statusContainer({ accessToken, containerId })
      if (status === 'FINISHED' || status === 'ERROR' || status === 'EXPIRED') break
    }

    if (status === 'ERROR' || status === 'EXPIRED') {
      await prisma.conteudo.update({
        where: { id: conteudo.id },
        data: {
          videoRequestId: null,
          erroPublicacao: `O Instagram não conseguiu processar a mídia (${status}).`,
        },
      })
      return NextResponse.json(
        { error: `Instagram falhou ao processar a mídia (${status})` },
        { status: 502 }
      )
    }

    if (status !== 'FINISHED') {
      const msg =
        'A mídia ainda está sendo processada pelo Instagram. Espere ~30s e clique em ' +
        '"Publicar" de novo — continua de onde parou.'
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
    // GATILHO A (P0.2 Bloco 4.1): publicação real → captura da amostra sem
    // rótulo. Nunca lança; publicar não pode falhar por causa do ML.
    await capturarSnapshotDePublicacao({
      workspaceId: conteudo.workspaceId,
      contentId: conteudo.id,
    })
    return NextResponse.json({ ok: true, mediaId })
  } catch (e) {
    const raw = e instanceof Error ? e.message : 'Falha ao publicar no Instagram'
    const lower = raw.toLowerCase()

    const isOAuthError =
      lower.includes('oauth') ||
      lower.includes('access token') ||
      lower.includes('invalid token') ||
      lower.includes('token expired')

    // "API access blocked" = app Meta sem permissão instagram_content_publish
    // ou conta não é Business/Creator
    const isPermissaoError =
      lower.includes('api access blocked') ||
      lower.includes('access blocked') ||
      lower.includes('(#200)') ||
      lower.includes('permissions error') ||
      lower.includes("the user hasn") ||
      lower.includes('application to perform this action')

    const msg = isPermissaoError
      ? 'API access blocked — seu app Meta não tem a permissão "instagram_content_publish" aprovada. ' +
        'Verifique: (1) sua conta Instagram é Business ou Creator (não pessoal); ' +
        '(2) o app no Meta for Developers tem a permissão instagram_content_publish; ' +
        '(3) se o app está em modo desenvolvimento, adicione seu usuário como Tester em Meta → App Roles → Roles.'
      : raw

    await Promise.all([
      prisma.conteudo.update({
        where: { id: conteudo.id },
        data: { erroPublicacao: msg },
      }),
      isOAuthError
        ? prisma.integracao.updateMany({
            where: { workspaceId: session.user.workspaceId, plataforma: 'instagram' },
            data: { status: 'desconectado', accessToken: null },
          })
        : Promise.resolve(),
    ])

    return NextResponse.json({ error: msg, oauthError: isOAuthError, permissaoError: isPermissaoError }, { status: 502 })
  }
}
