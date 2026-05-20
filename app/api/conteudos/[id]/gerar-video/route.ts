import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { submeterGeracaoVideo } from '@/lib/falai'
import { submeterGeracaoVideoRunway } from '@/lib/runway'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
)

const DOMINIOS_EXTERNOS = ['susercontent.com', 'shopee', 'alicdn', 'aliexpress', 'mercadolibre', 'mlstatic']

function ehDominioExterno(url: string) {
  try {
    const host = new URL(url).hostname
    return DOMINIOS_EXTERNOS.some((d) => host.includes(d))
  } catch {
    return false
  }
}

async function rehostarImagem(url: string, userId: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`Não foi possível baixar a imagem do produto (HTTP ${res.status})`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const ext = contentType.includes('webp') ? 'webp' : contentType.includes('png') ? 'png' : 'jpg'
  const path = `${userId}/img-${Date.now()}.${ext}`
  const { data, error } = await supabaseAdmin.storage
    .from('imagens')
    .upload(path, buffer, { contentType, upsert: false })
  if (error) throw new Error(`Re-upload da imagem falhou: ${error.message}`)
  const { data: urlData } = supabaseAdmin.storage.from('imagens').getPublicUrl(data.path)
  return urlData.publicUrl
}

// Detecta qual provedor usar: RunwayML se a chave estiver configurada, senão fal.ai.
function provedorAtivo(): 'runway' | 'falai' {
  if (process.env.RUNWAYML_API_SECRET) return 'runway'
  return 'falai'
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const conteudo = await prisma.conteudo.findFirst({
    where: { id, userId: session.user.id },
    include: { produto: { select: { imagens: true, nome: true } } },
  })
  if (!conteudo) {
    return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })
  }

  let imagemUrl = conteudo.produto.imagens?.[0]
  if (!imagemUrl) {
    return NextResponse.json(
      { error: 'O produto não tem imagens. Adicione uma imagem ao produto antes de gerar o vídeo.' },
      { status: 400 }
    )
  }

  const prompt = (conteudo.promptVideoIA || conteudo.promptCurto || '').trim()
  if (!prompt) {
    return NextResponse.json(
      { error: 'O conteúdo não tem prompt de vídeo. Gere o conteúdo novamente.' },
      { status: 400 }
    )
  }

  try {
    if (ehDominioExterno(imagemUrl)) {
      imagemUrl = await rehostarImagem(imagemUrl, session.user.id)
    }

    const provedor = provedorAtivo()

    if (provedor === 'runway') {
      const { taskId } = await submeterGeracaoVideoRunway({
        imageUrl: imagemUrl,
        prompt,
        duracaoSegundos: 10,
      })
      await prisma.conteudo.update({
        where: { id: conteudo.id },
        data: {
          videoRequestId: JSON.stringify({ provider: 'runway', taskId }),
          videoErro: null,
        },
      })
      return NextResponse.json({ ok: true, taskId })
    } else {
      const { requestId, statusUrl, resultUrl } = await submeterGeracaoVideo({
        imageUrl: imagemUrl,
        prompt,
        duracaoSegundos: 10,
      })
      await prisma.conteudo.update({
        where: { id: conteudo.id },
        data: {
          videoRequestId: JSON.stringify({ requestId, statusUrl, resultUrl }),
          videoErro: null,
        },
      })
      return NextResponse.json({ ok: true, requestId })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao iniciar geração de vídeo'
    await prisma.conteudo.update({
      where: { id: conteudo.id },
      data: { videoErro: msg },
    })
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
