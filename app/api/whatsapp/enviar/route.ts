import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizarNumero } from '@/lib/whatsapp'
import { iniciarTrabalhoLongo } from '@/lib/trabalho-longo'
import { executorDoEnvio, chaveDoEnvio, intervaloEntreEnvios } from '@/lib/trabalhos-longos/envio-whatsapp'

// 3 s entre números: 11 números já passam do limite síncrono de 30 s da
// Netlify. O envio vira trabalho longo; esta rota valida e registra.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_plataforma: { workspaceId: session.user.workspaceId, plataforma: 'whatsapp' } },
  })
  if (!integracao || integracao.status !== 'conectado' || !integracao.accountId || !integracao.accessToken) {
    return NextResponse.json({ error: 'WhatsApp não configurado. Configure em Integrações.' }, { status: 400 })
  }

  const body = await req.json() as {
    numeros: string[]
    mensagem: string
    imagemUrl?: string
    delayMs?: number
    chaveDoEnvio?: string
  }

  if (!body.numeros?.length || !body.mensagem) {
    return NextResponse.json({ error: 'Informe os números e a mensagem' }, { status: 400 })
  }

  // Filtra e normaliza números (sem repetir: a mesma pessoa recebe uma vez)
  const numerosValidos = [...new Set(
    body.numeros
      .map((n) => normalizarNumero(n))
      .filter((n): n is string => n !== null)
  )]

  if (numerosValidos.length === 0) {
    return NextResponse.json({ error: 'Nenhum número válido encontrado' }, { status: 400 })
  }

  const agora = new Date()
  const pedido = {
    numeros: numerosValidos,
    mensagem: body.mensagem,
    ...(body.imagemUrl ? { imagemUrl: body.imagemUrl } : {}),
    delayMs: intervaloEntreEnvios(body.delayMs), // mínimo 1.5s para não ser banido
  }

  // O workspace da sessão é o que o gate usa para apurar o orçamento: o
  // executor envia com o workspace do trabalho, que é este
  // (session.user.workspaceId).
  const r = await iniciarTrabalhoLongo({
    workspaceId: session.user.workspaceId,
    tipo: 'LONGO_ENVIO_WHATSAPP',
    chave: chaveDoEnvio(pedido, agora, body.chaveDoEnvio),
    entityType: 'INTEGRACAO',
    entityId: integracao.id,
    contexto: { pedido },
    executor: executorDoEnvio(),
    origem: req.nextUrl.origin,
    mensagemDeProcessando: `Enviando para ${numerosValidos.length} contato(s). Acompanhe nesta tela.`,
    agora,
  })
  return NextResponse.json(r.resposta.corpo, { status: r.resposta.status })
}
