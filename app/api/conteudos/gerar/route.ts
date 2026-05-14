import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { gerarConteudo } from '@/lib/claude'
import { z } from 'zod'

const gerarSchema = z.object({
  produtoId: z.string().min(1),
  redeSocial: z.string().min(1),
  duracao: z.number().positive(),
  estilo: z.string().min(1),
  objetivo: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = gerarSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const { produtoId, redeSocial, duracao, estilo, objetivo } = parsed.data

  const produto = await prisma.produto.findFirst({
    where: { id: produtoId, userId: session.user.id },
  })

  if (!produto) {
    return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  const gerado = await gerarConteudo(
    {
      nome: produto.nome,
      preco: produto.preco,
      categoria: produto.categoria,
      publicoAlvo: produto.publicoAlvo,
      tipoVenda: produto.tipoVenda,
      origemConteudo: produto.origemConteudo,
      descricao: produto.descricao ?? undefined,
      observacoes: produto.observacoes ?? undefined,
      beneficios: produto.beneficios,
      pontosNegativos: produto.pontosNegativos,
    },
    { redeSocial, duracao, estilo, objetivo }
  )

  const conteudo = await prisma.conteudo.create({
    data: {
      userId: session.user.id,
      produtoId,
      redeSocial,
      duracao,
      estilo,
      objetivo,
      roteiro: gerado.roteiro,
      legendaTiktok: gerado.legendaTiktok,
      legendaInstagram: gerado.legendaInstagram,
      legendaYoutube: gerado.legendaYoutube,
      legendaWhatsapp: gerado.legendaWhatsapp,
      legendaMarketplace: gerado.legendaMarketplace,
      hashtags: gerado.hashtags,
      textoTela: gerado.textoTela,
      narracao: gerado.narracao,
      trilhaSugerida: gerado.trilhaSugerida,
      promptVideoIA: gerado.promptVideoIA,
      promptCurto: gerado.promptCurto,
      chamadaAcao: gerado.chamadaAcao,
      notaProduto: gerado.notaProduto,
      pontosPositivos: gerado.pontosPositivos,
      pontosNegativos: gerado.pontosNegativos,
      veredito: gerado.veredito,
      alertasCompliance: gerado.alertasCompliance as object[],
      status: 'roteiro_gerado',
    },
  })

  return NextResponse.json(conteudo, { status: 201 })
}
