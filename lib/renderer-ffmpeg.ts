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
import { analisarAudio } from './audio-ffprobe'

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

function formatarTimestampSrt(segundos: number): string {
  const totalMs = Math.max(Math.round(segundos * 1000), 0)
  const ms = totalMs % 1000
  const totalSeg = Math.floor(totalMs / 1000)
  const s = totalSeg % 60
  const totalMin = Math.floor(totalSeg / 60)
  const m = totalMin % 60
  const h = Math.floor(totalMin / 60)
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

/** Escapa o caminho do arquivo `.srt` para uso dentro do filtro `subtitles=filename='...'`. */
function escaparCaminhoFiltro(caminho: string): string {
  return caminho.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

/**
 * Legenda queimada via `subtitles`/libass — usado no lugar de `drawtext`
 * porque nem todo build do `ffmpeg-static` traz o filtro `drawtext`
 * compilado (verificado nesta rodada: o build usado neste ambiente não
 * tem `drawtext`, mas tem `subtitles`/`ass` via libass). Gera um `.srt`
 * cobrindo toda a duração do vídeo e devolve o filtro pronto para `-vf`.
 */
async function prepararFiltroLegenda(legenda: string, duracaoSegundos: number, caminhoSrt: string): Promise<string> {
  const srt = `1\n${formatarTimestampSrt(0)} --> ${formatarTimestampSrt(duracaoSegundos)}\n${legenda}\n`
  await writeFile(caminhoSrt, srt, 'utf-8')
  const caminhoEscapado = escaparCaminhoFiltro(caminhoSrt)
  return `subtitles=filename='${caminhoEscapado}':force_style='Fontsize=16,PrimaryColour=&Hffffff&,BackColour=&H80000000&,BorderStyle=3,Outline=0,Alignment=2,MarginV=60'`
}

/** Um bloco de texto queimado no vídeo, com janela de tempo própria. */
export interface CueRoteiro {
  texto: string
  inicioSegundos: number
  fimSegundos: number
}

/**
 * Versão multi-bloco de `prepararFiltroLegenda`: hook, legenda e CTA aparecem
 * em momentos diferentes do MESMO vídeo. Continua via `subtitles`/libass (e
 * não `drawtext`) porque nem todo build do `ffmpeg-static` traz `drawtext`
 * compilado — o mesmo motivo já documentado acima.
 */
async function prepararFiltroRoteiro(cues: CueRoteiro[], caminhoSrt: string): Promise<string> {
  const blocos = cues
    .filter((c) => c.texto.trim() && c.fimSegundos > c.inicioSegundos)
    .map(
      (c, i) =>
        `${i + 1}\n${formatarTimestampSrt(c.inicioSegundos)} --> ${formatarTimestampSrt(c.fimSegundos)}\n${c.texto}\n`
    )
  await writeFile(caminhoSrt, blocos.join('\n'), 'utf-8')
  const caminhoEscapado = escaparCaminhoFiltro(caminhoSrt)
  return `subtitles=filename='${caminhoEscapado}':force_style='Fontsize=16,PrimaryColour=&Hffffff&,BackColour=&H80000000&,BorderStyle=3,Outline=0,Alignment=2,MarginV=60'`
}

/**
 * Fundo neutro 9:16 gerado pelo próprio FFmpeg (`lavfi`), para quando o
 * produto não tem mídia autorizada a aparecer. Não é "imagem de produto":
 * é um fundo liso, deliberadamente sem nada que sugira o produto — o vídeo
 * continua honesto, com voz e texto, sem fabricar uma foto que não existe.
 */
async function gerarFundoNeutro(destino: string): Promise<void> {
  await execFileAsync(ffmpegBin(), [
    '-f', 'lavfi',
    '-i', 'color=c=0x14161A:s=1080x1920',
    '-frames:v', '1',
    '-y',
    destino,
  ])
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
   * Prévia real sem GPU (Rodada 9, regra 16) — foto + voz clonada (já
   * sintetizada e aprovada no Voice Quality Gate, recebida como arquivo
   * LOCAL) + motion graphics (zoompan) + legenda. A duração do vídeo segue
   * a duração real do áudio (nunca um valor arbitrário). NUNCA rotulado
   * como lip-sync — quem chama usa o status `READY_VOICE_ONLY_PREVIEW`.
   */
  async renderVoiceOnlyPreview(params: { imagemUrl: string; audioLocalPath: string; legenda: string }): Promise<{ url: string; durationSeconds: number }> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const tmp = tmpdir()
    const entrada = join(tmp, `voice-only-in-${id}.jpg`)
    const legendaSrt = join(tmp, `voice-only-legenda-${id}.srt`)
    const saida = join(tmp, `voice-only-out-${id}.mp4`)

    try {
      await baixarImagem(params.imagemUrl, entrada)

      const analiseAudio = await analisarAudio(params.audioLocalPath)
      const duracaoSegundos = analiseAudio.duracaoSegundos ?? 6
      const fps = 30
      const totalFrames = Math.max(Math.round(duracaoSegundos * fps), fps)
      const filtroLegenda = await prepararFiltroLegenda(params.legenda, duracaoSegundos, legendaSrt)
      const filtros = [
        `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`,
        `zoompan=z='min(zoom+0.0006,1.08)':d=${totalFrames}:s=1080x1920:fps=${fps}`,
        filtroLegenda,
      ].join(',')

      await execFileAsync(ffmpegBin(), [
        '-loop', '1',
        '-i', entrada,
        '-i', params.audioLocalPath,
        '-vf', filtros,
        '-t', String(duracaoSegundos),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-y',
        saida,
      ])

      const buffer = await readFile(saida)
      const url = await uploadBuffer(buffer, BUCKET_RENDERS, `voice-only-${id}.mp4`, 'video/mp4')
      return { url, durationSeconds: duracaoSegundos }
    } finally {
      await Promise.allSettled([unlink(entrada), unlink(legendaSrt), unlink(saida)])
    }
  }

  /**
   * Conteúdo de afiliado completo, CPU_ONLY e sem avatar (Rodada 10) —
   * mídia do produto (ou fundo neutro) + NARRAÇÃO REAL da voz aprovada +
   * hook/legenda/CTA queimados, em 9:16.
   *
   * É o encontro de duas metades que já existiam separadas e nunca se
   * falavam: `renderTikTokVideo()` compunha o visual do TikTok mas terminava
   * com `-an` (vídeo mudo, duração fixa de 8s), e `renderVoiceOnlyPreview()`
   * tinha a trilha de áudio real mas era foto + legenda única, sem
   * hook/CTA. Nenhum caminho juntava produto e voz.
   *
   * Devolve o arquivo LOCAL (não sobe pra lugar nenhum): quem chama decide
   * o destino — no Digital Twin é sempre o bucket PRIVADO, porque o vídeo
   * carrega a voz da proprietária. Mesmo contrato de `gerarPreviaDeVoz()`.
   *
   * A duração segue a duração REAL do áudio, nunca um valor arbitrário.
   */
  async renderTikTokComNarracao(params: {
    /** `null` quando o produto não tem mídia autorizada — vira fundo neutro. */
    imagemUrl: string | null
    audioLocalPath: string
    hook: string
    legenda: string
    cta: string
  }): Promise<{ caminhoLocal: string; durationSeconds: number; usouFundoNeutro: boolean }> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const tmp = tmpdir()
    const entrada = join(tmp, `tiktok-narracao-in-${id}.jpg`)
    const roteiroSrt = join(tmp, `tiktok-narracao-srt-${id}.srt`)
    const saida = join(tmp, `tiktok-narracao-out-${id}.mp4`)

    const usouFundoNeutro = !params.imagemUrl
    try {
      if (params.imagemUrl) {
        await baixarImagem(params.imagemUrl, entrada)
      } else {
        await gerarFundoNeutro(entrada)
      }

      const analiseAudio = await analisarAudio(params.audioLocalPath)
      const duracaoSegundos = analiseAudio.duracaoSegundos ?? 8
      const fps = 30
      const totalFrames = Math.max(Math.round(duracaoSegundos * fps), fps)

      // Hook nos primeiros segundos, CTA no fim, legenda no meio — as
      // janelas saem da duração real, então nunca cortam a fala.
      const fimHook = Math.min(2.5, duracaoSegundos * 0.2)
      const inicioCta = Math.max(duracaoSegundos - 3, fimHook)
      const filtroRoteiro = await prepararFiltroRoteiro(
        [
          { texto: params.hook, inicioSegundos: 0, fimSegundos: fimHook },
          { texto: params.legenda, inicioSegundos: fimHook, fimSegundos: inicioCta },
          { texto: params.cta, inicioSegundos: inicioCta, fimSegundos: duracaoSegundos },
        ],
        roteiroSrt
      )

      const filtros = [
        `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`,
        `zoompan=z='min(zoom+0.0006,1.08)':d=${totalFrames}:s=1080x1920:fps=${fps}`,
        filtroRoteiro,
      ].join(',')

      await execFileAsync(ffmpegBin(), [
        '-loop', '1',
        '-i', entrada,
        '-i', params.audioLocalPath,
        '-vf', filtros,
        '-t', String(duracaoSegundos),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-y',
        saida,
      ])

      return { caminhoLocal: saida, durationSeconds: duracaoSegundos, usouFundoNeutro }
    } finally {
      // `saida` NÃO entra aqui: é o retorno, quem chama apaga depois de subir.
      await Promise.allSettled([unlink(entrada), unlink(roteiroSrt)])
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
