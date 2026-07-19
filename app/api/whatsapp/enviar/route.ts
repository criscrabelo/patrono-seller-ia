import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getContaAtivaId } from '@/lib/conta'
import { enviarTexto, enviarImagem, normalizarNumero } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const contaId = await getContaAtivaId(session.user.id)
  if (!contaId) return NextResponse.json({ error: 'Nenhuma marca configurada' }, { status: 400 })

  const integracao = await prisma.integracao.findUnique({
    where: { contaId_plataforma: { contaId, plataforma: 'whatsapp' } },
  })
  if (!integracao || integracao.status !== 'conectado' || !integracao.accountId || !integracao.accessToken) {
    return NextResponse.json({ error: 'WhatsApp não configurado. Configure em Integrações.' }, { status: 400 })
  }

  const body = await req.json() as {
    numeros: string[]
    mensagem: string
    imagemUrl?: string
    delayMs?: number
  }

  if (!body.numeros?.length || !body.mensagem) {
    return NextResponse.json({ error: 'Informe os números e a mensagem' }, { status: 400 })
  }

  const extra = (integracao.extraData ?? {}) as Record<string, string>
  const cfg = {
    instanceId: integracao.accountId,
    token: integracao.accessToken,
    clientToken: extra.clientToken,
  }

  // Filtra e normaliza números
  const numerosValidos = body.numeros
    .map((n) => normalizarNumero(n))
    .filter((n): n is string => n !== null)

  if (numerosValidos.length === 0) {
    return NextResponse.json({ error: 'Nenhum número válido encontrado' }, { status: 400 })
  }

  const delay = Math.max(body.delayMs ?? 3000, 1500) // mínimo 1.5s para não ser banido
  const resultados = []

  for (let i = 0; i < numerosValidos.length; i++) {
    const numero = numerosValidos[i]
    const resultado = body.imagemUrl
      ? await enviarImagem(cfg, { numero, imageUrl: body.imagemUrl, legenda: body.mensagem })
      : await enviarTexto(cfg, { numero, mensagem: body.mensagem })
    resultados.push(resultado)
    if (i < numerosValidos.length - 1) {
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  const enviados = resultados.filter((r) => r.ok).length
  const erros = resultados.filter((r) => !r.ok).length

  return NextResponse.json({ ok: true, enviados, erros, resultados })
}
