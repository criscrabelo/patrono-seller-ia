import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const manualSchema = z.object({
  produtoId: z.string().min(1),
  redeSocial: z.string().min(1),
  duracao: z.number().positive(),
  estilo: z.string().min(1),
  objetivo: z.string().min(1),
  tipoConteudo: z.enum(['video', 'video_imagens', 'imagens']).optional().default('video'),
  legenda: z.string().default(''),
  hashtags: z.array(z.string()).default([]),
  roteiro: z.string().default(''),
  chamadaAcao: z.string().default(''),
})

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = manualSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const { produtoId, redeSocial, duracao, estilo, objetivo, tipoConteudo, legenda, hashtags, roteiro, chamadaAcao } = parsed.data

  const produto = await prisma.produto.findFirst({
    where: { id: produtoId, userId: session.user.id },
  })
  if (!produto) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

  const legendaMap: Partial<Record<string, string>> = {
    'TikTok': 'legendaTiktok',
    'Instagram Reels': 'legendaInstagram',
    'YouTube Shorts': 'legendaYoutube',
    'WhatsApp': 'legendaWhatsapp',
    'Facebook': 'legendaFacebook',
    'Marketplace': 'legendaMarketplace',
  }
  const campoLegenda = legendaMap[redeSocial] ?? 'legendaInstagram'

  const dadosBase = {
    userId: session.user.id,
    produtoId,
    redeSocial,
    duracao,
    estilo,
    objetivo,
    roteiro,
    legendaTiktok: campoLegenda === 'legendaTiktok' ? legenda : '',
    legendaInstagram: campoLegenda === 'legendaInstagram' ? legenda : '',
    legendaYoutube: campoLegenda === 'legendaYoutube' ? legenda : '',
    legendaWhatsapp: campoLegenda === 'legendaWhatsapp' ? legenda : '',
    legendaMarketplace: campoLegenda === 'legendaMarketplace' ? legenda : '',
    hashtags,
    chamadaAcao,
    textoTela: '',
    narracao: '',
    trilhaSugerida: '',
    promptVideoIA: '',
    promptCurto: '',
    notaProduto: 0,
    pontosPositivos: [],
    pontosNegativos: [],
    veredito: '',
    alertasCompliance: [],
    status: 'roteiro_gerado',
  }

  try {
    let conteudo
    try {
      conteudo = await prisma.conteudo.create({
        data: {
          ...dadosBase,
          legendaFacebook: campoLegenda === 'legendaFacebook' ? legenda : '',
          tipoConteudo,
        },
      })
    } catch {
      conteudo = await prisma.conteudo.create({ data: dadosBase })
    }
    return NextResponse.json(
      { ...conteudo, legendaFacebook: campoLegenda === 'legendaFacebook' ? legenda : '', tipoConteudo },
      { status: 201 }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao salvar conteúdo'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
