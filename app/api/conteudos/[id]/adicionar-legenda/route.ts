import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { iniciarTrabalhoLongo } from '@/lib/trabalho-longo'
import {
  executorDaLegenda,
  montarPedidoDeLegenda,
  chaveDaLegenda,
  textoDaLegenda,
} from '@/lib/trabalhos-longos/legenda-video'

// Processar legendas pode levar ~30-60s. Na Netlify (limite síncrono de 30 s)
// o trabalho vai para a Background Function; aqui só se valida e registra.
// Fora dela, o mesmo executor roda dentro da requisição.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const preset = typeof body.preset === 'string' ? body.preset : 'glass'

  const conteudo = await prisma.conteudo.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
  })
  if (!conteudo) return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })
  if (!conteudo.videoUrl) {
    return NextResponse.json({ error: 'Este conteúdo não tem vídeo. Gere ou envie o vídeo primeiro.' }, { status: 400 })
  }

  // Texto da legenda: prioriza narração (mais longa), depois textoTela, depois chamadaAcao
  if (!textoDaLegenda(conteudo)) {
    return NextResponse.json(
      { error: 'O conteúdo não tem texto para usar como legenda (narração, textoTela ou chamadaAcao).' },
      { status: 400 }
    )
  }

  const pedido = montarPedidoDeLegenda({
    conteudo: { ...conteudo, videoUrl: conteudo.videoUrl },
    userId: session.user.id,
    preset,
  })
  const r = await iniciarTrabalhoLongo({
    workspaceId: session.user.workspaceId,
    tipo: 'LONGO_LEGENDA_VIDEO',
    chave: chaveDaLegenda(pedido),
    entityType: 'CONTEUDO',
    entityId: conteudo.id,
    contexto: { pedido },
    executor: executorDaLegenda(),
    origem: req.nextUrl.origin,
    mensagemDeProcessando: 'A legenda está sendo gerada. Aguarde nesta tela.',
  })
  return NextResponse.json(r.resposta.corpo, { status: r.resposta.status })
}
