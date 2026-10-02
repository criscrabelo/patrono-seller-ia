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
import {
  prepararTentativaDePublicacao,
  confirmarDistribuicao,
  registrarFalhaDaTentativa,
  respostaDeRastreamento,
} from '@/lib/publicacao-fluxo'
import { autorizarPublicacaoReal } from '@/lib/porta-de-publicacao-real'
import { chaveDaTentativaPadrao } from '@/lib/link-de-publicacao'
import { urlVaiNaLegenda } from '@/lib/capacidade-real-do-adapter'

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

  // P1.9.2: A PORTA ÚNICA. Antes daqui, esta rota publicava sem preflight,
  // sem a flag PUBLICACAO_REAL_INSTAGRAM, sem direito de mídia e sem link
  // na bio — inclusive as imagens do produto. Agora nenhuma conexão com a
  // Meta abre sem `executavelAgora`.
  const chaveDaTentativa =
    (typeof body?.chaveDaTentativa === 'string' && body.chaveDaTentativa.trim()) ||
    chaveDaTentativaPadrao({ contentId: conteudo.id, canal: 'instagram', dataAgendamento: conteudo.dataAgendamento })
  const porta = await autorizarPublicacaoReal({
    workspaceId: session.user.workspaceId,
    contentId: conteudo.id,
    canal: 'instagram',
    chaveDaTentativa,
    envio: { tipoMidia, destino },
  })
  if (!porta.liberada) {
    return NextResponse.json(
      { error: porta.explicacao, bloqueio: porta.bloqueio },
      { status: 409 }
    )
  }

  // P1.0 Etapa 2.c: a tentativa passa pela AUTORIDADE CENTRAL. Ela cria ou
  // reusa a Publicacao, obtem o link rastreado, valida o vinculo pelo guard
  // e move o estado para DISTRIBUINDO — tudo antes de falar com a Meta.
  //
  // `workspaceId` vem da SESSAO, nunca do corpo. `chaveDaTentativa` pode vir
  // do corpo: e a intencao de quem publica, e e ela que separa retry de
  // republicacao.
  const tentativa = await prepararTentativaDePublicacao({
    workspaceId: session.user.workspaceId,
    contentId: conteudo.id,
    canal: 'instagram',
    chaveDaTentativa,
    urlDiretaDoProduto: conteudo.produto?.linkProduto ?? null,
    dataAgendamento: conteudo.dataAgendamento,
  })

  // P1.9.2: a legenda é a que o preflight aprovou — com CTA e hashtags já
  // dentro. Remontá-la aqui duplicaria a CTA e, no Instagram, colaria uma
  // URL que não é clicável (o link rastreado vai na bio).
  const legenda = urlVaiNaLegenda('instagram')
    ? montarLegenda(conteudo.legendaInstagram, [], null, tentativa.urlParaDivulgar)
    : (conteudo.legendaInstagram ?? '').trim()
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
      // Falha REAL do provider — a midia nao vai ao ar. "Ainda processando"
      // nao passa por aqui: aquilo e retry, e retry reusa a mesma tentativa.
      if (tentativa.publicacao) {
        await registrarFalhaDaTentativa({
          workspaceId: session.user.workspaceId,
          publicacaoId: tentativa.publicacao.id,
        })
      }
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
    // A distribuicao esta CONFIRMADA pelo canal: id externo e instante reais.
    // O id passa por normalizarPublicacaoExternaId dentro do repositorio.
    if (tentativa.publicacao) {
      await confirmarDistribuicao({
        workspaceId: session.user.workspaceId,
        publicacaoId: tentativa.publicacao.id,
        publicacaoExternaId: mediaId,
        distribuidaEm: new Date(),
      })
    }
    // GATILHO A (P0.2 Bloco 4.1): publicação real → captura da amostra sem
    // rótulo. Nunca lança; publicar não pode falhar por causa do ML.
    await capturarSnapshotDePublicacao({
      workspaceId: conteudo.workspaceId,
      contentId: conteudo.id,
    })
    return NextResponse.json({
      ok: true,
      mediaId,
      // A lacuna viaja na resposta com FRASE PRONTA. A `explicacao` interna
      // fica de fora: ela cita o valor de PUBLIC_BASE_URL e o caminho que
      // falhou — diagnostico de servidor, nao texto de tela.
      rastreamento: respostaDeRastreamento(tentativa),
    })
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
