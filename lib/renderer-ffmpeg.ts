/**
 * RendererFFmpeg (Rodada 5) — primeira implementação REAL (não só
 * interface) de `RendererProvider` (lib/creative-factory.ts), usando
 * FFmpeg via `ffmpeg-static` (já é dependência do projeto desde rodadas
 * anteriores — nenhum serviço pago, nenhuma nova dependência).
 *
 * REGRA: este renderer NUNCA inventa texto. Todo `overlays[].texto` vem de
 * quem chama (Autopilot/CreativeFactory) já validado contra a fonte oficial
 * do produto — o renderer só compõe o que recebe. Também nunca usa mídia
 * sem que o chamador já tenha passado pelo `MediaRightsGate`.
 *
 * Formatos cobertos (POC gratuito):
 *  - reel-simples / video-vertical / short → vídeo 9:16 com zoom leve (zoompan)
 *  - imagem (Post 1:1) → imagem estática composta com overlay
 *  - carrossel → método adicional `renderCarrossel` (mín. 3 cards): Hook,
 *    Produto/benefício, CTA — fora da interface `RendererProvider` porque
 *    ela só devolve uma URL; o carrossel devolve uma lista.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import ffmpegStatic from 'ffmpeg-static'
import type { RendererProvider } from './creative-factory'
import { uploadBuffer } from './supabase'

const execFileAsync = promisify(execFile)
const BUCKET_RENDERS = 'creative-renders'

function ffmpegBin(): string {
  const bin = ffmpegStatic as unknown as string | null
  if (!bin) throw new Error('ffmpeg-static não encontrou o binário FFmpeg')
  return bin
}

/** Escapa texto para uso seguro dentro do filtro drawtext do FFmpeg. */
function escaparTextoDrawtext(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

async function baixarImagem(url: string, destino: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Não consegui baixar a mídia (HTTP ${res.status}): ${url}`)
  const ab = await res.arrayBuffer()
  await writeFile(destino, Buffer.from(ab))
}

export interface RendererFFmpegOverlay {
  texto: string
  posicao: 'topo' | 'centro' | 'rodape'
}

const POSICAO_Y: Record<RendererFFmpegOverlay['posicao'], string> = {
  topo: 'h*0.08',
  centro: '(h-text_h)/2',
  rodape: 'h*0.82',
}

function drawtextFilter(overlay: RendererFFmpegOverlay): string {
  const texto = escaparTextoDrawtext(overlay.texto)
  return `drawtext=text='${texto}':fontcolor=white:fontsize=54:box=1:boxcolor=black@0.55:boxborderw=16:x=(w-text_w)/2:y=${POSICAO_Y[overlay.posicao]}`
}

/**
 * Implementação real do `RendererProvider`: recebe assets já resolvidos
 * (URLs de imagem autorizadas) e overlays já validados (sem preço/benefício
 * inventado — quem chama garante isso), e produz o arquivo final.
 */
export class RendererFFmpeg implements RendererProvider {
  async render(params: {
    mediaAssetIds: string[]
    format: 'imagem' | 'carrossel' | 'reel-simples' | 'video-vertical' | 'short' | 'story'
    overlays?: { texto: string; posicao: string }[]
  }): Promise<{ url: string; durationSeconds?: number }> {
    const imagemUrl = params.mediaAssetIds[0]
    if (!imagemUrl) throw new Error('Nenhum asset de mídia informado para renderizar.')

    const overlays = (params.overlays ?? []).map((o) => ({
      texto: o.texto,
      posicao: (['topo', 'centro', 'rodape'].includes(o.posicao) ? o.posicao : 'rodape') as RendererFFmpegOverlay['posicao'],
    }))

    if (params.format === 'imagem') {
      const url = await this.renderizarImagemQuadrada(imagemUrl, overlays)
      return { url }
    }
    if (params.format === 'carrossel') {
      throw new Error('Use renderCarrossel() para o formato carrossel (mínimo 3 cards) — render() só devolve uma URL.')
    }
    // reel-simples / video-vertical / short / story → vídeo 9:16
    const DURACAO_SEGUNDOS = 6
    const url = await this.renderizarVideoVertical(imagemUrl, overlays, DURACAO_SEGUNDOS)
    return { url, durationSeconds: DURACAO_SEGUNDOS }
  }

  /** Reel/Story/Short: 1080x1920, zoom leve (zoompan) + overlays de texto. */
  private async renderizarVideoVertical(imagemUrl: string, overlays: RendererFFmpegOverlay[], duracaoSegundos: number): Promise<string> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const tmp = tmpdir()
    const entrada = join(tmp, `renderer-in-${id}.jpg`)
    const saida = join(tmp, `renderer-out-${id}.mp4`)

    try {
      await baixarImagem(imagemUrl, entrada)

      const fps = 30
      const totalFrames = duracaoSegundos * fps
      const filtros = [
        `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`,
        `zoompan=z='min(zoom+0.0008,1.12)':d=${totalFrames}:s=1080x1920:fps=${fps}`,
        ...overlays.map(drawtextFilter),
      ].join(',')

      await execFileAsync(ffmpegBin(), [
        '-loop', '1',
        '-i', entrada,
        '-vf', filtros,
        '-t', String(duracaoSegundos),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-an',
        '-y',
        saida,
      ])

      const buffer = await readFile(saida)
      return uploadBuffer(buffer, BUCKET_RENDERS, `${id}.mp4`, 'video/mp4')
    } finally {
      await Promise.allSettled([unlink(entrada), unlink(saida)])
    }
  }

  /** Post 1:1: 1080x1080 com overlay(s) de texto. */
  private async renderizarImagemQuadrada(imagemUrl: string, overlays: RendererFFmpegOverlay[]): Promise<string> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const tmp = tmpdir()
    const entrada = join(tmp, `renderer-in-${id}.jpg`)
    const saida = join(tmp, `renderer-out-${id}.jpg`)

    try {
      await baixarImagem(imagemUrl, entrada)
      const filtros = [`scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080`, ...overlays.map(drawtextFilter)].join(',')

      await execFileAsync(ffmpegBin(), ['-i', entrada, '-vf', filtros, '-frames:v', '1', '-y', saida])

      const buffer = await readFile(saida)
      return uploadBuffer(buffer, BUCKET_RENDERS, `${id}.jpg`, 'image/jpeg')
    } finally {
      await Promise.allSettled([unlink(entrada), unlink(saida)])
    }
  }

  /**
   * Renderer TikTok (Rodada 6, regra 26) — vídeo vertical com movimento mais
   * forte que o Reel padrão, "cortes" entre hook/legenda/CTA via timing de
   * drawtext (`enable='between(t,...)'`) e CTA queimado no final. NUNCA
   * aceita um asset de watermark do Instagram — cada canal gera seu próprio
   * arquivo final (regra 29), por isso esta função não tem parâmetro de
   * watermark: se algum dia precisar de um watermark próprio do TikTok,
   * será um parâmetro novo e explícito, nunca reaproveitado do Instagram.
   */
  async renderTikTokVideo(params: {
    imagemUrl: string
    hook: string
    legendaVisual: string
    cta: string
    duracaoSegundos?: number
  }): Promise<{ url: string; durationSeconds: number }> {
    const duracaoSegundos = params.duracaoSegundos ?? 8
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const tmp = tmpdir()
    const entrada = join(tmp, `renderer-tiktok-in-${id}.jpg`)
    const saida = join(tmp, `renderer-tiktok-out-${id}.mp4`)

    const ctaInicioSegundos = Math.max(duracaoSegundos - 2, 0)

    try {
      await baixarImagem(params.imagemUrl, entrada)

      const fps = 30
      const totalFrames = duracaoSegundos * fps
      const hookTexto = escaparTextoDrawtext(params.hook)
      const legendaTexto = escaparTextoDrawtext(params.legendaVisual)
      const ctaTexto = escaparTextoDrawtext(params.cta)

      const filtros = [
        `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`,
        // Movimento mais acentuado que o Reel padrão — próprio do TikTok.
        `zoompan=z='min(zoom+0.0015,1.25)':d=${totalFrames}:s=1080x1920:fps=${fps}`,
        `drawtext=text='${hookTexto}':fontcolor=white:fontsize=60:box=1:boxcolor=black@0.6:boxborderw=18:x=(w-text_w)/2:y=h*0.1:enable='between(t,0,2)'`,
        `drawtext=text='${legendaTexto}':fontcolor=white:fontsize=48:box=1:boxcolor=black@0.5:boxborderw=14:x=(w-text_w)/2:y=h*0.82:enable='between(t,2,${ctaInicioSegundos})'`,
        `drawtext=text='${ctaTexto}':fontcolor=white:fontsize=56:box=1:boxcolor=black@0.7:boxborderw=18:x=(w-text_w)/2:y=(h-text_h)/2:enable='gte(t,${ctaInicioSegundos})'`,
      ].join(',')

      await execFileAsync(ffmpegBin(), [
        '-loop', '1',
        '-i', entrada,
        '-vf', filtros,
        '-t', String(duracaoSegundos),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-an',
        '-y',
        saida,
      ])

      const buffer = await readFile(saida)
      const url = await uploadBuffer(buffer, BUCKET_RENDERS, `tiktok-${id}.mp4`, 'video/mp4')
      return { url, durationSeconds: duracaoSegundos }
    } finally {
      await Promise.allSettled([unlink(entrada), unlink(saida)])
    }
  }

  /**
   * Carrossel — mínimo 3 cards (Hook, Produto/benefício, CTA). Cada card usa
   * a mesma imagem autorizada com um overlay diferente; nunca inventa texto
   * — cada `cards[].texto` vem de quem chama.
   */
  async renderCarrossel(params: { imagemUrl: string; cards: { texto: string }[] }): Promise<string[]> {
    if (params.cards.length < 3) throw new Error('Carrossel precisa de no mínimo 3 cards (Hook, Produto/benefício, CTA).')
    const urls: string[] = []
    for (const card of params.cards) {
      const url = await this.renderizarImagemQuadrada(params.imagemUrl, [{ texto: card.texto, posicao: 'rodape' }])
      urls.push(url)
    }
    return urls
  }
}
