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
  tipoConteudo: z.enum(['video', 'video_imagens', 'imagens']).optional().default('video'),
})

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = gerarSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const { produtoId, redeSocial, duracao, estilo, objetivo, tipoConteudo } = parsed.data

  const produto = await prisma.produto.findFirst({
    where: { id: produtoId, userId: session.user.id },
  })

  if (!produto) {
    return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  const produtoData = {
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
  }
  const configGeracao = { redeSocial, duracao, estilo, objetivo, tipoConteudo }

  try {
    const gerado = await gerarConteudo(produtoData, configGeracao)

    const dadosBase = {
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
      hashtags: gerado.hashtags ?? [],
      textoTela: gerado.textoTela,
      narracao: gerado.narracao,
      trilhaSugerida: gerado.trilhaSugerida,
      promptVideoIA: gerado.promptVideoIA,
      promptCurto: gerado.promptCurto,
      chamadaAcao: gerado.chamadaAcao,
      notaProduto: gerado.notaProduto,
      pontosPositivos: gerado.pontosPositivos ?? [],
      pontosNegativos: gerado.pontosNegativos ?? [],
      veredito: gerado.veredito,
      alertasCompliance: (gerado.alertasCompliance ?? []) as object[],
      status: 'roteiro_gerado',
    }

    let conteudo
    try {
      conteudo = await prisma.conteudo.create({
        data: { ...dadosBase, legendaFacebook: gerado.legendaFacebook, tipoConteudo },
      })
    } catch (errExtra) {
      // Fallback: salva sem campos opcionais caso colunas ainda não existam no banco
      console.error('[gerar] create com campos extras falhou, tentando fallback:', errExtra)
      try {
        conteudo = await prisma.conteudo.create({
          data: { ...dadosBase, legendaFacebook: gerado.legendaFacebook },
        })
      } catch {
        conteudo = await prisma.conteudo.create({ data: dadosBase })
      }
    }

    return NextResponse.json(
      { ...conteudo, legendaFacebook: gerado.legendaFacebook, tipoConteudo, tentativasCompliance: 1 },
      { status: 201 }
    )
  } catch (e) {
    // Captura TUDO (Claude, Prisma, validação) e devolve a mensagem real.
    const msg = e instanceof Error ? e.message : 'Erro desconhecido ao gerar conteúdo'
    console.error('[gerar] erro:', e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
